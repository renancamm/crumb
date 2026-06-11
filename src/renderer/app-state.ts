import type { CrumbDocument } from "../types/resolved"
import type { GeoResult } from "./geocoder"

export interface ModalRef {
  type: "trip" | "transport" | "stay" | "activity"
  placeIdx: number | null
  itemIdx: number
}

// ─── Window globals (set by html.ts before the bundle runs) ───────────────────

declare global {
  interface Window {
    // Editor-mode only (undefined in viewer-only output):
    __CRUMB_SOURCE?:   string
    __CRUMB_SPEC?:     string
    __CRUMB_FOR_AI?:   string
    __CRUMB_EXAMPLES?: Record<string, string>
    // Always present:
    __CRUMB_DATA:     CrumbDocument | null
    // Optional baked geocoding cache ({ query: {lat,lng} }) and opt-out flag.
    // When present (and mode !== "online"), the viewer seeds localStorage so
    // known places resolve with zero network requests.
    __CRUMB_GEO_DATA?: Record<string, GeoResult>
    __CRUMB_GEO_MODE?: "online" | "static"
    // Embed mode: a self-contained, host-friendly render. The map starts with
    // interactions locked (so a host page scrolls past it) and offers an
    // expand→fullscreen control. A host loads a crumb at runtime via
    // embed.html?src=… or postMessage({ type: "crumb:load", src, geo }).
    __CRUMB_EMBED?:      boolean
    Crumb: {
      // Present only in editor-mode output; the viewer-only bundle omits `parse`.
      // Safe because the editor bundle (its sole caller) ships only alongside it.
      parse:               (src: string) => CrumbDocument
      renderTripHeader:       (doc: CrumbDocument, opts?: { compact?: boolean }) => string
      renderTripPanel:        (doc: CrumbDocument) => string
      renderPlacePanel:       (doc: CrumbDocument, placeIdx: number) => string
      renderSinglePlacePanel: (doc: CrumbDocument) => string
      renderTransportPanel:   (doc: CrumbDocument, transportIdx: number) => string
      renderModalContent:  (doc: CrumbDocument, modal: ModalRef) => string
    }
  }
}

declare const maplibregl: any

// ─── Constants ────────────────────────────────────────────────────────────────

export const ZOOM_OVERVIEW   = 8
export const ZOOM_DETAIL     = 12
export const ZOOM_PLACE_FLY  = 10
export const ZOOM_DETAIL_FLY = 14
export const MOBILE_MAX_W    = 768
export const ROUTE_COLOR     = "#18181b"   // intentionally matches --primary in css.ts
export const FLY_DURATION    = 800         // ms — map camera animation on focus/navigation

// Embed mode: locked-interaction preview map + expand→fullscreen, host-swappable
// document. True when html.ts injected window.__CRUMB_EMBED.
export const EMBED = typeof window !== "undefined" && !!window.__CRUMB_EMBED

// Bottom-sheet snap geometry (single source of truth for app-sheet.ts + app-map.ts).
// CSS in css.ts mirrors these as pre-JS first-paint placeholders (90vh / 40vh) — keep
// them in sync by hand.
export const SHEET_PEEK_H      = 156   // px — handle + title + a hint of the first row
export const SHEET_MEDIUM_RATIO = 0.5  // fraction of viewport height
export const SHEET_FULL_RATIO   = 0.9

// ─── Focus type ───────────────────────────────────────────────────────────────

export type FocusType = "place" | "activity" | "stay" | "transport"

// ─── Shared mutable state ─────────────────────────────────────────────────────
// All modules import this object and mutate fields directly.

export const state = {
  map:           null as any,
  mapReady:      false,
  pendingDoc:    null as CrumbDocument | null,
  placeMarkers:  [] as any[],
  detailMarkers: [] as any[],
  geocodeEpoch:  0,

  focusedPlaceIdx:  -1 as number,
  focusedActName:   null as string | null,
  focusedStayName:  null as string | null,
  focusedTransportName:   null as string | null,

  activePlaceIndex: null as number | null, // null = trip level, N = place level (1-based)
  activeModal:      null as ModalRef | null,
  activeDetail:     null as ModalRef | null, // desktop sidebar detail view

  DATA:       window.__CRUMB_DATA as CrumbDocument,

  geoIndex: {
    places:       [null] as Array<GeoResult | null>,
    activities:   new Map<string, GeoResult>(),
    stays:        new Map<string, GeoResult>(),
    transports:         new Map<string, GeoResult>(),
    placesFailed: new Set<number>(),
    actsFailed:   new Set<string>(),
    staysFailed:  new Set<string>(),
    transportsFailed: new Set<string>(),
  },
}
