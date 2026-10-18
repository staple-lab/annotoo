<img src="docs/logo.png" alt="" width="96" />

# Annotoo

**Figma-style annotations for code prototypes.** Point at any element in your prototype
and explain it: what it does, where its data comes from, what's still fake. Ship it, and
anyone who opens the hosted prototype sees the notes beside the UI they describe, like
Figma Dev Mode annotations but on the real, clickable thing.

A small cockatoo tab at the bottom of the page opens a toolbar where you add
annotations, show or hide them, and change settings.

- **Annotations live beside the UI.** Each annotated element gets an outline, a numbered
  badge, and a note joined to it by a connector. Notes stack so they don't overlap.
- **Five categories, colour-coded:** Note, Interaction, Content, Accessibility,
  Development. Each note can have an optional title.
- **Stored in your repo** as `annotoo.annotations.json`, so they're diffable, reviewable
  and versioned with the prototype.
- **Read-only when hosted,** with no backend, accounts or extra network requests.
- **Viewer settings:** show notes always, on hover, or as numbers only; outlines on or
  off; light, dark or auto theme; toolbar on the left or right. Each viewer's choices are
  remembered.
- **Isolated.** All UI lives in a Shadow DOM, so it can't clash with your app's CSS or
  framework. There are no runtime dependencies.

## Install with Claude Code or Codex

Run one of these in your project folder and the agent sets Annotoo up for you:

```bash
# Claude Code
claude "Add Annotoo (https://github.com/staple-lab/annotoo) to this project so I can annotate the prototype. Use the package manager the project already uses. If it's React + Vite: install @staplelab/annotoo-react, install @staplelab/vite-plugin-annotoo as a dev dependency, add annotoo() to the plugins in vite.config, create src/annotoo.annotations.json containing [] if it doesn't exist, and render <Annotoo annotations={annotations} /> once in the root component, importing annotations from that file. If it's Next.js: install @staplelab/annotoo-react and render <Annotoo annotations={annotations} mode={process.env.NODE_ENV === 'development' ? 'author' : 'viewer'} /> in app/layout.tsx. If it's plain HTML: add <script src=\"https://unpkg.com/@staplelab/annotoo/dist/annotoo.js\"></script> just before </body>. Don't change anything else. When you're done, tell me how to start it and open the annotation toolbar."

# Codex
codex "Add Annotoo (https://github.com/staple-lab/annotoo) to this project so I can annotate the prototype. Use the package manager the project already uses. If it's React + Vite: install @staplelab/annotoo-react, install @staplelab/vite-plugin-annotoo as a dev dependency, add annotoo() to the plugins in vite.config, create src/annotoo.annotations.json containing [] if it doesn't exist, and render <Annotoo annotations={annotations} /> once in the root component, importing annotations from that file. If it's Next.js: install @staplelab/annotoo-react and render <Annotoo annotations={annotations} mode={process.env.NODE_ENV === 'development' ? 'author' : 'viewer'} /> in app/layout.tsx. If it's plain HTML: add <script src=\"https://unpkg.com/@staplelab/annotoo/dist/annotoo.js\"></script> just before </body>. Don't change anything else. When you're done, tell me how to start it and open the annotation toolbar."
```

Using another agent? Paste it this prompt:

