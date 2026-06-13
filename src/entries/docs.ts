/**
 * Docs page bundle entry (esbuild IIFE, injected into docs.html).
 *
 * Viewer-side only: sidebar navigation, scrollspy, and the mobile drawer. No map,
 * no parser, no markdown-it — the Markdown is rendered to HTML at build time
 * (markdown.ts) and baked into the page.
 */
import "../app/docs/app-docs"
