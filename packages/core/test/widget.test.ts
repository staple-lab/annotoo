import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, memoryStorage, type Annotation, type AnnotooInstance } from '../src/index';

let inst: AnnotooInstance | null = null;

const shadow = () => document.getElementById('annotoo-root')!.shadowRoot!;
const q = <T extends Element = HTMLElement>(sel: string) => shadow().querySelector<T>(sel);
const qa = (sel: string) => shadow().querySelectorAll(sel);
const button = (label: string) => q<HTMLButtonElement>(`button[aria-label="${label}"]`);
const markers = () => qa('.marker:not(.is-draft)');

function annotation(id: string, n: number, selector: string, extra: Partial<Annotation> = {}): Annotation {
  return {
    id,
    n,
    anchor: { selector, textSnippet: '', offset: { x: 0.5, y: 0.5 } },
    body: `note ${n}`,
    createdAt: Date.now(),
    ...extra,
  };
}

async function openToolbar() {
  button('Open Annotoo')!.click();
}

// jsdom has no layout: give page elements a real box so annotations count as on screen.
const realRect = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.closest('main') ? new DOMRect(100, 100, 120, 40) : realRect.call(this);
  };
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.body.innerHTML = `<main><h1 id="title">Dashboard</h1><button id="cta">Create</button></main>`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  inst?.destroy();
  inst = null;
  vi.unstubAllGlobals();
});

