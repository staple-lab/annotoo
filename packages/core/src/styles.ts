const LIGHT = `
  --n-ink: #18181b;
  --n-ink-2: #3f3f46;
  --n-muted: #71717a;
  --n-line: #e4e4e7;
  --n-surface: #ffffff;
  --n-subtle: #f4f4f5;
  --n-accent-soft: rgba(12, 140, 233, 0.12);
  --n-ring: #ffffff;
`;

const DARK = `
  --n-ink: #fafafa;
  --n-ink-2: #d4d4d8;
  --n-muted: #a1a1aa;
  --n-line: #3f3f46;
  --n-surface: #1f1f23;
  --n-subtle: #2a2a2f;
  --n-accent-soft: rgba(12, 140, 233, 0.24);
  --n-ring: #1f1f23;
`;

export const CSS = `
:host {
  all: initial;
  ${LIGHT}
  --n-accent: #0c8ce9;
  --n-accent-hover: #0a7bcf;
  --n-danger: #e5484d;
  --n-dock: #18181b;
  --n-dock-2: #2a2a2e;
  --n-dock-3: #3f3f46;
  --n-dock-ink: #fafafa;
  --n-dock-muted: #a1a1aa;
  /* The floating toolbar: Dia-style yellow with black ink. */
  --n-bar: #ffcb30;
  --n-bar-hover: rgba(0, 0, 0, 0.08);
  --n-bar-ink: #000000;
  --n-bar-muted: rgba(0, 0, 0, 0.42);
  --n-bar-line: rgba(0, 0, 0, 0.16);
  --n-bar-on: #000000;
  --n-bar-on-ink: #ffcb30;
  --n-cat-note: #0c8ce9;
  --n-cat-interaction: #8b5cf6;
  --n-cat-content: #d97706;
  --n-cat-accessibility: #16a34a;
  --n-cat-development: #db2777;
  --n-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.12);
  --n-shadow-lg: 0 2px 6px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.22);
  --n-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --n-spring: cubic-bezier(0.3, 1.4, 0.5, 1);
  --n-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --n-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
:host([data-theme="dark"]) { ${DARK} }
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) { ${DARK} }
}
* { box-sizing: border-box; font-family: var(--n-font); -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
button:focus-visible, textarea:focus-visible, input:focus-visible {
  outline: 2px solid var(--n-accent); outline-offset: 2px;
}
[hidden] { display: none !important; }

[data-cat="note"] { --cat: var(--n-cat-note); }
[data-cat="interaction"] { --cat: var(--n-cat-interaction); }
[data-cat="content"] { --cat: var(--n-cat-content); }
[data-cat="accessibility"] { --cat: var(--n-cat-accessibility); }
[data-cat="development"] { --cat: var(--n-cat-development); }

/* ---------- overlay layer ---------------------------------------------------- */
.layer { position: fixed; inset: 0; pointer-events: none; }
.layer > .outline, .layer > .marker, .layer > .note, .layer > .wires {
  transition: opacity 160ms var(--n-ease), visibility 0s;
}
.layer.is-hidden > .outline, .layer.is-hidden > .marker, .layer.is-hidden > .note, .layer.is-hidden > .wires {
  opacity: 0; visibility: hidden; pointer-events: none; animation: none;
  transition: opacity 160ms var(--n-ease), visibility 0s 160ms;
}

.highlight {
  position: fixed; pointer-events: none;
  border: 1.5px solid var(--n-accent); border-radius: 4px; background: var(--n-accent-soft);
  transition: left 70ms var(--n-ease), top 70ms var(--n-ease), width 70ms var(--n-ease), height 70ms var(--n-ease);
}
.highlight .tag {
  position: absolute; left: -1.5px; top: -22px; height: 20px; padding: 0 6px; border-radius: 4px 4px 4px 0;
  background: var(--n-accent); color: #fff; font-size: 11px; font-weight: 600; line-height: 20px; white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.flash {
  position: fixed; pointer-events: none;
  border: 2px solid var(--cat, var(--n-accent)); border-radius: 6px;
  animation: n-flash 1.3s var(--n-ease) forwards;
}
@keyframes n-flash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }

/* ---------- annotations: outline + marker + connector + note ----------------- */
.wires { position: fixed; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.wires line { stroke: var(--cat); stroke-width: 1.25; stroke-opacity: 0.55; }
.wires line.is-strong { stroke-opacity: 1; stroke-width: 1.5; }

.outline {
  position: fixed; pointer-events: none; border-radius: 4px;
  border: 1.25px dashed var(--cat, var(--n-accent)); opacity: 0.6;
}
.outline.is-strong {
  border-style: solid; opacity: 1;
  background: color-mix(in srgb, var(--cat, var(--n-accent)) 7%, transparent);
}
.outline.is-draft { --cat: var(--n-accent); }

.marker {
  position: fixed; pointer-events: auto; cursor: pointer;
  translate: -50% -50%; width: 22px; height: 22px; padding: 0; margin: 0;
  border-radius: 50%; border: 2px solid var(--n-ring);
  background: var(--cat, var(--n-accent)); color: #fff;
  font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  transition: scale 140ms var(--n-ease), opacity 160ms var(--n-ease), visibility 0s;
  animation: n-pop-in 280ms var(--n-spring) both;
}
.marker:hover, .marker.is-active { scale: 1.15; }
.marker.is-draft { --cat: var(--n-accent); pointer-events: none; font-size: 14px; line-height: 17px; }
@keyframes n-pop-in { from { opacity: 0; scale: 0.3; } to { opacity: 1; scale: 1; } }

.note {
  position: fixed; pointer-events: auto; cursor: pointer;
  width: max-content; max-width: 256px; min-width: 180px;
  padding: 9px 12px 10px; border-radius: 10px;
  background: var(--n-surface); color: var(--n-ink);
  border: 1px solid var(--n-line);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06);
  font-size: 13px; line-height: 1.45;
  transition: opacity 160ms var(--n-ease), visibility 0s, box-shadow 140ms var(--n-ease), border-color 140ms var(--n-ease);
  animation: n-fade-in 220ms var(--n-ease) both;
}
.note:hover { box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.1); z-index: 2; }
.note.is-active {
  z-index: 3; border-color: color-mix(in srgb, var(--cat) 55%, var(--n-line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cat) 14%, transparent), 0 8px 24px rgba(0,0,0,0.1);
}
.note.is-off { opacity: 0; visibility: hidden; pointer-events: none; animation: none; transition: opacity 120ms var(--n-ease), visibility 0s 120ms; }
@keyframes n-fade-in { from { opacity: 0; translate: 0 4px; } to { opacity: 1; translate: 0 0; } }
.note-n { font-size: 11px; color: var(--n-muted); font-variant-numeric: tabular-nums; margin-bottom: 3px; }
.note-title { display: flex; gap: 7px; align-items: flex-start; font-size: 13.5px; font-weight: 500; color: var(--n-ink); }
.note-glyph { flex: 0 0 auto; display: inline-flex; margin-top: 1px; color: var(--cat); }
.note-body { margin: 3px 0 0 22px; color: var(--n-ink-2); white-space: pre-wrap; word-break: break-word; }
.note-meta {
  display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 9px 0 0 22px; /* lines up with the copy */
  font-size: 12px; color: var(--n-muted);
}
.note-meta span { display: inline-flex; align-items: center; gap: 5px; }
.note-meta svg { opacity: 0.8; }

/* ---------- dock: floating launcher → toolbar --------------------------------- */
.dock {
  position: fixed; bottom: 20px; right: 20px; pointer-events: auto;
  display: flex; align-items: center; gap: 2px;
  height: 44px; padding: 4px; border-radius: 22px;
  background: var(--n-bar); color: var(--n-bar-ink);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.1), 0 12px 32px rgba(120, 80, 0, 0.22);
  animation: n-rise 240ms var(--n-ease) both;
}
.dock.left { right: auto; left: 20px; }
@keyframes n-rise { from { opacity: 0; translate: 0 8px; } to { opacity: 1; translate: 0 0; } }
/* Open: the same tab, stretched into a toolbar. Flush with the bottom edge, rounded top
   corners, extra height hidden below the screen like the closed tab. */
.dock.is-open {
  bottom: -10px; height: 62px; padding: 7px 7px 17px; border-radius: 14px 14px 0 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07), 0 -2px 12px rgba(120, 80, 0, 0.18);
  /* Opening unclips the toolbar out from the tab's footprint (58px, on the corner side);
     closing folds it back the same way. Clipping rather than scaling keeps the icons and
     stitching undistorted. */
  --n-fold: inset(0 0 0 calc(100% - 58px) round 12px 12px 0 0);
  --n-unfold: inset(0 round 14px 14px 0 0);
  animation: n-expand 260ms var(--n-ease-in-out) both;
}
.dock.left.is-open { --n-fold: inset(0 calc(100% - 58px) 0 0 round 12px 12px 0 0); }
.dock.is-open.is-closing { animation: n-collapse 260ms var(--n-ease-in-out) both; pointer-events: none; }
@keyframes n-expand { from { clip-path: var(--n-fold); } to { clip-path: var(--n-unfold); } }
@keyframes n-collapse { from { clip-path: var(--n-unfold); } to { clip-path: var(--n-fold); } }
.tool.bird-btn { width: 40px; border-radius: 10px; }
.tool.bird-btn .bird { display: block; height: 30px; width: auto; pointer-events: none; user-select: none; }

.launcher {
  position: relative; border: 0; padding: 0; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; color: var(--n-bar-ink);
}

/* Closed: a yellow tab hanging off the bottom edge of the screen, cockatoo inside.
   It's taller than it looks (the extra sits below the screen edge) so rising on hover
   never opens a gap underneath. */
.dock.is-tab {
  bottom: -10px; height: auto; padding: 0; gap: 0;
  background: none; box-shadow: none; border-radius: 0;
  animation: n-tab-in 320ms var(--n-spring) both;
}
@keyframes n-tab-in { from { translate: 0 100%; } to { translate: 0 0; } }
.dock.is-tab .launcher {
  width: 58px; height: 62px; padding: 8px 0 18px; align-items: flex-start;
  border-radius: 12px 12px 0 0; background: var(--n-bar);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07), 0 -2px 12px rgba(120, 80, 0, 0.18);
  transition: translate 180ms var(--n-ease), box-shadow 180ms var(--n-ease);
}
.dock.is-tab .launcher:hover, .dock.is-tab .launcher:focus-visible {
  translate: 0 -6px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07), 0 -4px 18px rgba(120, 80, 0, 0.26);
}
.dock.is-tab .launcher:active { translate: 0 -3px; }
/* Stitching: a dashed thread just inside the tab's edge, like the annotation outlines
   (and the embroidered cockatoo). It runs off the bottom of the screen with the tab. */
.dock.is-tab .launcher::before, .dock.is-open::before {
  content: ''; position: absolute; inset: 4px 4px 0; pointer-events: none;
  border: 1.5px dashed rgba(110, 72, 0, 0.45); border-bottom: 0; border-radius: 9px 9px 0 0;
}
.dock.is-open::before { inset: 4px 4px 0; border-radius: 11px 11px 0 0; }
/* The entrance animation holds translate, which would pin the tab; drop it while dragging. */
.dock.is-dragging { transition: none; cursor: grabbing; animation: none; }
.dock.is-dragging .launcher, .dock.is-dragging .bird-btn { cursor: grabbing; }
.dock.is-dragging [data-tip]::after { display: none; }
/* Top corners: the same tab, flipped to hang down from the top edge. */
.dock.top.is-tab { bottom: auto; top: -10px; animation-name: n-tab-in-top; }
@keyframes n-tab-in-top { from { translate: 0 -100%; } to { translate: 0 0; } }
.dock.top.is-tab .launcher {
  padding: 18px 0 8px; align-items: flex-end; border-radius: 0 0 12px 12px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07), 0 2px 12px rgba(120, 80, 0, 0.18);
}
.dock.top.is-tab .launcher:hover, .dock.top.is-tab .launcher:focus-visible {
  translate: 0 6px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07), 0 4px 18px rgba(120, 80, 0, 0.26);
}
.dock.top.is-tab .launcher:active { translate: 0 3px; }
.dock.top.is-open {
  bottom: auto; top: -10px; padding: 17px 7px 7px; border-radius: 0 0 14px 14px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07), 0 2px 12px rgba(120, 80, 0, 0.18);
  --n-fold: inset(0 0 0 calc(100% - 58px) round 0 0 12px 12px);
  --n-unfold: inset(0 round 0 0 14px 14px);
}
.dock.top.left.is-open { --n-fold: inset(0 calc(100% - 58px) 0 0 round 0 0 12px 12px); }
.dock.top.is-tab .launcher::before, .dock.top.is-open::before {
  inset: 0 4px 4px; border: 1.5px dashed rgba(110, 72, 0, 0.45); border-top: 0; border-radius: 0 0 9px 9px;
}
.dock.top.is-open::before { border-radius: 0 0 11px 11px; }
.dock.top .launcher .badge { top: auto; bottom: -7px; }
.dock.top [data-tip]::after { bottom: auto; top: calc(100% + 10px); translate: -50% -4px; }
.dock.top.is-tab [data-tip]::after { top: calc(100% + 14px); }
.launcher .bird { display: block; height: 36px; width: auto; pointer-events: none; user-select: none; }
.launcher.is-muted .bird { opacity: 0.45; filter: grayscale(0.6); }
.launcher .badge {
  position: absolute; top: -7px; right: -7px; min-width: 19px; height: 19px; padding: 0 5px;
  border-radius: 10px; background: var(--n-bar-on); color: var(--n-bar-on-ink); border: 2px solid var(--n-ring);
  font-size: 10px; font-weight: 700; line-height: 15px; text-align: center;
}
.launcher.is-muted .badge { background: var(--n-bar-muted); color: #fff; }
/* Tooltip for the tab sits higher so it clears the badge. */
.dock.is-tab [data-tip]::after { bottom: calc(100% + 14px); }

.tool {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: 0; border-radius: 18px; padding: 0;
  background: transparent; color: var(--n-bar-ink); cursor: pointer;
  transition: background 120ms var(--n-ease), color 120ms var(--n-ease);
}
.tool:hover { background: var(--n-bar-hover); }
.tool.is-on { background: var(--n-bar-on); color: var(--n-bar-on-ink); }
.tool.is-on:hover { background: #262626; }
.tool.is-muted { color: var(--n-bar-muted); }
.tool .badge {
  position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: 7px; background: var(--n-bar-on); color: var(--n-bar-on-ink);
  font-size: 9px; font-weight: 700; line-height: 14px; text-align: center;
}
.sep { width: 1px; height: 20px; background: var(--n-bar-line); margin: 0 4px; }
.tool.is-on .badge { background: var(--n-bar-on-ink); color: var(--n-bar-on); }

/* tooltips above dock buttons */
[data-tip]::after {
  content: attr(data-tip); position: absolute; bottom: calc(100% + 10px); left: 50%; translate: -50% 4px;
  padding: 5px 8px; border-radius: 6px; background: var(--n-dock); color: var(--n-dock-ink);
  font-size: 11.5px; font-weight: 550; white-space: nowrap; pointer-events: none;
  opacity: 0; transition: opacity 120ms var(--n-ease), translate 120ms var(--n-ease);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
[data-tip]:hover::after { opacity: 1; translate: -50% 0; transition-delay: 350ms; }

/* ---------- floating surfaces ---------------------------------------------------- */
.surface {
  pointer-events: auto; color: var(--n-ink); background: var(--n-surface);
  border: 1px solid var(--n-line); border-radius: 12px; box-shadow: var(--n-shadow-lg);
  font-size: 13px; line-height: 1.45;
}
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 0; border-radius: 7px; background: transparent;
  color: var(--n-muted); cursor: pointer; transition: background 120ms var(--n-ease), color 120ms var(--n-ease);
}
.icon-btn:hover { background: var(--n-subtle); color: var(--n-ink); }
.icon-btn.danger:hover { color: var(--n-danger); }
.icon-btn:disabled { opacity: 0.35; cursor: default; background: transparent; }
.chip {
  display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px;
  border-radius: 10px; font-size: 11px; font-weight: 600; background: var(--n-subtle); color: var(--n-ink-2);
}
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--cat, var(--n-muted)); }

/* ---------- editor ---------------------------------------------------------------- */
.editor { position: fixed; width: 300px; padding: 12px; animation: n-pop 150ms var(--n-ease) both; }
@keyframes n-pop { from { opacity: 0; scale: 0.97; } to { opacity: 1; scale: 1; } }
.editor .cats { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
.cat-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  height: 24px; padding: 0 9px; border-radius: 12px; border: 1px solid var(--n-line);
  background: transparent; color: var(--n-muted); font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all 120ms var(--n-ease);
}
.cat-toggle::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--cat); }
.cat-toggle:hover { color: var(--n-ink); border-color: var(--n-muted); }
.cat-toggle.is-on { color: #fff; border-color: transparent; background: var(--cat); }
.cat-toggle.is-on::before { background: #fff; }
.editor input.title, .editor textarea {
  display: block; width: 100%; border: 1px solid var(--n-line); border-radius: 8px;
  background: var(--n-surface); color: var(--n-ink); font-size: 13px;
}
.editor input.title { height: 34px; padding: 0 10px; margin-bottom: 6px; font-weight: 600; }
.editor textarea { min-height: 84px; max-height: 260px; padding: 8px 10px; line-height: 1.45; resize: none; }
.editor ::placeholder { color: var(--n-muted); font-weight: 400; }
.editor .row { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.editor .grow { flex: 1; }
.editor .hint { font-size: 11px; color: var(--n-muted); }
.btn {
  height: 30px; padding: 0 12px; border-radius: 8px; border: 0; cursor: pointer;
  font-size: 12.5px; font-weight: 600; transition: background 120ms var(--n-ease), opacity 120ms;
}
.btn.primary { background: var(--n-accent); color: #fff; }
.btn.primary:hover { background: var(--n-accent-hover); }
.btn.primary:disabled { opacity: 0.4; cursor: default; }
.btn.ghost { background: transparent; color: var(--n-ink-2); }
.btn.ghost:hover { background: var(--n-subtle); }
kbd { font-family: inherit; font-size: 10.5px; padding: 0 4px; border-radius: 4px; border: 1px solid var(--n-line); background: var(--n-subtle); }

/* ---------- side panel -------------------------------------------------------------- */
.panel {
  position: fixed; top: 12px; right: 12px; bottom: 76px; width: 320px;
  display: flex; flex-direction: column; overflow: hidden;
  animation: n-slide 200ms var(--n-ease) both;
}
.panel.left { right: auto; left: 12px; }
.panel.top { top: 76px; bottom: 12px; }
@keyframes n-slide { from { opacity: 0; translate: 12px 0; } to { opacity: 1; translate: 0 0; } }
.panel-head {
  display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px;
  border-bottom: 1px solid var(--n-line);
}
.panel-head .title { font-weight: 700; font-size: 14px; }
.panel-head .sub { color: var(--n-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.panel-head .grow { flex: 1; }
.panel-list { flex: 1; overflow-y: auto; padding: 6px; }
.section {
  font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--n-muted); padding: 12px 10px 6px;
}
.item {
  display: flex; gap: 10px; width: 100%; text-align: left; padding: 10px; border: 0; border-radius: 10px;
  background: transparent; cursor: pointer; transition: background 120ms var(--n-ease);
}
.item:hover { background: var(--n-subtle); }
.item.is-active { background: var(--n-accent-soft); }
.item.is-static { cursor: default; opacity: 0.7; }
.item.is-static:hover { background: transparent; }
.item .num {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; background: var(--cat);
  color: #fff; font-size: 11px; font-weight: 700; line-height: 22px; text-align: center;
}
.item .main { flex: 1; min-width: 0; }
.item .kind { font-size: 10.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--cat); }
.item .t { font-weight: 650; color: var(--n-ink); }
.item .b { color: var(--n-ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.item .route { font-size: 11px; color: var(--n-muted); margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.empty { padding: 36px 20px; text-align: center; color: var(--n-muted); }
.empty strong { display: block; color: var(--n-ink); margin-bottom: 4px; }

/* ---------- settings popover ---------------------------------------------------------- */
.settings {
  position: fixed; bottom: 74px; right: 20px; width: 284px; padding: 6px 0;
  animation: n-pop 150ms var(--n-ease) both; transform-origin: bottom right;
}
.settings.left { right: auto; left: 20px; transform-origin: bottom left; }
.settings.top { bottom: auto; top: 74px; transform-origin: top right; }
.settings.top.left { transform-origin: top left; }
.corners {
  display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3px;
  height: 66px; padding: 3px; border-radius: 9px; background: var(--n-subtle);
}
.corners button {
  display: flex; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
  transition: background 120ms var(--n-ease);
}
.corners button:hover { background: var(--n-hover); }
.corners button[aria-checked='true'] { background: var(--n-surface); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.corners [data-corner^='top'] { align-items: flex-start; }
.corners [data-corner^='bottom'] { align-items: flex-end; }
.corners [data-corner$='left'] { justify-content: flex-start; padding-left: 10px; }
.corners [data-corner$='right'] { justify-content: flex-end; padding-right: 10px; }
.corner-tab { width: 18px; height: 9px; background: var(--n-line); }
.corners [data-corner^='top'] .corner-tab { border-radius: 0 0 4px 4px; }
.corners [data-corner^='bottom'] .corner-tab { border-radius: 4px 4px 0 0; }
.corners [aria-checked='true'] .corner-tab { background: var(--n-bar); box-shadow: inset 0 0 0 1px rgba(110, 72, 0, 0.35); }
.settings h3 { margin: 0; padding: 8px 14px 6px; font-size: 13px; font-weight: 700; }
.setting { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; }
.setting.stack { flex-direction: column; align-items: stretch; gap: 6px; }
.setting .label { font-size: 12.5px; color: var(--n-ink-2); }
.setting .help { font-size: 11.5px; color: var(--n-muted); }
.keys { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; margin: 0; font-size: 12.5px; }
.keys dt { color: var(--n-ink-2); }
.keys dd { margin: 0; text-align: right; }
.keys kbd { font-size: 11.5px; padding: 1px 6px; }
[data-tip]::after { white-space: pre; }
.settings hr { border: 0; border-top: 1px solid var(--n-line); margin: 6px 0; }
.settings .foot { display: flex; align-items: center; gap: 6px; padding: 6px 14px 8px; font-size: 11.5px; color: var(--n-muted); }
.settings .foot .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex: 0 0 auto; }
.settings .foot .dot.warn { background: var(--n-cat-content); }
.settings .danger-link { border: 0; background: none; padding: 0; color: var(--n-danger); font-size: 12.5px; cursor: pointer; }
.settings .danger-link:hover { text-decoration: underline; }
.seg {
  display: flex; padding: 2px; border-radius: 8px; background: var(--n-subtle);
}
.seg button {
  flex: 1; height: 26px; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
  font-size: 12px; font-weight: 550; color: var(--n-muted); white-space: nowrap; padding: 0 8px;
  transition: background 120ms var(--n-ease), color 120ms var(--n-ease);
}
.seg button:hover { color: var(--n-ink); }
.seg button[aria-checked="true"] { background: var(--n-surface); color: var(--n-ink); box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
.switch {
  position: relative; flex: 0 0 auto; width: 34px; height: 20px; border-radius: 10px; border: 0; padding: 0; cursor: pointer;
  background: var(--n-line); transition: background 140ms var(--n-ease);
}
.switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.25); transition: translate 160ms var(--n-ease);
}
.switch[aria-checked="true"] { background: var(--n-accent); }
.switch[aria-checked="true"]::after { translate: 14px 0; }

/* ---------- toast -------------------------------------------------------------------- */
.toast {
  position: fixed; bottom: 76px; left: 50%; translate: -50% 0; pointer-events: auto;
  display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-radius: 10px;
  background: var(--n-dock); color: var(--n-dock-ink); font-size: 13px; box-shadow: var(--n-shadow-lg);
  animation: n-rise 200ms var(--n-ease) both;
}
.toast.low { bottom: 24px; }
.toast button { border: 0; background: transparent; color: #7cc4ff; font-weight: 650; cursor: pointer; padding: 0; }

/* ---------- collaborative discussions ----------------------------------------------- */
.note-n, .note-date, .byline, .edited-line, .thread-event, .item-meta { overflow-wrap: anywhere; }
.note-date { margin: 6px 0 0 22px; color: var(--n-muted); font-size: 11px; }
.open-thread { margin: 10px 0 0 22px; padding: 0; border: 0; background: transparent; color: var(--n-accent); cursor: pointer; font-size: 12px; font-weight: 600; text-align: left; }
.open-thread:hover, .page-link:hover { text-decoration: underline; }
.thread { position: fixed; top: 12px; bottom: 76px; right: 12px; width: 380px; max-width: calc(100vw - 24px); display: flex; flex-direction: column; overflow: hidden; animation: n-slide 180ms var(--n-ease) both; z-index: 6; }
.thread.left { right: auto; left: 12px; }
.thread.top { top: 76px; bottom: 12px; }
.thread .panel-head { flex: 0 0 auto; }
.thread-context { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 10px 16px; border-bottom: 1px solid var(--n-line); font-size: 11px; color: var(--n-muted); }
.thread-context .route { overflow-wrap: anywhere; }
.page-link { color: var(--n-accent); margin-left: auto; text-decoration: none; }
.unanchored-label { color: var(--n-cat-content); }
.thread-history { flex: 1; min-height: 80px; overflow-y: auto; padding: 16px; overscroll-behavior: contain; }
.thread-title { font-size: 16px; font-weight: 650; line-height: 1.4; margin: 0 0 14px; overflow-wrap: anywhere; }
.comment { padding: 0 0 16px; }
.comment.reply { padding: 15px 0; border-top: 1px solid var(--n-line); }
.byline { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--n-muted); margin-bottom: 7px; }
.byline strong { font-size: 12px; font-weight: 650; color: var(--n-ink); }
.byline time { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.comment-body { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.6; color: var(--n-ink-2); }
.edited-line { margin-top: 8px; font-size: 10.5px; color: var(--n-muted); }
.thread-event { padding: 10px 12px; margin: 0 0 12px; background: var(--n-subtle); border-radius: 7px; font-size: 11.5px; color: var(--n-ink-2); }
.thread-event time { display: block; font-size: 10.5px; color: var(--n-muted); margin-top: 2px; }
.thread-composer { flex: 0 0 auto; padding: 12px 16px 14px; border-top: 1px solid var(--n-line); }
.thread-composer textarea { display: block; width: 100%; min-height: 78px; max-height: 180px; padding: 10px; resize: vertical; border: 1px solid var(--n-line); border-radius: 8px; background: var(--n-surface); color: var(--n-ink); font-size: 13px; line-height: 1.45; }
.reply-as { font-size: 11px; color: var(--n-muted); margin-bottom: 8px; overflow-wrap: anywhere; }
.thread-actions { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.thread-actions .grow, .thread .grow { flex: 1; }
.viewer-note { padding: 13px 16px; border-top: 1px solid var(--n-line); color: var(--n-muted); font-size: 11.5px; }
.thread-status { display: inline-flex; align-items: center; gap: 4px; border-radius: 10px; padding: 2px 7px; font-size: 10px; line-height: 1.4; font-weight: 600; color: var(--n-accent); background: var(--n-accent-soft); white-space: nowrap; }
.thread-status.is-resolved { color: var(--n-cat-accessibility); background: color-mix(in srgb, var(--n-cat-accessibility) 12%, transparent); }
.thread-filters { padding: 8px 12px; border-bottom: 1px solid var(--n-line); }
.item-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 3px; }
.item-meta { font-size: 11px; color: var(--n-muted); margin-top: 7px; }
.save-error, .identity-help { border-radius: 6px; background: color-mix(in srgb, var(--n-cat-content) 10%, var(--n-surface)); padding: 9px 10px; color: var(--n-ink-2); font-size: 11.5px; line-height: 1.5; overflow-wrap: anywhere; }
.editor .save-error { margin-top: 8px; }
.editor { max-height: calc(100vh - 16px); overflow-y: auto; }
.conflict-review { margin-top: 10px; padding: 10px; border: 1px solid var(--n-line); border-radius: 8px; }
.latest-label { color: var(--n-muted); font-size: 11px; font-weight: 650; margin-bottom: 8px; }
.conflict-review .comment-body { max-height: 120px; overflow-y: auto; margin-top: 6px; }
.review-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; margin-top: 10px; }
.thread > .save-error { margin: 0 16px 10px; }
.panel > .identity-help { margin: 10px; }
.thread-composer .identity-help { margin-bottom: 10px; }
.btn:disabled, .tool:disabled, .danger-link:disabled { opacity: 0.4; cursor: default; }
.btn.ghost:disabled:hover { background: transparent; }
.panel { max-width: calc(100vw - 24px); }
@media (max-width: 420px) {
  .thread, .panel { width: calc(100vw - 16px); right: 8px; max-width: none; }
  .thread.left, .panel.left { left: 8px; }
  .thread .byline { flex-wrap: wrap; gap: 3px 8px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
