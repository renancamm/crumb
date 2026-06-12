/**
 * Editor/map split layout — the draggable divider between #editor-pane and #map.
 *
 * The pane width is a CSS variable (--editor-width) on #main; dragging the
 * splitter updates it (persisted to localStorage). There is one threshold,
 * derived from the live menu-pill width plus the collapse button, so the pill and
 * button never overlap:
 *   - dragging an open editor narrower than the threshold snaps it **collapsed**;
 *   - dragging a collapsed rail past the threshold **expands** it back to its last
 *     width (--editor-width is left untouched while collapsed, so expand restores
 *     the previous state rather than following the pointer).
 * Each crossing ends the drag, so it acts as a snap.
 *
 * After a resize we fire "crumb:layout-resized" so the viewer bundle can call
 * map.resize() — the editor never imports the map, keeping the bundles decoupled.
 */

import { refreshEditorLayout } from "./app-editor"
import { hideEditor, openEditor } from "./app-menus"

const main       = document.getElementById("main")            as HTMLElement
const splitter   = document.getElementById("editor-splitter") as HTMLElement | null
const editorPane = document.getElementById("editor-pane")     as HTMLElement
const pill       = document.getElementById("app-bar")         as HTMLElement | null

const STORAGE_KEY = "crumb-editor-width"
const MAX_PCT = 80

// Minimum open width = menu pill + the collapse button + margins (so they sit
// side by side without overlapping). The same value triggers collapse/expand.
const pillWidth = (): number => pill ? pill.offsetWidth : 220
const threshold = (): number => pillWidth() + 64

// Restore a previously dragged width.
const saved = localStorage.getItem(STORAGE_KEY)
if (saved) main.style.setProperty("--editor-width", saved)

function notifyResize(): void {
  refreshEditorLayout()
  window.dispatchEvent(new CustomEvent("crumb:layout-resized"))
}

function setWidth(px: number, totalPx: number): void {
  const pct = Math.min(MAX_PCT, (px / totalPx) * 100)
  main.style.setProperty("--editor-width", `${pct}%`)
  notifyResize()
}

if (splitter) {
  splitter.addEventListener("pointerdown", e => {
    e.preventDefault()
    splitter.classList.add("dragging")
    splitter.setPointerCapture(e.pointerId)

    const finish = (): void => {
      splitter.classList.remove("dragging")
      splitter.removeEventListener("pointermove", onMove)
      splitter.removeEventListener("pointerup", onUp)
      if (!editorPane.classList.contains("collapsed")) {
        localStorage.setItem(STORAGE_KEY, main.style.getPropertyValue("--editor-width"))
      }
      notifyResize()
    }

    const onMove = (ev: PointerEvent): void => {
      const rect = main.getBoundingClientRect()
      const x = ev.clientX - rect.left          // proposed editor width, px
      if (editorPane.classList.contains("collapsed")) {
        if (x >= threshold()) { openEditor(false); finish() }   // snap to last width
      } else if (x < threshold()) {
        hideEditor(); finish()                                  // snap collapsed
      } else {
        setWidth(x, rect.width)
      }
    }
    const onUp = (): void => finish()

    splitter.addEventListener("pointermove", onMove)
    splitter.addEventListener("pointerup", onUp)
  })
}
