# @staplelab/vite-plugin-annotoo

Save Annotoo discussion threads in your Git repository during Vite development. Threads support replies, assignment, and resolution history. Builds can include a read-only discussion snapshot when explicitly enabled.

## Install v0.2.0

The initial release is distributed as GitHub release packages. Use an existing Vite project (Vite 5 or later):

```sh
npm install https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-annotoo-0.2.0.tgz
npm install -D https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-vite-plugin-annotoo-0.2.0.tgz
```

## Development only

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import annotoo from '@staplelab/vite-plugin-annotoo';

export default defineConfig(({ command }) => ({
  plugins: [
    // Keep your existing framework plugins here.
    ...(command === 'serve' ? [annotoo()] : []),
  ],
}));
```

Mount the widget once from your browser entry point, outside framework components:

```ts
if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount();
  import.meta.hot?.dispose(() => instance.destroy());
}
```

Both guards are necessary: the plugin embeds thread data in production HTML if enabled for builds, even without the widget. To publish a review copy intentionally, enable `annotoo()` for builds and mount the widget without the development guard. Automatic mode uses the Git endpoint during development and a read-only snapshot in production.

## Git collaboration

Configure your own `git config user.name` and `git config user.email`. Names are shown on comments; emails are hashed into IDs. This provides local attribution, not verified authentication.

Threads are separate JSON files under `.annotoo.comments/` at the Git root, scoped to each Vite project. Commit and exchange them with normal Git pull and push. Existing `src/annotoo.annotations.json` data remains supported. The plugin never commits or pushes for you. Assignment choices come from local Git history and saved discussion participants; the directory is available only through the development endpoint.

Optional configuration: `annotoo({ file, commentsDir, endpoint })`. Paths are relative to the Vite root for `file` and Git root for `commentsDir`. The default endpoint is `/__annotoo/annotations`.

See the [collaboration guide](https://github.com/staple-lab/annotoo/blob/main/docs/collaboration.md). This package is an ES module and includes TypeScript declarations. Licensed under MIT; see [LICENSE](./LICENSE).
