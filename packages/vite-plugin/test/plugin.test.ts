import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import annotoo from '../src/index';

let server: ViteDevServer;
let base = '';
const dir = mkdtempSync(join(tmpdir(), 'annotoo-plugin-'));
const file = join(dir, 'src/annotoo.annotations.json');

beforeAll(async () => {
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>t</title>');
  server = await createServer({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    server: { port: 0, host: '127.0.0.1' },
    plugins: [annotoo()],
  });
  await server.listen();
  const addr = server.httpServer!.address();
  base = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}` : '';
});

afterAll(async () => {
  await server?.close();
});

const annotation = { id: 'a1', n: 1, anchor: { selector: '#a', textSnippet: '', offset: { x: 0.5, y: 0.5 } }, body: 'hi', createdAt: 1 };

describe('vite-plugin-annotoo', () => {
  test('creates the annotations file on startup', () => {
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('[]\n');
  });

  test('GET returns the probe payload', async () => {
    const res = await fetch(`${base}/__annotoo/annotations`);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ annotoo: 1, file: join('src', 'annotoo.annotations.json'), annotations: [] });
  });

  test('PUT writes pretty JSON to disk', async () => {
    const res = await fetch(`${base}/__annotoo/annotations`, { method: 'PUT', body: JSON.stringify([annotation]) });
    expect(res.status).toBe(200);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([annotation]);
    expect(readFileSync(file, 'utf8')).toContain('\n  {\n');
  });

  test('PUT rejects payloads that are not annotation arrays', async () => {
    const bad = await fetch(`${base}/__annotoo/annotations`, { method: 'PUT', body: JSON.stringify({ evil: true }) });
    expect(bad.status).toBe(400);
    const junk = await fetch(`${base}/__annotoo/annotations`, { method: 'PUT', body: '{nope' });
    expect(junk.status).toBe(400);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([annotation]);
  });

  test('announces itself in index.html during dev', async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('window.__ANNOTOO_DEV__={"endpoint":"/__annotoo/annotations"}');
  });

  test('other methods are refused', async () => {
    const res = await fetch(`${base}/__annotoo/annotations`, { method: 'DELETE' });
    expect(res.status).toBe(405);
  });
});
