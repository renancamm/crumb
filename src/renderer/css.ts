/**
 * Crumb CSS
 *
 * Layout: editor-panel (left split) | sidebar | map.
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

/* CSS custom properties: palette, editor theme, radius, shadows, motion, layout, typography */
const tokensCSS = `
:root {
  /* ── Light theme ─────────────────────────────────────────────────── */
  --bg:            #ffffff;
  --surface:       #fafafa;
  --border:        #e4e4e7;
  --text:          #09090b;
  --muted:         #71717a;
  --muted-bg:      #f4f4f5;
  --primary:       #18181b;
  --primary-fg:    #fafafa;
  --primary-hover: #27272a;
  --overlay:       rgba(0,0,0,.8);

  /* ── Editor theme (Catppuccin Mocha) ────────────────────────────── */
  --ed-bg:          #1e1e2e;
  --ed-text:        #cdd6f4;
  --ed-muted:       #6c7086;
  --ed-placeholder: #45475a;
  --ed-caret:       #89b4fa;
  --ed-border:      rgba(255,255,255,.06);
  --ed-error-bg:    #3b0f0f;
  --ed-error-bd:    #6b2020;
  --ed-error-text:  #f38ba8;

  /* ── Radius scale ────────────────────────────────────────────────── */
  --radius-xs:   4px;      /* menu items, micro badges, tags */
  --radius-sm:   6px;      /* buttons, inputs, dropdowns */
  --radius-md:   8px;      /* modals */
  --radius-lg:   16px;     /* transport cards, map popups */
  --radius-full: 9999px;   /* pill */

  /* ── Shadows ─────────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 4px rgba(0,0,0,.08);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06);
  --shadow-lg: 0 25px 50px -12px rgba(0,0,0,.25);

  /* ── Motion ──────────────────────────────────────────────────────── */
  --duration: 150ms;

  /* ── Layout ──────────────────────────────────────────────────────── */
  --sidebar-w: 360px;

  /* ── Typography ──────────────────────────────────────────────────── */
  --font: "Geist", system-ui, -apple-system, sans-serif;
  --mono: "Geist Mono", "JetBrains Mono", Menlo, Consolas, monospace;

  /* ── Type scale ──────────────────────────────────────────────────── */
  --text-xl:   30px;   /* trip title */
  --text-lg:   15px;   /* place name headings */
  --text-base: 14px;   /* primary content */
  --text-sm:   13px;   /* supporting info: dates, times, notes */
  --text-xs:   12px;   /* labels, tags, badges */

  /* ── Activity palette ────────────────────────────────────────────── */
  --activity:    #f97316;   /* orange-500 */
  --activity-fg: #ffffff;
  --activity-bg: #fff7ed;   /* orange-50 */
  --activity-bd: #fed7aa;   /* orange-200 */

  /* ── Content ─────────────────────────────────────────────────────── */
  --note-text: #52525b;     /* zinc-700 — slightly darker than --muted for prose readability */
}

body { font-family: var(--font); font-size: var(--text-base); color: var(--text); background: var(--bg); }
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
.geo-no-loc { display: inline-flex; align-items: center; margin-left: 5px; color: var(--text); vertical-align: middle; opacity: 0.4; }
.geo-no-loc .crumb-icon { width: 12px; height: 12px; }
`

/* #main split layout: editor-panel | map (sidebar floats inside map) */
const layoutCSS = `
/* ── Layout ─────────────────────────────────────────────────────────── */
#main { display: flex; height: 100vh; overflow: hidden; }

#editor-panel {
  width: var(--sidebar-w);
  flex-shrink: 0;
  border-right: 1px solid var(--ed-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--ed-bg);
}

#map { flex: 1; min-width: 0; position: relative; }

/* ── Floating sidebar panel ──────────────────────────────────────────── */
#sidebar {
  position: absolute;
  top: 12px; left: 12px; bottom: 12px;
  width: 320px;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;
}
`

