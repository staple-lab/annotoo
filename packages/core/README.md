# @staplelab/annotoo

Annotate elements in your prototype, discuss changes, and assign the next step. One browser API works with plain JavaScript, React, Vue, and other frameworks.

## Install v0.2.0

The initial release is distributed as GitHub release packages. Install the archive, then import by package name:

```sh
npm install https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-annotoo-0.2.0.tgz
```

## Development only with Vite

Add this once in your browser entry point, after starting your app and outside components:

```ts
if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount({ mode: 'author' });
  import.meta.hot?.dispose(() => instance.destroy());
}
```

Without a storage adapter, author mode saves in this browser. To share discussions through Git, install the optional plugin:

```sh
npm install -D https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-vite-plugin-annotoo-0.2.0.tgz
```

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

Use both guards for development only. An unconditional plugin embeds thread data in production HTML even when the widget is absent. For an intentional hosted review copy, enable the plugin for builds and call `mount()` without the development guard; automatic mode shows the embedded discussions read-only.

The package includes TypeScript types, an ES module entry point, and `dist/annotoo.js` for a self-starting script tag. It has no runtime dependencies. Browser initialization belongs in your framework's client entry, including in server-rendered apps.

See the [setup guide](https://github.com/staple-lab/annotoo#readme) for framework examples, Git identity, custom storage, and sharing. Licensed under MIT; see [LICENSE](./LICENSE).