describe('viewer mode', () => {
  test('renders a marker, outline and note per annotation on the current route', async () => {
    inst = mount({
      annotations: [
        annotation('a', 1, '#title', { title: 'Page title', category: 'content' }),
        annotation('b', 2, '#cta', { category: 'interaction' }),
        annotation('c', 3, '#cta', { route: '/elsewhere' }),
      ],
    });
    expect(await inst.ready).toBe('viewer');
    expect(markers()).toHaveLength(2);
    expect(qa('.note')).toHaveLength(2);
    expect(qa('.outline')).toHaveLength(2);
    expect(q('.note[data-id="a"]')!.classList.contains('is-off')).toBe(false);
    const first = q('.note[data-id="a"]')!;
    expect(first.textContent).toContain('Content');
    expect(first.textContent).toContain('Page title');
    expect(first.textContent).toContain('note 1');
  });

  test('on narrow screens, always-on notes fall back to numbers only', async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      inst = mount({ annotations: [annotation('a', 1, '#title')] });
      await inst.ready;
      expect(q('.note[data-id="a"]')!.classList.contains('is-off')).toBe(true);
      q<HTMLButtonElement>('.marker')!.click();
      expect(q('.note[data-id="a"]')!.classList.contains('is-off')).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    }
  });

  test('the floating launcher opens a toolbar with view tools only', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    expect(button('Open Annotoo')!.textContent).toContain('1');
    await openToolbar();
    expect(button('Annotate an element')).toBeNull();
    expect(button('Copy as Markdown')).toBeNull();
    expect(button('Hide annotations')).not.toBeNull();
    expect(button('Annotation list')).not.toBeNull();
    expect(button('Settings')).not.toBeNull();
    button('Close toolbar')!.click();
    expect(button('Open Annotoo')).not.toBeNull();
  });

  test('dragging the tab to the other half of the screen moves it there, without opening it', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    const tab = button('Open Annotoo')!;
    const fire = (target: EventTarget, type: string, x: number, y: number) => target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, composed: true }));
    fire(tab, 'pointerdown', 900, 740);
    // Moves and the release land wherever the pointer is, not on the tab.
    fire(window, 'pointermove', 600, 740);
    fire(window, 'pointermove', 100, 740);
    fire(window, 'pointerup', 100, 740);
    tab.click(); // the click that ends a drag
    expect(q('.dock')!.classList.contains('left')).toBe(true);
    expect(button('Open Annotoo')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('annotoo:settings')!).position).toBe('bottom-left');
    // A plain click still opens it.
    button('Open Annotoo')!.click();
    expect(button('Close toolbar')).not.toBeNull();
  });

  test('dragging towards the top snaps the tab to a top corner', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    const tab = button('Open Annotoo')!;
    const fire = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, composed: true }));
    fire(tab, 'pointerdown', 980, 740);
    fire(window, 'pointermove', 980, 300);
    fire(window, 'pointermove', 990, 40);
    fire(window, 'pointerup', 990, 40);
    tab.click();
    const dock = q('.dock')!;
    expect(dock.classList.contains('top')).toBe(true);
    expect(dock.classList.contains('left')).toBe(false);
    expect(JSON.parse(localStorage.getItem('annotoo:settings')!).position).toBe('top-right');
  });

  test('hide/show from the toolbar, remembered', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    await openToolbar();
    button('Hide annotations')!.click();
    expect(q('.layer')!.classList.contains('is-hidden')).toBe(true);
    expect(localStorage.getItem('annotoo:visible')).toBe('0');
    button('Show annotations')!.click();
    expect(q('.layer')!.classList.contains('is-hidden')).toBe(false);
  });

  test('there are no single-key shortcuts', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', shiftKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(q('.layer')!.classList.contains('is-hidden')).toBe(false);
  });

  test('settings: display mode, outlines, theme and position apply and persist', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    await openToolbar();
    button('Settings')!.click();
    const settings = q('.settings')!;
    expect(settings).not.toBeNull();

    const pick = (group: string, text: string) =>
      Array.from(q(`.seg[aria-label="${group}"]`)!.querySelectorAll('button')).find((b) => b.textContent === text)!.click();

    pick('Show notes', 'Numbers only');
    expect(q('.note[data-id="a"]')!.classList.contains('is-off')).toBe(true);
    // Clicking a marker opens its note in numbers-only mode.
    q<HTMLButtonElement>('.marker')!.click();
    expect(q('.note[data-id="a"]')!.classList.contains('is-off')).toBe(false);

    q<HTMLButtonElement>('.switch[aria-label="Outline annotated elements"]')!.click();
    pick('Theme', 'Dark');
    expect(document.getElementById('annotoo-root')!.getAttribute('data-theme')).toBe('dark');
    q<HTMLButtonElement>('.corners button[data-corner="top-left"]')!.click();
    expect(q('.dock')!.classList.contains('left')).toBe(true);
    expect(q('.dock')!.classList.contains('top')).toBe(true);

    expect(JSON.parse(localStorage.getItem('annotoo:settings')!)).toEqual({
      display: 'markers',
      outlines: false,
      theme: 'dark',
      position: 'top-left',
    });
  });

  test('mount options set the defaults; a viewer’s own settings win', async () => {
    localStorage.setItem('annotoo:settings', JSON.stringify({ display: 'hover' }));
    inst = mount({ annotations: [annotation('a', 1, '#title')], display: 'markers', theme: 'light' });
    await inst.ready;
    expect(document.getElementById('annotoo-root')!.getAttribute('data-theme')).toBe('light');
    await openToolbar();
    button('Settings')!.click();
    const checked = q('.seg[aria-label="Show notes"] button[aria-checked="true"]')!;
    expect(checked.textContent).toBe('On hover');
  });

  test('the list panel separates other pages and missing elements', async () => {
    inst = mount({
      annotations: [annotation('a', 1, '#title'), annotation('b', 2, '#gone'), annotation('c', 3, '#cta', { route: '/other' })],
    });
    await inst.ready;
    await openToolbar();
    button('Annotation list')!.click();
    const text = q('.panel')!.textContent!;
    expect(text).toContain('Unanchored');
    expect(text).toContain('Other pages (1)');
  });

  test('follows an anchor when the framework reuses its old DOM node for something else', async () => {
    document.body.innerHTML = `<main><div id="wrap"><div data-annotoo-id="stat">A</div></div></main>`;
    inst = mount({ annotations: [annotation('a', 1, '[data-annotoo-id="stat"]')] });
    await inst.ready;
    const reused = document.querySelector('[data-annotoo-id="stat"]')!;
    // Like React reconciling: the same node loses the hook, a new child gets it.
    reused.removeAttribute('data-annotoo-id');
    const moved = document.createElement('div');
    moved.setAttribute('data-annotoo-id', 'stat');
    reused.append(moved);
    await new Promise((r) => setTimeout(r, 50));
    Element.prototype.getBoundingClientRect = function (this: Element) {
      return this === moved ? new DOMRect(300, 300, 50, 20) : new DOMRect(100, 100, 400, 200);
    };
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 50));
    expect(q('.outline')!.style.left).toBe('297px');
  });

  test('setAnnotations updates markers in viewer mode', async () => {
    inst = mount({ annotations: [] });
    await inst.ready;
    expect(markers()).toHaveLength(0);
    inst.setAnnotations([annotation('a', 1, '#title')]);
    expect(markers()).toHaveLength(1);
  });

  test('?annotoo=off does not boot', async () => {
    history.replaceState(null, '', '/?annotoo=off');
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    expect(await inst.ready).toBeNull();
    expect(document.getElementById('annotoo-root')).toBeNull();
  });
});

