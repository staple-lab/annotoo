import type { Anchor } from './types';

const SNIPPET_MAX = 40;

/** First ~40 chars of an element's text, with runs of whitespace collapsed. */
export function textSnippet(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX);
}

function cssEscapeIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch);
}

function isUniqueId(id: string, root: ParentNode): boolean {
  return root.querySelectorAll('#' + cssEscapeIdent(id)).length === 1;
}

/** A single path segment for an element: `tag` or `tag:nth-of-type(k)`. */
function segmentFor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const sameType = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  if (sameType.length === 1) return tag;
  return `${tag}:nth-of-type(${sameType.indexOf(el) + 1})`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function computeOffset(
  el: Element,
  clickPoint?: { clientX: number; clientY: number },
): { x: number; y: number } {
  if (!clickPoint) return { x: 0.5, y: 0.5 };
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { x: 0.5, y: 0.5 };
  return {
    x: clamp01((clickPoint.clientX - r.left) / r.width),
    y: clamp01((clickPoint.clientY - r.top) / r.height),
  };
}

/**
 * Build an {@link Anchor} for an element: a stable-ish selector plus a text snippet and
 * normalized click offset that let us re-find and re-pin it after the page reloads.
 */
export function serialize(
  el: Element,
  clickPoint?: { clientX: number; clientY: number },
): Anchor {
  const root = el.ownerDocument;
  const segments: string[] = [];
  let cur: Element | null = el;

  while (cur) {
    if (cur.id && isUniqueId(cur.id, root)) {
      segments.unshift('#' + cssEscapeIdent(cur.id));
      break;
    }
    segments.unshift(segmentFor(cur));
    if (cur.tagName === 'BODY' || cur.tagName === 'HTML') break;
    cur = cur.parentElement;
  }

  return {
    selector: segments.join(' > '),
    textSnippet: textSnippet(el),
    offset: computeOffset(el, clickPoint),
  };
}

/** Count of descendant elements — used to prefer the most specific text match. */
function elementDepthWeight(el: Element): number {
  return el.querySelectorAll('*').length;
}

function findByText(snippet: string, root: ParentNode): Element | null {
  if (!snippet) return null;
  const matches = Array.from(root.querySelectorAll('*')).filter(
    (el) => textSnippet(el) === snippet,
  );
  if (matches.length === 0) return null;
  // Prefer the deepest / most specific element (fewest descendants of its own).
  return matches.reduce((best, el) =>
    elementDepthWeight(el) < elementDepthWeight(best) ? el : best,
  );
}

/**
 * Re-find the element an {@link Anchor} points to. Tries the selector first (disambiguating
 * multiple hits by text), then falls back to a whole-tree text search. Returns `null` when
 * the target can no longer be found — callers treat that as "unanchored".
 */
export function resolve(anchor: Anchor, root: ParentNode = document): Element | null {
  try {
    const matches = root.querySelectorAll(anchor.selector);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const byText = Array.from(matches).find((m) => textSnippet(m) === anchor.textSnippet);
      return byText ?? matches[0];
    }
  } catch {
    // Invalid selector — fall through to the text fallback.
  }
  return findByText(anchor.textSnippet, root);
}
