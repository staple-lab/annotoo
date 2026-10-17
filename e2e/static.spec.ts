import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// The script-tag path: author on a plain HTML page, Export HTML, open the export with
// no network and no annotoo.js beside it.
test('static page: annotate → Export HTML → self-contained viewer', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'annotoo-static-'));
  copyFileSync('packages/core/dist/annotoo.js', join(dir, 'annotoo.js'));
  writeFileSync(join(dir, 'index.html'), readFileSync('examples/static/index.html', 'utf8').replace('/annotoo.js', 'annotoo.js'));

  await page.goto('file://' + join(dir, 'index.html'));
  const ui = page.locator('#annotoo-root');
  await ui.locator('button[aria-label="Open Annotoo"]').click();
  // Opening the tab goes straight into annotate mode.
  await expect(ui.locator('button[aria-label="Stop annotating"]')).toHaveCount(1);
  await page.locator('#primary-cta').click();
  await ui.locator('.editor textarea').fill('Starts a new shipment');
  await ui.locator('.editor textarea').press('ControlOrMeta+Enter');
  await expect(ui.locator('.marker')).toHaveCount(1);

  const download = page.waitForEvent('download');
  await ui.locator('button[aria-label^="Export HTML"]').click();
  const file = join(dir, 'exported.html');
  await (await download).saveAs(file);

  // Open the export in a fresh, offline context: everything must be inlined.
  const ctx = await page.context().browser()!.newContext({ offline: true });
  const viewer = await ctx.newPage();
  const outDir = mkdtempSync(join(tmpdir(), 'annotoo-export-'));
  copyFileSync(file, join(outDir, 'page.html'));
  await viewer.goto('file://' + join(outDir, 'page.html'));
  const vui = viewer.locator('#annotoo-root');
  await expect(vui.locator('.marker')).toHaveCount(1);
  await expect(vui.locator('.note')).toContainText('Starts a new shipment');
  await vui.locator('.note').click();
  await expect(vui.locator('.editor')).toHaveCount(0);
  await ctx.close();
});
