import { CATEGORIES, type Anchor, type Annotation, type AnnotationCategory, type CommentAuthor, type Mode } from './types';
import type { AnnotationStorage } from './storage';
import { serialize } from './anchor';
import { createAnnotationLayer, type DisplayMode, type Point } from './layer';
import { isOnRoute, normalizePath, onLocationChange } from './router';
import { icon, type IconName } from './icons';
import { clampToViewport, createUi, el, type Theme } from './ui';
import { COCKATOO } from './logo';
import { annotationsToMarkdown } from './markdown';

export type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type Settings = {
  display: DisplayMode;
  outlines: boolean;
  theme: Theme;
  position: Position;
};

export type WidgetOptions = {
  mode: Mode;
  storage: AnnotationStorage;
  annotations: Annotation[];
  /** Names the current page for scoping annotations; `null` disables scoping. */
  getRoute: (knownRoutes: string[]) => string | null;
  /** Explicit hosting prefix used for links to threads on other pages. */
  basePath?: string;
  /** Starting settings; each viewer's own changes are remembered on top of these. */
  defaults: Settings;
  /** Extra author actions shown in the toolbar (e.g. "Export HTML" on static pages). */
  actions: WidgetAction[];
  /** ⌥A annotate, ⌥H show/hide. Esc always works. */
  shortcuts: boolean;
  onChange?: (annotations: Annotation[]) => void;
};

export type WidgetAction = {
  label: string;
  icon: IconName;
  run(annotations: Annotation[]): void | string | Promise<void | string>;
};

export type Widget = {
  setAnnotations(annotations: Annotation[]): void;
  getAnnotations(): Annotation[];
  show(): void;
  hide(): void;
  toggle(): void;
  isVisible(): boolean;
  destroy(): void;
};

const KEY_VISIBLE = 'annotoo:visible';
const KEY_OPEN = 'annotoo:open';
const KEY_SETTINGS = 'annotoo:settings';
const KEY_LAST_CATEGORY = 'annotoo:category';
const EDITOR_W = 300;

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preferences are a convenience only */
  }
}

