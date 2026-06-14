/**
 * Bottom-sheet snap behaviour for the mobile sidebar.
 *
 * Three snap states (heights from the SHEET_* constants in app-state.ts):
 *   peek   — handle + title + a hint of the first row (footer pager lives in its own fixed bar)
 *   medium — 50 % of the viewport
 *   full   — 90 % of the viewport
 *
 * The sheet is a fixed-height element (full height) anchored at bottom: 0 and
 * moved between states with `transform: translateY` — GPU-composited, so snaps
 * stay smooth and the sheet's own height never changes (no per-frame reflow, no
 * sticky-header flicker during expansion).
 *
 * There is no draggable handle. Expansion/collapse is driven entirely by scroll
 * gestures on #panel-content, which remains its own native scroll container:
 *   - When not at full height, a vertical drag moves the sheet (content scroll is
 *     intercepted from the first move, so native scroll never competes).
 *   - At full height, content scrolls natively; a downward drag while already at
 *     the scroll top collapses the sheet instead.
 * On release the sheet snaps: a flick (release velocity over FLICK_VELOCITY) jumps one
 * state in the flick direction; a slow drag settles to the nearest of the three heights.
 *
 * goMedium() is called by navigation on depth changes (trip ↔ place ↔ detail)
 * and on map-background taps.
 *
 * Sets --sheet-h on :root (the live visible sheet height) so map controls and
 * mapPadding() can track the sheet. Sets --sheet-anim to 0ms during a gesture
 * (instant control tracking) and restores it on snap, so controls animate with
 * the sheet on snap.
 */

import { SHEET_PEEK_H, SHEET_MEDIUM_RATIO, SHEET_FULL_RATIO } from "./app-state"

// cubic-bezier(0.32, 0.72, 0, 1) = iOS-style decelerate spring for bottom sheet snap
const TRANSITION = "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)"
const CTRL_ANIM  = "300ms cubic-bezier(0.32, 0.72, 0, 1)"
const FLICK_VELOCITY = 0.4  // px/ms — release speed above which a drag counts as a flick

type SnapState = "peek" | "medium" | "full"
const SNAP_ORDER: readonly SnapState[] = ["peek", "medium", "full"]

let sheet:   HTMLElement | null = null
let content: HTMLElement | null = null
let footer:  HTMLElement | null = null

let curH      = 0
let snapState: SnapState = "medium"

let gesture: "undecided" | "sheet" | "scroll" = "undecided"
let startY  = 0
let startX  = 0
let startH  = 0
let lastY   = 0   // most recent touch Y / time — for release velocity (flick detection)
let lastT   = 0
let velocity = 0  // px/ms, positive = moving down

const root = document.documentElement

function peekH():   number { return SHEET_PEEK_H }
function mediumH(): number { return window.innerHeight * SHEET_MEDIUM_RATIO }
function fullH():   number { return window.innerHeight * SHEET_FULL_RATIO }

function heightFor(s: SnapState): number {
  return s === "full" ? fullH() : s === "medium" ? mediumH() : peekH()
}

function goState(s: SnapState): void {
  snapState = s
  animate(heightFor(s))
}

/** Move the sheet so that `h` px are visible above the viewport bottom. */
function setSheetH(h: number): void {
  curH = h
  if (sheet) sheet.style.transform = `translateY(${fullH() - h}px)`
  root.style.setProperty("--sheet-h", `${h}px`)
  // Fully expanded → map is a sliver; let CSS hide the attribution "i" until it collapses.
  document.body.classList.toggle("sheet-full", h >= fullH() - 1)
}

function animate(h: number): void {
  root.style.setProperty("--sheet-anim", CTRL_ANIM)
  if (sheet) sheet.style.transition = TRANSITION
  setSheetH(h)
}

export function goPeek():     void { if (sheet) goState("peek") }
export function goMedium():    void { if (sheet) goState("medium") }
export function expandFull():  void { if (sheet) goState("full") }

export function initSheet(): void {
  sheet   = document.getElementById("sidebar")!
  content = document.getElementById("panel-content")!
  footer  = document.getElementById("panel-footer")

  // The pager becomes a persistent bar fixed to the viewport bottom. It must live
  // outside #sidebar, whose `transform` would otherwise make `position: fixed`
  // resolve against the sheet instead of the viewport.
  if (footer) document.body.appendChild(footer)

  content.addEventListener("touchstart", onTouchStart, { passive: true })
  content.addEventListener("touchmove",  onTouchMove,  { passive: false })
  content.addEventListener("touchend",   onTouchEnd)
  content.addEventListener("touchcancel", onTouchEnd)
  content.addEventListener("wheel",      onWheel,      { passive: false })

  window.addEventListener("resize", onResize)

  // Full height is the sheet's fixed CSS height; start at medium.
  sheet.style.height = `${fullH()}px`
  goMedium()
}