/* .pill-wrap, .dropdown-menu, .menu-item, .menu-sub — header pill and its dropdown menus */
const menuCSS = `
/* ── Crumb pill: top-right ───────────────────────────────────────────── */
.sidebar-header {
  position: fixed;
  top: 12px; right: 12px;
  z-index: 150;
}

.pill-wrap { position: relative; display: inline-block; }

.pill-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px 5px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  cursor: pointer;
  font-family: var(--font);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.02em;
  appearance: none;
  box-shadow: var(--shadow-sm);
  transition: background var(--duration);
}
.pill-trigger:hover, .pill-trigger.open { background: var(--surface); }

.pill-brand { font-family: var(--mono); font-size: 15px; }

.pill-chevron {
  width: 13px; height: 13px;
  stroke: currentColor; stroke-width: 2;
  fill: none; stroke-linecap: round; stroke-linejoin: round;
  transition: transform 200ms;
}
.pill-trigger.open .pill-chevron { transform: rotate(180deg); }

/* ── Dropdown menu ───────────────────────────────────────────────────── */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px); right: 0;
  z-index: 500;
  min-width: 200px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  padding: 4px;
  display: none;
}
.dropdown-menu.open { display: block; animation: menu-in 120ms ease; }
@keyframes menu-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--text-sm);
  color: var(--text);
  cursor: pointer;
  user-select: none;
}
.menu-item:hover { background: var(--muted-bg); }

.menu-separator { height: 1px; background: var(--border); margin: 4px 0; }

.menu-chevron-r {
  width: 13px; height: 13px;
  stroke: var(--muted); stroke-width: 2;
  fill: none; stroke-linecap: round; stroke-linejoin: round;
  flex-shrink: 0;
  transition: transform 200ms;
}
.menu-item.open .menu-chevron-r { transform: rotate(90deg); }

.menu-sub { display: none; }
.menu-sub.open { display: block; }

.menu-sub-item {
  display: flex;
  align-items: center;
  padding: 5px 8px 5px 20px;
  border-radius: var(--radius-xs);
  font-size: var(--text-sm);
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.menu-sub-item:hover { background: var(--muted-bg); color: var(--text); }
`

/* #editor-panel, .editor-textarea, .editor-error-bar — dark Catppuccin Mocha editor panel */
const editorCSS = `
/* ── Editor panel ────────────────────────────────────────────────────── */
.editor-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ed-border);
  background: var(--ed-bg);
}

.editor-close-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  color: var(--ed-muted);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  transition: background var(--duration), color var(--duration);
}
.editor-close-btn:hover { background: var(--ed-border); color: var(--ed-text); }

.editor-close-icon {
  width: 14px; height: 14px;
  stroke: currentColor; stroke-width: 2;
  fill: none; stroke-linecap: round; stroke-linejoin: round;
}

.editor-error-bar {
  flex-shrink: 0;
  padding: 5px 14px;
  background: var(--ed-error-bg);
  border-bottom: 1px solid var(--ed-error-bd);
  color: var(--ed-error-text);
  font-size: 11px;
  font-family: var(--mono);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: var(--ed-bg);
  color: var(--ed-text);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.7;
  padding: 14px 16px;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  caret-color: var(--ed-caret);
  min-height: 0;
}
.editor-textarea::placeholder { color: var(--ed-placeholder); }
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
#panel-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ── Sticky title bar (appears when trip title scrolls out of view) ──── */
.panel-sticky-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg);
  padding: 0 16px;
  max-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-bottom: 1px solid transparent;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration), max-height 200ms ease, padding 200ms ease, border-color var(--duration);
}
.panel-sticky-bar.--visible {
  max-height: 56px;
  padding: 10px 16px;
  opacity: 1;
  border-bottom-color: var(--border);
  pointer-events: auto;
}
.sticky-bar-name {
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.sticky-bar-badge { flex-shrink: 0; }
.panel-sticky-bar:has(.sticky-bar-badge) {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.sticky-bar-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  min-width: 0;
}
.sticky-bar-close {
  margin-top: 0;
  width: 26px; height: 26px;
  font-size: 17px;
}
.sticky-bar-meta {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted);
}

.place, .activity-item, .stay { scroll-margin-top: 64px; }
`