function readSettings(defaults: Settings): Settings {
  try {
    const saved = JSON.parse(readPref(KEY_SETTINGS, '{}')) as Partial<Settings>;
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** Shortcut labels, in the platform's own notation. */
export const KEYS = {
  annotate: IS_MAC ? '⌥A' : 'Alt+A',
  visibility: IS_MAC ? '⌥H' : 'Alt+H',
};

/** "⌥A" / "Alt+A" → "Alt+A" for aria-keyshortcuts. */
function ariaKeys(label: string): string {
  return label.replace('⌥', 'Alt+');
}

/** True when the key event comes from a text field (the page's or ours). */
function isTyping(e: Event): boolean {
  const t = e.composedPath()[0];
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `a_${crypto.randomUUID()}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `a_${Date.now().toString(36)}_${rand}`;
}

function labelFor(cat: AnnotationCategory | undefined): string {
  return CATEGORIES.find((c) => c.value === (cat ?? 'note'))?.label ?? 'Note';
}

/** A short, recognisable name for an element, shown while picking (e.g. `button.primary`). */
function describe(target: Element): string {
  const hook = target.getAttribute('data-annotoo-id');
  if (hook) return hook;
  const tag = target.tagName.toLowerCase();
  if (target.id && !/^[:«]/.test(target.id)) return `${tag}#${target.id}`;
  const cls = Array.from(target.classList).slice(0, 2).join('.');
  return cls ? `${tag}.${cls}` : tag;
}

export function createWidget(opts: WidgetOptions): Widget {
  const author = opts.mode === 'author';
  const ui = createUi();

  // ---- state -------------------------------------------------------------------
  let annotations = opts.annotations.slice();
  let settings = readSettings(opts.defaults);
  let visible = readPref(KEY_VISIBLE, '1') !== '0';
  let open = readPref(KEY_OPEN, '0') === '1';
  let annotating = false;
  let panelOpen = false;
  let settingsOpen = false;
  let activeId: string | null = null;
  /** The editor: a new annotation (no `id`) or an existing one. */
  let editing: { id?: string; anchor: Anchor; at: Point } | null = null;
  let unanchored = new Set<string>();
  let threadId: string | null = null;
  let threadTrigger: { element: HTMLElement; label: string | null } | null = null;
  let pendingThreadFocusLabel: string | null = null;
  let threadFilter: 'open' | 'resolved' | 'all' = 'open';
  let pending = false;
  let destroyed = false;
  const replyDrafts = new Map<string, string>();
  const threadErrors = new Map<string, string>();
  const canWrite = () => author && opts.storage.identity !== null;
  const currentAuthor = (): CommentAuthor => opts.storage.identity ?? { id: 'local', name: 'Local author' };
  const identityHelp = () => opts.storage.identityError || 'Set Git user.name and user.email in this repository, then restart the development server to join the discussion.';

  const left = () => settings.position.endsWith('left');
  const top = () => settings.position.startsWith('top');
  /** Classes that place a surface relative to the toolbar's corner. */
  const corner = () => `${left() ? ' left' : ''}${top() ? ' top' : ''}`;
  const currentRoute = () =>
    opts.getRoute([...new Set(annotations.map((a) => a.route).filter((r): r is string => !!r))]);
  const routeAnnotations = () => {
    const route = currentRoute();
    return annotations.filter((a) => isOnRoute(a, route));
  };

  /** Keep the authoritative list until persistence succeeds. Synchronous adapters stay synchronous. */
  function commit(next: Annotation[], onSaved?: () => void, onError?: (message: string) => void): void {
    if (!canWrite() || pending || destroyed) return;
    pending = true;
    syncWriteControls();
    const failed = (err: unknown) => {
      pending = false;
      if (destroyed) return;
      const message = err instanceof Error ? err.message : String(err);
      onError?.(message);
      syncWriteControls();
      renderThread();
      showToast(message);
    };
    const saved = (canonical: void | Annotation[]) => {
      pending = false;
      if (destroyed) return;
      annotations = Array.isArray(canonical) ? canonical.slice() : next;
      onSaved?.();
      opts.onChange?.(annotations.slice());
      renderAll();
      syncWriteControls();
    };
    try {
      const result = opts.storage.save(next);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        void Promise.resolve(result).then(saved, failed);
      } else saved(result as void | Annotation[]);
    } catch (err) {
      failed(err);
    }
  }

  function syncWriteControls(): void {
    const focused = ui.shadow.activeElement;
    const focusedLabel = focused instanceof HTMLElement && thread?.contains(focused) ? focused.getAttribute('aria-label') : null;
    for (const node of ui.shadow.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('[data-write]')) {
      node.disabled = pending || !canWrite() || node.dataset.empty === 'true';
    }
    for (const field of ui.shadow.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.editor input, .editor textarea, .thread textarea')) field.readOnly = pending;
    editor?.setAttribute('aria-busy', String(pending));
    thread?.setAttribute('aria-busy', String(pending));
    if (pending && (focused instanceof HTMLButtonElement || focused instanceof HTMLSelectElement) && focused.disabled && focusedLabel && thread?.contains(focused)) {
      // Native disabled buttons lose focus. Keep its place in the discussion while saving.
      pendingThreadFocusLabel = focusedLabel;
      thread.focus({ preventScroll: true });
    }
  }

  function saveSettings(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch };
    writePref(KEY_SETTINGS, JSON.stringify(settings));
    applySettings();
    renderDock();
    renderSettings();
    if (panelOpen) renderPanel();
    renderThread();
  }

  function applySettings(): void {
    ui.setTheme(settings.theme);
    layer.configure({ display: settings.display, outlines: settings.outlines });
  }

  // ---- surfaces ------------------------------------------------------------------
  const layer = createAnnotationLayer(ui.layer, ui.host, {
    // Notes are locked outside Annotate: clicking one just selects it, as for viewers.
    onSelect: (a) => (canWrite() && annotating ? openEditor(a) : setActive(activeId === a.id ? null : a.id)),
    onThread: (a, trigger) => openThread(a.id, trigger),
    onUnanchoredChange: (ids) => {
      unanchored = ids;
      if (panelOpen) renderPanel();
    },
  });

  const highlightTag = el('span', { class: 'tag' });
  const highlight = el('div', { class: 'highlight', hidden: true }, [highlightTag]);
  ui.layer.append(highlight);

  let dock: HTMLElement | null = null;
  let panel: HTMLElement | null = null;
  let thread: HTMLElement | null = null;
  let editor: HTMLElement | null = null;
  let settingsPop: HTMLElement | null = null;
  let toast: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let dockPainted = false;

  function tool(
    iconName: IconName,
    label: string,
    onClick: () => void,
    extra: { on?: boolean; muted?: boolean; badge?: number; kbd?: string; disabled?: boolean } = {},
  ): HTMLButtonElement {
    const cls = ['tool', extra.on && 'is-on', extra.muted && 'is-muted'].filter(Boolean).join(' ');
    return el(
      'button',
      {
        class: cls,
        type: 'button',
        'data-tip': extra.kbd && opts.shortcuts ? `${label}  ${extra.kbd}` : label,
        'aria-keyshortcuts': extra.kbd && opts.shortcuts ? ariaKeys(extra.kbd) : null,
        'aria-label': label,
        disabled: extra.disabled,
        'aria-pressed': extra.on === undefined ? null : String(extra.on),
        onClick: (e: Event) => {
          e.stopPropagation();
          onClick();
        },
      },
      [icon(iconName, 18), extra.badge ? el('span', { class: 'badge' }, [String(extra.badge)]) : null],
    );
  }

  function renderDock(): void {
    const wasOpen = dock?.classList.contains('is-open');
    if (dock && wasOpen && !open) return foldDock(dock);
    dock?.remove();
    const count = routeAnnotations().filter((a) => a.status !== 'resolved').length;
    let children: (HTMLElement | null)[];

    if (!open) {
      const launcher = el(
        'button',
        {
          class: `launcher${visible ? '' : ' is-muted'}`,
          type: 'button',
          'data-tip':
            (visible ? 'Annotations' : 'Annotations (hidden)') +
            (author && opts.shortcuts ? `  ${KEYS.annotate}` : '') +
            '\nDrag to move',
          'aria-label': 'Open Annotoo',
          'aria-expanded': 'false',
          onClick: (e: Event) => {
            e.stopPropagation();
            if (consumeDrag()) return;
            setOpen(true);
            // Opening the tab is almost always "I want to annotate something": start there.
            // (Only on a click; a toolbar restored open on page load stays out of the way.)
            if (canWrite()) setAnnotating(true);
          },
        },
        [
          el('img', { class: 'bird', src: COCKATOO, alt: '', width: 29, height: 36, draggable: 'false' }),
          count ? el('span', { class: 'badge' }, [String(count)]) : null,
        ],
      );
      children = [launcher];
    } else {
      // The cockatoo stays where the closed tab was, so the tab reads as stretching into the
      // toolbar; clicking it again folds the toolbar back into the tab.
      const bird = el(
        'button',
        {
          class: 'tool bird-btn',
          type: 'button',
          'data-tip': 'Close toolbar\nDrag to move',
          'aria-label': 'Close toolbar',
          'aria-expanded': 'true',
          onClick: (e: Event) => {
            e.stopPropagation();
            if (consumeDrag()) return;
            setOpen(false);
          },
        },
        [el('img', { class: 'bird', src: COCKATOO, alt: '', width: 24, height: 30, draggable: 'false' })],
      );
      const tools = [
        author
          ? tool('annotate', annotating ? 'Stop annotating' : 'Annotate an element', () => setAnnotating(!annotating), { on: annotating, kbd: KEYS.annotate, disabled: !canWrite() })
          : null,
        tool(visible ? 'eye' : 'eyeOff', visible ? 'Hide annotations' : 'Show annotations', () => setVisible(!visible), { muted: !visible, kbd: KEYS.visibility }),
        tool('list', 'Annotation list', () => setPanel(!panelOpen), { on: panelOpen, badge: panelOpen ? 0 : count }),
        ...(author
          ? [
              tool('copy', 'Copy as Markdown', () => void copyMarkdown()),
              ...opts.actions.map((action) => tool(action.icon, action.label, () => void runAction(action))),
            ]
          : []),
        el('span', { class: 'sep' }),
        tool('settings', 'Settings', () => setSettingsOpen(!settingsOpen), { on: settingsOpen }),
      ];
      children = left()
        ? [bird, el('span', { class: 'sep' }), ...tools]
        : [...tools, el('span', { class: 'sep' }), bird];
    }

    dock = el(
      'div',
      { class: `dock${corner()}${open ? ' is-open' : ' is-tab'}`, role: 'toolbar', 'aria-label': 'Annotoo' },
      children,
    );
    // Only animate on first paint and when opening, not on every re-render.
    if (dockPainted && (!open || wasOpen)) dock.style.animation = 'none';
    dockPainted = true;
    ui.mount(dock);
    const handle = dock.querySelector<HTMLElement>('.launcher, .bird-btn');
    if (handle) dragToSide(handle);
  }

  /** Plays the toolbar folding back into the tab, then swaps the tab in. Renders asked
   *  for meanwhile are dropped: the swap re-reads state. Reopening mid-fold just replaces it. */
  function foldDock(bar: HTMLElement): void {
    if (bar.classList.contains('is-closing')) return;
    bar.classList.add('is-closing');
    bar.style.animation = '';
    const swap = () => {
      if (dock !== bar) return;
      bar.remove();
      dock = null;
      renderDock();
    };
    const running = bar.getAnimations?.() ?? [];
    if (!running.length) return swap();
    void Promise.all(running.map((a) => a.finished)).then(swap, swap);
  }

  // ---- drag the tab; it snaps to the nearest corner ------------------------------
  let dragged = false;
  /** True (once) if the click that's about to fire was the end of a drag. */
  function consumeDrag(): boolean {
    const was = dragged;
    dragged = false;
    return was;
  }

  /** Drag the tab anywhere; on release it snaps to the nearest corner. */
  function dragToSide(handle: HTMLElement): void {
    handle.addEventListener('pointerdown', (down: PointerEvent) => {
      if (down.button !== 0 || !dock) return;
      const bar = dock;
      const startX = down.clientX;
      const startY = down.clientY;
      let moving = false;
      dragged = false;

      const move = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moving && Math.hypot(dx, dy) < 5) return;
        if (!moving) {
          moving = true;
          bar.classList.add('is-dragging');
        }
        bar.style.translate = `${dx}px ${dy}px`;
      };
      const up = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        if (!moving) return;
        dragged = true;
        bar.classList.remove('is-dragging');
        bar.style.translate = '';
        const vertical = e.clientY < window.innerHeight / 2 ? 'top' : 'bottom';
        const horizontal = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
        const nearest = `${vertical}-${horizontal}` as Position;
        if (nearest !== settings.position) saveSettings({ position: nearest });
        // A drag ends with a click on the handle; swallow it if it never arrives.
        setTimeout(() => (dragged = false), 0);
      };
      // Listen on the window: the pointer leaves the small tab almost immediately.
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    });
  }

  function setOpen(next: boolean): void {
    open = next;
    writePref(KEY_OPEN, next ? '1' : '0');
    if (!next) {
      setAnnotating(false);
      setPanel(false);
      setSettingsOpen(false);
      closeThread();
    }
    renderDock();
  }

  function setVisible(next: boolean): void {
    visible = next;
    writePref(KEY_VISIBLE, next ? '1' : '0');
    ui.layer.classList.toggle('is-hidden', !visible);
    if (!visible) {
      closeEditor();
      setActive(null);
      setAnnotating(false);
    }
    renderDock();
  }

  function setPanel(next: boolean): void {
    panelOpen = next;
    if (next) setSettingsOpen(false);
    renderPanel();
    renderDock();
  }

  function setSettingsOpen(next: boolean): void {
    settingsOpen = next;
    if (next && panelOpen) {
      panelOpen = false;
      renderPanel();
    }
    renderSettings();
    renderDock();
  }

  function setActive(id: string | null): void {
    activeId = id;
    layer.setActive(id);
    if (panelOpen) renderPanel();
  }

  // ---- settings popover -----------------------------------------------------------
  function segmented<T extends string>(label: string, value: T, options: [T, string][], onPick: (v: T) => void): HTMLElement {
    return el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, options.map(([v, text]) =>
      el('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(v === value),
        onClick: () => onPick(v),
      }, [text]),
    ));
  }

  function toggle(label: string, on: boolean, onFlip: (v: boolean) => void): HTMLElement {
    return el('button', {
      class: 'switch',
      type: 'button',
      role: 'switch',
      'aria-label': label,
      'aria-checked': String(on),
      onClick: () => onFlip(!on),
    });
  }

  /** A tiny screen with a tab in each corner: pick where the toolbar lives. */
  function cornerPicker(): HTMLElement {
    const corners: [Position, string][] = [
      ['top-left', 'Top left'],
      ['top-right', 'Top right'],
      ['bottom-left', 'Bottom left'],
      ['bottom-right', 'Bottom right'],
    ];
    return el('div', { class: 'corners', role: 'radiogroup', 'aria-label': 'Toolbar position' }, corners.map(([value, label]) =>
      el('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(value === settings.position),
        'aria-label': label,
        title: label,
        dataset: { corner: value },
        onClick: () => saveSettings({ position: value }),
      }, [el('span', { class: 'corner-tab' })]),
    ));
  }

  function renderSettings(): void {
    const wasPainted = !!settingsPop;
    settingsPop?.remove();
    settingsPop = null;
    if (!settingsOpen) return;

    const status = author ? opts.storage.identity === null ? identityHelp() : opts.storage.describe?.() ?? '' : `View only · ${routeAnnotations().length} on this page`;
    settingsPop = el('div', { class: `surface settings${corner()}`, role: 'dialog', 'aria-label': 'Annotoo settings' }, [
      el('h3', {}, ['Settings']),
      el('div', { class: 'setting stack' }, [
        el('span', { class: 'label' }, ['Show notes']),
        segmented('Show notes', settings.display, [['always', 'Always'], ['hover', 'On hover'], ['markers', 'Numbers only']], (display) => saveSettings({ display })),
      ]),
      el('div', { class: 'setting' }, [
        el('span', { class: 'label' }, ['Outline annotated elements']),
        toggle('Outline annotated elements', settings.outlines, (outlines) => saveSettings({ outlines })),
      ]),
      el('div', { class: 'setting stack' }, [
        el('span', { class: 'label' }, ['Theme']),
        segmented('Theme', settings.theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], (theme) => saveSettings({ theme })),
      ]),
      el('div', { class: 'setting stack' }, [
        el('span', { class: 'label' }, ['Toolbar position']),
        cornerPicker(),
      ]),
      opts.shortcuts
        ? el('div', { class: 'setting stack' }, [
            el('span', { class: 'label' }, ['Keyboard shortcuts']),
            el('dl', { class: 'keys' }, [
              ...(author ? [el('dt', {}, ['Annotate']), el('dd', {}, [el('kbd', {}, [KEYS.annotate])])] : []),
              el('dt', {}, ['Show or hide annotations']),
              el('dd', {}, [el('kbd', {}, [KEYS.visibility])]),
              el('dt', {}, ['Step back or close']),
              el('dd', {}, [el('kbd', {}, ['Esc'])]),
            ]),
          ])
        : null,
      author && annotations.length
        ? el('div', { class: 'setting' }, [
            el('button', { class: 'danger-link', type: 'button', 'data-write': '', disabled: pending || !canWrite(), onClick: clearAll }, [`Delete all ${annotations.length} annotations…`]),
          ])
        : null,
      el('hr'),
      el('div', { class: 'foot' }, [
        el('span', { class: `dot${author && /not saved|only/i.test(status) ? ' warn' : ''}` }),
        el('span', {}, [status]),
      ]),
    ]);
    if (wasPainted) settingsPop.style.animation = 'none';
    ui.mount(settingsPop);
  }

  function restoreDeleted(deleted: Annotation[]): void {
    const ids = new Set(annotations.map((a) => a.id));
    commit([...annotations, ...deleted.filter((a) => !ids.has(a.id))]);
  }

  function clearAll(): void {
    const before = annotations.slice();
    commit([], () => showToast(`Deleted ${before.length} annotations`, { label: 'Undo', run: () => restoreDeleted(before) }));
  }

  // ---- toast ---------------------------------------------------------------------
  function showToast(message: string, action?: { label: string; run: () => void }): void {
    toast?.remove();
    clearTimeout(toastTimer);
    toast = el('div', { class: `toast${top() ? ' low' : ''}`, role: 'status' }, [
      el('span', {}, [message]),
      action
        ? el('button', {
            type: 'button',
            onClick: () => {
              action.run();
              toast?.remove();
            },
          }, [action.label])
        : null,
    ]);
    ui.mount(toast);
    toastTimer = setTimeout(() => toast?.remove(), action ? 6000 : 2200);
  }

  async function copyMarkdown(): Promise<void> {
    const markdown = annotationsToMarkdown(annotations);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const ta = el('textarea', {}, [markdown]);
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(`Copied ${annotations.length} annotation${annotations.length === 1 ? '' : 's'} as Markdown`);
  }

  async function runAction(action: WidgetAction): Promise<void> {
    if (pending) return;
    setAnnotating(false);
    closeEditor();
    try {
      const message = await action.run(annotations.slice());
      if (message) showToast(message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  }

  // ---- editor (author) -------------------------------------------------------------
  function openEditor(a: Annotation): void {
    if (!canWrite() || pending) return;
    closeThread();
    closeEditor();
    editing = { id: a.id, anchor: a.anchor, at: { x: 0, y: 0 } };
    setActive(a.id);
    renderEditor(a);
    layer.setEditing(a.id);
  }

  function closeEditor(): void {
    if (pending) return;
    if (editing?.id) layer.setEditing(null);
    editing = null;
    layer.setDraft(null);
    editor?.remove();
    editor = null;
  }

  function positionEditor(): void {
    if (!editor || !editing) return;
    const size = { w: EDITOR_W, h: editor.offsetHeight || 220 };
    const existing = editing.id ? annotations.find((a) => a.id === editing!.id) : undefined;
    const box = layer.editorBoxFor(existing ?? editing.anchor, size);
    const pos = box ? clampToViewport(box.x, box.y, size.w, size.h) : clampToViewport(editing.at.x + 24, editing.at.y - 20, size.w, size.h);
    editor.style.left = `${pos.x}px`;
    editor.style.top = `${pos.y}px`;
  }

  function renderEditor(existing?: Annotation): void {
    editor?.remove();
    let category: AnnotationCategory =
      existing?.category ?? ((readPref(KEY_LAST_CATEGORY, 'note') as AnnotationCategory) || 'note');
    const snapshot = (a: Annotation) => JSON.stringify([a.title ?? '', a.body, a.category ?? 'note']);
    let baseline = existing ? snapshot(existing) : null;

    const title = el('input', {
      class: 'title',
      type: 'text',
      placeholder: 'Title (optional)',
      'aria-label': 'Title',
      maxlength: 120,
    }) as HTMLInputElement;
    title.value = existing?.title ?? '';

    const body = el('textarea', {
      placeholder: 'What should people know about this element?',
      'aria-label': 'Annotation',
    }) as HTMLTextAreaElement;
    body.value = existing?.body ?? '';

    const save = el('button', { class: 'btn primary', type: 'button', 'data-write': '' }, [existing ? 'Save' : 'Add']) as HTMLButtonElement;

    const sync = () => {
      save.dataset.empty = String(body.value.trim() === '');
      save.disabled = pending || !canWrite() || save.dataset.empty === 'true';
      body.style.height = 'auto';
      body.style.height = `${Math.min(260, Math.max(84, body.scrollHeight + 2))}px`;
    };
    const submit = () => {
      if (save.disabled) return;
      writePref(KEY_LAST_CATEGORY, category);
      const t = title.value.trim() || undefined;
      const b = body.value.trim();
      const onError = (message: string) => {
        error.hidden = false;
        error.textContent = message;
      };
      error.hidden = true;
      if (existing) {
        if (!annotations.some((a) => a.id === existing.id)) {
          onError('This thread was deleted elsewhere. Copy your draft before closing.');
          return;
        }
        const latest = annotations.find((a) => a.id === existing.id)!;
        if (snapshot(latest) !== baseline) {
          onError('This comment changed elsewhere. Review the latest version before replacing it.');
          review.replaceChildren(
            el('div', { class: 'latest-label' }, ['Latest saved version']),
            authorLine(latest.updatedBy ?? latest.author, latest.updatedAt ?? latest.createdAt),
            ...(latest.title ? [el('strong', {}, [latest.title])] : []),
            el('div', { class: 'comment-body' }, [latest.body]),
            el('div', { class: 'review-actions' }, [
              el('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Use latest', onClick: () => {
                const fresh = annotations.find((a) => a.id === existing.id);
                if (!fresh) return;
                baseline = snapshot(fresh);
                title.value = fresh.title ?? '';
                body.value = fresh.body;
                category = fresh.category ?? 'note';
                for (const other of cats.querySelectorAll<HTMLElement>('.cat-toggle')) {
                  const on = other.dataset.cat === category;
                  other.classList.toggle('is-on', on);
                  other.setAttribute('aria-checked', String(on));
                }
                review.hidden = error.hidden = true;
                sync();
                body.focus();
              } }, ['Use latest']),
              el('button', { class: 'btn primary', type: 'button', 'aria-label': 'Save my changes', onClick: () => {
                // Acknowledge exactly the version shown, then recheck before persisting.
                baseline = snapshot(latest);
                review.hidden = true;
                submit();
              } }, ['Save my changes']),
            ]),
          );
          review.hidden = false;
          positionEditor();
          return;
        }
        review.hidden = true;
        commit(annotations.map((a) => (a.id === existing.id ? { ...a, title: t, body: b, category, updatedAt: Date.now(), ...(opts.storage.identity ? { updatedBy: opts.storage.identity } : {}) } : a)), () => {
          closeEditor();
          setActive(existing.id);
        }, onError);
      } else if (editing) {
        const n = annotations.reduce((max, a) => Math.max(max, a.n), 0) + 1;
        const created: Annotation = {
          id: newId(),
          n,
          anchor: editing.anchor,
          title: t,
          body: b,
          category,
          createdAt: Date.now(),
          route: currentRoute() ?? undefined,
          ...(opts.storage.identity ? { author: opts.storage.identity } : {}),
        };
        commit([...annotations, created], () => {
          closeEditor();
          // Leave the new note open, even in hover / numbers-only display.
          setActive(created.id);
        }, onError);
      }
    };
    const onKeys = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
      }
    };
    save.addEventListener('click', submit);
    body.addEventListener('input', sync);
    body.addEventListener('keydown', onKeys);
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        body.focus();
      } else onKeys(e);
    });

    const cats = el('div', { class: 'cats', role: 'radiogroup', 'aria-label': 'Category' }, CATEGORIES.map((c) => {
      const b = el('button', {
        class: `cat-toggle${category === c.value ? ' is-on' : ''}`,
        type: 'button',
        role: 'radio',
        dataset: { cat: c.value },
        'aria-checked': String(category === c.value),
      }, [c.label]);
      b.addEventListener('click', () => {
        category = c.value;
        for (const other of cats.querySelectorAll<HTMLElement>('.cat-toggle')) {
          const on = other.dataset.cat === category;
          other.classList.toggle('is-on', on);
          other.setAttribute('aria-checked', String(on));
        }
      });
      return b;
    }));

    const error = el('div', { class: 'save-error', role: 'alert', hidden: true });
    const review = el('div', { class: 'conflict-review', hidden: true });
    editor = el('div', { class: 'surface editor', role: 'dialog', 'aria-label': existing ? `Edit annotation ${existing.n}` : 'New annotation' }, [
      title,
      body,
      cats,
      error,
      review,
      el('div', { class: 'row' }, [
        existing
          ? el('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Delete annotation', 'data-write': '', disabled: pending || !canWrite(), onClick: () => deleteAnnotation(existing) }, [icon('trash', 15)])
          : null,
        el('span', { class: 'hint grow' }, [el('kbd', {}, ['⌘']), ' ', el('kbd', {}, ['Enter']), ' to save']),
        el('button', { class: 'btn ghost', type: 'button', onClick: () => cancelEdit() }, ['Cancel']),
        save,
      ]),
    ]);
    ui.mount(editor);
    sync();
    positionEditor();
    (existing ? body : title).focus();
    if (existing) body.setSelectionRange(body.value.length, body.value.length);
  }

  function cancelEdit(): void {
    if (pending) return;
    const id = editing?.id ?? null;
    closeEditor();
    if (id) setActive(id);
  }

  function deleteAnnotation(a: Annotation): void {
    commit(annotations.filter((x) => x.id !== a.id), () => {
      closeEditor();
      setActive(null);
      showToast(`Deleted annotation ${a.n}`, { label: 'Undo', run: () => restoreDeleted([a]) });
    }, (message) => {
      const error = editor?.querySelector<HTMLElement>('.save-error');
      if (error) { error.hidden = false; error.textContent = message; }
    });
  }

  let editorFrame = 0;
  const onViewportChange = () => {
    if (!editor || editorFrame) return;
    editorFrame = requestAnimationFrame(() => {
      editorFrame = 0;
      positionEditor();
    });
  };

  // ---- collaborative thread detail --------------------------------------------------
  function authorLine(person: CommentAuthor | undefined, at: number): HTMLElement {
    const date = new Date(at);
    const valid = Number.isFinite(date.getTime());
    return el('div', { class: 'byline' }, [
      el('strong', {}, [person?.name || 'Unattributed']),
      valid ? el('time', { datetime: date.toISOString(), title: date.toLocaleString() }, [date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })]) : null,
    ]);
  }

  function statusBadge(a: Annotation): HTMLElement {
    return el('span', { class: `thread-status${a.status === 'resolved' ? ' is-resolved' : ''}` }, [a.status === 'resolved' ? 'Resolved' : 'Open']);
  }

  function openThread(id: string, trigger?: HTMLElement): void {
    if ((pending && editing) || !annotations.some((a) => a.id === id)) return;
    const opener = trigger ?? (ui.shadow.activeElement instanceof HTMLElement ? ui.shadow.activeElement : null);
    closeThread(false);
    threadTrigger = opener ? { element: opener, label: opener.getAttribute('aria-label') } : null;
    // Opening a discussion never puts the page into element-picking mode.
    setAnnotating(false);
    closeEditor();
    setSettingsOpen(false);
    threadId = id;
    setActive(id);
    renderThread();
    thread?.querySelector<HTMLButtonElement>('[aria-label="Close thread"]')?.focus();
  }

  function closeThread(restoreFocus = true): void {
    const input = thread?.querySelector<HTMLTextAreaElement>('textarea');
    if (threadId && input) replyDrafts.set(threadId, input.value);
    threadId = null;
    thread?.remove();
    thread = null;
    pendingThreadFocusLabel = null;
    const opener = threadTrigger;
    threadTrigger = null;
    if (restoreFocus && opener) {
      const target = opener.element.isConnected ? opener.element : Array.from(ui.shadow.querySelectorAll<HTMLElement>('[aria-label]')).find((node) => node.getAttribute('aria-label') === opener.label);
      if (target && !((target instanceof HTMLButtonElement || target instanceof HTMLSelectElement) && target.disabled)) target.focus({ preventScroll: true });
      else (panel?.querySelector<HTMLElement>('.item, button') ?? dock?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    }
  }

  /** Routes can also be custom opaque labels; only offer navigation for local app paths. */
  function routeHref(route: string | undefined): string | null {
    if (!route || !route.startsWith('/') || route.startsWith('//') || route.includes('\\') || Array.from(route).some((c) => c.charCodeAt(0) < 32)) return null;
    try {
      let prefix = opts.basePath ? normalizePath(opts.basePath) : '';
      if (!opts.basePath) {
        const scope = currentRoute();
        const path = normalizePath(location.pathname);
        if (scope === '/') prefix = path === '/' ? '' : path;
        else if (scope && path.endsWith(scope)) prefix = path.slice(0, -scope.length);
      }
      if (prefix === '/') prefix = '';
      const url = new URL(prefix + route, location.href);
      if (url.origin !== location.origin || (prefix && url.pathname !== prefix && !url.pathname.startsWith(prefix + '/'))) return null;
      return url.href;
    } catch { return null; }
  }

  function replyToThread(id: string): void {
    const a = annotations.find((item) => item.id === id);
    const body = replyDrafts.get(id)?.trim();
    if (!a || !body || pending || !canWrite()) return;
    threadErrors.delete(id);
    const reply = { id: newId(), body, author: currentAuthor(), createdAt: Date.now() };
    commit(annotations.map((item) => item.id === id ? { ...item, replies: [...(item.replies ?? []), reply] } : item), () => {
      replyDrafts.delete(id);
      if (threadId === id) { const field = thread?.querySelector<HTMLTextAreaElement>('textarea'); if (field) field.value = ''; }
      showToast('Reply added');
    }, (message) => threadErrors.set(id, message));
  }

  function collaborators(): CommentAuthor[] {
    // A server directory is authoritative, including an intentionally empty directory.
    if (opts.storage.collaborators !== undefined) return opts.storage.collaborators;
    const people = new Map<string, CommentAuthor>();
    const add = (person?: CommentAuthor) => { if (person) people.set(person.id, person); };
    for (const item of annotations) {
      add(item.author); add(item.updatedBy); add(item.assignee); add(item.resolvedBy);
      for (const reply of item.replies ?? []) add(reply.author);
      for (const event of item.events ?? []) { add(event.author); add(event.assignee); }
    }
    add(currentAuthor());
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function assignThread(id: string, person?: CommentAuthor): void {
    const a = annotations.find((item) => item.id === id);
    if (!a || pending || !canWrite() || a.assignee?.id === person?.id) return;
    if (person && !collaborators().some((candidate) => candidate.id === person.id)) return;
    threadErrors.delete(id);
    commit(annotations.map((item) => {
      if (item.id !== id) return item;
      const next: Annotation = { ...item, events: [...(item.events ?? []), {
        id: newId(), type: person ? 'assigned' : 'unassigned', author: currentAuthor(), createdAt: Date.now(),
        ...(person ? { assignee: person } : {}),
      }] };
      if (person) next.assignee = person;
      else delete next.assignee;
      return next;
    }), () => showToast(person ? `Assigned to ${person.name}` : 'Thread unassigned'), (message) => threadErrors.set(id, message));
  }

  function assignmentControls(a: Annotation): HTMLElement {
    const owner = el('div', { class: 'owner-label' }, [`Assignee · ${a.assignee?.name ?? 'Unassigned'}`]);
    if (!author) return el('div', { class: 'thread-assignment' }, [owner]);
    const people = collaborators();
    const picker = el('select', {
      'aria-label': 'Assign thread to', 'data-write': '', disabled: pending || !canWrite(),
      onChange: (event: Event) => {
        const id = (event.target as HTMLSelectElement).value;
        assignThread(a.id, people.find((person) => person.id === id));
      },
    }, [el('option', { value: '' }, ['Unassigned']), ...people.map((person) => el('option', { value: person.id }, [person.name]))]);
    // Retain a removed collaborator's ownership until explicitly reassigned.
    if (a.assignee && !people.some((person) => person.id === a.assignee!.id)) picker.append(el('option', { value: a.assignee.id, disabled: true }, [a.assignee.name]));
    picker.value = a.assignee?.id ?? '';
    const me = people.find((person) => person.id === currentAuthor().id);
    return el('div', { class: 'thread-assignment' }, [owner, picker,
      el('div', { class: 'assignment-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Assign to me', 'data-write': '', 'data-empty': String(!me || a.assignee?.id === me.id), disabled: pending || !canWrite() || !me || a.assignee?.id === me.id, onClick: () => { if (me) assignThread(a.id, me); } }, ['Assign to me']),
        el('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Unassign thread', 'data-write': '', 'data-empty': String(!a.assignee), disabled: pending || !canWrite() || !a.assignee, onClick: () => assignThread(a.id) }, ['Unassign']),
      ]),
    ]);
  }

  function changeThreadStatus(id: string): void {
    const a = annotations.find((item) => item.id === id);
    if (!a || pending || !canWrite()) return;
    const resolved = a.status !== 'resolved';
    const person = currentAuthor();
    const at = Date.now();
    threadErrors.delete(id);
    commit(annotations.map((item) => {
      if (item.id !== id) return item;
      const next: Annotation = {
        ...item,
        status: resolved ? 'resolved' : 'open',
        events: [...(item.events ?? []), { id: newId(), type: resolved ? 'resolved' : 'reopened', author: person, createdAt: at }],
      };
      if (resolved) { next.resolvedAt = at; next.resolvedBy = person; }
      else { delete next.resolvedAt; delete next.resolvedBy; }
      return next;
    }), () => showToast(resolved ? 'Thread resolved' : 'Thread reopened'), (message) => threadErrors.set(id, message));
  }

  function renderThread(): void {
    if (!threadId) return;
    const a = annotations.find((item) => item.id === threadId);
    const previous = thread;
    const focused = ui.shadow.activeElement;
    const hadThreadFocus = !!focused && !!previous?.contains(focused);
    const focusLabel = hadThreadFocus ? focused === previous ? pendingThreadFocusLabel : focused.getAttribute('aria-label') : null;
    const previousInput = previous?.querySelector<HTMLTextAreaElement>('textarea');
    const hadFocus = !!previousInput && ui.shadow.activeElement === previousInput;
    const selection = previousInput ? [previousInput.selectionStart, previousInput.selectionEnd] : null;
    const scroll = previous?.querySelector('.thread-history')?.scrollTop ?? 0;
    const restoreControlFocus = () => {
      if (!hadThreadFocus || !thread) return;
      const statusLabel = focusLabel === 'Resolve thread' || focusLabel === 'Reopen thread';
      const target = statusLabel ? thread.querySelector<HTMLElement>('[aria-label="Resolve thread"], [aria-label="Reopen thread"]') : Array.from(thread.querySelectorAll<HTMLElement>('[aria-label]')).find((node) => node.getAttribute('aria-label') === focusLabel);
      const available = target && !((target instanceof HTMLButtonElement || target instanceof HTMLSelectElement) && target.disabled) ? target : thread.querySelector<HTMLElement>('textarea') ?? thread.querySelector<HTMLElement>('[aria-label="Close thread"]');
      available?.focus({ preventScroll: true });
      pendingThreadFocusLabel = null;
    };
    if (previousInput) replyDrafts.set(threadId, previousInput.value);
    previous?.remove();
    thread = null;
    if (!a) {
      // Keep any reply draft accessible if another collaborator deletes its thread.
      thread = el('section', { class: `surface thread${corner()}`, role: 'dialog', tabindex: -1, 'aria-label': 'Deleted thread' }, [
        el('div', { class: 'panel-head' }, [el('span', { class: 'title grow' }, ['Thread deleted']), el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close thread', onClick: () => closeThread() }, [icon('x')])]),
        el('div', { class: 'thread-history' }, ['This thread was deleted elsewhere. Copy your draft before closing.', el('p', { class: 'comment-body' }, [replyDrafts.get(threadId) ?? ''])]),
      ]);
      ui.mount(thread);
      restoreControlFocus();
      return;
    }
    const history = el('div', { class: 'thread-history' }, [
      a.title ? el('h3', { class: 'thread-title' }, [a.title]) : null,
      el('article', { class: 'comment root-comment' }, [authorLine(a.author, a.createdAt), el('div', { class: 'comment-body' }, [a.body]),
        a.updatedAt ? el('div', { class: 'edited-line' }, [`Edited${a.updatedBy ? ` by ${a.updatedBy.name}` : ''} · ${new Date(a.updatedAt).toLocaleString()}`]) : null,
      ]),
    ]);
    const timeline = [
      ...(a.replies ?? []).map((reply) => ({ at: reply.createdAt, node: el('article', { class: 'comment reply', dataset: { replyId: reply.id } }, [authorLine(reply.author, reply.createdAt), el('div', { class: 'comment-body' }, [reply.body])]) })),
      ...(a.events ?? []).map((event) => ({ at: event.createdAt, node: el('div', { class: 'thread-event' }, [`${event.author.name} ${event.type === 'assigned' ? `assigned this thread to ${event.assignee?.name ?? 'a collaborator'}` : event.type === 'unassigned' ? 'unassigned this thread' : `${event.type} this thread`}`, el('time', { datetime: new Date(event.createdAt).toISOString() }, [new Date(event.createdAt).toLocaleString()])]) })),
    ].sort((x, y) => x.at - y.at);
    for (const entry of timeline) history.append(entry.node);
    if (a.status === 'resolved' && !(a.events ?? []).some((event) => event.type === 'resolved')) {
      history.append(el('div', { class: 'thread-event' }, [`Resolved${a.resolvedBy ? ` by ${a.resolvedBy.name}` : ''}${a.resolvedAt ? ` · ${new Date(a.resolvedAt).toLocaleString()}` : ''}`]));
    }
    const route = a.route;
    const href = !isOnRoute(a, currentRoute()) ? routeHref(route) : null;
    const context = el('div', { class: 'thread-context' }, [
      el('span', { class: 'chip', dataset: { cat: a.category ?? 'note' } }, [labelFor(a.category)]),
      el('span', { class: 'route' }, [route || 'All pages']),
      href ? el('a', { href, class: 'page-link', 'aria-label': 'Go to page' }, ['Go to page']) : null,
      isOnRoute(a, currentRoute()) && unanchored.has(a.id) ? el('span', { class: 'unanchored-label' }, ['Element not found']) : null,
    ]);
    const input = el('textarea', { 'aria-label': 'Reply to thread', placeholder: 'Add to the discussion…', rows: 3, maxlength: 20000 });
    input.value = replyDrafts.get(a.id) ?? '';
    input.readOnly = pending;
    const send = el('button', { class: 'btn primary', type: 'button', 'data-write': '', 'aria-label': 'Reply', onClick: () => replyToThread(a.id) }, [pending ? 'Saving…' : 'Reply']);
    const sync = () => {
      replyDrafts.set(a.id, input.value);
      send.dataset.empty = String(input.value.trim() === '');
      send.disabled = pending || !canWrite() || send.dataset.empty === 'true';
    };
    input.addEventListener('input', sync);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); replyToThread(a.id); }
    });
    sync();
    const error = threadErrors.get(a.id);
    thread = el('section', { class: `surface thread${corner()}`, role: 'dialog', tabindex: -1, 'aria-label': `Thread ${a.n}`, 'aria-busy': String(pending) }, [
      el('div', { class: 'panel-head' }, [el('span', { class: 'title' }, [`Thread #${a.n}`]), statusBadge(a), el('span', { class: 'grow' }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close thread', onClick: () => closeThread() }, [icon('x')])]),
      context,
      assignmentControls(a),
      history,
      error ? el('div', { class: 'save-error', role: 'alert' }, [error]) : null,
      author ? el('div', { class: 'thread-composer' }, [
        canWrite() ? el('div', { class: 'reply-as' }, [`Replying as ${currentAuthor().name}`]) : el('div', { class: 'identity-help', role: 'status' }, [identityHelp()]),
        input,
        el('div', { class: 'thread-actions' }, [el('button', { class: 'btn ghost', type: 'button', 'data-write': '', disabled: pending || !canWrite(), 'aria-label': a.status === 'resolved' ? 'Reopen thread' : 'Resolve thread', onClick: () => changeThreadStatus(a.id) }, [a.status === 'resolved' ? 'Reopen thread' : 'Resolve thread']), el('span', { class: 'grow' }), send]),
      ]) : el('div', { class: 'viewer-note' }, ['View only · Open this project locally to join the discussion.']),
    ]);
    ui.mount(thread);
    history.scrollTop = scroll;
    if (hadFocus) { input.focus({ preventScroll: true }); if (selection) input.setSelectionRange(selection[0], selection[1]); }
    else restoreControlFocus();
    if (previous) thread.style.animation = 'none';
  }

  // ---- side panel --------------------------------------------------------------------
  function renderPanel(): void {
    const scroll = panel?.querySelector('.panel-list')?.scrollTop ?? 0;
    const wasPainted = !!panel;
    panel?.remove();
    panel = null;
    if (!panelOpen) return;

    const matches = (a: Annotation) => threadFilter === 'all' || (a.status === 'resolved' ? 'resolved' : 'open') === threadFilter;
    const here = routeAnnotations().filter(matches);
    const anchored = here.filter((a) => !unanchored.has(a.id));
    const lost = here.filter((a) => unanchored.has(a.id));
    const route = currentRoute();
    const elsewhere = annotations.filter((a) => !isOnRoute(a, route) && matches(a));

    const item = (a: Annotation) =>
      el('button', {
        class: `item${a.id === activeId ? ' is-active' : ''}`,
        type: 'button',
        dataset: { cat: a.category ?? 'note', id: a.id },
        'aria-label': `Open thread ${a.n}: ${a.title || a.body}`,
        onClick: (event: Event) => {
          openThread(a.id, event.currentTarget as HTMLElement);
          if (isOnRoute(a, route) && a.status !== 'resolved' && !unanchored.has(a.id)) {
            if (!visible) setVisible(true);
            void layer.flash(a);
          }
        },
      }, [
        el('span', { class: 'num' }, [String(a.n)]),
        el('div', { class: 'main' }, [
          el('div', { class: 'item-heading' }, [el('span', { class: 'kind' }, [labelFor(a.category)]), statusBadge(a)]),
          a.title ? el('div', { class: 't' }, [a.title]) : null,
          el('div', { class: 'b' }, [a.body]),
          el('div', { class: 'item-meta' }, [a.author?.name || 'Unattributed', ` · ${(a.replies ?? []).length} ${(a.replies ?? []).length === 1 ? 'reply' : 'replies'}`]),
          el('div', { class: 'item-owner' }, [`Assignee · ${a.assignee?.name ?? 'Unassigned'}`]),
          !isOnRoute(a, route) && a.route ? el('div', { class: 'route' }, [a.route]) : null,
        ]),
      ]);

    const list = el('div', { class: 'panel-list' });
    if (here.length === 0) {
      list.append(el('div', { class: 'empty' }, [
        el('strong', {}, [`No ${threadFilter === 'all' ? '' : threadFilter + ' '}threads on this page`]),
        threadFilter === 'resolved' ? 'Resolved discussions will appear here.' : author ? 'Use the Annotate tool, then click any element to start a thread.' : 'Nothing has been annotated here yet.',
      ]));
    }
    for (const a of anchored) list.append(item(a));
    if (lost.length) {
      list.append(el('div', { class: 'section' }, [`Unanchored · element not found (${lost.length})`]));
      for (const a of lost) list.append(item(a));
    }
    if (elsewhere.length) {
      list.append(el('div', { class: 'section' }, [`Other pages (${elsewhere.length})`]));
      for (const a of elsewhere) list.append(item(a));
    }

    panel = el('div', { class: `surface panel${corner()}`, role: 'complementary', 'aria-label': 'Annotations' }, [
      el('div', { class: 'panel-head' }, [
        el('span', { class: 'title' }, ['Threads']),
        el('span', { class: 'sub' }, [String(here.length)]),
        el('span', { class: 'grow' }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close annotation list', onClick: () => setPanel(false) }, [icon('x')]),
      ]),
      el('div', { class: 'thread-filters' }, [segmented('Thread status', threadFilter, [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']], (filter) => { threadFilter = filter; renderPanel(); })]),
      list,
      author && !canWrite() ? el('div', { class: 'identity-help' }, [identityHelp()]) : null,
    ]);
    if (wasPainted) panel.style.animation = 'none';
    ui.mount(panel);
    panel.querySelector('.panel-list')!.scrollTop = scroll;
  }

  // ---- annotate mode (author) ---------------------------------------------------------
  function setAnnotating(next: boolean): void {
    if ((next && (!canWrite() || pending)) || next === annotating) return;
    annotating = next;
    if (next) {
      closeThread();
      if (!visible) setVisible(true);
      setSettingsOpen(false);
      setActive(null);
      closeEditor();
    } else {
      highlight.hidden = true;
      if (editing && !editing.id) closeEditor();
    }
    document.documentElement.style.cursor = next ? 'crosshair' : '';
    renderDock();
  }

  function inWidget(e: Event): boolean {
    return e.composedPath().includes(ui.host);
  }

  function pickable(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    if (target === document.documentElement || target === document.body) return null;
    return target;
  }

  function onMove(e: MouseEvent): void {
    if (!annotating || editing || inWidget(e)) {
      highlight.hidden = true;
      return;
    }
    const target = pickable(e.target);
    if (!target) {
      highlight.hidden = true;
      return;
    }
    const r = target.getBoundingClientRect();
    highlight.hidden = false;
    highlightTag.textContent = describe(target);
    Object.assign(highlight.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }

  /** While annotating, swallow pointer interaction so the prototype doesn't react. */
  function onPointerCapture(e: Event): void {
    if (!annotating || inWidget(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function editorHasText(): boolean {
    return !!editor && Array.from(editor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).some((f) => f.value.trim());
  }

  function onClickCapture(e: MouseEvent): void {
    if (inWidget(e)) return;
    if (settingsOpen) setSettingsOpen(false);
    if (editing) {
      if (pending) { e.preventDefault(); e.stopPropagation(); return; }
      // Don't lose a half-written annotation to a stray click.
      e.preventDefault();
      e.stopPropagation();
      if (editorHasText() && !editing.id) {
        editor?.querySelector<HTMLElement>('textarea')?.focus();
        return;
      }
      closeEditor();
      if (!annotating) return;
    } else if (activeId && !annotating) {
      setActive(null);
      return;
    }
    if (!annotating) return;
    e.preventDefault();
    e.stopPropagation();
    const target = pickable(e.target);
    if (!target) return;
    highlight.hidden = true;
    const anchor = serialize(target, { clientX: e.clientX, clientY: e.clientY });
    editing = { anchor, at: { x: e.clientX, y: e.clientY } };
    layer.setDraft(anchor);
    renderEditor();
  }

  function handleEscape(): boolean {
    if (settingsOpen) setSettingsOpen(false);
    else if (editing) cancelEdit();
    else if (threadId) closeThread();
    else if (activeId) setActive(null);
    else if (annotating) setAnnotating(false);
    else if (panelOpen) setPanel(false);
    else return false;
    return true;
  }

  /** ⌥A / Alt+A and ⌥H / Alt+H. Modifier-only, so they never clash with a prototype's own keys. */
  function handleShortcut(e: KeyboardEvent): void {
    if (!opts.shortcuts || isTyping(e)) return;
    if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    // Use the physical key: on a Mac, ⌥A types "å", so e.key isn't reliable.
    if (e.code === 'KeyA' && author) {
      e.preventDefault();
      if (!open) setOpen(true);
      setAnnotating(!annotating);
    } else if (e.code === 'KeyH') {
      e.preventDefault();
      setVisible(!visible);
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (handleEscape()) e.preventDefault();
      return;
    }
    handleShortcut(e);
  }

  const pointerEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchstart'] as const;
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClickCapture, true);
  for (const type of pointerEvents) document.addEventListener(type, onPointerCapture, true);
  window.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);

  // Keep keystrokes typed into the widget away from the prototype's own shortcuts.
  const onWidgetKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.type !== 'keydown' || e.defaultPrevented) return;
    if (e.key === 'Escape') handleEscape();
    else handleShortcut(e);
  };
  const widgetKeyEvents = ['keydown', 'keyup', 'keypress'] as const;
  for (const type of widgetKeyEvents) ui.host.addEventListener(type, onWidgetKey as EventListener);

  const stopRoute = onLocationChange(() => {
    closeEditor();
    setActive(null);
    renderAll();
  });

  // ---- render --------------------------------------------------------------------------
  function renderAll(): void {
    layer.render(routeAnnotations().filter((a) => a.status !== 'resolved'));
    renderThread();
    renderDock();
    if (panelOpen) renderPanel();
    if (settingsOpen) renderSettings();
    if (activeId && !annotations.some((a) => a.id === activeId)) setActive(null);
  }

  const stopStorage = opts.storage.subscribe?.((next) => {
    if (destroyed) return;
    annotations = next.slice();
    renderAll();
  });

  ui.layer.classList.toggle('is-hidden', !visible);
  applySettings();
  renderAll();

  return {
    setAnnotations(next) {
      annotations = next.slice();
      renderAll();
    },
    getAnnotations: () => annotations.slice(),
    show: () => setVisible(true),
    hide: () => setVisible(false),
    toggle: () => setVisible(!visible),
    isVisible: () => visible,
    destroy() {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClickCapture, true);
      for (const type of pointerEvents) document.removeEventListener(type, onPointerCapture, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      cancelAnimationFrame(editorFrame);
      document.documentElement.style.cursor = '';
      clearTimeout(toastTimer);
      destroyed = true;
      stopStorage?.();
      stopRoute();
      layer.destroy();
      ui.destroy();
    },
  };
}
