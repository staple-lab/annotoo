# Contributing to Annotoo

Thanks for helping. Annotoo is small on purpose, so please open an issue before starting a
large change.

## Setup

```bash
pnpm install
pnpm dev            # example prototype at http://localhost:5173 (author mode)
```

Git-backed comment writing needs `git config user.name` and `git config user.email` in
your clone. Use your own identity; Annotoo shows the name and hashes the email for a
stable author ID. It does not publish the raw email. Local Git identity is attribution,
not authentication. See [the collaboration walkthrough](docs/collaboration.md).

Layout:

- `packages/core`: everything that renders. Vanilla TypeScript in a Shadow DOM, with no
  runtime dependencies. `src/widget.ts` holds the toolbar, editor, list and settings;
  `src/layer.ts` draws annotations (outline, badge, connector, note) and lays them out;
  `src/anchor.ts` re-finds elements; `src/router.ts` scopes annotations to pages; and
  `src/storage.ts` holds the adapters.
- `packages/vite-plugin`: Git identity, per-thread disk storage, the dev-server endpoint,
  and the merged discussion snapshot embedded during a production build.
- `examples/*`: demo apps, also used as e2e targets.
- `.annotoo.comments/`: per-thread JSON envelopes at the Git root. Existing legacy JSON
  stays readable; changes and deletion records live in this directory.

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
- **Keep thread history intact.** Replies and resolve/reopen events carry their own IDs,
  author and timestamp. Retain history when assigning, unassigning, resolving, reopening, or merging changes.
  Per-thread files use `schemaVersion: 1`; deleting a legacy note needs a retained
  deletion record so it does not reappear.
- **Keep collaboration claims precise.** Clients of one dev server refresh from its
  files. Separate clones exchange commits through Git and may have normal merge
  conflicts. Do not add automatic commits, pushes, or claims of live synchronization
  across clones.
- **Keep hosted discussions readable without credentials.** The build must contain its
  current discussion snapshot. Production viewers cannot write back to Git. An explicit
  browser-local author override does not modify the shared snapshot.
- **Anchoring changes need tests** in `packages/core/test/anchor.test.ts`.
- **Respect the host page.** Don't leak styles, keystrokes or clicks into the prototype
  (see the capture handlers in `widget.ts`), and don't add single-key shortcuts: they
  collide with the prototypes Annotoo sits on.

## Releasing

Add a changeset for user-facing changes. Run `pnpm changeset version` to update the
framework-agnostic package and optional Vite plugin together. Open a pull request;
`main` requires passing CI and resolved review conversations, including for admins.
A second reviewer's approval is optional.

Run `pnpm release:pack` before opening the release PR and commit the generated
`site/public/releases/<version>/annotoo.js` archive. Keep previous archives so existing
script URLs continue to work. An existing version cannot be overwritten with a different build.

After merging, tag the tested commit with the package version, such as `v0.2.0`, and
push the tag. The Release workflow builds installable packages, includes licenses and
checksums, and publishes a GitHub release. `pnpm release:pack` produces the same files
locally in `release-dist/`. Update `docs/release-notes.md` and the versioned installation
URLs with each release. npm registry publication is a separate authenticated operation.
