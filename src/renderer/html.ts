/**
 * HTML Renderer
 *
 * Transforms a CrumbDocument into a self-contained HTML page.
 * All styles are inline — no external dependencies.
 */

import {
  Activity,
  ActivityGroup,
  ActivityItem,
  CrumbDocument,
  MetadataItem,
  Place,
  ResolvedDuration,
  ResolvedGeolocation,
  ResolvedMoment,
  Stay,
  TransportLeg,
  TripMeta,
  UngroupedActivities,
} from "../types"

// ─── Entry point ─────────────────────────────────────────────────────────────

export function renderHtml(doc: CrumbDocument): string {
  const title = doc.trip?.name ?? "Itinerary"
  const body  = renderBody(doc)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>`
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export function renderItineraryBody(doc: CrumbDocument): string {
  return renderBody(doc)
}

function renderBody(doc: CrumbDocument): string {
  const parts: string[] = []

  if (doc.trip) {
    parts.push(renderTripHeader(doc.trip))
  }

  parts.push('<div class="itinerary">')
  let placeIndex = 0
  for (const item of doc.itinerary) {
    if (item.type === "place") {
      parts.push(renderPlace(item, ++placeIndex))
    } else {
      parts.push(renderTransportLeg(item))
    }
  }
  parts.push("</div>")

  return parts.join("\n")
}

// ─── Trip header ─────────────────────────────────────────────────────────────

function renderTripHeader(meta: TripMeta): string {
  const parts: string[] = []

  parts.push(`<header class="trip-header">`)
  parts.push(`  <h1>${escape(meta.name ?? "Itinerary")}</h1>`)

  const meta2: string[] = []
  if (meta.author) meta2.push(`<span class="author">by ${escape(meta.author)}</span>`)
  if (meta.tags?.length) {
    meta2.push(meta.tags.map(t => `<span class="tag">${escape(t)}</span>`).join(""))
  }
  if (meta2.length) {
    parts.push(`  <div class="trip-meta">${meta2.join(" ")}</div>`)
  }

  if (meta.note) {
    parts.push(`  <p class="note">${renderMarkdown(meta.note)}</p>`)
  }

  if (meta.info?.length) {
    parts.push(renderInfoList(meta.info, "  "))
  }

  parts.push("</header>")
  return parts.join("\n")
}

// ─── Place ───────────────────────────────────────────────────────────────────

function renderPlace(place: Place, index = 0): string {
  const parts: string[] = []

  parts.push(`<div class="place" data-place-index="${index}">`)

  // Header
  const badge = index > 0 ? `<span class="place-num">${index}</span>` : ""
  parts.push(`  <div class="place-header">`)
  parts.push(`    <h2 class="place-name">${badge}${escape(place.name)}</h2>`)

  // Date/duration line
  const dateLine = renderPlaceDateLine(place)
  if (dateLine) {
    parts.push(`    <div class="place-dates">${dateLine}</div>`)
  }

  if (place.timezone) {
    parts.push(`    <div class="place-tz">${escape(place.timezone)}</div>`)
  }

  parts.push(`  </div>`)

  // Tags
  if (place.tags?.length) {
    parts.push(`  <div class="tags">${place.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  }

  // Note
  if (place.note) {
    parts.push(`  <div class="note">${renderMarkdown(place.note)}</div>`)
  }

  // Stay
  if (place.stay?.length) {
    parts.push(renderStays(place.stay))
  }

  // Info
  if (place.info?.length) {
    parts.push(renderInfoList(place.info, "  "))
  }

  // Activities
  if (place.activities.length > 0) {
    parts.push(`  <div class="activities">`)
    for (const actItem of place.activities) {
      if (actItem.type === "ungrouped") {
        parts.push(renderUngrouped(actItem))
      } else {
        parts.push(renderActivityGroup(actItem))
      }
    }
    parts.push(`  </div>`)
  }

  parts.push(`</div>`)
  return parts.join("\n")
}


function renderPlaceDateLine(place: Place): string {
  const parts: string[] = []

  if (place.arrives && place.departs) {
    const a = formatMomentDate(place.arrives)
    const d = formatMomentDate(place.departs)
    if (a && d) parts.push(`${a} – ${d}`)
    else if (a) parts.push(`from ${a}`)
  } else if (place.arrives) {
    const a = formatMomentDate(place.arrives)
    if (a) parts.push(`arrives ${a}`)
  } else if (place.departs) {
    const d = formatMomentDate(place.departs)
    if (d) parts.push(`departs ${d}`)
  }

  if (place.duration) {
    parts.push(formatDuration(place.duration))
  }

  return parts.join(" · ")
}

