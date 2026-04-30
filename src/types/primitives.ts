// ─── Shared primitives ────────────────────────────────────────────────────────
// Scalar types and enums referenced by both the raw and resolved layers.

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

export interface TripMeta {
  name?:     string
  author?:   string
  duration?: string
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}
