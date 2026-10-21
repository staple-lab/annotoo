import type { Annotation, Mode } from './types';
import {
  DEFAULT_ENDPOINT,
  devServerStorage,
  localStorageStorage,
  memoryStorage,
  probeDevServer,
  type AnnotationStorage,
} from './storage';
import { createRouteResolver, type RouteOption } from './router';
import { createWidget, type Position, type Settings, type Widget, type WidgetAction } from './widget';
import type { DisplayMode } from './layer';
import type { Theme } from './ui';

export type { Anchor, Annotation, AnnotationCategory, AnnotationReply, CommentAuthor, ThreadEvent, Mode } from './types';
export { CATEGORIES } from './types';
export type { AnnotationStorage, DevServerPayload } from './storage';
export type { WidgetAction, Position, Settings } from './widget';
export type { DisplayMode } from './layer';
export type { Theme } from './ui';
export { devServerStorage, localStorageStorage, memoryStorage, probeDevServer } from './storage';
export { serialize, resolve, ANCHOR_ATTR } from './anchor';
export { createRouteResolver, normalizePath, isOnRoute } from './router';

export type MountOptions = {
  /**
   * - `'auto'` (default): author mode when the Annotoo dev-server plugin is running (it
   *   announces itself in `index.html` during `vite dev`), viewer mode everywhere else —
   *   i.e. your deployed build, which makes no extra requests.
   * - `'author'` / `'viewer'`: force a mode.
   *
   * The URL can override this: `?annotoo=author`, `?annotoo=viewer` or `?annotoo=off`.
   */
  mode?: 'auto' | Mode;
  /** Annotations to show (viewer) or start from (author, when no storage has any). */
  annotations?: Annotation[];
  /**
   * Where author-mode annotations are saved. Defaults to the dev-server plugin when it's
   * running, else this browser's localStorage (seeded from `annotations`).
   */
  storage?: AnnotationStorage;
  /** Dev-server endpoint the plugin serves. Default `/__annotoo/annotations`. */
  endpoint?: string;
  /**
   * How annotations are scoped to pages. Default: by `location.pathname`, tolerant of the
   * build being hosted under a sub-path. `false` shows every annotation on every page; or
   * pass a function returning the current route key (e.g. for hash routers).
   */
  route?: RouteOption;
  /** Path prefix your app is served under (stripped before matching routes). */
  basePath?: string;
  /** How notes appear: beside their element (`always`), on hover, or numbers only. Default `always`. */
  display?: DisplayMode;
  /** Outline annotated elements. Default `true`. */
  outlines?: boolean;
  /** Default `auto` (follows the OS). */
  theme?: Theme;
  /** Where the floating toolbar sits. Default `bottom-right`. */
  position?: Position;
  /** Keyboard shortcuts: ⌥A / Alt+A annotate, ⌥H / Alt+H show or hide. Default `true`. */
  shortcuts?: boolean;
  /** Extra buttons in the author toolbar. */
  actions?: WidgetAction[];
  /** Called with the full list after every author change. */
  onChange?: (annotations: Annotation[]) => void;
};

export type AnnotooInstance = {
  /** Resolves with the mode once the widget is on screen (`null` if disabled or destroyed). */
  ready: Promise<Mode | null>;
  /** Replace the displayed annotations (e.g. when an `annotations` prop changes in viewer mode). */
  setAnnotations(annotations: Annotation[]): void;
  show(): void;
  hide(): void;
  toggle(): void;
  destroy(): void;
};

