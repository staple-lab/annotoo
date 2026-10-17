import type { Annotation } from './types';

/**
 * Where an author's annotations are kept. The widget holds the working copy in memory and
 * hands the full list to `save` after every change.
 */
export interface AnnotationStorage {
  load(): Annotation[] | Promise<Annotation[]>;
  save(annotations: Annotation[]): void | Promise<void>;
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
export type DevServerPayload = { annotoo: 1; file: string; annotations: Annotation[] };

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
  options: { endpoint?: string; file?: string; onError?: (err: unknown) => void } = {},
): AnnotationStorage {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  let file = options.file ?? 'annotoo.annotations.json';
  // Serialize writes so a slow PUT can't land after a newer one.
  let queue: Promise<void> = Promise.resolve();

  return {
    async load() {
      const payload = await probeDevServer(endpoint);
      if (!payload) throw new Error(`[annotoo] dev server endpoint ${endpoint} is not available`);
      file = payload.file;
      return payload.annotations;
    },
    save(annotations) {
      const body = JSON.stringify(annotations);
      queue = queue
        .then(async () => {
          const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body,
          });
          if (!res.ok) throw new Error(`[annotoo] save failed: HTTP ${res.status}`);
        })
        .catch((err) => {
          (options.onError ?? console.error)(err);
        });
      return queue;
    },
    describe: () => `Auto-saving to ${file}`,
  };
}