describe('auto mode', () => {
  afterEach(() => {
    delete (window as { __ANNOTOO_DEV__?: unknown }).__ANNOTOO_DEV__;
  });

  test('does not touch the network without the dev plugin hint', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    expect(await inst.ready).toBe('viewer');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('becomes author mode when the dev plugin is announced and answers', async () => {
    (window as { __ANNOTOO_DEV__?: unknown }).__ANNOTOO_DEV__ = { endpoint: '/__x' };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ annotoo: 1, file: 'src/a.json', annotations: [annotation('a', 1, '#title')] })));
    inst = mount({ annotations: [] });
    expect(await inst.ready).toBe('author');
    expect(fetch).toHaveBeenCalledWith('/__x', expect.anything());
    expect(markers()).toHaveLength(1);
  });

  test('falls back to viewer when the announced endpoint does not answer', async () => {
    (window as { __ANNOTOO_DEV__?: unknown }).__ANNOTOO_DEV__ = {};
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    expect(await inst.ready).toBe('viewer');
  });
});

describe('author mode', () => {
  function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  test('annotate tool → click element → fill in → ⌘Enter saves', async () => {
    const storage = memoryStorage([]);
    const save = vi.spyOn(storage, 'save');
    const onChange = vi.fn();
    inst = mount({ storage, onChange });
    expect(await inst.ready).toBe('author');

    await openToolbar();
    // Opening the tab starts annotate mode straight away.
    expect(button('Stop annotating')).not.toBeNull();

    // The prototype must not see clicks while annotating.
    const pageClick = vi.fn();
    document.getElementById('cta')!.addEventListener('click', pageClick);
    document.getElementById('cta')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: 5, clientY: 5 }));
    expect(pageClick).not.toHaveBeenCalled();

    expect(q('.editor')).not.toBeNull();
    expect(q('.marker.is-draft')).not.toBeNull();
    q<HTMLButtonElement>('.cat-toggle[data-cat="interaction"]')!.click();
    type(q<HTMLInputElement>('.editor input.title')!, 'Create button');
    const body = q<HTMLTextAreaElement>('.editor textarea')!;
    type(body, 'Opens the booking flow.');
    body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

    expect(save).toHaveBeenCalledOnce();
    const [saved] = save.mock.calls[0];
    expect(saved[0]).toMatchObject({ title: 'Create button', body: 'Opens the booking flow.', category: 'interaction', n: 1, route: '/' });
    expect(saved[0].anchor.selector).toBe('#cta');
    // The new note stays open (selected) rather than collapsing to its badge.
    expect(q(`.note[data-id="${saved[0].id}"]`)!.classList.contains('is-active')).toBe(true);
    expect('author' in saved[0]).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
    expect(markers()).toHaveLength(1);
    expect(q('.editor')).toBeNull();
    // Still annotating, ready for the next element.
    expect(button('Stop annotating')).not.toBeNull();
  });

  test('plain Enter in the body adds a new line rather than saving', async () => {
    inst = mount({ storage: memoryStorage([]) });
    await inst.ready;
    await openToolbar();
    document.getElementById('title')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    const body = q<HTMLTextAreaElement>('.editor textarea')!;
    type(body, 'line one');
    body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(q('.editor')).not.toBeNull();
  });

  test('Add is disabled until there is a body; no name is needed', async () => {
    inst = mount({ storage: memoryStorage([]) });
    await inst.ready;
    await openToolbar();
    document.getElementById('title')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    const add = Array.from(qa('.editor .btn.primary'))[0] as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    type(q<HTMLTextAreaElement>('.editor textarea')!, 'hello');
    expect(add.disabled).toBe(false);
    expect(q('.editor input.name')).toBeNull();
  });

  test('notes are locked until Annotate is on', async () => {
    inst = mount({ storage: memoryStorage([annotation('a', 1, '#title')]) });
    await inst.ready;
    q<HTMLElement>('.note[data-id="a"]')!.click();
    expect(q('.editor')).toBeNull();
    expect(q('.note[data-id="a"]')!.classList.contains('is-active')).toBe(true);
  });

  test('clicking a note while annotating edits it in place; delete offers undo', async () => {
    const storage = memoryStorage([annotation('a', 1, '#title')]);
    inst = mount({ storage });
    await inst.ready;
    await openToolbar();
    q<HTMLElement>('.note[data-id="a"]')!.click();
    expect(q('.editor')).not.toBeNull();
    expect(q('.note[data-id="a"]')!.classList.contains('is-off')).toBe(true);
    expect(q<HTMLTextAreaElement>('.editor textarea')!.value).toBe('note 1');
    button('Delete annotation')!.click();
    expect(markers()).toHaveLength(0);
    q<HTMLButtonElement>('.toast button')!.click();
    expect(markers()).toHaveLength(1);
    expect(storage.load()).toHaveLength(1);
  });

  test('delete all from settings, with undo', async () => {
    const storage = memoryStorage([annotation('a', 1, '#title'), annotation('b', 2, '#cta')]);
    inst = mount({ storage });
    await inst.ready;
    await openToolbar();
    button('Settings')!.click();
    q<HTMLButtonElement>('.settings .danger-link')!.click();
    expect(markers()).toHaveLength(0);
    q<HTMLButtonElement>('.toast button')!.click();
    expect(markers()).toHaveLength(2);
  });

  test('keystrokes typed in the widget do not reach the page', async () => {
    inst = mount({ storage: memoryStorage([annotation('a', 1, '#title')]) });
    await inst.ready;
    const pageKeys = vi.fn();
    window.addEventListener('keydown', pageKeys);
    await openToolbar();
    q<HTMLButtonElement>('.marker')!.click();
    q('.editor textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, composed: true }));
    expect(pageKeys).not.toHaveBeenCalled();
    window.removeEventListener('keydown', pageKeys);
  });

  test('a toolbar restored open on load does not start annotate mode', async () => {
    localStorage.setItem('annotoo:open', '1');
    inst = mount({ storage: memoryStorage([]) });
    await inst.ready;
    expect(button('Annotate an element')).not.toBeNull();
    expect(button('Stop annotating')).toBeNull();
  });

  test('viewers opening the tab never enter annotate mode', async () => {
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    await inst.ready;
    await openToolbar();
    expect(button('Stop annotating')).toBeNull();
    const pageClick = vi.fn();
    document.getElementById('cta')!.addEventListener('click', pageClick);
    document.getElementById('cta')!.click();
    expect(pageClick).toHaveBeenCalled();
  });

  test('⌥A opens the toolbar into annotate mode and toggles it; ⌥H shows and hides', async () => {
    inst = mount({ storage: memoryStorage([annotation('a', 1, '#title')]) });
    await inst.ready;
    const alt = (code: string, init: KeyboardEventInit = {}) =>
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'KeyA' ? 'å' : '˙', altKey: true, bubbles: true, ...init }));
    alt('KeyA');
    expect(button('Stop annotating')).not.toBeNull();
    alt('KeyA');
    expect(button('Annotate an element')).not.toBeNull();
    alt('KeyH');
    expect(q('.layer')!.classList.contains('is-hidden')).toBe(true);
    alt('KeyH');
    expect(q('.layer')!.classList.contains('is-hidden')).toBe(false);
    // Other modifiers don't count.
    alt('KeyH', { metaKey: true });
    expect(q('.layer')!.classList.contains('is-hidden')).toBe(false);
  });

  test('shortcuts are ignored while typing in the page, and can be turned off', async () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="field" />');
    inst = mount({ storage: memoryStorage([]) });
    await inst.ready;
    document.getElementById('field')!.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', altKey: true, bubbles: true, composed: true }));
    expect(button('Stop annotating')).toBeNull();
    inst.destroy();
    inst = mount({ storage: memoryStorage([]), shortcuts: false });
    await inst.ready;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', altKey: true }));
    expect(button('Stop annotating')).toBeNull();
  });

  test('shortcuts are listed in Settings and on the buttons', async () => {
    inst = mount({ storage: memoryStorage([]) });
    await inst.ready;
    await openToolbar();
    expect(button('Stop annotating')!.getAttribute('aria-keyshortcuts')).toBe('Alt+A');
    button('Settings')!.click();
    const keys = q('.settings .keys')!.textContent!;
    expect(keys).toContain('Annotate');
    expect(keys).toContain('Show or hide annotations');
    expect(keys).toContain('Esc');
  });

  test('Escape cancels the editor, then leaves annotate mode', async () => {
    inst = mount({ storage: memoryStorage([]) });
    await inst.ready;
    await openToolbar();
    document.getElementById('title')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('.editor')).toBeNull();
    expect(button('Stop annotating')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(button('Annotate an element')).not.toBeNull();
  });
});
