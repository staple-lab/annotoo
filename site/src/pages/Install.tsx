import { CodeBlock } from '../components/CodeBlock';
import { Link } from '../router';

/** One prompt for any coding agent; the Claude Code and Codex tabs just wrap it in a command. */
const AGENT_PROMPT = [
  'Add Annotoo (https://github.com/staple-lab/annotoo) to this project so I can annotate the prototype.',
  'Use the package manager the project already uses.',
  "If it's React + Vite: install @staplelab/annotoo-react, install @staplelab/vite-plugin-annotoo as a dev dependency, add annotoo() to the plugins in vite.config, create src/annotoo.annotations.json containing [] if it doesn't exist, and render <Annotoo annotations={annotations} /> once in the root component, importing annotations from that file.",
  "If it's Next.js: install @staplelab/annotoo-react and render <Annotoo annotations={annotations} mode={process.env.NODE_ENV === 'development' ? 'author' : 'viewer'} /> in app/layout.tsx.",
  'If it\'s plain HTML: add <script src="https://unpkg.com/@staplelab/annotoo/dist/annotoo.js"></script> just before </body>.',
  "Don't change anything else. When you're done, tell me how to start it and open the annotation toolbar.",
].join(' ');
const shell = (cli: string) => `${cli} "${AGENT_PROMPT.replace(/"/g, '\\"')}"`;

export function Install() {
  return (
    <article className="prose">
      <h1>Install</h1>
      <p className="lede">
        Annotoo is three small packages. Most prototypes need two of them: the React component and
        the Vite plugin that saves your annotations into the repo.
      </p>

      <h2>With Claude Code or Codex</h2>
      <p>
        Let your coding agent do it. Run this in your project folder and it picks the right setup
        below for your stack:
      </p>
      <CodeBlock
        id="install-agent"
        tabsLabel="Coding agent"
        code={{ 'Claude Code': shell('claude'), Codex: shell('codex'), 'Any agent': AGENT_PROMPT }}
        wrap
      />

      <h2>React and Vite</h2>
      <CodeBlock
        code={{
          npm: 'npm install @staplelab/annotoo-react\nnpm install -D @staplelab/vite-plugin-annotoo',
          pnpm: 'pnpm add @staplelab/annotoo-react\npnpm add -D @staplelab/vite-plugin-annotoo',
          yarn: 'yarn add @staplelab/annotoo-react\nyarn add -D @staplelab/vite-plugin-annotoo',
        }}
      />
      <p>Add the plugin. On first run it creates an empty <code>src/annotoo.annotations.json</code>.</p>
      <CodeBlock
        label="vite.config.ts"
        code={`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import annotoo from '@staplelab/vite-plugin-annotoo';

export default defineConfig({
  plugins: [react(), annotoo()],
});`}
      />
      <p>Then render the component once, anywhere in your app:</p>
      <CodeBlock
        id="install-react"
        label="App.tsx"
        code={`import { Annotoo } from '@staplelab/annotoo-react';
import annotations from './annotoo.annotations.json';

export function App() {
  return (
    <>
      {/* your prototype */}
      <Annotoo annotations={annotations} />
    </>
  );
}`}
      />
      <p>
        Run <code>vite dev</code> and you're in author mode: the toolbar has an Annotate tool and
        every change is written to the JSON file. Commit that file with your prototype. Production
        builds switch to viewer mode on their own, with no extra requests.
      </p>

      <h2>Any HTML page</h2>
      <p>
        No build step needed. Add one script tag and Annotoo boots itself, saving to your browser
        while you work:
      </p>
      <CodeBlock code={`<script src="https://unpkg.com/@staplelab/annotoo/dist/annotoo.js"></script>`} />
      <p>
        When you're done, use <strong>Export HTML</strong> in the toolbar. You get one
        self-contained file with the page, your annotations and the widget inlined. Host that file
        and viewers see read-only annotations.
      </p>

      <h2>Next.js and other setups</h2>
      <p>
        The React component includes <code>"use client"</code>, so it works in the App Router. Without
        the Vite plugin, use <code>mode="author"</code> while you write annotations: they save to
        your browser. To keep them in your repo, implement <code>storage</code> against your own backend.
      </p>
      <CodeBlock
        label="app/layout.tsx"
        code={`<Annotoo
  annotations={annotations}
  mode={process.env.NODE_ENV === 'development' ? 'author' : 'viewer'}
/>`}
      />
      <p>
        For anything else, the framework-free core has the same options. See the{' '}
        <Link to="/api">API</Link>.
      </p>
    </article>
  );
}
