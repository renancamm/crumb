# Crumb Output Data Model

The output data model is the contract between the parser and any tool that consumes a Crumb document. A fully parsed document is a `CrumbDocument` value. The parser has resolved all authored date expressions, assembled activity groups, and inferred transport endpoints and activity anchors where possible. Optional fields may still be absent — consuming tools should treat all optional fields as nullable.

The model is defined as TypeScript interfaces. The TypeScript files in `src/types/` are canonical. If this document diverges from those files, the TypeScript files win.

```typescript
// ─── Primitives ──────────────────────────────────────────────────────────────

type TransportMode =
  | "train" | "flight" | "bus" | "car"
  | "ferry" | "walk"  | "bike" | "transport"

type GroupKind = "day" | "week" | "plan"

type Priority = "must" | "maybe"

type DurationUnit = "minutes" | "hours" | "days" | "nights" | "weeks"

// ─── Anchor ──────────────────────────────────────────────────────────────────
//
// A parser-inferred date context attached to a ResolvedMoment.
// Never authored — discard to round-trip back to source.
//
// Set whenever a date can be inferred from context — not only when
// date.precision is "relative", but also when date is absent entirely
// (e.g. a time-only value like "morning" inside a resolved day group).
// The only case that never carries an anchor is date.precision "absolute".
//
// date:   YYYY-MM-DD — set when a calendar date can be resolved.
// offset: 1-based ordinal day from the start of the itinerary — set in
//         relative-only itineraries where no calendar date is available.
//         At least one of date or offset is always present.
//
// precedence records which source provided the anchor. Higher-precedence
// anchors always win in a conflict:
//   "transit"  — transport leg departs/arrives             (highest)
//   "place"    — place arrives/departs
//   "stay"     — stay arrives/departs
//   "explicit" — activity group with authored or injected date
//   "inferred" — duration arithmetic                       (lowest)

interface Anchor {
  date?:       string                             // YYYY-MM-DD
  offset?:     number                             // 1-based day ordinal from itinerary start
  precedence:  "transit" | "place" | "stay" | "explicit" | "inferred"
}

// ─── LoosePeriod ─────────────────────────────────────────────────────────────
//
// Canonical named period values. No synonyms are accepted — input must
// exactly match one of these values.
//
// estimate is an HH:MM string used for chronological sorting. Loose and
// exact times share the same coordinate space — compare estimate against
// an exact HH:MM value to order them on the same day.
// All estimates are on the same anchor date — no day-crossing is applied.

type LoosePeriod =
  | "early morning"   // estimate 06:00
  | "morning"         // estimate 09:00
  | "midday"          // estimate 12:00
  | "afternoon"       // estimate 14:30
  | "late afternoon"  // estimate 17:00
  | "evening"         // estimate 19:30
  | "night"           // estimate 22:00
  | "late night"      // estimate 02:00
  | "midnight"        // estimate 23:59

// ─── TimeOfDay ───────────────────────────────────────────────────────────────
//
// exact:  normalised 24h clock time. Any authored format (9am, 9:00 AM,
//         09:00) normalises to "HH:MM". Use value directly for sorting.
//         utcOffset is present only when the authored string carried an explicit
//         UTC offset (e.g. "2026-06-01T10:00+09:00" → utcOffset "+09:00").
//         "Z" is normalised to "+00:00". Use utcOffset for cross-timezone
//         arithmetic (e.g. flight duration); display value as local time.
//
// loose:  a canonical LoosePeriod with a parser-assigned estimate for
//         sorting. The original label is preserved in ResolvedMoment.label.

type TimeOfDay =
  | { precision: "exact"; value: string; utcOffset?: string }
  | { precision: "loose"; value: LoosePeriod; estimate: string }

// ─── DateRef ─────────────────────────────────────────────────────────────────
//
// absolute: a resolved calendar date. Always "YYYY-MM-DD".
//
// approximate: a parser-assigned midpoint calendar date for fuzzy human
//              expressions ("early October 2026", "fall 2026", "around March 15").
//              estimate is always "YYYY-MM-DD" — use it for calendar arithmetic only.
//              The original authored text is preserved in ResolvedMoment.label.
//              Never carries an Anchor — estimate is already a resolved calendar date.
//
// relative: the authored value preserved exactly — "Day 1", "1st day",
//           "first day", "last day", "next day", "next week", "Monday",
//           "Week 2", "September 15" (year-less), "September 2026"
//           (month+year), "September" (month-only), etc.
//           Never collapsed into an absolute date. An Anchor may accompany
//           a relative DateRef on ResolvedMoment when a date can be inferred.

type DateRef =
  | { precision: "absolute";    value: string }
  | { precision: "approximate"; estimate: string }
  | { precision: "relative";    value: string }

// ─── ResolvedMoment ──────────────────────────────────────────────────────────
//
// date and time are independent and both optional. Any combination is valid:
//
//   date only             "2026-09-15"              → { date: absolute }
//   human date with year  "September 15, 2026"      → { date: absolute }
//   human date no year    "September 15"            → { date: relative }
//   month and year        "September 2026"          → { date: relative }
//   month only            "September"               → { date: relative }
//   time only             "9am"                     → { time: exact "09:00" }
//   loose time only       "morning"                 → { time: loose "morning" }
//   date + exact time     "2026-09-15T09:00"        → { date: absolute, time: exact }
//   human date + time     "September 15 at 9am"     → { date: absolute, time: exact }
//   date + loose time     "Monday morning"          → { date: relative, time: loose }
//   relative only         "Day 1"                   → { date: relative }
//
// anchor: set whenever a date can be inferred from context. Present when
//         date.precision is "relative" OR when date is absent entirely.
//         Never present when date.precision is "absolute" or "approximate"
//         (both already carry a resolved calendar date).
//         Parser-inferred — never authored. Discard to round-trip back to source.
//
// label: the original input string, always preserved. Sufficient on its own
//        to reconstruct the crumb. Use for display or round-tripping.

interface ResolvedMoment {
  date?:   DateRef
  time?:   TimeOfDay
  anchor?: Anchor
  label:   string
}

// ─── NamedSpan ───────────────────────────────────────────────────────────────

type NamedSpan = "all day" | "half day" | "overnight"

// ─── DurationEstimate ────────────────────────────────────────────────────────
//
// Parser-assigned numeric estimate for a named span.
// Used internally for anchoring, ordering, and timeline estimation.
// Never displayed to the user.
//
//   "all day"  → { value: 10, unit: "hours" }
//   "half day" → { value: 5,  unit: "hours" }
//   "overnight"→ { value: 1,  unit: "nights" }

interface DurationEstimate {
  value: number
  unit:  DurationUnit
}

// ─── ResolvedDuration ────────────────────────────────────────────────────────
//
// Discriminated union. "unknown" is the fallback for unrecognised strings —
// label is always preserved so a renderer can still display the original.

type ResolvedDuration =
  | { type: "exact";            value: number;  unit: DurationUnit; label: string }
  | { type: "approximate";      value: number;  unit: DurationUnit; label: string }
  | { type: "minimum";          value: number;  unit: DurationUnit; label: string }
  | { type: "range";            min: number; max: number; unit: DurationUnit; label: string }
  | { type: "named";            span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-approximate"; span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-minimum";    span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-range";      min: NamedSpan; max: NamedSpan; minEstimate: DurationEstimate; maxEstimate: DurationEstimate; label: string }
  | { type: "unknown";          label: string }

// ─── ResolvedGeolocation ─────────────────────────────────────────────────────
//
// label:              safe display string in all cases. Set to the original plain
//                     string when written in string form; otherwise name ?? address ?? coords.
//
// geocodingDisabled:  true when the author wrote `location: none`. Renderers must
//                     not attempt to geocode this location. Absent otherwise.
//
// lat/lng:            always present as a pair or not at all.

interface ResolvedGeolocation {
  label:               string
  geocodingDisabled?:  true
  name?:               string
  address?:            string
  lat?:                number
  lng?:                number
}

// ─── MetadataItem ────────────────────────────────────────────────────────────

interface MetadataItem {
  key:   string
  value: string | number
}

// ─── Activity ────────────────────────────────────────────────────────────────
//
// type:     "activity" — discriminator consistent with all other output types.
// priority: only present when explicitly set by the author.

interface Activity {
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

// ─── UngroupedActivities ─────────────────────────────────────────────────────
//
// Wraps all standalone activities for a place into a single container.
// Only emitted when at least one standalone activity exists.
// Always the first item in Place.activities when present.

interface UngroupedActivities {
  type:  "ungrouped"
  items: Activity[]
}

// ─── ActivityGroup ───────────────────────────────────────────────────────────
//
// kind "day":  default time "next day" injected by Pass 3 step 3.3 when
//              no time is authored. duration present only when explicitly
//              authored.
// kind "week": default time "next week" injected by Pass 3 step 3.3 when
//              no time is authored. duration present only when explicitly
//              authored.
// kind "plan": not affected by time injection. Does not participate in
//              next day/next week sequencing.
//              duration present only when explicitly authored.

interface ActivityGroup {
  type:       "group"
  kind:       GroupKind
  title?:     string
  time?:      ResolvedMoment
  duration?:  ResolvedDuration
  items:      Activity[]
}

type ActivityItem = UngroupedActivities | ActivityGroup

// ─── Stay ────────────────────────────────────────────────────────────────────

interface Stay {
  name:      string
  arrives?:  ResolvedMoment
  departs?:  ResolvedMoment
  duration?: ResolvedDuration
  location?: ResolvedGeolocation
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}

// ─── Place ───────────────────────────────────────────────────────────────────
//
// activities: always an array, possibly empty. UngroupedActivities, if present,
//             is always first. Remaining groups follow in source order.
//
// When arrives/departs and duration are both present, arrives/departs
//   take precedence. duration is only used when no explicit dates exist.
//
// When a stay also carries arrives/departs, the place dates define the
//   overall visit window and the stay dates define the accommodation window.

interface Place {
  type:       "place"
  name:       string
  arrives?:   ResolvedMoment
  departs?:   ResolvedMoment
  duration?:  ResolvedDuration
  location?:  ResolvedGeolocation
  tags?:      string[]
  stay?:      Stay[]
  activities: ActivityItem[]
  info?:      MetadataItem[]
  note?:      string
}

// ─── TransportLeg ────────────────────────────────────────────────────────────
//
// from/to: inferred from neighbouring places in the itinerary when omitted.
//          Absent when inference is not possible.

interface TransportLeg {
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

// ─── Document root ───────────────────────────────────────────────────────────

interface ResolvedTripMeta {
  name?:     string
  author?:   string
  duration?: ResolvedDuration
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}

type ItineraryItem = Place | TransportLeg

interface CrumbDocument {
  trip?:     ResolvedTripMeta
  itinerary: ItineraryItem[]  // always an array; empty if no itinerary key present
}
```
