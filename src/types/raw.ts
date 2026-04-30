// ─── Raw Data Model (Pass 1 output) ──────────────────────────────────────────
// Parser-internal types. Nothing outside src/parser/ should import this file.

import {
  GroupKind,
  MetadataItem,
  TransportMode,
  TripMeta,
} from "./primitives"

export type RawMoment   = string
export type RawDuration = string

export type RawGeolocation =
  | string
  | { name?: string; address?: string; lat?: number; lng?: number }

export interface RawActivity {
  type:      "activity"
  name:      string
  priority?: string
  tags?:     string[]
  time?:     RawMoment
  duration?: RawDuration
  location?: RawGeolocation
  info?:     MetadataItem[]
  note?:     string
}

export interface RawActivityGroup {
  type:      "group"
  kind:      GroupKind
  title?:    string
  time?:     RawMoment
  duration?: RawDuration
  items:     RawActivity[]
}

export type RawActivityItem = RawActivity | RawActivityGroup

export interface RawStay {
  name:      string
  arrives?:  RawMoment
  departs?:  RawMoment
  duration?: RawDuration
  location?: RawGeolocation
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}

export interface RawPlace {
  type:       "place"
  name:       string
  arrives?:   RawMoment
  departs?:   RawMoment
  duration?:  RawDuration
  location?:  RawGeolocation
  tags?:      string[]
  stay?:      RawStay[]
  activities: RawActivityItem[]
  info?:      MetadataItem[]
  note?:      string
}

export interface RawTransportLeg {
  type:      "transport"
  mode:      TransportMode
  from?:     RawGeolocation
  to?:       RawGeolocation
  departs?:  RawMoment
  arrives?:  RawMoment
  duration?: RawDuration
  info?:     MetadataItem[]
  note?:     string
}

export type RawItineraryItem = RawPlace | RawTransportLeg

export interface RawCrumbDocument {
  trip?:     TripMeta
  itinerary: RawItineraryItem[]
}
