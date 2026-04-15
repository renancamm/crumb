/**
 * Crumb CSS
 *
 * Combined styles for the full app output:
 *   — App shell (map, floating app bar, transparent panel, modals, editor)
 *   — Itinerary content (scoped to .preview-body)
 *
 * Design token system: two color families.
 *   Blue  (--crumb-blue-*)    → structure: places, stays, transport
 *   Orange (--crumb-orange-*) → activities
 */

export const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }

:root {
  /* Surfaces */
  --crumb-bg:          #f8fafc;
  --crumb-surface:     #ffffff;
  --crumb-surface-2:   #f1f5f9;
  --crumb-surface-3:   #e8edf3;

  /* Borders */
  --crumb-border:      #e2e8f0;

  /* Text */
  --crumb-text:        #0f172a;
  --crumb-text-muted:  #64748b;
  --crumb-text-faint:  #94a3b8;

  /* Blue family — structure */
  --crumb-blue:        #2563eb;
  --crumb-blue-mid:    #93c5fd;
  --crumb-blue-faint:  #bfdbfe;

  /* Orange family — activities */
  --crumb-orange:       #ea580c;
  --crumb-orange-mid:   #fdba74;
  --crumb-orange-faint: #fed7aa;

  /* Shape */
  --crumb-radius-lg: 12px;
  --crumb-radius-md:  8px;
  --crumb-radius-sm:  5px;

  /* Typography */
  --crumb-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --crumb-mono: "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace;
}

body {
  font-family: var(--crumb-font);
  font-size: 14px;
  color: var(--crumb-text);
}

/* ── Lucide icons ──────────────────────────────────────────────────── */
.crumb-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

/* ── Fullscreen map ────────────────────────────────────────────────── */
#map {
  position: fixed;
  inset: 0;
  z-index: 0;
}

/* ── Panel — frosted glass container ───────────────────────────────── */
.panel {
  position: fixed;
  left: 16px;
  top: 16px;
  bottom: 16px;
  width: 340px;
  z-index: 1000;
  background: rgba(248, 250, 252, 0.82);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-radius: var(--crumb-radius-lg);
  box-shadow: 0 0 0 0.5px rgba(0,0,0,.06), 0 4px 24px rgba(0,0,0,.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── App bar ───────────────────────────────────────────────────────── */
.appbar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 44px;
  padding: 0 8px 0 14px;
  background: transparent;
  border-bottom: 1px solid rgba(0,0,0,.07);
  flex-shrink: 0;
  user-select: none;
}

.appbar-brand {
  font-size: 13px;
  font-weight: 700;
  color: var(--crumb-text);
  letter-spacing: .3px;
  margin-right: 6px;
}

.appbar-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--crumb-text-muted);
  font-family: var(--crumb-font);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: var(--crumb-radius-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s, color .15s;
}
.appbar-btn:hover { background: var(--crumb-surface-2); color: var(--crumb-text); }
.appbar-btn.active { background: #eff6ff; color: var(--crumb-blue); }

/* ── Panel body (preview + split + editor) ─────────────────────────── */
.panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.preview-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* Thin, unobtrusive scrollbar that works over the map */
.preview-scroll::-webkit-scrollbar { width: 4px; }
.preview-scroll::-webkit-scrollbar-track { background: transparent; }
.preview-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); border-radius: 2px; }

