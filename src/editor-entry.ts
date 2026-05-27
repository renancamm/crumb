/**
 * Editor bundle entry point.
 *
 * Bundled by esbuild (IIFE) and injected after the viewer bundle. Enhances the
 * viewer with live YAML editing, menus, and dialogs.
 *
 * Reads additional globals set by html.ts in editor mode:
 *
 *   window.__CRUMB_SOURCE   — original YAML source (pre-fills the editor)
 *   window.__CRUMB_SPEC     — CRUMB_SPEC.md content for "Download spec"
 *   window.__CRUMB_EXAMPLES — example crumb files keyed by filename
 *
 * Communicates with the viewer via the "crumb:doc-updated" CustomEvent.
 */

import "./renderer/app-editor"
import "./renderer/app-menus"