// ─── Transport leg ────────────────────────────────────────────────────────────

function renderTransportLeg(leg: TransportLeg): string {
  const mode  = formatMode(leg.mode)
  const icon  = modeIcon(leg.mode)
  const from  = leg.from  ? leg.from.label  : null
  const to    = leg.to    ? leg.to.label    : null
  const route = from && to ? ` ${escape(from)} → ${escape(to)}` : from ? ` from ${escape(from)}` : to ? ` to ${escape(to)}` : ""

  const times: string[] = []
  if (leg.departs) {
    const t = formatMoment(leg.departs)
    if (t) times.push(`departs ${t}`)
  }
  if (leg.arrives) {
    const t = formatMoment(leg.arrives)
    if (t) times.push(`arrives ${t}`)
  }
  if (leg.duration) times.push(formatDuration(leg.duration))

  const timeLine = times.length ? `<span class="transport-times">${times.join(" · ")}</span>` : ""

  const infoLines: string[] = []
  if (leg.info?.length) {
    for (const item of leg.info) {
      infoLines.push(`<span class="info-item"><span class="info-key">${escape(String(item.key))}</span> ${escape(String(item.value))}</span>`)
    }
  }
  const infoStr = infoLines.length ? `<div class="transport-info">${infoLines.join("")}</div>` : ""
  const noteStr = leg.note ? `<div class="transport-note">${renderMarkdown(leg.note)}</div>` : ""

  return `<div class="transport">
  <span class="transport-icon">${icon}</span>
  <span class="transport-mode">${escape(mode)}</span>
  <span class="transport-route">${route}</span>
  ${timeLine}
  ${infoStr}
  ${noteStr}
</div>`
}

