/**
 * Crumb CSS
 *
 * Layout: editor-pane (resizable left split) | splitter | map (sidebar floats inside).
 * Design system: shadcn/ui Zinc palette — clean, minimal.
 *
 * Tune the :root tokens to restyle the whole UI:
 *   colors, editor theme, radius scale, shadows, motion, layout, type.
 */

/* Global box-model reset and html/body overflow */
const resetCSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
`

/*
 * Design tokens, split into two groups:
 *
 *   THEME TOKENS  — every colour/shadow that should flip between light and dark.
 *                   A future dark theme re-declares ONLY this group (see the
 *                   commented @media block at the end). Nothing else changes.
 *   STATIC TOKENS — radius, type scale, fonts, motion, layout, z-index. These
 *                   are theme-independent and must NOT be duplicated in dark.
 *
 * The editor (--ed-*) is a self-contained dark surface skinned with Crumb's own
 * dark-mode palette, not part of the light/dark flip — it stays dark in both themes.
 */
const tokensCSS = `
:root {
  /* ===================== THEME TOKENS (flip in dark) ===================== */

  /* Surfaces */
  --bg:            #ffffff;
  --surface:       #fafafa;
  --muted-bg:      #f4f4f5;
  --border:        #e4e4e7;

  /* Text */
  --text:           #09090b;
  --text-secondary: #52525b;   /* zinc-700 — prose / secondary, between --text and --muted */
  --muted:          #71717a;

  /* Brand / action */
  --primary:        #18181b;
  --primary-fg:     #fafafa;
  --primary-hover:  #27272a;
  --primary-muted:  #3f3f46;   /* zinc-700 — marker hover, "more" link hover */

  /* Semantic */
  --danger:    #dc2626;
  --danger-bg: #fef2f2;
  --danger-bd: #fca5a5;

  /* Activity */
  --activity:       #f97316;   /* orange-500 */
  --activity-fg:    #ffffff;
  --activity-bg:    #fff7ed;   /* orange-50 */
  --activity-bd:    #fed7aa;   /* orange-200 */
  --priority-muted: #a1a1aa;   /* zinc-400 — "maybe" priority label */

  /* Overlay */
  --overlay: rgba(0,0,0,.8);

  /* Shadows */
  --shadow-sm:            0 1px 4px rgba(0,0,0,.08);
  --shadow-md:            0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06);
  --shadow-lg:            0 25px 50px -12px rgba(0,0,0,.25);
  --shadow-sidebar:       0 4px 24px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
  --shadow-sheet:         0 -4px 24px rgba(0,0,0,.12), 0 -1px 4px rgba(0,0,0,.08);
  --shadow-map-popup:     0 2px 12px rgba(0,0,0,.1);
  --shadow-marker:        0 2px 8px rgba(0,0,0,.3);
  --shadow-marker-active: 0 4px 14px rgba(0,0,0,.45);
  --shadow-marker-sm:     0 1px 4px rgba(0,0,0,.25);

  /* Map overlay — sits on (always-light) map tiles, so it stays fixed in BOTH
     themes (do NOT flip). Marker fills stay dark-on-light even when the panel UI
     inverts; --marker-bg matches ROUTE_COLOR in app-state.ts. */
  --marker-bg:       #18181b;   /* place + stay/transport marker fill */
  --marker-bg-hover: #3f3f46;
  --marker-activity: #f97316;   /* activity/must/maybe marker fill (orange-500) */
  --marker-ring:     #fff;
  --marker-fg:       #fff;
  --chip-bg:         rgba(0,0,0,.6);
  --chip-fg:         #fff;
  --attrib-halo:     rgba(255,255,255,.7);   /* white outline keeping the bg-less attribution legible over busy map detail */
  --spinner-track:   var(--border);

  /* ===================== STATIC TOKENS (theme-independent) ============== */

  /* Radius scale */
  --radius-xs:   4px;      /* menu items, micro badges, tags */
  --radius-sm:   6px;      /* buttons, inputs, dropdowns */
  --radius-md:   8px;      /* modals, cards, info/note blocks */
  --radius-lg:   16px;     /* close button, map popups */
  --radius-xl:   24px;     /* sidebar panel */
  --radius-full: 9999px;   /* pills, fully-rounded bars */

  /* Type scale */
  --text-3xs:   10px;   /* dense component labels */
  --text-2xs:   11px;   /* small badges, marker numbers, editor error */
  --text-xs:    12px;   /* labels, tags, badges */
  --text-sm:    13px;   /* supporting info: dates, times, notes */
  --text-base:  14px;   /* primary content */
  --text-lg:    15px;   /* place name headings */
  --text-panel: 18px;   /* panel activity/stay name, modal title */
  --text-2xl:   22px;   /* panel place/transport name */
  --text-xl:    30px;   /* trip title */

  /* Fonts */
  --font: "Geist", system-ui, -apple-system, sans-serif;
  --mono: "Geist Mono", "JetBrains Mono", Menlo, Consolas, monospace;

  /* Motion */
  --duration:       150ms;
  --duration-sheet: 300ms;   /* bottom sheet snap */

  /* Layout */
  --sidebar-w: 360px;
  --appbar-h:  36px;

  /* Z-index scale — the app-chrome layer ladder, in stacking order.
     (MapLibre popups z:4-5 and a couple of local stacking contexts stay as
     documented literals — they are library/component-internal, not chrome.) */
  --z-marker:  2;
  --z-focused: 5;
  --z-sticky:  10;    /* panel sticky title bar */
  --z-handle:  11;    /* mobile sheet grabber */
  --z-sidebar: 100;
  --z-sheet:   200;   /* mobile bottom sheet */
  --z-pager:   250;   /* mobile fixed pager bar */
  --z-appbar:  300;
  --z-editor:  400;
  --z-menu:    500;
  --z-chip:    1000;
  --z-modal:   3000;

  /* ===================== EDITOR (always-dark, not themed) =============== */
  /* A self-contained dark surface (the same in both themes) skinned with Crumb's
     own dark-mode zinc palette — not a third-party theme. See invariant 10. */
  --ed-bg:          #141417;   /* editor surface (Crumb dark --bg) */
  --ed-surface:     #1e1e22;   /* active line / elevated (Crumb dark --surface) */
  --ed-text:        #e8e8ea;
  --ed-muted:       #9a9aa2;   /* gutter / line numbers */
  --ed-placeholder: #6b6b73;
  --ed-caret:       #e8e8ea;
  --ed-border:      #313139;
  --ed-hover:       #2a2a33;   /* menu/button hover on the dark editor chrome */
  --ed-selection-bg:#2a2a33;
  --ed-error-text:  #f87171;   /* Crumb dark --danger */
  /* CodeMirror syntax — desaturated accents tuned to the zinc base. */
  --ed-syntax-key:     #93c5fd;
  --ed-syntax-string:  #86efac;
  --ed-syntax-comment: #71717a;
  --ed-syntax-number:  #fcd34d;
  --ed-syntax-bool:    #c4b5fd;
}

