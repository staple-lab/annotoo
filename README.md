<img src="docs/logo.png" alt="" width="96" />

# Annotoo

**Annotations and discussions beside your prototype's UI.** Point at an element,
leave a note, and reply, assign or resolve with your team. Threads travel with your code
through Git; published prototypes show a read-only snapshot.

[Live demo](https://staple-lab.github.io/annotoo/demo/) ·
[Documentation](https://staple-lab.github.io/annotoo/) ·
[API](https://staple-lab.github.io/annotoo/api)

![A discussion beside the prototype](docs/screenshots/threads.jpg)

## One package, any framework

Install the [v0.2.0 release package](https://github.com/staple-lab/annotoo/releases/tag/v0.2.0):

```bash
npm install https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-annotoo-0.2.0.tgz
```

Call `mount()` once from your browser entry point, outside components. These Vite
examples load the widget only in development and clean up on hot reload.

### JavaScript · `src/main.js`

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

Without the plugin below, author mode saves only in this browser. In server-rendered
apps, initialize in the browser entry. `process.dev` is not standard; use
`process.env.NODE_ENV` only where your bundler supports it.

## Optional: save threads in Git

```bash
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

**Development only needs both guards:** `import.meta.env.DEV` removes the widget;
`command === 'serve'` prevents the plugin embedding thread data in production HTML.

The plugin saves one file per thread in `.annotoo.comments/`, grouped by app.
It preserves existing `src/annotoo.annotations.json` notes and creates an empty file
if needed. Commit both with your prototype.

## Collaborate

Set your own Git identity in the repository:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

Open the cockatoo tab, select an element, and save a note with **⌘ Enter** on Mac or
**Ctrl Enter**. Open its thread to reply, assign, unassign, resolve or reopen.
The **Open**, **Resolved** and **All** filters keep completed discussions accessible.

![Assigning a thread to a teammate](docs/screenshots/assignment.jpg)

Assignees come from your Git identity, local Git history and stored thread participants.
Contributions retain their authors; assignment and resolution retain their history.
Names and hashed email IDs are stored with discussions. Raw emails are not published.
Git identity provides attribution, not authentication.

Commit `.annotoo.comments/`, then pull and push using your team's usual workflow.
Browsers on one dev server refresh from its files; separate clones exchange comments
through commits. Annotoo never commits or pushes for you. Concurrent edits to the same
thread may need a Git merge. See the [collaboration guide](docs/collaboration.md).

## Publish a review copy

To include discussions in a deployed prototype, deliberately enable the plugin for builds:

```ts
// vite.config.ts — keep the imports and your existing framework plugins
export default defineConfig({
  plugins: [annotoo()],
});
```

Replace the guarded bootstrap block with:

```ts
import { mount } from '@staplelab/annotoo';
import annotations from './annotoo.annotations.json';

const instance = mount({ annotations });
import.meta.hot?.dispose(() => instance.destroy());
```

Development uses author mode; builds embed a read-only snapshot. Rebuild and deploy to
publish changes. Hosted viewers need no backend or account. Browser-local edits do not
update Git or other visitors' copies. The public demo uses fictional contributors.

## Plain HTML

```html
<script src="https://staple-lab.github.io/annotoo/releases/v0.2.0/annotoo.js"></script>
```

The script starts automatically and saves in your browser. **Export HTML** creates a
self-contained, read-only copy. Use the [bookmarklet](docs/bookmarklet.md) on pages you
cannot edit.

## More

- [API and custom storage](https://staple-lab.github.io/annotoo/api)
- [Thread schema](https://staple-lab.github.io/annotoo/schema)
- [Toolbar, shortcuts and display settings](https://staple-lab.github.io/annotoo/features)
- [Contributing and local development](CONTRIBUTING.md)

MIT © Staple Lab · Inspired by [agentation](https://www.agentation.com/).
