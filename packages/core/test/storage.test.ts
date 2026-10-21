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
  vi.useRealTimers();
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

  test('rejects failed saves and reports them through onError without poisoning later saves', async () => {
    let fail = true;
    stubFetch((_url, init) => init?.method === 'PUT'
      ? fail ? Response.json({ error: 'Disk is full' }, { status: 500 }) : Response.json({ ok: true })
      : Response.json({ annotoo: 1, file: 'annotations.json', annotations: [] }));
    const onError = vi.fn();
    const s = devServerStorage({ onError });
    await expect(s.save([])).rejects.toThrow('Disk is full');
    expect(onError).toHaveBeenCalledOnce();
    fail = false;
    await expect(s.save([c('a')])).resolves.toHaveLength(1);
  });

  test('sends the loaded revision and accepts server-stamped authors', async () => {
    const author = { id: 'git:123', name: 'Reviewer' };
    let header: string | undefined;
    stubFetch((_url, init) => {
      if (init?.method === 'PUT') {
        header = (init.headers as Record<string, string>)['if-match'];
        return Response.json({ annotoo: 1, file: 'seed.json', commentsDir: '.annotoo.comments', identity: author,
          revision: '"second"', annotations: [{ ...c('a'), author }] });
      }
      return Response.json({ annotoo: 1, file: 'seed.json', commentsDir: '.annotoo.comments', identity: author,
        revision: '"first"', annotations: [] });
    });
    const s = devServerStorage();
    await s.load();
    expect(s.identity).toEqual(author);
    expect(s.describe?.()).toContain('.annotoo.comments');
    expect(await s.save([c('a')])).toEqual([{ ...c('a'), author }]);
    expect(header).toBe('"first"');
  });

  test('a stale save refreshes collaborators’ changes and rejects without losing the draft', async () => {
    let changed = false;
    const draft = [c('mine')];
    stubFetch((_url, init) => {
      if (init?.method === 'PUT') {
        changed = true;
        return Response.json({ error: 'conflict' }, { status: 409 });
      }
      return Response.json({ annotoo: 1, file: 'seed.json', revision: changed ? '"new"' : '"old"',
        annotations: changed ? [c('theirs')] : [] });
    });
    const s = devServerStorage();
    await s.load();
    const changedListener = vi.fn();
    const stop = s.subscribe!(changedListener);
    await expect(s.save(draft)).rejects.toThrow('Your draft has been kept');
    expect(changedListener).toHaveBeenCalledWith([c('theirs')]);
    expect(draft[0].id).toBe('mine');
    stop();
  });

  test('refreshes subscribed clients and stops polling when unsubscribed', async () => {
    vi.useFakeTimers();
    let revision = '"first"';
    const fetchFn = stubFetch(() => Response.json({ annotoo: 1, file: 'seed.json', revision,
      annotations: revision === '"first"' ? [] : [c('remote')] }));
    const s = devServerStorage({ pollInterval: 250 });
    await s.load();
    const listener = vi.fn();
    const stop = s.subscribe!(listener);
    revision = '"next"';
    await vi.advanceTimersByTimeAsync(250);
    expect(listener).toHaveBeenCalledWith([c('remote')]);
    stop();
    const count = fetchFn.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(count);
  });

  test('an older background read cannot replace a successful save or its revision', async () => {
    vi.useFakeTimers();
    const payload = (revision: string, annotations: Annotation[]) => ({ annotoo: 1, file: 'seed.json', revision, annotations });
    let reads = 0;
    let finishPoll!: (response: Response) => void;
    const revisions: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        revisions.push((init.headers as Record<string, string>)['if-match']);
        return Response.json(payload('"saved"', [c('mine')]));
      }
      if (++reads === 1) return Response.json(payload('"initial"', []));
      return new Promise<Response>((done) => { finishPoll = done; });
    }));
    const s = devServerStorage({ pollInterval: 250 });
    await s.load();
    const listener = vi.fn();
    const stop = s.subscribe!(listener);
    vi.advanceTimersByTime(250);
    await s.save([c('mine')]);
    finishPoll(Response.json(payload('"initial"', [])));
    await Promise.resolve();
    await Promise.resolve();
    await s.save([c('mine')]);
    expect(listener).not.toHaveBeenCalled();
    expect(revisions).toEqual(['"initial"', '"saved"']);
    stop();
  });
});
