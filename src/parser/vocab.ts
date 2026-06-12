/**
 * Crumb vocabulary — the recognized keys/fields for each kind of item.
 *
 * Single source of truth shared by:
 *   — pass1-classify.ts (rejects unknown keys/fields during parsing)
 *   — the editor's autocomplete (src/renderer/app-editor.ts)
 *
 * Keeping these here means editor completions can never drift from what the
 * parser actually accepts. Transport modes and group kinds live in
 * ../types/primitives (TRANSPORT_MODES / GROUP_KINDS) — reuse those for value
 * completion rather than duplicating them.
 */

export const TOP_LEVEL_KEYS   = ["trip", "itinerary"] as const
export const TRIP_FIELDS      = ["name", "author", "duration", "tags", "info", "note"] as const
export const PLACE_FIELDS     = ["arrives", "departs", "duration", "location", "tags", "plan", "info", "note"] as const
export const TRANSPORT_FIELDS = ["from", "to", "departs", "arrives", "duration", "info", "note"] as const
export const ACTIVITY_FIELDS  = ["priority", "tags", "time", "duration", "location", "info", "note"] as const
export const STAY_FIELDS      = ["arrives", "departs", "duration", "location", "tags", "info", "note"] as const
export const GROUP_FIELDS     = ["time", "duration", "plan"] as const
