import { CSS } from './styles';

export const ROOT_ID = 'annotoo-root';

type Child = Node | string | null | undefined | false;

/** Tiny hyperscript helper for building DOM without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'style') node.setAttribute('style', String(value));
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value as Record<string, string>);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export type Ui = {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  /** Fixed, pointer-events:none overlay for pins/highlights. */
  layer: HTMLDivElement;
  /** Mount arbitrary interactive UI (dock, panel, cards). */
  mount(node: Node): void;
  setTheme(theme: Theme): void;
  destroy(): void;
};

export type Theme = 'auto' | 'light' | 'dark';

/** Create (or replace) the shadow-DOM root that isolates all widget UI from the page. */
export function createUi(): Ui {
  document.getElementById(ROOT_ID)?.remove();

  const host = el('div', { id: ROOT_ID, 'data-annotoo': 'ui' });
  host.setAttribute(
    'style',
    'position:fixed;inset:0;pointer-events:none;z-index:2147483000;display:block;',
  );
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.append(style);

  const layer = el('div', { class: 'layer' });
  shadow.append(layer);
  document.body.append(host);

  return {
    host,
    shadow,
    layer,
    mount: (node) => shadow.append(node),
    setTheme: (theme) => host.setAttribute('data-theme', theme),
    destroy: () => host.remove(),
  };
}

// ---- presentation helpers -----------------------------------------------------

export function clampToViewport(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
  };
}
