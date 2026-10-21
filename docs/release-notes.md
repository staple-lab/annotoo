# Annotoo 0.3.0

One package and one Vite config entry. Annotoo now starts automatically in development,
saves Git-backed discussions, and stays out of production builds by default.

```sh
npm install https://github.com/staple-lab/annotoo/releases/download/v0.3.0/staplelab-annotoo-0.3.0.tgz
```

```ts
import annotoo from '@staplelab/annotoo/vite';

// Add to your existing Vite plugins:
annotoo()
```

- Use `annotoo({ build: 'viewer' })` to deliberately publish a read-only discussion snapshot.
- New projects need no browser initialization or empty annotation JSON.
- Existing threads, authors, replies, assignments and legacy annotation files remain compatible.
- The browser `mount()` API remains available for non-Vite and advanced integrations.

## Migrate from 0.2.0

1. Install the new package and remove `@staplelab/vite-plugin-annotoo` from your dependencies.
2. Change the plugin import to `@staplelab/annotoo/vite` and use `annotoo()` in your existing plugins.
3. Remove the manual browser `mount()` call and its annotation import; the plugin now initializes the widget.
4. Remove the old development-only plugin guard. Default configuration already excludes production output.
5. If you publish review copies, set `build: 'viewer'`. Keep `.annotoo.comments/` and existing legacy annotation files.

For custom browser initialization, set `autoMount: false` and keep one manual `mount()` call.

Assets include one installable package, the standalone browser script, and SHA-256 checksums.
This release is distributed through GitHub Releases.

[Installation](https://staple-lab.github.io/annotoo/install) · [Live demo](https://staple-lab.github.io/annotoo/demo/)
