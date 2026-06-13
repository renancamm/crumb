import { getValue, setValue, focusEditor, refreshEditorLayout, render, editorUndo, editorRedo } from "./app-editor"
import { copyText } from "./clipboard"

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const editorPane        = document.getElementById("editor-pane")           as HTMLElement
const editorReopen      = document.getElementById("editor-reopen")          as HTMLElement | null
const openFileInput     = document.getElementById("open-file-input")        as HTMLInputElement
const embedModal        = document.getElementById("embed-modal")            as HTMLElement
const embedSnippet      = document.getElementById("embed-snippet")          as HTMLTextAreaElement
const generateModal     = document.getElementById("generate-modal")        as HTMLElement
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

// ─── File menu open/close ───────────────────────────────────────────────────

const fileTrigger = document.getElementById("menu-file")!
const fileSub     = document.getElementById("file-sub")!

function closeAll(): void {
  fileTrigger.classList.remove("open")
  fileSub.classList.remove("open")
}

fileTrigger.addEventListener("click", e => {
  e.stopPropagation()
  const wasOpen = fileSub.classList.contains("open")
  closeAll()
  if (!wasOpen) {
    fileTrigger.classList.add("open")
    fileSub.classList.add("open")
  }
})

document.addEventListener("click", closeAll)

// Clicks inside the dropdown shouldn't reach the trigger/document close handlers:
// actionable items close the menu explicitly via closeAll(), so disabled items,
// empty padding, and the hover-only flyout parents leave the menu open.
fileSub.addEventListener("click", e => e.stopPropagation())

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

// What "Revert changes" restores: the document as it was when it was loaded
// (Open / Open recent / example / initial source). null when nothing has been
// loaded this session (a blank New) — Revert is then disabled. Save does NOT
// move this baseline; revert always returns to the loaded state.
let loadedBaseline: string | null =
  window.__CRUMB_SOURCE && window.__CRUMB_SOURCE.trim() ? window.__CRUMB_SOURCE : null

const deleteMenuItem = document.getElementById("menu-delete")!
const revertMenuItem = document.getElementById("menu-revert")!

function setRevertEnabled(enabled: boolean): void {
  revertMenuItem.classList.toggle("menu-sub-item--disabled", !enabled)
}

function setCurrentSavedName(name: string | null): void {
  currentSavedName = name
  if (name) {
    deleteMenuItem.classList.remove("menu-sub-item--disabled")
  } else {
    deleteMenuItem.classList.add("menu-sub-item--disabled")
  }
}

// Load a document into the editor. `asBaseline` true for real loads (a file /
// recent / example) → sets the revert baseline; false for a blank New → clears it.
function loadDoc(source: string, savedName: string | null, asBaseline: boolean): void {
  setValue(source)
  setCurrentSavedName(savedName)
  loadedBaseline = asBaseline ? source : null
  setRevertEnabled(loadedBaseline !== null)
  render()
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
      loadDoc(entry.source, entry.name, true)
      closeAll()
    })
    recentList.appendChild(el)
  }
}

refreshRecentList()
setCurrentSavedName(null)
setRevertEnabled(loadedBaseline !== null)

// ─── Editor open/close ────────────────────────────────────────────────────────

export function openEditor(focus = true): void {
  if (getValue() === "") setValue(window.__CRUMB_SOURCE ?? "")
  editorPane.classList.remove("collapsed")
  document.body.classList.remove("editor-collapsed")
  refreshEditorLayout()
  window.dispatchEvent(new CustomEvent("crumb:layout-resized"))
  if (focus) focusEditor()
}

// Hide (not close) — the editor collapses to a narrow rail that still shows a
// peek of the code; content is preserved. The splitter stays draggable so the
// rail can be dragged back out (see app-layout.ts). On mobile the rail is hidden
// entirely and the map shows (the body class drives the mobile toggle's icon/z).
export function hideEditor(): void {
  editorPane.classList.add("collapsed")
  document.body.classList.add("editor-collapsed")
  refreshEditorLayout()
  window.dispatchEvent(new CustomEvent("crumb:layout-resized"))
}

document.getElementById("editor-collapse")!.addEventListener("click", hideEditor)
editorReopen?.addEventListener("click", () => openEditor())

// Mobile: a single top-right toggle swaps between editor (code) and map views.
document.getElementById("editor-mobile-toggle")?.addEventListener("click", () => {
  editorPane.classList.contains("collapsed") ? openEditor() : hideEditor()
})
// The whole collapsed rail is a hit target for expanding. Ignore the edge
// buttons themselves — they own their click, and bubbling here would otherwise
// undo a just-applied collapse.
editorPane.addEventListener("click", e => {
  if ((e.target as HTMLElement).closest(".editor-edge-btn")) return
  if (editorPane.classList.contains("collapsed")) openEditor()
})