/* .modal-overlay, .modal-box — shared overlay and container for New/Generate/About modals */
const modalCSS = `
/* ── Modals ──────────────────────────────────────────────────────────── */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 3000;
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
  font-size: 18px; line-height: 1;
  transition: background var(--duration), color var(--duration);
}
.modal-x:hover { background: var(--muted-bg); color: var(--text); }

.modal-header { display: flex; flex-direction: column; gap: 4px; }
.modal-title { font-size: 18px; font-weight: 600; line-height: 1.3; padding-right: 24px; }
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
.action-btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.action-btn.primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }

.ref-intro { font-size: var(--text-sm); color: var(--text); line-height: 1.6; margin-bottom: 14px; }
.ref-prompt-block { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; }
.ref-prompt-label { font-size: 10px; font-weight: 600; color: var(--muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 6px; }
.ref-prompt-text { font-size: var(--text-xs); color: var(--muted); line-height: 1.6; font-style: italic; }

.new-textarea {
  width: 100%;
  min-height: 180px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.7;
  padding: 10px 12px;
  outline: none;
  tab-size: 2;
  transition: border-color var(--duration);
}
.new-textarea:focus { border-color: var(--muted); }
.new-textarea::placeholder { color: var(--muted); opacity: 0.6; }
`

/* MapLibre markers: .place-marker, .detail-marker, .place-popup, .detail-popup, route line, .map-status-chip */
const mapCSS = `
/* ── Geocoding status chip ───────────────────────────────────────────── */
.map-status-chip {
  position: fixed;
  bottom: 16px; right: 16px;
  z-index: 1000;
  background: rgba(0,0,0,.6);
  color: #fff;
  font-size: var(--text-xs); font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  pointer-events: none;
  transition: opacity .3s;
}
.map-status-chip:empty { opacity: 0; }

/* ── MapLibre popup overrides ────────────────────────────────────────── */
.place-popup .maplibregl-popup-content,
.detail-popup .maplibregl-popup-content {
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  font-family: var(--font);
  font-size: var(--text-sm);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: 0 2px 12px rgba(0,0,0,.1);
}
.place-popup .maplibregl-popup-tip  { border-top-color: var(--bg); }
.detail-popup .maplibregl-popup-tip { border-top-color: var(--bg); }
.popup-title { color: var(--text); font-weight: 500; }
.popup-sub { color: var(--muted); font-size: var(--text-xs); }

/* ── Place markers ───────────────────────────────────────────────────── */
.place-marker {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #18181b;
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  z-index: 2;
  transition: background var(--duration), box-shadow var(--duration);
}
.place-marker:hover { background: #3f3f46; }
.place-marker.--focused {
  box-shadow: 0 4px 16px rgba(0,0,0,.5);
}
.place-marker-num {
  color: #fff; font-size: 11px; font-weight: 600;
  font-family: var(--font); line-height: 1; user-select: none;
}
body.map-zoom-close .place-marker { display: none; }

/* ── Detail markers (activities, stays, hubs) ────────────────────────── */
.detail-marker {
  border-radius: 50%;
  border: 1.5px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
  cursor: pointer;
  display: none;
  align-items: center; justify-content: center;
}
.detail-marker--must     { background: var(--activity); border-radius: var(--radius-md); }
.detail-marker--activity { background: var(--activity); border-radius: var(--radius-md); }
.detail-marker--maybe    { background: var(--activity); border-radius: var(--radius-md); opacity: 0.5; }
.detail-marker--stay     { background: #18181b; }
.detail-marker--hub      { background: #18181b; }

/* zoom medium (8–11): activity dots only, small */
body.map-zoom-medium .detail-marker--must,
body.map-zoom-medium .detail-marker--activity,
body.map-zoom-medium .detail-marker--maybe { display: flex; width: 12px; height: 12px; }

/* zoom close (12+): all markers, full size */
body.map-zoom-close .detail-marker { display: flex; width: 28px; height: 28px; border-width: 3px; }

/* Labels (activities) */
.detail-marker-label {
  display: none; color: #fff; font-size: 9px; font-weight: 600;
  font-family: var(--font); line-height: 1; user-select: none;
}
body.map-zoom-close .detail-marker-label { display: block; }

/* Icons (stays + hubs) */
.detail-marker .crumb-icon {
  display: none;
  width: 13px; height: 13px;
  stroke: #fff; fill: none;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
body.map-zoom-close .detail-marker--stay .crumb-icon,
body.map-zoom-close .detail-marker--hub  .crumb-icon { display: block; }

/* ── Map click targets ───────────────────────────────────────────────── */
[data-map-link]       { cursor: pointer; }
[data-map-link]:hover { text-decoration: underline; text-decoration-color: var(--border); }

/* ── Focus states (list ↔ map sync) ─────────────────────────────────── */
.detail-marker.--focused {
  box-shadow: 0 4px 14px rgba(0,0,0,.45);
  z-index: 5;
}

/* ── Geocoding spinner ───────────────────────────────────────────────── */
@keyframes geo-spin { to { transform: rotate(360deg); } }

.place-num.--loading { color: transparent; }
.place-num.--loading::after {
  content: ""; position: absolute; inset: 4px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.25); border-top-color: #fff;
  animation: geo-spin 700ms linear infinite;
}
.act-badge.--loading { color: transparent; }
.act-badge.--loading::after {
  content: ""; position: absolute; inset: 3px; border-radius: 50%;
  border: 1.5px solid rgba(249,115,22,.15); border-top-color: var(--activity);
  animation: geo-spin 700ms linear infinite;
}
`

