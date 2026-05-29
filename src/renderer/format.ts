/**
 * Formatting helpers
 *
 * Pure functions for displaying Crumb data types as human-readable strings.
 * No HTML-specific logic — reusable by any renderer.
 * Use createRenderContext() to get a pre-assembled RenderContext for use
 * with the CrumbRenderer interface.
 */

import type { DateRef, ResolvedDuration, ResolvedMoment, TimeOfDay } from "../types/resolved"
import type { RenderContext } from "./types"

// ─── Moment ──────────────────────────────────────────────────────────────────

export function formatMoment(m: ResolvedMoment): string {
  const parts: string[] = []
  if (m.date) parts.push(formatDateRef(m.date))
  if (m.time) parts.push(formatTime(m.time))
  return parts.join(" • ")
}

export function formatMomentDate(m: ResolvedMoment): string {
  if (!m.date) return ""
  if (m.date.precision === "approximate") return formatSmartDate(m.date.estimate)
  return formatDateRef(m.date)
}

export function formatMomentTime(m: ResolvedMoment): string {
  if (!m.time) return ""
  return formatTime(m.time)
}

/** For activity group headers: prefer authored relative label ("Day 3", weekday) over calendar date. */
export function formatGroupDate(m: ResolvedMoment): string {
  if (m.date?.precision === "relative") {
    const v = m.date.value
    if (/^(day\s+\d+|first day|last day)$/i.test(v)) return v
    if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(v)) {
      return v.charAt(0).toUpperCase() + v.slice(1)
    }
  }
  if (m.date?.precision === "absolute") return formatSmartDate(m.date.value)
  if (m.anchor?.date)                   return formatSmartDate(m.anchor.date)
  if (m.date?.precision === "approximate") return formatSmartDate(m.date.estimate)
  if (m.date)                           return m.date.value
  return ""
}

export function formatDateRef(d: DateRef): string {
  if (d.precision === "absolute")    return formatSmartDate(d.value)
  if (d.precision === "approximate") return formatSmartDate(d.estimate)
  return d.value
}

export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[m - 1]} ${d}, ${y}`
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[m - 1]} ${d}`
}

export function formatSmartDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const weekday = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday}, ${months[m - 1]} ${d}`
}

export function isInferredMoment(m: ResolvedMoment): boolean {
  return m.anchor?.precedence === "inferred"
}

export function formatTime(t: TimeOfDay): string {
  return t.precision === "exact" ? formatHHMM(t.value) : t.value
}

export function formatHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12  = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

// ─── Duration ────────────────────────────────────────────────────────────────

export function formatDuration(d: ResolvedDuration): string {
  switch (d.type) {
    case "exact":                                   return formatDurValue(d.value, d.unit)
    case "approximate":                             return formatDurValue(d.value, d.unit)
    case "minimum":                                 return `${formatDurValue(d.value, d.unit)}+`
    case "range":                                   return `${d.min}–${d.max} ${d.unit}`
    case "named":
    case "named-approximate":
    case "named-minimum":
    case "named-range":
    case "unknown":                                 return d.label
  }
}

export function formatDurValue(value: number, unit: string): string {
  if (unit === "minutes") {
    if (value >= 60) {
      const h = Math.floor(value / 60)
      const m = value % 60
      return m > 0 ? `${h}h ${m}m` : `${h}h`
    }
    return `${value}m`
  }
  const u = value === 1 ? unit.replace(/s$/, "") : unit
  return `${value} ${u}`
}

// ─── Transport ────────────────────────────────────────────────────────────────

export function formatMode(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

// ─── HTML escape ─────────────────────────────────────────────────────────────

export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Activity labels ─────────────────────────────────────────────────────────

/** Activity label: A–Z then A2–Z2, A3–Z3… */
export function activityLabel(idx: number, groupNum?: number): string {
  const letter = String.fromCharCode(65 + (idx % 26))
  if (groupNum != null) return `${letter}${groupNum}`
  const cycle = Math.floor(idx / 26) + 1
  return cycle > 1 ? `${letter}${cycle}` : letter
}

// ─── Date range ──────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

/** Extract the best ISO date string from a moment, or null if unavailable. */
export function isoFromMoment(m: ResolvedMoment): string | null {
  if (m.date?.precision === "absolute")    return m.date.value
  if (m.anchor?.date)                      return m.anchor.date
  if (m.date?.precision === "approximate") return m.date.estimate
  return null
}

/**
 * Plain-text date range for a place or stay (no HTML).
 * Produces compact same-month ranges ("Jan 15–20") or dash-joined cross-month
 * ranges ("Jan 15–Feb 3"). Falls back to individual dates if only one endpoint
 * is available.
 *
 * NOTE: For HTML output with inferred-date styling, use formatDateRange() in
 * html.ts instead. The two functions are intentionally separate.
 */
export function formatPlainDateRange(
  a: ResolvedMoment | null | undefined,
  d: ResolvedMoment | null | undefined,
): string {
  const aIso = a ? isoFromMoment(a) : null
  const dIso = d ? isoFromMoment(d) : null
  if (aIso && dIso) {
    const [, am, ad] = aIso.split("-").map(Number)
    const [, dm, dd] = dIso.split("-").map(Number)
    if (am === dm) return `${MONTHS[am - 1]} ${ad}–${dd}`
    return `${formatShortDate(aIso)}–${formatShortDate(dIso)}`
  }
  if (aIso) return formatShortDate(aIso)
  if (dIso) return formatShortDate(dIso)
  return ""
}

// ─── RenderContext factory ────────────────────────────────────────────────────

/** Create a RenderContext backed by the standard formatting helpers above. */
export function createRenderContext(): RenderContext {
  return {
    formatMoment,
    formatMomentDate,
    formatMomentTime,
    formatGroupDate,
    formatDuration,
    escape,
  }
}