> Add Annotoo (https://github.com/staple-lab/annotoo) to this project so I can annotate the prototype. Use the package manager the project already uses. If it's React + Vite: install @staplelab/annotoo-react, install @staplelab/vite-plugin-annotoo as a dev dependency, add annotoo() to the plugins in vite.config, create src/annotoo.annotations.json containing [] if it doesn't exist, and render <Annotoo annotations={annotations} /> once in the root component, importing annotations from that file. If it's Next.js: install @staplelab/annotoo-react and render <Annotoo annotations={annotations} mode={process.env.NODE_ENV === 'development' ? 'author' : 'viewer'} /> in app/layout.tsx. If it's plain HTML: add <script src="https://unpkg.com/@staplelab/annotoo/dist/annotoo.js"></script> just before </body>. Don't change anything else. When you're done, tell me how to start it and open the annotation toolbar.

## Quick start (React + Vite)

```bash
npm i @staplelab/annotoo-react
npm i -D @staplelab/vite-plugin-annotoo
```

```ts
// vite.config.ts
import annotoo from '@staplelab/vite-plugin-annotoo';

export default defineConfig({
  plugins: [react(), annotoo()], // creates src/annotoo.annotations.json
});
```

```tsx
// App.tsx
import { Annotoo } from '@staplelab/annotoo-react';
import annotations from './annotoo.annotations.json';

export function App() {
  return (
    <>
      {/* …your prototype… */}
      <Annotoo annotations={annotations} />
    </>
  );
}
```

| Where | What you get |
| --- | --- |
| `vite dev` | **Author mode.** Click the cockatoo tab (Annotate switches on), click any element, pick a category, write the note and press <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd>. Each change saves straight into `src/annotoo.annotations.json`. Click a note to edit it. |
| `vite build` → hosted anywhere | **Viewer mode.** Everyone sees the annotations and can hide them, list them and change how they're displayed, but can't edit them. |

Commit `annotoo.annotations.json` with your prototype. Hosting under a sub-path (for
example `example.com/s/my-proto/`) works without any config.

## Quick start (any HTML page)

```html
<script src="https://unpkg.com/@staplelab/annotoo/dist/annotoo.js"></script>
```

On a plain page Annotoo saves to your browser's localStorage. When you're done, use
**Export HTML** in the toolbar to download one self-contained `.html` file with the page,
your annotations and the widget inlined. Host that file anywhere and viewers get
read-only annotations. A [bookmarklet](docs/bookmarklet.md) lets you do the same on pages
you can't edit.

## The toolbar

| Button | |
| --- | --- |
| Annotate *(author)* | On as soon as you open the toolbar. Pick an element to annotate, or click a note to edit it; the page doesn't react to clicks while this is on. With it off, notes are locked and a click only selects them. <kbd>Esc</kbd> or the button turns it off. |
| Show / hide | Hide every annotation, leaving only the cockatoo tab. |
| List | All annotations on this page, plus ones on other pages and any whose element has gone missing. |
| Settings | Note display (always / on hover / numbers only), outlines, theme, toolbar position, and (author only) delete all. |
| Copy as Markdown *(author)* | Puts the annotations on your clipboard as Markdown, ready to paste into a ticket, a doc or a chat. |
| Cockatoo | Opens the toolbar; click it again to fold the toolbar back into the tab. Drag it to any corner of the screen to move it there (also in Settings). |

Keyboard shortcuts (also listed in Settings, and ignored while you type in a text field):

| Shortcut | |
| --- | --- |
| <kbd>⌥</kbd>+<kbd>A</kbd> / <kbd>Alt</kbd>+<kbd>A</kbd> *(author)* | Open the toolbar and switch Annotate on or off. |
| <kbd>⌥</kbd>+<kbd>H</kbd> / <kbd>Alt</kbd>+<kbd>H</kbd> | Show or hide all annotations. |
| <kbd>Esc</kbd> | Step back: close the editor, a popover, or Annotate. |

URL overrides: `?annotoo=author`, `?annotoo=viewer`, `?annotoo=off`.

## Making anchors bulletproof

Annotoo attaches each annotation with a CSS path plus a text snippet, which survives most
edits. For elements you'll rework a lot, add a stable hook:

```tsx
<section data-annotoo-id="revenue-card">…</section>
```

Annotations on that element, or anything inside it, are then anchored to it. Ids
generated at runtime (React `useId`, Radix, Headless UI and so on) are ignored
automatically. If an element really disappears, its annotation moves to the
**Unanchored** list instead of being lost.

## API

### `<Annotoo />` / `mount(options)`

The React component takes the same options as the framework-free `mount()` from
`@staplelab/annotoo`:

| Option | Default | |
| --- | --- | --- |
| `annotations` | `[]` | Annotations to show (viewer) or start from (author). |
| `mode` | `'auto'` | `'auto'` uses author mode under `vite dev` with the plugin and viewer mode everywhere else. Can be `'author'` or `'viewer'`. |
| `display` | `'always'` | Default note display: `'always'`, `'hover'` or `'markers'`. Viewers can change it in Settings. |
| `outlines` | `true` | Default for outlining annotated elements. |
| `theme` | `'auto'` | `'auto'`, `'light'` or `'dark'`. |
| `position` | `'bottom-right'` | Any corner: `'bottom-left'`, `'top-right'` or `'top-left'`. Viewers can change it in Settings or by dragging the tab. |
| `route` | path-based | How annotations are scoped to pages. `false` shows them on every page; a function returns a custom key (e.g. `() => location.hash` for hash routers). |
| `basePath` | (none) | Prefix your app is served under, if you'd rather be explicit. |
| `storage` | dev plugin, else localStorage | Custom author storage: `{ load(), save(annotations) }`. |
| `shortcuts` | `true` | ⌥A / Alt+A annotate, ⌥H / Alt+H show or hide. `false` turns them off; <kbd>Esc</kbd> always works. |
| `actions` | `[]` | Extra author toolbar buttons: `{ label, icon, run(annotations) }`. |
| `onChange` | (none) | Called with the full list after every author change. |
| `disabled` | `false` | React only: don't mount. |

### Annotation format

```ts
type Annotation = {
  id: string;
  n: number;                // number shown on the badge
  anchor: { selector: string; textSnippet: string; offset: { x: number; y: number } };
  title?: string;
  body: string;
  category?: 'note' | 'interaction' | 'content' | 'accessibility' | 'development';
  route?: string;           // page it belongs to; omitted = every page
  createdAt: number;
  updatedAt?: number;
};
```

### `@staplelab/vite-plugin-annotoo`

```ts
annotoo({
  file: 'src/annotoo.annotations.json', // relative to the Vite root
  endpoint: '/__annotoo/annotations',   // must match the widget's `endpoint`
});
```

The plugin only adds the dev-server endpoint and a one-line hint to `index.html` during
`vite dev`. It has no effect on your production build.

### Not using Vite?

Use `<Annotoo mode="author" />` locally. Annotations then save to localStorage. To keep
them in your repo or share them, implement `storage` against any backend you like.

## Packages

| Package | |
| --- | --- |
| [`@staplelab/annotoo`](packages/core) | Framework-free core: `mount()`, the script-tag build, storage adapters. |
| [`@staplelab/annotoo-react`](packages/react) | `<Annotoo />` for React 17+. Works in Next.js too (`"use client"` is included). |
| [`@staplelab/vite-plugin-annotoo`](packages/vite-plugin) | Dev-server endpoint that writes annotations into your repo. |

## Development

```bash
pnpm install
pnpm dev          # builds packages, runs the example prototype with the dev plugin
pnpm test         # unit tests (vitest + jsdom)
pnpm e2e          # Playwright: dev authoring, sub-path hosted viewer, static export
pnpm lint && pnpm typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © Staple Lab

Inspired by [agentation](https://www.agentation.com/).
