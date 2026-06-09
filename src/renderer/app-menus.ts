import { editorEl, render } from "./app-editor"

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const editorPanel       = document.getElementById("editor-panel")         as HTMLElement
const newModal          = document.getElementById("new-modal")             as HTMLElement
const newTextarea       = document.getElementById("new-textarea")          as HTMLTextAreaElement
const generateModal     = document.getElementById("generate-modal")        as HTMLElement
const aboutModal        = document.getElementById("about-modal")           as HTMLElement
const deleteConfirmModal= document.getElementById("delete-confirm-modal")  as HTMLElement
const deleteConfirmDesc = document.getElementById("delete-confirm-desc")   as HTMLElement
const recentList        = document.getElementById("recent-list")           as HTMLElement

// ─── Modal utility ────────────────────────────────────────────────────────────

function bindModal(
  overlay: HTMLElement,
  closeIds: string[],
  onClose?: () => void
): { open(): void; close(): void } {
  const close = () => { overlay.classList.remove("open"); onClose?.() }
  const open  = () => overlay.classList.add("open")
  overlay.addEventListener("click", e => { if (e.target === overlay) close() })
  for (const id of closeIds) document.getElementById(id)!.addEventListener("click", close)
  return { open, close }
}

// ─── Multi-menu open/close ────────────────────────────────────────────────────

type MenuId = "file" | "examples" | "about"

const menus: Record<MenuId, { trigger: HTMLElement; sub: HTMLElement }> = {
  file:     { trigger: document.getElementById("menu-file")!,     sub: document.getElementById("file-sub")! },
  examples: { trigger: document.getElementById("menu-examples")!, sub: document.getElementById("examples-sub")! },
  about:    { trigger: document.getElementById("menu-about")!,    sub: document.getElementById("about-sub")! },
}

function closeAll(): void {
  for (const { trigger, sub } of Object.values(menus)) {
    trigger.classList.remove("open")
    sub.classList.remove("open")
  }
}

function toggleMenu(id: MenuId, e: Event): void {
  e.stopPropagation()
  const { trigger, sub } = menus[id]
  const wasOpen = sub.classList.contains("open")
  closeAll()
  if (!wasOpen) {
    trigger.classList.add("open")
    sub.classList.add("open")
  }
}

for (const [id, { trigger }] of Object.entries(menus) as [MenuId, { trigger: HTMLElement; sub: HTMLElement }][]) {
  trigger.addEventListener("click", e => toggleMenu(id, e))
}

document.addEventListener("click", closeAll)

// ─── localStorage itinerary persistence ──────────────────────────────────────

const STORAGE_KEY = "crumb-saved-v1"

interface SavedEntry { name: string; source: string; savedAt: number }

function getSaved(): SavedEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}

