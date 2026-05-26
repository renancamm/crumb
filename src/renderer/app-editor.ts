import { state } from "./app-state"
import { updateMap } from "./app-map"
import { setupStickyTitle } from "./browser-app"

const editorEl     = document.getElementById("editor")           as HTMLTextAreaElement
const panelNav     = document.getElementById("panel-nav")        as HTMLElement
const panelContent = document.getElementById("panel-content")    as HTMLElement
const errorBar     = document.getElementById("editor-error-bar") as HTMLElement

export { editorEl }

export function setEditorError(msg: string): void {
  errorBar.textContent   = msg
  errorBar.style.display = msg ? "" : "none"
}

export function render(): void {
  const src = editorEl.value.trim()
  if (!src) {
    panelContent.innerHTML = '<div class="list-empty">Start typing a .crumb document…</div>'
    setEditorError("")
    if (state.mapReady) {
      state.map.getSource("route").setData({ type: "FeatureCollection", features: [] })
      state.placeMarkers.forEach(m => m.remove());  state.placeMarkers = []
      state.detailMarkers.forEach(m => m.remove()); state.detailMarkers = []
    }
    setMapStatus(""); return
  }
  try {
    const doc = window.Crumb.parse(src)
    state.DATA             = doc
    state.activePlaceIndex = null
    state.activeModal      = null
    state.POPUP_META       = window.Crumb.buildPopupMeta(doc)
    document.title         = "Crumb" + (doc.trip?.name ? " — " + doc.trip.name : "")
    panelNav.innerHTML     = ""
    panelContent.innerHTML = window.Crumb.renderTripPanel(doc)
    setEditorError("")
    setupStickyTitle()
    updateMap(doc)
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).split("\n")[0]
    setEditorError("⚠ " + msg)
  }
}

let debounce: ReturnType<typeof setTimeout>

editorEl.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(render, 220) })
editorEl.addEventListener("keydown", e => {
  if (e.key !== "Tab") return
  e.preventDefault()
  const s = editorEl.selectionStart, v = editorEl.value
  editorEl.value = v.slice(0, s) + "  " + v.slice(editorEl.selectionEnd)
  editorEl.selectionStart = editorEl.selectionEnd = s + 2
})

function setMapStatus(text: string): void {
  (document.getElementById("map-status") as HTMLElement).textContent = text
}
