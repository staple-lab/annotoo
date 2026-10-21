import { CodeBlock } from '../components/CodeBlock';

const options: [string, string, string][] = [
  ['annotations', '[]', 'Annotations to show, or to start from in author mode.'],
  ['mode', "'auto'", "'auto' is author mode under vite dev with the plugin and viewer mode everywhere else. Or force 'author' or 'viewer'."],
  ['display', "'always'", "Default note display: 'always', 'hover' or 'markers'. Viewers can change it."],
  ['outlines', 'true', 'Default for outlining annotated elements.'],
  ['theme', "'auto'", "'auto' follows the system; or 'light' or 'dark'."],
  ['position', "'bottom-right'", "Any corner: 'bottom-left', 'top-right' or 'top-left'. Viewers can move it themselves."],
  ['route', 'by path', 'How annotations are scoped to pages. false shows them everywhere; a function returns your own key, e.g. () => location.hash.'],
  ['basePath', 'none', 'The path prefix your app is served under, if you want to set it explicitly.'],
  ['storage', 'plugin or browser', 'Where author changes are saved: an object with load() and save(annotations).'],
  ['endpoint', "'/__annotoo/annotations'", 'The dev-server endpoint. Must match the plugin.'],
  ['shortcuts', 'true', '⌥A / Alt+A annotate, ⌥H / Alt+H show or hide. false turns them off; Esc always works.'],
  ['actions', '[]', 'Extra author toolbar buttons: { label, icon, run(annotations) }.'],
  ['onChange', 'none', 'Called with the full list after every author change.'],
];

export function Api() {
  return (
    <article className="prose">
      <h1>API</h1>
      <p className="lede">
        Call <code>mount()</code> once from your browser bootstrap in any framework.
      </p>

      <h2>Options</h2>
      <div className="table-wrap">
        <table className="table api">
          <thead>
            <tr><th>Option</th><th>Default</th><th>What it does</th></tr>
          </thead>
          <tbody>
            {options.map(([name, def, desc]) => (
              <tr key={name}>
                <td><code>{name}</code></td>
                <td>{/^['[]|^(true|false)$/.test(def) ? <code>{def}</code> : def}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Initialize once</h2>
      <CodeBlock
        label="main.ts"
        code={`import { mount } from '@staplelab/annotoo';
import annotations from './annotoo.annotations.json';

const annotoo = mount({ annotations, display: 'hover' });

annotoo.hide();      // hide all annotations
annotoo.show();
annotoo.destroy();   // remove Annotoo from the page`}
      />
      <p>
        <code>mount()</code> returns straight away. Its <code>ready</code> promise resolves with the
        mode it started in, or <code>null</code> if it was switched off with <code>?annotoo=off</code>.
      </p>

      <h2>Custom storage</h2>
      <p>To save author changes somewhere other than your repo, pass an object with two methods:</p>
      <CodeBlock
        code={`mount({
  mode: 'author',
  storage: {
    load: () => fetch('/api/annotations').then((r) => r.json()),
    save: (annotations) =>
      fetch('/api/annotations', { method: 'PUT', body: JSON.stringify(annotations) }),
  },
});`}
      />
      <p>
        <code>memoryStorage</code>, <code>localStorageStorage</code> and{' '}
        <code>devServerStorage</code> are exported too.
      </p>
      <p>
        Custom storage owns its own identity and sharing behavior. The Git configuration,
        per-thread files and automatic build snapshot described here are provided by the Vite
        plugin. Browser storage does not synchronize separate contributors.
      </p>

      <h2>Vite plugin</h2>
      <CodeBlock
        label="vite.config.ts"
        code={`annotoo({
  file: 'src/annotoo.annotations.json', // relative to the Vite root
  commentsDir: '.annotoo.comments',    // relative to the Git root, else Vite root
  endpoint: '/__annotoo/annotations',   // must match the widget's endpoint
});`}
      />
      <p>
        During <code>vite dev</code>, the plugin merges the legacy array with per-thread files
        and saves changes in the comments directory. It reads <code>user.name</code> and{' '}
        <code>user.email</code> from local Git configuration; both are required for Git-backed
        writes. The display name and a hashed author ID are stored with contributions, without
        publishing the raw email. This is attribution, not authentication.
      </p>
      <p>
        The directory has a project subfolder based on the repo-relative Vite root, so separate
        apps in a monorepo keep their discussions apart. Thread envelopes have{' '}
        <code>schemaVersion: 1</code>, <code>project</code>, <code>thread</code> and an optional{' '}
        <code>deleted: true</code> record. Existing annotation arrays are retained rather than
        rewritten.
      </p>
      <p>
        During <code>vite build</code>, the plugin embeds the merged discussions automatically,
        including replies and resolution history. Your existing annotation import keeps working.
        Normal hosted viewers are read-only and need no Git credentials, backend or write
        endpoint. An explicit hosted author override only changes personal browser storage.
      </p>

      <h2>Script tag</h2>
      <p>
        <code>dist/annotoo.js</code> boots itself. Add <code>data-manual</code> to the tag to stop that
        and call <code>window.Annotoo.mount()</code> yourself.
      </p>
    </article>
  );
}
