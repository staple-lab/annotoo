import { CATEGORIES, type Anchor, type Annotation, type AnnotationCategory, type Mode } from './types';
import type { AnnotationStorage } from './storage';
import { serialize } from './anchor';
import { createAnnotationLayer, type DisplayMode, type Point } from './layer';
import { isOnRoute, onLocationChange } from './router';
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

  function commit(next: Annotation[]): void {
    annotations = next;
    void opts.storage.save(annotations);
    opts.onChange?.(annotations.slice());
    renderAll();
  }

  function saveSettings(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch };
    writePref(KEY_SETTINGS, JSON.stringify(settings));
    applySettings();
    renderDock();
    renderSettings();
    if (panelOpen) renderPanel();
  }

  function applySettings(): void {
    ui.setTheme(settings.theme);
    layer.configure({ display: settings.display, outlines: settings.outlines });
  }

  // ---- surfaces ------------------------------------------------------------------
  const layer = createAnnotationLayer(ui.layer, ui.host, {
    // Notes are locked outside Annotate: clicking one just selects it, as for viewers.
    onSelect: (a) => (author && annotating ? openEditor(a) : setActive(activeId === a.id ? null : a.id)),
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
  let editor: HTMLElement | null = null;
  let settingsPop: HTMLElement | null = null;
  let toast: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let dockPainted = false;

  function tool(
    iconName: IconName,
    label: string,
    onClick: () => void,
    extra: { on?: boolean; muted?: boolean; badge?: number; kbd?: string } = {},
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
    const count = routeAnnotations().length;
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
            if (author) setAnnotating(true);
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
          ? tool('annotate', annotating ? 'Stop annotating' : 'Annotate an element', () => setAnnotating(!annotating), { on: annotating, kbd: KEYS.annotate })
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

    const status = author ? opts.storage.describe?.() ?? '' : `View only · ${routeAnnotations().length} on this page`;
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
            el('button', { class: 'danger-link', type: 'button', onClick: clearAll }, [`Delete all ${annotations.length} annotations…`]),
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

  function clearAll(): void {
    const before = annotations;
    commit([]);
    showToast(`Deleted ${before.length} annotations`, { label: 'Undo', run: () => commit(before) });
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
    closeEditor();
    editing = { id: a.id, anchor: a.anchor, at: { x: 0, y: 0 } };
    setActive(a.id);
    renderEditor(a);
    layer.setEditing(a.id);
  }

  function closeEditor(): void {
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

    const save = el('button', { class: 'btn primary', type: 'button' }, [existing ? 'Save' : 'Add']) as HTMLButtonElement;

    const sync = () => {
      save.disabled = body.value.trim() === '';
      body.style.height = 'auto';
      body.style.height = `${Math.min(260, Math.max(84, body.scrollHeight + 2))}px`;
    };
    const submit = () => {
      if (save.disabled) return;
      writePref(KEY_LAST_CATEGORY, category);
      const t = title.value.trim() || undefined;
      const b = body.value.trim();
      if (existing) {
        commit(annotations.map((a) => (a.id === existing.id ? { ...a, title: t, body: b, category, updatedAt: Date.now() } : a)));
        closeEditor();
        setActive(existing.id);
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
        };
        closeEditor();
        commit([...annotations, created]);
        // Leave the new note open, even in hover / numbers-only display.
        setActive(created.id);
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

    editor = el('div', { class: 'surface editor', role: 'dialog', 'aria-label': existing ? `Edit annotation ${existing.n}` : 'New annotation' }, [
      title,
      body,
      cats,
      el('div', { class: 'row' }, [
        existing
          ? el('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Delete annotation', onClick: () => deleteAnnotation(existing) }, [icon('trash', 15)])
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
    const id = editing?.id ?? null;
    closeEditor();
    if (id) setActive(id);
  }

  function deleteAnnotation(a: Annotation): void {
    const before = annotations;
    closeEditor();
    setActive(null);
    commit(annotations.filter((x) => x.id !== a.id));
    showToast(`Deleted annotation ${a.n}`, { label: 'Undo', run: () => commit(before) });
  }

  let editorFrame = 0;
  const onViewportChange = () => {
    if (!editor || editorFrame) return;
    editorFrame = requestAnimationFrame(() => {
      editorFrame = 0;
      positionEditor();
    });
  };

  // ---- side panel --------------------------------------------------------------------
  function renderPanel(): void {
    const scroll = panel?.querySelector('.panel-list')?.scrollTop ?? 0;
    const wasPainted = !!panel;
    panel?.remove();
    panel = null;
    if (!panelOpen) return;

    const here = routeAnnotations();
    const anchored = here.filter((a) => !unanchored.has(a.id));
    const lost = here.filter((a) => unanchored.has(a.id));
    const route = currentRoute();
    const elsewhere = annotations.filter((a) => !isOnRoute(a, route));

    const item = (a: Annotation, interactive: boolean) =>
      el('button', {
        class: `item${a.id === activeId ? ' is-active' : ''}${interactive ? '' : ' is-static'}`,
        type: 'button',
        dataset: { cat: a.category ?? 'note' },
        disabled: !interactive,
        onClick: interactive
          ? () => {
              if (!visible) setVisible(true);
              setActive(a.id);
              void layer.flash(a);
            }
          : null,
      }, [
        el('span', { class: 'num' }, [String(a.n)]),
        el('div', { class: 'main' }, [
          el('div', { class: 'kind' }, [labelFor(a.category)]),
          a.title ? el('div', { class: 't' }, [a.title]) : null,
          el('div', { class: 'b' }, [a.body]),
          !interactive && a.route ? el('div', { class: 'route' }, [a.route]) : null,
        ]),
      ]);

    const list = el('div', { class: 'panel-list' });
    if (here.length === 0) {
      list.append(
        el('div', { class: 'empty' }, [
          el('strong', {}, ['No annotations on this page']),
          author ? 'Use the Annotate tool in the toolbar, then click any element.' : 'Nothing has been annotated here yet.',
        ]),
      );
    }
    for (const a of anchored) list.append(item(a, true));
    if (lost.length) {
      list.append(el('div', { class: 'section' }, [`Unanchored · element not found (${lost.length})`]));
      for (const a of lost) list.append(item(a, false));
    }
    if (elsewhere.length) {
      list.append(el('div', { class: 'section' }, [`Other pages (${elsewhere.length})`]));
      for (const a of elsewhere) list.append(item(a, false));
    }

    panel = el('div', { class: `surface panel${corner()}`, role: 'complementary', 'aria-label': 'Annotations' }, [
      el('div', { class: 'panel-head' }, [
        el('span', { class: 'title' }, ['Annotations']),
        el('span', { class: 'sub' }, [String(here.length)]),
        el('span', { class: 'grow' }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close annotation list', onClick: () => setPanel(false) }, [icon('x')]),
      ]),
      list,
    ]);
    if (wasPainted) panel.style.animation = 'none';
    ui.mount(panel);
    panel.querySelector('.panel-list')!.scrollTop = scroll;
  }

  // ---- annotate mode (author) ---------------------------------------------------------
  function setAnnotating(next: boolean): void {
    if (!author || next === annotating) return;
    annotating = next;
    if (next) {
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
    layer.render(routeAnnotations());
    renderDock();
    if (panelOpen) renderPanel();
    if (settingsOpen) renderSettings();
    if (activeId && !annotations.some((a) => a.id === activeId)) setActive(null);
  }

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
      stopRoute();
      layer.destroy();
      ui.destroy();
    },
  };
}
