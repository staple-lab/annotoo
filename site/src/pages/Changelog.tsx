export function Changelog() {
  return (
    <article className="prose">
      <h1>Changelog</h1>
      <section className="release">
        <h2>Unreleased</h2>
        <p>Discuss prototypes through your existing Git workflow.</p>
        <ul>
          <li>Attributed replies, resolve/reopen history and Open, Resolved and All list filters.</li>
          <li>One versioned thread file per discussion in .annotoo.comments, separated by project in a monorepo.</li>
          <li>Git display names and hashed author IDs, with no raw email published.</li>
          <li>Development clients refresh from disk; separate clones exchange comments with Git pull, commit and push.</li>
          <li>Existing annotation arrays stay supported, and builds embed discussions for read-only hosted viewers.</li>
          <li>Markdown export includes authors, replies and resolution history.</li>
        </ul>
      </section>
      <section className="release">
        <h2>
          0.1.0 <time dateTime="2026-10-13">13 October 2026</time>
        </h2>
        <p>First public release.</p>
        <ul>
          <li>Figma-style annotations: outline, numbered badge, connector and note, with five categories.</li>
          <li>Floating toolbar with Annotate, show and hide, list, settings and copy.</li>
          <li>Viewer settings for display mode, outlines, theme and toolbar position.</li>
          <li>React component, Vite plugin that saves to your repo, and a script-tag build with self-contained HTML export.</li>
          <li>Route-aware annotations that work when the build is hosted under a sub-path.</li>
        </ul>
      </section>
    </article>
  );
}
