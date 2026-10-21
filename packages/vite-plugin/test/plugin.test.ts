import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { build, createServer, transformWithEsbuild, type ViteDevServer } from 'vite';
import annotoo from '../src/index';
import { projectDirectory, type Thread } from '../src/storage';

type Payload = { annotoo: 1; file: string; commentsDir: string; project: string; annotations: Thread[]; collaborators: { id: string; name: string }[]; revision: string; identity: { id: string; name: string } | null; identityError?: string; error?: string };
type JsonResponse = Omit<Awaited<ReturnType<typeof fetch>>, 'json'> & { json(): Promise<Payload> };
const fetchJson = (...args: Parameters<typeof fetch>): Promise<JsonResponse> => fetch(...args) as Promise<JsonResponse>;
let server: ViteDevServer;
let base = '';
let dir = '';
let file = '';
let comments = '';
const annotation = (id = 'a1'): Thread => ({ id, n: 1, anchor: { selector: '#a', textSnippet: '', offset: { x: 0.5, y: 0.5 } }, body: 'hi', createdAt: 1 });
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
const get = async (): Promise<Payload> => (await fetchJson(`${base}/__annotoo/annotations`)).json();
const put = async (annotations: unknown, revision?: string, headers: Record<string, string> = {}) => fetchJson(`${base}/__annotoo/annotations`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(revision ? { 'if-match': revision } : {}), ...headers }, body: JSON.stringify(annotations) });
const recordPath = (id: string) => join(projectDirectory(comments, '.'), `${id}.json`);
const record = (id: string) => JSON.parse(readFileSync(recordPath(id), 'utf8'));

