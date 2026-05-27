/**
 * Viewer bundle entry point.
 *
 * Bundled by esbuild (IIFE) and injected into the self-contained HTML output.
 * Reads initial data from window globals set by html.ts before this script runs:
 *
 *   window.__CRUMB_DATA   — parsed CrumbDocument (initial render)
 *   window.__CRUMB_POPUPS — pre-computed popup metadata
 *
 * Listens for the "crumb:doc-updated" CustomEvent to re-render when an editor
 * (if present) updates window.__CRUMB_DATA and window.__CRUMB_POPUPS.
 */

import "./renderer/browser-app"
