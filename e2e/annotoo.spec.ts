import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const COMMENTS = '.annotoo.comments-e2e/' + createHash('sha256').update('examples/vite-react').digest('hex').slice(0, 16);
const DEV = 'http://localhost:5318/';
const PROD = 'http://127.0.0.1:4318/s/my-proto/';

const ui = (page: Page) => page.locator('#annotoo-root');
const markers = (page: Page) => ui(page).locator('.marker:not(.is-draft)');
const notes = (page: Page) => ui(page).locator('.note');
const tool = (page: Page, label: string) => ui(page).locator(`button[aria-label="${label}"]`);
const openToolbar = (page: Page) => tool(page, 'Open Annotoo').click();

test.describe('dev server: author mode', () => {
  test.beforeAll(() => {
    // An interrupted previous run may not have reached afterAll.
    rmSync('.annotoo.comments-e2e', { recursive: true, force: true });
  });
  test.afterAll(() => {
    rmSync('.annotoo.comments-e2e', { recursive: true, force: true });
  });

  test('attributed threads are written into the Git comments directory', async ({ page }) => {
    await page.goto(DEV);
    await expect(markers(page)).toHaveCount(3);

    // Marker to detect a full reload / HMR remount caused by our own file write.
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    // Opening the tab goes straight into annotate mode.
    await openToolbar(page);
    await expect(tool(page, 'Stop annotating')).toHaveCount(1);

    const items = [
      { target: '.page-head h1', category: 'content', title: 'Page title', body: 'Always "Analytics" for this role.' },
      { target: '.bars', category: 'development', title: '', body: 'From /api/costs?window=14d, cached 60s.' },
    ];
    for (const [i, item] of items.entries()) {
      await page.locator(item.target).click();
      const editor = ui(page).locator('.editor');
      await editor.locator(`.cat-toggle[data-cat="${item.category}"]`).click();
      if (item.title) await editor.locator('input.title').fill(item.title);
      await editor.locator('textarea').fill(item.body);
      await editor.locator('textarea').press('ControlOrMeta+Enter');
      await expect(markers(page)).toHaveCount(4 + i);
    }

    // The page itself must not have reacted to clicks while annotating.
    await expect(page).toHaveURL(DEV);

    const stored = () => existsSync(COMMENTS) ? readdirSync(COMMENTS).filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(`${COMMENTS}/${name}`, 'utf8'))) : [];
    await expect.poll(() => stored().length).toBe(2);
    const saved = stored().map((envelope) => envelope.thread);
    expect(saved.find((a) => a.title === 'Page title')).toMatchObject({ n: 6, category: 'content', route: '/',
      author: { name: 'Annotoo test author' } });
    const costs = saved.find((a) => a.n === 7);
    expect(costs).toMatchObject({ category: 'development', body: 'From /api/costs?window=14d, cached 60s.' });
    expect(costs.title).toBeUndefined();
    expect(JSON.stringify(stored())).not.toContain('annotoo-tests@example.invalid');

    // Writing the file must not have reloaded the app mid-session.
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

    // Outside Annotate, notes are locked: a click only selects.
    await tool(page, 'Stop annotating').click();
    await ui(page).locator('.note', { hasText: 'Page title' }).click();
    await expect(ui(page).locator('.editor')).toHaveCount(0);

    // Edit in place by clicking the note while annotating.
    await tool(page, 'Annotate an element').click();
    await ui(page).locator('.note', { hasText: 'Page title' }).click();
    await ui(page).locator('.editor textarea').fill('Always "Analytics".');
    await ui(page).locator('.editor .btn.primary').click();
    await expect.poll(() => stored().find((envelope) => envelope.thread.title === 'Page title')?.thread.body).toBe('Always "Analytics".');

    await page.reload();
    await expect(markers(page)).toHaveCount(5);
  });

  test('two clients keep replies and drafts, resolve and reopen the same discussion', async ({ page, browser }) => {
    await page.goto(DEV);
    await expect(markers(page).first()).toBeVisible();
    const baseline = await markers(page).count();
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await other.goto(DEV);
    await openToolbar(page);
    await page.locator('.page-head h1').click();
    await ui(page).getByRole('textbox', { name: 'Title', exact: true }).fill('Discussion lifecycle');
    await ui(page).getByRole('textbox', { name: 'Annotation', exact: true }).fill('Please review this heading.');
    await ui(page).getByRole('textbox', { name: 'Annotation', exact: true }).press('ControlOrMeta+Enter');
    await expect(markers(page)).toHaveCount(baseline + 1);
    await expect(ui(other).locator('.note', { hasText: 'Discussion lifecycle' })).toBeVisible();
    await tool(page, 'Stop annotating').click();
    const discussion = (target: Page) => ui(target).locator('.note', { hasText: 'Discussion lifecycle' });
    await discussion(page).getByRole('button', { name: /^Open thread/ }).click();
    await discussion(other).getByRole('button', { name: /^Open thread/ }).click();
    // The thread opens in place of the note's card, not as a side panel.
    await expect(ui(page).locator('.thread')).toHaveClass(/in-card/);
    const reply = (target: Page) => ui(target).getByRole('textbox', { name: 'Reply to thread' });
    await reply(other).fill('A draft that survives synchronization.');
    await reply(page).fill('The first review reply.');
    await ui(page).getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(ui(other).locator('.thread')).toContainText('The first review reply.');
    await expect(reply(other)).toHaveValue('A draft that survives synchronization.');
    await ui(other).getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(ui(page).locator('.thread')).toContainText('A draft that survives synchronization.');
    await expect(ui(page).locator('.thread .reply')).toHaveCount(2);
    await expect(ui(page).locator('.thread')).toContainText('Annotoo test author');
    await expect(discussion(page).locator('.note-owner')).toHaveText('Annotoo test author');
    await expect(ui(page).locator('.thread select')).toHaveCount(0);
    await ui(page).getByRole('button', { name: 'Resolve thread' }).click();
    await expect(ui(page).getByRole('button', { name: 'Reopen thread' })).toBeVisible();
    await expect(markers(page)).toHaveCount(baseline);
    await expect(ui(other).getByRole('button', { name: 'Reopen thread' })).toBeVisible();
    await ui(other).getByRole('button', { name: 'Reopen thread' }).click();
    await expect(ui(page).getByRole('button', { name: 'Resolve thread' })).toBeVisible();
    await expect(markers(page)).toHaveCount(baseline + 1);
    await expect(ui(page).locator('.thread-history')).toContainText('reopened this thread');
    await page.reload();
    await expect(discussion(page)).toBeVisible();
    await otherContext.close();
  });
});