beforeEach(async () => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'annotoo-plugin-')));
  file = join(dir, 'src/annotoo.annotations.json');
  comments = join(dir, '.annotoo.comments');
  git('init', '-q');
  git('config', 'user.name', 'Ada Lovelace');
  git('config', 'user.email', 'ADA@Example.com');
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Review</title>');
  server = await createServer({ root: dir, configFile: false, logLevel: 'silent', server: { port: 0, host: '127.0.0.1' }, plugins: [annotoo()] });
  await server.listen();
  const addr = server.httpServer!.address();
  base = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}` : '';
});
afterEach(async () => { await server?.close(); rmSync(dir, { recursive: true, force: true }); });

describe('Git-backed collaborative comments', () => {
  test('creates an import-compatible legacy file and returns privacy-preserving Git identity', async () => {
    expect(readFileSync(file, 'utf8')).toBe('[]\n');
    expect(existsSync(comments)).toBe(true);
    const res = await fetchJson(`${base}/__annotoo/annotations`);
    const payload: Payload = await res.json();
    expect(payload).toMatchObject({ annotoo: 1, file: join('src', 'annotoo.annotations.json'), commentsDir: '.annotoo.comments', project: '.', annotations: [], identity: { name: 'Ada Lovelace', id: `git:${createHash('sha256').update('ada@example.com').digest('hex')}` } });
    expect(res.headers.get('etag')).toBe(payload.revision);
    expect(JSON.stringify(payload)).not.toContain('ADA@Example.com');
    expect(JSON.stringify(payload)).not.toContain('ada@example.com');
  });

  test('discovers deduplicated Git authors and stored collaborators without exposing emails', async () => {
    git('add', 'index.html');
    git('commit', '-qm', 'Initial review');
    git('config', 'user.name', 'Grace Hopper');
    git('config', 'user.email', 'grace@example.com');
    const grace = (await get()).identity!;
    const saved: Payload = await (await put([annotation()], (await get()).revision)).json();
    git('config', 'user.name', 'Local Reviewer');
    git('config', 'user.email', 'local@example.com');
    const payload = await get();
    expect(payload.collaborators.map(person => person.name).sort()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Local Reviewer']);
    expect(payload.collaborators).toContainEqual(grace);
    expect(saved.collaborators).toContainEqual(grace);
    expect(JSON.stringify(payload)).not.toMatch(/ada@example|grace@example|local@example/i);
    git('config', 'user.email', 'ADA@example.com');
    expect((await get()).collaborators.filter(person => person.id === payload.collaborators.find(person => person.name === 'Ada Lovelace')!.id)).toHaveLength(1);
  });

  test('persists canonical assignment, reassignment and unassignment with authoritative audit', async () => {
    const start = await get();
    const ada = start.identity!;
    let payload: Payload = await (await put([{ ...annotation(), assignee: { id: ada.id, name: 'Forged name' }, events: [{ id: 'spoof', type: 'assigned', createdAt: 1 }] }], start.revision)).json();
    const original = payload.annotations[0];
    expect(original.assignee).toEqual(ada);
    expect(original.events).toEqual([{ id: expect.any(String), type: 'assigned', author: ada, assignee: ada, createdAt: original.createdAt }]);
    expect(original.events![0].id).not.toBe('spoof');
    git('config', 'user.name', 'Grace Hopper');
    git('config', 'user.email', 'grace@example.com');
    const grace = (await get()).identity!;
    payload = await (await put([{ ...original, assignee: { id: grace.id, name: 'Spoofed' }, author: grace, events: [] }], payload.revision)).json();
    expect(payload.annotations[0]).toMatchObject({ author: ada, assignee: grace, updatedBy: grace });
    expect(payload.annotations[0].events?.map(event => event.type)).toEqual(['assigned', 'assigned']);
    expect(payload.annotations[0].events![1]).toMatchObject({ author: grace, assignee: grace });
    expect((await get()).annotations).toEqual(payload.annotations);
    expect(record('a1').thread.assignee).toEqual(grace);
    const unchanged = await (await put([{ ...payload.annotations[0], assignee: { id: grace.id, name: 'Still fake' }, events: [] }], payload.revision)).json();
    expect(unchanged.revision).toBe(payload.revision);
    payload = await (await put([{ ...payload.annotations[0], assignee: null }], payload.revision)).json();
    expect(payload.annotations[0].assignee).toBeUndefined();
    expect(payload.annotations[0].author).toEqual(ada);
    expect(payload.annotations[0].events![2]).toMatchObject({ type: 'unassigned', author: grace, assignee: grace });
    expect(record('a1').thread).toEqual(payload.annotations[0]);
  });

  test('rejects unknown assignees atomically and prevents stale assignment overwrites', async () => {
    let payload: Payload = await (await put([annotation()], (await get()).revision)).json();
    const before = readFileSync(recordPath('a1'), 'utf8');
    const invalid = await put([{ ...payload.annotations[0], body: 'Changed', assignee: { id: 'unknown', name: 'Unknown' } }], payload.revision);
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain('Unknown collaborator');
    expect(readFileSync(recordPath('a1'), 'utf8')).toBe(before);
    const responses = await Promise.all([
      put([{ ...payload.annotations[0], assignee: payload.identity }], payload.revision),
      put([{ ...payload.annotations[0], status: 'resolved' }], payload.revision),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const stale = payload;
    payload = await get();
    expect((await put([{ ...stale.annotations[0], assignee: stale.identity }], stale.revision)).status).toBe(409);
    expect((await get()).annotations).toEqual(payload.annotations);
    expect(payload.annotations[0].events).toHaveLength(1);
  });

  test('stamps new threads server-side and writes one versioned file without rewriting legacy JSON', async () => {
    const start = await get();
    const forged = { ...annotation(), author: { id: 'fake', name: 'Fake' }, updatedBy: { id: 'fake', name: 'Fake' }, resolvedBy: { id: 'fake', name: 'Fake' }, events: [{ id: 'fake', type: 'resolved', author: { name: 'Fake' }, createdAt: 1 }] };
    const res = await put([forged], start.revision);
    expect(res.status).toBe(200);
    const payload: Payload = await res.json();
    const [saved] = payload.annotations;
    expect(saved.author).toEqual(start.identity);
    expect(saved.createdAt).toBeGreaterThan(1);
    expect(saved.updatedBy).toBeUndefined();
    expect(saved.resolvedBy).toBeUndefined();
    expect(saved.events).toEqual([]);
    expect(payload.revision).not.toBe(start.revision);
    expect(record('a1')).toEqual({ schemaVersion: 1, project: '.', thread: saved });
    expect(readFileSync(file, 'utf8')).toBe('[]\n');
    expect(readdirSync(projectDirectory(comments, '.'))).toEqual(['a1.json']);
    expect(readFileSync(recordPath('a1'), 'utf8')).not.toContain('ada@example.com');
  });

  test('attributes append-only replies and resolve/reopen events to the current Git identity', async () => {
    let payload: Payload = await (await put([annotation()], (await get()).revision)).json();
    const original = payload.annotations[0];
    git('config', 'user.name', 'Grace Hopper');
    git('config', 'user.email', 'grace@example.com');
    const grace = (await get()).identity;
    payload = await (await put([{ ...original, status: 'resolved', replies: [{ id: 'r1', body: 'Fixed', author: { id: 'fake', name: 'Fake' }, createdAt: 1 }], events: [{ id: 'fake' }] }], payload.revision)).json();
    const resolved = payload.annotations[0];
    expect(resolved.author).toEqual(original.author);
    expect(resolved.replies).toEqual([{ id: 'r1', body: 'Fixed', author: grace, createdAt: expect.any(Number) }]);
    expect(resolved.resolvedBy).toEqual(grace);
    expect(resolved.resolvedAt).toBeGreaterThan(1);
    expect(resolved.events).toEqual([{ id: expect.any(String), type: 'resolved', author: grace, createdAt: resolved.resolvedAt }]);
    const res = await put([{ ...resolved, status: 'open', author: { id: 'fake', name: 'Fake' }, createdAt: 2 }], payload.revision);
    const reopened: Payload = await res.json();
    expect(reopened.annotations[0]).toMatchObject({ author: original.author, createdAt: original.createdAt, status: 'open', updatedBy: grace });
    expect(reopened.annotations[0].resolvedBy).toBeUndefined();
    expect(reopened.annotations[0].resolvedAt).toBeUndefined();
    expect(reopened.annotations[0].events?.map((event) => event.type)).toEqual(['resolved', 'reopened']);
    expect(reopened.annotations[0].replies).toEqual(resolved.replies);
  });

  test('edits preserve original authorship and server timestamps, ignoring metadata forgery', async () => {
    const initial: Payload = await (await put([annotation()], (await get()).revision)).json();
    const original = initial.annotations[0];
    git('config', 'user.name', 'Grace Hopper');
    git('config', 'user.email', 'grace@example.com');
    const res = await put([{ ...original, body: 'Edited', createdAt: 7, author: { id: 'fake', name: 'Fake' }, updatedAt: 8, updatedBy: { id: 'fake', name: 'Fake' } }], initial.revision);
    const saved: Payload = await res.json();
    expect(saved.annotations[0]).toMatchObject({ body: 'Edited', author: original.author, createdAt: original.createdAt, updatedBy: saved.identity });
    expect(saved.annotations[0].updatedAt).toBeGreaterThan(8);
  });

  test('requires configured Git name and email for mutations but still allows reading', async () => {
    git('config', 'user.email', '');
    const payload = await get();
    expect(payload.identity).toBeNull();
    expect(payload.identityError).toContain('git config user.email');
    const res = await put([annotation()], payload.revision);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('git config user.name');
    expect(readdirSync(comments)).toEqual([]);
  });

  test('requires a revision and rejects stale snapshots without overwriting concurrent work', async () => {
    const revision = (await get()).revision;
    expect((await put([annotation()])).status).toBe(428);
    const responses = await Promise.all([put([annotation('alice')], revision), put([annotation('bob')], revision)]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    const payload = await get();
    expect(payload.annotations).toHaveLength(1);
    expect(readdirSync(projectDirectory(comments, '.'))).toHaveLength(1);
    const stale = await put([], revision);
    expect(stale.status).toBe(409);
    expect((await get()).annotations).toEqual(payload.annotations);
  });

  test('preserves attribution and history when a current-revision Undo restores a deleted thread', async () => {
    const saved: Payload = await (await put([{ ...annotation(), status: 'resolved', replies: [{ id: 'r1', body: 'Keep this discussion', author: { id: 'fake', name: 'Fake' }, createdAt: 1 }] }], (await get()).revision)).json();
    const original = saved.annotations[0];
    const deleted: Payload = await (await put([], saved.revision)).json();
    expect(deleted.annotations).toEqual([]);
    expect(record('a1').deleted).toBe(true);
    git('config', 'user.name', 'Restoring Teammate');
    git('config', 'user.email', 'restore@example.com');
    const res = await put([{ ...original, author: { id: 'fake', name: 'Fake' }, events: [] }], deleted.revision);
    expect(res.status).toBe(200);
    const restored: Payload = await res.json();
    expect(restored.annotations[0]).toMatchObject({ author: original.author, createdAt: original.createdAt, replies: original.replies, events: original.events, updatedBy: restored.identity });
    expect(record('a1').deleted).toBeUndefined();
  });

  test('coordinates CAS writes from separate operating-system processes and recovers dead locks', async () => {
    const revision = (await get()).revision;
    const module = await transformWithEsbuild(readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8'), 'storage.ts', { loader: 'ts', target: 'node18' });
    const compiled = join(dir, 'storage.mjs');
    writeFileSync(compiled, module.code);
    const project = projectDirectory(comments, '.');
    const run = (threadId: string) => new Promise<string>((ok, fail) => {
      const script = `
        import { withWriteLock, readSnapshot, prepareChanges, validateThreads, writeChanges } from ${JSON.stringify(new URL(`file://${compiled}`).href)};
        await withWriteLock(${JSON.stringify(dir)}, ${JSON.stringify(project)}, async () => {
          const snapshot = readSnapshot(${JSON.stringify(dir)}, ${JSON.stringify(file)}, ${JSON.stringify(comments)}, '.');
          if (snapshot.revision !== ${JSON.stringify(revision)}) { process.stdout.write('conflict'); return; }
          await new Promise(done => setTimeout(done, 50));
          writeChanges(${JSON.stringify(dir)}, ${JSON.stringify(project)}, prepareChanges(snapshot, validateThreads(${JSON.stringify([annotation(threadId)])}), { id: 'test', name: 'Test' }, '.'));
          process.stdout.write('saved');
        });`;
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      let error = '';
      child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { error += chunk.toString(); });
      child.on('error', fail);
      child.on('close', (code) => code === 0 ? ok(output) : fail(new Error(error)));
    });
    expect((await Promise.all([run('alice'), run('bob')])).sort()).toEqual(['conflict', 'saved']);
    expect((await get()).annotations).toHaveLength(1);
    const lock = join(project, '.annotoo-lock');
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: 2147483647, token: 'dead-owner' }));
    const current = await get();
    expect((await put([...current.annotations, annotation('recovered')], current.revision)).status).toBe(200);
    expect(existsSync(lock)).toBe(false);
  });

  test('returns an actionable busy error when another live process holds the write lock', async () => {
    const project = projectDirectory(comments, '.');
    const lock = join(project, '.annotoo-lock');
    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'another-live-server' }));
    const res = await put([annotation()], (await get()).revision);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('Another Annotoo process');
    expect(existsSync(recordPath('a1'))).toBe(false);
  }, 10000);

  test('keeps legacy arbitrary IDs editable while safely hashing their filenames', async () => {
    const legacy = annotation('review:button.with.periods/旧');
    writeFileSync(file, JSON.stringify([legacy]));
    const start = await get();
    expect(start.annotations[0].id).toBe(legacy.id);
    const res = await put([{ ...legacy, body: 'Legacy edit' }], start.revision);
    expect(res.status).toBe(200);
    expect((await get()).annotations[0].id).toBe(legacy.id);
    const files = readdirSync(projectDirectory(comments, '.'));
    expect(files).toEqual([`legacy-${createHash('sha256').update(legacy.id).digest('hex')}.json`]);
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify([legacy]));
  });

  test('merges legacy data and preserves deletion tombstones across reads and builds', async () => {
    const legacy = [annotation('legacy'), { ...annotation('keep'), n: 2 }];
    const original = JSON.stringify(legacy, null, 2) + '\n';
    writeFileSync(file, original);
    const start = await get();
    expect(start.annotations).toEqual(legacy);
    const res = await put([{ ...legacy[1], body: 'Updated legacy' }], start.revision);
    expect(res.status).toBe(200);
    expect(record('legacy').deleted).toBe(true);
    expect((await get()).annotations.map((thread) => thread.id)).toEqual(['keep']);
    expect(readFileSync(file, 'utf8')).toBe(original);
    expect((await put(legacy, start.revision)).status).toBe(409);
    const result = await build({ root: dir, configFile: false, logLevel: 'silent', plugins: [annotoo()], build: { write: false } });
    const output = (Array.isArray(result) ? result[0] : result) as { output: { type: string; fileName: string; source?: string | Uint8Array }[] };
    const html = String(output.output.find((entry) => entry.fileName === 'index.html')?.source);
    expect(html).toContain('window.__ANNOTOO_COMMENTS__=');
    expect(html).toContain('"deletedIds":["legacy"]');
    expect(html).toContain('Updated legacy');
    expect(html).not.toContain('__ANNOTOO_DEV__');
  });

  test('documented dev-only recipe excludes comments and SDK from production while retaining development review', async () => {
    const sentinel = 'PRIVATE_REVIEW_SENTINEL_5a8d';
    await put([{ ...annotation(), body: sentinel }], (await get()).revision);
    const pluginPath = fileURLToPath(new URL('../src/index.ts', import.meta.url));
    // Resolve the real SDK source, so this test also runs on a fresh checkout before a package build.
    const sdkPath = fileURLToPath(new URL('../../core/src/index.ts', import.meta.url));
    const configFile = join(dir, 'vite.config.mts');
    writeFileSync(configFile, `
      import annotoo from ${JSON.stringify(pluginPath)};
      export default ({ command }) => ({
        plugins: command === 'serve' ? [annotoo()] : [],
      });
    `);
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>App</title><script type="module" src="/src/main.ts"></script>');
    writeFileSync(join(dir, 'src/main.ts'), `
      document.body.dataset.app = 'production-app-ready';
      if (import.meta.env.DEV) {
        import(${JSON.stringify(sdkPath)}).then(({ mount }) => mount());
      }
    `);
    // Vitest sets NODE_ENV=test; reproduce the environment of a real production build.
    vi.stubEnv('NODE_ENV', 'production');
    let result;
    try {
      result = await build({ root: dir, configFile, logLevel: 'silent', build: { write: false } });
    } finally { vi.unstubAllEnvs(); }
    const output = (Array.isArray(result) ? result[0] : result) as { output: { fileName: string; code?: string; source?: string | Uint8Array; modules?: Record<string, unknown> }[] };
    const emitted = output.output.map((entry) => entry.code ?? String(entry.source ?? '')).join('\n');
    expect(emitted).toContain('production-app-ready');
    expect(emitted).not.toContain('__ANNOTOO_COMMENTS__');
    expect(emitted).not.toContain('__ANNOTOO_DEV__');
    expect(emitted).not.toContain(sentinel);
    expect(emitted).not.toContain('annotoo-root');
    expect(output.output.flatMap((entry) => Object.keys(entry.modules ?? {})).some((id) => id.includes('/packages/core/'))).toBe(false);
    expect(output.output.filter((entry) => entry.fileName.endsWith('.js'))).toHaveLength(1);

    await server.close();
    server = await createServer({ root: dir, configFile, logLevel: 'silent', server: { port: 0, host: '127.0.0.1' } });
    await server.listen();
    const address = server.httpServer!.address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;
    expect((await (await fetch(`${base}/`)).text())).toContain('__ANNOTOO_DEV__');
    expect((await get()).annotations[0].body).toBe(sentinel);
    const source = await server.transformRequest('/src/main.ts');
    expect(source?.code).toContain('"DEV": true');
    expect(source?.code).toContain('mount');
    expect(source?.code).toContain('/packages/core/src/index.ts');
  });

  test('production snapshots safely escape script-closing content and embed no runtime endpoint', async () => {
    const malicious = { ...annotation(), body: '</script><script>alert(1)</script>' };
    await put([malicious], (await get()).revision);
    const result = await build({ root: dir, configFile: false, logLevel: 'silent', plugins: [annotoo()], build: { write: false } });
    const output = (Array.isArray(result) ? result[0] : result) as { output: { fileName: string; source?: string | Uint8Array }[] };
    const html = String(output.output.find((entry) => entry.fileName === 'index.html')?.source);
    expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
    expect(html).not.toContain('</script><script>alert');
    expect(html).not.toContain('/__annotoo/annotations');
    expect(html).not.toContain('collaborators');
    expect(html).not.toContain('ada@example.com');
  });

  test('isolates identical routes and thread IDs in different Vite projects in one Git repository', async () => {
    const rootPayload: Payload = await (await put([annotation()], (await get()).revision)).json();
    const appDir = join(dir, 'apps', 'other');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, 'index.html'), '<!doctype html><title>Other app</title>');
    const other = await createServer({ root: appDir, configFile: false, logLevel: 'silent', server: { port: 0, host: '127.0.0.1' }, plugins: [annotoo()] });
    try {
      await other.listen();
      const address = other.httpServer!.address() as { port: number };
      const url = `http://127.0.0.1:${address.port}/__annotoo/annotations`;
      const otherPayload: Payload = await (await fetchJson(url)).json();
      expect(otherPayload.project).toBe('apps/other');
      expect(otherPayload.annotations).toEqual([]);
      expect(otherPayload.revision).not.toBe(rootPayload.revision);
      const saved = await fetchJson(url, { method: 'PUT', headers: { 'if-match': otherPayload.revision }, body: JSON.stringify([{ ...annotation(), body: 'Other project' }]) });
      expect(saved.status).toBe(200);
      expect((await get()).annotations[0].body).toBe('hi');
      expect(JSON.parse(readFileSync(join(projectDirectory(comments, 'apps/other'), 'a1.json'), 'utf8')).project).toBe('apps/other');
    } finally { await other.close(); }
  });

  test('detects comment files changed by Git pull and refuses stale writes', async () => {
    const initial: Payload = await (await put([annotation()], (await get()).revision)).json();
    const external = record('a1');
    external.thread.body = 'Changed on a teammate branch';
    writeFileSync(recordPath('a1'), JSON.stringify(external));
    expect((await get()).annotations[0].body).toBe('Changed on a teammate branch');
    expect((await put(initial.annotations, initial.revision)).status).toBe(409);
  });

  test('surfaces corrupt stored JSON rather than silently discarding data', async () => {
    await put([annotation()], (await get()).revision);
    writeFileSync(recordPath('a1'), '{broken');
    const res = await fetchJson(`${base}/__annotoo/annotations`);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('a1.json');
    expect(readFileSync(recordPath('a1'), 'utf8')).toBe('{broken');
  });

  test('rejects invalid IDs, duplicate IDs, unsafe anchors, categories and excessive text without writes', async () => {
    const revision = (await get()).revision;
    for (const invalid of [
      { ...annotation(), id: '../escape' },
      { ...annotation(), body: 'x'.repeat(20001) },
      { ...annotation(), title: 'x'.repeat(201) },
      { ...annotation(), category: 'bogus' },
      { ...annotation(), anchor: { ...annotation().anchor, offset: { x: 2, y: 0 } } },
      { ...annotation(), anchor: null },
      { ...annotation(), createdAt: 8640000000000001 },
    ]) expect((await put([invalid], revision)).status).toBe(400);
    expect((await put([annotation(), annotation()], revision)).status).toBe(400);
    expect((await put({ evil: true }, revision)).status).toBe(400);
    expect(readdirSync(projectDirectory(comments, '.'))).toEqual([]);
    const badJson = await fetchJson(`${base}/__annotoo/annotations`, { method: 'PUT', headers: { 'if-match': revision }, body: '{bad' });
    expect(badJson.status).toBe(400);
  });

  test('refuses reply deletion or editing and leaves authors and file contents intact', async () => {
    let payload: Payload = await (await put([{ ...annotation(), replies: [{ id: 'r1', body: 'Original', author: { id: 'fake', name: 'Fake' }, createdAt: 1 }] }], (await get()).revision)).json();
    const saved = readFileSync(recordPath('a1'), 'utf8');
    expect((await put([{ ...payload.annotations[0], replies: [] }], payload.revision)).status).toBe(400);
    expect((await put([{ ...payload.annotations[0], replies: [{ ...payload.annotations[0].replies![0], body: 'Forged edit' }] }], payload.revision)).status).toBe(400);
    expect(readFileSync(recordPath('a1'), 'utf8')).toBe(saved);
    payload = await get();
    expect(payload.annotations[0].replies![0].author).toEqual(payload.identity);
  });

  test('rejects cross-origin writes and symlink destinations', async () => {
    const revision = (await get()).revision;
    expect((await put([annotation()], revision, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await put([annotation()], revision, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    const outside = mkdtempSync(join(tmpdir(), 'annotoo-outside-'));
    try {
      symlinkSync(outside, projectDirectory(comments, '.'));
      const res = await put([annotation()], revision);
      expect(res.status).toBe(500);
      expect((await res.json()).error).toContain('symlink');
      expect(readdirSync(outside)).toEqual([]);
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });

  test('rejects unsafe configured paths and invalid stored envelopes', async () => {
    await expect(createServer({ root: dir, configFile: false, plugins: [annotoo({ commentsDir: '../outside' })], logLevel: 'silent' })).rejects.toThrow('relative path');
    await expect(createServer({ root: dir, configFile: false, plugins: [annotoo({ commentsDir: '.git' })], logLevel: 'silent' })).rejects.toThrow('Git internals');
    const project = projectDirectory(comments, '.');
    mkdirSync(project);
    writeFileSync(join(project, 'a1.json'), JSON.stringify({ schemaVersion: 2, thread: annotation() }));
    const res = await fetchJson(`${base}/__annotoo/annotations`);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('schemaVersion');
  });

  test('announces the endpoint only during development and refuses other methods', async () => {
    const html = await (await fetchJson(`${base}/`)).text();
    expect(html).toContain('window.__ANNOTOO_DEV__={"endpoint":"/__annotoo/annotations"}');
    expect((await fetchJson(`${base}/__annotoo/annotations`, { method: 'DELETE' })).status).toBe(405);
  });
});
