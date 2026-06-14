#!/usr/bin/env ts-node
/**
 * Crumb CLI
 *
 * Usage: npx ts-node src/cli.ts <file.crumb> [output.html] [--editor] [--geo[=path]] [--geo-mode=online|static]
 *
 * Produces a self-contained HTML file with:
 *   — interactive map (MapLibre GL + Nominatim geocoding)
 *   — itinerary panel with place/transport navigation
 *   — live YAML editor (opt-in with --editor; omitted by default for clean embeddable output)
 *
 * If a baked geo-cache sidecar (`<file>.geo.json`, or `--geo=<path>`) exists, its
 * coordinates are embedded so the viewer resolves known places with no network
 * requests. Pass `--geo-mode=online` to embed but skip seeding.
 *
 * Writes to stdout if no output path is given, or to the specified file.
 */

import * as esbuild from "esbuild"
import * as fs      from "fs"
import * as path    from "path"
import { parse }    from "./parser"
import { renderHtml, AppOptions } from "./generate/html"

async function main() {
  const args      = process.argv.slice(2)
  const withEditor = args.includes("--editor")
  const positional = args.filter(a => !a.startsWith("--"))
  const filePath  = positional[0]
  const outPath   = positional[1]

  if (!filePath) {
    console.error("Usage: npx ts-node src/cli.ts <file.crumb> [output.html] [--editor]")
    process.exit(1)
  }

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }

  // 1 — Parse the .crumb source
  const source = fs.readFileSync(resolved, "utf8")
  const doc    = parse(source)

  // 1b — Optional baked geo-cache sidecar. Default path: <file>.geo.json next to
  // the input; override with --geo=<path>. Bare --geo just enables the default.
  const geoArg     = args.find(a => a === "--geo" || a.startsWith("--geo="))
  const geoModeArg = args.find(a => a.startsWith("--geo-mode="))?.split("=")[1]
  const geoMode    = geoModeArg === "online" ? "online" : geoModeArg === "static" ? "static" : undefined
  const geoPath    = geoArg && geoArg.includes("=")
    ? path.resolve(geoArg.split("=").slice(1).join("="))
    : resolved.replace(/\.crumb$/, ".geo.json")
  let geoData: Record<string, { lat: number; lng: number }> | undefined
  if (fs.existsSync(geoPath)) {
    try {
      geoData = JSON.parse(fs.readFileSync(geoPath, "utf8"))
    } catch (e) {
      console.error(`Warning: could not parse geo-cache ${geoPath}: ${(e as Error).message}`)
    }
  }

  // 2 — Bundle the window.Crumb API for the browser. Editor mode needs `parse`
  // (live re-parsing); viewer-only mode uses a render-only entry so esbuild drops
  // js-yaml + the parser passes as dead code.
  const crumbEntry = withEditor ? "entries/render-full.ts" : "entries/render-viewer.ts"
  const crumbResult = await esbuild.build({
    entryPoints: [path.resolve(__dirname, crumbEntry)],
    bundle:      true,
    format:      "iife",
    globalName:  "Crumb",
    platform:    "browser",
    write:       false,
    logLevel:    "silent",
  })
  const crumbBundle = crumbResult.outputFiles[0].text

  // 3 — Bundle viewer (map, geocoding, panel navigation, mobile sheet)
  const viewerResult = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "entries/viewer.ts")],
    bundle:      true,
    format:      "iife",
    platform:    "browser",
    write:       false,
    logLevel:    "silent",
  })
  const viewerBundle = viewerResult.outputFiles[0].text

  // 4 — Bundle editor (YAML editor, menus, dialogs) — only needed in editor mode
  const editorResult = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "entries/editor.ts")],
    bundle:      true,
    format:      "iife",
    platform:    "browser",
    write:       false,
    logLevel:    "silent",
  })
  const editorBundle = editorResult.outputFiles[0].text

  // 5 — Load spec for the "Download spec for AI" button
  const specCandidates = [
    path.resolve(__dirname, "../spec/crumb-spec.md"),
    path.resolve(__dirname, "../crumb-spec.md"),
  ]
  const specPath    = specCandidates.find(p => fs.existsSync(p))
  const specContent = specPath ? fs.readFileSync(specPath, "utf8") : undefined

  // 5b — Load the compact authoring guide for the "Generate with AI" prompt
  const aiGuideCandidates = [
    path.resolve(__dirname, "../spec/crumb-for-ai.md"),
    path.resolve(__dirname, "../crumb-for-ai.md"),
  ]
  const aiGuidePath    = aiGuideCandidates.find(p => fs.existsSync(p))
  const aiGuideContent = aiGuidePath ? fs.readFileSync(aiGuidePath, "utf8") : undefined

  // 6 — Render
  const options: AppOptions = {
    crumbBundle,
    viewerBundle,
    editorBundle,
    includeEditor: withEditor,
    source,
    specContent,
    aiGuideContent,
    geoData,
    geoMode,
  }
  const html = renderHtml(doc, options)

  if (outPath) {
    const out = path.resolve(outPath)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, html, "utf8")
    console.error(`Written to ${out}`)
  } else {
    process.stdout.write(html)
  }
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
