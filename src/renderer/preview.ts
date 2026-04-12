/**
 * Preview Renderer
 *
 * Wraps the HTML renderer output in a split-view layout:
 *   Left  — raw .crumb source with YAML syntax highlighting
 *   Right — rendered itinerary
 */

import { CrumbDocument } from "../types"
import { renderItineraryBody } from "./html"

export function renderPreview(source: string, doc: CrumbDocument): string {
  const title    = doc.trip?.name ?? "Itinerary"
  const fileName = title

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Crumb Preview</title>
  <style>${PREVIEW_CSS}</style>
</head>
<body>
  <div class="shell">
    <header class="toolbar">
      <span class="toolbar-brand">crumb</span>
      <span class="toolbar-file">${escapeHtml(fileName)}</span>
    </header>
    <div class="split">
      <div class="pane pane-source">
        <div class="pane-label">Source</div>
        <pre class="source-code">${highlightYaml(source)}</pre>
      </div>
      <div class="divider"></div>
      <div class="pane pane-render">
        <div class="pane-label">Preview</div>
        <div class="render-scroll">
          <div class="render-body">
            ${renderItineraryBody(doc)}
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

// ─── YAML syntax highlighter ─────────────────────────────────────────────────
//
// Simple line-by-line regex pass. Covers the patterns in .crumb files.

function highlightYaml(source: string): string {
  return source
    .split("\n")
    .map(highlightLine)
    .join("\n")
}

function highlightLine(line: string): string {
  // Comment
  if (/^\s*#/.test(line)) {
    return `<span class="y-comment">${escapeHtml(line)}</span>`
  }

  // Blank line
  if (/^\s*$/.test(line)) return line

  // List item with a key: value  (- key: value  or  - key:)
  // e.g.  - Tokyo:  /  - website: https://...
  const listKeyVal = line.match(/^(\s*-\s+)([^:[\]{},#"'\s][^:]*?)(:)(\s+.+)?$/)
  if (listKeyVal) {
    const [, indent, key, colon, rest] = listKeyVal
    return (
      `<span class="y-dash">${escapeHtml(indent)}</span>` +
      `<span class="y-key">${escapeHtml(key)}${colon}</span>` +
      (rest != null ? highlightValue(rest) : "")
    )
  }

  // List item — bare value (- Tokyo  /  - train)
  const listBare = line.match(/^(\s*-\s+)(.+)$/)
  if (listBare) {
    const [, indent, val] = listBare
    return (
      `<span class="y-dash">${escapeHtml(indent)}</span>` +
      highlightBareValue(val.trim(), escapeHtml(val))
    )
  }

  // List marker alone (- )
  if (/^\s*-\s*$/.test(line)) {
    return `<span class="y-dash">${escapeHtml(line)}</span>`
  }

  // key: value  (no leading dash)
  const keyVal = line.match(/^(\s*)([^:[\]{},#"'\s][^:]*?)(:)(\s+.+)?$/)
  if (keyVal) {
    const [, indent, key, colon, rest] = keyVal
    return (
      escapeHtml(indent) +
      `<span class="y-key">${escapeHtml(key)}${colon}</span>` +
      (rest != null ? highlightValue(rest) : "")
    )
  }

  return escapeHtml(line)
}

function highlightValue(rest: string): string {
  const trimmed = rest.trimStart()
  const leading = rest.slice(0, rest.length - trimmed.length)

  // Inline array: [asia, food, temples]
  if (trimmed.startsWith("[")) {
    return (
      escapeHtml(leading) +
      `<span class="y-bracket">[</span>` +
      trimmed
        .slice(1, trimmed.lastIndexOf("]"))
        .split(",")
        .map(s => `<span class="y-string">${escapeHtml(s.trim())}</span>`)
        .join(`<span class="y-punct">, </span>`) +
      `<span class="y-bracket">]</span>`
    )
  }

  return escapeHtml(leading) + highlightBareValue(trimmed, escapeHtml(trimmed))
}

function highlightBareValue(raw: string, escaped: string): string {
  // Quoted string
  if (/^["']/.test(raw)) return `<span class="y-string">${escaped}</span>`
  // URL
  if (/^https?:\/\//.test(raw)) return `<span class="y-url">${escaped}</span>`
  // Number
  if (/^\d/.test(raw)) return `<span class="y-number">${escaped}</span>`
  // ISO datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return `<span class="y-date">${escaped}</span>`
  // Boolean / null
  if (/^(true|false|null|yes|no|on|off)$/i.test(raw)) return `<span class="y-bool">${escaped}</span>`
  // Priority keywords
  if (/^(must|maybe)$/.test(raw)) return `<span class="y-priority y-priority-${raw}">${escaped}</span>`
  // Transport / group keywords
  if (/^(train|flight|bus|car|ferry|walk|bike|transport|day|week|plan)$/.test(raw)) {
    return `<span class="y-keyword">${escaped}</span>`
  }
  // Default — plain string value
  return `<span class="y-string">${escaped}</span>`
}

// ─── Escape ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const PREVIEW_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; overflow: hidden; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #1e1e1e;
  color: #e8e8e8;
  font-size: 14px;
}

/* Shell */
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 16px;
  background: #161616;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}
.toolbar-brand {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  letter-spacing: .5px;
  opacity: .9;
}
.toolbar-file {
  font-size: 12px;
  color: #888;
}

/* Split */
.split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Panes */
.pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}
.pane-source { background: #1e1e1e; min-width: 0; }
.pane-render { background: #f5f5f0; min-width: 0; color: #1a1a1a; }

.pane-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .6px;
  text-transform: uppercase;
  padding: 7px 16px 6px;
  border-bottom: 1px solid #2e2e2e;
  flex-shrink: 0;
}
.pane-source .pane-label { color: #666; background: #1a1a1a; }
.pane-render .pane-label { color: #aaa; background: #eeeee8; border-color: #ddddd6; }

/* Divider */
.divider {
  width: 1px;
  background: #2e2e2e;
  flex-shrink: 0;
}

/* Source pane */
.source-code {
  flex: 1;
  overflow: auto;
  padding: 20px 24px 40px;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre;
  color: #cdd6f4;
}

/* YAML syntax colours (dark theme) */
.y-comment  { color: #585b70; font-style: italic; }
.y-key      { color: #89b4fa; }
.y-dash     { color: #585b70; }
.y-string   { color: #a6e3a1; }
.y-number   { color: #fab387; }
.y-date     { color: #f5c2e7; }
.y-bool     { color: #cba6f7; }
.y-url      { color: #89dceb; text-decoration: underline; text-decoration-color: #89dceb66; }
.y-bracket  { color: #cdd6f4; }
.y-punct    { color: #6c7086; }
.y-keyword  { color: #cba6f7; font-weight: 500; }
.y-priority-must  { color: #f38ba8; font-weight: 600; }
.y-priority-maybe { color: #a6adc8; }

/* Render pane */
.render-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.render-body {
  padding: 24px 20px 48px;
  max-width: 560px;
  margin: 0 auto;
}

/* ── Itinerary styles (copied from html.ts, scoped to .render-body) ── */
.render-body .itinerary { display: flex; flex-direction: column; gap: 0; }

.render-body .trip-header {
  background: #fff;
  border-radius: 10px;
  padding: 20px 22px 18px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.render-body .trip-header h1 { font-size: 21px; font-weight: 700; margin-bottom: 6px; }
.render-body .trip-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: #666; margin-bottom: 10px; }
.render-body .author { color: #555; }

.render-body .place {
  background: #fff;
  border-radius: 10px;
  padding: 18px 20px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
  margin-bottom: 2px;
}
.render-body .place-header { margin-bottom: 8px; }
.render-body .place-name { font-size: 17px; font-weight: 600; margin-bottom: 3px; }
.render-body .place-dates { font-size: 12px; color: #777; }
.render-body .place-tz { font-size: 11px; color: #aaa; margin-top: 2px; }

.render-body .transport {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 3px 6px;
  background: #f0efeb;
  padding: 8px 20px;
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}
.render-body .transport-icon { font-size: 13px; }
.render-body .transport-mode { font-weight: 500; color: #444; }
.render-body .transport-route { color: #555; }
.render-body .transport-times { color: #888; }
.render-body .transport-info, .render-body .transport-note {
  width: 100%; padding-left: 20px; font-size: 11px; color: #999;
}

.render-body .stays { margin: 6px 0 10px; }
.render-body .stay { font-size: 12px; color: #666; padding: 5px 0; border-top: 1px solid #f0f0ec; }
.render-body .stay-name { font-weight: 500; color: #444; }
.render-body .stay-dates { color: #999; margin-left: 6px; }
.render-body .stay-note { color: #888; font-style: italic; margin-left: 6px; }
.render-body .stay-info { margin-top: 3px; padding-left: 18px; }

.render-body .activities { margin-top: 4px; }
.render-body .activity-list { list-style: none; }
.render-body .activity-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 5px;
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f0;
}
.render-body .activity-item:last-child { border-bottom: none; }

.render-body .dot { font-size: 9px; width: 13px; flex-shrink: 0; }
.render-body .dot.must  { color: #e06c00; }
.render-body .dot.maybe { color: #bbb; }
.render-body .dot.none  { color: #ddd; }

.render-body .act-name { flex: 1; min-width: 100px; }
.render-body .act-time { font-size: 11px; color: #888; }
.render-body .act-duration { font-size: 11px; color: #aaa; }
.render-body .act-note {
  width: 100%; padding-left: 18px;
  font-size: 12px; color: #888; font-style: italic;
  border-left: 2px solid #e8e8e4; margin: 2px 0;
}
.render-body .act-info { width: 100%; padding-left: 18px; font-size: 11px; color: #999; }

.render-body .activity-group {
  margin: 8px 0;
  border-radius: 7px;
  background: #fafaf7;
  border: 1px solid #ebebe6;
  overflow: hidden;
}
.render-body .plan-group { border-style: dashed; border-color: #d8d8d2; background: #fdfdfb; }
.render-body .group-header {
  font-size: 12px; font-weight: 600; color: #555;
  padding: 6px 10px 5px;
  background: #f5f5f0;
  border-bottom: 1px solid #ebebe6;
}
.render-body .plan-header { color: #888; background: #fafaf7; }
.render-body .group-date { font-weight: 400; color: #888; }
.render-body .activity-group .activity-list { padding: 3px 10px 5px; }

.render-body .tags { margin: 5px 0 7px; display: flex; flex-wrap: wrap; gap: 3px; }
.render-body .tag {
  display: inline-block; background: #f0efeb; color: #666;
  border-radius: 4px; padding: 1px 6px; font-size: 11px;
}
.render-body .tag.small { font-size: 10px; padding: 1px 4px; }

.render-body .note {
  font-size: 12px; color: #777; font-style: italic;
  border-left: 3px solid #e0e0d8; padding-left: 9px; margin: 6px 0;
}

.render-body .info-list { margin: 6px 0; font-size: 11px; color: #888; }
.render-body .info-row { display: flex; gap: 6px; padding: 2px 0; }
.render-body .info-key { font-weight: 500; color: #aaa; min-width: 70px; }
.render-body .info-val { color: #666; }
.render-body .info-item { margin-right: 8px; }
.render-body .info-item .info-key { color: #aaa; margin-right: 3px; }
`
