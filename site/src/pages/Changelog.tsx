export function Changelog() {
  return (
    <article className="prose">
      <h1>Changelog</h1>
      <section className="release">
        <h2>0.2.0 <time dateTime="2026-10-21">21 October 2026</time></h2>
        <p>First packaged release. <a href="https://github.com/staple-lab/annotoo/releases/tag/v0.2.0">Download the release</a>.</p>
        <ul>
          <li>One framework-free package: call <code>mount()</code> once from your browser entry point.</li>
          <li>Element annotations with numbered badges, connectors and five categories; route and sub-path support.</li>
          <li>Attributed replies, assignment, unassignment, resolve/reopen history and thread filters.</li>
          <li>Optional Vite plugin: one Git-backed file per thread, with display names and hashed author IDs.</li>
          <li>Collaboration through normal Git pull, commit and push; read-only discussion snapshots for hosted prototypes.</li>
          <li>Floating toolbar, display settings, Markdown export and a script-tag build with self-contained HTML export.</li>
        </ul>
      </section>
    </article>
  );
}
