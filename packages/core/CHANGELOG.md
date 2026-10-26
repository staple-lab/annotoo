# @staplelab/annotoo

## 0.5.1

- Releases now publish to npm from GitHub Actions with trusted publishing and provenance. No functional changes.

## 0.5.0

- Published to the npm registry: `npm install @staplelab/annotoo`.
- Add a **Your name** setting. It defaults to your Git `user.name` and sets the name shown on notes, replies and edits you create from then on; the author ID stays the hash of your Git email.

## 0.4.0

- Open threads in place of their note's card, beside the annotated element; notes without a card on the page keep the side panel.
- Show who created each note and remove assignment controls. Existing assignee data still loads but is no longer shown or exported.
- Scroll a new reply into view after posting. Resolve thread is green and aligned with the reply box.
- Use an issue-style note card with category, page and creator.

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
