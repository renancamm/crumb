/**
 * Build-time Markdown → HTML for the documentation page (docs.html).
 *
 * This module is NODE-ONLY: it pulls in markdown-it and must never be reached by a
 * browser bundle (the docs page's client code lives in app-docs.ts, which does not
 * import this). Per invariant 11, markdown-it is a build-time dependency — it never
 * ships into the viewer/embed output or touches the parser.
 *
 * The five spec Markdown files in `spec/` are the single source of truth; the docs
 * site is generated from them at build time, so it cannot drift (see build-site.ts
 * and tests/docs-build.test.ts).
 *
 * Three deliberate deviations from vanilla markdown-it:
 *   • fenced `yaml`/`crumb` blocks reuse the hand-rolled highlightYaml() so doc code
 *     looks like the landing's "it's just text" block (shared .yml-* classes);
 *   • headings get a slug `id` (namespaced per doc) and feed a table of contents;
 *   • links are rewritten so the docs read as ONE page — intra-doc `#anchor` links
 *     and cross-doc `*.md` links both resolve to in-page anchors.
 */

import MarkdownIt from "markdown-it"
import { escape }         from "./format"
import { highlightYaml }  from "./yaml-highlight"

// ── Doc registry ─────────────────────────────────────────────────────────────
// The ordered set of documents the docs page is built from. `id` is the section
// container id (and the deep-link target from the landing); `file` is read at
// build time; `basename` keys cross-doc `.md` link rewriting. `kicker` /
// `description` / `group` drive the docs-page chrome (header + grouped sidebar);
// they are navigational copy only — no field/type claims — so they cannot drift
// from the format. `download`, when set, gives a doc a Copy + Download .md action.
export interface DocMeta {
  id:          string
  label:       string
  file:        string
  basename:    string
  kicker:      string             // small category label above the title
  description: string             // one-line human framing under the title
  group:       string             // sidebar grouping ("" = ungrouped, on top)
  download?:   string             // filename → enables Copy guide + Download .md
}

export const DOCS: readonly DocMeta[] = [
  { id: "doc-overview",   label: "Overview",             file: "spec/reference/overview.md", basename: "overview.md",
    kicker: "Start here", group: "",
    description: "What Crumb is, how these docs are organized, and where to start." },
  { id: "doc-spec",       label: "Format Specification", file: "spec/CRUMB_SPEC.md",          basename: "crumb_spec.md",
    kicker: "Specification", group: "The format",
    description: "The complete, authoritative definition of the format — every field, type, and rule." },
  { id: "doc-ai-guide",   label: "AI Authoring Guide",   file: "spec/CRUMB_FOR_AI.md",        basename: "crumb_for_ai.md",
    kicker: "Guide", group: "The format", download: "CRUMB_FOR_AI.md",
    description: "A compact prompt that teaches an AI to write valid Crumb — copy it, then describe your trip." },
  { id: "doc-embedding",  label: "Embedding",            file: "spec/reference/embedding.md", basename: "embedding.md",
    kicker: "Guide", group: "Building on it",
    description: "Put a crumb's interactive map on your own site or blog, with nothing to set up." },
  { id: "doc-parser",     label: "Parser Reference",     file: "spec/reference/parser.md",    basename: "parser.md",
    kicker: "Reference", group: "Building on it",
    description: "How a parser turns crumb text into a resolved document, pass by pass." },
  { id: "doc-data-model", label: "Data Model",           file: "spec/reference/data-model.md", basename: "data-model.md",
    kicker: "Reference", group: "Building on it",
    description: "The TypeScript shape a parser outputs — the contract every viewer reads." },
]

const ID_BY_BASENAME: Record<string, string> =
  Object.fromEntries(DOCS.map(d => [d.basename, d.id]))

const DOC_ID_SET = new Set<string>(DOCS.map(d => d.id))

// ── Slugs & TOC ──────────────────────────────────────────────────────────────
export interface TocEntry { level: number; text: string; slug: string }

/** GitHub-flavoured heading slug: lowercase, non-word runs → single dash. */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "section"
}

