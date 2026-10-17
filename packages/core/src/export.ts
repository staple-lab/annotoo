import type { Annotation } from './types';
import { getSelfSrc, hasInlinedSelf } from './self-src';
import { ROOT_ID } from './ui';

export const EMBED_ID = 'annotoo-annotations';

/** Annotations baked into an exported page, or `null` if this page has none. */
export function readEmbeddedAnnotations(): Annotation[] | null {
  const node = document.getElementById(EMBED_ID);
  if (!node) return null;
  try {
    const parsed = JSON.parse(node.textContent || '[]');
    return Array.isArray(parsed) ? (parsed as Annotation[]) : [];
  } catch {
    return [];
  }
}

/** Neutralize `<` so an annotation can't break out of the JSON <script> block. */
function escapeForJsonScript(json: string): string {
  return json.replace(/</g, '\\u003c');
}

/** Neutralize any `</script` in the inlined widget source. */
function escapeForInlineScript(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

function pageName(): string {
  const fromTitle = (document.title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (fromTitle) return fromTitle;
  const base = location.pathname.split('/').filter(Boolean).pop() || 'page';
  return base.replace(/\.html?$/i, '') || 'page';
}

/**
 * Produce a self-contained HTML string: a snapshot of the current page with the widget's
 * own UI removed and the annotations + a viewer-mode copy of the widget injected.
 */
export function buildBundleHtml(annotations: Annotation[]): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelector('#' + ROOT_ID)?.remove();
  clone.querySelectorAll('script[data-annotoo]').forEach((s) => s.remove());
  clone.querySelectorAll('script[src*="annotoo"]').forEach((s) => s.remove());
  clone.querySelector('#' + EMBED_ID)?.remove();
  clone.style.cursor = '';
  if (!clone.getAttribute('style')) clone.removeAttribute('style');

  const dataScript = `<script type="application/json" id="${EMBED_ID}">${escapeForJsonScript(
    JSON.stringify(annotations),
  )}</script>`;
  const codeScript = hasInlinedSelf()
    ? `<script data-annotoo="viewer">${escapeForInlineScript(getSelfSrc())}</script>`
    : `<script src="annotoo.js" data-annotoo="viewer"></script>`;

  let html = '<!DOCTYPE html>\n' + clone.outerHTML;
  const inject = `\n${dataScript}\n${codeScript}\n`;
  const idx = html.lastIndexOf('</body>');
  html = idx !== -1 ? html.slice(0, idx) + inject + html.slice(idx) : html + inject;
  return html;
}

/** Build the bundle and trigger a download of a single `.html` file. */
export function downloadBundle(annotations: Annotation[]): string {
  if (annotations.length === 0) throw new Error('Nothing to export yet. Add an annotation first.');
  if (!hasInlinedSelf()) {
    console.warn(
      '[annotoo] Dev build detected: the exported file references annotoo.js instead of ' +
        'inlining it. Use the built dist/annotoo.js for a self-contained file.',
    );
  }

  const html = buildBundleHtml(annotations);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const file = `${pageName()}-annotated.html`;
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Downloaded ${file}: host it anywhere and viewers will see your annotations`;
}
