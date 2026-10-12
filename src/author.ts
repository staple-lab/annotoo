import type { Comment, CommentCategory } from './types';
import { createUi, el } from './ui';
import { createPinLayer } from './pins';
import { createAuthorStore } from './store';
import { serialize } from './anchor';
import { bundleForHub } from './export';

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'No category' },
  { value: 'bug', label: '🐞 Bug' },
  { value: 'idea', label: '💡 Idea' },
  { value: 'nit', label: '✏️ Nit' },
  { value: 'question', label: '❓ Question' },
];

function clampToViewport(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
  };
}

/** Authoring mode: pin comments to elements and export them for the hub. */
export function bootAuthor(): void {
  const store = createAuthorStore();
  const ui = createUi();
  const pinLayer = createPinLayer(ui.layer, (c) => openEditor(c));

  const highlight = el('div', { class: 'highlight' });
  highlight.style.display = 'none';
  ui.layer.append(highlight);

  let commentMode = false;
  let editing = false;
  let popover: HTMLElement | null = null;

  const countEl = el('span', { class: 'count' }, []);

  function refresh(): void {
    pinLayer.render(store.list());
    const n = store.list().length;
    countEl.textContent = `${n} note${n === 1 ? '' : 's'}`;
  }

  // ---- comment mode ----------------------------------------------------------
  const modeBtn = el('button', {
    onClick: () => setMode(!commentMode),
  }, ['💬 Comment']);

  function setMode(on: boolean): void {
    commentMode = on;
    modeBtn.classList.toggle('active', on);
    document.body.style.cursor = on ? 'crosshair' : '';
    if (!on) highlight.style.display = 'none';
  }

  function inWidget(e: Event): boolean {
    return e.composedPath().includes(ui.host);
  }

  function onMove(e: MouseEvent): void {
    if (!commentMode || editing || inWidget(e)) {
      highlight.style.display = 'none';
      return;
    }
    const target = e.target as Element | null;
    if (!target || target === document.documentElement || target === document.body) {
      highlight.style.display = 'none';
      return;
    }
    const r = target.getBoundingClientRect();
    highlight.style.display = '';
    Object.assign(highlight.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }

  function onClickCapture(e: MouseEvent): void {
    if (inWidget(e)) return; // clicks on our own UI are handled by their own listeners
    if (editing) {
      e.preventDefault();
      e.stopPropagation();
      commitEditor();
      return;
    }
    if (!commentMode) return;
    const target = e.target as Element | null;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    highlight.style.display = 'none';
    const anchor = serialize(target, { clientX: e.clientX, clientY: e.clientY });
    const comment = store.add({ anchor, body: '' });
    refresh();
    openEditor(comment, { x: e.clientX, y: e.clientY });
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClickCapture, true);

  // ---- editor popover --------------------------------------------------------
  function openEditor(comment: Comment, at?: { x: number; y: number }): void {
    closePopover();
    editing = true;

    const textarea = el('textarea', { placeholder: 'Your comment…' }) as HTMLTextAreaElement;
    textarea.value = comment.body;

    const select = el('select', {}, CATEGORIES.map((c) =>
      el('option', { value: c.value, ...(c.value === (comment.category ?? '') ? { selected: 'selected' } : {}) }, [c.label]),
    )) as HTMLSelectElement;

    const save = el('button', { class: 'save', onClick: () => commitEditor() }, ['Save']);
    const del = el('button', {
      class: 'delete',
      onClick: () => {
        store.remove(comment.id);
        closePopover();
        refresh();
      },
    }, ['Delete']);

    popover = el('div', { class: 'popover' }, [
      textarea,
      el('div', { class: 'row' }, [select]),
      el('div', { class: 'actions' }, [del, save]),
    ]);

    // stash the current editor's live inputs on the element for commitEditor()
    (popover as HTMLElement & { _ctx?: unknown })._ctx = { comment, textarea, select };

    const point = at ?? pointForComment(comment);
    const pos = clampToViewport(point.x + 12, point.y + 12, 280, 160);
    popover.style.left = `${pos.x}px`;
    popover.style.top = `${pos.y}px`;
    ui.mount(popover);
    textarea.focus();
  }

  function commitEditor(): void {
    if (!popover) return;
    const ctx = (popover as HTMLElement & {
      _ctx?: { comment: Comment; textarea: HTMLTextAreaElement; select: HTMLSelectElement };
    })._ctx;
    if (ctx) {
      const body = ctx.textarea.value.trim();
      const category = (ctx.select.value || undefined) as CommentCategory | undefined;
      if (body === '') {
        // never persist an empty note
        store.remove(ctx.comment.id);
      } else {
        store.update(ctx.comment.id, { body, category });
      }
    }
    closePopover();
    refresh();
  }

  function closePopover(): void {
    editing = false;
    popover?.remove();
    popover = null;
  }

  function pointForComment(comment: Comment): { x: number; y: number } {
    const target = document.querySelector(comment.anchor.selector);
    if (target) {
      const r = target.getBoundingClientRect();
      return { x: r.left + comment.anchor.offset.x * r.width, y: r.top + comment.anchor.offset.y * r.height };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // ---- toolbar ---------------------------------------------------------------
  const authorInput = el('input', {
    placeholder: 'Your name',
    value: store.getAuthor(),
    onInput: (e: Event) => store.setAuthor((e.target as HTMLInputElement).value),
  });

  const bundleBtn = el('button', {
    class: 'primary',
    onClick: () => {
      setMode(false);
      closePopover();
      bundleForHub(store.list());
    },
  }, ['⬆ Bundle for Hub']);

  const toolbar = el('div', { class: 'toolbar' }, [
    el('span', { class: 'brand' }, ['Notate']),
    modeBtn,
    authorInput,
    countEl,
    bundleBtn,
  ]);

  ui.mount(toolbar);
  refresh();
}
