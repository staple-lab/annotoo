import { mkdirSync, realpathSync } from 'node:fs';
import { relative, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { assertSafePath, collaborators, ensureLegacy, gitIdentity, gitRoot, prepareChanges, projectDirectory, readSnapshot, relativePath, RequestError, validateThreads, withWriteLock, writeChanges } from './storage';

export type AnnotooPluginOptions = {
  /** Legacy annotations file, relative to the Vite root. Default `src/annotoo.annotations.json`. Kept for existing imports. */
  file?: string;
  /** Git-tracked thread directory, relative to the Git repository root (or Vite root outside Git). Default `.annotoo.comments`. */
  commentsDir?: string;
  /** Endpoint the widget talks to. Must match the widget's `endpoint`. Default `/__annotoo/annotations`. */
  endpoint?: string;
};
const MAX_BODY = 5 * 1024 * 1024;
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

/** Git-backed review threads during development, with a read-only snapshot embedded in production builds. */
export default function annotoo(options: AnnotooPluginOptions = {}): Plugin {
  const endpoint = options.endpoint ?? '/__annotoo/annotations';
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || /[?#\s<>]/.test(endpoint)) throw new Error('[annotoo] endpoint must be a same-origin URL path');
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
    configResolved(config) {
      root = realpathSync(config.root);
      repository = gitRoot(root);
      project = relative(repository, root).split(sep).join('/') || '.';
      file = relativePath(root, options.file ?? 'src/annotoo.annotations.json', 'file');
      // Validate against the Git root too, so a nested Vite project cannot traverse a symlink.
      assertSafePath(repository, file);
      commentsDir = relativePath(repository, options.commentsDir ?? '.annotoo.comments', 'commentsDir');
      ensureLegacy(repository, file);
      mkdirSync(commentsDir, { recursive: true });
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
            if (!req.headers['if-match']) { send(428, { error: 'A comment revision is required. Refresh comments before saving.' }); return; }
            let requested: unknown;
            try { requested = JSON.parse(await readBody(req)); }
            catch (error) { if (error instanceof RequestError) throw error; throw new RequestError(400, 'Invalid JSON'); }
            const threads = validateThreads(requested);
            const result = await withWriteLock(repository, projectDirectory(commentsDir, project), async () => {
              const snapshot = readSnapshot(repository, file, commentsDir, project);
              if (req.headers['if-match'] !== snapshot.revision) return { status: 409, body: { error: 'Comments changed since you loaded them. Refresh comments before retrying; your draft has not been saved.', revision: snapshot.revision } };
              writeChanges(repository, projectDirectory(commentsDir, project), prepareChanges(snapshot, threads, identity.identity!, project, collaborators(root, snapshot)));
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
        if (ctx.server) return [{ tag: 'script', children: `window.__ANNOTOO_DEV__=${scriptJson({ endpoint })};`, injectTo: 'head-prepend' }];
        const { annotations, deletedIds } = readSnapshot(repository, file, commentsDir, project);
        return [{ tag: 'script', children: `window.__ANNOTOO_COMMENTS__=${scriptJson({ annotations, deletedIds })};`, injectTo: 'head-prepend' }];
      },
    },
    // Polling reads collaborator changes; skip reloads so in-progress replies survive file updates.
    handleHotUpdate(ctx) {
      if (ctx.file === commentsDir || ctx.file.startsWith(commentsDir + sep)) return [];
    },
  };
}
