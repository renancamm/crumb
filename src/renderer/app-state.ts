import type { CrumbDocument, Place } from "../types/resolved"
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
    __CRUMB_EXAMPLES?: Record<string, string>
    // Always present:
    __CRUMB_DATA:     CrumbDocument | null
    __CRUMB_POPUPS:   Record<string, string>
    Crumb: {
      parse:               (src: string) => CrumbDocument
      renderItineraryBody: (doc: CrumbDocument) => string
      renderTripPanel:        (doc: CrumbDocument) => string
      renderPlacePanel:       (doc: CrumbDocument, placeIdx: number) => string
      renderSinglePlacePanel: (doc: CrumbDocument) => string
      renderTransportPanel:   (doc: CrumbDocument, transportIdx: number) => string
      renderModalContent:  (doc: CrumbDocument, modal: ModalRef) => string
      buildPopupMeta:      (doc: CrumbDocument) => Record<string, string>
    }
  }
}

declare const maplibregl: any

// ─── Constants ────────────────────────────────────────────────────────────────

export const ZOOM_OVERVIEW  = 8
export const ZOOM_DETAIL    = 12
export const ZOOM_PLACE_FLY = 10
export const ZOOM_DETAIL_FLY = 14
export const MOBILE_MAX_W   = 768
export const ROUTE_COLOR    = "#18181b"

// ─── Focus type ───────────────────────────────────────────────────────────────

export type FocusType = "place" | "activity" | "stay" | "hub"

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
  focusedHubName:   null as string | null,

  activePlaceIndex: null as number | null, // null = trip level, N = place level (1-based)
  activeModal:      null as ModalRef | null,
  activeDetail:     null as ModalRef | null, // desktop sidebar detail view

  DATA:       window.__CRUMB_DATA as CrumbDocument,
  POPUP_META: window.__CRUMB_POPUPS,

  geoIndex: {
    places:      [null] as Array<GeoResult | null>,
    activities:  new Map<string, GeoResult>(),
    stays:       new Map<string, GeoResult>(),
    hubs:        new Map<string, GeoResult>(),
    actsFailed:  new Set<string>(),
    staysFailed: new Set<string>(),
  },
}
