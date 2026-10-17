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
  ['disabled', 'false', "React only. Don't mount."],
];

export function Api() {
  return (
    <article className="prose">
      <h1>API</h1>
      <p className="lede">
        The React component and the framework-free <code>mount()</code> take the same options.
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

      <h2>Without React</h2>
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
        code={`<Annotoo
  mode="author"
  storage={{
    load: () => fetch('/api/annotations').then((r) => r.json()),
    save: (annotations) =>
      fetch('/api/annotations', { method: 'PUT', body: JSON.stringify(annotations) }),
  }}
/>`}
      />
      <p>
        <code>memoryStorage</code>, <code>localStorageStorage</code> and{' '}
        <code>devServerStorage</code> are exported too.
      </p>

      <h2>Vite plugin</h2>
      <CodeBlock
        label="vite.config.ts"
        code={`annotoo({
  file: 'src/annotoo.annotations.json', // relative to the Vite root
  endpoint: '/__annotoo/annotations',   // must match the component's endpoint
});`}
      />
      <p>
        The plugin only affects <code>vite dev</code>: it serves the endpoint the toolbar saves to
        and adds a one-line hint to your page so Annotoo knows to start in author mode. Your
        production build is untouched.
      </p>

      <h2>Script tag</h2>
      <p>
        <code>dist/annotoo.js</code> boots itself. Add <code>data-manual</code> to the tag to stop that
        and call <code>window.Annotoo.mount()</code> yourself.
      </p>
    </article>
  );
}