/* ── Split handle ──────────────────────────────────────────────────── */
.split-handle {
  flex-shrink: 0;
  height: 5px;
  background: #181825;
  cursor: ns-resize;
  position: relative;
  transition: background .15s;
}
.split-handle:hover,
.split-handle.dragging { background: var(--crumb-blue); }
.split-handle::after {
  content: "";
  display: block;
  width: 28px;
  height: 2px;
  background: rgba(255,255,255,.25);
  border-radius: 1px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ── Editor section ────────────────────────────────────────────────── */
.editor-section {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  background: #1e1e2e;
  border-radius: var(--crumb-radius-lg);
  box-shadow: 0 4px 24px rgba(0,0,0,.22);
}

.editor-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 14px;
  background: #181825;
  border-bottom: 1px solid rgba(255,255,255,.06);
  flex-shrink: 0;
}
.editor-section-label {
  font-size: 10px;
  font-weight: 600;
  color: #6c7086;
  letter-spacing: .5px;
  text-transform: uppercase;
}
.editor-close-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: #6c7086;
  font-size: 16px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 4px;
  cursor: pointer;
}
.editor-close-btn:hover { background: rgba(255,255,255,.08); color: #cdd6f4; }

/* ── Editor error bar ──────────────────────────────────────────────── */
.editor-error-bar {
  flex-shrink: 0;
  padding: 5px 14px;
  background: #3b0f0f;
  border-bottom: 1px solid #6b2020;
  color: #f38ba8;
  font-size: 11px;
  font-family: var(--crumb-mono);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Editor textarea ───────────────────────────────────────────────── */
.editor-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: #1e1e2e;
  color: #cdd6f4;
  font-family: var(--crumb-mono);
  font-size: 12px;
  line-height: 1.7;
  padding: 12px 16px 20px;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  caret-color: #89b4fa;
  min-height: 0;
}
.editor-textarea::placeholder { color: #45475a; }

/* ── Load modal textarea ───────────────────────────────────────────── */
.load-textarea {
  width: 100%;
  height: 280px;
  resize: none;
  border: 1px solid var(--crumb-border);
  border-radius: var(--crumb-radius-md);
  background: #1e1e2e;
  color: #cdd6f4;
  font-family: var(--crumb-mono);
  font-size: 12px;
  line-height: 1.7;
  padding: 12px 14px;
  tab-size: 2;
  outline: none;
  caret-color: #89b4fa;
}
.load-textarea::placeholder { color: #45475a; }
.load-textarea:focus { border-color: var(--crumb-blue); }

/* ── Preview body ──────────────────────────────────────────────────── */
.preview-body { padding: 0 0 40px; }
.preview-empty { margin-top: 48px; text-align: center; color: var(--crumb-text-faint); font-size: 13px; }
.preview-error {
  margin: 8px 0; padding: 10px 12px;
  background: #fff0f0; border: 1px solid #fcc;
  border-radius: var(--crumb-radius-md); color: #c00; font-size: 12px; line-height: 1.5;
}

/* ── Modals ────────────────────────────────────────────────────────── */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0,0,0,.3);
  align-items: center;
  justify-content: center;
}
.modal-overlay.open { display: flex; }

.modal-box {
  background: var(--crumb-surface);
  border-radius: var(--crumb-radius-lg);
  box-shadow: 0 8px 40px rgba(0,0,0,.18);
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--crumb-border);
  flex-shrink: 0;
}
.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--crumb-text);
}
.modal-close {
  appearance: none;
  border: none;
  background: transparent;
  font-size: 18px;
  color: var(--crumb-text-faint);
  cursor: pointer;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
}
.modal-close:hover { background: var(--crumb-surface-2); color: var(--crumb-text); }

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--crumb-border);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.source-pre {
  font-family: var(--crumb-mono);
  font-size: 11px;
  line-height: 1.6;
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: var(--crumb-radius-md);
  padding: 12px 14px;
  white-space: pre;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 320px;
  tab-size: 2;
}

