import type { Annotation, CommentAuthor } from './types';

/**
 * Where an author's annotations are kept. The widget holds the working copy in memory and
 * hands the full list to `save` after every change.
 */
export interface AnnotationStorage {
  load(): Annotation[] | Promise<Annotation[]>;
  save(annotations: Annotation[]): void | Annotation[] | Promise<void | Annotation[]>;
  /** Git identity, or null when Git-backed writing needs configuration. Undefined for other adapters. */
  readonly identity?: CommentAuthor | null;
  readonly identityError?: string;
  /** People known to the repository, available for assigning threads. */
  readonly collaborators?: CommentAuthor[];
  /** Subscribe to changes from other clients. The returned function stops synchronization. */
  subscribe?(listener: (annotations: Annotation[]) => void): () => void;
  /** Human-readable note shown in the panel footer, e.g. "Saved to src/annotoo.annotations.json". */
  describe?(): string;
}

function asList(value: unknown): Annotation[] {
  return Array.isArray(value) ? (value as Annotation[]) : [];
}

/** Keeps annotations in memory only. Pair with "Copy JSON" to get them out. */
export function memoryStorage(initial: Annotation[] = []): AnnotationStorage {
  let annotations = initial.slice();
  return {
    load: () => annotations.slice(),
    save(next) {
      annotations = next.slice();
    },
    describe: () => 'Not saved: use Copy JSON to keep these annotations',
  };
}

/** Keeps annotations in this browser's localStorage, keyed per page path by default. */
export function localStorageStorage(key = 'annotoo:annotations:' + location.pathname): AnnotationStorage {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        return asList(raw ? JSON.parse(raw) : []);
      } catch {
        return [];
      }
    },
    save(annotations) {
      try {
        localStorage.setItem(key, JSON.stringify(annotations));
      } catch {
        /* storage may be unavailable (private mode / quota): keep working in memory */
      }
    },
    describe: () => 'Saved in this browser only',
  };
}

export const DEFAULT_ENDPOINT = '/__annotoo/annotations';

/** Shape returned by the dev-server endpoint (see @staplelab/vite-plugin-annotoo). */
export type DevServerPayload = {
  annotoo: 1;
  file: string;
  annotations: Annotation[];
  identity?: CommentAuthor | null;
  identityError?: string;
  collaborators?: CommentAuthor[];
  /** Opaque revision sent back unchanged in If-Match when saving. */
  revision?: string;
  commentsDir?: string;
};

function isDevServerPayload(value: unknown): value is DevServerPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { annotoo?: unknown }).annotoo === 1 &&
    Array.isArray((value as { annotations?: unknown }).annotations)
  );
}

/**
 * Ask the dev server whether the Annotoo plugin is running. Resolves to its payload, or
 * `null` on any failure. A hosted SPA that answers every path with index.html will fail
 * the shape check, so this is safe to call in production.
 */
export async function probeDevServer(
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = 1500,
): Promise<DevServerPayload | null> {
  if (typeof fetch !== 'function') return null;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: ctrl?.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isDevServerPayload(data) ? data : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reads and writes the project's annotations file through the dev-server endpoint, so
 * annotations land in your repo and ship with your build.
 */
export function devServerStorage(
  options: {
    endpoint?: string;
    file?: string;
    onError?: (err: unknown) => void;
    /** Refresh interval while subscribed, in milliseconds. Default 2000. */
    pollInterval?: number;
  } = {},
): AnnotationStorage {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  let file = options.file ?? 'annotoo.annotations.json';
  let current: DevServerPayload | null = null;
  let pending = 0;
  let generation = 0;
  let polling = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(annotations: Annotation[]) => void>();
  const copy = (a: Annotation[]) => JSON.parse(JSON.stringify(a)) as Annotation[];
  // A rejected save must reach the caller without poisoning later writes.
  let queue: Promise<void> = Promise.resolve();

  const accept = (payload: DevServerPayload, notify: boolean) => {
    const changed = JSON.stringify(current) !== JSON.stringify(payload);
    current = payload;
    generation++;
    file = payload.commentsDir ?? payload.file;
    if (changed && notify) for (const listener of listeners) listener(copy(payload.annotations));
  };

  const load = async () => {
    const res = await fetch(endpoint, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const data: unknown = await res.json();
    if (!res.ok || !isDevServerPayload(data)) {
      const message = data && typeof data === 'object' && 'error' in data ? String(data.error) : 'Comments could not be loaded';
      throw new Error(message);
    }
    return data;
  };

  const schedule = () => {
    if (!listeners.size || timer) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (!pending && !polling) {
        const startedAt = generation;
        polling = true;
        try {
          const payload = await load();
          // A save may have started while this GET was in flight.
          if (!pending && listeners.size && startedAt === generation) accept(payload, true);
        } catch (err) {
          options.onError?.(err);
        } finally {
          polling = false;
        }
      }
      schedule();
    }, Math.max(250, options.pollInterval ?? 2000));
  };

  return {
    get identity() { return current?.identity; },
    get identityError() { return current?.identityError; },
    get collaborators() { return current?.collaborators; },
    async load() {
      const payload = await load();
      accept(payload, false);
      return copy(payload.annotations);
    },
    save(annotations) {
      const snapshot = copy(annotations);
      pending++;
      generation++;
      const save = queue.then(async () => {
        try {
          if (!current) accept(await load(), false);
          const headers: Record<string, string> = { 'content-type': 'application/json' };
          if (current?.revision) headers['if-match'] = current.revision;
          const res = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify(snapshot),
          });
          if (res.status === 409) {
            accept(await load(), true);
            throw new Error('Comments changed elsewhere. Review the latest thread, then try again. Your draft has been kept.');
          }
          const data: unknown = await res.json();
          if (!res.ok) {
            const message = data && typeof data === 'object' && 'error' in data ? String(data.error) : `Comments could not be saved (HTTP ${res.status})`;
            throw new Error(message);
          }
          if (isDevServerPayload(data)) {
            accept(data, false);
            return copy(data.annotations);
          }
          // Compatibility with the original JSON-file plugin.
          if (current) accept({ ...current, annotations: snapshot }, false);
          return copy(snapshot);
        } catch (err) {
          options.onError?.(err);
          throw err;
        } finally {
          pending--;
        }
      });
      queue = save.then(() => undefined, () => undefined);
      return save;
    },
    subscribe(listener) {
      listeners.add(listener);
      schedule();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimeout(timer);
          timer = undefined;
        }
      };
    },
    describe: () => current?.commentsDir ? `Git comments · ${file}` : `Auto-saving to ${file}`,
  };
}
