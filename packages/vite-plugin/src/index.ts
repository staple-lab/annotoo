import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';

export type AnnotooPluginOptions = {
  /** Annotations file, relative to the Vite root. Default `src/annotoo.annotations.json`. */
  file?: string;
  /** Endpoint the widget talks to. Must match the widget's `endpoint`. Default `/__annotoo/annotations`. */
  endpoint?: string;
};

const MAX_BODY = 5 * 1024 * 1024;

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        fail(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

function looksLikeAnnotations(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as { id?: unknown }).id === 'string' &&
        typeof (c as { body?: unknown }).body === 'string' &&
        typeof (c as { anchor?: unknown }).anchor === 'object',
    )
  );
}

export function serialize(annotations: unknown[]): string {
  return JSON.stringify(annotations, null, 2) + '\n';
}

/**
 * Serves `GET`/`PUT` on the Annotoo endpoint during `vite dev`, reading and writing a JSON
 * file you commit. Import that file in your app and pass it to `<Annotoo annotations={…} />`:
 * the production build then carries your annotations wherever it's deployed.
 */
export default function annotoo(options: AnnotooPluginOptions = {}): Plugin {
  const endpoint = options.endpoint ?? '/__annotoo/annotations';
  let file = '';
  let root = '';
  let lastWritten: string | null = null;

  const ensureFile = () => {
    if (existsSync(file)) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '[]\n');
  };

  return {
    name: 'annotoo',

    configResolved(config) {
      root = config.root;
      file = resolve(root, options.file ?? 'src/annotoo.annotations.json');
      // Create it up front so `import annotations from './annotoo.annotations.json'` never fails.
      ensureFile();
    },

    configureServer(server) {
      server.middlewares.use(endpoint, async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(body));
        };
        try {
          if (req.method === 'GET') {
            ensureFile();
            const raw = readFileSync(file, 'utf8');
            const parsed: unknown = raw.trim() ? JSON.parse(raw) : [];
            send(200, { annotoo: 1, file: relative(root, file), annotations: Array.isArray(parsed) ? parsed : [] });
            return;
          }
          if (req.method === 'PUT') {
            let parsed: unknown;
            try {
              parsed = JSON.parse(await readBody(req));
            } catch {
              send(400, { error: 'invalid JSON' });
              return;
            }
            if (!looksLikeAnnotations(parsed)) {
              send(400, { error: 'expected an array of annotations' });
              return;
            }
            const text = serialize(parsed);
            lastWritten = text;
            writeFileSync(file, text);
            send(200, { ok: true, count: parsed.length });
            return;
          }
          res.setHeader('allow', 'GET, PUT');
          send(405, { error: 'method not allowed' });
        } catch (err) {
          send(500, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },

    // Dev only: tell the widget a Annotoo endpoint exists, so production builds never
    // probe for one (no stray 404s in viewers' consoles).
    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        if (!ctx.server) return;
        return [
          {
            tag: 'script',
            children: `window.__ANNOTOO_DEV__=${JSON.stringify({ endpoint })};`,
            injectTo: 'head-prepend',
          },
        ];
      },
    },

    // The widget already has the annotations it just saved; don't let Vite hot-reload the app
    // because of our own write. Hand edits to the file still trigger HMR as normal.
    handleHotUpdate(ctx) {
      if (ctx.file !== file || lastWritten === null) return;
      try {
        if (readFileSync(file, 'utf8') === lastWritten) return [];
      } catch {
        /* fall through to default handling */
      }
    },
  };
}
