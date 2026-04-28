/**
 * Crumb CSS
 *
 * Layout: editor-panel (left split) | sidebar | map.
 * Design system: shadcn/ui Zinc palette — clean, minimal.
 *
 * Tune the :root tokens to restyle the whole UI:
 *   colors, editor theme, radius scale, shadows, motion, layout, type.
 */

export const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }

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
}

body { font-family: var(--font); font-size: var(--text-base); color: var(--text); background: var(--bg); }

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

#sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  position: relative;
}

#map { flex: 1; min-width: 0; }

/* ── Sidebar pill ────────────────────────────────────────────────────── */
.sidebar-header {
  position: absolute;
  top: 10px; left: 12px;
  z-index: 20;
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
  top: calc(100% + 6px); left: 0;
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

/* ── List view ───────────────────────────────────────────────────────── */
#list-view {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}
#list-view::-webkit-scrollbar { width: 4px; }
#list-view::-webkit-scrollbar-track { background: transparent; }
#list-view::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

#list {
  padding: 12px;
  padding-top: 48px;
  background: var(--bg);
}

.place, .activity-item, .stay { scroll-margin-top: 64px; }

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
.detail-marker--must     { background: var(--activity); }
.detail-marker--activity { background: var(--activity); }
.detail-marker--maybe    { background: var(--activity); opacity: 0.5; }
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
.act-label.--loading { color: transparent; }
.act-label.--loading::after {
  content: ""; position: absolute; inset: 3px; border-radius: 50%;
  border: 1.5px solid rgba(249,115,22,.15); border-top-color: var(--activity);
  animation: geo-spin 700ms linear infinite;
}

/* ─────────────────────────────────────────────────────────────────────
   Itinerary content
   ───────────────────────────────────────────────────────────────────── */

.itinerary { display: flex; flex-direction: column; }

/* ── Trip header ─────────────────────────────────────────────────────── */
.trip-header { padding: 16px 0 14px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.trip-header h1 { font-size: var(--text-xl); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 3px; }
.trip-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: var(--text-xs); color: var(--muted); margin-bottom: 16px; }
.author { color: var(--muted); }

/* ── Place ───────────────────────────────────────────────────────────── */
.place { padding: 14px 0 12px; }
.itinerary > .place + .place { border-top: 1px solid var(--border); }

.place-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.place-header:has(.place-dates, .place-tz) {
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
.place-dates { display: block; font-size: var(--text-sm); color: var(--muted); margin-top: 2px; }
.place-tz { display: block; font-size: var(--text-xs); color: var(--muted); opacity: 0.6; margin-top: 1px; }
.date-inferred { font-style: italic; opacity: 0.75; }
.date-inferred::before { content: "~"; }

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
.waypoint-time { font-size: var(--text-xs); color: var(--muted); }
.segment-duration { font-size: var(--text-xs); color: var(--muted); }
.transport-note { font-size: var(--text-sm); color: var(--muted); font-style: italic; margin-top: 6px; }
.transport-info { margin-top: 6px; }

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
.stay-icon.--loading svg { visibility: hidden; }
.stay-icon.--loading::after {
  content: ""; position: absolute; inset: 2px; border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,.1); border-top-color: var(--muted);
  animation: geo-spin 700ms linear infinite;
}
.stay-content { display: flex; flex-direction: column; gap: 2px; }
.stay-name { font-weight: 500; color: var(--text); font-size: var(--text-base); }
.stay-note { font-style: italic; }
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
.act-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; }
.act-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.act-time { font-size: var(--text-sm); color: var(--muted); }
.act-duration { font-size: var(--text-sm); color: var(--muted); opacity: 0.7; }
.act-note { font-size: var(--text-sm); color: var(--muted); font-style: italic; margin-top: 5px; margin-bottom: 8px; }
.act-info { margin-top: 5px; }

.activity-group { margin: 0; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 6px; }
.activity-group .activity-list { padding: 0; }
.ungrouped .activity-item:first-child { border-top: none; }

.group-header {
  font-size: var(--text-xs); font-weight: 700; color: var(--muted);
  padding: 4px 0 3px;
}
.group-date { font-weight: 400; opacity: 0.8; }

.plan-group { padding-left: 10px; }

/* ── Tags ────────────────────────────────────────────────────────────── */
.tags { margin: 4px 0 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  display: inline-block;
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 2px 7px;
  font-size: var(--text-xs);
}
.priority-must,
.priority-maybe { background: var(--surface); border-color: var(--border); color: var(--muted); }

/* ── Notes ───────────────────────────────────────────────────────────── */
.note, .place-note {
  font-size: var(--text-sm); color: var(--muted); font-style: italic;
  margin: 4px 0 8px;
}

/* ── Info lists ──────────────────────────────────────────────────────── */
.info-list { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 8px; }
.act-info, .stay-info, .transport-info { display: flex; flex-direction: column; gap: 2px; }
.info-item { display: flex; gap: 8px; font-size: var(--text-sm); }
.info-item .info-key { color: var(--muted); min-width: 64px; flex-shrink: 0; }
.info-item .info-val { color: var(--muted); }

/* ── Empty state ─────────────────────────────────────────────────────── */
.list-empty { padding: 40px 0; text-align: center; color: var(--muted); font-size: var(--text-sm); }
`
