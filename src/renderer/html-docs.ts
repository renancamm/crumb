/**
 * Documentation page renderer — produces the self-contained `docs.html`: a sticky
 * top bar with a breadcrumb, a two-region sidebar (an always-visible doc list +
 * the active doc's "On this page" TOC), and one `<section>` per doc. Each section
 * opens with a uniform header (kicker / title / description / actions) so the docs
 * read consistently regardless of how their source Markdown is written; the body
 * is the Markdown rendered by markdown.ts. app-docs.ts swaps sections client-side.
 *
 * Like html-landing.ts, this is a build-time-only module (never bundled to the
 * browser): it reuses the design tokens via CSS + docsCSS and ships only the small
 * docs bundle. The spec Markdown files are the single source of truth — see
 * build-site.ts and markdown.ts.
 */

import { CSS }                  from "./css"
import { docsCSS }              from "./docs-css"
import { escape, jsonForScript } from "./format"
import { ICON_MENU }            from "./icons"
import type { TocEntry }        from "./markdown"

export interface DocsDoc {
  id:          string       // section container id (e.g. "doc-spec")
  label:       string       // sidebar entry, title, breadcrumb
  kicker:      string       // small category label above the title
  description: string       // one-line framing under the title
  group:       string       // sidebar grouping ("" = ungrouped, on top)
  html:        string       // rendered Markdown (trusted — from markdown.ts)
  toc:         TocEntry[]    // H2/H3 anchors, already namespaced under `id`
  sourceUrl:   string       // "View source" link (GitHub blob)
  download?:   string       // filename → Copy + Download .md actions
  raw?:        string       // raw Markdown, baked for Copy/Download
}

export interface DocsOptions {
  docsBundle: string
  docs:       DocsDoc[]
  defaultDoc?: string       // id shown on load (default: first doc)
}

function docActions(d: DocsDoc): string {
  const parts: string[] = []
  if (d.download) {
    parts.push(`<button class="doc-action" data-copy="${d.id}">Copy guide</button>`)
    parts.push(`<button class="doc-action" data-download="${d.id}">Download .md</button>`)
  }
  parts.push(`<a class="doc-action doc-action--ghost" href="${escape(d.sourceUrl)}" target="_blank" rel="noopener">View source ↗</a>`)
  return parts.join("\n          ")
}

export function renderDocsHtml(opts: DocsOptions): string {
  const def = opts.defaultDoc ?? opts.docs[0]?.id
  const defLabel = opts.docs.find(d => d.id === def)?.label ?? ""

  // Sidebar doc list — grouped by `group` (a label is emitted when the group
  // changes; ungrouped docs, like Overview, sit at the top with no label).
  let lastGroup: string | null = null
  const doclist = opts.docs.map(d => {
    let prefix = ""
    if (d.group && d.group !== lastGroup) prefix = `<div class="docs-doclist-label">${escape(d.group)}</div>\n        `
    lastGroup = d.group || null
    return `${prefix}<a class="docs-doc${d.id === def ? " is-active" : ""}" href="#${d.id}" data-target="${d.id}" data-doc="${d.id}">${escape(d.label)}</a>`
  }).join("\n        ")

  // "On this page" TOCs — one per doc, only the active one shown.
  const tocs = opts.docs.map(d => {
    const links = d.toc.map(t =>
      `<li><a class="docs-toc-link" href="#${t.slug}" data-target="${t.slug}" data-level="${t.level}">${escape(t.text)}</a></li>`
    ).join("\n            ")
    return `<ul class="docs-toc${d.id === def ? " is-active" : ""}" data-doc="${d.id}">
            ${links}
          </ul>`
  }).join("\n          ")

  const sections = opts.docs.map(d =>
    `<section id="${d.id}" class="doc-section${d.id === def ? " is-active" : ""}">
        <header class="doc-head">
          <div class="doc-kicker">${escape(d.kicker)}</div>
          <h1 class="doc-title">${escape(d.label)}</h1>
          <p class="doc-desc">${escape(d.description)}</p>
          <div class="doc-actions">${docActions(d)}</div>
        </header>
        ${d.html}
      </section>`
  ).join("\n      ")

  // Raw Markdown for the Copy/Download actions, keyed by doc id (AI guide only).
  const rawMap = Object.fromEntries(
    opts.docs.filter(d => d.raw && d.download).map(d => [d.id, { md: d.raw, name: d.download }])
  )

  return `<!DOCTYPE html>
<html lang="en" class="docs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crumb · Documentation</title>
  <meta name="description" content="Documentation for Crumb, an open format for trip itineraries: the format specification, AI authoring guide, embedding guide, and parser reference.">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <style>${CSS}
${docsCSS}</style>
</head>
<body class="docs">

  <header class="docs-topbar">
    <button class="docs-menu-btn" id="docs-menu-btn" aria-label="Toggle navigation" aria-expanded="false">${ICON_MENU}</button>
    <a class="docs-brand" href="index.html">crumb</a>
    <nav class="docs-crumbs" id="docs-crumbs" aria-label="Breadcrumb">
      <a class="docs-crumb docs-crumb--home" href="#${def}" data-target="${def}">Docs</a>
      <span class="docs-crumb-sep">/</span>
      <span class="docs-crumb docs-crumb--doc" id="crumb-doc">${escape(defLabel)}</span>
      <span class="docs-crumb-sep docs-crumb--head" id="crumb-head-sep">/</span>
      <span class="docs-crumb docs-crumb--head" id="crumb-head"></span>
    </nav>
    <a class="docs-topbar-link" href="editor.html">Open editor</a>
  </header>

  <div class="docs-backdrop" id="docs-backdrop"></div>

  <div class="docs-shell">
    <nav class="docs-nav" id="docs-nav" aria-label="Documentation">
      <div class="docs-doclist">
        ${doclist}
      </div>
      <div class="docs-toc-wrap">
        <div class="docs-toc-label" id="docs-toc-label">On this page</div>
        <div class="docs-toc-list" id="docs-toc-list">
          ${tocs}
        </div>
      </div>
    </nav>
    <main class="docs-main">
      ${sections}
    </main>
  </div>

  <script>window.__CRUMB_DOCS_RAW = ${jsonForScript(rawMap)};</script>
  <script>${opts.docsBundle}</script>
</body>
</html>`
}