/* System-preference dark theme. Re-declares ONLY the theme-token group above
   (zinc dark palette). Map-overlay (markers/chip), editor, and every static
   token are inherited unchanged — markers stay dark-on-light over the map. */
@media (prefers-color-scheme: dark) {
  :root {
    /* Surfaces — soft near-black base, lifting in steps for elevation.
       --muted-bg sits just above bg so list hovers stay gentle, leaving a clear
       gap up to --border for the icon-button (nav/close) hover. */
    --bg:            #141417;   /* soft black */
    --surface:       #1e1e22;   /* elevated note/info/modal */
    --muted-bg:      #202024;   /* hover */
    --border:        #313139;

    /* Text — soft off-white, not pure, easier on the eyes on dark */
    --text:           #e8e8ea;
    --text-secondary: #c8c8cd;
    --muted:          #9a9aa2;

    /* Brand / action (inverts: light chip on dark UI) */
    --primary:        #fafafa;
    --primary-fg:     #18181b;
    --primary-hover:  #e4e4e7;  /* zinc-200 */
    --primary-muted:  #d4d4d8;  /* zinc-300 — "more" link hover */

    /* Semantic */
    --danger:    #f87171;       /* red-400 */
    --danger-bg: #2a1212;
    --danger-bd: #7f1d1d;       /* red-900 */

    /* Activity — dark orange chip */
    --activity:       #fb923c;  /* orange-400 */
    --activity-bg:    #4a3119;  /* brighter orange wash */
    --activity-bd:    #7c4a1e;
    --priority-muted: #71717a;  /* zinc-500 */

    /* Overlay */
    --overlay: rgba(0,0,0,.7);
  }
}

body { font-family: var(--font); font-size: var(--text-base); color: var(--text); background: var(--bg); display: flex; flex-direction: column; }
`

/* .crumb-icon: size, stroke, and color for all Lucide SVG icons used in the UI */
const iconsCSS = `
/* ── Icons ──────────────────────────────────────────────────────────── */
.crumb-icon {
  width: 14px; height: 14px;
  display: inline-block; vertical-align: middle; flex-shrink: 0;
  stroke: currentColor; stroke-width: 1.75;
  stroke-linecap: round; stroke-linejoin: round;
  fill: none;
}
.geo-no-loc { display: inline-flex; align-items: center; margin-left: 5px; color: var(--muted); vertical-align: middle; }
.geo-no-loc .crumb-icon { width: 12px; height: 12px; }
`

/* Token classes emitted by highlightYaml() (yaml-highlight.ts). Shared so BOTH the
   landing's "it's just text" block and the docs page's fenced YAML are styled the
   same way. Monochrome by design — see invariant 11. */
const highlightCSS = `
/* ── YAML highlighting ──────────────────────────────────────────────── */
.yml-k { color: var(--text); font-weight: 500; }
.yml-v { color: var(--text-secondary); }
.yml-c { color: var(--muted); font-style: italic; }
.yml-p { color: var(--muted); }
.yml-s { color: var(--text-secondary); }   /* block-scalar body (note text), not parsed as YAML */
`

/* #main split layout: editor-pane | splitter | map (sidebar floats inside map) */
const layoutCSS = `
/* ── Layout ─────────────────────────────────────────────────────────── */
#main { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* Editor pane: a resizable left split. Width is driven by --editor-width on
   #main (set by the splitter drag in app-layout.ts), defaulting to a third.
   position:relative anchors the floating menu pill and bottom status bar. */
#editor-pane {
  position: relative;
  width: var(--editor-width, 33%);
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;   /* let menu flyouts extend past the pane; CM clips via .editor-host */
  background: var(--ed-bg);
}

/* Draggable divider between the editor pane and the map. */
#editor-splitter {
  flex: 0 0 auto;
  width: 6px;
  cursor: col-resize;
  background: var(--ed-border);
  transition: background var(--duration);
}
#editor-splitter:hover,
#editor-splitter.dragging { background: var(--ed-muted); }

#map { flex: 1; min-width: 0; position: relative; }

/* ── Floating sidebar panel ──────────────────────────────────────────── */
#sidebar {
  position: absolute;
  top: 12px; left: 12px; bottom: 12px;
  width: 320px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sidebar);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: var(--z-sidebar);
}
`

/* #app-bar: floating menu pill (editor mode only) and its dropdown submenus */
const menuCSS = `
/* ── Menu pill ───────────────────────────────────────────────────────── */
/* A floating rounded pill over the editor's top-left. It sits over the
   always-dark editor, so it (and its dropdowns) stay dark in both themes,
   using the editor's --ed-* tokens. */
#app-bar {
  position: absolute;
  top: 10px; left: 10px;
  z-index: var(--z-appbar);
  display: flex;
  align-items: center;
  gap: 1px;
  height: var(--appbar-h);
  padding: 3px 5px;
  background: var(--ed-surface);
  border: 1px solid var(--ed-border);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sidebar);
  user-select: none;
}

.app-bar-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 9px;
  font-size: var(--text-sm);
  color: var(--ed-text);
  cursor: pointer;
  border-radius: var(--radius-full);
}
.app-bar-item:hover { background: var(--ed-hover); }
.app-bar-item.open  { background: var(--ed-hover); }

.app-bar-chevron { display: inline-flex; color: var(--ed-muted); }
.app-bar-chevron .crumb-icon { width: 11px; height: 11px; stroke-width: 2; }

/* Icon buttons in the pill (undo / redo / help). */
.app-bar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--ed-text);
  text-decoration: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--duration);
}
.app-bar-icon-btn:hover { background: var(--ed-hover); }
.app-bar-icon-btn .crumb-icon { width: 15px; height: 15px; stroke-width: 2; }
/* The bare "?" glyph sits small within its viewBox — size it up to match. */
#menu-help .crumb-icon { width: 22px; height: 22px; stroke-width: 1.75; }

/* Thin divider grouping the File menu from the icon buttons. */
.app-bar-sep {
  width: 1px;
  align-self: stretch;
  margin: 4px 3px;
  background: var(--ed-border);
  flex-shrink: 0;
}

/* ── Examples dropdown ───────────────────────────────────────────────── */
.app-bar-submenu {
  position: absolute;
  top: calc(100% + 2px); left: 0;
  z-index: var(--z-menu);
  min-width: 180px;
  background: var(--ed-surface);
  border: 1px solid var(--ed-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 6px;
  display: none;
}
.app-bar-submenu.open { display: block; animation: menu-in 120ms ease; }

@keyframes menu-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.menu-sub-item {
  display: flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--ed-text);
  cursor: pointer;
  user-select: none;
}
.menu-sub-item:hover { background: var(--ed-hover); }

