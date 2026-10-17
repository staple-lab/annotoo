import { CodeBlock } from '../components/CodeBlock';

export function Sharing() {
  return (
    <article className="prose">
      <h1>Sharing</h1>
      <p className="lede">
        There's no Annotoo server. Your annotations are a file in your repo, and the build carries
        them, so sharing a prototype with its annotations is the same as sharing the prototype.
      </p>

      <h2>What happens when you deploy</h2>
      <ol className="steps" data-annotoo-id="sharing-steps">
        <li>
          <strong>You write annotations in <code>vite dev</code>.</strong> The plugin saves them to{' '}
          <code>src/annotoo.annotations.json</code>.
        </li>
        <li>
          <strong>You build.</strong> The JSON is imported like any other module, so it's bundled
          into your app.
        </li>
        <li>
          <strong>Someone opens the link.</strong> Annotoo finds no dev server, starts in viewer mode,
          and shows the annotations. It makes no network requests of its own.
        </li>
      </ol>

      <h2>Where to host</h2>
      <p>
        Anywhere that serves static files, including under a sub-path such as{' '}
        <code>example.com/s/my-prototype/</code>. Annotoo works out which page it's on even when the
        prefix differs from your dev server. If you'd rather be explicit, pass <code>basePath</code>.
      </p>

      <h2>A single file</h2>
      <p>
        For plain HTML pages, <strong>Export HTML</strong> downloads one self-contained file with the
        page, your annotations and the widget inlined. It works offline and from any host, and you
        can attach it to an email.
      </p>

      <h2>Showing your own view</h2>
      <p>Anyone can change what they see with a URL parameter:</p>
      <CodeBlock
        code={`?annotoo=viewer   # see exactly what viewers see, even in dev
?annotoo=author   # authoring tools on a deployed build (saves to your browser)
?annotoo=off      # no Annotoo at all, e.g. for screenshots`}
      />

      <h2>Keeping it out of production</h2>
      <p>
        If the same build goes to real users, render Annotoo only where you want it, for example{' '}
        <code>{'<Annotoo disabled={!isPreview} />'}</code>.
      </p>
    </article>
  );
}
