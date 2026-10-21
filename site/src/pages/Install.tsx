import { CodeBlock } from '../components/CodeBlock';
import { Link } from '../router';

const setup = `if (import.meta.env.DEV) {
  const { mount } = await import('@staplelab/annotoo');
  const instance = mount({ mode: 'author' });
  import.meta.hot?.dispose(() => instance.destroy());
}`;

export function Install() {
  return (
    <article className="prose">
      <h1>Install once. Use any framework.</h1>
      <p className="lede">
        One package, one call to <code>mount()</code> in your browser entry point.
        The same setup works with plain JavaScript, React and Vue.
      </p>
      <p>The latest collaboration features are on <code>main</code>. Until the next npm release,
        clone the repository and run <code>pnpm install</code> and <code>pnpm dev</code> to try them.</p>
      <CodeBlock code={{ npm: 'npm install @staplelab/annotoo', pnpm: 'pnpm add @staplelab/annotoo', yarn: 'yarn add @staplelab/annotoo' }} />
      <h2>Development only</h2>
      <p>Start your app, then call <code>mount()</code> once, outside components. Vite removes
        this guarded dynamic import from production builds. The disposal callback removes the
        previous instance on hot reload. Pick your framework:</p>
      <CodeBlock id="install-framework" tabsLabel="Framework" code={{
        'Plain JavaScript': `// src/main.js — start your app first\n${setup}`,
        React: `// src/main.tsx\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\n\ncreateRoot(document.getElementById('root')!).render(<App />);\n\n${setup}`,
        Vue: `// src/main.ts\nimport { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n\n${setup}`,
      }} />
      <p>No wrapper or component is needed. Without the optional plugin, author mode saves to
        this browser's localStorage. It does not share changes with other people.</p>
      <p><code>process.dev</code> is not a standard flag. Use <code>import.meta.env.DEV</code> in Vite.
        Use <code>process.env.NODE_ENV</code> only when your framework or bundler supports and
        replaces it; browsers do not supply <code>process</code>. In server-rendered apps, put
        this setup in the framework's browser entry point.</p>
      <h2>Optional: Git-backed discussions</h2>
      <CodeBlock code="npm install -D @staplelab/vite-plugin-annotoo" />
      <p>Add the plugin alongside your existing framework plugins:</p>
      <CodeBlock label="vite.config.ts" code={`import { defineConfig } from 'vite';
import annotoo from '@staplelab/vite-plugin-annotoo';

export default defineConfig(({ command }) => ({
  plugins: [
    // Keep your existing framework plugins here.
    ...(command === 'serve' ? [annotoo()] : []),
  ],
}));`} />
      <p>The plugin saves separate thread files in <code>.annotoo.comments/</code> at the Git
        repository root. It creates <code>src/annotoo.annotations.json</code> if missing and
        preserves existing notes. Keep the comments directory in Git.</p>
      <p>For development only, use both the guarded import and this plugin guard.
        An unconditional plugin embeds thread data into production HTML even if the widget
        is never mounted.</p>
      <h2>Publish a read-only review copy</h2>
      <p>To deliberately include a discussion snapshot in your deployed prototype, enable the
        plugin for builds too:</p>
      <CodeBlock label="vite.config.ts" code={`// Keep the same imports and existing framework plugins.
export default defineConfig({
  plugins: [annotoo()],
});`} />
      <p>Then replace the development-only block with this single call in the browser entry point:</p>
      <CodeBlock label="Browser entry point" code={`import { mount } from '@staplelab/annotoo';
import annotations from './annotoo.annotations.json';

const instance = mount({ annotations });
import.meta.hot?.dispose(() => instance.destroy());`} />
      <p>With the plugin, development uses author mode and builds include a read-only thread
        snapshot. Rebuild and deploy to publish later comments.</p>
      <h2>Set your Git identity</h2>
      <CodeBlock code={`git config user.name "Your Name"
git config user.email "you@example.com"`} />
      <p>Both values are required for Git-backed writing. Your name appears on comments; the
        email becomes a hashed author ID. Raw email is not included in thread files. This is
        local attribution, not verified identity.</p>
      <p>Open the cockatoo tab, select an element, and save with <kbd>⌘ Enter</kbd> on Mac or
        <kbd>Ctrl Enter</kbd>. Open a thread to reply, assign, unassign, resolve or reopen.
        See <Link to="/sharing">the collaboration walkthrough</Link> for sharing through Git.</p>
      <h2>Any HTML page</h2>
      <CodeBlock code={`<script src="https://unpkg.com/@staplelab/annotoo/dist/annotoo.js"></script>`} />
      <p>The script boots itself and saves to browser storage. Use <strong>Export HTML</strong>
        to share one self-contained, read-only copy. See the <Link to="/api">API</Link> for
        manual initialization and custom storage.</p>
    </article>
  );
}
