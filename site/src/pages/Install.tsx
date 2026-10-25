import { CodeBlock } from '../components/CodeBlock';
import { Link } from '../router';

const pkg = '@staplelab/annotoo';
const config = (framework?: 'react' | 'vue') => `import { defineConfig } from 'vite';
${framework ? `import ${framework} from '@vitejs/plugin-${framework}';\n` : ''}import annotoo from '@staplelab/annotoo/vite';

export default defineConfig({
  plugins: [${framework ? `${framework}(), ` : ''}annotoo()],
});`;

export function Install() {
  return (
    <article className="prose">
      <h1>One package. One config entry.</h1>
      <p className="lede">Add Annotoo to Vite. It starts automatically in development and saves
        discussions with your code.</p>
      <p>Install <a href="https://www.npmjs.com/package/@staplelab/annotoo"><code>@staplelab/annotoo</code></a> from npm:</p>
      <CodeBlock code={{ npm: `npm install ${pkg}`, pnpm: `pnpm add ${pkg}`, yarn: `yarn add ${pkg}` }} />
      <h2>Add to your Vite config</h2>
      <CodeBlock id="install-framework" tabsLabel="Framework" label="vite.config.ts" code={{ JavaScript: config(), React: config('react'), Vue: config('vue') }} />
      <p>Keep your existing plugins. Run your usual development command. No component,
        browser initialization or empty annotation file is needed.</p>
      <h2>Development only by default</h2>
      <p><code>annotoo()</code> automatically mounts the widget in development and writes
        threads to <code>.annotoo.comments/</code>. Production builds exclude the widget and
        discussion data. No environment guards are needed.</p>
      <h2>Publish a review copy</h2>
      <p>Opt in to a read-only snapshot by changing the plugin options:</p>
      <CodeBlock code={`annotoo({ build: 'viewer' })`} />
      <p>The build includes the widget, authors, replies and thread history. Rebuild and deploy
        to publish later changes. Hosted viewers need no backend or account.</p>
      <h2>Set your Git identity</h2>
      <CodeBlock code={`git config user.name "Your Name"
git config user.email "you@example.com"`} />
      <p>Both values are required for Git-backed writing. Your name appears on comments (change
        it under <strong>Your name</strong> in Settings); your email becomes a hashed ID. Raw email is not stored in threads. This is attribution,
        not verified identity.</p>
      <p>Open the cockatoo tab, select an element, and save with <kbd>⌘ Enter</kbd> on Mac or
        <kbd>Ctrl Enter</kbd>. Open a thread to reply, resolve or reopen.
        Commit <code>.annotoo.comments/</code> and share through your normal Git workflow.
        See <Link to="/sharing">the collaboration walkthrough</Link>.</p>
      <h2>Without Vite</h2>
      <p>The browser API works with any framework. Call <code>mount()</code> once in a browser
        entry point. Without a custom storage adapter, author mode saves only in this browser.
        See the <Link to="/api">API</Link> for manual setup and development flags.</p>
      <CodeBlock code={`<script src="https://annotoo.staplelab.com/releases/v0.5.0/annotoo.js"></script>`} />
      <p>On plain HTML pages, the script starts automatically. <strong>Export HTML</strong>
        creates a self-contained, read-only copy.</p>
    </article>
  );
}
