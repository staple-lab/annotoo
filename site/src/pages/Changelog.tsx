export function Changelog() {
  return (
    <article className="prose">
      <h1>Changelog</h1>
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