/* ── Second-level (flyout) submenus: Open recent, Export ──────────────── */
.menu-sub-parent { position: relative; }
.menu-sub-arrow { display: inline-flex; margin-left: auto; padding-left: 12px; color: var(--ed-muted); }
.menu-sub-arrow .crumb-icon { width: 13px; height: 13px; stroke-width: 2; }

.menu-flyout {
  top: -7px;            /* align the first flyout item with the parent row */
  left: 100%;           /* open to the right, touching the parent's edge */
}
.menu-sub-parent:hover > .menu-flyout { display: block; animation: menu-in 120ms ease; }

.menu-sub-item--muted { color: var(--ed-muted); cursor: default; }
.menu-sub-item--muted:hover { background: transparent; color: var(--ed-muted); }

.menu-sub-item--disabled { color: var(--ed-muted); cursor: default; pointer-events: none; }

.menu-sub-sep { height: 1px; background: var(--ed-border); margin: 4px 0; }
`

/* #editor-pane, the edge collapse/expand buttons, #editor-status, .cm-editor */
const editorCSS = `
/* ── Edge buttons: collapse / expand, inside the editor's top-right corner ── */
/* Identical opaque circular buttons (opaque so code scrolls behind, never on top
   of them) — one shown when open (collapse), the other when collapsed (expand).
   Kept clear of the divider; never overlap the map. */
.editor-edge-btn {
  display: none;
  position: absolute;
  top: 10px;              /* aligned with the menu pill (same top + height) */
  right: 10px;            /* inside the editor's top-right corner; clear of the divider */
  z-index: var(--z-appbar);
  width: var(--appbar-h);
  height: var(--appbar-h);
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ed-surface);
  color: var(--ed-text);
  border: 1px solid var(--ed-border);
  box-shadow: var(--shadow-sidebar);
  cursor: pointer;
  transition: background var(--duration);
}
.editor-edge-btn:hover { background: var(--ed-hover); }
.editor-edge-btn .crumb-icon { width: 16px; height: 16px; stroke-width: 2; }

/* Open: show collapse; Collapsed: show expand. */
#editor-pane:not(.collapsed) > #editor-collapse { display: inline-flex; }
#editor-pane.collapsed       > #editor-reopen   { display: inline-flex; }

/* ── Collapsed state: a narrow rail still revealing a peek of the code ────── */
/* The pane shrinks to a strip that keeps a slice of real code visible; the menu
   pill and status bar hide, and the whole rail click-expands (the code peek is
   non-interactive so the click always reaches the rail). The expand button stays
   in its top-right corner. */
#editor-pane.collapsed {
  width: 56px;          /* button (--appbar-h, 36px) + ~10px margin each side */
  min-width: 56px;
  cursor: pointer;
}
#editor-pane.collapsed > #app-bar,
#editor-pane.collapsed > #editor-status { display: none; }
#editor-pane.collapsed > .editor-host { pointer-events: none; }
/* Drop the line-number gutter in the peek — show just code. */
#editor-pane.collapsed .cm-gutters { display: none; }

/* ── Mobile editor/map toggle (top-right of the screen; desktop hides it) ── */
#editor-mobile-toggle {
  display: none;
  position: fixed;
  top: 10px; right: 10px;            /* aligned with the menu pill (top:10) */
  z-index: var(--z-chip);            /* above the full-screen editor */
  width: var(--appbar-h);            /* same height as the menu pill */
  height: var(--appbar-h);
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ed-surface);     /* always-dark, matching the editor chrome */
  color: var(--ed-text);
  border: 1px solid var(--ed-border);
  box-shadow: var(--shadow-sidebar);
  cursor: pointer;
}
#editor-mobile-toggle:hover { background: var(--ed-hover); }
#editor-mobile-toggle .crumb-icon { width: 18px; height: 18px; stroke-width: 2; }
#editor-mobile-toggle .ic-map,
#editor-mobile-toggle .ic-code { display: none; align-items: center; }
#editor-mobile-toggle .ic-map { display: inline-flex; }   /* editor open → offer the map */
/* Map view: tuck behind the bottom-sheet panel and swap to the code icon. */
body.editor-collapsed #editor-mobile-toggle { z-index: var(--z-sidebar); }
body.editor-collapsed #editor-mobile-toggle .ic-map  { display: none; }
body.editor-collapsed #editor-mobile-toggle .ic-code { display: inline-flex; }

/* ── CodeMirror host (fills the pane; scrolls internally) ────────────── */
.editor-host { flex: 1; min-height: 0; overflow: hidden; }
.editor-host .cm-editor { height: 100%; background: var(--ed-bg); }
.editor-host .cm-editor.cm-focused { outline: none; }
.editor-host .cm-scroller {
  font-family: var(--mono);
  font-size: var(--text-xs);
  line-height: 1.7;
}
/* Top padding clears the floating menu pill (≈ pill height 36 + 10 margin + gap). */
.editor-host .cm-content { padding: 56px 0 14px; caret-color: var(--ed-caret); }
.editor-host .cm-gutters {
  background: var(--ed-bg);
  color: var(--ed-muted);
  border-right: 1px solid var(--ed-border);
}

/* ── Status bar (always-present; no reflow on error) ─────────────────── */
#editor-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background: var(--ed-surface);
  border-top: 1px solid var(--ed-border);
  color: var(--ed-muted);
  font-family: var(--mono);
  font-size: var(--text-2xs);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#editor-status.has-error { color: var(--ed-error-text); }
`

/* #panel-nav, #panel-content — desktop sidebar panel */
const listCSS = `
/* ── Panel content ───────────────────────────────────────────────────── */
#panel-nav {
  flex-shrink: 0;
  padding: 10px 16px 0;
}
#panel-nav:empty { padding: 0; }

#panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  min-height: 0;
}
#panel-content::-webkit-scrollbar { width: 4px; }
#panel-content::-webkit-scrollbar-track { background: transparent; }
#panel-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: var(--radius-full); }

/* ── Sticky title bar (appears when trip title scrolls out of view) ──── */
/* The outer bar is a zero-height sticky anchor; the inner element is an absolute
   overlay that paints OVER the content below. Because the outer never occupies flow
   height, toggling the bar never reflows the scroll container — that reflow is what
   used to push the observed title back into view and flicker the bar on/off. */
.panel-sticky-bar {
  position: sticky;
  top: 0;
  height: 0;
  z-index: var(--z-sticky);
}
.panel-sticky-inner {
  position: absolute;
  top: 0; left: 0; right: 0;
  background: var(--bg);
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-bottom: 1px solid transparent;
  opacity: 0;
  pointer-events: none;
  /* Compositor-only reveal (opacity + transform); layout is never animated. */
  transform: translateY(-6px);
  transition: opacity var(--duration), transform var(--duration), border-color var(--duration);
}
.panel-sticky-bar.--visible .panel-sticky-inner {
  opacity: 1;
  transform: translateY(0);
  border-bottom-color: var(--border);
  pointer-events: auto;
}
.sticky-bar-name {
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sticky-bar-badge { flex-shrink: 0; }
.panel-sticky-inner:has(.sticky-bar-badge) {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.sticky-bar-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.sticky-bar-close {
  margin-top: 0;
  width: 26px; height: 26px;
}
.sticky-bar-meta {
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--muted);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`

/* .modal-overlay, .modal-box — shared overlay and container for New/Generate/About modals */
const modalCSS = `
/* ── Modals ──────────────────────────────────────────────────────────── */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--overlay);
  align-items: center;
  justify-content: center;
}
.modal-overlay.open { display: flex; animation: overlay-in var(--duration) ease; }
@keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }

