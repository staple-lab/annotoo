import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static route entry points make direct links work on GitHub Pages without redirects.
const base = (process.env.SITE_BASE ?? '/annotoo/').replace(/\/?$/, '/');
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('SITE_BASE must be an absolute URL path ending in /');
const run = (args, env = {}) => execFileSync('pnpm', args, { stdio: 'inherit', env: { ...process.env, ...env } });
run(['build']);
run(['--filter', 'site', 'build'], { SITE_BASE: base });
run(['--filter', 'example-vite-react', 'build', '--base', `${base}demo/`]);

const destination = resolve('pages-dist');
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync('site/dist', destination, { recursive: true });
const html = readFileSync('site/dist/index.html', 'utf8');
for (const route of ['install', 'features', 'sharing', 'schema', 'api', 'faq', 'changelog']) {
  mkdirSync(`${destination}/${route}`, { recursive: true });
  writeFileSync(`${destination}/${route}/index.html`, html);
}
writeFileSync(`${destination}/404.html`, html);
cpSync('examples/vite-react/dist', `${destination}/demo`, { recursive: true });
mkdirSync(`${destination}/demo/agents`, { recursive: true });
cpSync('examples/vite-react/dist/index.html', `${destination}/demo/agents/index.html`);
writeFileSync(`${destination}/.nojekyll`, '');
console.log(`GitHub Pages site and demo built in ${destination}`);
