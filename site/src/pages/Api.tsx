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
        The included Vite integration handles setup automatically. Use the browser API for custom integrations.
      </p>

      <h2>Vite integration</h2>
      <CodeBlock label="vite.config.ts" code={`import annotoo from '@staplelab/annotoo/vite';

// Add to your existing plugins:
annotoo({
  // build: 'viewer',               // opt in; omitted by default
  autoMount: true,                  // default; false for manual browser setup
  file: 'src/annotoo.annotations.json', // optional legacy input
  commentsDir: '.annotoo.comments',  // relative to Git root, else Vite root
  endpoint: '/__annotoo/annotations',
});`} />
      <p>The widget mounts automatically in development. Default production builds contain
        neither the widget nor thread data. Set <code>build: 'viewer'</code> to publish a
        read-only snapshot. New projects need no legacy annotation file; thread files are
        created on first write.</p>
      <h2>Browser options</h2>
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

      <h2>Manual browser initialization</h2>
      <p>For non-Vite integrations, call <code>mount()</code> once in the browser entry point.
        Author mode uses browser storage without a custom adapter. With the Vite integration,
        set <code>autoMount: false</code> before adding a manual call.</p>
      <CodeBlock
        label="main.ts"
        code={`import { mount } from '@staplelab/annotoo';

const annotoo = mount({ mode: 'author', display: 'hover' });

annotoo.hide();      // hide all annotations
annotoo.show();
annotoo.destroy();   // remove Annotoo from the page`}
      />
      <p>
        <code>mount()</code> returns straight away. Its <code>ready</code> promise resolves with the
        mode it started in, or <code>null</code> if it was switched off with <code>?annotoo=off</code>.
      </p>

      <h2>Manual development-only loading</h2>
      <p>For a manual Vite setup, use <code>import.meta.env.DEV</code>. Other bundlers need
        their own supported development flag. <code>process.dev</code> is not standard;
        browsers do not provide <code>process.env.NODE_ENV</code> unless the bundler replaces it.</p>
      <CodeBlock code={`if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount({ mode: 'author' });
  import.meta.hot?.dispose(() => instance.destroy());
}`} />
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

      <h2>Git storage</h2>
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
        With <code>build: 'viewer'</code>, the plugin embeds the merged discussions,
        including replies and resolution history. Default builds exclude these discussions.
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