/** Strip the inline Markdown a heading's raw source may carry, for slug + TOC text. */
function plainText(md: string): string {
  return md
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim()
}

/** Rewrite a link href so the multi-doc page reads as one page. */
function rewriteHref(href: string, docId: string): string {
  if (/^(https?:|mailto:)/i.test(href)) return href      // external — leave it
  if (href.startsWith("#")) {
    const frag = href.slice(1)
    // A bare doc-container id (`#doc-spec`, e.g. from the Overview) or an already
    // namespaced anchor (`doc-x--…`, contains "--") is a cross-doc target — leave
    // it. Anything else is an intra-doc heading anchor → namespace under this doc.
    if (DOC_ID_SET.has(frag) || frag.includes("--")) return href
    return `#${docId}--${frag}`
  }

  // Cross-doc: "<file>.md" or "<dir>/<file>.md" with an optional "#frag".
  const m = href.match(/([^/]+\.md)(#.+)?$/i)
  if (m) {
    const targetId = ID_BY_BASENAME[m[1].toLowerCase()]
    if (targetId) return m[2] ? `#${targetId}--${m[2].slice(1)}` : `#${targetId}`
  }
  return href   // sibling site page (editor.html, …) or unmapped — resolves as-is
}

// Per-render state lives on markdown-it's `env` so a single shared instance can
// render each doc with its own slug namespace and TOC. See renderDoc().
interface DocEnv { docId: string; toc: TocEntry[]; slugs: Map<string, number> }

const md = new MarkdownIt({ html: true, linkify: false, typographer: false })

// Fenced code: yaml/crumb → shared highlighter; anything else → escaped plain.
md.renderer.rules.fence = (tokens, idx) => {
  const { info, content } = tokens[idx]
  const lang = info.trim().toLowerCase()
  const body = content.replace(/\n$/, "")
  const inner = (lang === "yaml" || lang === "crumb") ? highlightYaml(body) : escape(body)
  return `<pre class="doc-code"><code>${inner}</code></pre>\n`
}

// Headings: namespaced slug id + collect H2/H3 into the TOC.
md.renderer.rules.heading_open = (tokens, idx, options, env: DocEnv, self) => {
  const level = Number(tokens[idx].tag.slice(1))
  const text  = plainText(tokens[idx + 1].content)
  const base  = slugify(text)
  const seen  = env.slugs.get(base) ?? 0
  env.slugs.set(base, seen + 1)
  const slug  = `${env.docId}--${seen === 0 ? base : `${base}-${seen}`}`
  tokens[idx].attrSet("id", slug)
  if (level === 2 || level === 3) env.toc.push({ level, text, slug })
  return self.renderToken(tokens, idx, options)
}

// Links: rewrite for the single-page layout; open external links in a new tab.
md.renderer.rules.link_open = (tokens, idx, options, env: DocEnv, self) => {
  const href = tokens[idx].attrGet("href")
  if (href) {
    tokens[idx].attrSet("href", rewriteHref(href, env.docId))
    if (/^https?:/i.test(href)) {
      tokens[idx].attrSet("target", "_blank")
      tokens[idx].attrSet("rel", "noopener")
    }
  }
  return self.renderToken(tokens, idx, options)
}

// Tables: wrap so wide spec tables scroll horizontally on mobile.
md.renderer.rules.table_open  = () => `<div class="doc-table">\n<table>\n`
md.renderer.rules.table_close = () => `</table>\n</div>\n`

/**
 * Render one doc's Markdown to HTML, namespacing all ids/anchors under `docId`
 * (so two docs that share a heading title don't collide on the combined page).
 */
export function renderDoc(src: string, docId: string): { html: string; toc: TocEntry[] } {
  // Drop the leading `# H1`: the docs-page header (html-docs.ts) owns the title, so
  // rendering the source's own H1 would duplicate it. The TOC is H2/H3 only and no
  // link targets the H1, so this is safe.
  const body = src.replace(/^\s*#\s+[^\n]*\r?\n/, "")
  const env: DocEnv = { docId, toc: [], slugs: new Map() }
  const html = md.render(body, env)
  return { html, toc: env.toc }
}
