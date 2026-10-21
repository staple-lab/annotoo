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

  test('includes attributed replies and resolution history', () => {
    const author = { id: 'git:one', name: 'Designer' };
    const reviewer = { id: 'git:two', name: 'Engineer' };
    const md = annotationsToMarkdown([a(1, { author, status: 'resolved', resolvedBy: reviewer, resolvedAt: 3,
      replies: [{ id: 'r1', body: 'Fixed the contrast.', author: reviewer, createdAt: 2 }],
      events: [{ id: 'e1', type: 'resolved', author: reviewer, createdAt: 3 }] })], 'Review');
    expect(md).toContain('By Designer');
    expect(md).toContain('**Engineer**');
    expect(md).toContain('Fixed the contrast.');
    expect(md).toContain('Resolved by Engineer');
    expect(md).toContain('**Resolved** by Engineer');
  });

  test('exports current ownership and assignment history without changing authorship', () => {
    const jane = { id: 'jane', name: 'Jane Doe' };
    const sam = { id: 'sam', name: 'Sam Lee' };
    const md = annotationsToMarkdown([a(1, { author: jane, assignee: sam,
      events: [
        { id: 'e1', type: 'unassigned', author: jane, createdAt: 2 },
        { id: 'e2', type: 'assigned', author: jane, assignee: sam, createdAt: 3 },
      ] })], 'Review');
    expect(md).toContain('By Jane Doe');
    expect(md).toContain('Assigned to Sam Lee');
    expect(md).toContain('Unassigned by Jane Doe');
    expect(md).toContain('Assigned to Sam Lee by Jane Doe');
    expect(md).not.toContain('Reopened');
  });

});
