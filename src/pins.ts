import type { Comment } from './types';
import { resolve } from './anchor';
import { el } from './ui';

export type PinLayer = {
  /** (Re)draw pins for the given comments. Returns comments whose anchor didn't resolve. */
  render(comments: Comment[]): { unanchored: Comment[] };
  /** Scroll to a comment's element and flash it. */
  flash(comment: Comment): void;
  destroy(): void;
};

type Offset = { x: number; y: number };

function place(node: HTMLElement, rect: DOMRect, offset: Offset): void {
  node.style.left = `${rect.left + offset.x * rect.width}px`;
  node.style.top = `${rect.top + offset.y * rect.height}px`;
}

export function createPinLayer(
  layer: HTMLElement,
  onPinClick: (c: Comment) => void,
): PinLayer {
  let current: Comment[] = [];
  const pins = new Map<string, HTMLElement>();

  function reposition(): void {
    for (const c of current) {
      const node = pins.get(c.id);
      if (!node) continue;
      const target = resolve(c.anchor);
      if (!target) {
        node.style.display = 'none';
        continue;
      }
      node.style.display = '';
      place(node, target.getBoundingClientRect(), c.anchor.offset);
    }
  }

  let scheduled = false;
  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      reposition();
    });
  }

  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  const ro = new ResizeObserver(schedule);
  ro.observe(document.documentElement);

  return {
    render(comments) {
      current = comments;
      for (const node of pins.values()) node.remove();
      pins.clear();

      const unanchored: Comment[] = [];
      for (const c of comments) {
        const node = el(
          'button',
          {
            class: 'pin',
            dataset: { cat: c.category ?? '' },
            title: c.body,
            onClick: (e: Event) => {
              e.stopPropagation();
              onPinClick(c);
            },
          },
          [String(c.n)],
        );
        layer.append(node);
        pins.set(c.id, node);

        const target = resolve(c.anchor);
        if (!target) {
          node.style.display = 'none';
          unanchored.push(c);
        } else {
          place(node, target.getBoundingClientRect(), c.anchor.offset);
        }
      }
      return { unanchored };
    },

    flash(comment) {
      const target = resolve(comment.anchor);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Let the smooth scroll settle before drawing the highlight box.
      window.setTimeout(() => {
        const box = el('div', { class: 'flash' });
        const r = target.getBoundingClientRect();
        Object.assign(box.style, {
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
        layer.append(box);
        window.setTimeout(() => box.remove(), 1300);
      }, 320);
    },

    destroy() {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      for (const node of pins.values()) node.remove();
      pins.clear();
    },
  };
}