function saveEntry(name: string, source: string): void {
  const entries = getSaved().filter(e => e.name !== name)
  entries.unshift({ name, source, savedAt: Date.now() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function deleteEntry(name: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaved().filter(e => e.name !== name)))
}

// The name under which the current doc is saved (null if not saved yet).
let currentSavedName: string | null = null

const deleteMenuItem = document.getElementById("menu-delete")!

function setCurrentSavedName(name: string | null): void {
  currentSavedName = name
  if (name) {
    deleteMenuItem.classList.remove("menu-sub-item--disabled")
  } else {
    deleteMenuItem.classList.add("menu-sub-item--disabled")
  }
}

function refreshRecentList(): void {
  const entries = getSaved()
  recentList.innerHTML = ""
  if (entries.length === 0) {
    const el = document.createElement("div")
    el.className = "menu-sub-item menu-sub-item--muted"
    el.textContent = "No saved itineraries"
    recentList.appendChild(el)
    return
  }
  for (const entry of entries) {
    const el = document.createElement("div")
    el.className = "menu-sub-item"
    el.textContent = entry.name
    el.addEventListener("click", () => {
      editorEl.value    = entry.source
      setCurrentSavedName(entry.name)
      render()
      closeEditor()
      closeAll()
    })
    recentList.appendChild(el)
  }
}

refreshRecentList()
setCurrentSavedName(null)

// ─── Editor open/close ────────────────────────────────────────────────────────

export function openEditor(): void {
  if (editorEl.value === "") editorEl.value = window.__CRUMB_SOURCE ?? ""
  editorPanel.style.display = "flex"
  editorEl.focus()
}

export function closeEditor(): void {
  editorPanel.style.display = "none"
}

document.getElementById("editor-close-btn")!.addEventListener("click", closeEditor)

// ─── File → Edit ──────────────────────────────────────────────────────────────

document.getElementById("menu-edit")!.addEventListener("click", () => {
  closeAll()
  openEditor()
})

// ─── File → New ───────────────────────────────────────────────────────────────

const newModalCtrl = bindModal(newModal, ["new-close-x", "new-cancel"], () => { newTextarea.value = "" })

document.getElementById("menu-new")!.addEventListener("click", () => {
  closeAll()
  newModalCtrl.open()
  setTimeout(() => newTextarea.focus(), 50)
})

document.getElementById("new-load")!.addEventListener("click", () => {
  const src = newTextarea.value.trim()
  if (!src) return
  editorEl.value   = src
  setCurrentSavedName(null)
  render()
  closeEditor()
  newModalCtrl.close()
})

// ─── File → Save ──────────────────────────────────────────────────────────────

document.getElementById("menu-save")!.addEventListener("click", () => {
  closeAll()
  const source = editorEl.value.trim()
  if (!source) return
  const name = window.__CRUMB_DATA?.trip?.name ?? "Untitled"
  saveEntry(name, source)
  setCurrentSavedName(name)
  refreshRecentList()
})

// ─── File → Save as… ─────────────────────────────────────────────────────────

document.getElementById("menu-save-as")!.addEventListener("click", async () => {
  closeAll()
  const source = editorEl.value.trim()
  if (!source) return
  const name     = window.__CRUMB_DATA?.trip?.name ?? "itinerary"
  const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + ".crumb"
  if ("showSaveFilePicker" in window) {
    try {
      const fh = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Crumb file", accept: { "text/plain": [".crumb"] } }],
      })
      const writable = await fh.createWritable()
      await writable.write(source)
      await writable.close()
      return
    } catch (e) {
      if ((e as any).name === "AbortError") return
      console.warn("showSaveFilePicker failed, falling back to download:", e)
    }
  }
  const blob = new Blob([source], { type: "text/plain" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
})

// ─── File → Delete ────────────────────────────────────────────────────────────

const deleteCtrl = bindModal(deleteConfirmModal, ["delete-cancel"])

deleteMenuItem.addEventListener("click", () => {
  if (!currentSavedName) return
  closeAll()
  deleteConfirmDesc.textContent = `"${currentSavedName}" will be removed from your saved itineraries.`
  deleteCtrl.open()
})

document.getElementById("delete-confirm-btn")!.addEventListener("click", () => {
  if (currentSavedName) {
    deleteEntry(currentSavedName)
    setCurrentSavedName(null)
    refreshRecentList()
  }
  editorEl.value = ""
  render()
  deleteCtrl.close()
})

// ─── Examples menu ────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLElement>("[data-example]").forEach(el => {
  el.addEventListener("click", () => {
    const src = (window.__CRUMB_EXAMPLES ?? {})[el.dataset.example!]
    if (!src) return
    editorEl.value   = src
    setCurrentSavedName(null)
    render()
    closeEditor()
    closeAll()
  })
})

// Deep link: editor.html?example=<file> opens the live editor pre-loaded with
// that example (the landing page's cards link here). Renders straight to the map;
// the editor textarea stays one click away via File → Edit.
{
  const exParam = new URLSearchParams(location.search).get("example")
  const src = exParam ? (window.__CRUMB_EXAMPLES ?? {})[exParam] : undefined
  if (src) {
    editorEl.value = src
    setCurrentSavedName(null)
    render()
  }
}

// ─── About → What is a Crumb ──────────────────────────────────────────────────

const aboutCtrl = bindModal(aboutModal, ["about-close-x", "about-close-btn"])

document.getElementById("about-what")!.addEventListener("click", () => {
  closeAll()
  aboutCtrl.open()
})

// ─── About → How to generate ──────────────────────────────────────────────────

const generateCtrl = bindModal(generateModal, ["generate-close-x", "generate-close"])

document.getElementById("about-generate")!.addEventListener("click", () => {
  closeAll()
  generateCtrl.open()
})

// The prompt = the compact authoring guide + a trailing instruction the user
// completes with their trip. Pasted whole into any chatbot, it produces a crumb.
function aiPrompt(): string {
  const guide = window.__CRUMB_FOR_AI ?? ""
  return `${guide}

---

Now write a single .crumb document (valid YAML only, no commentary) for the trip below.

Trip: [describe your trip here — e.g. "10 days in Italy: Rome (4 nights), Florence (3), Venice (2), trains between, fly home from Venice"]
`
}

document.getElementById("dl-guide-btn")!.addEventListener("click", () => {
  const guide = window.__CRUMB_FOR_AI
  if (!guide) return
  const blob = new Blob([guide], { type: "text/markdown" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "CRUMB_FOR_AI.md"; a.click()
  URL.revokeObjectURL(url)
})

document.getElementById("copy-prompt-btn")!.addEventListener("click", (e) => {
  const btn = e.currentTarget as HTMLButtonElement
  const done = () => { const t = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = t }, 1500) }
  const text = aiPrompt()
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done))
  } else {
    fallbackCopy(text, done)
  }
})

function fallbackCopy(text: string, done: () => void): void {
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"; ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand("copy"); done() } finally { document.body.removeChild(ta) }
}