.modal-box {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 512px;
  max-height: calc(100vh - 64px);
  margin: 0 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  animation: dialog-in var(--duration) ease;
}
@keyframes dialog-in {
  from { opacity: 0; transform: translateY(-8px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-x {
  position: absolute;
  top: 16px; right: 16px;
  appearance: none; border: none; background: transparent;
  color: var(--muted); cursor: pointer;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-xs);
  transition: background var(--duration), color var(--duration);
}
.modal-x .crumb-icon { width: 16px; height: 16px; stroke-width: 2; }
.modal-x:hover { background: var(--muted-bg); color: var(--text); }

.modal-header { display: flex; flex-direction: column; gap: 4px; }
.modal-title { font-size: var(--text-panel); font-weight: 600; line-height: 1.3; padding-right: 24px; }
.modal-description { font-size: var(--text-sm); color: var(--muted); line-height: 1.5; }

.modal-body { overflow-y: auto; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; }

.action-btn {
  font-family: var(--font);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  transition: background var(--duration);
}
.action-btn:hover { background: var(--muted-bg); }
.action-btn--danger { color: var(--danger); border-color: var(--danger-bd); }
.action-btn--danger:hover { background: var(--danger-bg); }
.action-btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.action-btn.primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }

.ref-intro { font-size: var(--text-sm); color: var(--text); line-height: 1.6; margin-bottom: 14px; }
.ref-prompt-block { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; }
.ref-prompt-label { font-size: var(--text-3xs); font-weight: 600; color: var(--muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 6px; }
.ref-prompt-text { font-size: var(--text-xs); color: var(--muted); line-height: 1.6; font-style: italic; }

.embed-snippet {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: var(--mono);
  font-size: var(--text-2xs);
  line-height: 1.6;
  padding: 10px 12px;
  outline: none;
  white-space: pre;
  overflow: auto;
  transition: border-color var(--duration);
}
.embed-snippet:focus { border-color: var(--muted); }
`

/* MapLibre markers: .place-marker, .detail-marker, .place-popup, .detail-popup, route line, .map-status-chip */
const mapCSS = `
/* Attribution: no pill — rest as a muted "i" glyph straight on the map (mobile
   especially), and reveal the text with no background box. Full opacity on hover/focus
   or once expanded. Tap still reveals "© OpenStreetMap contributors" — attribution
   stays one tap away. */
.maplibregl-ctrl-attrib.maplibregl-compact {
  opacity: .5;
  margin: 16px;
  background: none;
  transition: opacity var(--duration);
}
.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button,
.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button {
  background-color: transparent;
}
/* Inner credit text. No background box, so a thin translucent-white outline keeps it
   legible over busy/gray map detail (cities) — doubled shadow = a slightly stronger halo.
   Single line, ellipsis-truncated on narrow maps (right-anchored + LTR, so the tail trims
   and the "© OpenMapTiles" prefix stays visible). Collapse/expand is a fade: opacity
   animates over --duration while the width snaps behind it (max-width 0s, delayed on
   collapse) so it reads as a fade rather than a slide. display:block overrides maplibre's
   display:none, which can't transition. */
.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner {
  display: block;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-shadow: 0 0 2px var(--attrib-halo), 0 0 2px var(--attrib-halo);
  transition: opacity var(--duration), max-width 0s var(--duration);
}
.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-inner {
  max-width: calc(100vw - 32px);
  opacity: 1;
  transition: opacity var(--duration), max-width 0s;
}
.maplibregl-ctrl-attrib.maplibregl-compact:hover,
.maplibregl-ctrl-attrib.maplibregl-compact:focus-within,
.maplibregl-ctrl-attrib.maplibregl-compact-show {
  opacity: 1;
}

/* ── Geocoding status chip ───────────────────────────────────────────── */
.map-status-chip {
  position: fixed;
  bottom: 16px; right: 16px;
  z-index: var(--z-chip);
  background: var(--chip-bg);
  color: var(--chip-fg);
  font-size: var(--text-xs); font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  pointer-events: none;
  transition: opacity 300ms;
}
.map-status-chip:empty { opacity: 0; }

/* ── MapLibre popup overrides ────────────────────────────────────────── */
/* drop-shadow on the wrapper wraps content + tip as one outline, so the tip
   has no border line crossing its base (a content border would do that) */
.place-popup,
.detail-popup { filter: drop-shadow(0 2px 12px rgba(0,0,0,.12)); }
/* detail (activity/stay/transport) popups sit above place popups/markers */
.place-popup  { z-index: 4; }
.detail-popup { z-index: 5; }
.place-popup .maplibregl-popup-content,
.detail-popup .maplibregl-popup-content {
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  font-family: var(--font);
  font-size: var(--text-sm);
  background: var(--bg);
  border: none;
  box-shadow: none;
}
/* Shrink the tip triangle via border-width (default 10px) — keeps its base flush
   against the content, unlike transform:scale which lifts it off and leaves a gap */
.place-popup .maplibregl-popup-tip,
.detail-popup .maplibregl-popup-tip { border-top-color: var(--bg); border-width: 7px; }
.popup-title { color: var(--text); font-weight: 500; }

/* ── Place markers ───────────────────────────────────────────────────── */
.place-marker {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--marker-bg);
  border: 3px solid var(--marker-ring);
  box-shadow: var(--shadow-marker);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  z-index: var(--z-marker);
  transition: background var(--duration), box-shadow var(--duration);
}
.place-marker:hover { background: var(--marker-bg-hover); }
.place-marker.--focused {
  box-shadow: var(--shadow-marker-active);
}
.place-marker-num {
  color: var(--marker-fg); font-size: var(--text-2xs); font-weight: 600;
  font-family: var(--font); line-height: 1; user-select: none;
}
body.map-zoom-close .place-marker { display: none; }

/* ── Detail markers (activities, stays, transport) ────────────────────────── */
.detail-marker {
  border-radius: 50%;
  border: 1.5px solid var(--marker-ring);
  box-shadow: var(--shadow-marker-sm);
  cursor: pointer;
  display: none;
  align-items: center; justify-content: center;
}
.detail-marker--must,
.detail-marker--activity { background: var(--marker-activity); border-radius: var(--radius-md); }
.detail-marker--maybe    { background: var(--marker-activity); border-radius: var(--radius-md); opacity: 0.5; }
.detail-marker--stay     { background: var(--marker-bg); }
.detail-marker--transport      { background: var(--marker-bg); }

/* zoom medium (8–11): activity + stay + transport dots, small */
body.map-zoom-medium .detail-marker--must,
body.map-zoom-medium .detail-marker--activity,
body.map-zoom-medium .detail-marker--maybe,
body.map-zoom-medium .detail-marker--stay,
body.map-zoom-medium .detail-marker--transport { display: flex; width: 12px; height: 12px; }

/* zoom close (12+): all markers, full size */
body.map-zoom-close .detail-marker { display: flex; width: 28px; height: 28px; border-width: 2px; }

/* Labels (activities) */
.detail-marker-label {
  display: none; color: var(--marker-fg); font-size: var(--text-3xs); font-weight: 600;
  font-family: var(--font); line-height: 1; user-select: none;
}
body.map-zoom-close .detail-marker-label { display: block; }

/* Icons (stays + transport) */
.detail-marker .crumb-icon {
  display: none;
  width: 13px; height: 13px;
  stroke: var(--marker-fg); fill: none;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
body.map-zoom-close .detail-marker--stay .crumb-icon,
body.map-zoom-close .detail-marker--transport  .crumb-icon { display: block; }

/* ── Map click targets ───────────────────────────────────────────────── */
[data-map-link]       { cursor: pointer; }
[data-map-link]:hover { text-decoration: underline; text-decoration-color: var(--border); }

/* ── Focus states (list ↔ map sync) ─────────────────────────────────── */
.detail-marker.--focused {
  box-shadow: var(--shadow-marker-active);
  z-index: var(--z-focused);
}

/* ── Geocoding spinner ───────────────────────────────────────────────── */
@keyframes geo-spin { to { transform: rotate(360deg); } }

.place-num.--loading { color: transparent; }
.place-num.--loading::after {
  content: ""; position: absolute; inset: 4px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--primary-fg) 25%, transparent); border-top-color: var(--primary-fg);
  animation: geo-spin 700ms linear infinite;
}
.act-badge.--loading { color: transparent; }
.act-badge.--loading::after {
  content: ""; position: absolute; inset: 3px; border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--activity) 15%, transparent); border-top-color: var(--activity);
  animation: geo-spin 700ms linear infinite;
}
/* Inline spinner shown to the right of a transport from/to name while geocoding */
.waypoint-spinner {
  display: inline-block; width: 11px; height: 11px;
  margin-left: 6px; border-radius: 50%; vertical-align: -1px;
  border: 1.5px solid var(--border); border-top-color: var(--muted);
  animation: geo-spin 700ms linear infinite;
}
`

/* Itinerary content shared bits: place-num, transport route (.tl-*), tags, notes, info */
const itineraryCSS = `
/* ─────────────────────────────────────────────────────────────────────
   Itinerary content
   ───────────────────────────────────────────────────────────────────── */

