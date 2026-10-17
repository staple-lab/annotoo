import { afterEach, describe, expect, test, vi } from 'vitest';
import { devServerStorage, localStorageStorage, memoryStorage, probeDevServer } from '../src/storage';
import type { Annotation } from '../src/types';

const c = (id: string): Annotation => ({
  id,
  n: 1,
  anchor: { selector: 'p', textSnippet: '', offset: { x: 0.5, y: 0.5 } },
  body: 'hi',
  createdAt: 0,
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('memoryStorage', () => {
  test('round-trips and does not alias the caller array', () => {
    const initial = [c('a')];
    const s = memoryStorage(initial);
    initial.push(c('b'));
    expect(s.load()).toHaveLength(1);
    s.save([c('x'), c('y')]);
    expect((s.load() as Annotation[]).map((x) => x.id)).toEqual(['x', 'y']);
  });
});

describe('localStorageStorage', () => {
  test('persists under the given key and survives bad JSON', () => {
    const s = localStorageStorage('k');
    s.save([c('a')]);
    expect(localStorageStorage('k').load()).toHaveLength(1);
    localStorage.setItem('k', '{nope');
    expect(localStorageStorage('k').load()).toEqual([]);
  });
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('probeDevServer', () => {
  test('accepts the plugin payload', async () => {
    stubFetch(() => Response.json({ annotoo: 1, file: 'src/annotoo.annotations.json', annotations: [c('a')] }));
    const p = await probeDevServer();
    expect(p?.file).toBe('src/annotoo.annotations.json');
    expect(p?.annotations).toHaveLength(1);
  });

  test('rejects an SPA fallback that answers with index.html', async () => {
    stubFetch(() => new Response('<!doctype html><div id="root"></div>', { headers: { 'content-type': 'text/html' } }));
    expect(await probeDevServer()).toBeNull();
  });

  test('rejects 404s and network errors', async () => {
    stubFetch(() => new Response('nope', { status: 404 }));
    expect(await probeDevServer()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await probeDevServer()).toBeNull();
  });
});

describe('devServerStorage', () => {
  test('loads from GET and saves with sequential PUTs', async () => {
    const bodies: string[] = [];
    const fetchFn = stubFetch((_url, init) => {
      if (init?.method === 'PUT') {
        bodies.push(String(init.body));
        return Response.json({ ok: true });
      }
      return Response.json({ annotoo: 1, file: 'annotations.json', annotations: [c('a')] });
    });
    const s = devServerStorage();
    expect(await s.load()).toHaveLength(1);
    expect(s.describe?.()).toBe('Auto-saving to annotations.json');
    s.save([c('a'), c('b')]);
    await s.save([c('a')]);
    expect(bodies.map((b) => JSON.parse(b).length)).toEqual([2, 1]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  test('reports failed saves through onError', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));
    const onError = vi.fn();
    await devServerStorage({ onError }).save([]);
    expect(onError).toHaveBeenCalledOnce();
  });
});
