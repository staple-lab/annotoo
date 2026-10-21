Annotoo's first packaged release adds discussions to live interfaces, with one framework-agnostic `mount()` API.

- Attributed threads and replies, assignment, resolve/reopen, and an activity history.
- Git-backed storage in `.annotoo.comments/`, with one file per thread.
- Read-only review snapshots for hosted prototypes.
- Development-only examples for JavaScript, React, and Vue.
- Desktop and mobile demos, documentation, and screenshots.

Install the core package:

```sh
npm install https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-annotoo-0.2.0.tgz
```

Add Git persistence to a Vite project:

```sh
npm install -D https://github.com/staple-lab/annotoo/releases/download/v0.2.0/staplelab-vite-plugin-annotoo-0.2.0.tgz
```

[Installation guide](https://staple-lab.github.io/annotoo/install) · [Live demo](https://staple-lab.github.io/annotoo/demo/)

Assets include both installable packages, the standalone browser script, and SHA-256 checksums. This release is distributed through GitHub Releases.
