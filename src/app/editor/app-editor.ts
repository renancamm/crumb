/**
 * Editor surface — a CodeMirror 6 instance mounted in #editor.
 *
 * Provides live YAML editing with syntax highlighting, line numbers, inline
 * parse diagnostics, Crumb-aware autocomplete, and find/replace. On every doc
 * change it debounces a re-parse (`render`) that updates window.__CRUMB_DATA and
 * fires "crumb:doc-updated" for the viewer bundle to re-render.
 *
 * CodeMirror ships into the *editor* bundle only — never the viewer/embed/render
 * bundles that inline into every self-contained .crumb file (see CLAUDE.md #11).
 */

import { EditorView, basicSetup } from "codemirror"
import { EditorState } from "@codemirror/state"
import { keymap, placeholder } from "@codemirror/view"
import { indentWithTab, undo, redo } from "@codemirror/commands"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { yaml, yamlLanguage } from "@codemirror/lang-yaml"
import { linter, lintGutter, Diagnostic } from "@codemirror/lint"
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete"
import { tags as t } from "@lezer/highlight"
import { GROUP_KINDS, TRANSPORT_MODES } from "../../types/primitives"
import {
  ACTIVITY_FIELDS,
  GROUP_FIELDS,
  PLACE_FIELDS,
  STAY_FIELDS,
  TOP_LEVEL_KEYS,
  TRANSPORT_FIELDS,
  TRIP_FIELDS,
} from "../../parser/vocab"

const hostEl   = document.getElementById("editor")        as HTMLElement
const statusEl = document.getElementById("editor-status") as HTMLElement

// The persistent bottom status bar: a parse summary normally, the error on fail.
export function setEditorError(msg: string): void {
  if (msg) {
    statusEl.textContent = "⚠ " + msg
    statusEl.classList.add("has-error")
  } else {
    statusEl.textContent = "● valid"
    statusEl.classList.remove("has-error")
  }
}

// ─── Re-parse loop ────────────────────────────────────────────────────────────

export function render(): void {
  const src = getValue().trim()
  if (!src) {
    statusEl.textContent = "● ready"
    statusEl.classList.remove("has-error")
    window.__CRUMB_DATA = null
    window.dispatchEvent(new CustomEvent("crumb:doc-updated"))
    return
  }
  try {
    const doc = window.Crumb.parse(src)
    window.__CRUMB_DATA = doc
    document.title      = "Crumb" + (doc.trip?.name ? " — " + doc.trip.name : "")
    setEditorError("")
    window.dispatchEvent(new CustomEvent("crumb:doc-updated"))
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).split("\n")[0]
    setEditorError(msg)
  }
}

let debounce: ReturnType<typeof setTimeout>
const scheduleRender = (): void => {
  clearTimeout(debounce)
  debounce = setTimeout(render, 220)
}

// ─── Theme (always-dark, driven by Crumb's --ed-* tokens) ─────────────────────

