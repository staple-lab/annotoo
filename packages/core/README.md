# @staplelab/annotoo

Annotate your prototype, discuss changes, and assign the next step. One package includes
both the browser widget and Vite integration.

```sh
npm install https://github.com/staple-lab/annotoo/releases/download/v0.4.0/staplelab-annotoo-0.4.0.tgz
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import annotoo from '@staplelab/annotoo/vite';

export default defineConfig({
  plugins: [annotoo()], // keep your existing framework plugins too
});
```

The plugin mounts the widget in development and saves threads in `.annotoo.comments/`.
Production builds contain neither the widget nor discussion data by default. Use
`annotoo({ build: 'viewer' })` to publish a read-only review snapshot.

Configure your Git name and email before writing comments. Commit the thread files and
share through normal Git pull and push. Stored identities include names and hashed IDs,
not raw emails. Existing `annotoo.annotations.json` files remain supported; new projects
need no annotation file or browser initialization.

## Browser API

For non-Vite integrations, import `mount` from `@staplelab/annotoo` and call
`mount({ mode: 'author' })` once in a browser entry point. Without a custom storage adapter,
changes stay in that browser. Use your framework's development flag to limit loading.
The standalone `dist/annotoo.js` script starts automatically.

Advanced Vite integrations can set `autoMount: false` and initialize `mount()` manually.
The package includes TypeScript types; the browser widget has no runtime dependencies.

[Setup and framework examples](https://annotoo.staplelab.com/install) ·
[API](https://annotoo.staplelab.com/api) · [MIT license](./LICENSE)