/* ── Place ───────────────────────────────────────────────────────────── */
.place-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-fg);
  font-size: var(--text-sm);
  font-weight: 700;
  position: relative;
}

.place-meta-sep { opacity: 0.5; margin: 0 3px; font-size: var(--text-xs); }
.place-duration, .place-dates { font-size: var(--text-sm); color: var(--muted); }.date-inferred {
  text-decoration: underline dotted;
  text-decoration-color: var(--muted);
  text-underline-offset: 2px;
  opacity: 0.85;
}
.value-unknown { text-decoration: line-through; opacity: 0.5; }

/* ── Transport ───────────────────────────────────────────────────────── */
.transport-body { flex: 1; min-width: 0; }
.transport-route-block { display: flex; flex-direction: column; }

.tl-row { display: flex; gap: 10px; align-items: center; }
.tl-marker { width: 8px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
.tl-marker-line { align-self: stretch; }
.tl-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bg); border: 1.5px solid var(--text); flex-shrink: 0; }
.tl-line {
  flex: 1; width: 1.5px; min-height: 14px;
  background: repeating-linear-gradient(to bottom, var(--text) 0px, var(--text) 2px, transparent 2px, transparent 4px);
}

.waypoint-name { font-size: var(--text-sm); font-weight: 500; color: var(--text); line-height: 1.3; }
.tl-meta { display: flex; flex-direction: column; gap: 2px; padding: 3px 0; }
.tl-meta .waypoint-time { margin-bottom: 6px; }
.tl-indent { padding-left: 18px; }
.waypoint-time { font-size: var(--text-xs); color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
.waypoint-time .crumb-icon { width: 11px; height: 11px; }
.segment-duration { font-size: var(--text-xs); color: var(--muted); }

/* Boxed note + info blocks beneath transport/stay/activity headers share one
   surface treatment and one canonical top margin (replaces the old per-type
   .transport-/.stay-/.act- margin rules). */
.panel-note,
.panel-info {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  margin-top: 10px;
}
.panel-info { display: flex; flex-direction: column; gap: 4px; }
/* Section break after the from/to route block (transport + stay panels):
   the panel's 16px section rhythm rather than the 10px inter-block gap. */
.transport-route-block + .panel-note,
.transport-route-block + .panel-info { margin-top: 16px; }

/* ── Stays ───────────────────────────────────────────────────────────── */
.stay-icon-wrap.--loading svg { visibility: hidden; }
.stay-icon-wrap.--loading::after {
  content: ""; position: absolute; inset: 2px; border-radius: 50%;
  border: 1.5px solid var(--spinner-track); border-top-color: var(--muted);
  animation: geo-spin 700ms linear infinite;
}

/* ── Tags ────────────────────────────────────────────────────────────── */
.tags { margin: 4px 0 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  display: inline-flex;
  align-items: center;
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 2px 6px;
  font-size: var(--text-xs);
}
.tag--icon {
  gap: 3px;
  padding: 2px 5px;
}
.tag--icon .crumb-icon { width: 11px; height: 11px; }

/* ── Notes ───────────────────────────────────────────────────────────── */
.note {
  font-size: var(--text-sm); font-weight: 400; color: var(--text-secondary);
  margin: 5px 0 8px; line-height: 1.6;
}
.note ul { padding-left: 20px; margin: 4px 0; list-style: disc; }
.note li { padding-left: 2px; line-height: 1.5; }
.note li + li { margin-top: 2px; }
.note p + p { margin-top: 4px; }
.note a { color: var(--text); text-decoration: underline; text-decoration-color: var(--border); }
.note a:hover { text-decoration-color: var(--muted); }
.note code {
  font-family: var(--mono); font-size: 0.9em;
  background: var(--muted-bg); padding: 1px 4px; border-radius: var(--radius-xs);
}

/* ── Info lists ──────────────────────────────────────────────────────── */
.info-item { display: flex; gap: 8px; font-size: var(--text-sm); }
.info-item .info-key { color: var(--text-secondary); min-width: 64px; flex-shrink: 0; }
.info-item .info-val { color: var(--text-secondary); }

/* ── Empty state ─────────────────────────────────────────────────────── */
.panel-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 14px; padding: 32px 28px; text-align: center;
}
.panel-empty-title { font-size: var(--text-2xl); font-weight: 700; letter-spacing: -0.02em; color: var(--muted); }
.panel-empty-brand { font-size: var(--text-2xl); letter-spacing: -0.02em; }
.panel-empty-message { margin: 0; font-size: var(--text-sm); color: var(--muted); max-width: 28ch; line-height: 1.5; }
.panel-empty-recents { display: flex; flex-direction: column; width: 100%; max-width: 280px; margin-top: 4px; text-align: left; }
.panel-empty-recents-box {
  background: var(--surface); border-radius: var(--radius-md); overflow: hidden;
}
.panel-empty-recent {
  display: flex; align-items: center; gap: 9px; overflow: hidden;
  width: 100%; text-align: left; font-family: var(--mono); font-size: var(--text-xs); color: var(--text-secondary);
  padding: 9px 11px; background: transparent; border: none; cursor: pointer;
  transition: background var(--duration);
}
.panel-empty-recent + .panel-empty-recent { border-top: 1px solid var(--muted-bg); }
.panel-empty-recent:hover { background: var(--muted-bg); }
.panel-empty-recent .crumb-icon { flex: none; color: var(--muted); width: 15px; height: 15px; }
.panel-empty-recent-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Trip panel header ───────────────────────────────────────────────── */
.panel-trip-header {
  padding: 16px 16px 14px;
}
/* Legend variant (card embed): owns its spacing (the legend container pads it) and
   drops the inert note "more" toggle. */