const crumbTheme = EditorView.theme(
  {
    "&":                     { color: "var(--ed-text)", backgroundColor: "var(--ed-bg)" },
    ".cm-content":           { caretColor: "var(--ed-caret)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ed-caret)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "var(--ed-selection-bg)" },
    ".cm-gutters":           { backgroundColor: "var(--ed-bg)", color: "var(--ed-muted)", border: "none" },
    ".cm-activeLine":        { backgroundColor: "var(--ed-surface)" },
    ".cm-activeLineGutter":  { backgroundColor: "var(--ed-surface)" },
    ".cm-placeholder":       { color: "var(--ed-placeholder)" },
  },
  { dark: true },
)

const crumbHighlight = HighlightStyle.define([
  { tag: [t.definition(t.propertyName), t.propertyName],         color: "var(--ed-syntax-key)" },
  { tag: [t.string, t.special(t.string)],                        color: "var(--ed-syntax-string)" },
  { tag: t.comment,                                              color: "var(--ed-syntax-comment)", fontStyle: "italic" },
  { tag: t.number,                                               color: "var(--ed-syntax-number)" },
  { tag: [t.bool, t.null, t.atom, t.keyword],                    color: "var(--ed-syntax-bool)" },
])

// ─── Crumb-aware autocomplete ─────────────────────────────────────────────────

// Every key the parser accepts (deduped) plus the kind discriminators. Sourced
// from parser/vocab so completions can never drift from what parse() allows.
const FIELD_KEYS = [...new Set([
  ...TOP_LEVEL_KEYS, ...TRIP_FIELDS, ...PLACE_FIELDS, ...TRANSPORT_FIELDS,
  ...ACTIVITY_FIELDS, ...STAY_FIELDS, ...GROUP_FIELDS,
  "place", "transport", "activity", "stay", "day", "week", "group",
])]

function crumbCompletions(ctx: CompletionContext): CompletionResult | null {
  const line   = ctx.state.doc.lineAt(ctx.pos)
  const before = line.text.slice(0, ctx.pos - line.from)

  // Value completion: transport modes after "transport:".
  if (/(^|\s)transport:\s*[\w-]*$/.test(before)) {
    const word = ctx.matchBefore(/[\w-]*/)!
    return { from: word.from, options: TRANSPORT_MODES.map(label => ({ label, type: "enum" })) }
  }

  // Key completion: only at the key position (line start, optionally indented or
  // after a "- " list dash). Avoids popping inside free-text values.
  if (!/^(\s*)(- )?[\w-]*$/.test(before)) return null
  const word = ctx.matchBefore(/[\w-]*/)
  if (!word || (word.from === word.to && !ctx.explicit)) return null
  return {
    from: word.from,
    options: [
      ...FIELD_KEYS.map(label => ({ label, type: "property" })),
      ...GROUP_KINDS.map(label => ({ label, type: "keyword" })),
    ],
  }
}

// ─── Inline diagnostics ───────────────────────────────────────────────────────

// js-yaml exceptions carry a `.mark` with line/column; Crumb's own validation
// errors are positionless, so they surface as a top-of-document diagnostic (plus
// the human-readable summary in the #editor-status bar via render()).
const crumbLinter = linter((view): Diagnostic[] => {
  const src = view.state.doc.toString()
  if (!src.trim()) return []
  try {
    window.Crumb.parse(src)
    return []
  } catch (e) {
    const msg  = (e instanceof Error ? e.message : String(e)).split("\n")[0]
    const mark = (e as { mark?: { line?: number; column?: number } })?.mark
    if (mark && typeof mark.line === "number") {
      const line = view.state.doc.line(Math.min(mark.line + 1, view.state.doc.lines))
      const from = Math.min(line.from + (mark.column ?? 0), line.to)
      return [{ from, to: line.to, severity: "error", message: msg }]
    }
    const first = view.state.doc.line(1)
    return [{ from: first.from, to: first.to, severity: "error", message: msg }]
  }
})

// ─── The view ─────────────────────────────────────────────────────────────────

const view = new EditorView({
  parent: hostEl,
  doc:    window.__CRUMB_SOURCE ?? "",
  extensions: [
    basicSetup,
    keymap.of([indentWithTab]),
    yaml(),
    yamlLanguage.data.of({ autocomplete: crumbCompletions }),
    crumbTheme,
    syntaxHighlighting(crumbHighlight),
    placeholder("Paste or type a .crumb document…"),
    crumbLinter,
    lintGutter(),
    EditorState.tabSize.of(2),
    EditorView.updateListener.of(u => { if (u.docChanged) scheduleRender() }),
  ],
})

// ─── Public API (used by app-menus, app-layout) ───────────────────────────────

export function getValue(): string {
  return view.state.doc.toString()
}

export function setValue(text: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
}

export function focusEditor(): void {
  view.focus()
}

export function editorUndo(): void { undo(view) }
export function editorRedo(): void { redo(view) }

/** Re-measure after the pane is shown or resized (CM needs this when laid out
 *  while hidden or when its width changes). */
export function refreshEditorLayout(): void {
  view.requestMeasure()
}
