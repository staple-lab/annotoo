import { annotationsToMarkdown } from '../src/markdown';
import type { Annotation } from '../src/types';

const a = (n: number, extra: Partial<Annotation> = {}): Annotation => ({
  id: String(n),
  n,
  anchor: { selector: `#el-${n}`, textSnippet: `Text ${n}`, offset: { x: 0.5, y: 0.5 } },
  body: `Body ${n}`,
  createdAt: n,
  ...extra,
});

describe('annotationsToMarkdown', () => {
  test('lists annotations in badge order under the page title', () => {
    const md = annotationsToMarkdown([a(2, { category: 'interaction' }), a(1, { title: 'Header', category: 'content' })], 'Checkout');
    expect(md).toBe(
      [
        '# Checkout',
        '',
        '## 1. Header',
        '',
        '*Content* · `#el-1` · “Text 1”',
        '',
        'Body 1',
        '',
        '## 2. Interaction',
        '',
        '`#el-2` · “Text 2”',
        '',
        'Body 2',
        '',
      ].join('\n'),
    );
  });

  test('groups by page when annotations carry routes', () => {
    const md = annotationsToMarkdown([a(1, { route: '/agents' }), a(2), a(3, { route: '/agents' })], '');
    expect(md.startsWith('# Annotations\n')).toBe(true);
    expect(md.match(/^## .*/gm)).toEqual(['## /agents', '## Every page']);
    expect(md.match(/^### .*/gm)).toEqual(['### 1. Note', '### 3. Note', '### 2. Note']);
  });
});
