// ─── Shared primitives ────────────────────────────────────────────────────────
// The single source of truth for the closed vocabularies. Each vocabulary is a
// runtime `const` array; its TypeScript union type is derived from it, so the
// type and the runtime list can never drift apart. The parser imports these
// arrays directly, and the spec-sync test asserts the docs list exactly them.

export const TRANSPORT_MODES = [
  "train", "flight", "bus", "car", "ferry", "walk", "bike", "other",
] as const
export type TransportMode = typeof TRANSPORT_MODES[number]

export const GROUP_KINDS = ["day", "week", "group"] as const
export type GroupKind = typeof GROUP_KINDS[number]

export const PRIORITIES = ["must", "maybe"] as const
export type Priority = typeof PRIORITIES[number]

export type DurationUnit = "minutes" | "hours" | "days" | "nights" | "weeks"

export const NAMED_SPANS = ["all day", "half day", "overnight"] as const
export type NamedSpan = typeof NAMED_SPANS[number]

export const NAMED_PERIODS = [
  "early morning",
  "morning",
  "midday",
  "afternoon",
  "late afternoon",
  "evening",
  "night",
  "late night",
  "midnight",
] as const
export type LoosePeriod = typeof NAMED_PERIODS[number]

export const SEASONS = ["spring", "summer", "fall", "autumn", "winter"] as const

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
