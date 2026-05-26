import { state, SOURCE, SPEC, EXAMPLES } from "./app-state"
import { editorEl, render } from "./app-editor"

const editorPanel   = document.getElementById("editor-panel")    as HTMLElement
const newModal      = document.getElementById("new-modal")       as HTMLElement
const newTextarea   = document.getElementById("new-textarea")    as HTMLTextAreaElement
const generateModal = document.getElementById("generate-modal")  as HTMLElement
const aboutModal    = document.getElementById("about-modal")     as HTMLElement

const menuTrigger = document.getElementById("menu-trigger") as HTMLElement
const mainMenu    = document.getElementById("main-menu")    as HTMLElement

// ─── Pill menu ────────────────────────────────────────────────────────────────

function closeMenu(): void {
  mainMenu.classList.remove("open")
  menuTrigger.classList.remove("open")
}

menuTrigger.addEventListener("click", e => {
  e.stopPropagation()
  mainMenu.classList.toggle("open")
  menuTrigger.classList.toggle("open")
})
document.addEventListener("click", closeMenu)
mainMenu.addEventListener("click", e => e.stopPropagation())

// ─── Editor open/close ────────────────────────────────────────────────────────

export function openEditor(): void {
  if (editorEl.value === "") editorEl.value = SOURCE
  editorPanel.style.display = "flex"
  editorEl.focus()
}

export function closeEditor(): void {
  editorPanel.style.display = "none"
}

document.getElementById("editor-close-btn")!.addEventListener("click", closeEditor)

// ─── Menu → New ───────────────────────────────────────────────────────────────

document.getElementById("menu-new")!.addEventListener("click", () => {
  closeMenu()
  newModal.classList.add("open")
  setTimeout(() => newTextarea.focus(), 50)
})

function closeNewModal(): void {
  newModal.classList.remove("open")
  newTextarea.value = ""
}
document.getElementById("new-close-x")!.addEventListener("click", closeNewModal)
document.getElementById("new-cancel")!.addEventListener("click",   closeNewModal)
newModal.addEventListener("click", e => { if (e.target === newModal) closeNewModal() })
document.getElementById("new-load")!.addEventListener("click", () => {
  const src = newTextarea.value.trim()
  if (!src) return
  editorEl.value = src
  render()
  closeEditor()
  closeNewModal()
})

// ─── Menu → Edit ──────────────────────────────────────────────────────────────

document.getElementById("menu-edit")!.addEventListener("click", () => { closeMenu(); openEditor() })

// ─── Menu → Examples ──────────────────────────────────────────────────────────

document.getElementById("menu-examples")!.addEventListener("click", e => {
  e.stopPropagation()
  document.getElementById("examples-sub")!.classList.toggle("open")
  ;(e.currentTarget as HTMLElement).classList.toggle("open")
})
document.querySelectorAll<HTMLElement>("[data-example]").forEach(el => {
  el.addEventListener("click", () => {
    const src = EXAMPLES[el.dataset.example!]
    if (!src) return
    editorEl.value = src
    render()
    closeEditor()
    closeMenu()
  })
})

// ─── Menu → How to generate ───────────────────────────────────────────────────

document.getElementById("menu-generate")!.addEventListener("click", () => {
  closeMenu()
  generateModal.classList.add("open")
})
function closeGenerate(): void { generateModal.classList.remove("open") }
document.getElementById("generate-close-x")!.addEventListener("click", closeGenerate)
document.getElementById("generate-close")!.addEventListener("click",   closeGenerate)
generateModal.addEventListener("click", e => { if (e.target === generateModal) closeGenerate() })

document.getElementById("dl-spec-btn")!.addEventListener("click", () => {
  if (!SPEC) return
  const blob = new Blob([SPEC], { type: "text/markdown" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "CRUMB_SPEC.md"; a.click()
  URL.revokeObjectURL(url)
})

// ─── Menu → About ─────────────────────────────────────────────────────────────

document.getElementById("menu-about")!.addEventListener("click", () => {
  closeMenu()
  aboutModal.classList.add("open")
})
function closeAbout(): void { aboutModal.classList.remove("open") }
document.getElementById("about-close-x")!.addEventListener("click",   closeAbout)
document.getElementById("about-close-btn")!.addEventListener("click", closeAbout)
aboutModal.addEventListener("click", e => { if (e.target === aboutModal) closeAbout() })
