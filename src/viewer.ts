import type { Comment } from './types';
import { createUi, el } from './ui';
import { createPinLayer } from './pins';

function formatMeta(c: Comment): string {
  const who = c.author?.trim() || 'Anonymous';
  const cat = c.category ? ` · ${c.category}` : '';
  return `${who}${cat}`;
}

function commentItem(c: Comment, onClick: () => void): HTMLElement {
  return el('div', { class: 'item', onClick }, [
    el('div', { class: 'badge', dataset: { cat: c.category ?? '' } }, [String(c.n)]),
    el('div', {}, [
      el('div', { class: 'body' }, [c.body || '(no note)']),
      el('div', { class: 'meta' }, [formatMeta(c)]),
    ]),
  ]);
}

/** Read-only presentation of baked-in comments: pins on the page + a side panel list. */
export function bootViewer(comments: Comment[]): void {
  const ui = createUi();
  const pinLayer = createPinLayer(ui.layer, (c) => pinLayer.flash(c));
  const { unanchored } = pinLayer.render(comments);

  const list = el('div', { class: 'panel-list' });
  if (comments.length === 0) {
    list.append(el('div', { class: 'empty' }, ['No comments on this page.']));
  }

  const anchored = comments.filter((c) => !unanchored.includes(c));
  for (const c of anchored) {
    list.append(commentItem(c, () => pinLayer.flash(c)));
  }

  if (unanchored.length > 0) {
    list.append(
      el('div', { class: 'panel-section-title' }, [
        `Unanchored (${unanchored.length}) — element not found`,
      ]),
    );
    for (const c of unanchored) {
      list.append(commentItem(c, () => pinLayer.flash(c)));
    }
  }

  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'panel-header' }, [
      el('div', {}, [
        'Comments ',
        el('span', { class: 'sub' }, [`${comments.length}`]),
      ]),
      el('button', { class: 'panel-toggle-inline', onClick: () => toggle() }, ['Hide']),
    ]),
    list,
  ]);

  const openBtn = el('button', { class: 'panel-toggle', onClick: () => toggle() }, [
    `Comments (${comments.length})`,
  ]);
  openBtn.style.display = 'none';

  let open = true;
  function toggle(): void {
    open = !open;
    panel.style.display = open ? '' : 'none';
    openBtn.style.display = open ? 'none' : '';
  }

  ui.mount(panel);
  ui.mount(openBtn);
}
