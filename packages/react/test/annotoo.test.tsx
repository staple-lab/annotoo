import { StrictMode } from 'react';
import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Annotoo, type Annotation } from '../src/index';

const annotation = (id: string, selector: string): Annotation => ({
  id,
  n: 1,
  anchor: { selector, textSnippet: '', offset: { x: 0.5, y: 0.5 } },
  body: 'hello',
  createdAt: 0,
});

const markers = () => document.getElementById('annotoo-root')?.shadowRoot?.querySelectorAll('.marker').length ?? 0;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

test('mounts once under StrictMode and cleans up on unmount', async () => {
  const { unmount } = render(
    <StrictMode>
      <h1 id="t">Title</h1>
      <Annotoo annotations={[annotation('a', '#t')]} />
    </StrictMode>,
  );
  await flush();
  expect(document.querySelectorAll('#annotoo-root')).toHaveLength(1);
  expect(markers()).toBe(1);
  unmount();
  expect(document.getElementById('annotoo-root')).toBeNull();
});

test('updates markers when the annotations prop changes (viewer)', async () => {
  const { rerender } = render(<><h1 id="t">T</h1><p id="p">P</p><Annotoo annotations={[annotation('a', '#t')]} /></>);
  await flush();
  expect(markers()).toBe(1);
  rerender(<><h1 id="t">T</h1><p id="p">P</p><Annotoo annotations={[annotation('a', '#t'), annotation('b', '#p')]} /></>);
  await flush();
  expect(markers()).toBe(2);
});

test('disabled renders nothing', async () => {
  render(<Annotoo disabled annotations={[annotation('a', '#t')]} />);
  await flush();
  expect(document.getElementById('annotoo-root')).toBeNull();
});
