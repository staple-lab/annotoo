import { CodeBlock } from '../components/CodeBlock';
import { Demo } from '../components/Demo';
import { Link } from '../router';
import { hasLocalChanges, resetAnnotations } from '../annotoo';

const viewerHref = `${import.meta.env.BASE_URL}?annotoo=viewer`;

export function Overview() {
  const changed = hasLocalChanges();
  return (
    <article className="prose overview">
      <h1 className="hero-title" data-annotoo-id="hero-title">
        Annotations for prototypes
      </h1>
      <p className="lede">
        Point at any element in your prototype and explain it: what it does, where its data
        comes from, what isn't built yet. The notes ship with your build, so everyone who opens
        the link sees them beside the UI they describe.
      </p>

      <CodeBlock
        id="install-snippet"
        code={{
          npm: 'npm install @staplelab/annotoo-react\nnpm install -D @staplelab/vite-plugin-annotoo',
          pnpm: 'pnpm add @staplelab/annotoo-react\npnpm add -D @staplelab/vite-plugin-annotoo',
          yarn: 'yarn add @staplelab/annotoo-react\nyarn add -D @staplelab/vite-plugin-annotoo',
        }}
      />

      <Demo />

      <h2>How it works</h2>
      <ol className="steps">
        <li>
          <strong>Open the toolbar.</strong> Click the cockatoo tab at the bottom-right edge of the page. Annotate mode switches on straight away.
        </li>
        <li>
          <strong>Hover the page.</strong> Each element is outlined and named as you go.
        </li>
        <li>
          <strong>Click an element</strong>, pick a category, and write what people should know about it.
        </li>
        <li>
          <strong>Save with ⌘ Enter.</strong> In <code>vite dev</code> the note is written straight into{' '}
          <code>annotoo.annotations.json</code> in your repo.
        </li>
        <li>
          <strong>Deploy as usual.</strong> Your build carries the annotations, read-only, to wherever it's hosted.
        </li>
      </ol>

      <h2>Why not just annotate in Figma?</h2>
      <p>
        Figma annotations describe a picture of the product. Once there's a coded prototype, that's
        what people click through, and the notes in Figma drift out of date the moment the build
        changes. Annotoo keeps the explanation on the thing itself: attached to real elements,
        following them through layout changes and routes, and versioned with the code.
      </p>
      <p>
        It's built for handing a prototype to someone who wasn't in the room: a stakeholder
        reviewing a flow, an engineer picking up a spike, a researcher running a session. They get
        the prototype and the reasoning together.
      </p>

      <section className="try" data-annotoo-id="try-it" aria-labelledby="try-title">
        <h2 id="try-title">Try it on this page</h2>
        <p>
          The toolbar in the corner is the real thing. Annotate anything here: your notes are saved
          in this browser only, and nobody else sees them.
        </p>
        <div className="try-actions">
          <a className="button" href={viewerHref}>
            See it as a viewer
          </a>
          {changed && (
            <button type="button" className="button ghost" onClick={resetAnnotations}>
              Reset my annotations
            </button>
          )}
          <Link to="/install" className="button ghost">
            Add it to your prototype
          </Link>
        </div>
      </section>
    </article>
  );
}
