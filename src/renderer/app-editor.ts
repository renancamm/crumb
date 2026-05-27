const editorEl     = document.getElementById("editor")           as HTMLTextAreaElement
const errorBar     = document.getElementById("editor-error-bar") as HTMLElement

export { editorEl }

export function setEditorError(msg: string): void {
  errorBar.textContent   = msg
  errorBar.style.display = msg ? "" : "none"
}

export function render(): void {
  const src = editorEl.value.trim()
  setEditorError("")
  if (!src) {
    window.__CRUMB_DATA   = null
    window.__CRUMB_POPUPS = {}
    window.dispatchEvent(new CustomEvent("crumb:doc-updated"))
    return
  }
  try {
    const doc = window.Crumb.parse(src)
    window.__CRUMB_DATA   = doc
    window.__CRUMB_POPUPS = window.Crumb.buildPopupMeta(doc)
    document.title        = "Crumb" + (doc.trip?.name ? " — " + doc.trip.name : "")
    window.dispatchEvent(new CustomEvent("crumb:doc-updated"))
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