function formatMode(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

function modeIcon(mode: string): string {
  const icons: Record<string, string> = {
    train:     "🚄",
    flight:    "✈️",
    bus:       "🚌",
    car:       "🚗",
    ferry:     "⛴️",
    walk:      "🚶",
    bike:      "🚴",
    transport: "🚌",
  }
  return icons[mode] ?? "🚌"
}

// ─── Stays ───────────────────────────────────────────────────────────────────

function renderStays(stays: Stay[]): string {
  const parts: string[] = []
  parts.push(`  <div class="stays">`)

  for (const stay of stays) {
    const dateParts: string[] = []
    if (stay.arrives) {
      const a = formatMoment(stay.arrives)
      if (a) dateParts.push(`check-in ${a}`)
    }
    if (stay.departs) {
      const d = formatMoment(stay.departs)
      if (d) dateParts.push(`check-out ${d}`)
    }
    const dateStr = dateParts.length ? ` <span class="stay-dates">${dateParts.join(" · ")}</span>` : ""
    const noteStr = stay.note ? ` <span class="stay-note">${renderMarkdown(stay.note)}</span>` : ""

    let infoStr = ""
    if (stay.info?.length) {
      const infoParts = stay.info.map(i =>
        `<span class="info-item"><span class="info-key">${escape(String(i.key))}</span> ${escape(String(i.value))}</span>`
      )
      infoStr = ` <div class="stay-info">${infoParts.join("")}</div>`
    }

    parts.push(`    <div class="stay">🏨 <span class="stay-name">${escape(stay.name)}</span>${dateStr}${infoStr}${noteStr}</div>`)
  }

  parts.push(`  </div>`)
  return parts.join("\n")
}

// ─── Activities ───────────────────────────────────────────────────────────────

function renderUngrouped(container: UngroupedActivities): string {
  const items = container.items.map(a => renderActivityItem(a, false)).join("\n")
  return `    <ul class="activity-list ungrouped">${items}</ul>`
}

function renderActivityGroup(group: ActivityGroup): string {
  const parts: string[] = []

  const isPlan = group.kind === "plan"
  const cls    = isPlan ? "activity-group plan-group" : "activity-group"

  parts.push(`    <div class="${cls}">`)

  // Group header
  const kindLabel = isPlan ? "Plan" : group.kind === "week" ? "Week" : "Day"
  const dateStr   = !isPlan && group.time ? formatGroupDate(group.time) : null
  const title     = group.title ?? null

  let headerText = kindLabel
  if (title) headerText = title
  if (dateStr) headerText += ` <span class="group-date">— ${escape(dateStr)}</span>`

  if (isPlan && title) {
    parts.push(`      <div class="group-header plan-header">${escape(title)}</div>`)
  } else {
    parts.push(`      <div class="group-header">${headerText}</div>`)
  }

  if (group.items.length > 0) {
    const items = group.items.map(a => renderActivityItem(a, true)).join("\n")
    parts.push(`      <ul class="activity-list">${items}</ul>`)
  }

  parts.push(`    </div>`)
  return parts.join("\n")
}

function renderActivityItem(act: Activity, indented: boolean): string {
  const priority = act.priority
  const dot = priority === "must"  ? `<span class="dot must" title="Must do">●</span>`
            : priority === "maybe" ? `<span class="dot maybe" title="Maybe">○</span>`
            : `<span class="dot none">·</span>`

  const nameParts: string[] = [`<span class="act-name">${escape(act.name)}</span>`]

  if (act.time) {
    const t = formatMomentTime(act.time)
    if (t) nameParts.push(`<span class="act-time">${escape(t)}</span>`)
  }
  if (act.duration) {
    nameParts.push(`<span class="act-duration">${escape(formatDuration(act.duration))}</span>`)
  }
  if (act.tags?.length) {
    const tags = act.tags.map(t => `<span class="tag small">${escape(t)}</span>`).join("")
    nameParts.push(tags)
  }
  if (act.note) {
    nameParts.push(`<div class="act-note">${renderMarkdown(act.note)}</div>`)
  }
  if (act.info?.length) {
    const info = act.info.map(i =>
      `<span class="info-item"><span class="info-key">${escape(String(i.key))}</span> ${escape(String(i.value))}</span>`
    ).join("")
    nameParts.push(`<div class="act-info">${info}</div>`)
  }

  const geoAttr = act.location && !act.location.geocodingDisabled
    ? ` data-act-name="${escape(act.name)}"`
    : ""
  return `<li class="activity-item"${geoAttr}>${dot} ${nameParts.join(" ")}</li>`
}

// ─── Info list ────────────────────────────────────────────────────────────────

function renderInfoList(info: MetadataItem[], indent: string): string {
  const items = info.map(i =>
    `${indent}  <div class="info-row"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`
  ).join("\n")
  return `${indent}<div class="info-list">\n${items}\n${indent}</div>`
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatMoment(m: ResolvedMoment): string {
  const parts: string[] = []
  if (m.date) parts.push(formatDateRef(m.date))
  if (m.time) parts.push(formatTime(m.time))
  return parts.join(" ")
}

function formatMomentDate(m: ResolvedMoment): string {
  if (!m.date) return ""
  return formatDateRef(m.date)
}

function formatMomentTime(m: ResolvedMoment): string {
  if (!m.time) return ""
  return formatTime(m.time)
}

function formatGroupDate(m: ResolvedMoment): string {
  if (m.date?.precision === "absolute") {
    return formatDateRef(m.date)
  }
  if (m.anchor?.date) {
    return formatISODate(m.anchor.date)
  }
  if (m.date) return formatDateRef(m.date)
  return ""
}

function formatDateRef(d: { precision: string; value: string }): string {
  if (d.precision === "absolute") {
    return formatISODate(d.value)
  }
  return d.value
}

function formatISODate(iso: string): string {
  // "2026-10-12" → "Oct 12, 2026"
  const [y, m, d] = iso.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[m - 1]} ${d}, ${y}`
}

function formatTime(t: { precision: string; value: string; estimate?: string }): string {
  if (t.precision === "exact") return formatHHMM(t.value)
  // Loose period
  return t.value
}

function formatHHMM(hhmm: string): string {
  // "14:30" → "2:30 PM"
  const [h, m] = hhmm.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12  = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

function formatDuration(d: ResolvedDuration): string {
  switch (d.type) {
    case "exact":
      return formatDurValue(d.value, d.unit)
    case "approximate":
      return `~${formatDurValue(d.value, d.unit)}`
    case "minimum":
      return `${formatDurValue(d.value, d.unit)}+`
    case "range":
      return `${d.min}–${d.max} ${d.unit}`
    case "named":
    case "named-approximate":
    case "named-minimum":
    case "named-range":
      return d.label
    case "unknown":
      return d.label
  }
}

function formatDurValue(value: number, unit: string): string {
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

// ─── Markdown (minimal) ───────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
}

// ─── Escape ───────────────────────────────────────────────────────────────────

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

export const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #f5f5f0;
  color: #1a1a1a;
  font-size: 15px;
  line-height: 1.5;
  padding: 32px 16px 64px;
}

.container {
  max-width: 680px;
  margin: 0 auto;
}

/* Trip header */
.trip-header {
  background: #fff;
  border-radius: 12px;
  padding: 28px 28px 24px;
  margin-bottom: 32px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.trip-header h1 {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -.3px;
  margin-bottom: 8px;
}
.trip-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
}
.author { color: #555; }

/* Itinerary */
.itinerary {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Place card */
.place {
  background: #fff;
  border-radius: 12px;
  padding: 22px 24px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
  margin-bottom: 2px;
}
.place-header { margin-bottom: 10px; }
.place-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 19px;
  font-weight: 600;
  margin-bottom: 4px;
}
.place-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px; height: 24px;
  background: #3b72d9;
  color: #fff;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}
.place-dates {
  font-size: 13px;
  color: #777;
}
.place-tz {
  font-size: 12px;
  color: #aaa;
  margin-top: 2px;
}

/* Transport connector */
.transport {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  background: #f0efeb;
  border-radius: 0;
  padding: 10px 24px;
  font-size: 13px;
  color: #666;
  margin-bottom: 2px;
}
.transport-icon { font-size: 14px; }
.transport-mode { font-weight: 500; color: #444; }
.transport-route { color: #555; }
.transport-times { color: #888; }
.transport-info, .transport-note {
  width: 100%;
  padding-left: 22px;
  font-size: 12px;
  color: #999;
}

/* Stays */
.stays { margin: 8px 0 12px; }
.stay {
  font-size: 13px;
  color: #666;
  padding: 6px 0;
  border-top: 1px solid #f0f0ec;
}
.stay-name { font-weight: 500; color: #444; }
.stay-dates { color: #999; margin-left: 6px; }
.stay-note { color: #888; font-style: italic; margin-left: 6px; }
.stay-info { margin-top: 4px; padding-left: 20px; }

/* Activities */
.activities { margin-top: 4px; }
.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.activity-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  padding: 5px 0;
  font-size: 14px;
  border-bottom: 1px solid #f5f5f0;
}
.activity-item:last-child { border-bottom: none; }

.dot { font-size: 10px; width: 14px; flex-shrink: 0; }
.dot.must  { color: #e06c00; }
.dot.maybe { color: #bbb; }
.dot.none  { color: #ddd; }

.act-name { flex: 1; min-width: 120px; }
.act-time { font-size: 12px; color: #888; }
.act-duration { font-size: 12px; color: #aaa; }
.act-note {
  width: 100%;
  padding-left: 20px;
  font-size: 13px;
  color: #888;
  font-style: italic;
  border-left: 2px solid #e8e8e4;
  margin: 2px 0 2px 0;
}
.act-info {
  width: 100%;
  padding-left: 20px;
  font-size: 12px;
  color: #999;
}

/* Activity groups */
.activity-group {
  margin: 10px 0;
  border-radius: 8px;
  background: #fafaf7;
  border: 1px solid #ebebe6;
  overflow: hidden;
}
.plan-group {
  border-style: dashed;
  border-color: #d8d8d2;
  background: #fdfdfb;
}
.group-header {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  padding: 8px 12px 6px;
  background: #f5f5f0;
  border-bottom: 1px solid #ebebe6;
}
.plan-header { color: #888; background: #fafaf7; }
.group-date { font-weight: 400; color: #888; }
.activity-group .activity-list { padding: 4px 12px 6px; }

.ungrouped .activity-item:first-child { border-top: none; }

/* Tags */
.tags { margin: 6px 0 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  display: inline-block;
  background: #f0efeb;
  color: #666;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 12px;
}
.tag.small { font-size: 11px; padding: 1px 5px; }

/* Notes */
.note {
  font-size: 13px;
  color: #777;
  font-style: italic;
  border-left: 3px solid #e0e0d8;
  padding-left: 10px;
  margin: 8px 0;
}

/* Info list */
.info-list { margin: 8px 0; font-size: 12px; color: #888; }
.info-row { display: flex; gap: 8px; padding: 2px 0; }
.info-key { font-weight: 500; color: #aaa; text-transform: lowercase; min-width: 80px; }
.info-val { color: #666; }
.info-item { margin-right: 10px; }
.info-item .info-key { color: #aaa; margin-right: 3px; }
`
