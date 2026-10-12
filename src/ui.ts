export const ROOT_ID = 'notate-root';

/** Tiny hyperscript helper for building DOM without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'style') node.setAttribute('style', String(value));
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value as Record<string, string>);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }

.layer {
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
}

/* hover highlight while annotating */
.highlight {
  position: fixed; pointer-events: none; z-index: 2147483001;
  border: 2px solid #5b5bd6; border-radius: 4px;
  background: rgba(91,91,214,0.08); transition: all 60ms ease-out;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.6);
}

/* pins */
.pin {
  position: fixed; pointer-events: auto; z-index: 2147483002;
  width: 26px; height: 26px; transform: translate(-50%, -50%);
  border-radius: 50% 50% 50% 2px; border: 2px solid #fff;
  background: #5b5bd6; color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  user-select: none;
}
.pin:hover { background: #4a4ac0; }
.pin[data-cat="bug"] { background: #e5484d; }
.pin[data-cat="idea"] { background: #f5a623; }
.pin[data-cat="question"] { background: #0ea5e9; }
.pin[data-cat="bug"]:hover { background: #cf3a3f; }

/* flash target on select */
.flash {
  position: fixed; pointer-events: none; z-index: 2147483001;
  border: 2px solid #f5a623; border-radius: 4px; background: rgba(245,166,35,0.15);
  animation: notate-flash 1.2s ease-out forwards;
}
@keyframes notate-flash { from { opacity: 1; } to { opacity: 0; } }

/* toolbar */
.toolbar {
  position: fixed; left: 16px; bottom: 16px; pointer-events: auto; z-index: 2147483004;
  display: flex; align-items: center; gap: 8px;
  background: #1a1a2e; color: #fff; padding: 8px 10px; border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35); font-size: 13px;
}
.toolbar .brand { font-weight: 700; letter-spacing: 0.3px; padding: 0 4px; opacity: 0.9; }
.toolbar button {
  border: 0; border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 600;
  cursor: pointer; background: #2d2d44; color: #fff;
}
.toolbar button:hover { background: #3a3a55; }
.toolbar button.active { background: #5b5bd6; }
.toolbar button.primary { background: #22c55e; color: #07210f; }
.toolbar button.primary:hover { background: #1eae55; }
.toolbar input {
  background: #2d2d44; color: #fff; border: 1px solid #3a3a55; border-radius: 8px;
  padding: 5px 8px; font-size: 12px; width: 110px;
}
.toolbar .count { opacity: 0.7; font-size: 12px; min-width: 54px; text-align: center; }

/* popover editor */
.popover {
  position: fixed; pointer-events: auto; z-index: 2147483005;
  width: 280px; background: #fff; color: #1a1a2e; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.28); border: 1px solid #e6e6ef;
  padding: 12px; font-size: 13px;
}
.popover textarea {
  width: 100%; min-height: 72px; resize: vertical; border: 1px solid #d7d7e0;
  border-radius: 8px; padding: 8px; font-size: 13px; font-family: inherit;
}
.popover .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.popover select { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #d7d7e0; font-size: 12px; }
.popover .actions { display: flex; justify-content: space-between; margin-top: 10px; }
.popover button {
  border: 0; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.popover .save { background: #5b5bd6; color: #fff; }
.popover .save:hover { background: #4a4ac0; }
.popover .delete { background: #fbe9ea; color: #c0353a; }
.popover .delete:hover { background: #f6d3d5; }

/* side panel (viewer + author list) */
.panel {
  position: fixed; top: 0; right: 0; height: 100%; width: 320px; pointer-events: auto;
  z-index: 2147483004; background: #fff; color: #1a1a2e; border-left: 1px solid #e6e6ef;
  box-shadow: -8px 0 30px rgba(0,0,0,0.12); display: flex; flex-direction: column;
  transform: translateX(0); transition: transform 180ms ease;
}
.panel.collapsed { transform: translateX(calc(100% - 0px)); }
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #eee; font-weight: 700;
}
.panel-header .sub { font-weight: 400; font-size: 12px; opacity: 0.6; }
.panel-header button {
  border: 0; background: #f0f0f7; color: #4a4a68; border-radius: 8px;
  padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.panel-header button:hover { background: #e6e6f2; }
.panel-list { overflow-y: auto; padding: 8px; flex: 1; }
.panel-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.5; margin: 12px 8px 6px; }
.item {
  display: flex; gap: 10px; padding: 10px; border-radius: 10px; cursor: pointer;
  border: 1px solid transparent;
}
.item:hover { background: #f6f6fb; border-color: #ececf5; }
.item .badge {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; background: #5b5bd6;
  color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}
.item .badge[data-cat="bug"] { background: #e5484d; }
.item .badge[data-cat="idea"] { background: #f5a623; }
.item .badge[data-cat="question"] { background: #0ea5e9; }
.item .body { font-size: 13px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; }
.item .meta { font-size: 11px; opacity: 0.55; margin-top: 3px; }
.panel-toggle {
  position: fixed; top: 16px; right: 16px; pointer-events: auto; z-index: 2147483004;
  background: #1a1a2e; color: #fff; border: 0; border-radius: 10px; padding: 8px 12px;
  font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}
.empty { padding: 24px 16px; text-align: center; opacity: 0.5; font-size: 13px; }
`;

export type Ui = {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  /** Fixed, pointer-events:none overlay for pins/highlights. */
  layer: HTMLDivElement;
  /** Mount arbitrary interactive UI (toolbar, panel, popovers). */
  mount(node: Node): void;
  destroy(): void;
};

/** Create (or reuse) the shadow-DOM root that isolates all widget UI from the page. */
export function createUi(): Ui {
  const existing = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (existing) existing.remove();

  const host = el('div', { id: ROOT_ID });
  host.setAttribute('style', 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;');
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
    destroy: () => host.remove(),
  };
}
