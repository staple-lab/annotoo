import type { Comment } from './types';
import { getSelfSrc, hasInlinedSelf } from './self-src';
import { ROOT_ID } from './ui';

/** Neutralize `<` so a comment body can't break out of the JSON <script> block. */
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
 * own toolbar removed and the comments + a viewer-mode copy of the widget injected.
 */
export function buildBundleHtml(comments: Comment[]): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelector('#' + ROOT_ID)?.remove();
  clone.querySelectorAll('script[data-notate]').forEach((s) => s.remove());
  clone.querySelectorAll('script[src*="notate"]').forEach((s) => s.remove());
  clone.querySelector('#notate-comments')?.remove();
  const clonedBody = clone.querySelector('body');
  if (clonedBody) clonedBody.style.cursor = '';

  const dataScript = `<script type="application/json" id="notate-comments">${escapeForJsonScript(
    JSON.stringify(comments),
  )}</script>`;
  const codeScript = hasInlinedSelf()
    ? `<script data-notate="viewer">${escapeForInlineScript(getSelfSrc())}</script>`
    : `<script src="notate.js" data-notate="viewer"></script>`;

  let html = '<!DOCTYPE html>\n' + clone.outerHTML;
  const inject = `\n${dataScript}\n${codeScript}\n`;
  const idx = html.lastIndexOf('</body>');
  html = idx !== -1 ? html.slice(0, idx) + inject + html.slice(idx) : html + inject;
  return html;
}

/** Build the bundle and trigger a download of a single `.html` file. */
export function bundleForHub(comments: Comment[]): void {
  if (comments.length === 0) {
    alert('No comments to bundle yet — add some first.');
    return;
  }
  if (!hasInlinedSelf()) {
    console.warn(
      '[notate] Dev build detected: the exported file references notate.js instead of ' +
        'inlining it. Run `npm run build` and use dist/notate.js for a self-contained file.',
    );
  }

  const html = buildBundleHtml(comments);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pageName()}-notated.html`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
