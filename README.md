<img src="docs/logo.png" alt="" width="96" />

# Annotoo

**Annotations and discussions beside your prototype's UI.** Point at an element,
leave a note, and reply or resolve with your team. Threads travel with your code
through Git; optionally publish a read-only review copy.

[Live demo](https://staple-lab.github.io/annotoo/demo/) ·
[Documentation](https://staple-lab.github.io/annotoo/) ·
[API](https://staple-lab.github.io/annotoo/api)

![A discussion beside the prototype](docs/screenshots/threads.jpg)

## One package, any framework

Install the [v0.4.0 release package](https://github.com/staple-lab/annotoo/releases/tag/v0.4.0):

```bash
npm install https://github.com/staple-lab/annotoo/releases/download/v0.4.0/staplelab-annotoo-0.4.0.tgz
```

Add Annotoo to your Vite config. It starts automatically in development, saves threads
in `.annotoo.comments/`, and stays out of production builds by default. No component,
browser setup or empty annotation file is needed.

### JavaScript · `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import annotoo from '@staplelab/annotoo/vite';

export default defineConfig({
  plugins: [annotoo()],
});
```

### React · `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import annotoo from '@staplelab/annotoo/vite';

export default defineConfig({
  plugins: [react(), annotoo()],
});
```

### Vue · `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import annotoo from '@staplelab/annotoo/vite';

export default defineConfig({
  plugins: [vue(), annotoo()],
});
```

Keep your existing plugins. Run your usual development command and open the cockatoo tab.

## Collaborate

Set your own Git identity in the repository:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

Open the cockatoo tab, select an element, and save a note with **⌘ Enter** on Mac or
**Ctrl Enter**. Open its thread to reply, resolve or reopen.
The **Open**, **Resolved** and **All** filters keep completed discussions accessible.

Each note shows who created it, from their Git identity. Contributions retain their
authors; resolution retains its history.
Names and hashed email IDs are stored with discussions. Raw emails are not published.
Git identity provides attribution, not authentication.

Commit `.annotoo.comments/`, then pull and push using your team's usual workflow.
Browsers on one dev server refresh from its files; separate clones exchange comments
through commits. Annotoo never commits or pushes for you. Concurrent edits to the same
thread may need a Git merge. See the [collaboration guide](docs/collaboration.md).

## Publish a review copy

Opt in to a read-only snapshot in your Vite config:

```ts
annotoo({ build: 'viewer' })
```

The build includes the widget and discussions. Rebuild and deploy to publish changes.
Hosted viewers need no backend or account. Browser-local edits do not update Git or
other visitors' copies. The public demo uses fictional contributors.

## Plain HTML

```html
<script src="https://staple-lab.github.io/annotoo/releases/v0.4.0/annotoo.js"></script>
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
