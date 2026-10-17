# Contributing to Annotoo

Thanks for helping. Annotoo is small on purpose, so please open an issue before starting a
large change.

## Setup

```bash
pnpm install
pnpm dev            # example prototype at http://localhost:5173 (author mode)
```

Layout:

- `packages/core`: everything that renders. Vanilla TypeScript in a Shadow DOM, with no
  runtime dependencies. `src/widget.ts` holds the toolbar, editor, list and settings;
  `src/layer.ts` draws annotations (outline, badge, connector, note) and lays them out;
  `src/anchor.ts` re-finds elements; `src/router.ts` scopes annotations to pages; and
  `src/storage.ts` holds the adapters.
- `packages/react`: a thin wrapper around `mount()`. Keep UI out of it.
- `packages/vite-plugin`: the dev-server endpoint.
- `examples/*`: demo apps, also used as e2e targets.

## Before you open a PR

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm e2e
pnpm changeset      # describe user-facing changes
```

Guidelines:

- **No runtime dependencies in core.** The script-tag build has to stay a single,
  self-contained file.
- **Never break existing `annotoo.annotations.json` files.** Treat the `Annotation` type as
  a public format: add optional fields, don't rename or remove them.
- **Anchoring changes need tests** in `packages/core/test/anchor.test.ts`.
- **Respect the host page.** Don't leak styles, keystrokes or clicks into the prototype
  (see the capture handlers in `widget.ts`), and don't add single-key shortcuts: they
  collide with the prototypes Annotoo sits on.

## Releasing

Releases are cut from `main` with [changesets](https://github.com/changesets/changesets).
The three packages are versioned together.
