import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

// Use Vite's public API from the package's installed peer, without making the test
// runner itself another Vite application or depending on a pre-running fixture.
const coreRequire = createRequire(resolve('packages/core/package.json'));
const viteEntry = pathToFileURL(join(dirname(coreRequire.resolve('vite/package.json')), 'dist/node/index.js')).href;

test('one package and one Vite plugin enable local review; default production ships only the app', async ({ page }) => {
  test.setTimeout(60000);
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'annotoo-one-package-')));
  const installed = join(dir, 'node_modules/@staplelab/annotoo');
  mkdirSync(installed, { recursive: true });
  // Copy the publishable files instead of using a workspace alias, exercising
  // the public package export and its runtime paths as a consumer would.
  cpSync('packages/core/dist', join(installed, 'dist'), { recursive: true });
  cpSync('packages/core/package.json', join(installed, 'package.json'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  writeFileSync(join(dir, 'vite.config.mjs'), `import annotoo from '@staplelab/annotoo/vite';\nexport default { plugins: [annotoo()] };\n`);
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>Plain Vite app</title></head><body><main><h1 id="heading">Plain Vite app</h1><button id="action">Create project</button></main><script type="module" src="/main.js"></script></body></html>');
  const appSource = "document.body.dataset.version = 'one'; if (import.meta.hot) import.meta.hot.accept(); document.querySelector('#action').addEventListener('click', () => { document.querySelector('h1').textContent = 'Project created'; });\n";
  writeFileSync(join(dir, 'main.js'), appSource);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.name', 'Jane Doe');
  git('config', 'user.email', 'jane@example.invalid');
  const { createServer, build, preview } = await import(viteEntry);
  const server = await createServer({ root: dir, logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
  let production: Awaited<ReturnType<typeof preview>> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await server.listen();
    const devAddress = server.httpServer.address();
    const origin = `http://127.0.0.1:${devAddress.port}`;
    await page.goto(origin);
    const widget = page.locator('#annotoo-root');
    await expect(widget).toHaveCount(1);
    await widget.getByRole('button', { name: 'Open Annotoo' }).click();
    await expect(widget.getByRole('button', { name: 'Stop annotating' })).toBeVisible();
    await page.locator('#heading').click();
    const sentinel = 'PRIVATE_SINGLE_PACKAGE_REVIEW_7b2f';
    await widget.getByRole('textbox', { name: 'Annotation', exact: true }).fill(sentinel);
    await widget.getByRole('textbox', { name: 'Annotation', exact: true }).press('ControlOrMeta+Enter');
    await expect(widget.locator('.note')).toContainText(sentinel);
    const records = () => readdirSync(join(dir, '.annotoo.comments'), { recursive: true }).filter((path) => String(path).endsWith('.json'));
    await expect.poll(() => records().length).toBe(1);
    const record = JSON.parse(readFileSync(join(dir, '.annotoo.comments', String(records()[0])), 'utf8'));
    expect(record.thread).toMatchObject({ body: sentinel, author: { name: 'Jane Doe' } });
    expect(JSON.stringify(record)).not.toContain('jane@example.invalid');
    await page.reload();
    await expect(widget).toHaveCount(1);
    await expect(widget.locator('.note')).toContainText(sentinel);
    await page.evaluate(() => { (window as unknown as { hmrMarker: boolean }).hmrMarker = true; });
    writeFileSync(join(dir, 'main.js'), appSource.replace("version = 'one'", "version = 'two'"));
    await expect(page.locator('body')).toHaveAttribute('data-version', 'two');
    expect(await page.evaluate(() => (window as unknown as { hmrMarker?: boolean }).hmrMarker)).toBe(true);
    await expect(widget).toHaveCount(1);
    await expect(widget.locator('.note')).toHaveCount(1);
    await page.goto(origin + '/?annotoo=viewer');
    await expect(widget.locator('.note')).toContainText(sentinel);
    await expect(widget.locator('.note')).toContainText('Jane Doe');
    await expect(widget.getByRole('button', { name: 'Annotate an element' })).toHaveCount(0);
    await expect(widget.getByRole('button', { name: 'Stop annotating' })).toHaveCount(0);
    await widget.getByRole('button', { name: 'Open thread 1', exact: true }).click();
    await expect(widget.locator('.thread')).toContainText(sentinel);
    await expect(widget.getByRole('textbox', { name: 'Reply to thread' })).toHaveCount(0);
    await expect(widget.getByRole('button', { name: 'Resolve thread' })).toHaveCount(0);
    expect(errors).toEqual([]);
    await server.close();

    // Running Vite's server first sets NODE_ENV=development in this process.
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try { await build({ root: dir, logLevel: 'silent' }); }
    finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
    const files = readdirSync(join(dir, 'dist'), { recursive: true }).filter((path) => /\.(html|js|css)$/.test(String(path)));
    const emitted = files.map((path) => readFileSync(join(dir, 'dist', String(path)), 'utf8')).join('\n');
    expect(emitted).toContain('Project created');
    expect(emitted).not.toContain(sentinel);
    expect(emitted).not.toContain('__ANNOTOO_COMMENTS__');
    expect(emitted).not.toContain('__ANNOTOO_DEV__');
    expect(emitted).not.toContain('annotoo-root');
    expect(emitted).not.toContain('@annotoo');
    expect(files.filter((path) => String(path).endsWith('.js'))).toHaveLength(1);
    production = await preview({ root: dir, logLevel: 'silent', preview: { host: '127.0.0.1', port: 0 } });
    const address = production.httpServer.address();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.locator('#action').click();
    await expect(page.locator('h1')).toHaveText('Project created');
    await expect(widget).toHaveCount(0);
    expect(requests.some((url) => /__annotoo|@annotoo/.test(url))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    if (production) await new Promise<void>((resolve, reject) => production!.httpServer.close((error?: Error) => error ? reject(error) : resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
