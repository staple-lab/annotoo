// Script-tag build (`dist/annotoo.js`). Boots itself unless the tag has `data-manual`,
// and exposes the full API on `window.Annotoo`.
import './self-src';
import { mount, type AnnotooInstance } from './index';
import { localStorageStorage } from './storage';
import { downloadBundle, readEmbeddedAnnotations } from './export';

export * from './index';

declare global {
  interface Window {
    __annotooBooted?: boolean;
    __annotoo?: AnnotooInstance;
  }
}

const script = document.currentScript as HTMLScriptElement | null;

/**
 * Role detection for plain HTML pages:
 *  - `?annotoo=off`     → don't boot
 *  - `?annotoo=author`  → force authoring mode
 *  - embedded annotations → viewer mode (an exported page)
 *  - otherwise         → authoring mode, saved in this browser, with "Export HTML"
 */
function boot(): void {
  if (window.__annotooBooted) return;
  window.__annotooBooted = true;

  const embedded = readEmbeddedAnnotations();
  window.__annotoo = mount({
    mode: embedded ? 'viewer' : 'author',
    annotations: embedded ?? [],
    storage: embedded ? undefined : localStorageStorage(),
    // A static page is one route; the exported copy will live at a different URL.
    route: false,
    actions: [{ label: 'Export HTML (self-contained)', icon: 'download', run: downloadBundle }],
  });
}

if (!script?.hasAttribute('data-manual')) boot();
