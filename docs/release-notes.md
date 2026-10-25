# Annotoo 0.5.0

Annotoo is now on the npm registry, and you can choose the name shown on your notes.

```sh
npm install @staplelab/annotoo
```

- **Your name** in Settings sets the name on notes, replies and edits you create. It
  defaults to your Git `user.name`; clear it to go back to that. The choice is kept in
  your browser, and your author ID is still the hash of your Git email, so earlier notes
  stay linked to you.
- Install from npm instead of a release tarball. The tarball and the standalone browser
  script remain attached to this GitHub release.

## Upgrade from 0.4.0

Replace the tarball URL in your `package.json` with the registry package:

```sh
npm install @staplelab/annotoo@^0.5.0
```

No configuration changes are needed. Existing thread files load unchanged.

[Installation](https://annotoo.staplelab.com/install) · [Live demo](https://annotoo.staplelab.com/demo/)
