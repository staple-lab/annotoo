import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRouteResolver, isOnRoute, normalizePath, onLocationChange } from '../src/router';

function at(path: string) {
  history.replaceState(null, '', path);
}

afterEach(() => at('/'));

describe('normalizePath', () => {
  test.each([
    ['/', '/'],
    ['', '/'],
    ['/a/b/', '/a/b'],
    ['/a/index.html', '/a'],
    ['/index.html', '/'],
    ['shipments', '/shipments'],
  ])('%s → %s', (input, out) => expect(normalizePath(input)).toBe(out));
});

describe('createRouteResolver', () => {
  test('author mode records the exact path', () => {
    at('/shipments/');
    expect(createRouteResolver({ mode: 'author' })([])).toBe('/shipments');
  });

  test('viewer: exact match when hosted at the root', () => {
    at('/shipments');
    expect(createRouteResolver({ mode: 'viewer' })(['/', '/shipments'])).toBe('/shipments');
  });

  test('viewer: matches the longest known route under a hosting prefix', () => {
    at('/s/my-proto/shipments/detail');
    const r = createRouteResolver({ mode: 'viewer' });
    expect(r(['/', '/detail', '/shipments/detail'])).toBe('/shipments/detail');
  });

  test('viewer: an unknown path under a prefix is treated as the app root', () => {
    at('/s/my-proto/');
    expect(createRouteResolver({ mode: 'viewer' })(['/', '/shipments'])).toBe('/');
  });

  test('basePath is stripped in either mode', () => {
    at('/proto/shipments');
    expect(createRouteResolver({ mode: 'author', basePath: '/proto/' })([])).toBe('/shipments');
    expect(createRouteResolver({ mode: 'viewer', basePath: '/proto' })([])).toBe('/shipments');
    at('/proto');
    expect(createRouteResolver({ mode: 'viewer', basePath: '/proto' })([])).toBe('/');
  });

  test('route: false disables scoping; a function overrides it', () => {
    expect(createRouteResolver({ mode: 'viewer', route: false })(['/x'])).toBeNull();
    expect(createRouteResolver({ mode: 'viewer', route: () => '#/tab' })([])).toBe('#/tab');
  });
});

describe('isOnRoute', () => {
  test('route-less comments show everywhere, and null route shows all', () => {
    expect(isOnRoute({}, '/a')).toBe(true);
    expect(isOnRoute({ route: '/a' }, null)).toBe(true);
    expect(isOnRoute({ route: '/a/' }, '/a')).toBe(true);
    expect(isOnRoute({ route: '/a' }, '/b')).toBe(false);
  });
});

describe('onLocationChange', () => {
  test('fires on pushState and popstate, not on no-op changes', () => {
    const spy = vi.fn();
    const stop = onLocationChange(spy);
    history.pushState(null, '', '/one');
    history.replaceState(null, '', '/one');
    expect(spy).toHaveBeenCalledTimes(1);
    history.pushState(null, '', '/two');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(spy).toHaveBeenCalledTimes(2);
    stop();
    history.pushState(null, '', '/three');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
