import { beforeEach, describe, expect, test } from 'vitest';
import { serialize, resolve, textSnippet } from './src/anchor';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('serialize', () => {
  test('uses #id selector when the element has a unique id', () => {
    document.body.innerHTML = `<button id="save-btn">Save</button>`;
    const el = document.getElementById('save-btn')!;
    expect(serialize(el).selector).toBe('#save-btn');
  });

  test('builds a nth-of-type path when there is no id', () => {
    document.body.innerHTML = `
      <div><p>first</p><p>second</p><p>third</p></div>`;
    const el = document.querySelectorAll('p')[1]!; // "second"
    const anchor = serialize(el);
    expect(anchor.selector).toContain('p:nth-of-type(2)');
    // The path must actually select the same element.
    expect(document.querySelector(anchor.selector)).toBe(el);
  });

  test('captures a collapsed text snippet', () => {
    document.body.innerHTML = `<p>  Hello   world  </p>`;
    const el = document.querySelector('p')!;
    expect(serialize(el).textSnippet).toBe('Hello world');
  });

  test('defaults offset to the element centre when no click point is given', () => {
    document.body.innerHTML = `<p>x</p>`;
    const el = document.querySelector('p')!;
    expect(serialize(el).offset).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('resolve', () => {
  test('round-trips: serialize then resolve returns the same element', () => {
    document.body.innerHTML = `
      <section><ul><li>a</li><li>b</li><li>c</li></ul></section>`;
    const el = document.querySelectorAll('li')[2]!; // "c"
    expect(resolve(serialize(el))).toBe(el);
  });

  test('falls back to the text snippet when the selector no longer matches', () => {
    document.body.innerHTML = `<div><p>keep me</p></div>`;
    const el = document.querySelector('p')!;
    const anchor = serialize(el);
    // Simulate the page changing: an extra element shifts nth-of-type paths,
    // but the text is still present on the same node.
    const anchorBroken = { ...anchor, selector: 'p:nth-of-type(99)' };
    expect(resolve(anchorBroken)).toBe(el);
  });

  test('disambiguates multiple selector matches by text snippet', () => {
    document.body.innerHTML = `<button class="x">One</button><button class="x">Two</button>`;
    const second = document.querySelectorAll('button')[1]!;
    const anchor = { selector: '.x', textSnippet: 'Two', offset: { x: 0.5, y: 0.5 } };
    expect(resolve(anchor)).toBe(second);
  });

  test('prefers the most specific (deepest) element when falling back by text', () => {
    document.body.innerHTML = `<div><span>target</span></div>`;
    const span = document.querySelector('span')!;
    // Both the div and the span have textContent "target"; fallback should pick the span.
    const anchor = { selector: 'nope', textSnippet: 'target', offset: { x: 0.5, y: 0.5 } };
    expect(resolve(anchor)).toBe(span);
  });

  test('returns null when nothing matches', () => {
    document.body.innerHTML = `<p>only this</p>`;
    const anchor = { selector: 'h1', textSnippet: 'gone', offset: { x: 0.5, y: 0.5 } };
    expect(resolve(anchor)).toBeNull();
  });

  test('does not throw on an invalid selector, falls back instead', () => {
    document.body.innerHTML = `<p>findable</p>`;
    const el = document.querySelector('p')!;
    const anchor = { selector: '>>>bad', textSnippet: 'findable', offset: { x: 0.5, y: 0.5 } };
    expect(resolve(anchor)).toBe(el);
  });
});

describe('textSnippet helper', () => {
  test('collapses whitespace and truncates to 40 chars', () => {
    const long = 'a'.repeat(60);
    document.body.innerHTML = `<p>${long}</p>`;
    expect(textSnippet(document.querySelector('p')!)).toHaveLength(40);
  });
});
