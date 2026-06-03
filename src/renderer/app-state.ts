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
    Crumb: {
      parse:               (src: string) => CrumbDocument
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