function urlMode(): Mode | 'off' | null {
  try {
    const v = new URLSearchParams(location.search).get('annotoo');
    return v === 'author' || v === 'viewer' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

/** A localStorage store that falls back to `initial` until the author makes a change. */
function seededLocalStorage(initial: Annotation[]): AnnotationStorage {
  const key = 'annotoo:annotations:' + location.pathname;
  const store = localStorageStorage(key);
  return {
    load() {
      try {
        if (localStorage.getItem(key) !== null) return store.load();
      } catch {
        /* fall through */
      }
      return initial;
    },
    save: (a) => store.save(a),
    describe: () => 'Saved in this browser only: use Copy JSON to put them in your project',
  };
}

/** The Vite plugin includes committed threads in static builds, including legacy deletions. */
function withCommittedThreads(initial: Annotation[]): Annotation[] {
  const snapshot = (window as {
    __ANNOTOO_COMMENTS__?: { annotations?: Annotation[]; deletedIds?: string[] };
  }).__ANNOTOO_COMMENTS__;
  if (!snapshot || !Array.isArray(snapshot.annotations)) return initial;
  const threads = new Map(initial.map((annotation) => [annotation.id, annotation]));
  for (const annotation of snapshot.annotations) threads.set(annotation.id, annotation);
  for (const id of snapshot.deletedIds ?? []) threads.delete(id);
  return [...threads.values()].sort((a, b) => a.n - b.n || a.id.localeCompare(b.id));
}

/** Put the Annotoo widget on the page. Safe to call before `document.body` exists. */
export function mount(options: MountOptions = {}): AnnotooInstance {
  let widget: Widget | null = null;
  let viewer = false;
  let destroyed = false;
  let pending = options.annotations;

  const start = async (): Promise<Mode | null> => {
    const forced = urlMode();
    if (forced === 'off') return null;
    const requested = forced ?? options.mode ?? 'auto';
    const devHint = (window as { __ANNOTOO_DEV__?: { endpoint?: string } }).__ANNOTOO_DEV__;
    const endpoint = options.endpoint ?? devHint?.endpoint ?? DEFAULT_ENDPOINT;
    // In 'auto', only look for the dev endpoint when the dev plugin has announced itself.
    const probe = requested === 'author' || !!devHint;
    const initial = withCommittedThreads(pending ?? options.annotations ?? []);
    const initialPending = pending;

    let mode: Mode = requested === 'auto' ? 'viewer' : requested;
    let storage: AnnotationStorage = memoryStorage(initial);

    if (requested !== 'viewer') {
      if (options.storage) {
        mode = 'author';
        storage = options.storage;
      } else if (probe) {
        const payload = await probeDevServer(endpoint);
        if (payload) {
          mode = 'author';
          storage = devServerStorage({ endpoint, file: payload.file });
        } else if (devHint) {
          // A broken Git endpoint must never silently become browser-only storage.
          mode = 'author';
          storage = {
            ...memoryStorage(initial),
            identity: null,
            identityError: 'Git comments could not be loaded. Check the dev server and .annotoo.comments files, then reload.',
            describe: () => 'Git comments unavailable · changes are disabled',
          };
        } else if (requested === 'author') {
          storage = seededLocalStorage(initial);
        }
      }
    }

    let annotations = mode === 'author' ? await storage.load() : initial;
    if (!Array.isArray(annotations)) annotations = [];
    if (destroyed) return null;
    if (document.readyState === 'loading') {
      await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
      if (destroyed) return null;
    }
    if (mode === 'viewer' && pending !== initialPending && pending) annotations = pending;

    const defaults: Settings = {
      display: options.display ?? 'always',
      outlines: options.outlines ?? true,
      theme: options.theme ?? 'auto',
      position: options.position ?? 'bottom-right',
    };
    widget = createWidget({
      mode,
      storage,
      annotations,
      getRoute: createRouteResolver({ mode, route: options.route, basePath: options.basePath }),
      basePath: options.basePath,
      defaults,
      actions: mode === 'author' ? options.actions ?? [] : [],
      shortcuts: options.shortcuts ?? true,
      onChange: options.onChange,
    });
    viewer = mode === 'viewer';
    return mode;
  };

  const ready = start().catch((err) => {
    console.error('[annotoo] failed to start', err);
    return null;
  });

  return {
    ready,
    setAnnotations(annotations) {
      pending = annotations;
      // In author mode the storage is the source of truth; ignore outside updates.
      if (widget && viewer) widget.setAnnotations(annotations);
    },
    show: () => widget?.show(),
    hide: () => widget?.hide(),
    toggle: () => widget?.toggle(),
    destroy() {
      destroyed = true;
      widget?.destroy();
      widget = null;
    },
  };
}
