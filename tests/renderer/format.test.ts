import { describe, it, expect } from "vitest"
import {
  formatHHMM,
  activityLabel,
  formatDurValue,
  formatDuration,
  formatPlainDateRange,
  escape,
  jsonForScript,
  formatShortDate,
  formatISODate,
} from "../../src/renderer/format"
import type { ResolvedMoment } from "../../src/types/resolved"

// ─── formatHHMM ──────────────────────────────────────────────────────────────

describe("formatHHMM", () => {
  it("formats afternoon time", () => expect(formatHHMM("14:30")).toBe("2:30 PM"))
  it("formats noon", ()          => expect(formatHHMM("12:00")).toBe("12 PM"))
  it("formats midnight", ()      => expect(formatHHMM("00:00")).toBe("12 AM"))
  it("formats morning", ()       => expect(formatHHMM("08:00")).toBe("8 AM"))
  it("formats with minutes", ()  => expect(formatHHMM("09:15")).toBe("9:15 AM"))
  it("formats 1am", ()           => expect(formatHHMM("01:00")).toBe("1 AM"))
  it("formats 23:59", ()         => expect(formatHHMM("23:59")).toBe("11:59 PM"))
})

// ─── activityLabel ────────────────────────────────────────────────────────────

describe("activityLabel", () => {
  it("returns A for index 0",   () => expect(activityLabel(0)).toBe("A"))
  it("returns Z for index 25",  () => expect(activityLabel(25)).toBe("Z"))
  it("returns A2 for index 26", () => expect(activityLabel(26)).toBe("A2"))
  it("returns Z2 for index 51", () => expect(activityLabel(51)).toBe("Z2"))
  it("returns A3 for index 52", () => expect(activityLabel(52)).toBe("A3"))
  it("returns B for index 1",   () => expect(activityLabel(1)).toBe("B"))
})

// ─── formatDurValue ──────────────────────────────────────────────────────────

describe("formatDurValue", () => {
  it("formats minutes under 60",      () => expect(formatDurValue(30, "minutes")).toBe("30m"))
  it("formats exact hours",           () => expect(formatDurValue(60, "minutes")).toBe("1h"))
  it("formats hours with remainder",  () => expect(formatDurValue(90, "minutes")).toBe("1h 30m"))
  it("formats 150 minutes",           () => expect(formatDurValue(150, "minutes")).toBe("2h 30m"))
  it("singularises unit for value 1", () => expect(formatDurValue(1, "nights")).toBe("1 night"))
  it("keeps plural for value > 1",    () => expect(formatDurValue(2, "nights")).toBe("2 nights"))
  it("formats days",                  () => expect(formatDurValue(3, "days")).toBe("3 days"))
  it("singularises day",              () => expect(formatDurValue(1, "days")).toBe("1 day"))
  it("formats hours (non-minutes)",   () => expect(formatDurValue(2, "hours")).toBe("2 hours"))
})

// ─── formatDuration ──────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats exact duration",       () => expect(formatDuration({ type: "exact",       value: 2, unit: "hours",  label: "2h"            })).toBe("2 hours"))
  it("formats approximate duration", () => expect(formatDuration({ type: "approximate", value: 3, unit: "days",   label: "~3 days"       })).toBe("3 days"))
  it("formats minimum duration",     () => expect(formatDuration({ type: "minimum",     value: 1, unit: "hours",  label: "at least 1h"   })).toBe("1 hour+"))
  it("formats range duration",       () => expect(formatDuration({ type: "range",       min: 2, max: 3, unit: "hours", label: "2-3h"    })).toBe("2–3 hours"))
  it("falls back to label for named",() => expect(formatDuration({ type: "named",       span: "all day", estimate: { value: 10, unit: "hours" }, label: "all day" })).toBe("all day"))
  it("falls back to label for unknown", () => expect(formatDuration({ type: "unknown",  label: "a while" })).toBe("a while"))
})

// ─── escape ───────────────────────────────────────────────────────────────────

describe("escape", () => {
  it("escapes angle brackets", () => expect(escape("<script>")).toBe("&lt;script&gt;"))
  it("escapes ampersands",     () => expect(escape("a & b")).toBe("a &amp; b"))
  it("escapes double quotes",  () => expect(escape('"quoted"')).toBe("&quot;quoted&quot;"))
  it("escapes single quotes",  () => expect(escape("it's")).toBe("it&#39;s"))
  it("passes safe text through", () => expect(escape("Hello World")).toBe("Hello World"))
})

// ─── jsonForScript ─────────────────────────────────────────────────────────────

describe("jsonForScript", () => {
  it("escapes < so </script> cannot break out of an inline script", () => {
    const out = jsonForScript("</script><img src=x onerror=alert(1)>")
    expect(out).not.toContain("<")
    expect(out).toContain("\\u003c")
  })

  it("escapes the U+2028 / U+2029 line separators", () => {
    const out = jsonForScript("a\u2028b\u2029c")
    expect(out).toContain("\\u2028")
    expect(out).toContain("\\u2029")
    expect(out).not.toContain("\u2028")
    expect(out).not.toContain("\u2029")
  })

  it("round-trips back to the original value via JSON.parse", () => {
    const doc = { trip: { name: "</script>\u2028end", tags: ["<b>", "x & y"] } }
    expect(JSON.parse(jsonForScript(doc))).toEqual(doc)
  })

  it("leaves safe payloads unchanged from JSON.stringify", () => {
    expect(jsonForScript({ a: 1, b: "hi" })).toBe(JSON.stringify({ a: 1, b: "hi" }))
  })
})

// ─── formatShortDate / formatISODate ─────────────────────────────────────────

describe("formatShortDate", () => {
  it("formats to month day", () => expect(formatShortDate("2026-09-18")).toBe("Sep 18"))
  it("formats first of month", () => expect(formatShortDate("2026-01-01")).toBe("Jan 1"))
})

describe("formatISODate", () => {
  it("includes year", () => expect(formatISODate("2026-09-18")).toBe("Sep 18, 2026"))
})

// ─── formatPlainDateRange ─────────────────────────────────────────────────────

function moment(iso: string): ResolvedMoment {
  return { date: { precision: "absolute", value: iso }, label: iso }
}

describe("formatPlainDateRange", () => {
  it("produces compact same-month range", () => {
    expect(formatPlainDateRange(moment("2026-09-18"), moment("2026-09-25"))).toBe("Sep 18–25")
  })

  it("produces cross-month range", () => {
    expect(formatPlainDateRange(moment("2026-09-28"), moment("2026-10-05"))).toBe("Sep 28–Oct 5")
  })

  it("returns arrives only when departs is null", () => {
    expect(formatPlainDateRange(moment("2026-09-18"), null)).toBe("Sep 18")
  })

  it("returns departs only when arrives is null", () => {
    expect(formatPlainDateRange(null, moment("2026-09-25"))).toBe("Sep 25")
  })

  it("returns empty string when both are null", () => {
    expect(formatPlainDateRange(null, null)).toBe("")
  })
})
