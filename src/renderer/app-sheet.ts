/**
 * Bottom-sheet snap behaviour for the mobile sidebar.
 *
 * Three snap states:
 *   peek   — 160 px: handle + title + footer nav visible
 *   medium — 50 % of the viewport
 *   full   — 90 % of the viewport
 *
 * The sheet sits at bottom: 0 and its height animates between states.
 * Footer stays anchored at the viewport bottom in all states.
 *
 * Height changes are triggered two ways:
 *   1. Drag on #sheet-handle (pointer events, always intercepts).
 *   2. Touch on #panel-content: expands when not at full height; collapses
 *      when at full height and the scroll is already at the top.
 *
 * On release the sheet snaps to the nearest of the three heights.
 * goMedium() is called by navigation on depth changes (trip ↔ place ↔ detail)
 * and on map-background taps.
 *
 * Sets --sheet-h on :root so map controls can track the sheet height.
 * Sets --sheet-anim to 0ms during a height gesture (instant tracking) and
 * restores it on snap, so controls animate with the sheet on snap.
 */

// cubic-bezier(0.32, 0.72, 0, 1) = iOS-style decelerate spring for bottom sheet snap
const TRANSITION = "height 300ms cubic-bezier(0.32, 0.72, 0, 1)"
const CTRL_ANIM  = "300ms cubic-bezier(0.32, 0.72, 0, 1)"
const PEEK_H     = 160  // px — handle bar + one title line + footer nav row

type SnapState = "peek" | "medium" | "full"

let sheet:  HTMLElement | null = null
let handle: HTMLElement | null = null

let startY    = 0
let startH    = 0
let curH      = 0
let touching  = false
let snapState: SnapState = "medium"

let contentGesture: "undecided" | "height" | "scroll" = "undecided"
let contentStartY = 0
let contentStartH = 0

const root = document.documentElement

function peekH():   number { return PEEK_H }
function mediumH(): number { return window.innerHeight * 0.5 }
function fullH():   number { return window.innerHeight * 0.9 }

function setSheetH(h: number): void {
  if (sheet) sheet.style.height = `${h}px`
  root.style.setProperty("--sheet-h", `${h}px`)
}

function animate(h: number): void {
  root.style.setProperty("--sheet-anim", CTRL_ANIM)
  if (sheet) sheet.style.transition = TRANSITION
  setSheetH(h)
  setTimeout(() => {
    if (sheet) sheet.style.transition = ""
    document.dispatchEvent(new CustomEvent("crumb:sheet-snap"))
  }, 310)
}

export function goPeek(): void {
  if (!sheet) return
  snapState = "peek"
  curH      = peekH()
  animate(curH)
}

export function goMedium(): void {
  if (!sheet) return
  snapState = "medium"
  curH      = mediumH()
  animate(curH)
}

export function expandFull(): void {
  if (!sheet) return
  snapState = "full"
  curH      = fullH()
  animate(curH)
}

export function isExpanded(): boolean {
  return snapState === "full"
}

export function initSheet(): void {
  sheet  = document.getElementById("sidebar")!
  handle = document.getElementById("sheet-handle")!

  handle.addEventListener("pointerdown",   onStart)
  handle.addEventListener("pointermove",   onMove)
  handle.addEventListener("pointerup",     onEnd)
  handle.addEventListener("pointercancel", onEnd)

  const content = document.getElementById("panel-content")!
  initScrollExpansion(content)

  window.addEventListener("resize", () => {
    if (!sheet) return
    const target = snapState === "full" ? fullH() : snapState === "medium" ? mediumH() : peekH()
    curH = target
    setSheetH(curH)
  })

  goMedium()
}

/** Called when viewport leaves mobile breakpoint — clears inline styles so desktop CSS takes over. */
export function exitSheet(): void {
  if (sheet) sheet.style.height = ""
  root.style.removeProperty("--sheet-h")
  root.style.removeProperty("--sheet-anim")
  if (handle) {
    handle.removeEventListener("pointerdown",   onStart)
    handle.removeEventListener("pointermove",   onMove)
    handle.removeEventListener("pointerup",     onEnd)
    handle.removeEventListener("pointercancel", onEnd)
  }
  sheet  = null
  handle = null
}

function onStart(e: PointerEvent): void {
  if (!sheet || !handle) return
  touching = true
  startY   = e.clientY
  startH   = sheet.offsetHeight
  handle.setPointerCapture(e.pointerId)
  sheet.style.transition = "none"
  root.style.setProperty("--sheet-anim", "0ms")  // controls track instantly during drag
}

function onMove(e: PointerEvent): void {
  if (!touching || !sheet) return
  const dy = e.clientY - startY
  const h  = Math.max(peekH(), Math.min(startH - dy, fullH()))
  curH     = h
  setSheetH(h)
}

function snapToCurrent(): void {
  const states = [peekH(), mediumH(), fullH()] as const
  const target = states.reduce((a, b) => Math.abs(a - curH) <= Math.abs(b - curH) ? a : b)
  if (target === peekH())      goPeek()
  else if (target === fullH()) expandFull()
  else                         goMedium()
}

function onEnd(): void {
  if (!touching) return
  touching = false
  snapToCurrent()
}

function initScrollExpansion(content: HTMLElement): void {
  content.addEventListener("touchstart", (e: TouchEvent) => {
    contentStartY  = e.touches[0].clientY
    contentStartH  = curH
    contentGesture = "undecided"
  }, { passive: true })

  content.addEventListener("touchmove", (e: TouchEvent) => {
    const dy = e.touches[0].clientY - contentStartY // positive = finger down

    if (contentGesture === "undecided") {
      if (curH < fullH()) {
        contentGesture = "height"
      } else if (Math.abs(dy) > 4) {
        contentGesture = (dy > 0 && content.scrollTop === 0) ? "height" : "scroll"
      }
      if (contentGesture === "height") {
        if (sheet) sheet.style.transition = "none"
        root.style.setProperty("--sheet-anim", "0ms")
      }
    }

    if (contentGesture === "height") {
      e.preventDefault()
      curH = Math.max(peekH(), Math.min(contentStartH - dy, fullH()))
      setSheetH(curH)
    }
  }, { passive: false })

  content.addEventListener("touchend", () => {
    if (contentGesture === "height") snapToCurrent()
    contentGesture = "undecided"
  })
}
