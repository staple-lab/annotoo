# Annotoo 0.4.0

Discussions open where the note is. A thread now opens in place of its note's card,
beside the element it describes, and each note shows who created it.

```sh
npm install https://github.com/staple-lab/annotoo/releases/download/v0.4.0/staplelab-annotoo-0.4.0.tgz
```

- Threads open in the note's card, beside the annotated element. Notes on another page,
  or whose element can't be found, still open in the side panel.
- Notes show the person who created them. Assignment controls are removed.
- Posting a reply scrolls it into view. Resolve thread is green and aligned with the reply box.
- Note cards use an issue-style layout with category, page and creator.

## Upgrade from 0.3.0

Install the new package; no configuration changes are needed. Existing thread files load
unchanged. Threads that were assigned keep their `assignee` field and assignment events in
the file, but Annotoo no longer shows them or includes them in Markdown exports.

Assets include one installable package, the standalone browser script, and SHA-256 checksums.
This release is distributed through GitHub Releases.

[Installation](https://staple-lab.github.io/annotoo/install) · [Live demo](https://staple-lab.github.io/annotoo/demo/)
