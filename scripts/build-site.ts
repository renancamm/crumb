#!/usr/bin/env ts-node
/**
 * Site builder — emits the deployable pages into dist/:
 *
 *   index.html   landing page (Phase 3)
 *   editor.html  the live editor (was the old index.html)
 *   embed.html   generic map embed — takes a crumb inline (postMessage) or by URL
 *                (?src). The landing feeds its hero + cards inline. Not linked in nav.
 *   docs.html    documentation site, generated from the spec/*.md sources
 *   examples/    the example .crumb files, copied verbatim as static assets — the
 *                editor's ?example= deep link fetches them at runtime
 *
 * Bundles are built once with esbuild and reused across pages. No new runtime
 * dependencies — same pipeline as src/cli.ts.
 */

import * as esbuild from "esbuild"
import * as fs       from "fs"
import * as path     from "path"
import { parse }              from "../src/parser"
import { renderHtml }         from "../src/generate/html"
import { renderLandingHtml }  from "../src/generate/landing/html-landing"
import { renderDocsHtml }     from "../src/generate/docs/html-docs"
import { renderDoc, DOCS }    from "../src/generate/docs/markdown"

const GITHUB = "https://github.com/renancamm/crumb"
const LINKS = {
  editor:  "editor.html",
  docs:    "docs.html",
  spec:    `${GITHUB}/blob/main/spec/crumb-spec.md`,
  aiGuide: `${GITHUB}/blob/main/spec/crumb-for-ai.md`,
  github:  GITHUB,
}

const ROOT     = path.resolve(__dirname, "..")
const SRC      = path.join(ROOT, "src")
const EXAMPLES = path.join(ROOT, "examples")
const DIST     = path.join(ROOT, "dist")

type GeoCache = Record<string, { lat: number; lng: number }>

async function bundle(entry: string, globalName?: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [path.join(SRC, entry)],
    bundle:      true,
    format:      "iife",
    platform:    "browser",
    minify:      true,
    write:       false,
    logLevel:    "silent",
    ...(globalName ? { globalName } : {}),
  })
  return result.outputFiles[0].text
}

const readExample = (name: string): string =>
  fs.readFileSync(path.join(EXAMPLES, name), "utf8")

function readGeo(name: string): GeoCache {
  const p = path.join(EXAMPLES, name)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}
}

function readFirst(candidates: string[]): string | undefined {
  for (const rel of candidates) {
    const p = path.join(ROOT, rel)
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8")
  }
  return undefined
}


async function main() {
  fs.mkdirSync(DIST, { recursive: true })

  // ── Browser bundles (built once, shared across pages) ──
  const viewerRenderBundle = await bundle("entries/render-viewer.ts", "Crumb") // render fns, parser-free
  const editorRenderBundle = await bundle("entries/render-full.ts",       "Crumb") // render fns + parse
  const viewerBundle       = await bundle("entries/viewer.ts")
  const editorBundle       = await bundle("entries/editor.ts")
  const embedBundle        = await bundle("entries/embed.ts")
  const landingBundle      = await bundle("entries/landing.ts")

  // ── embed.html — generic, content-agnostic embed: takes a crumb inline (the
  //    landing posts crumb + geo via postMessage) or by URL (?src=…&geo=…). Ships
  //    the render bundle *with* parse so the crumb is parsed client-side. ──
  const embedHtml = renderHtml(null, {
    crumbBundle:  editorRenderBundle,   // window.Crumb.parse for the crumb
    viewerBundle: embedBundle,
    editorBundle,                       // unused in viewer-only
    includeEditor: false,
    embed: true,
  })
  fs.writeFileSync(path.join(DIST, "embed.html"), embedHtml)

  // ── dist/examples/ — example .crumb files as static assets. The editor's
  //    ?example=<file> deep link fetches these at runtime (relative path, so it
  //    works under any Pages base path), so they aren't baked into any page. ──
  const distExamples = path.join(DIST, "examples")
  fs.mkdirSync(distExamples, { recursive: true })
  for (const f of fs.readdirSync(EXAMPLES).filter(f => f.endsWith(".crumb")).sort())
    fs.copyFileSync(path.join(EXAMPLES, f), path.join(distExamples, f))

  // ── editor.html — the live editor (japan-detailed loaded by default) ──
  const editorHtml = renderHtml(parse(readExample("japan-detailed.crumb")), {
    crumbBundle: editorRenderBundle,
    viewerBundle,
    editorBundle,
    includeEditor:  true,
    source:         readExample("japan-detailed.crumb"),
    specContent:    readFirst(["spec/crumb-spec.md", "crumb-spec.md"]),
    aiGuideContent: readFirst(["spec/crumb-for-ai.md", "crumb-for-ai.md"]),
    geoData:        readGeo("japan-detailed.geo.json"),
  })
  fs.writeFileSync(path.join(DIST, "editor.html"), editorHtml)

  // ── index.html — the landing page ──
  // Hero detail-level stages (pill-swappable) + gallery example cards. Each embed
  // is the shared embed.html, fed its crumb + geo INLINE via postMessage (no
  // external .crumb fetch); `source` also feeds the "it's just text" YAML block.
  const STAGES = [
    { key: "japan-sketch",   label: "Sketch"   },
    { key: "japan-planning", label: "Planned"  },
    { key: "japan-detailed", label: "Detailed" },
  ]
  const DEFAULT_STAGE = 1   // Planned — the middle, most representative detail level
  const sources   = STAGES.map(s => readExample(`${s.key}.crumb`))
  const stageGeos = STAGES.map(s => readGeo(`${s.key}.geo.json`))
  const GALLERY = ["lisbon-guide", "copenhagen-weekend", "southeast-asia"]
  const galleryExamples = GALLERY.map(key => ({
    key,
    file:   `${key}.crumb`,
    source: readExample(`${key}.crumb`),
    geo:    readGeo(`${key}.geo.json`),
  }))
  const landingHtml = renderLandingHtml({
    landingBundle,
    stages: STAGES.map((s, i) => ({ label: s.label, file: `${s.key}.crumb`, source: sources[i], geo: stageGeos[i] })),
    links:  LINKS,
    examples: galleryExamples,
    defaultStage: DEFAULT_STAGE,
  })
  fs.writeFileSync(path.join(DIST, "index.html"), landingHtml)

  // ── docs.html — the documentation site, generated from the spec Markdown ──
  // The spec/*.md files are the single source of truth: rendered to HTML here at
  // build time (markdown.ts) so the docs can never drift. See docs-build.test.ts.
  const docsBundle = await bundle("entries/docs.ts")
  const docs = DOCS.map(d => {
    const md = fs.readFileSync(path.join(ROOT, d.file), "utf8")
    const { html, toc } = renderDoc(md, d.id)
    return {
      id: d.id, label: d.label, kicker: d.kicker, description: d.description, group: d.group,
      html, toc,
      sourceUrl: `${GITHUB}/blob/main/${d.file}`,
      download:  d.download,
      raw:       d.download ? md : undefined,   // only baked where Copy/Download is offered
    }
  })
  fs.writeFileSync(path.join(DIST, "docs.html"), renderDocsHtml({ docsBundle, docs }))

  console.error("Built: dist/index.html, dist/editor.html, dist/embed.html, dist/docs.html, dist/examples/")
}

main().catch(e => { console.error(e); process.exit(1) })
