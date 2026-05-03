#!/usr/bin/env ts-node
/**
 * Crumb CLI
 *
 * Usage: npx ts-node src/cli.ts <file.crumb> [output.html]
 *
 * Produces a self-contained HTML file with:
 *   — interactive map (MapLibre GL + Nominatim geocoding)
 *   — itinerary panel with app bar (Open / Share / Reference)
 *   — live YAML editor (activated via the Open button)
 *
 * Writes to stdout if no output path is given, or to the specified file.
 */

import * as esbuild from "esbuild"
import * as fs      from "fs"
import * as path    from "path"
import { parse }    from "./parser"
import { renderHtml, AppOptions } from "./renderer/html"

async function main() {
  const args     = process.argv.slice(2)
  const filePath = args[0]
  const outPath  = args[1]

  if (!filePath) {
    console.error("Usage: npx ts-node src/cli.ts <file.crumb> [output.html]")
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

  // 2 — Bundle parser + renderer for the browser (live re-parsing)
  const parserResult = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "browser-entry.ts")],
    bundle:      true,
    format:      "iife",
    globalName:  "Crumb",
    platform:    "browser",
    write:       false,
    logLevel:    "silent",
  })
  const parserBundle = parserResult.outputFiles[0].text

  // 2b — Bundle browser app (map, geocoding, editor, UI interactions)
  const appResult = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "renderer/browser-app.ts")],
    bundle:      true,
    format:      "iife",
    platform:    "browser",
    write:       false,
    logLevel:    "silent",
  })
  const appBundle = appResult.outputFiles[0].text

  // 3 — Collect examples
  const examplesDir = path.resolve(__dirname, "../examples")
  const examples: Record<string, string> = {}
  if (fs.existsSync(examplesDir)) {
    for (const file of fs.readdirSync(examplesDir).filter(f => f.endsWith(".crumb")).sort()) {
      examples[file] = fs.readFileSync(path.join(examplesDir, file), "utf8")
    }
  }

  // 4 — Load spec for the Reference → "Download spec for AI" button
  const specCandidates = [
    path.resolve(__dirname, "../spec/CRUMB_SPEC.md"),
    path.resolve(__dirname, "../CRUMB_SPEC.md"),
  ]
  const specPath    = specCandidates.find(p => fs.existsSync(p))
  const specContent = specPath ? fs.readFileSync(specPath, "utf8") : undefined

  // 5 — Render
  const options: AppOptions = { source, examples, parserBundle, appBundle, specContent }
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
