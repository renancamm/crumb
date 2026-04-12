#!/usr/bin/env ts-node
import * as fs from "fs"
import * as path from "path"
import { parse } from "./parser"
import { renderHtml } from "./renderer/html"
import { renderPreview } from "./renderer/preview"

const args     = process.argv.slice(2)
const preview  = args.includes("--preview")
const filePath = args.find(a => !a.startsWith("--"))

if (!filePath) {
  console.error("Usage: npx ts-node src/cli.ts [--preview] <file.crumb>")
  console.error("  --preview   Split view: source on left, rendered output on right")
  process.exit(1)
}

const resolved = path.resolve(filePath)

if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`)
  process.exit(1)
}

const source = fs.readFileSync(resolved, "utf8")
const doc    = parse(source)
const html   = preview ? renderPreview(source, doc) : renderHtml(doc)

process.stdout.write(html)
