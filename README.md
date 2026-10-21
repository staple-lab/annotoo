<img src="docs/logo.png" alt="" width="96" />

# Annotoo

**Figma-style annotations for code prototypes.** Point at any element in your prototype
and explain it: what it does, where its data comes from, what's still fake. Ship it, and
anyone who opens the hosted prototype sees the notes beside the UI they describe, like
Figma Dev Mode annotations but on the real, clickable thing.

A small cockatoo tab at the bottom of the page opens a toolbar where you add
annotations, show or hide them, and change settings.

[Open the live prototype demo](https://staple-lab.github.io/annotoo/demo/) ·
[Read the documentation](https://staple-lab.github.io/annotoo/)

The public demo shows a read-only snapshot of the prototype's discussions. Use the
local development setup below to write Git-backed comments.
Its sample names, including Jane Doe, Sam Lee and Alex Rivera, are illustrative identities.

Git-backed collaboration is available on `main`. Until the next npm release, use the
[local development setup](#development) to try the latest thread features.

- **Annotations live beside the UI.** Each annotated element gets an outline, a numbered
  badge, and a note joined to it by a connector. Notes stack so they don't overlap.
- **Five categories, colour-coded:** Note, Interaction, Content, Accessibility,
  Development. Each note can have an optional title.
- **Comment threads in Git.** Reply, resolve and reopen with your Git display name.
  Each thread lives in `.annotoo.comments/`, so discussions are reviewable and versioned
  with the prototype. Existing `annotoo.annotations.json` files still work.
- **Collaborate through your Git workflow.** Clients on the same dev server refresh from
  disk. People in separate clones exchange changes with pull, commit and push.
- **Read-only when hosted,** with no backend, accounts or extra network requests.
- **Viewer settings:** show notes always, on hover, or as numbers only; outlines on or
  off; light, dark or auto theme; toolbar on the left or right. Each viewer's choices are
  remembered.
- **Isolated.** All UI lives in a Shadow DOM, so it can't clash with your app's CSS or
  framework. There are no runtime dependencies.

![A discussion beside the prototype](docs/screenshots/threads.jpg)

![Assigning a thread to a teammate](docs/screenshots/assignment.jpg)

## One package, any framework

Install the same package for plain JavaScript, React or Vue:

```bash
npm install @staplelab/annotoo
```

Call `mount()` **once from your browser entry point**, outside components. It attaches
its own isolated UI to the page. These Vite examples load Annotoo only in development;
the dynamic import inside `import.meta.env.DEV` keeps the widget out of production builds.
The disposal callback removes the old instance when Vite reloads the entry module.
If you add the optional Git plugin, also limit it to development as shown below.

### Plain JavaScript · `src/main.js`

```js
// Start your app first.
if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount({ mode: 'author' });
  import.meta.hot?.dispose(() => instance.destroy());
}
```

### React · `src/main.tsx`

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount({ mode: 'author' });
  import.meta.hot?.dispose(() => instance.destroy());
}
```

### Vue · `src/main.ts`

```ts
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');

if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount({ mode: 'author' });
  import.meta.hot?.dispose(() => instance.destroy());
}
```

There is no framework wrapper or component to render. Without the optional plugin,
author mode saves to this browser's localStorage. That is a personal sandbox, not a
shared comment server.

`process.dev` is not a standard JavaScript development flag. Vite uses
`import.meta.env.DEV`. Use `process.env.NODE_ENV === 'development'` only where your
framework or bundler supports and replaces it; browsers do not supply `process`.
For server-rendered apps, run this browser setup only in the framework's client entry.

## Optional: save discussions in Git

```bash
npm install -D @staplelab/vite-plugin-annotoo
```

```ts
// vite.config.ts — keep your existing framework plugins
import { defineConfig } from 'vite';
import annotoo from '@staplelab/vite-plugin-annotoo';

export default defineConfig(({ command }) => ({
  plugins: [
    // Keep your existing framework plugins here.
    ...(command === 'serve' ? [annotoo()] : []),
  ],
}));
```

The plugin supplies Git identity and saves threads in `.annotoo.comments/` at your
repository root. Each Vite app gets its own project subfolder. It creates
`src/annotoo.annotations.json` containing `[]` if needed and preserves existing notes.

For **development only**, use both guards: the dynamic import above and the plugin's
`command === 'serve'` check. An unconditional plugin embeds thread data into production
HTML even if the widget is not mounted.

For a **published read-only review copy**, deliberately enable the plugin for builds:

```ts
// vite.config.ts — keep the same imports and existing framework plugins
export default defineConfig({
  plugins: [annotoo()],
});
```

Then replace the guarded block with this in the same browser entry point:

```ts
import { mount } from '@staplelab/annotoo';
import annotations from './annotoo.annotations.json';

const instance = mount({ annotations });
import.meta.hot?.dispose(() => instance.destroy());
```

With the plugin, `vite dev` opens author mode. `vite build` embeds the current threads
and opens viewer mode on the hosted page. Rebuild and deploy to publish new discussions.

## Set up with a coding agent

Paste this into Claude Code, Codex, or your preferred agent:

> Add @staplelab/annotoo to this prototype using its existing package manager. Call mount() once from the browser bootstrap, outside components. Use a dynamic import inside import.meta.env.DEV for a Vite development-only setup and destroy the instance in import.meta.hot?.dispose(). Add the optional @staplelab/vite-plugin-annotoo development dependency for Git-backed discussions only when command === 'serve' in defineConfig, preserving existing Vite plugins and annotations. Both guards are required: the plugin otherwise embeds thread data in production HTML even without the widget. Check Git user.name and user.email without inventing an identity. Explain replies, assignment, resolve/reopen and committing .annotoo.comments with normal Git pull and push. Do not commit or push automatically.

### Set your name and collaborate

Git-backed writing needs both a name and an email in this repository's Git configuration.
Check them with `git config user.name` and `git config user.email`. If either is missing,
set your own values:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

Annotoo shows your Git name and derives a stable author ID from a hash of your configured
email. The raw email is not included in comment files or the deployed snapshot. This is
local attribution, not authentication: Git configuration does not verify who someone is.

Assign a thread to a teammate to make the next owner clear; unassign it when no one owns
the next step. Assignment and status changes stay in the thread history. The picker
uses your current Git identity, authors from local Git history, and participants already
stored in threads. These are names and hashed IDs, not a published directory of raw
emails. Hosted viewers can read the stored assignee but cannot change it.

Open a note with **Open thread**, add a reply, and choose **Resolve thread** when the
discussion is done. **Reopen thread** keeps it active again. Replies and resolution
events remain in the history. The list has **Open**, **Resolved** and **All** filters;
resolved threads leave the page's open pins without being deleted.

Two browsers on the same development server refresh from the same files. For teammates
in separate clones, save your work, commit `.annotoo.comments/`, pull the team's changes
and push as usual. Annotoo never commits or pushes for you. Changes to different thread
files can merge independently; concurrent edits to the same thread may need a normal Git
conflict resolution. See the [collaboration walkthrough](docs/collaboration.md).

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
| List | Threads on this page, on other pages, and with missing elements. Filter by Open, Resolved or All; open an item to read the discussion. |
| Open thread | Read the note, authors, replies and resolution history. Authors can reply, resolve and reopen. Hosted viewers can read the discussion. |
| Settings | Note display (always / on hover / numbers only), outlines, theme, toolbar position, and (author only) delete all. |
| Copy as Markdown *(author)* | Puts annotations, authors, replies and resolution history on your clipboard, ready to paste into a ticket, a doc or a chat. |
| Cockatoo | Opens the toolbar; click it again to fold the toolbar back into the tab. Drag it to any corner of the screen to move it there (also in Settings). |

Keyboard shortcuts (also listed in Settings, and ignored while you type in a text field):

| Shortcut | |
| --- | --- |
| <kbd>⌥</kbd>+<kbd>A</kbd> / <kbd>Alt</kbd>+<kbd>A</kbd> *(author)* | Open the toolbar and switch Annotate on or off. |
| <kbd>⌥</kbd>+<kbd>H</kbd> / <kbd>Alt</kbd>+<kbd>H</kbd> | Show or hide all annotations. |
| <kbd>Esc</kbd> | Step back: close the editor, a popover, or Annotate. |

URL overrides: `?annotoo=author`, `?annotoo=viewer`, `?annotoo=off`.
On a hosted build, an explicit author override is a personal browser-only copy. It
cannot write to Git or change the discussion that other visitors see.

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

### `mount(options)`

Import `mount` from `@staplelab/annotoo` and call it once in your browser bootstrap:

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
  author?: { id: string; name: string };
  updatedBy?: { id: string; name: string };
  assignee?: { id: string; name: string }; // omitted = unassigned
  replies?: {
    id: string;
    body: string;
    author: { id: string; name: string };
    createdAt: number;
  }[];
  status?: 'open' | 'resolved'; // omitted = open
  resolvedAt?: number;
  resolvedBy?: { id: string; name: string };
  events?: {
    id: string;
    type: 'resolved' | 'reopened' | 'assigned' | 'unassigned';
    assignee?: { id: string; name: string }; // assignment event target
    author: { id: string; name: string };
    createdAt: number;
  }[];
};
```

All discussion fields are optional. Older annotations without authors or status remain
valid. Git stores each thread as `<project-hash>/<thread-id>.json` in a versioned envelope:

```ts
type ThreadFile = {
  schemaVersion: 1;
  project: string; // repo-relative Vite root, e.g. 'examples/vite-react' or '.'
  thread: Annotation;
  deleted?: true; // a retained deletion record, including for legacy annotations
};
```

The project directory is the first 16 characters of its SHA-256 hash. The project,
thread's route and element anchor together locate the discussion in a monorepo.
Filename-safe thread IDs are used directly. An older ID with unsafe filename characters
keeps its original value inside the thread and uses `legacy-<sha256-of-id>.json` on disk.

### `@staplelab/vite-plugin-annotoo`

```ts
annotoo({
  file: 'src/annotoo.annotations.json', // relative to the Vite root
  commentsDir: '.annotoo.comments',    // relative to the Git repo root, else Vite root
  endpoint: '/__annotoo/annotations',   // must match the widget's `endpoint`
});
```

During development the plugin reads legacy annotations and thread files, supplies Git
attribution, and saves changes to the thread directory. During a build it embeds the
merged thread snapshot, so existing annotation imports keep working. The deployed
viewer needs no backend, Git credentials or write endpoint. Rebuild and deploy to share
later Git changes with hosted viewers.

### Not using Vite?

Use `mount({ mode: 'author' })` locally. Annotations then save to localStorage. To keep
them elsewhere, implement `storage`. The Git thread workflow is provided by the Vite
plugin; plain HTML and browser storage do not synchronize separate contributors.

## Packages

| Package | |
| --- | --- |
| [`@staplelab/annotoo`](packages/core) | Framework-free core: `mount()`, the script-tag build, storage adapters. |
| [`@staplelab/vite-plugin-annotoo`](packages/vite-plugin) | Git-backed thread storage in development and a read-only discussion snapshot in builds. |

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