.panel-trip-header--legend { padding: 0; }
.panel-trip-header--legend .note-more { display: none; }
.trip-eyebrow {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 2px;
}
.trip-eyebrow-logo {
  font-family: var(--mono);
  font-weight: 600;
  color: var(--text);
}
.trip-eyebrow-sep { opacity: 0.5; margin: 0 6px; }
.trip-duration {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--muted);
  margin-top: 3px;
}
.panel-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.panel-title-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.panel-title-body .trip-duration { margin-top: 0; }
.panel-place-name {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.panel-trip-name {
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 24px;
}
.trip-author {
  font-size: var(--text-xs);
  color: var(--muted);
  margin-top: 8px;
}

/* ── Unified panel header ────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 14px;
}
/* No meta subtitle (transport panels, meta-less places) → the title is a single
   short line; center it (and the badge) against the taller close button instead
   of top-aligning. Zero the row's bottom margin so the title sits at true centre. */
.panel-header:not(:has(.trip-duration)) { align-items: center; }
.panel-header:not(:has(.trip-duration)) .panel-title-row {
  align-items: center;
  margin-bottom: 0;
}
/* single-place flat view: more air above the place title, tighter below */
.panel-header--flat { padding: 28px 16px 2px; }
.panel-header--flat .panel-title-row { margin-bottom: 4px; }
.panel-header-body { flex: 1; min-width: 0; }
.panel-close {
  flex-shrink: 0;
  width: 40px; height: 40px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--muted-bg);
  cursor: pointer;
  color: var(--text);
  display: flex; align-items: center; justify-content: center;
  transition: background var(--duration), color var(--duration);
}
.panel-close:hover { background: var(--border); }
.panel-close .crumb-icon { width: 16px; height: 16px; stroke-width: 2; }

/* ── Panel footer navigation ─────────────────────────────────────────── */
#panel-footer { flex-shrink: 0; }
#panel-footer:empty { display: none; }
.panel-footer-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg);
  border-top: 1px solid var(--border);
}
.panel-nav-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted-bg);
  cursor: pointer;
  color: var(--text);
  transition: background var(--duration);
}
.panel-nav-btn:hover:not(:disabled) { background: var(--border); }
.panel-nav-btn:disabled { opacity: 0.35; cursor: default; }
/* Match the close icon's stroke (2) — the 1.75 .crumb-icon default reads light beside it */
.panel-nav-btn .crumb-icon { stroke-width: 2; }
.panel-nav-counter {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--muted);
}

/* ── Item panels (shared) ────────────────────────────────────────────── */
.panel-place-body,
.panel-transport-body,
.panel-activity-body,
.panel-stay-body { padding: 0 16px 16px; }

/* ── Transport panel ─────────────────────────────────────────────────── */
.panel-transport-name {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.panel-transport-icon {
  width: 32px;
  height: 32px;
  background: none;
  border-radius: 0;
}
.panel-transport-icon .crumb-icon { width: 18px; height: 18px; }
.panel-transport-body .transport-route-block {
  padding-left: 8px;
}

/* ── Activity panel ──────────────────────────────────────────────────── */
.panel-activity-name {
  font-size: var(--text-panel);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.panel-act-badge {
  width: 40px;
  height: 40px;
  font-size: var(--text-base);
  flex-shrink: 0;
}

/* ── Stay panel ──────────────────────────────────────────────────────── */
.panel-stay-name {
  font-size: var(--text-panel);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.panel-stay-icon {
  width: 40px;
  height: 40px;
  background: none;
  border-radius: 0;
}
.panel-stay-icon .crumb-icon { width: 18px; height: 18px; }

/* ── Panel list ──────────────────────────────────────────────────────── */
.panel-list { list-style: none; padding: 6px 0; position: relative; }
.panel-trip-header + .panel-list:not(.panel-list--flat)::before {
  content: '';
  position: absolute;
  left: calc(8px + 10px + 12px);
  top: 28px; bottom: 28px;
  border-left: 1.5px dashed var(--border);
  transform: translateX(-50%);
  pointer-events: none;
}

/* Every .list-item is a tappable card (dividers use .list-divider instead), so
   the card geometry lives on the base; the --type modifiers only carry what is
   unique to each (transport's muted text, badge nudges, icon-wrap hovers). */
.list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 8px;
  width: calc(100% - 16px);
  min-height: 52px;
  padding: 7px 10px;
  cursor: pointer;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  transition: background var(--duration);
}
.list-item:hover { background: var(--muted-bg); }
/* Top-align the badge with the first line once a meta row makes the card taller. */
.list-item:has(.list-item-meta) { align-items: flex-start; }
.list-item .list-item-label { font-size: var(--text-base); font-weight: 500; }

.list-item-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  min-width: 0;
}

/* ── Place cards ─────────────────────────────────────────────────────── */
.list-item--place:has(.list-item-meta) .place-num--sm { margin-top: 1px; }

/* ── Transport cards ─────────────────────────────────────────────────── */
.list-item--transport { position: relative; color: var(--muted); }
.list-item--transport:hover .transport-icon-wrap { background: var(--muted-bg); }
.list-item--transport:has(.list-item-meta) .transport-icon-wrap { margin-top: 1px; }

.transport-icon-wrap {
  width: 24px; height: 24px;
  flex-shrink: 0;
  margin-top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  background: var(--bg);
  border-radius: 50%;
}

.transport-label { color: var(--text); }

/* ── Stay cards ──────────────────────────────────────────────────────── */
.list-item--stay:hover .stay-icon-wrap { background: var(--muted-bg); }
.list-item--stay:has(.list-item-meta) .stay-icon-wrap { margin-top: 1px; }

.stay-icon-wrap {
  width: 24px; height: 24px;
  flex-shrink: 0;
  margin-top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: 50%;
  position: relative;
}

/* ── Activity cards ──────────────────────────────────────────────────── */
.list-item--activity:has(.list-item-meta) .act-badge { margin-top: 1px; }
.list-item--activity:hover .act-badge { background: var(--activity-bg); }

.act-badge {
  width: 26px; height: 26px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--activity-bg);
  color: var(--activity);
  font-size: var(--text-3xs);
  font-weight: 700;
  border: 1px solid color-mix(in srgb, var(--activity-bd) 50%, transparent);
  position: relative;
}