.action-btn {
  appearance: none;
  border: 1px solid var(--crumb-border);
  background: var(--crumb-surface-2);
  font-family: var(--crumb-font);
  font-size: 12px;
  font-weight: 500;
  color: var(--crumb-text-muted);
  padding: 6px 14px;
  border-radius: var(--crumb-radius-sm);
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
.action-btn:hover { background: var(--crumb-surface-3); border-color: var(--crumb-surface-3); color: var(--crumb-text); }
.action-btn.primary {
  background: var(--crumb-blue);
  border-color: var(--crumb-blue);
  color: #fff;
}
.action-btn.primary:hover { background: #1d4ed8; border-color: #1d4ed8; }

/* Generate modal */
.ref-intro {
  font-size: 13px;
  color: var(--crumb-text);
  line-height: 1.6;
  margin-bottom: 14px;
}
.ref-prompt-block {
  background: var(--crumb-surface-2);
  border: 1px solid var(--crumb-border);
  border-radius: var(--crumb-radius-md);
  padding: 12px 14px;
}
.ref-prompt-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--crumb-text-faint);
  letter-spacing: .5px;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.ref-prompt-text {
  font-size: 12px;
  color: var(--crumb-text-muted);
  line-height: 1.6;
  font-style: italic;
}

/* ── Map geocoding status chip ─────────────────────────────────────── */
.map-status-chip {
  position: fixed;
  bottom: 28px;
  right: 16px;
  z-index: 1000;
  background: rgba(0,0,0,.5);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
  backdrop-filter: blur(4px);
  pointer-events: none;
  transition: opacity .3s;
}
.map-status-chip:empty { opacity: 0; }

/* ── MapLibre popup overrides ──────────────────────────────────────── */
.place-popup .maplibregl-popup-content,
.detail-popup .maplibregl-popup-content {
  padding: 8px 12px;
  border-radius: var(--crumb-radius-md);
  font-family: var(--crumb-font);
  font-size: 13px;
  background: var(--crumb-surface);
  border: 1px solid var(--crumb-border);
  box-shadow: 0 2px 12px rgba(0,0,0,.12);
}
.place-popup .maplibregl-popup-tip  { border-top-color: #fff; }
.detail-popup .maplibregl-popup-tip { border-top-color: #fff; }
.popup-title { color: var(--crumb-text); font-weight: 500; }
.popup-sub { color: var(--crumb-text-muted); font-size: 11px; }

/* ── Sidebar click targets ─────────────────────────────────────────── */
[data-place-index] { cursor: pointer; }
[data-act-name]    { cursor: pointer; }
[data-place-index]:hover .place-name { text-decoration: underline; text-decoration-color: var(--crumb-blue); }
[data-act-name]:hover .act-name      { text-decoration: underline; text-decoration-color: var(--crumb-orange); }

/* ────────────────────────────────────────────────────────────────────
   Itinerary (scoped to .preview-body)
   ──────────────────────────────────────────────────────────────────── */
.preview-body .itinerary { display: flex; flex-direction: column; gap: 8px; }

/* Trip header */
.preview-body .trip-header {
  background: var(--crumb-surface);
  border-radius: var(--crumb-radius-md);
  padding: 16px 16px 12px;
}
.preview-body .trip-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 5px; letter-spacing: -.3px; }
.preview-body .trip-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--crumb-text-muted); margin-bottom: 6px; }
.preview-body .author { color: var(--crumb-text-muted); }

/* ── Place card ────────────────────────────────────────────────────── */
.preview-body .place {
  background: var(--crumb-surface);
  border-radius: var(--crumb-radius-md);
  padding: 16px 16px 12px;
}
.preview-body .place-header { margin-bottom: 12px; }
.preview-body .place-name {
  display: flex; align-items: center; gap: 9px;
  font-size: 16px; font-weight: 700; margin-bottom: 4px; letter-spacing: -.2px;
}
.preview-body .place-num {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 22px; height: 22px;
  background: var(--crumb-blue); color: #fff;
  border-radius: 50%; font-size: 11px; font-weight: 700;
}
.preview-body .place-dates { font-size: 13px; color: var(--crumb-text-muted); }
.preview-body .place-tz { font-size: 11px; color: var(--crumb-text-faint); margin-top: 3px; }

/* ── Transport leg — visually distinct connector ───────────────────── */
.preview-body .transport {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: var(--crumb-surface-2);
  border-radius: var(--crumb-radius-lg);
  box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.preview-body .transport-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--crumb-blue);
}
.preview-body .transport-icon .crumb-icon {
  width: 20px;
  height: 20px;
  stroke-width: 1.5;
}
.preview-body .transport-main { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.preview-body .transport-mode { font-size: 13px; font-weight: 600; color: var(--crumb-text); }
.preview-body .transport-route { font-size: 13px; color: var(--crumb-text-muted); }
.preview-body .transport-times { font-size: 12px; color: var(--crumb-text-faint); }
.preview-body .transport-info,
.preview-body .transport-note { font-size: 12px; color: var(--crumb-text-faint); margin-top: 2px; }

/* ── Stays ─────────────────────────────────────────────────────────── */
.preview-body .stays { margin: 0 0 12px; display: flex; flex-direction: column; gap: 0; }
.preview-body .stay {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: var(--crumb-text-muted);
  padding: 10px 0;
  border-top: 1px solid var(--crumb-border);
}
.preview-body .stays > .stay:first-child { border-top: none; padding-top: 0; }
.preview-body .stay-icon { color: var(--crumb-blue-mid); margin-top: 1px; flex-shrink: 0; }
.preview-body .stay-content { display: flex; flex-direction: column; gap: 2px; }
.preview-body .stay-name { font-weight: 600; color: var(--crumb-text); font-size: 14px; }
.preview-body .stay-dates { color: var(--crumb-text-muted); }
.preview-body .stay-note { color: var(--crumb-text-faint); font-style: italic; }
.preview-body .stay-info { margin-top: 4px; }

/* ── Activities ────────────────────────────────────────────────────── */
.preview-body .activities { margin-top: 0; }
.preview-body .activity-list { list-style: none; }

.preview-body .activity-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  padding: 7px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--crumb-surface-3);
}
.preview-body .activity-item:last-child { border-bottom: none; }

