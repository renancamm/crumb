/**
 * Docs page interactivity (esbuild IIFE, injected into docs.html). Dependency-free
 * DOM wiring only — it must NOT import markdown.ts (a build-time/node module).
 *
 * Jobs:
 *   • doc switching — the sidebar's doc list is always visible; clicking a doc (or a
 *     heading) shows its `.doc-section` and swaps the active "On this page" TOC;
 *   • breadcrumb — Docs / {doc} / {current heading}, updated on switch + scroll;
 *   • scrollspy — highlight the TOC link for the heading nearest the top;
 *   • actions — Copy guide / Download .md (raw Markdown baked in __CRUMB_DOCS_RAW);
 *   • mobile drawer — the hamburger opens the sidebar; backdrop / link / Esc close it.
 *
 * Deep links from the landing (docs.html#doc-embedding, …) are honoured on load.
 */
import { copyText } from "../../shared/clipboard"

interface RawDoc { md: string; name: string }
const RAW: Record<string, RawDoc> =
  (window as unknown as { __CRUMB_DOCS_RAW?: Record<string, RawDoc> }).__CRUMB_DOCS_RAW ?? {}

const TOPBAR_OFFSET = 64   // sticky top bar height (56) + a little breathing room

const nav      = document.getElementById("docs-nav")
const crumbs   = document.getElementById("docs-crumbs")
const menuBtn  = document.getElementById("docs-menu-btn")
const backdrop = document.getElementById("docs-backdrop")
const crumbDoc = document.getElementById("crumb-doc")
const crumbHead    = document.getElementById("crumb-head")
const crumbHeadSep = document.getElementById("crumb-head-sep")
const tocLabel = document.getElementById("docs-toc-label")

const docLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".docs-doc"))
const sections = Array.from(document.querySelectorAll<HTMLElement>(".doc-section"))
const tocLists = Array.from(document.querySelectorAll<HTMLUListElement>(".docs-toc"))
const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".docs-toc-link"))
const linkByTarget = new Map(tocLinks.map(a => [a.dataset.target!, a]))

// ── Mobile drawer ─────────────────────────────────────────────────────────────
function openDrawer():  void { document.body.classList.add("docs-nav-open");  menuBtn?.setAttribute("aria-expanded", "true") }
function closeDrawer(): void { document.body.classList.remove("docs-nav-open"); menuBtn?.setAttribute("aria-expanded", "false") }

menuBtn?.addEventListener("click", () =>
  document.body.classList.contains("docs-nav-open") ? closeDrawer() : openDrawer())
backdrop?.addEventListener("click", closeDrawer)
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer() })

// ── Doc switching ─────────────────────────────────────────────────────────────
function activeDocId(): string | undefined {
  return sections.find(s => s.classList.contains("is-active"))?.id
}

function activateDoc(docId: string): void {
  if (!document.getElementById(docId)) return
  sections.forEach(s => s.classList.toggle("is-active", s.id === docId))
  docLinks.forEach(a => a.classList.toggle("is-active", a.dataset.doc === docId))
  tocLists.forEach(u => u.classList.toggle("is-active", u.dataset.doc === docId))
  const activeToc = tocLists.find(u => u.dataset.doc === docId)
  if (tocLabel) tocLabel.hidden = !activeToc || activeToc.children.length === 0
  if (crumbDoc) crumbDoc.textContent = docLinks.find(a => a.dataset.doc === docId)?.textContent ?? ""
}

function setCurrentHeading(slug: string | null): void {
  tocLinks.forEach(a => a.classList.toggle("is-current", a.dataset.target === slug))
  const text = slug ? linkByTarget.get(slug)?.textContent ?? "" : ""
  // The base rule hides .docs-crumb--head, so set an explicit display (not "") to
  // reveal it — inline-block lets the heading ellipsis when the topbar is tight.
  if (crumbHead)    { crumbHead.textContent = text; crumbHead.style.display = text ? "inline-block" : "none" }
  if (crumbHeadSep) crumbHeadSep.style.display = text ? "inline" : "none"
}

/** Navigate to a section container id or a heading slug, switching docs as needed. */
function goToTarget(target: string, smooth = false): void {
  const el = document.getElementById(target)
  if (!el) return
  const docId = el.closest<HTMLElement>(".doc-section")?.id ?? target
  activateDoc(docId)
  const isContainer = el.classList.contains("doc-section")

  // Let layout settle (the section just toggled from display:none) before scrolling.
  requestAnimationFrame(() => {
    if (isContainer) {
      window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" })
    } else {
      const y = el.getBoundingClientRect().top + window.scrollY - TOPBAR_OFFSET
      window.scrollTo({ top: y, behavior: smooth ? "smooth" : "auto" })
    }
    setCurrentHeading(isContainer ? null : target)
  })
  history.replaceState(null, "", `#${target}`)
}

function onNavClick(e: Event): void {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-target]")
  if (!a) return
  e.preventDefault()
  goToTarget(a.dataset.target!, true)
  closeDrawer()
}
nav?.addEventListener("click", onNavClick)
crumbs?.addEventListener("click", onNavClick)

// ── Actions: Copy guide / Download .md ────────────────────────────────────────
function flash(btn: HTMLElement, msg: string): void {
  const prev = btn.textContent
  btn.textContent = msg
  setTimeout(() => { btn.textContent = prev }, 1500)
}

document.addEventListener("click", e => {
  const copyBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-copy]")
  if (copyBtn) {
    const raw = RAW[copyBtn.dataset.copy!]
    if (raw) copyText(raw.md, () => flash(copyBtn, "Copied!"))
    return
  }
  const dlBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-download]")
  if (dlBtn) {
    const raw = RAW[dlBtn.dataset.download!]
    if (!raw) return
    const url = URL.createObjectURL(new Blob([raw.md], { type: "text/markdown" }))
    const a = document.createElement("a")
    a.href = url; a.download = raw.name; a.click()
    URL.revokeObjectURL(url)
  }
})

// ── Scrollspy ─────────────────────────────────────────────────────────────────
// Only the active doc's headings are laid out (others are display:none), so
// observing every heading is enough — hidden ones never intersect.
const headings = Array.from(document.querySelectorAll<HTMLElement>(".doc-section :is(h2, h3)[id]"))
const visible  = new Set<string>()

const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (e.isIntersecting) visible.add(e.target.id)
    else visible.delete(e.target.id)
  }
  let bestId: string | null = null
  let bestTop = Infinity
  visible.forEach(id => {
    const top = document.getElementById(id)?.getBoundingClientRect().top ?? Infinity
    if (top < bestTop) { bestTop = top; bestId = id }
  })
  if (bestId) setCurrentHeading(bestId)
}, { rootMargin: `-${TOPBAR_OFFSET}px 0px -70% 0px`, threshold: 0 })

headings.forEach(h => io.observe(h))

// ── Deep links ─────────────────────────────────────────────────────────────────
function fromHash(smooth = false): void {
  const target = decodeURIComponent(location.hash.slice(1))
  if (target && document.getElementById(target)) goToTarget(target, smooth)
}
// Sync chrome to the server-rendered default, then honour any incoming hash.
activateDoc(activeDocId() ?? docLinks[0]?.dataset.doc ?? "")
fromHash()
window.addEventListener("hashchange", () => fromHash(true))
