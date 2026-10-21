# @staplelab/annotoo

## 0.3.0

- Include the Vite integration at `@staplelab/annotoo/vite`; remove the separate plugin package.
- Mount automatically in development and exclude the widget and threads from production by default.
- Add `build: 'viewer'` for published snapshots and `autoMount: false` for manual initialization.
- Keep legacy annotation files compatible without requiring new projects to create one.

## 0.2.0

### Minor Changes

- 00c793f: Add Git-backed annotation discussions with attributed replies, resolve/reopen history,
  and open/resolved/all filters. The Vite plugin stores one thread per file in
  `.annotoo.comments/`, keeps existing annotation arrays compatible, refreshes development
  clients from disk, and embeds discussions in read-only deployed viewers. Contributors
  exchange changes through their existing Git workflow without a separate backend.
- de54012: Add assign, reassign, and unassign controls with Git collaborator discovery and attributed ownership history. Use one framework-agnostic mount API in every integration; remove the separate React wrapper. Update the collaboration tutorial and public demos with fictional participants and screenshots.