/** Called when viewport leaves mobile breakpoint — clears inline styles so desktop CSS takes over. */
export function exitSheet(): void {
  if (sheet) {
    sheet.style.transform  = ""
    sheet.style.transition = ""
    sheet.style.height     = ""
  }
  root.style.removeProperty("--sheet-h")
  root.style.removeProperty("--sheet-anim")
  document.body.classList.remove("sheet-full")
  if (content) {
    content.removeEventListener("touchstart", onTouchStart)
    content.removeEventListener("touchmove",  onTouchMove)
    content.removeEventListener("touchend",   onTouchEnd)
    content.removeEventListener("touchcancel", onTouchEnd)
    content.removeEventListener("wheel",      onWheel)
  }
  window.removeEventListener("resize", onResize)
  // Restore the pager into the sheet (last child) for desktop's in-flow layout.
  if (footer && sheet) sheet.appendChild(footer)
  sheet   = null
  content = null
  footer  = null
}

function onResize(): void {
  if (!sheet) return
  sheet.style.height = `${fullH()}px`
  setSheetH(heightFor(snapState))
}

/**
 * Snap on release. A flick (release speed over FLICK_VELOCITY) jumps one detent in its
 * direction from where the sheet currently sits; a slow drag settles to the nearest.
 */
function settle(): void {
  const nearest = SNAP_ORDER.reduce((a, b) =>
    Math.abs(heightFor(a) - curH) <= Math.abs(heightFor(b) - curH) ? a : b)
  const idx = SNAP_ORDER.indexOf(nearest)
  if (velocity < -FLICK_VELOCITY)     goState(SNAP_ORDER[Math.min(idx + 1, SNAP_ORDER.length - 1)]) // flick up → expand
  else if (velocity > FLICK_VELOCITY) goState(SNAP_ORDER[Math.max(idx - 1, 0)])                     // flick down → collapse
  else                                goState(nearest)
}

// ── Scroll-driven gesture on #panel-content ──────────────────────────────────
// Decide on the first move whether the gesture moves the sheet or scrolls the
// content, then lock that decision for the whole touch (avoids the native-scroll
// vs JS-drag race that made the old handoff stutter).

function onTouchStart(e: TouchEvent): void {
  gesture  = "undecided"
  startY   = e.touches[0].clientY
  startX   = e.touches[0].clientX
  startH   = curH
  lastY    = startY
  lastT    = e.timeStamp
  velocity = 0
}

function onTouchMove(e: TouchEvent): void {
  if (!sheet || !content) return
  const y  = e.touches[0].clientY
  const dy = y - startY // positive = finger moving down
  const dx = e.touches[0].clientX - startX

  const dt = e.timeStamp - lastT
  if (dt > 0) velocity = (y - lastY) / dt // px/ms, positive = downward
  lastY = y
  lastT = e.timeStamp

  if (gesture === "undecided") {
    if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return // not enough movement yet
    if (Math.abs(dx) > Math.abs(dy)) { gesture = "scroll"; return } // horizontal → leave it

    if (snapState !== "full") {
      gesture = "sheet"
    } else if (content.scrollTop <= 0 && dy > 0) {
      gesture = "sheet"          // at top, pulling down → collapse the sheet
    } else {
      gesture = "scroll"         // expanded: scroll content natively
    }

    if (gesture === "sheet") {
      sheet.style.transition = "none"
      root.style.setProperty("--sheet-anim", "0ms") // controls track instantly during drag
    }
  }

  if (gesture === "sheet") {
    e.preventDefault()
    setSheetH(Math.max(peekH(), Math.min(startH - dy, fullH())))
  }
}

function onTouchEnd(): void {
  if (gesture === "sheet") settle()
  gesture = "undecided"
}

// ── Wheel / trackpad: move the sheet continuously (desktop / phone emulation) ──
// Unified scroll, like a native bottom sheet: scrolling DOWN grows the sheet and, once
// full, reads the content; scrolling UP scrolls the content back to the top and then
// collapses the sheet. The sheet follows the wheel 1:1 (no snapping) and rests wherever
// it's left.
function onWheel(e: WheelEvent): void {
  if (!sheet || !content) return
  const atFull = curH >= fullH() - 1

  // When fully open, the content scrolls natively until it reaches the relevant edge.
  if (atFull) {
    if (e.deltaY > 0) return                              // down → read further into the list
    if (e.deltaY < 0 && content.scrollTop > 0) return     // up, content below top → scroll back up
    // up while content is already at the top → fall through and start collapsing
  }

  e.preventDefault()
  sheet.style.transition = "none"
  root.style.setProperty("--sheet-anim", "0ms")           // controls track instantly
  setSheetH(Math.max(peekH(), Math.min(curH + e.deltaY, fullH()))) // down grows, up shrinks
  // keep snapState in sync with the resting height (used by onResize / touch start)
  snapState = curH >= fullH() - 1 ? "full" : curH <= peekH() + 1 ? "peek" : "medium"
}
