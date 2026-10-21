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

  test('keeps author writes locked when the announced Git endpoint does not answer', async () => {
    (window as { __ANNOTOO_DEV__?: unknown }).__ANNOTOO_DEV__ = {};
    inst = mount({ annotations: [annotation('a', 1, '#title')] });
    expect(await inst.ready).toBe('author');
    await openToolbar();
    expect(button('Annotate an element')!.disabled).toBe(true);
    button('Annotation list')!.click();
    expect(q('.panel .identity-help')!.textContent).toContain('could not be loaded');
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

describe('collaborative threads', () => {
  let current: Annotation[] = [];
  const mountThread = (options: Parameters<typeof mount>[0] = {}) => {
    const loaded = options.storage?.load();
    current = Array.isArray(loaded) ? loaded : options.annotations ?? [];
    return mount({ ...options, onChange(next) { current = next; options.onChange?.(next); } });
  };
  const alice = { id: 'git:alice', name: 'Alice Chen' };
  const bob = { id: 'git:bob', name: 'Bob Rivera' };
  const typeReply = (text: string) => {
    const input = q<HTMLTextAreaElement>('.thread textarea')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    return input;
  };
  const filter = (text: string) => Array.from(qa('.thread-filters button')).find((b) => b.textContent === text)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  test('opens discussion independently of Annotate and appends attributed replies', async () => {
    const storage = { ...memoryStorage([annotation('a', 1, '#title', { author: alice })]), identity: bob };
    inst = mountThread({ storage });
    await inst.ready;
    button('Open thread 1')!.click();
    expect(q('.editor')).toBeNull();
    expect(q('.thread')!.textContent).toContain('Alice Chen');
    expect(q('.thread time')!.getAttribute('datetime')).toBeTruthy();
    expect(q('.thread .reply-as')!.textContent).toContain('Bob Rivera');
    typeReply('Let’s ship this once the label is clearer.');
    button('Reply')!.click();
    expect(current[0].replies).toEqual([expect.objectContaining({ body: 'Let’s ship this once the label is clearer.', author: bob })]);
    expect(q('.thread .reply')!.textContent).toContain('Bob Rivera');
    expect(q<HTMLTextAreaElement>('.thread textarea')!.value).toBe('');
    expect(q('.toast')!.textContent).toBe('Reply added');
    expect(button('Stop annotating')).toBeNull();
  });

  test('resolve and reopen retain attribution/history and filter resolved pins', async () => {
    const storage = { ...memoryStorage([annotation('a', 1, '#title')]), identity: alice };
    inst = mountThread({ storage });
    await inst.ready;
    button('Open thread 1')!.click();
    button('Resolve thread')!.click();
    expect(markers()).toHaveLength(0);
    expect(current[0]).toMatchObject({ status: 'resolved', resolvedBy: alice, resolvedAt: expect.any(Number) });
    expect(q('.thread .thread-event')!.textContent).toContain('Alice Chen resolved this thread');
    button('Close thread')!.click();
    await openToolbar();
    button('Annotation list')!.click();
    expect(qa('.panel .item')).toHaveLength(0);
    filter('Resolved');
    expect(qa('.panel .item')).toHaveLength(1);
    q<HTMLButtonElement>('.panel .item')!.click();
    button('Reopen thread')!.click();
    expect(markers()).toHaveLength(1);
    expect(current[0]).toMatchObject({ status: 'open', events: [expect.objectContaining({ type: 'resolved', author: alice }), expect.objectContaining({ type: 'reopened', author: alice })] });
    expect(current[0].resolvedAt).toBeUndefined();
    expect(current[0].resolvedBy).toBeUndefined();
    filter('All');
    expect(qa('.panel .item')).toHaveLength(1);
  });

  test('viewers read legacy attribution, replies, and resolution history without write controls', async () => {
    inst = mountThread({ annotations: [annotation('a', 1, '#title', {
      status: 'resolved', replies: [{ id: 'r', body: 'Done', author: alice, createdAt: Date.now() }],
      events: [{ id: 'e', type: 'resolved', author: bob, createdAt: Date.now() }],
    })] });
    await inst.ready;
    expect(markers()).toHaveLength(0);
    await openToolbar();
    button('Annotation list')!.click();
    filter('Resolved');
    q<HTMLButtonElement>('.panel .item')!.click();
    expect(q('.thread .root-comment .byline')!.textContent).toContain('Unattributed');
    expect(q('.thread .reply')!.textContent).toContain('Alice Chen');
    expect(q('.thread .thread-event')!.textContent).toContain('Bob Rivera resolved');
    expect(q('.thread textarea')).toBeNull();
    expect(button('Reply')).toBeNull();
    expect(button('Reopen thread')).toBeNull();
    expect(q('.viewer-note')!.textContent).toContain('View only');
  });

  test('missing Git identity disables writes and explains repository setup', async () => {
    const save = vi.fn();
    inst = mountThread({ storage: { load: () => [annotation('a', 1, '#title')], save, identity: null } });
    await inst.ready;
    await openToolbar();
    expect(button('Annotate an element')!.disabled).toBe(true);
    button('Open thread 1')!.click();
    expect(q('.thread .identity-help')!.textContent).toContain('Git user.name and user.email');
    typeReply('A draft is still allowed');
    expect(button('Reply')!.disabled).toBe(true);
    expect(button('Resolve thread')!.disabled).toBe(true);
    button('Reply')!.click();
    expect(save).not.toHaveBeenCalled();
  });

  test('failed editor save keeps draft, stays unsaved, and prevents duplicate submits', async () => {
    let fail!: (error: Error) => void;
    const save = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    const onChange = vi.fn();
    inst = mountThread({ storage: { load: () => [], save, identity: alice }, onChange });
    await inst.ready;
    await openToolbar();
    document.getElementById('title')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    const input = q<HTMLTextAreaElement>('.editor textarea')!;
    input.value = 'Keep my draft';
    input.dispatchEvent(new Event('input'));
    const add = q<HTMLButtonElement>('.editor .btn.primary')!;
    add.click();
    add.click();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    expect(save).toHaveBeenCalledOnce();
    expect(add.disabled).toBe(true);
    expect(current).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    fail(new Error('Disk is read only'));
    await vi.waitFor(() => expect(q('.editor .save-error')!.textContent).toBe('Disk is read only'));
    expect(q<HTMLTextAreaElement>('.editor textarea')!.value).toBe('Keep my draft');
    expect(add.disabled).toBe(false);
    expect(q('.toast')!.textContent).toBe('Disk is read only');
    expect(markers()).toHaveLength(0);
  });

  test('reply conflict preserves draft and retries against refreshed thread', async () => {
    let update!: (next: Annotation[]) => void;
    let fail!: (error: Error) => void;
    const original = annotation('a', 1, '#title', { author: alice });
    const save = vi.fn<(list: Annotation[]) => Promise<void | Annotation[]>>()
      .mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
      .mockImplementationOnce(async (list) => list);
    inst = mountThread({ storage: { load: () => [original], save, identity: alice, subscribe(listener) { update = listener; return () => {}; } } });
    await inst.ready;
    button('Open thread 1')!.click();
    typeReply('My contribution');
    button('Reply')!.click();
    expect(button('Reply')!.disabled).toBe(true);
    expect(current[0].replies).toBeUndefined();
    const remote = { ...original, replies: [{ id: 'remote', body: 'Remote contribution', author: bob, createdAt: Date.now() }] };
    update([remote]);
    fail(new Error('Comments changed elsewhere. Review the latest thread, then try again.'));
    await vi.waitFor(() => expect(q('.thread .save-error')!.textContent).toContain('changed elsewhere'));
    expect(q<HTMLTextAreaElement>('.thread textarea')!.value).toBe('My contribution');
    expect(q('.thread .reply')!.textContent).toContain('Remote contribution');
    button('Reply')!.click();
    await vi.waitFor(() => expect(current[0].replies).toHaveLength(2));
    expect(save.mock.calls[1][0][0].replies?.map((reply) => reply.body)).toEqual(['Remote contribution', 'My contribution']);
    expect(q<HTMLTextAreaElement>('.thread textarea')!.value).toBe('');
  });

  test('subscribed updates keep focused reply draft and unsubscribe on destroy', async () => {
    let update!: (next: Annotation[]) => void;
    const unsubscribe = vi.fn();
    const original = annotation('a', 1, '#title');
    inst = mountThread({ storage: { load: () => [original], save() {}, identity: alice, subscribe(listener) { update = listener; return unsubscribe; } } });
    await inst.ready;
    button('Open thread 1')!.click();
    const input = typeReply('Still writing');
    input.focus();
    input.setSelectionRange(2, 5);
    update([{ ...original, replies: [{ id: 'r', body: 'A new reply', author: bob, createdAt: Date.now() }] }]);
    const replacement = q<HTMLTextAreaElement>('.thread textarea')!;
    expect(replacement.value).toBe('Still writing');
    expect(shadow().activeElement).toBe(replacement);
    expect([replacement.selectionStart, replacement.selectionEnd]).toEqual([2, 5]);
    expect(q('.thread .reply')!.textContent).toContain('A new reply');
    inst.destroy();
    inst = null;
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  test('server canonical identity and data replace submitted list after success', async () => {
    const canonical = annotation('a', 1, '#title', { author: bob, body: 'Server canonical', replies: [] });
    const save = vi.fn(async () => [canonical]);
    const onChange = vi.fn();
    inst = mountThread({ storage: { load: () => [annotation('a', 1, '#title')], save, identity: alice }, onChange });
    await inst.ready;
    button('Open thread 1')!.click();
    typeReply('Try this');
    button('Reply')!.click();
    expect(onChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(current).toEqual([canonical]));
    expect(q('.thread .root-comment')!.textContent).toContain('Bob Rivera');
    expect(q('.thread .root-comment')!.textContent).toContain('Server canonical');
    expect(onChange).toHaveBeenCalledWith([canonical]);
  });

  test('unanchored and other-page threads stay discussable; unsafe routes are text only', async () => {
    inst = mountThread({ storage: { ...memoryStorage([
      annotation('lost', 1, '#gone'), annotation('other', 2, '#title', { route: '/other' }), annotation('bad', 3, '#title', { route: '//evil.test/path' }),
    ]), identity: alice } });
    await inst.ready;
    await openToolbar();
    button('Annotation list')!.click();
    q<HTMLButtonElement>('.panel .item[data-id="lost"]')!.click();
    expect(q('.thread .unanchored-label')!.textContent).toContain('Element not found');
    typeReply('Please reattach this');
    button('Reply')!.click();
    expect(current[0].replies).toHaveLength(1);
    q<HTMLButtonElement>('.panel .item[data-id="other"]')!.click();
    expect(q<HTMLAnchorElement>('.thread .page-link')!.getAttribute('href')).toBe(new URL('/other', location.href).href);
    typeReply('Other page draft');
    q<HTMLButtonElement>('.panel .item[data-id="bad"]')!.click();
    expect(q('.thread .route')!.textContent).toBe('//evil.test/path');
    expect(q('.thread .page-link')).toBeNull();
    expect(q<HTMLTextAreaElement>('.thread textarea')!.value).toBe('');
    q<HTMLButtonElement>('.panel .item[data-id="other"]')!.click();
    expect(q<HTMLTextAreaElement>('.thread textarea')!.value).toBe('Other page draft');
  });

  test('author names and reply text render as literal text', async () => {
    inst = mountThread({ annotations: [annotation('a', 1, '#title', { author: { id: 'x', name: '<img src=x onerror=alert(1)>' }, replies: [{ id: 'r', body: '<script>bad()</script>', author: alice, createdAt: Date.now() }] })] });
    await inst.ready;
    button('Open thread 1')!.click();
    expect(q('.thread')!.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(q('.thread')!.textContent).toContain('<script>bad()</script>');
    expect(q('.thread img')).toBeNull();
    expect(q('.thread script')).toBeNull();
  });

  test('root edits require reviewing a collaborator change before explicitly replacing it', async () => {
    let update!: (next: Annotation[]) => void;
    const original = annotation('a', 1, '#title', { author: alice });
    const save = vi.fn<(list: Annotation[]) => void>();
    inst = mountThread({ storage: { load: () => [original], save, identity: alice, subscribe(listener) { update = listener; return () => {}; } } });
    await inst.ready;
    await openToolbar();
    q<HTMLElement>('.note[data-id="a"]')!.click();
    const input = q<HTMLTextAreaElement>('.editor textarea')!;
    input.value = 'My edit';
    input.dispatchEvent(new Event('input'));
    const remote = { ...original, body: 'Collaborator edit', updatedBy: bob, updatedAt: Date.now(), replies: [{ id: 'r', body: 'Keep this reply', author: bob, createdAt: Date.now() }] };
    update([remote]);
    q<HTMLButtonElement>('.editor .row .btn.primary')!.click();
    expect(save).not.toHaveBeenCalled();
    expect(input.value).toBe('My edit');
    expect(q('.conflict-review')!.textContent).toContain('Collaborator edit');
    expect(q('.conflict-review')!.textContent).toContain('Bob Rivera');
    expect(q('.editor .save-error')!.textContent).toContain('changed elsewhere');
    button('Save my changes')!.click();
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0][0]).toMatchObject({ body: 'My edit', replies: remote.replies });
    expect(q('.editor')).toBeNull();
  });

  test('Use latest reloads changed root without writing over it', async () => {
    let update!: (next: Annotation[]) => void;
    const original = annotation('a', 1, '#title');
    const save = vi.fn();
    inst = mountThread({ storage: { load: () => [original], save, identity: alice, subscribe(listener) { update = listener; return () => {}; } } });
    await inst.ready;
    await openToolbar();
    q<HTMLElement>('.note[data-id="a"]')!.click();
    update([{ ...original, title: 'Newest heading', body: 'Newest body', category: 'content' }]);
    q<HTMLButtonElement>('.editor .row .btn.primary')!.click();
    button('Use latest')!.click();
    expect(q<HTMLInputElement>('.editor .title')!.value).toBe('Newest heading');
    expect(q<HTMLTextAreaElement>('.editor textarea')!.value).toBe('Newest body');
    expect(q('.editor .cat-toggle[aria-checked="true"]')!.getAttribute('data-cat')).toBe('content');
    expect(q<HTMLElement>('.conflict-review')!.hidden).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  test('other-page links retain explicit and inferred hosted app prefixes', async () => {
    const notes = [annotation('root', 1, '#title', { route: '/' }), annotation('other', 2, '#title', { route: '/other' })];
    history.replaceState(null, '', '/host/project/');
    inst = mountThread({ annotations: notes, basePath: '/host/project' });
    await inst.ready;
    await openToolbar();
    button('Annotation list')!.click();
    q<HTMLButtonElement>('.panel .item[data-id="other"]')!.click();
    expect(q<HTMLAnchorElement>('.thread .page-link')!.pathname).toBe('/host/project/other');
    inst.destroy();
    localStorage.clear();
    history.replaceState(null, '', '/host/project/other');
    inst = mountThread({ annotations: notes });
    await inst.ready;
    await openToolbar();
    button('Annotation list')!.click();
    q<HTMLButtonElement>('.panel .item[data-id="root"]')!.click();
    expect(q<HTMLAnchorElement>('.thread .page-link')!.pathname).toBe('/host/project/');
  });

  test('undo restores deleted threads while keeping later collaborator additions', async () => {
    let update!: (next: Annotation[]) => void;
    const original = annotation('a', 1, '#title');
    const save = vi.fn();
    inst = mountThread({ storage: { load: () => [original], save, identity: alice, subscribe(listener) { update = listener; return () => {}; } } });
    await inst.ready;
    await openToolbar();
    q<HTMLElement>('.note[data-id="a"]')!.click();
    button('Delete annotation')!.click();
    const added = annotation('remote', 2, '#cta', { author: bob });
    update([added]);
    q<HTMLButtonElement>('.toast button')!.click();
    expect(save.mock.calls[1][0]).toEqual([added, original]);
    expect(markers()).toHaveLength(2);
  });


  test('closing toolbar during pending save exits element picking and keeps failed draft', async () => {
    let fail!: (error: Error) => void;
    inst = mountThread({ storage: { load: () => [], identity: alice, save: () => new Promise<void>((_, reject) => { fail = reject; }) } });
    await inst.ready;
    await openToolbar();
    document.getElementById('title')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    const input = q<HTMLTextAreaElement>('.editor textarea')!;
    input.value = 'Save me';
    input.dispatchEvent(new Event('input'));
    q<HTMLButtonElement>('.editor .row .btn.primary')!.click();
    button('Close toolbar')!.click();
    expect(document.documentElement.style.cursor).toBe('');
    expect(button('Stop annotating')).toBeNull();
    expect(q<HTMLTextAreaElement>('.editor textarea')!.value).toBe('Save me');
    fail(new Error('Save unavailable'));
    await vi.waitFor(() => expect(q('.editor .save-error')!.textContent).toBe('Save unavailable'));
    expect(q<HTMLTextAreaElement>('.editor textarea')!.value).toBe('Save me');
    expect(q<HTMLButtonElement>('.editor .btn.primary')!.disabled).toBe(false);
  });


  test('thread controls retain keyboard focus across saves and polls without stealing page focus', async () => {
    let update!: (next: Annotation[]) => void;
    let finish!: (next: Annotation[]) => void;
    const notes = [annotation('a', 1, '#title'), annotation('b', 2, '#cta')];
    const save = vi.fn<(next: Annotation[]) => Promise<Annotation[]>>().mockImplementation(() => new Promise<Annotation[]>((resolve) => { finish = resolve; }));
    inst = mountThread({ storage: { load: () => notes, save, identity: alice, subscribe(listener) { update = listener; return () => {}; } } });
    await inst.ready;
    button('Open thread 1')!.click();
    button('Resolve thread')!.focus();
    button('Resolve thread')!.click();
    expect(shadow().activeElement).toBe(q('.thread'));
    finish(save.mock.calls[0][0]);
    await vi.waitFor(() => expect(shadow().activeElement).toBe(button('Reopen thread')));
    button('Close thread')!.focus();
    update(save.mock.calls[0][0]);
    expect(shadow().activeElement).toBe(button('Close thread'));
    document.getElementById('cta')!.focus();
    update(save.mock.calls[0][0]);
    expect(document.activeElement).toBe(document.getElementById('cta'));
    expect(shadow().activeElement).toBeNull();
    button('Close thread')!.click();
    expect(shadow().activeElement).toBe(button('Open Annotoo'));
    const opener = button('Open thread 2')!;
    opener.click();
    button('Close thread')!.click();
    expect(shadow().activeElement).toBe(button('Open thread 2'));
  });

  test('successful reply keeps keyboard focus in the reply composer', async () => {
    inst = mountThread({ storage: { ...memoryStorage([annotation('a', 1, '#title')]), identity: alice } });
    await inst.ready;
    button('Open thread 1')!.click();
    typeReply('Ready');
    button('Reply')!.focus();
    button('Reply')!.click();
    expect(shadow().activeElement).toBe(q('.thread textarea'));
    expect(q<HTMLTextAreaElement>('.thread textarea')!.value).toBe('');
  });

  test('undoing a single delete does not resurrect a different thread deleted remotely', async () => {
    let update!: (next: Annotation[]) => void;
    const notes = [annotation('a', 1, '#title'), annotation('b', 2, '#cta')];
    const save = vi.fn();
    inst = mountThread({ storage: { load: () => notes, save, identity: alice, subscribe(listener) { update = listener; return () => {}; } } });
    await inst.ready;
    await openToolbar();
    q<HTMLElement>('.note[data-id="a"]')!.click();
    button('Delete annotation')!.click();
    update([]);
    q<HTMLButtonElement>('.toast button')!.click();
    expect(save.mock.calls[1][0]).toEqual([notes[0]]);
    expect(qa('.marker')).toHaveLength(1);
  });

});
