import type { Mode } from './types';

/**
 * SPA route-change detection. Browsers don't fire an event for `history.pushState`, so we
 * patch it (once, idempotently) to dispatch `annotoo:locationchange`.
 */
export const LOCATION_EVENT = 'annotoo:locationchange';

const PATCHED = '__annotooHistoryPatched';

function patchHistory(): void {
  const h = history as History & { [PATCHED]?: boolean };
  if (h[PATCHED]) return;
  h[PATCHED] = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = h[method];
    h[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(LOCATION_EVENT));
      return result;
    };
  }
}

/** Calls `onChange` whenever the URL changes (pushState, replaceState, back/forward, hash). */
export function onLocationChange(onChange: () => void): () => void {
  patchHistory();
  let last = location.href;
  const check = () => {
    if (location.href === last) return;
    last = location.href;
    onChange();
  };
  window.addEventListener(LOCATION_EVENT, check);
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  return () => {
    window.removeEventListener(LOCATION_EVENT, check);
    window.removeEventListener('popstate', check);
    window.removeEventListener('hashchange', check);
  };
}

/** `/a/b/` → `/a/b`, `/a/index.html` → `/a`, `` → `/`. */
export function normalizePath(path: string): string {
  let p = path.replace(/\/index\.html?$/i, '/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export type RouteOption = false | (() => string) | undefined;

/**
 * Builds the function that names "the page we're on" for scoping annotations.
 *
 * Returns `null` when routing is disabled (every annotation shows everywhere).
 *
 * Authors record the exact path (they're almost always on a dev server at `/`). Viewers are
 * often on a host that serves the build under a prefix — `/s/my-proto/shipments` instead of
 * `/shipments` — so in viewer mode we match the longest known annotation route that the
 * current path ends with, and treat an unrecognised path as the app root.
 */
export function createRouteResolver(cfg: {
  mode: Mode;
  route?: RouteOption;
  basePath?: string;
}): (knownRoutes: string[]) => string | null {
  if (cfg.route === false) return () => null;
  if (typeof cfg.route === 'function') {
    const fn = cfg.route;
    return () => fn();
  }
  const base = cfg.basePath ? normalizePath(cfg.basePath) : null;

  return (known) => {
    const path = normalizePath(location.pathname);
    if (base && base !== '/' && (path === base || path.startsWith(base + '/'))) {
      return normalizePath(path.slice(base.length));
    }
    if (cfg.mode === 'author' || base) return path;

    const routes = known.map(normalizePath);
    if (routes.includes(path)) return path;
    const suffix = routes
      .filter((r) => r !== '/' && path.endsWith(r))
      .sort((a, b) => b.length - a.length)[0];
    return suffix ?? '/';
  };
}

/** Annotations with no route are treated as global and show on every page. */
export function isOnRoute(item: { route?: string }, route: string | null): boolean {
  return route == null || item.route == null || normalizePath(item.route) === route;
}