.list-item-label { flex: 1; }
.list-item-meta { color: var(--muted); font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-item-meta .crumb-icon { width: 10px; height: 10px; vertical-align: middle; }
.card-indicator { display: inline-flex; align-items: center; margin-left: 6px; color: var(--muted); vertical-align: middle; }
.card-indicator .crumb-icon { width: 11px; height: 11px; }

.list-divider {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 3px;
  pointer-events: none;
}
.list-divider .list-item-body { flex-direction: row; align-items: baseline; gap: 5px; }
.list-divider--plan .list-item-label {
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--text);
}
/* Day divider: ordinal + name on the left (wraps), date on the right */
.list-divider--day { justify-content: space-between; align-items: flex-start; padding-top: 15px; padding-bottom: 1px; }
.day-divider-main { font-size: var(--text-xs); font-weight: 400; color: var(--text); }
.day-divider-date { font-size: var(--text-xs); color: var(--muted); white-space: nowrap; flex-shrink: 0; }

/* Small place-num variant used in ToC list items */
.place-num--sm { width: 24px; height: 24px; font-size: var(--text-2xs); flex-shrink: 0; box-shadow: 0 0 0 4px var(--bg); }


/* ── Inline note truncation ──────────────────────────────────────────── */
.note-trunc {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
}
.note-trunc.--expanded { display: block; -webkit-line-clamp: unset; line-clamp: unset; }
.note-more {
  cursor: pointer;
  color: var(--primary);
  font-size: var(--text-xs);
  font-weight: 500;
  font-style: normal;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.note-more:hover { color: var(--primary-muted); }

/* ── Menu section label ──────────────────────────────────────────────── */
.menu-section-label {
  padding: 4px 8px 2px;
  font-size: var(--text-3xs);
  font-weight: 600;
  color: var(--ed-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
`

/* @media max-width 767px: sidebar becomes draggable bottom sheet */
const mobileCSS = `
/* ── Sheet handle: hidden on desktop ────────────────────────────────── */
#sheet-handle {
  display: none;
}

@media (max-width: 767px) {

  /* Map: full viewport */
  #map { position: fixed; inset: 0; z-index: 0; }

  /* Editor: full-screen overlay; splitter is desktop-only */
  #editor-pane { position: fixed; inset: 0; width: 100%; z-index: var(--z-editor); }
  #editor-splitter { display: none; }

  /* Collapse fully hides the editor (the map shows); the in-pane edge buttons are
     replaced by the single top-right screen toggle. */
  #editor-pane.collapsed { display: none; }
  #editor-collapse, #editor-reopen { display: none; }
  #editor-mobile-toggle { display: inline-flex; }

  /* Bigger touch targets for the editor chrome (mirrors the viewer's 44px mobile
     buttons). On mobile only the pill and the toggle consume --appbar-h (the edge
     buttons + collapsed strip are display:none above), so bumping the token grows
     both and keeps them the same height. */
  :root { --appbar-h: 44px; }
  #editor-mobile-toggle .crumb-icon { width: 20px; height: 20px; }
  .app-bar-item     { padding: 7px 12px; font-size: var(--text-base); }
  .app-bar-icon-btn { width: 36px; height: 36px; }
  .app-bar-icon-btn .crumb-icon { width: 18px; height: 18px; }
  #menu-help .crumb-icon { width: 26px; height: 26px; }
  /* Clear the now-taller pill so code isn't hidden behind it. */
  .editor-host .cm-content { padding-top: 64px; }

  /* Sidebar becomes a bottom sheet. Fixed full height; JS slides it between
     snap states with transform: translateY (GPU-composited — no per-frame reflow).
     90vh / 40vh mirror SHEET_FULL_RATIO (0.9) and full−medium (0.9−0.5) in
     app-state.ts — keep them in sync by hand (CSS can't read the JS constant). */
  #sidebar {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    top: auto;
    width: 100%;
    height: 90vh;
    transform: translateY(40vh);
    will-change: transform;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: var(--shadow-sheet);
    overflow: hidden;
    z-index: var(--z-sheet);
  }
  /* The pre-JS transform above shows roughly the medium state until initSheet()
     runs — right for the viewer, but in an embed it would flash the un-initialized
     sheet while the render-blocking maplibre script downloads (the card iframe is
     sub-767px). So an embed starts with the sheet fully off-screen; the embed owns
     when it appears (setupEmbedMode reveals the non-card peek; embed-card keeps it
     hidden), instead of leaking the viewer's placeholder. */
  body.embed #sidebar { transform: translateY(100%); }

  /* Sheet handle: a visual grabber only — expansion is scroll-driven, not draggable.
     Floated out of flow (over the sheet top) so it adds no row: #panel-content reaches
     the sheet's top edge — removing the flow seam where content used to peek through —
     and the grabber sits integrated over the heading's top padding. */
  #sheet-handle {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: var(--z-handle);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 0 1px;
    cursor: default;
    pointer-events: none;
  }
  .sheet-handle-bar {
    width: 36px;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--border);
  }

  /* Heading sits just beneath the floating grabber (no handle row to clear). */
  .panel-header      { padding-top: 14px; }
  .panel-header--flat { padding-top: 18px; }

  /* Content scrolls natively; drives sheet expansion via the touch handler in
     app-sheet.ts. Reserve space for the fixed pager bar so the last item clears it
     (must track the pager height set by the larger mobile .panel-nav-btn below). */
  #panel-content {
    touch-action: pan-y;
    overscroll-behavior: contain;
    padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
  }

  /* The sheet is 90vh, so vertically centring the empty state strands it far down
     the sheet with a big gap above. Top-align it instead, just under the grabber. */
  .panel-empty { height: auto; justify-content: flex-start; padding-top: 48px; }

  /* Sticky header is pinned to the sheet (#sidebar is the containing block via its
     transform), not to the scroll container — so the content can still rubber-band
     while the close action stays rock-steady. */
  .panel-sticky-bar {
    position: fixed;
    left: 0; right: 0;
  }

  /* Bigger tap targets on touch screens (these read fine at desktop density). All three
     icon buttons share one size and radius so equal sizes look identical. */
  .panel-nav-btn,
  .panel-close,
  .sticky-bar-close { width: 44px; height: 44px; border-radius: var(--radius-lg); }
  /* In the larger 44px buttons, bump the pager arrows and close X to one shared size so
     all three read identically (desktop keeps its smaller defaults; stroke 2 is global). */
  .panel-nav-btn .crumb-icon,
  .panel-close .crumb-icon { width: 18px; height: 18px; }

  /* Pager: persistent bar fixed to the viewport bottom (reparented out of #sidebar
     by initSheet so it isn't dragged by the sheet's transform). */
  #panel-footer {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: var(--z-pager);
    background: var(--bg);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  /* Match the header's 16px insets so the pager buttons align with the header close. */
  .panel-footer-nav { padding-left: 16px; padding-right: 16px; }

  /* MapLibre controls + status chip: track the live sheet height via --sheet-h.
     --sheet-anim is 0ms during drag (instant) and the spring curve on snap. */
  .maplibregl-ctrl-bottom-right,
  .maplibregl-ctrl-bottom-left,
  .map-status-chip {
    bottom: calc(var(--sheet-h, 50vh) + 8px);
    transition: bottom var(--sheet-anim, 0ms);
  }
  .map-status-chip { right: 12px; }

  /* Tighter margin on mobile — the 16px desktop inset is too much next to the sheet. */
  .maplibregl-ctrl-attrib.maplibregl-compact { margin: 8px; }

  /* Fully-expanded sheet covers all but a sliver of map — fade the attribution out (it
     reads as findable again the moment the sheet collapses). Set in app-sheet.ts. */
  body.sheet-full .maplibregl-ctrl-attrib.maplibregl-compact {
    opacity: 0;
    pointer-events: none;
  }
}
`

const embedCSS = `
/* ── Embed mode: locked-preview map + expand→fullscreen control ───────────── */
.embed-expand-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: var(--z-chip);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);   /* matches the panel close button */
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: background var(--duration);
}
.embed-expand-btn:hover { background: var(--muted-bg); }
.embed-expand-btn .crumb-icon { width: 16px; height: 16px; stroke-width: 2; }

