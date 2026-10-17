// Post-build: embed a copy of the built bundle into itself.
//
// The source contains a placeholder string `__ANNOTOO_SELF_SRC__`. After Vite builds the
// IIFE, we replace that placeholder with a JSON-encoded copy of the *pre-replacement*
// build output. At runtime `SELF_SRC` then holds the widget's own source, which the
// "Export HTML" action inlines into the exported HTML so it boots with no network.
//
// The embedded copy still contains the placeholder — harmless, because viewers never
// re-export, so the widget never needs to embed itself a second time.
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../dist/annotoo.js', import.meta.url);
const built = readFileSync(path, 'utf8');

// Match the placeholder as a string literal regardless of quote style the minifier chose.
const token = /(['"])__ANNOTOO_SELF_SRC__\1/;
if (!token.test(built)) {
  console.error('inline-self: placeholder __ANNOTOO_SELF_SRC__ not found in build output.');
  process.exit(1);
}

const final = built.replace(token, () => JSON.stringify(built));
writeFileSync(path, final);
console.log(`inline-self: embedded self source (${built.length} bytes).`);