.preview-body .dot { font-size: 8px; width: 10px; flex-shrink: 0; line-height: 2.2; }
.preview-body .dot.must  { color: var(--crumb-orange); }
.preview-body .dot.maybe { color: var(--crumb-orange-faint); }

.preview-body .act-name { flex: 1; min-width: 80px; font-size: 13px; }
.preview-body .act-time { font-size: 12px; color: var(--crumb-text-muted); }
.preview-body .act-duration { font-size: 12px; color: var(--crumb-text-faint); }
.preview-body .act-note {
  width: 100%; padding-left: 16px;
  font-size: 12px; color: var(--crumb-text-muted); font-style: italic;
  border-left: 2px solid var(--crumb-border); margin: 2px 0;
}
.preview-body .act-info { width: 100%; padding-left: 16px; margin-top: 2px; }

/* ── Activity groups — no card, section dividers only ──────────────── */
.preview-body .activity-group {
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  overflow: visible;
}

/* Horizontal divider between consecutive groups */
.preview-body .activity-group + .activity-group {
  border-top: 1px solid var(--crumb-border);
  padding-top: 6px;
  margin-top: 4px;
}

/* Group header — section title, no uppercase */
.preview-body .group-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--crumb-text);
  padding: 8px 0 4px;
  border-bottom: none;
  text-transform: none;
  letter-spacing: 0;
}
.preview-body .group-date { font-weight: 400; color: var(--crumb-text-muted); }

/* Plan groups — subtle left accent only */
.preview-body .plan-group {
  padding-left: 12px;
  border-left: 3px solid var(--crumb-blue-faint);
}
.preview-body .plan-group .group-header { color: var(--crumb-text-muted); }

.preview-body .activity-group .activity-list { padding: 0; }

.preview-body .ungrouped .activity-item:first-child { border-top: none; }

/* ── Tags ──────────────────────────────────────────────────────────── */
.preview-body .tags { margin: 6px 0 10px; display: flex; flex-wrap: wrap; gap: 4px; }
.preview-body .tag {
  display: inline-block;
  background: var(--crumb-surface-2);
  color: var(--crumb-text-faint);
  border: 1px solid var(--crumb-border);
  border-radius: 4px; padding: 2px 7px; font-size: 11px;
}

/* ── Notes ─────────────────────────────────────────────────────────── */
.preview-body .note {
  font-size: 13px; color: var(--crumb-text-muted); font-style: italic;
  border-left: 3px solid var(--crumb-border); padding-left: 10px; margin: 6px 0 10px;
}

/* ── Info lists ────────────────────────────────────────────────────── */
.preview-body .info-list { margin: 6px 0; }
.preview-body .info-row { display: flex; gap: 8px; padding: 2px 0; font-size: 12px; }
.preview-body .info-key { font-weight: 500; color: var(--crumb-text-muted); min-width: 64px; }
.preview-body .info-val { color: var(--crumb-text-muted); }

/* Inline info items (inside activities / stays / transport) */
.preview-body .act-info,
.preview-body .stay-info,
.preview-body .transport-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.preview-body .info-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  margin-right: 0;
}
.preview-body .info-item .info-key {
  font-weight: 500;
  color: var(--crumb-text-muted);
  min-width: 64px;
  flex-shrink: 0;
}
.preview-body .info-item .info-val,
.preview-body .info-item > :last-child { color: var(--crumb-text-muted); }
`
