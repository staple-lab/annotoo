import { readEmbeddedComments } from './store';
import { bootViewer } from './viewer';
import { bootAuthor } from './author';

declare global {
  interface Window {
    __notateBooted?: boolean;
  }
}

/**
 * Role detection:
 *  - `?notate=off`     → don't boot at all
 *  - `?notate=author`  → force authoring mode
 *  - embedded comments → viewer mode (this is an exported/bundled page)
 *  - otherwise         → authoring mode
 */
function boot(): void {
  if (window.__notateBooted) return;

  const mode = new URLSearchParams(location.search).get('notate');
  if (mode === 'off') return;

  const embedded = readEmbeddedComments();
  window.__notateBooted = true;

  if (mode === 'author') bootAuthor();
  else if (embedded) bootViewer(embedded);
  else bootAuthor();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
