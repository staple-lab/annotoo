// The build (scripts/inline-self.mjs) replaces the placeholder token below with a
// JSON-encoded copy of the built bundle, so `export.ts` can inline the widget into a
// self-contained exported page.
//
// We assign to a global via bracket access rather than exporting a `const`, so esbuild
// can't constant-fold the value and dead-code-eliminate the placeholder during minify.

const KEY = '__ANNOTOO_SRC__';

(globalThis as Record<string, unknown>)[KEY] = '__ANNOTOO_SELF_SRC__';

export function getSelfSrc(): string {
  const v = (globalThis as Record<string, unknown>)[KEY];
  return typeof v === 'string' ? v : '';
}

/** True once the post-build step has inlined the real source (i.e. not the placeholder). */
export function hasInlinedSelf(): boolean {
  const v = getSelfSrc();
  return v.length > 0 && !v.startsWith('__ANNOTOO_SELF');
}
