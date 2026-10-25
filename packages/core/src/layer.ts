import { CATEGORIES, type Anchor, type Annotation } from './types';
import { resolve } from './anchor';
import { el } from './ui';
import { icon, type IconName } from './icons';

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

/**
 * - `always`: every note is shown beside its element (Figma Dev Mode style).
 * - `hover`: numbered markers; a note opens on hover or click.
 * - `markers`: numbered markers only; a note opens on click.
 */
export type DisplayMode = 'always' | 'hover' | 'markers';

export type LayerCallbacks = {
  onSelect(a: Annotation): void;
  /** Opens the discussion independently of element editing. */
  onThread?(a: Annotation, trigger?: HTMLElement): void;
  /** Fired whenever the set of annotations whose element can't be found changes. */
  onUnanchoredChange(ids: Set<string>): void;
};

export type AnnotationLayer = {
  render(list: Annotation[]): void;
  configure(opts: { display?: DisplayMode; outlines?: boolean }): void;
  setActive(id: string | null): void;
  /** Hide an annotation's note while it's being edited in place. */
  setEditing(id: string | null): void;
  /** Show a provisional marker + outline while a new annotation is being written. */
  setDraft(anchor: Anchor | null): void;
  /** Where the editor should sit for an annotation (its note, else beside its element). */
  editorBoxFor(target: Annotation | Anchor, size: { w: number; h: number }): Box | null;
  unanchored(): Set<string>;
  /** Scroll to an annotation's element and flash it. Resolves once the scroll has settled. */
  flash(a: Annotation): Promise<void>;
  destroy(): void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const CATEGORY_ICON: Record<string, IconName> = {
  note: 'catNote',
  interaction: 'catInteraction',
  content: 'catContent',
  accessibility: 'catAccessibility',
  development: 'catDevelopment',
};
const GAP = 28;
const EDGE = 8;
/** Below this viewport width, 'always' shows numbers only. */
export const NARROW = 720;

type Parts = {
  outline: HTMLElement;
  marker: HTMLButtonElement;
  note: HTMLElement;
  wire: SVGLineElement;
};

function isRendered(rect: DOMRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

function onScreen(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Put a note of size w×h beside `rect`: right if it fits, else left, else clamped. */
export function besideBox(rect: DOMRect, w: number, h: number): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = rect.right + GAP;
  if (x + w > vw - EDGE) {
    const left = rect.left - GAP - w;
    x = left >= EDGE ? left : Math.max(EDGE, vw - w - EDGE);
  }
  let y = rect.top - 2;
  if (onScreen(rect)) y = Math.max(EDGE, Math.min(y, vh - h - EDGE));
  return { x, y, w, h };
}

export function createAnnotationLayer(
  layer: HTMLElement,
  host: Element,
  cb: LayerCallbacks,
): AnnotationLayer {
  let current: Annotation[] = [];
  let display: DisplayMode = 'always';
  let outlines = true;
  let activeId: string | null = null;
  let hoverId: string | null = null;
  let editingId: string | null = null;
  let unanchored = new Set<string>();
  const parts = new Map<string, Parts>();
  // Resolved elements are cached so scroll/resize only re-measure; resolve() only re-runs
  // when the DOM changes and a target went missing.
  const targets = new Map<string, Element | null>();
  const noteBoxes = new Map<string, Box>();
  let draft: { anchor: Anchor; target: Element | null; outline: HTMLElement; marker: HTMLElement } | null = null;

  const wires = document.createElementNS(SVG_NS, 'svg');
  wires.setAttribute('class', 'wires');
  wires.setAttribute('aria-hidden', 'true');
  layer.prepend(wires);

  function targetFor(a: Annotation, refresh: boolean): Element | null {
    const cached = targets.get(a.id);
    if (!refresh && cached !== undefined) return cached;
    // Frameworks reuse DOM nodes, so a cached element can still be on the page but now be
    // something else. Keep it only while it still matches the anchor's selector.
    if (cached && cached.isConnected && stillMatches(cached, a.anchor.selector)) return cached;
    const found = resolve(a.anchor);
    targets.set(a.id, found);
    return found;
  }

  function noteVisible(id: string): boolean {
    if (id === editingId) return false;
    // Notes need room beside their element; on narrow screens "always" acts like numbers only.
    const always = display === 'always' && window.innerWidth >= NARROW;
    return always || id === activeId || (display !== 'markers' && id === hoverId);
  }

  function layout(refresh: boolean): void {
    const missing = new Set<string>();
    // --- read pass: element rects + note sizes --------------------------------------
    const measured: { a: Annotation; p: Parts; rect: DOMRect | null; size: { w: number; h: number } }[] = [];
    for (const a of current) {
      const p = parts.get(a.id);
      if (!p) continue;
      const target = targetFor(a, refresh);
      if (!target) missing.add(a.id);
      const rect = target?.getBoundingClientRect() ?? null;
      measured.push({ a, p, rect: rect && isRendered(rect) ? rect : null, size: { w: p.note.offsetWidth, h: p.note.offsetHeight } });
    }

    // --- place notes, top to bottom, nudging down past earlier ones -----------------
    const placed: Box[] = [];
    noteBoxes.clear();
    const order = measured.filter((m) => m.rect).sort((m1, m2) => m1.rect!.top - m2.rect!.top || m1.a.n - m2.a.n);
    for (const m of order) {
      if (!noteVisible(m.a.id)) continue;
      const box = besideBox(m.rect!, m.size.w, m.size.h);
      for (let guard = 0; guard < 50; guard++) {
        const hit = placed.find((b) => overlaps(box, b));
        if (!hit) break;
        box.y = hit.y + hit.h + 8;
      }
      placed.push(box);
      noteBoxes.set(m.a.id, box);
    }

    // --- write pass -----------------------------------------------------------------
    // Markers sit on the outline's top-left corner, like a spec badge; several
    // annotations on one element line up side by side.
    const perElement = new Map<Element, number>();
    for (const { a, p, rect } of measured) {
      const strong = a.id === activeId || a.id === hoverId || a.id === editingId;
      if (!rect) {
        p.outline.hidden = p.marker.hidden = true;
        p.note.classList.add('is-off');
        p.wire.style.display = 'none';
        continue;
      }
      const target = targets.get(a.id)!;
      const slot = perElement.get(target) ?? 0;
      perElement.set(target, slot + 1);
      p.marker.hidden = false;
      p.marker.style.left = `${rect.left - 3 + slot * 24}px`;
      p.marker.style.top = `${rect.top - 3}px`;
      p.marker.classList.toggle('is-active', strong);

      p.outline.hidden = !(outlines || strong);
      p.outline.classList.toggle('is-strong', strong);
      Object.assign(p.outline.style, {
        left: `${rect.left - 3}px`,
        top: `${rect.top - 3}px`,
        width: `${rect.width + 6}px`,
        height: `${rect.height + 6}px`,
      });

      const box = noteBoxes.get(a.id);
      p.note.classList.toggle('is-off', !box);
      p.note.classList.toggle('is-active', a.id === activeId);
      if (!box) {
        p.wire.style.display = 'none';
        continue;
      }
      p.note.style.left = `${box.x}px`;
      p.note.style.top = `${box.y}px`;
      // Connector: from the element's edge to the near side of the note.
      const right = box.x >= rect.right;
      const left = box.x + box.w <= rect.left;
      if (!right && !left) {
        p.wire.style.display = 'none';
        continue;
      }
      const y1 = Math.max(rect.top, Math.min(box.y + 18, rect.bottom));
      p.wire.style.display = '';
      p.wire.setAttribute('x1', String(right ? rect.right + 3 : rect.left - 3));
      p.wire.setAttribute('y1', String(y1));
      p.wire.setAttribute('x2', String(right ? box.x : box.x + box.w));
      p.wire.setAttribute('y2', String(Math.max(box.y + 12, Math.min(y1, box.y + box.h - 12))));
      p.wire.classList.toggle('is-strong', strong);
    }

    if (draft) {
      if (!draft.target?.isConnected) draft.target = resolve(draft.anchor);
      const rect = draft.target?.getBoundingClientRect();
      if (rect) {
        draft.marker.style.left = `${rect.left - 3}px`;
        draft.marker.style.top = `${rect.top - 3}px`;
        Object.assign(draft.outline.style, {
          left: `${rect.left - 3}px`,
          top: `${rect.top - 3}px`,
          width: `${rect.width + 6}px`,
          height: `${rect.height + 6}px`,
        });
      }
    }

    if (!sameSet(missing, unanchored)) {
      unanchored = missing;
      cb.onUnanchoredChange(new Set(unanchored));
    }
  }

  let scheduled = false;
  let needsRefresh = false;
  function schedule(refresh = false): void {
    needsRefresh ||= refresh;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const r = needsRefresh;
      needsRefresh = false;
      layout(r);
    });
  }

  const onScrollOrResize = () => schedule(false);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScrollOrResize) : null;
  ro?.observe(document.documentElement);
  // SPA frameworks render after we mount and swap DOM on navigation: re-resolve on change.
  const mo =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver((records) => {
          if (records.every((r) => r.target === host || host.contains(r.target))) return;
          schedule(true);
        })
      : null;
  mo?.observe(document.body, { childList: true, subtree: true, characterData: true });

  function setHover(id: string | null): void {
    if (hoverId === id) return;
    hoverId = id;
    layout(false);
  }

  function makeParts(a: Annotation, label: string): Parts {
    const cat = a.category ?? 'note';
    const select = (e: Event) => {
      e.stopPropagation();
      cb.onSelect(a);
    };
    const outline = el('div', { class: 'outline', dataset: { cat } });
    const marker = el(
      'button',
      {
        class: 'marker',
        type: 'button',
        dataset: { cat, id: a.id },
        'aria-label': `Annotation ${a.n}: ${a.title || a.body}`,
        onClick: select,
        onMouseenter: () => setHover(a.id),
        onMouseleave: () => setHover(null),
      },
      [String(a.n)],
    );
    const note = el(
      'div',
      {
        class: 'note',
        role: 'note',
        dataset: { cat, id: a.id },
        onClick: select,
        onMouseenter: () => setHover(a.id),
        onMouseleave: () => setHover(null),
      },
      // Issue-card layout: #n, then the title with its category glyph, the body, and a row of
      // meta (category, page, creator). Notes without a title lead with their body instead.
      [
        el('div', { class: 'note-n' }, [`#${a.n}`]),
        el('div', { class: 'note-title' }, [
          el('span', { class: 'note-glyph' }, [icon(CATEGORY_ICON[cat], 15)]),
          el('span', {}, [a.title || a.body]),
        ]),
        a.title ? el('div', { class: 'note-body' }, [a.body]) : null,
        el('div', { class: 'note-date' }, [new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })]),
        el('div', { class: 'note-meta' }, [
          el('span', {}, [icon('tag', 13), label]),
          // The page, unless it's the root (a bare "/" says nothing).
          a.route && a.route !== '/' ? el('span', {}, [icon('file', 13), a.route]) : null,
          el('span', { class: 'note-owner', title: 'Created by' }, [icon('user', 13), a.author?.name || 'Unattributed']),
        ]),
        cb.onThread ? el('button', {
          class: 'open-thread', type: 'button', 'aria-label': `Open thread ${a.n}`,
          onClick: (e: Event) => { e.stopPropagation(); cb.onThread?.(a, e.currentTarget as HTMLElement); },
        }, [icon('chat', 14), `Open thread${a.replies?.length ? ` · ${a.replies.length} ${a.replies.length === 1 ? 'reply' : 'replies'}` : ''}`]) : null,
      ],
    );
    const wire = document.createElementNS(SVG_NS, 'line');
    wire.setAttribute('data-cat', cat);
    return { outline, marker, note, wire };
  }

  return {
    render(list) {
      const prev = new Map(parts);
      current = list;
      parts.clear();
      for (const a of list) {
        const old = prev.get(a.id);
        const p = makeParts(a, CATEGORIES.find((c) => c.value === (a.category ?? 'note'))?.label ?? 'Note');
        // Don't replay entrance animations for annotations already on screen.
        if (old) for (const node of [p.marker, p.note]) node.style.animation = 'none';
        if (old) for (const node of [old.outline, old.marker, old.note, old.wire]) node.remove();
        prev.delete(a.id);
        layer.append(p.outline, p.marker, p.note);
        wires.append(p.wire);
        parts.set(a.id, p);
      }
      for (const p of prev.values()) for (const node of [p.outline, p.marker, p.note, p.wire]) node.remove();
      for (const id of [...targets.keys()]) if (!parts.has(id)) targets.delete(id);
      if (hoverId && !parts.has(hoverId)) hoverId = null;
      layout(true);
    },

    configure(opts) {
      if (opts.display) display = opts.display;
      if (opts.outlines !== undefined) outlines = opts.outlines;
      layout(false);
    },

    setActive(id) {
      activeId = id;
      layout(false);
    },

    setEditing(id) {
      editingId = id;
      layout(false);
    },

    setDraft(anchor) {
      draft?.outline.remove();
      draft?.marker.remove();
      draft = null;
      if (!anchor) return;
      const outline = el('div', { class: 'outline is-strong is-draft' });
      const marker = el('div', { class: 'marker is-draft is-active', 'aria-hidden': 'true' }, ['+']);
      layer.append(outline, marker);
      draft = { anchor, target: null, outline, marker };
      layout(false);
    },

    editorBoxFor(target, size) {
      if ('id' in target && noteBoxes.has(target.id) && target.id !== editingId) {
        const b = noteBoxes.get(target.id)!;
        return { ...b, w: size.w, h: size.h };
      }
      const anchor = 'anchor' in target ? target.anchor : target;
      const element = 'id' in target ? targetFor(target, true) : draft?.target ?? resolve(anchor);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (!isRendered(rect)) return null;
      const box = besideBox(rect, size.w, size.h);
      box.y = Math.max(EDGE, Math.min(box.y, window.innerHeight - size.h - EDGE));
      return box;
    },

    unanchored: () => new Set(unanchored),

    async flash(a) {
      const target = targetFor(a, true);
      if (!target) return;
      const r0 = target.getBoundingClientRect();
      if (!onScreen(r0) || r0.top < 0 || r0.bottom > window.innerHeight) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await new Promise((r) => setTimeout(r, 380));
      }
      const r = target.getBoundingClientRect();
      const box = el('div', { class: 'flash', dataset: { cat: a.category ?? 'note' } });
      Object.assign(box.style, {
        left: `${r.left - 4}px`,
        top: `${r.top - 4}px`,
        width: `${r.width + 8}px`,
        height: `${r.height + 8}px`,
      });
      layer.append(box);
      setTimeout(() => box.remove(), 1400);
    },

    destroy() {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      ro?.disconnect();
      mo?.disconnect();
      wires.remove();
      for (const p of parts.values()) for (const node of [p.outline, p.marker, p.note, p.wire]) node.remove();
      parts.clear();
      draft?.outline.remove();
      draft?.marker.remove();
    },
  };
}

function stillMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
