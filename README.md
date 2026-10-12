# Notate

A tiny, framework-agnostic **review-comment widget**. Drop it into any HTML page, pin
comments to elements, then export a **single self-contained `.html`** with your comments
baked in — upload that one file to the hub and teammates open it and read your feedback.
No backend, no build step for viewers, nothing to install.

Think *agentation for your team* instead of for an AI agent.

## How it works

- **You (author):** add the widget to a page, click elements to leave notes, hit
  **Bundle for Hub** → downloads `yourpage-notated.html`.
- **Your team (viewers):** open that file (or its hub URL). They see numbered pins and a
  comments panel. Read-only — nothing to set up.

Comments travel *inside* the exported file, so it works on static hosting like
`hub.ofload.com`.

## Build the widget

```bash
npm install
npm run build      # → dist/notate.js  (single self-contained bundle)
```

`dist/notate.js` is the only artifact you need. The build inlines a copy of itself so the
exported page can boot with zero network requests.

## Add it to a page while authoring

**Option A — script tag** (for pages you're building):

```html
<script src="notate.js"></script>   <!-- before </body>, author-time only -->
```

**Option B — bookmarklet** (inject into any already-open page): see
[`bookmarklet.md`](./bookmarklet.md).

Then:

1. Type your name in the toolbar (bottom-left).
2. Click **💬 Comment**, then click any element and write a note.
3. Click a pin anytime to edit or delete it.
4. Click **⬆ Bundle for Hub** to download the shareable file.
5. Upload that file to the hub (hosting is provisioned by Josh — see Highway's `REFERENCE.md`).

## Modes

The widget picks its role automatically:

| Situation | Mode |
| --- | --- |
| Page has baked-in comments (an exported file) | **Viewer** (read-only) |
| No baked-in comments | **Author** |
| `?notate=author` in the URL | force **Author** |
| `?notate=off` in the URL | don't boot |

## Develop

```bash
npm run dev        # Vite dev server with the demo page (index.html)
npm test           # vitest — anchoring unit tests
npm run lint
```

> In `npm run dev` the bundle can't inline itself, so **Bundle for Hub** falls back to
> referencing `notate.js`. To test the fully self-contained export, run `npm run build`
> and load `dist/notate.js` on a page.

## Design notes

- **Isolation:** all UI lives in a Shadow DOM, so it never collides with the host page's
  styles or framework.
- **Anchoring:** each comment stores a CSS selector + a text snippet + a normalized click
  offset. On load it re-finds the element; if the page changed and it can't, the comment
  drops into an **Unanchored** list so nothing is lost. (Unit-tested in `anchor.test.ts`.)
- **Zero runtime dependencies.**

## Not built yet (fast-follow)

- "Copy for Claude" markdown export (selectors + notes) to action your own review with Claude Code.
- Category filtering, keyboard navigation, collaborative replies (would need a backend).