test.describe('production build hosted under a sub-path: viewer mode', () => {
  test('committed replies and resolved discussions ship in the read-only build', async ({ page }) => {
    await page.goto(PROD);
    await ui(page).getByRole('button', { name: 'Open thread 1', exact: true }).click();
    await expect(ui(page).locator('.thread')).toContainText('Jane Doe');
    await expect(ui(page).locator('.thread')).toContainText('Sam Lee');
    await expect(ui(page).locator('.thread .reply')).toHaveCount(2);
    await expect(ui(page).locator('.thread')).not.toContainText('Assignee');
    await expect(ui(page).getByRole('button', { name: 'Resolve thread' })).toHaveCount(0);
    await ui(page).getByRole('button', { name: 'Close thread' }).click();
    await openToolbar(page);
    await tool(page, 'Annotation list').click();
    await ui(page).getByRole('radio', { name: 'Resolved', exact: true }).click();
    await ui(page).getByRole('button', { name: /Open thread 6:/ }).click();
    await expect(ui(page).locator('.thread')).toContainText('Completed chart review');
    await expect(ui(page).locator('.thread')).toContainText('resolved this thread');
    await expect(ui(page).getByRole('button', { name: 'Reopen thread' })).toHaveCount(0);
  });
  test('notes render beside elements, read-only, and follow routes', async ({ page }) => {
    await page.goto(PROD);
    await expect(markers(page)).toHaveCount(3);
    await expect(notes(page).first()).toBeVisible();
    await expect(ui(page).locator('.note', { hasText: 'Hover a day' })).toContainText('Interaction');

    await openToolbar(page);
    await expect(tool(page, 'Annotate an element')).toHaveCount(0);
    await expect(tool(page, 'Copy as Markdown')).toHaveCount(0);

    // Clicking a note selects it; it never opens an editor for viewers.
    await ui(page).locator('.note', { hasText: 'Hover a day' }).click();
    await expect(ui(page).locator('.note.is-active')).toHaveCount(1);
    await expect(ui(page).locator('.editor')).toHaveCount(0);

    await page.getByRole('link', { name: 'Agents' }).click();
    await expect(page).toHaveURL(/\/s\/my-proto\/agents$/);
    await expect(markers(page)).toHaveCount(2);
    await page.goBack();
    await expect(markers(page)).toHaveCount(3);
  });

  test('a deep link under the prefix still finds its annotations', async ({ page }) => {
    await page.goto(PROD + 'agents');
    await expect(markers(page)).toHaveCount(2);
  });

  test('hide/show from the toolbar, remembered across reloads', async ({ page }) => {
    await page.goto(PROD);
    await expect(notes(page).first()).toBeVisible();
    await openToolbar(page);
    await tool(page, 'Hide annotations').click();
    await expect(notes(page).first()).toBeHidden();
    await expect(markers(page).first()).toBeHidden();
    await page.reload();
    await expect(markers(page).first()).toBeHidden();
    await tool(page, 'Show annotations').click();
    await expect(markers(page).first()).toBeVisible();
  });

  test('settings: numbers-only display, then a marker reveals its note', async ({ page }) => {
    await page.goto(PROD);
    await openToolbar(page);
    await tool(page, 'Settings').click();
    await ui(page).locator('.seg[aria-label="Show notes"] button', { hasText: 'Numbers only' }).click();
    await expect(notes(page).first()).toBeHidden();
    await page.reload();
    await expect(notes(page).first()).toBeHidden();
    await markers(page).first().click();
    await expect(ui(page).locator('.note.is-active')).toBeVisible();
  });

  test('an annotation whose element disappears moves to Unanchored', async ({ page }) => {
    await page.goto(PROD);
    await expect(markers(page)).toHaveCount(3);
    await page.evaluate(() => document.querySelector('[data-annotoo-id="spend-chart"]')!.remove());
    await openToolbar(page);
    await tool(page, 'Annotation list').click();
    await expect(ui(page).locator('.panel')).toContainText('Unanchored · element not found (1)');
    await expect(ui(page).locator('.marker[data-id="a_seed_3"]')).toBeHidden();
  });

  test('?annotoo=off disables the widget', async ({ page }) => {
    await page.goto(PROD + '?annotoo=off');
    await expect(page.locator('h1')).toHaveText('Analytics');
    await expect(ui(page)).toHaveCount(0);
  });

  test('no console errors or extra requests for viewers', async ({ page }) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    // The app's own font requests go to Google; we only care about same-origin traffic.
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.origin === new URL(PROD).origin) requests.push(url.pathname);
    });
    await page.goto(PROD);
    await expect(markers(page)).toHaveCount(3);
    expect(errors).toEqual([]);
    expect(requests.some((p) => p.includes('__annotoo'))).toBe(false);
    expect(requests.every((p) => p.startsWith('/s/my-proto/'))).toBe(true);
  });
});
