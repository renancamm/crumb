#!/usr/bin/env ts-node
/**
 * Site builder — emits the deployable pages into dist/:
 *
 *   index.html   landing page (Phase 3)
 *   editor.html  the live editor (was the old index.html)
 *   embed.html   generic map embed — takes a crumb inline (postMessage) or by URL
 *                (?src). The landing feeds its hero + cards inline. Not linked in nav.
 *
 * Bundles are built once with esbuild and reused across pages. No new runtime
 * dependencies — same pipeline as src/cli.ts.
 */

import * as esbuild from "esbuild"
import * as fs       from "fs"
import * as path     from "path"
import { parse }              from "../src/parser"
import { renderHtml }         from "../src/renderer/html"
import { renderLandingHtml }  from "../src/renderer/html-landing"

const GITHUB = "https://github.com/renancamm/crumb"
const LINKS = {
  editor:  "editor.html",
  spec:    `${GITHUB}/blob/main/spec/CRUMB_SPEC.md`,
  aiGuide: `${GITHUB}/blob/main/spec/CRUMB_FOR_AI.md`,
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
  const viewerRenderBundle = await bundle("viewer-render-entry.ts", "Crumb") // render fns, parser-free
  const editorRenderBundle = await bundle("browser-entry.ts",       "Crumb") // render fns + parse
  const viewerBundle       = await bundle("viewer-entry.ts")
  const editorBundle       = await bundle("editor-entry.ts")
  const embedBundle        = await bundle("embed-entry.ts")
  const landingBundle      = await bundle("landing-entry.ts")

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

  // ── editor.html — the live editor (all examples embedded) ──
  const examples: Record<string, string> = {}
  for (const f of fs.readdirSync(EXAMPLES).filter(f => f.endsWith(".crumb")).sort())
    examples[f] = readExample(f)
  const editorHtml = renderHtml(parse(readExample("japan-detailed.crumb")), {
    crumbBundle: editorRenderBundle,
    viewerBundle,
    editorBundle,
    includeEditor:  true,
    source:         readExample("japan-detailed.crumb"),
    examples,
    specContent:    readFirst(["spec/CRUMB_SPEC.md", "CRUMB_SPEC.md"]),
    aiGuideContent: readFirst(["spec/CRUMB_FOR_AI.md", "CRUMB_FOR_AI.md"]),
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

  console.error("Built: dist/index.html, dist/editor.html, dist/embed.html")
}

main().catch(e => { console.error(e); process.exit(1) })
