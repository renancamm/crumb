// ─── Shared primitives ────────────────────────────────────────────────────────

export type TransportMode =
  | "train" | "flight" | "bus" | "car"
  | "ferry" | "walk"  | "bike" | "transport"

export type GroupKind = "day" | "week" | "plan"

export type Priority = "must" | "maybe"

export type DurationUnit = "minutes" | "hours" | "days" | "nights" | "weeks"

export type NamedSpan = "all day" | "half day" | "overnight"

export type LoosePeriod =
  | "early morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "late afternoon"
  | "evening"
  | "night"
  | "late night"
  | "midnight"

export interface MetadataItem {
  key:   string
  value: string | number
}

// ─── Raw Data Model (Pass 1 output) ───────────────────────────────────────────

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
  timezone?:  string
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

// ─── Output Data Model (Pass 3 output) ────────────────────────────────────────

export interface Anchor {
  date?:      string
  offset?:    number
  precedence: "transit" | "place" | "stay" | "explicit" | "inferred"
}

export type TimeOfDay =
  | { precision: "exact"; value: string }
  | { precision: "loose"; value: LoosePeriod; estimate: string }

export type DateRef =
  | { precision: "absolute"; value: string }
  | { precision: "relative"; value: string }

export interface ResolvedMoment {
  date?:   DateRef
  time?:   TimeOfDay
  anchor?: Anchor
  label:   string
}

export interface DurationEstimate {
  value: number
  unit:  DurationUnit
}

export type ResolvedDuration =
  | { type: "exact";             value: number; unit: DurationUnit; label: string }
  | { type: "approximate";       value: number; unit: DurationUnit; label: string }
  | { type: "minimum";           value: number; unit: DurationUnit; label: string }
  | { type: "range";             min: number; max: number; unit: DurationUnit; label: string }
  | { type: "named";             span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-approximate"; span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-minimum";     span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-range";       min: NamedSpan; max: NamedSpan; minEstimate: DurationEstimate; maxEstimate: DurationEstimate; label: string }
  | { type: "unknown";           label: string }

export interface ResolvedGeolocation {
  label:              string
  geocodingDisabled?: true
  name?:              string
  address?:           string
  lat?:               number
  lng?:               number
}

export interface Activity {
  type:      "activity"
  name:      string
  priority?: Priority
  tags?:     string[]
  time?:     ResolvedMoment
  duration?: ResolvedDuration
  location?: ResolvedGeolocation
  info?:     MetadataItem[]
  note?:     string
}

export interface UngroupedActivities {
  type:  "ungrouped"
  items: Activity[]
}

export interface ActivityGroup {
  type:      "group"
  kind:      GroupKind
  title?:    string
  time?:     ResolvedMoment
  duration?: ResolvedDuration
  items:     Activity[]
}

export type ActivityItem = UngroupedActivities | ActivityGroup

export interface Stay {
  name:      string
  arrives?:  ResolvedMoment
  departs?:  ResolvedMoment
  duration?: ResolvedDuration
  location?: ResolvedGeolocation
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}

export interface Place {
  type:       "place"
  name:       string
  arrives?:   ResolvedMoment
  departs?:   ResolvedMoment
  duration?:  ResolvedDuration
  timezone?:  string
  location?:  ResolvedGeolocation
  tags?:      string[]
  stay?:      Stay[]
  activities: ActivityItem[]
  info?:      MetadataItem[]
  note?:      string
}

export interface TransportLeg {
  type:      "transport"
  mode:      TransportMode
  from?:     ResolvedGeolocation
  to?:       ResolvedGeolocation
  departs?:  ResolvedMoment
  arrives?:  ResolvedMoment
  duration?: ResolvedDuration
  info?:     MetadataItem[]
  note?:     string
}

export interface TripMeta {
  name?:   string
  author?: string
  tags?:   string[]
  info?:   MetadataItem[]
  note?:   string
}

export type ItineraryItem = Place | TransportLeg

export interface CrumbDocument {
  trip?:     TripMeta
  itinerary: ItineraryItem[]
}