/* .trip-header, .place, .transport, .stay, .activity-*, .group-* — itinerary content rendering */
const itineraryCSS = `
/* ─────────────────────────────────────────────────────────────────────
   Itinerary content
   ───────────────────────────────────────────────────────────────────── */

.itinerary { display: flex; flex-direction: column; }

/* ── Trip header ─────────────────────────────────────────────────────── */
.trip-header { padding: 16px 0 14px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.trip-header h1 { font-size: var(--text-xl); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 3px; }
.trip-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0; font-size: var(--text-xs); color: var(--muted); margin-bottom: 16px; }
.trip-sep { opacity: 0.5; margin: 0 6px; }

/* ── Place ───────────────────────────────────────────────────────────── */
.place { padding: 14px 0 12px; }
.itinerary > .place + .place { border-top: 1px solid var(--border); }

.place-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.place-header:has(.place-meta) {
  align-items: flex-start;
}

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

.place-heading { flex: 1; }
.place-name-text { display: block; font-size: var(--text-lg); font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
.place-meta { display: flex; flex-wrap: wrap; align-items: baseline; margin-top: 3px; }
.place-meta-sep { opacity: 0.5; margin: 0 3px; font-size: var(--text-xs); }
.place-duration, .place-dates { font-size: var(--text-sm); color: var(--muted); }.date-inferred { font-style: italic; opacity: 0.75; }
.value-unknown { text-decoration: line-through; opacity: 0.5; }

.place-body { padding-left: 38px; }

/* ── Transport ───────────────────────────────────────────────────────── */
.transport {
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  background: var(--surface);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 4px 0;
}
.transport-simple { align-items: center; }
.transport-simple .transport-icon { padding-top: 0; }
.transport-mode { font-size: var(--text-sm); font-weight: 500; color: var(--text); line-height: 1.3; }

.transport-icon {
  display: inline-flex;
  align-items: flex-start;
  flex-shrink: 0;
  color: var(--text);
  padding-top: 3px;
}
.transport-icon .crumb-icon { width: 16px; height: 16px; }

.transport-body { flex: 1; min-width: 0; }
.transport-route-block { display: flex; flex-direction: column; }
.transport-simple { font-size: var(--text-sm); color: var(--muted); }

.tl-row { display: flex; gap: 10px; align-items: center; }
.tl-marker { width: 8px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
.tl-marker-line { align-self: stretch; }
.tl-dot { width: 7px; height: 7px; border-radius: 50%; background: #fff; border: 1.5px solid var(--text); flex-shrink: 0; }
.tl-line {
  flex: 1; width: 1.5px; min-height: 8px;
  background: repeating-linear-gradient(to bottom, var(--text) 0px, var(--text) 2px, transparent 2px, transparent 4px);
}

.waypoint-name { font-size: var(--text-sm); font-weight: 500; color: var(--text); line-height: 1.3; }
.tl-meta { display: flex; flex-direction: column; gap: 2px; padding: 3px 0; }
.tl-meta .waypoint-time { margin-bottom: 6px; }
.tl-indent { padding-left: 18px; }
.waypoint-time { font-size: var(--text-xs); color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
.waypoint-time .crumb-icon { width: 11px; height: 11px; }
.segment-duration { font-size: var(--text-xs); color: var(--text); opacity: 0.7; }
.transport-note { margin-top: 5px; margin-bottom: 8px; }
.transport-info { margin-top: 6px; }
.panel-transport-body .transport-info,
.panel-activity-body .act-info,
.panel-stay-body .stay-info {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  gap: 4px;
}
.panel-note {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  margin-top: 8px;
}

/* ── Stays ───────────────────────────────────────────────────────────── */
.stays { display: flex; flex-direction: column; margin-bottom: 8px; }
.stay {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--text-sm);
  color: var(--muted);
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.stays > .stay:first-child { border-top: none; padding-top: 4px; }
.stay-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  color: var(--text);
  flex-shrink: 0;
  position: relative;
}
.stay-icon-wrap.--loading svg { visibility: hidden; }
.stay-icon-wrap.--loading::after {
  content: ""; position: absolute; inset: 2px; border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,.1); border-top-color: var(--muted);
  animation: geo-spin 700ms linear infinite;
}
.stay-content { display: flex; flex-direction: column; gap: 2px; }
.stay-name { font-weight: 500; color: var(--text); font-size: var(--text-base); }
.stay-date { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--muted); }
.stay-date .crumb-icon { width: 12px; height: 12px; flex-shrink: 0; }
.stay-note { margin-top: 3px; }
.stay-info { margin-top: 3px; }

/* ── Activities ──────────────────────────────────────────────────────── */
.activity-list { list-style: none; }

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 0;
  font-size: var(--text-base);
}

.act-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--activity-bg);
  color: var(--activity);
  border: 1px solid var(--activity-bd);
  font-size: 10px; font-weight: 700;
  flex-shrink: 0;
  line-height: 1;
  margin-top: -1px;
  position: relative;
}


.act-content { flex: 1; min-width: 0; }
.act-title-row { display: flex; flex-wrap: wrap; align-items: baseline; }
.act-priority { display: inline-flex; align-items: center; margin-left: 5px; vertical-align: middle; }
.act-priority .crumb-icon { width: 11px; height: 11px; vertical-align: middle; }
.act-priority-must  { color: var(--text); }
.act-priority-maybe { color: #a1a1aa; }
.act-meta { display: flex; flex-wrap: wrap; align-items: baseline; margin-top: 2px; }
.act-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.act-time { font-size: var(--text-xs); color: var(--muted); }
.act-meta-sep { opacity: 0.5; margin: 0 6px; }
.act-duration { font-size: var(--text-xs); color: var(--muted); }
.act-note { margin-top: 5px; margin-bottom: 8px; }
.act-info { margin-top: 5px; }

.activity-group { margin: 0; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 6px; }
.activity-group .activity-list { padding: 0; }
.ungrouped .activity-item:first-child { border-top: none; }

.group-header {
  font-size: var(--text-xs); font-weight: 700; color: var(--text);
  padding: 4px 0 6px;
}
.group-date { display: block; font-weight: 400; color: var(--muted); margin-top: 2px; }

.plan-group { padding-left: 10px; }

/* ── Tags ────────────────────────────────────────────────────────────── */
.tags { margin: 4px 0 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  display: inline-block;
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0px 6px;
  font-size: var(--text-xs);
}
.tag--icon {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
}
.tag--icon .crumb-icon { width: 11px; height: 11px; }

/* ── Notes ───────────────────────────────────────────────────────────── */
.note {
  font-size: var(--text-sm); font-weight: 400; color: var(--note-text);
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
.info-list { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 8px; }
.act-info, .stay-info, .transport-info { display: flex; flex-direction: column; gap: 2px; }
.info-item { display: flex; gap: 8px; font-size: var(--text-sm); }
.info-item .info-key { color: var(--muted); min-width: 64px; flex-shrink: 0; }
.info-item .info-val { color: var(--muted); }

/* ── Empty state ─────────────────────────────────────────────────────── */
.list-empty { padding: 40px 0; text-align: center; color: var(--muted); font-size: var(--text-sm); }

/* ── Panel back link ─────────────────────────────────────────────────── */
.panel-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0 6px;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: var(--text-xs);
  color: var(--muted);
  cursor: pointer;
  transition: color var(--duration);
}
.panel-back:hover { color: var(--text); }

/* ── Trip panel header ───────────────────────────────────────────────── */
.panel-trip-header {
  padding: 16px 16px 14px;
}
.trip-duration {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--muted);
  margin-top: 3px;
}
/* indent meta lines to align with the title text past its badge */
.panel-meta-inset    { padding-left: 32px; } /* 24px badge + 8px gap */
.panel-meta-inset--lg { padding-left: 40px; } /* 32px badge + 8px gap */
.panel-meta-inset--xl { padding-left: 48px; } /* 40px badge + 8px gap */
.panel-subtitle {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 4px;
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
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.panel-trip-name {
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 6px;
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
  padding: 16px 16px 14px;
}
.panel-header-body { flex: 1; min-width: 0; }
.panel-close {
  flex-shrink: 0;
  width: 40px; height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--muted-bg);
  cursor: pointer;
  color: var(--text);
  display: flex; align-items: center; justify-content: center;
  transition: background var(--duration), color var(--duration);
}
.panel-close:hover { background: var(--border); }

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
  border-radius: var(--radius-sm);
  background: var(--muted-bg);
  cursor: pointer;
  color: var(--text);
  transition: background var(--duration);
}
.panel-nav-btn:hover:not(:disabled) { background: var(--border); }
.panel-nav-btn:disabled { opacity: 0.35; cursor: default; }
.panel-nav-counter {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--muted);
}

/* ── Item panels (shared) ────────────────────────────────────────────── */
.panel-transport-body,
.panel-activity-body,
.panel-stay-body { padding: 0 16px 16px; }

/* ── Transport panel ─────────────────────────────────────────────────── */
.panel-transport-name {
  font-size: 22px;
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
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.panel-act-badge {
  width: 40px;
  height: 40px;
  font-size: 14px;
  flex-shrink: 0;
}
.panel-activity-body .act-info { margin-top: 8px; }

/* ── Stay panel ──────────────────────────────────────────────────────── */
.panel-stay-name {
  font-size: 18px;
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
.panel-stay-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.panel-stay-body .stay-info { margin-top: 4px; }

/* ── Panel ToC ───────────────────────────────────────────────────────── */
.panel-toc { list-style: none; padding: 6px 0; }
.panel-list-pad { padding: 6px 16px 0; }

.list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  transition: background var(--duration);
}
.list-item:hover { background: var(--muted-bg); }

.list-item--place {
  align-items: center;
  background: var(--surface);
  margin: 4px 8px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  width: calc(100% - 16px);
  min-height: 52px;
}
.list-item--place:has(.list-item-meta) { align-items: flex-start; }
.list-item--place:hover { background: var(--muted-bg); }

.list-item--place .place-num--sm { margin-top: 0; }
.list-item--place:has(.list-item-meta) .place-num--sm { margin-top: 1px; }
.list-item--place .list-item-label { font-size: var(--text-base); font-weight: 500; }

.list-item-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  min-width: 0;
}

.list-item--transport {
  position: relative;
  align-items: center;
  background: var(--bg);
  margin: 4px 8px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  width: calc(100% - 16px);
  min-height: 52px;
  color: var(--muted);
  cursor: pointer;
}
.list-item--transport:has(.list-item-meta) { align-items: flex-start; }
.list-item--transport:hover { background: var(--muted-bg); }
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

.list-item--transport::before {
  content: '';
  position: absolute;
  left: calc(10px + 12px);
  top: 0; bottom: 0;
  border-left: 1.5px dashed var(--border);
  transform: translateX(-50%);
}
.transport-label { font-size: var(--text-base); font-weight: 500; color: var(--text); }

/* ── Stay cards ──────────────────────────────────────────────────────── */
.list-item--stay {
  align-items: center;
  background: var(--surface);
  margin: 4px 8px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  width: calc(100% - 16px);
  min-height: 52px;
  cursor: pointer;
}
.list-item--stay:has(.list-item-meta) { align-items: flex-start; }
.list-item--stay:hover { background: var(--muted-bg); }
.list-item--stay:hover .stay-icon-wrap { background: var(--muted-bg); }

.stay-icon-wrap {
  width: 24px; height: 24px;
  flex-shrink: 0;
  margin-top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border-radius: 50%;
  position: relative;
}
.list-item--stay:has(.list-item-meta) .stay-icon-wrap { margin-top: 1px; }

/* ── Activity cards ──────────────────────────────────────────────────── */
.list-item--activity {
  align-items: center;
  background: var(--surface);
  margin: 4px 8px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  width: calc(100% - 16px);
  min-height: 52px;
  cursor: pointer;
}
.list-item--activity:has(.list-item-meta) { align-items: flex-start; }
.list-item--activity:has(.list-item-meta) .act-badge { margin-top: 1px; }
.list-item--activity:hover { background: var(--muted-bg); }
.list-item--activity:hover .act-badge { background: var(--activity-bg); }
.list-item--stay     .list-item-label { font-size: var(--text-base); font-weight: 500; }
.list-item--activity .list-item-label { font-size: var(--text-base); font-weight: 500; }

.act-badge {
  width: 26px; height: 26px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--activity-bg);
  color: var(--activity);
  font-size: 10px;
  font-weight: 700;
  border: 1px solid var(--activity-bd);
  position: relative;
}

.list-item-label { flex: 1; }
.list-item-meta { color: var(--muted); font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.transport-detail { color: var(--muted); font-size: var(--text-xs); }
.act-label { font-size: 10px; font-weight: 700; color: var(--activity); flex-shrink: 0; min-width: 14px; }

.list-divider {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 3px;
  pointer-events: none;
}
.list-divider--day .list-item-label,
.list-divider--plan .list-item-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--muted);
}

/* Small place-num variant used in ToC list items */
.place-num--sm { width: 24px; height: 24px; font-size: 11px; flex-shrink: 0; }


/* ── Inline note truncation ──────────────────────────────────────────── */
.note-trunc { display: block; overflow: hidden; max-height: 4.5em; }
.note-trunc.--expanded { max-height: none; }
.note-more {
  cursor: pointer;
  color: var(--muted);
  font-size: var(--text-xs);
  font-style: normal;
}
.note-more:hover { text-decoration: underline; }

/* ── Menu section label ──────────────────────────────────────────────── */
.menu-section-label {
  padding: 4px 8px 2px;
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
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

  /* Editor: full-screen overlay */
  #editor-panel { position: fixed; inset: 0; width: 100%; z-index: 400; }

  /* Sidebar becomes a bottom sheet; JS controls height (72px–90vh) */
  #sidebar {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    top: auto;
    width: 100%;
    height: 50vh;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px rgba(0,0,0,.12), 0 -1px 4px rgba(0,0,0,.08);
    overflow: hidden;
    z-index: 200;
  }

  /* Sheet handle */
  #sheet-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0 4px;
    flex-shrink: 0;
    cursor: grab;
    touch-action: none;
  }
  .sheet-handle-bar {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
  }

  /* MapLibre controls + status chip: track the live sheet height via --sheet-h.
     --sheet-anim is 0ms during drag (instant) and the spring curve on snap. */
  .maplibregl-ctrl-bottom-right,
  .maplibregl-ctrl-bottom-left,
  .map-status-chip {
    bottom: calc(var(--sheet-h, 50vh) + 8px);
    transition: bottom var(--sheet-anim, 0ms);
  }
  .map-status-chip { right: 12px; }
}
`

export const CSS = [
  resetCSS,
  tokensCSS,
  iconsCSS,
  layoutCSS,
  menuCSS,
  editorCSS,
  listCSS,
  modalCSS,
  mapCSS,
  itineraryCSS,
  mobileCSS,
].join("\n")