// ─── File → New (blank document) ───────────────────────────────────────────────

document.getElementById("menu-new")!.addEventListener("click", () => {
  closeAll()
  loadDoc("", null, false)
  focusEditor()
})

// ─── File → Open… (a .crumb file from disk) ────────────────────────────────────

document.getElementById("menu-open")!.addEventListener("click", () => {
  closeAll()
  openFileInput.click()
})

openFileInput.addEventListener("change", async () => {
  const file = openFileInput.files?.[0]
  openFileInput.value = ""   // allow re-opening the same file
  if (!file) return
  loadDoc(await file.text(), null, true)
})

// ─── File → Save (to browser storage) ──────────────────────────────────────────

document.getElementById("menu-save")!.addEventListener("click", () => {
  closeAll()
  const source = getValue().trim()
  if (!source) return
  const name = window.__CRUMB_DATA?.trip?.name ?? "Untitled"
  saveEntry(name, source)
  setCurrentSavedName(name)
  refreshRecentList()
})

// ─── File → Export → Download .crumb ───────────────────────────────────────────

document.getElementById("menu-download")!.addEventListener("click", async () => {
  closeAll()
  const source = getValue().trim()
  if (!source) return
  const name     = window.__CRUMB_DATA?.trip?.name ?? "itinerary"
  const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + ".crumb"
  if ("showSaveFilePicker" in window) {
    try {
      const fh = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Crumb file", accept: { "application/yaml": [".crumb"] } }],
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
  const blob = new Blob([source], { type: "application/yaml" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
})

// ─── File → Export → Generate map embed ────────────────────────────────────────

const embedCtrl = bindModal(embedModal, ["embed-close-x", "embed-close"])

// An <iframe> pointing at this site's embed.html, with a tiny script that passes
// the current crumb in via the embed-boot handshake (crumb:ready → crumb:load).
// The closing tag is written as <\/script> so this literal never breaks out of
// the editor.html <script> it is inlined into.
function buildEmbedSnippet(): string {
  const embedUrl = new URL("embed.html", location.href).href
  const crumb    = getValue()
  return `<iframe src="${embedUrl}" width="100%" height="480" loading="lazy" style="border:0;border-radius:12px"></iframe>
<script>
(function(){var f=document.currentScript.previousElementSibling,c=${JSON.stringify(crumb)};
window.addEventListener("message",function(e){if(e.source===f.contentWindow&&e.data&&e.data.type==="crumb:ready")
f.contentWindow.postMessage({type:"crumb:load",crumb:c},"*");});})();
<\/script>`
}

document.getElementById("menu-embed")!.addEventListener("click", () => {
  closeAll()
  if (!getValue().trim()) return
  embedSnippet.value = buildEmbedSnippet()
  embedCtrl.open()
  setTimeout(() => { embedSnippet.focus(); embedSnippet.select() }, 50)
})

document.getElementById("embed-copy-btn")!.addEventListener("click", e => {
  const btn = e.currentTarget as HTMLButtonElement
  copyText(embedSnippet.value, () => flashCopied(btn))
})

// ─── File → Revert changes ─────────────────────────────────────────────────────

revertMenuItem.addEventListener("click", () => {
  closeAll()
  if (loadedBaseline === null) return
  setValue(loadedBaseline)
  render()
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
    refreshRecentList()
  }
  loadDoc("", null, false)
  deleteCtrl.close()
})

// ─── Undo / Redo ───────────────────────────────────────────────────────────────

document.getElementById("menu-undo")!.addEventListener("click", () => { editorUndo(); focusEditor() })
document.getElementById("menu-redo")!.addEventListener("click", () => { editorRedo(); focusEditor() })

// ─── Deep link: editor.html?example=<file> ─────────────────────────────────────
// Pre-loads the live editor with a bundled example (the landing page's cards link
// here). Renders straight to the map; the editor stays one click away.
{
  const exParam = new URLSearchParams(location.search).get("example")
  const src = exParam ? (window.__CRUMB_EXAMPLES ?? {})[exParam] : undefined
  if (src) loadDoc(src, null, true)
}

// ─── File → Generate with AI ───────────────────────────────────────────────────

const generateCtrl = bindModal(generateModal, ["generate-close-x", "generate-close"])

document.getElementById("menu-generate")!.addEventListener("click", () => {
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

document.getElementById("copy-prompt-btn")!.addEventListener("click", e => {
  const btn = e.currentTarget as HTMLButtonElement
  copyText(aiPrompt(), () => flashCopied(btn))
})

// ─── Clipboard helpers ─────────────────────────────────────────────────────────

function flashCopied(btn: HTMLButtonElement): void {
  const t = btn.textContent
  btn.textContent = "Copied!"
  setTimeout(() => { btn.textContent = t }, 1500)
}