/* Scroll scrim — mobile preview only. A transparent layer over the locked map
   and static sheet whose touch-action: pan-y lets a vertical swipe scroll the
   HOST page (the map/sheet would otherwise trap it). Sits just below the expand
   button; removed in fullscreen, where real interaction is wanted. */
.embed-scrim { display: none; }
@media (max-width: 767px) {
  body.embed:not(.embed-full) .embed-scrim {
    display: block;
    position: absolute;
    inset: 0;
    z-index: calc(var(--z-chip) - 1);
    touch-action: pan-y;
    background: transparent;
  }
}

/* Card embed (embed.html?...&card): a self-contained trip card — the map on the
   left, the trip-overview panel as a static legend on the right; no controls. */
body.embed-card #sidebar,
body.embed-card .embed-expand-btn,
body.embed-card #map-status,
body.embed-card .embed-scrim,
body.embed-card .maplibregl-control-container { display: none !important; }

/* #main is already a flex row; #map (flex:1, min-width:0) takes the left, the
   legend is a fixed-width right column. The map sizes into the left column at
   init (the embed-card class is set before the map renders).
   The card iframe is narrower than the 767px mobile breakpoint, so the app's
   mobile rule (#map: position:fixed, full-bleed) would otherwise pull the map
   out of flow and drop the legend on the left — keep #map a relative flex child. */
body.embed-card #map { position: relative; inset: auto; z-index: auto; flex: 1; height: 100%; }
/* Smaller markers — the card map is a miniature, so the pins shrink with it. */
body.embed-card .place-marker { width: 20px; height: 20px; border-width: 2px; }
body.embed-card .place-marker-num { font-size: 9px; }
body.embed-card.map-zoom-medium .detail-marker { width: 10px; height: 10px; }
body.embed-card.map-zoom-close .detail-marker { width: 22px; height: 22px; }
#embed-card-legend { display: none; }
body.embed-card #embed-card-legend {
  display: block;
  position: relative;
  flex: 0 0 50%;
  min-width: 0;
  height: 100%;
  padding: 20px 22px;
  background: var(--bg);
  border-left: 1px solid var(--border);
  overflow: hidden;   /* no scroll */
}
body.embed-card #embed-card-legend:empty { display: none; }
/* No scroll: a short white fade at the very bottom hints there's more list below. */
body.embed-card #embed-card-legend::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 36px;
  background: linear-gradient(to bottom, transparent, var(--bg));
  pointer-events: none;
}
/* The legend renders the trip panel in its "legend" variant
   (renderTripPanel(doc, { variant: "legend" })): the renderer already drops the
   sticky bar, tags, and timeline connector structurally — so all that's left here is
   sizing the miniature down. */
body.embed-card #embed-card-legend .panel-list { padding: 6px 0 0; }

/* Smaller type + tighter rows — the card legend is a miniature of the big map
   embed: a list of content, not the full-size sidebar panel. */
/* Eyebrow ("crumb · duration") reads as a muted caption above the title. */
body.embed-card #embed-card-legend .trip-eyebrow { font-size: var(--text-xs); margin-bottom: 7px; }
body.embed-card #embed-card-legend .trip-eyebrow-logo { color: var(--muted); }
body.embed-card #embed-card-legend .panel-trip-name { font-size: var(--text-lg); letter-spacing: -0.02em; margin-bottom: 6px; }
body.embed-card #embed-card-legend .note { font-size: var(--text-xs); }
body.embed-card #embed-card-legend .list-item {
  min-height: 0;
  margin: 0 4px;
  width: calc(100% - 8px);
  padding: 4px 8px;
  gap: 5px;
  font-size: var(--text-xs);
}
body.embed-card #embed-card-legend .list-item .list-item-label { font-size: var(--text-sm); }
body.embed-card #embed-card-legend .list-item-meta { font-size: var(--text-2xs); }
body.embed-card #embed-card-legend .place-num--sm { width: 20px; height: 20px; }
body.embed-card #embed-card-legend .transport-icon-wrap,
body.embed-card #embed-card-legend .stay-icon-wrap { width: 20px; height: 20px; }
`

export const CSS = [
  resetCSS,
  tokensCSS,
  iconsCSS,
  highlightCSS,
  layoutCSS,
  menuCSS,
  editorCSS,
  listCSS,
  modalCSS,
  mapCSS,
  itineraryCSS,
  mobileCSS,
  embedCSS,
].join("\n")
