import { realpathSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';
import { assertSafePath, collaborators, gitIdentity, gitRoot, prepareChanges, projectDirectory, readSnapshot, relativePath, RequestError, validateThreads, withWriteLock, writeChanges } from './storage';

export type AnnotooPluginOptions = {
  /** Legacy annotations file, relative to the Vite root. Default `src/annotoo.annotations.json`. Kept for existing imports. */
  file?: string;
  /** Production builds are inactive unless explicitly enabled as a read-only viewer. */
  build?: 'viewer';
  /** Automatically mount the widget. Disable when supplying your own mount() call. */
  autoMount?: boolean;
  /** Git-tracked thread directory, relative to the Git repository root (or Vite root outside Git). Default `.annotoo.comments`. */
  commentsDir?: string;
  /** Endpoint the widget talks to. Must match the widget's `endpoint`. Default `/__annotoo/annotations`. */
  endpoint?: string;
};
const MAX_BODY = 5 * 1024 * 1024;
/** A display name chosen in the browser: decoded, trimmed, printable and at most 200 characters. */
function displayName(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
  let name: string;
  try { name = decodeURIComponent(header).trim(); } catch { throw new RequestError(400, 'Invalid display name'); }
  if (!name) return undefined;
  if (name.length > 200 || Array.from(name).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new RequestError(400, 'Display names must be 1 to 200 printable characters');
  return name;
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0;
    let oversized = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) { oversized = true; chunks.length = 0; return; }
      if (!oversized) chunks.push(chunk);
    });
    req.on('end', () => oversized ? fail(new RequestError(413, 'Comment payload exceeds 5 MiB')) : ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}
export function serialize(annotations: unknown[]): string { return JSON.stringify(annotations, null, 2) + '\n'; }
function scriptJson(value: unknown): string { return JSON.stringify(value).replace(/</g, '\\u003c'); }

/** Automatic Git-backed review in development; production is untouched unless build: 'viewer'. */
export default function annotoo(options: AnnotooPluginOptions = {}): Plugin {
  const endpoint = options.endpoint ?? '/__annotoo/annotations';
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || /[?#\s<>]/.test(endpoint)) throw new Error('[annotoo] endpoint must be a same-origin URL path');
  const bootId = '/@annotoo/boot.js';
  const resolvedBootId = '\0annotoo:boot';
  const runtimeId = 'virtual:annotoo/runtime';
  const runtimeFile = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? '../index.ts' : './index.js', import.meta.url));
  let development = false;
  let base = '/';
  let file = '';
  let root = '';
  let repository = '';
  let commentsDir = '';
  let project = '';
  const payload = () => {
    const snapshot = readSnapshot(repository, file, commentsDir, project);
    return { annotoo: 1, file: relative(root, file), commentsDir: relative(repository, commentsDir), project, annotations: snapshot.annotations, revision: snapshot.revision, collaborators: collaborators(root, snapshot), ...gitIdentity(root) };
  };
  return {
    name: 'annotoo',
    apply: (_config, environment) => environment.command === 'serve' || options.build === 'viewer',
    configResolved(config) {
      development = config.command === 'serve';
      base = config.base;
      root = realpathSync(config.root);
      repository = gitRoot(root);
      project = relative(repository, root).split(sep).join('/') || '.';
      file = relativePath(root, options.file ?? 'src/annotoo.annotations.json', 'file');
      // Validate against the Git root too, so a nested Vite project cannot traverse a symlink.
      assertSafePath(repository, file);
      commentsDir = relativePath(repository, options.commentsDir ?? '.annotoo.comments', 'commentsDir');
      // Reading reviews never creates files. The first save creates its thread directory.
    },
    resolveId(id) {
      if (id === bootId) return resolvedBootId;
      if (id === runtimeId) return runtimeFile;
    },
    load(id) {
      if (id !== resolvedBootId) return;
      const mountOptions = { mode: development ? 'auto' : 'viewer', ...(development ? { endpoint } : {}), ...(base.startsWith('/') ? { basePath: base } : {}) };
      return `import { mount } from ${JSON.stringify(runtimeId)};
const key = '__ANNOTOO_AUTO_MOUNT__';
const instance = window[key] || (window[key] = mount(${scriptJson(mountOptions)}));
if (import.meta.hot) import.meta.hot.dispose(() => {
  if (window[key] === instance) { instance.destroy(); delete window[key]; }
});`;
    },
    configureServer(server) {
      server.watcher.add(commentsDir);
      server.middlewares.use(endpoint, async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          const revision = (body as { revision?: unknown })?.revision;
          if (typeof revision === 'string') res.setHeader('etag', revision);
          res.end(JSON.stringify(body));
        };
        try {
          if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/') { send(404, { error: 'Unknown Annotoo endpoint' }); return; }
          if (req.method === 'GET') { send(200, payload()); return; }
          if (req.method === 'PUT') {
            const origin = req.headers.origin;
            const expectedOrigin = `${server.config.server.https ? 'https' : 'http'}://${req.headers.host}`;
            if ((origin && origin !== expectedOrigin) || req.headers['sec-fetch-site'] === 'cross-site') { send(403, { error: 'Comment writes must come from this development server origin' }); return; }
            const identity = gitIdentity(root);
            if (!identity.identity) { send(403, { error: identity.identityError }); return; }
            // The Git email hash stays the author ID; only the display name can be chosen.
            const actor = { ...identity.identity, name: displayName(req.headers['x-annotoo-name']) ?? identity.identity.name };
            if (!req.headers['if-match']) { send(428, { error: 'A comment revision is required. Refresh comments before saving.' }); return; }
            let requested: unknown;
            try { requested = JSON.parse(await readBody(req)); }
            catch (error) { if (error instanceof RequestError) throw error; throw new RequestError(400, 'Invalid JSON'); }
            const threads = validateThreads(requested);
            const result = await withWriteLock(repository, projectDirectory(commentsDir, project), async () => {
              const snapshot = readSnapshot(repository, file, commentsDir, project);
              if (req.headers['if-match'] !== snapshot.revision) return { status: 409, body: { error: 'Comments changed since you loaded them. Refresh comments before retrying; your draft has not been saved.', revision: snapshot.revision } };
              writeChanges(repository, projectDirectory(commentsDir, project), prepareChanges(snapshot, threads, actor, project, collaborators(root, snapshot)));
              return { status: 200, body: payload() };
            });
            send(result.status, result.body);
            return;
          }
          res.setHeader('allow', 'GET, PUT');
          send(405, { error: 'Method not allowed' });
        } catch (error) { send(error instanceof RequestError ? error.status : 500, { error: error instanceof Error ? error.message : String(error) }); }
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        const tags = [];
        if (ctx.server) {
          tags.push({ tag: 'script', children: `window.__ANNOTOO_DEV__=${scriptJson({ endpoint })};`, injectTo: 'head-prepend' as const });
        } else {
          const { annotations, deletedIds } = readSnapshot(repository, file, commentsDir, project);
          tags.push({ tag: 'script', children: `window.__ANNOTOO_COMMENTS__=${scriptJson({ annotations, deletedIds })};`, injectTo: 'head-prepend' as const });
        }
        if (options.autoMount !== false) tags.push({ tag: 'script', attrs: { type: 'module', src: bootId }, injectTo: 'head' as const });
        return tags;
      },
    },
    // Polling reads collaborator changes; skip reloads so in-progress replies survive file updates.
    handleHotUpdate(ctx) {
      if (ctx.file === commentsDir || ctx.file.startsWith(commentsDir + sep)) return [];
    },
  };
}
