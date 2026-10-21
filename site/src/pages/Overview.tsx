import { CodeBlock } from '../components/CodeBlock';
import { Demo } from '../components/Demo';
import { Link } from '../router';
import { hasLocalChanges, resetAnnotations } from '../annotoo';

const viewerHref = `${import.meta.env.BASE_URL}?annotoo=viewer`;
const demoHref = `${import.meta.env.BASE_URL}demo/`;

export function Overview() {
  const changed = hasLocalChanges();
  return (
    <article className="prose overview">
      <h1 className="hero-title" data-annotoo-id="hero-title">
        Discuss the prototype, beside the UI
      </h1>
      <p className="lede">
        Point at any element in your prototype and explain it: what it does, where its data
        comes from, what isn't built yet. Reply and resolve with your team through Git. The
        discussion ships with your build, so everyone who opens the link can read it in context.
      </p>

      <CodeBlock
        id="install-snippet"
        code={{
          npm: 'npm install @staplelab/annotoo\nnpm install -D @staplelab/vite-plugin-annotoo',
          pnpm: 'pnpm add @staplelab/annotoo\npnpm add -D @staplelab/vite-plugin-annotoo',
          yarn: 'yarn add @staplelab/annotoo\nyarn add -D @staplelab/vite-plugin-annotoo',
        }}
      />

      <Demo />
      <p><a className="button" href={demoHref}>Open the full prototype demo</a></p>

      <figure><img src={`${import.meta.env.BASE_URL}screenshots/threads.jpg`} alt="Jane Doe and Sam Lee discussing a prototype in an Annotoo thread" loading="lazy" style={{ width: '100%', borderRadius: 12 }} /></figure>
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
          <code>.annotoo.comments/</code> in your Git repo, with your Git display name.
        </li>
        <li>
          <strong>Keep the discussion together.</strong> Open a thread to reply, assign, unassign, resolve or reopen.
          Commit, pull and push the thread files with your normal Git workflow.
        </li>
        <li>
          <strong>Deploy as usual.</strong> Your build carries the notes, replies and resolution history
          to a read-only hosted viewer. No backend or viewer account is needed.
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
        It's built for a stakeholder reviewing a flow, an engineer picking up a spike, or a
        researcher running a session. Local contributors can continue the discussion in their
        clone; hosted viewers get the prototype and the reasoning together.
      </p>

      <section className="try" data-annotoo-id="try-it" aria-labelledby="try-title">
        <h2 id="try-title">Explore Annotoo</h2>
        <p>
          This documentation page is a personal sandbox: notes you add here stay in your browser.
          Nobody else sees them, and they never update Git. The full prototype demo is a read-only
          review copy with the published discussions. Jane Doe, Sam Lee and Alex Rivera are fictional people in the sample threads.
        </p>
        <div className="try-actions">
          <a className="button" href={viewerHref}>
            See this page as a viewer
          </a>
          {changed && (
            <button type="button" className="button ghost" onClick={resetAnnotations}>
              Reset my annotations
            </button>
          )}
          <Link to="/install" className="button ghost">
            Add it to your prototype
          </Link>
          <Link to="/sharing" className="button ghost">
            Collaborate through Git
          </Link>
        </div>
      </section>
    </article>
  );
}
