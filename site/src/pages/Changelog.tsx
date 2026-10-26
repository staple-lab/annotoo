export function Changelog() {
  return (
    <article className="prose">
      <h1>Changelog</h1>
      <section className="release">
        <h2>0.5.1 <time dateTime="2026-10-26">26 October 2026</time></h2>
        <p>Published from GitHub Actions with npm provenance. No functional changes. <a href="https://github.com/staple-lab/annotoo/releases/tag/v0.5.1">Release notes</a>.</p>
      </section>
      <section className="release">
        <h2>0.5.0 <time dateTime="2026-10-25">25 October 2026</time></h2>
        <p>Now on npm: <code>npm install @staplelab/annotoo</code>. <a href="https://github.com/staple-lab/annotoo/releases/tag/v0.5.0">Release notes</a>.</p>
        <ul>
          <li>Choose the name shown on your notes and replies under <strong>Your name</strong> in Settings. It defaults to your Git name.</li>
        </ul>
      </section>
      <section className="release">
        <h2>0.4.0 <time dateTime="2026-10-25">25 October 2026</time></h2>
        <p>Discussions open where the note is. <a href="https://github.com/staple-lab/annotoo/releases/tag/v0.4.0">Download the release</a>.</p>
        <ul>
          <li>Threads open in place of their note's card, beside the element; notes without a card keep the side panel.</li>
          <li>Notes show who created them. Assignment is removed; existing assignee data still loads.</li>
          <li>A new reply scrolls into view; Resolve thread is green and aligned with the reply box.</li>
          <li>Issue-style note cards with category, page and creator.</li>
        </ul>
      </section>
      <section className="release">
        <h2>0.3.0 <time dateTime="2026-10-21">21 October 2026</time></h2>
        <p>One package and one config entry. <a href="https://github.com/staple-lab/annotoo/releases/tag/v0.3.0">Download the release</a>.</p>
        <ul>
          <li>Vite integration included at <code>@staplelab/annotoo/vite</code>; no separate plugin install.</li>
          <li>Automatic development setup, with the widget and threads excluded from production by default.</li>
          <li>Opt in to published snapshots with <code>build: 'viewer'</code>, or manual setup with <code>autoMount: false</code>.</li>
          <li>Existing threads and legacy annotation files remain compatible; new projects need no empty JSON file.</li>
        </ul>
      </section>
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
