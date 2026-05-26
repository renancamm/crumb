/**
 * HTML Renderer
 *
 * Two exports for different use cases:
 *
 *   renderItineraryBody(doc) — pure content HTML, no shell, no CSS, no JS.
 *     Used by the browser bundle for live re-rendering after edits.
 *
 *   renderHtml(doc, options) — complete self-contained mini-app HTML.
 *     Split layout: editor panel (left, toggled) | sidebar list | map.
 *     Used by the CLI to produce the final output file.
 *
 * HtmlRenderer is the reference implementation of the CrumbRenderer plugin
 * interface — it shows third-party renderer authors what the contract looks like.
 */

import type { MetadataItem } from "../types/primitives"
import type {
  Activity,
  ActivityGroup,
  CrumbDocument,
  Place,
  ResolvedDuration,
  ResolvedMoment,
  ResolvedTripMeta,
  Stay,
  TransportLeg,
  UngroupedActivities,
} from "../types/resolved"
import { CSS } from "./css"
import { ICON_STAY, ICON_ARRIVES, ICON_DEPARTS, ICON_CLOCK, ICON_CORNER_DOWN_RIGHT, ICON_CORNER_UP_RIGHT, ICON_PLANE, ICON_TRAIN, ICON_BUS, ICON_CAR, ICON_SHIP, ICON_WALK, ICON_BIKE, ICON_ROUTE, ICON_GLOBE_OFF, ICON_PRIORITY_MUST, ICON_PRIORITY_MAYBE, modeIconSvg } from "./icons"
import {
  escape,
  formatDuration,
  formatDurValue,
  formatMode,
  formatMoment,
  formatMomentTime,
  formatSmartDate,
  formatShortDate,
  formatPlainDateRange,
  isoFromMoment,
  isInferredMoment,
  activityLabel,
} from "./format"
import type { CrumbRenderer, RenderContext } from "./types"

// ─── AppOptions ───────────────────────────────────────────────────────────────

export interface AppOptions {
  /** Original YAML source — embedded for the editor. */
  source: string
  /** Example files keyed by filename. */
  examples: Record<string, string>
  /** Esbuild bundle: parse + renderItineraryBody (sets window.Crumb). */
  parserBundle: string
  /** Esbuild bundle: map, geocoding, editor, UI interactions. */
  appBundle: string
  /** CRUMB_SPEC.md content for the "Download spec" button. Optional. */
  specContent?: string
}

// ─── Pure content render ──────────────────────────────────────────────────────

/**
 * Render only the itinerary HTML body — no wrapping shell, no CSS, no JS.
 * Injected into #list by the browser JS when live re-rendering.
 */
export function renderItineraryBody(doc: CrumbDocument): string {
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

// ─── Overview render (compact, no place body) ────────────────────────────────

/**
 * Render itinerary as compact place cards — no activities, stays, or notes.
 * Used as the default view when the app loads and after live re-renders.
 */
export function renderOverview(doc: CrumbDocument): string {
  const parts: string[] = []
  if (doc.trip) parts.push(renderTripHeader(doc.trip))
  parts.push('<div class="itinerary">')
  let placeIndex = 0
  for (const item of doc.itinerary) {
    if (item.type === "place") {
      parts.push(renderPlaceCard(item, ++placeIndex))
    } else {
      parts.push(renderTransportLeg(item))
    }
  }
  parts.push("</div>")
  return parts.join("\n")
}

function renderPlaceCard(place: Place, index: number): string {
  const { icon: placeGeoIcon } = renderGeoAttrs(place.location)
  const durHtml   = renderPlaceDuration(resolvePlaceDisplayDuration(place))
  const datesHtml = renderPlaceDates(place)
  const sep = (durHtml && datesHtml) ? `<span class="place-meta-sep">•</span>` : ""
  const metaHtml = (durHtml || datesHtml) ? `<div class="place-meta">${durHtml}${sep}${datesHtml}</div>` : ""
  return `<div class="place place--card" data-place-index="${index}">
  <div class="place-header">
    <span class="place-num">${index}</span>
    <div class="place-heading">
      <span class="place-name-text">${escape(place.name)}${placeGeoIcon}</span>
      ${metaHtml}
    </div>
    <span class="place-card-chevron">›</span>
  </div>
</div>`
}

// ─── Place detail render (full content, accordion days) ───────────────────────

/**
 * Render a single place with full detail: nav header, transport in/out, and
 * accordion day sections (first day open by default).
 */
export function renderPlaceDetail(doc: CrumbDocument, placeIdx: number): string {
  const places = doc.itinerary.filter(item => item.type === "place") as Place[]
  const place  = places[placeIdx - 1]
  if (!place) return renderOverview(doc)

  const totalPlaces = places.length
  let placePos = -1, pCount = 0
  for (let i = 0; i < doc.itinerary.length; i++) {
    if (doc.itinerary[i].type === "place") {
      pCount++
      if (pCount === placeIdx) { placePos = i; break }
    }
  }

  const transportIn  = placePos > 0 && doc.itinerary[placePos - 1].type !== "place"
    ? doc.itinerary[placePos - 1] as TransportLeg : null
  const transportOut = placePos >= 0 && placePos < doc.itinerary.length - 1 && doc.itinerary[placePos + 1].type !== "place"
    ? doc.itinerary[placePos + 1] as TransportLeg : null

  const prevAttr = placeIdx <= 1           ? " disabled" : ""
  const nextAttr = placeIdx >= totalPlaces ? " disabled" : ""

  const parts: string[] = []

  parts.push(`<button class="place-back-link" id="nav-back">
  <svg class="crumb-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>
  All places
</button>`)

  if (transportIn) {
    parts.push(`<div class="transport-in">${renderTransportLeg(transportIn)}</div>`)
  }

  parts.push('<div class="itinerary">')
  parts.push(renderPlaceFullDetail(place, placeIdx, totalPlaces, prevAttr, nextAttr))
  parts.push("</div>")

  if (transportOut) {
    parts.push(`<div class="transport-out">${renderTransportLeg(transportOut)}</div>`)
  }

  return parts.join("\n")
}

function renderPlaceFullDetail(place: Place, index: number, totalPlaces: number, prevAttr: string, nextAttr: string): string {
  const parts: string[] = []
  parts.push(`<div class="place" data-place-index="${index}">`)

  const { icon: placeGeoIcon, mapLink: placeMapLink } = renderGeoAttrs(place.location)
  const durHtml   = renderPlaceDuration(resolvePlaceDisplayDuration(place))
  const datesHtml = renderPlaceDates(place)
  parts.push(`  <div class="place-header place-header--detail">`)
  parts.push(`    <span class="place-num">${index}</span>`)
  parts.push(`    <div class="place-heading">`)
  parts.push(`      <span class="place-name-text"${placeMapLink}>${escape(place.name)}${placeGeoIcon}</span>`)
  if (durHtml || datesHtml) {
    const sep = (durHtml && datesHtml) ? `<span class="place-meta-sep">•</span>` : ""
    parts.push(`      <div class="place-meta">${durHtml}${sep}${datesHtml}</div>`)
  }
  parts.push(`    </div>`)
  parts.push(`    <div class="place-nav-controls">`)
  parts.push(`      <span class="place-nav-counter">${index} / ${totalPlaces}</span>`)
  parts.push(`      <button class="place-nav-arrow" id="nav-prev"${prevAttr}><svg class="crumb-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg></button>`)
  parts.push(`      <button class="place-nav-arrow" id="nav-next"${nextAttr}><svg class="crumb-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg></button>`)
  parts.push(`    </div>`)
  parts.push(`  </div>`)

  const bodyParts: string[] = []
  if (place.tags?.length)
    bodyParts.push(`<div class="tags">${place.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (place.note)
    bodyParts.push(`<div class="note place-note">${renderMarkdown(place.note)}</div>`)
  if (place.stay?.length)
    bodyParts.push(renderStays(place.stay))
  if (place.info?.length)
    bodyParts.push(renderInfoList(place.info, ""))
  if (place.activities.length > 0) {
    const actParts: string[] = [`<div class="activities">`]
    const counter = { n: 0 }
    let dayIdx = 0, weekIdx = 0
    for (const actItem of place.activities) {
      if (actItem.type === "ungrouped") {
        actParts.push(renderUngrouped(actItem, counter))
      } else {
        const gIdx = actItem.kind === "day"  ? ++dayIdx
                   : actItem.kind === "week" ? ++weekIdx
                   : 0
        actParts.push(renderActivityGroup(actItem, counter, gIdx))
      }
    }
    actParts.push(`</div>`)
    bodyParts.push(actParts.join("\n"))
  }

  if (bodyParts.length) {
    parts.push(`  <div class="place-body">`)
    parts.push(bodyParts.map(p => `    ${p}`).join("\n"))
    parts.push(`  </div>`)
  }

  parts.push(`</div>`)
  return parts.join("\n")
}


function renderInlineNote(text: string): string {
  const html = renderMarkdown(text)
  if (text.length <= 140) return html
  return `<span class="note-trunc">${html}</span><span class="note-more"> … more</span>`
}

// ─── Trip level renders ───────────────────────────────────────────────────────

/** Desktop panel content for the trip level. */
export function renderTripPanel(doc: CrumbDocument): string {
  const parts: string[] = []

  if (doc.trip) {
    const { name, duration, author, note, tags } = doc.trip
    const stickyDur = duration && duration.type !== "unknown" ? `<span class="sticky-bar-meta">${escape(formatDuration(duration))}</span>` : ""
    parts.push(`<div class="panel-sticky-bar"><span class="sticky-bar-name">${escape(name ?? "Itinerary")}</span>${stickyDur}</div>`)
    parts.push(`<div class="panel-trip-header">`)
    parts.push(`  <h1 class="panel-trip-name">${escape(name ?? "Itinerary")}</h1>`)
    if (duration && duration.type !== "unknown")
      parts.push(`  <div class="trip-duration">${escape(formatDuration(duration))}</div>`)
    else if (duration?.type === "unknown")
      parts.push(`  <div class="trip-duration"><span class="value-unknown">${escape(duration.label)}</span></div>`)
    if (tags?.length) parts.push(`  <div class="tags">${tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
    if (note) parts.push(`  <div class="note">${renderInlineNote(note)}</div>`)
    if (author) parts.push(`  <p class="trip-author">by ${escape(author)}</p>`)
    parts.push(`</div>`)
  }

  parts.push(`<ul class="panel-toc">`)
  let pIdx = 0, tIdx = 0
  for (const item of doc.itinerary) {
    if (item.type === "place") {
      const idx = ++pIdx
      const { icon: geoIcon } = renderGeoAttrs(item.location)
      const durStr = item.duration && item.duration.type !== "unknown" ? formatDuration(item.duration) : ""
      const dateStr = item.arrives && item.departs ? formatPlainDateRange(item.arrives, item.departs)
                    : item.arrives ? formatMoment(item.arrives)
                    : item.departs ? formatMoment(item.departs) : ""
      const metaParts = [durStr, dateStr].filter(Boolean)
      const metaHtml  = metaParts.length ? `<span class="list-item-meta">${metaParts.map(s => escape(s)).join(" · ")}</span>` : ""
      parts.push(
        `  <li class="list-item list-item--place" data-place-idx="${idx}">` +
        `<span class="place-num place-num--sm">${idx}</span>` +
        `<span class="list-item-body"><span class="list-item-label">${escape(item.name)}${geoIcon}</span>${metaHtml}</span></li>`
      )
    } else {
      const i    = tIdx++
      const icon = modeIconSvg(item.mode)
      const dur  = item.duration && item.duration.type !== "unknown" ? formatDuration(item.duration) : null
      const metaParts: string[] = []
      if (item.departs) metaParts.push(escape(formatMomentTime(item.departs)))
      if (item.arrives) metaParts.push(escape(formatMomentTime(item.arrives)))
      if (dur) metaParts.push(escape(dur))
      const metaHtml = metaParts.length ? `<span class="list-item-meta">${metaParts.join(" · ")}</span>` : ""
      parts.push(
        `  <li class="list-item list-item--transport" data-transport-idx="${i}">` +
        `<span class="transport-icon-wrap">${icon}</span>` +
        `<span class="list-item-body">` +
        `<span class="list-item-label transport-label">${escape(formatMode(item.mode))}</span>${metaHtml}</span></li>`
      )
    }
  }
  parts.push(`</ul>`)
  return parts.join("\n")
}

// ─── Place level renders ──────────────────────────────────────────────────────

/** Desktop panel content for a single place (placeIdx is 1-based). */
export function renderPlacePanel(doc: CrumbDocument, placeIdx: number): string {
  const places = doc.itinerary.filter(i => i.type === "place") as Place[]
  const place  = places[placeIdx - 1]
  if (!place) return ""

  const parts: string[] = []
  const { icon: geoIcon, mapLink: placeMapLink } = renderGeoAttrs(place.location)
  const durHtml   = renderPlaceDuration(resolvePlaceDisplayDuration(place))
  const datesHtml = renderPlaceDates(place)
  const sep       = (durHtml && datesHtml) ? `<span class="place-meta-sep">•</span>` : ""

  const metaLine = [durHtml, datesHtml].filter(Boolean).join(`<span class="place-meta-sep"> · </span>`)
  const stickyMeta = metaLine ? `<span class="sticky-bar-meta">${metaLine}</span>` : ""
  parts.push(
    `<div class="panel-sticky-bar">` +
    `<span class="place-num place-num--sm sticky-bar-badge">${placeIdx}</span>` +
    `<span class="sticky-bar-body"><span class="sticky-bar-name">${escape(place.name)}</span>${stickyMeta}</span>` +
    `<button class="panel-close sticky-bar-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` +
    `</div>`
  )
  parts.push(`<div class="panel-header">`)
  parts.push(`  <div class="panel-header-body">`)
  parts.push(`    <div class="panel-title-row">`)
  parts.push(`      <span class="place-num place-num--sm">${placeIdx}</span>`)
  parts.push(`      <div class="panel-title-body">`)
  parts.push(`        <h1 class="panel-place-name">${escape(place.name)}${geoIcon}</h1>`)
  if (metaLine) parts.push(`        <div class="trip-duration">${metaLine}</div>`)
  parts.push(`      </div>`)
  parts.push(`    </div>`)
  if (place.tags?.length) parts.push(`    <div class="tags">${place.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (place.note) parts.push(`    <div class="note panel-note">${renderInlineNote(place.note)}</div>`)
  parts.push(`  </div>`)
  parts.push(`  <button class="panel-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`)
  parts.push(`</div>`)

  parts.push(`<ul class="panel-toc">`)

  if (place.stay?.length) {
    place.stay.forEach((stay, sIdx) => {
      const dateStr = stay.arrives && stay.departs ? formatPlainDateRange(stay.arrives, stay.departs)
                    : stay.arrives ? formatMoment(stay.arrives)
                    : stay.departs ? formatMoment(stay.departs) : ""
      const metaHtml = dateStr ? `<span class="list-item-meta">${escape(dateStr)}</span>` : ""
      parts.push(
        `  <li class="list-item list-item--stay" data-stay-idx="${sIdx}" data-stay-name="${escape(stay.name)}">` +
        `<span class="stay-icon-wrap">${ICON_STAY}</span>` +
        `<span class="list-item-body"><span class="list-item-label">${escape(stay.name)}</span>${metaHtml}</span></li>`
      )
    })
  }

  let actFlatIdx = 0, dayIdx = 0, weekIdx = 0, planIdx = 0, ungroupedIdx = 0
  for (const actItem of place.activities) {
    if (actItem.type === "group") {
      const isPlan = actItem.kind === "plan"
      const gIdx   = isPlan              ? ++planIdx
                   : actItem.kind === "day"  ? ++dayIdx
                   : actItem.kind === "week" ? ++weekIdx : 0
      if (isPlan) {
        const label = actItem.title ?? "Plan"
        parts.push(
          `  <li class="list-divider list-divider--plan">` +
          `<span class="list-item-body"><span class="list-item-label">${escape(label)}</span></span></li>`
        )
      } else {
        const kind    = actItem.kind === "week" ? "Week" : "Day"
        const ordinal = gIdx > 0 ? formatOrdinal(gIdx, actItem.kind as "day" | "week") : kind
        const calDate = actItem.time ? formatGroupCalendarDate(actItem.time) : ""
        const metaHtml = calDate ? `<span class="list-item-meta">${calDate}</span>` : ""
        parts.push(
          `  <li class="list-divider list-divider--day">` +
          `<span class="list-item-body"><span class="list-item-label">${ordinal}</span>${metaHtml}</span></li>`
        )
      }
      let actGroupIdx = 0
      for (const act of actItem.items) {
        const lbl = activityLabel(actGroupIdx, gIdx)
        const pri = act.priority === "must"  ? `<span class="act-priority act-priority-must">${ICON_PRIORITY_MUST}</span>`
                  : act.priority === "maybe" ? `<span class="act-priority act-priority-maybe">${ICON_PRIORITY_MAYBE}</span>` : ""
        const noMap = act.location?.geocodingDisabled ? `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>` : ""
        const timeStr = act.time ? escape(formatMomentTime(act.time)) : ""
        const durStr  = act.duration && act.duration.type !== "unknown" ? escape(formatDuration(act.duration)) : ""
        const metaText = [timeStr, durStr].filter(Boolean).join(" · ")
        parts.push(
          `  <li class="list-item list-item--activity" data-act-idx="${actFlatIdx}" data-act-name="${escape(act.name)}">` +
          `<span class="act-badge">${lbl}</span>` +
          `<span class="list-item-body"><span class="list-item-label">${escape(act.name)}</span><span class="list-item-meta">${metaText}${pri}${noMap}</span></span></li>`
        )
        actFlatIdx++
        actGroupIdx++
      }
    } else {
      for (const act of actItem.items) {
        const lbl = activityLabel(ungroupedIdx)
        const pri = act.priority === "must"  ? `<span class="act-priority act-priority-must">${ICON_PRIORITY_MUST}</span>`
                  : act.priority === "maybe" ? `<span class="act-priority act-priority-maybe">${ICON_PRIORITY_MAYBE}</span>` : ""
        const noMap = act.location?.geocodingDisabled ? `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>` : ""
        const timeStr = act.time ? escape(formatMomentTime(act.time)) : ""
        const durStr  = act.duration && act.duration.type !== "unknown" ? escape(formatDuration(act.duration)) : ""
        const metaText = [timeStr, durStr].filter(Boolean).join(" · ")
        parts.push(
          `  <li class="list-item list-item--activity" data-act-idx="${actFlatIdx}" data-act-name="${escape(act.name)}">` +
          `<span class="act-badge">${lbl}</span>` +
          `<span class="list-item-body"><span class="list-item-label">${escape(act.name)}</span><span class="list-item-meta">${metaText}${pri}${noMap}</span></span></li>`
        )
        actFlatIdx++
        ungroupedIdx++
      }
    }
  }
  parts.push(`</ul>`)
  return parts.join("\n")
}

// ─── Transport panel render ───────────────────────────────────────────────────

function renderTransportPanelContent(leg: TransportLeg): string {
  const from         = leg.from?.label ?? null
  const to           = leg.to?.label   ?? null
  const departsHtml  = leg.departs  ? wrapInferred(momentOrUnknown(leg.departs),  leg.departs)  : null
  const arrivesHtml  = leg.arrives  ? wrapInferred(momentOrUnknown(leg.arrives),  leg.arrives)  : null
  const durationText = leg.duration ? durOrUnknown(leg.duration) : null
  const noteHtml     = leg.note ? `<div class="note transport-note panel-note">${renderMarkdown(leg.note)}</div>` : ""
  const infoHtml     = leg.info?.length
    ? `<div class="transport-info">${leg.info.map(renderInfoItem).join("")}</div>`
    : ""

  const routeHtml = renderDetailedRoute(from, to, departsHtml, arrivesHtml, durationText)
  return `<div class="transport-body">${routeHtml}${noteHtml}${infoHtml}</div>`
}

/** Desktop panel content for a single transport leg (transportIdx is 0-based). */
export function renderTransportPanel(doc: CrumbDocument, transportIdx: number): string {
  const legs = doc.itinerary.filter(i => i.type === "transport") as TransportLeg[]
  const leg  = legs[transportIdx]
  if (!leg) return ""

  const parts: string[] = []
  const icon     = modeIconSvg(leg.mode)
  const modeName = escape(formatMode(leg.mode))

  parts.push(
    `<div class="panel-sticky-bar">` +
    `<span class="transport-icon-wrap sticky-bar-badge">${icon}</span>` +
    `<span class="sticky-bar-body"><span class="sticky-bar-name">${modeName}</span></span>` +
    `<button class="panel-close sticky-bar-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` +
    `</div>`
  )

  parts.push(`<div class="panel-header">`)
  parts.push(`  <div class="panel-header-body">`)
  parts.push(`    <div class="panel-title-row">`)
  parts.push(`      <span class="transport-icon-wrap panel-transport-icon">${icon}</span>`)
  parts.push(`      <h1 class="panel-transport-name">${modeName}</h1>`)
  parts.push(`    </div>`)
  parts.push(`  </div>`)
  parts.push(`  <button class="panel-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`)
  parts.push(`</div>`)

  parts.push(`<div class="panel-transport-body">`)
  parts.push(renderTransportPanelContent(leg))
  parts.push(`</div>`)

  return parts.join("\n")
}

// ─── Modal content render ─────────────────────────────────────────────────────

export interface ModalRef {
  type: "trip" | "transport" | "stay" | "activity"
  placeIdx: number | null
  itemIdx: number
}

/** Content HTML for the mobile full-screen modal (close button injected by JS). */
export function renderModalContent(doc: CrumbDocument, modal: ModalRef): string {
  if (modal.type === "trip") {
    return renderTripPanel(doc)
  }

  if (modal.type === "transport") {
    const legs = doc.itinerary.filter(i => i.type === "transport") as TransportLeg[]
    const leg  = legs[modal.itemIdx]
    return leg ? `<div class="modal-transport">${renderTransportLeg(leg)}</div>` : ""
  }

  if (modal.type === "stay") {
    const places = doc.itinerary.filter(i => i.type === "place") as Place[]
    const place  = modal.placeIdx !== null ? places[modal.placeIdx - 1] : null
    const stay   = place?.stay?.[modal.itemIdx]
    return stay ? renderStayPanel(stay) : ""
  }

  if (modal.type === "activity") {
    const places = doc.itinerary.filter(i => i.type === "place") as Place[]
    const place  = modal.placeIdx !== null ? places[modal.placeIdx - 1] : null
    if (!place) return ""
    let groupLabel: string | undefined
    let groupNum: number | undefined
    let actGroupLetterIdx = 0
    let count = 0, dayIdx = 0, weekIdx = 0, planIdx = 0, ungroupedIdx = 0
    let foundAct: Activity | undefined
    for (const actItem of place.activities) {
      if (actItem.type === "group") {
        const isPlan = actItem.kind === "plan"
        if (isPlan)                       planIdx++
        else if (actItem.kind === "day")  dayIdx++
        else if (actItem.kind === "week") weekIdx++
        const gIdx = isPlan ? planIdx : actItem.kind === "day" ? dayIdx : weekIdx
        let localIdx = 0
        for (const act of actItem.items) {
          if (count === modal.itemIdx) {
            foundAct = act
            groupNum = gIdx
            if (isPlan) {
              groupLabel = actItem.title ?? "Plan"
            } else {
              groupLabel = formatOrdinal(gIdx, actItem.kind as "day" | "week")
            }
            actGroupLetterIdx = localIdx
          }
          count++
          localIdx++
        }
      } else {
        for (const act of actItem.items) {
          if (count === modal.itemIdx) {
            foundAct = act
            actGroupLetterIdx = ungroupedIdx
          }
          count++
          ungroupedIdx++
        }
      }
    }
    return foundAct ? renderActivityPanel(foundAct, actGroupLetterIdx, groupLabel, groupNum) : ""
  }

  return ""
}

// ─── Full mini-app render ─────────────────────────────────────────────────────

/**
 * Render a complete self-contained HTML file:
 *   — sidebar with floating pill menu (New / Edit / Examples / Generate / About)
 *   — editor panel (left split, toggled via Edit) with live hot-reload
 *   — MapLibre GL map with Nominatim geocoding
 */
export function renderHtml(doc: CrumbDocument, options: AppOptions): string {
  const title          = "Crumb" + (doc.trip?.name ? " — " + escape(doc.trip.name) : "")
  const panelBody      = renderTripPanel(doc)
  const docJson        = JSON.stringify(doc)
  const popupMetaJson  = JSON.stringify(buildPopupMeta(doc))
  const sourceJson     = JSON.stringify(options.source)
  const specJson       = JSON.stringify(options.specContent ?? "")
  const examplesJson   = JSON.stringify(options.examples)
  const exampleItemsHtml = Object.keys(options.examples)
    .map(name => `<div class="menu-sub-item" data-example="${escape(name)}">${escape(name.replace(/\.crumb$/, ""))}</div>`)
    .join("\n        ")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <style>${CSS}</style>
</head>
<body>

  <!-- Main split view -->
  <div id="main">

    <!-- Editor panel (left split, hidden by default) -->
    <div id="editor-panel" style="display:none">
      <div class="editor-header">
        <button id="editor-close-btn" class="editor-close-btn">
          <svg class="editor-close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
      </div>
      <div id="editor-error-bar" class="editor-error-bar" style="display:none"></div>
      <textarea
        id="editor"
        class="editor-textarea"
        spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        autocomplete="off"
        placeholder="Paste or type a .crumb document…"
      ></textarea>
    </div>

    <!-- Map (full area; sidebar floats inside it) -->
    <div id="map">
      <!-- Floating sidebar panel (desktop) / bottom sheet (mobile) -->
      <div id="sidebar">
        <div id="sheet-handle"><div class="sheet-handle-bar"></div></div>
        <div id="panel-nav"></div>
        <div id="panel-content">${panelBody}</div>
        <div id="panel-footer"></div>
      </div>
    </div>

  </div>

  <!-- Pill menu: lives outside #main so CSS transforms on #sidebar (mobile sheet)
       never break its position:fixed viewport anchoring -->
  <div class="sidebar-header">
    <div class="pill-wrap">
      <button class="pill-trigger" id="menu-trigger">
        <span class="pill-brand">crumb</span>
        <svg class="pill-chevron" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="dropdown-menu" id="main-menu">
        <div class="menu-section-label">Editor</div>
        <div class="menu-item" id="menu-new">New</div>
        <div class="menu-item" id="menu-edit">Edit</div>
        <div class="menu-separator"></div>
        <div class="menu-item" id="menu-examples">
          Examples
          <svg class="menu-chevron-r" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
        <div class="menu-sub" id="examples-sub">
          ${exampleItemsHtml}
        </div>
        <div class="menu-separator"></div>
        <div class="menu-item" id="menu-generate">How to generate</div>
        <div class="menu-item" id="menu-about">About</div>
      </div>
    </div>
  </div>

  <!-- New itinerary modal -->
  <div class="modal-overlay" id="new-modal">
    <div class="modal-box">
      <button class="modal-x" id="new-close-x"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="modal-header">
        <div class="modal-title">New itinerary</div>
        <div class="modal-description">Paste a <code>.crumb</code> document below to load it.</div>
      </div>
      <div class="modal-body">
        <textarea
          id="new-textarea"
          class="new-textarea"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          autocomplete="off"
          placeholder="Paste your .crumb YAML here…"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="action-btn" id="new-cancel">Cancel</button>
        <button class="action-btn primary" id="new-load">Load</button>
      </div>
    </div>
  </div>

  <!-- Generate with AI modal -->
  <div class="modal-overlay" id="generate-modal">
    <div class="modal-box">
      <button class="modal-x" id="generate-close-x"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="modal-header">
        <div class="modal-title">Generate with AI</div>
        <div class="modal-description">Download the Crumb spec, upload it to an AI assistant, then describe your trip.</div>
      </div>
      <div class="modal-body">
        <div class="ref-prompt-block">
          <div class="ref-prompt-label">Sample prompt</div>
          <div class="ref-prompt-text">Plan a 2-week trip to Japan for two people in October. Include Tokyo (5 nights), Kyoto (4 nights), and Osaka (3 nights). Add shinkansen legs between cities. Include must-do activities with morning/afternoon timings. Output as a valid .crumb document.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="action-btn" id="generate-close">Close</button>
        <button class="action-btn primary" id="dl-spec-btn">Download spec</button>
      </div>
    </div>
  </div>

  <!-- About modal -->
  <div class="modal-overlay" id="about-modal">
    <div class="modal-box">
      <button class="modal-x" id="about-close-x"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="modal-header">
        <div class="modal-title">About Crumb</div>
      </div>
      <div class="modal-body">
        <p class="ref-intro">Crumb is a plain-text, YAML-based format for travel itineraries designed to work naturally with AI assistants. It keeps trips human-readable while making it easy to collaborate with a language model to plan routes, fill in activities, timings, and notes — then render everything as an interactive map.</p>
      </div>
      <div class="modal-footer">
        <button class="action-btn primary" id="about-close-btn">Close</button>
      </div>
    </div>
  </div>

  <!-- Geocoding status chip -->
  <div id="map-status" class="map-status-chip"></div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>${options.parserBundle}</script>
  <script>
    window.__CRUMB_SOURCE   = ${sourceJson};
    window.__CRUMB_SPEC     = ${specJson};
    window.__CRUMB_EXAMPLES = ${examplesJson};
    window.__CRUMB_DATA     = ${docJson};
    window.__CRUMB_POPUPS   = ${popupMetaJson};
  </script>
  <script>${options.appBundle}</script>
</body>
</html>`
}

// ─── Structure builders ───────────────────────────────────────────────────────

function wrapInferred(text: string, m: ResolvedMoment): string {
  return isInferredMoment(m) ? `<span class="date-inferred">${text}</span>` : text
}

function momentOrUnknown(m: ResolvedMoment): string {
  const t = formatMoment(m)
  if (t) return t
  return (!m.date && !m.time) ? `<span class="value-unknown">${escape(m.label)}</span>` : ""
}

function durOrUnknown(dur: ResolvedDuration): string {
  return dur.type === "unknown"
    ? `<span class="value-unknown">${escape(dur.label)}</span>`
    : escape(formatDuration(dur))
}

function resolvePlaceDisplayDuration(place: Place): Place["duration"] {
  if (place.duration) return place.duration
  if (place.stay?.length === 1 && place.stay[0].duration) return place.stay[0].duration
  return undefined
}

function formatGroupCalendarDate(m: ResolvedMoment): string {
  if (m.date?.precision === "absolute") return formatSmartDate(m.date.value)
  if (m.anchor?.date)                   return formatSmartDate(m.anchor.date)
  if (m.date?.precision === "approximate") return formatSmartDate(m.date.estimate)
  return ""
}

function formatOrdinal(n: number, kind: "day" | "week"): string {
  const mod100 = n % 100
  const suffix = (mod100 >= 11 && mod100 <= 13) ? "th"
    : n % 10 === 1 ? "st"
    : n % 10 === 2 ? "nd"
    : n % 10 === 3 ? "rd"
    : "th"
  return `${n}${suffix} ${kind}`
}

function renderTripHeader(meta: ResolvedTripMeta): string {
  const parts: string[] = [`<header class="trip-header">`]
  parts.push(`  <h1>${escape(meta.name ?? "Itinerary")}</h1>`)

  const metaItems: string[] = []
  if (meta.duration) {
    if (meta.duration.type === "approximate") {
      const rawStr = formatDurValue(meta.duration.value, meta.duration.unit)
      metaItems.push(`<span class="trip-duration date-inferred">${escape(rawStr)}</span>`)
    } else if (meta.duration.type === "unknown") {
      metaItems.push(`<span class="trip-duration value-unknown">${escape(meta.duration.label)}</span>`)
    } else {
      metaItems.push(`<span class="trip-duration">${escape(formatDuration(meta.duration))}</span>`)
    }
  }
  if (meta.author) metaItems.push(`<span class="trip-author">by ${escape(meta.author)}</span>`)
  if (metaItems.length) parts.push(`  <div class="trip-meta">${metaItems.join('<span class="trip-sep">•</span>')}</div>`)

  if (meta.tags?.length) parts.push(`  <div class="tags">${meta.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (meta.note)   parts.push(`  <p class="note">${renderMarkdown(meta.note)}</p>`)
  if (meta.info?.length) parts.push(renderInfoList(meta.info, "  "))

  parts.push("</header>")
  return parts.join("\n")
}

function renderGeoAttrs(location?: { geocodingDisabled?: boolean }): { icon: string; mapLink: string } {
  const disabled = location?.geocodingDisabled ?? false
  return {
    icon:    disabled ? `<span class="geo-no-loc">${ICON_GLOBE_OFF}</span>` : "",
    mapLink: disabled ? "" : ` data-map-link=""`,
  }
}

function renderPlace(place: Place, index = 0): string {
  const parts: string[] = []
  parts.push(`<div class="place" data-place-index="${index}">`)

  // Header: large number + place name/dates stacked
  parts.push(`  <div class="place-header">`)
  if (index > 0) parts.push(`    <span class="place-num">${index}</span>`)
  parts.push(`    <div class="place-heading">`)
  const { icon: placeGeoIcon, mapLink: placeMapLink } = renderGeoAttrs(place.location)
  const durHtml   = renderPlaceDuration(resolvePlaceDisplayDuration(place))
  const datesHtml = renderPlaceDates(place)
  parts.push(`      <span class="place-name-text"${placeMapLink}>${escape(place.name)}${placeGeoIcon}</span>`)
  if (durHtml || datesHtml) {
    const sep = (durHtml && datesHtml) ? `<span class="place-meta-sep">•</span>` : ""
    parts.push(`      <div class="place-meta">${durHtml}${sep}${datesHtml}</div>`)
  }
  parts.push(`    </div>`)
  parts.push(`  </div>`)

  // Body — indented content
  const bodyParts: string[] = []
  if (place.tags?.length)
    bodyParts.push(`<div class="tags">${place.tags.map(t => `<span class="tag">${escape(t)}</span>`).join("")}</div>`)
  if (place.note)
    bodyParts.push(`<div class="note place-note">${renderMarkdown(place.note)}</div>`)
  if (place.stay?.length)
    bodyParts.push(renderStays(place.stay))
  if (place.info?.length)
    bodyParts.push(renderInfoList(place.info, ""))
  if (place.activities.length > 0) {
    const actParts: string[] = [`<div class="activities">`]
    const counter = { n: 0 }
    let dayIdx = 0, weekIdx = 0
    for (const actItem of place.activities) {
      if (actItem.type === "ungrouped") {
        actParts.push(renderUngrouped(actItem, counter))
      } else {
        const gIdx = actItem.kind === "day"  ? ++dayIdx
                   : actItem.kind === "week" ? ++weekIdx
                   : 0
        actParts.push(renderActivityGroup(actItem, counter, gIdx))
      }
    }
    actParts.push(`</div>`)
    bodyParts.push(actParts.join("\n"))
  }

  if (bodyParts.length) {
    parts.push(`  <div class="place-body">`)
    parts.push(bodyParts.map(p => `    ${p}`).join("\n"))
    parts.push(`  </div>`)
  }

  parts.push(`</div>`)
  return parts.join("\n")
}

function renderPlaceDuration(dur: Place["duration"]): string {
  if (!dur) return ""
  if (dur.type === "approximate") {
    return `<span class="place-duration"><span class="date-inferred">${escape(formatDurValue(dur.value, dur.unit))}</span></span>`
  }
  if (dur.type === "unknown") {
    return `<span class="place-duration"><span class="value-unknown">${escape(dur.label)}</span></span>`
  }
  return `<span class="place-duration">${escape(formatDuration(dur))}</span>`
}

function renderPlaceDates(place: Place): string {
  const dateParts: string[] = []
  const a = place.arrives
  const d = place.departs

  function placeDate(m: ResolvedMoment): string {
    if (m.date?.precision === "absolute")    return formatShortDate(m.date.value)
    if (m.date?.precision === "approximate") return m.label
    if (m.anchor?.date)                      return formatShortDate(m.anchor.date)
    if (m.date)                              return m.date.value
    if (!m.date && !m.time)                  return `<span class="value-unknown">${escape(m.label)}</span>`
    return ""
  }

  if (a && d) {
    const r = formatDateRange(a, d)
    if (r) dateParts.push(r)
  } else if (a) {
    const isInferred = isInferredMoment(a)
    const str = placeDate(a)
    if (str) dateParts.push(`${ICON_ARRIVES}${isInferred ? `<span class="date-inferred">${str}</span>` : str}`)
  } else if (d) {
    const isInferred = isInferredMoment(d)
    const str = placeDate(d)
    if (str) dateParts.push(`${ICON_DEPARTS}${isInferred ? `<span class="date-inferred">${str}</span>` : str}`)
  }

  if (!dateParts.length) return ""
  return `<span class="place-dates">${dateParts.join(" · ")}</span>`
}

// NOTE: intentionally distinct from formatPlainDateRange() in format.ts.
// That function is plain text. This one wraps inferred dates in <span class="date-inferred">
// and partial dates with direction icons. Do not merge them.
function formatDateRange(a: ResolvedMoment, d: ResolvedMoment): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const aIso = isoFromMoment(a)
  const dIso = isoFromMoment(d)

  if (aIso && dIso) {
    const [ay, am, ad] = aIso.split("-").map(Number)
    const [, dm, dd]   = dIso.split("-").map(Number)
    const aInferred    = isInferredMoment(a)
    const dInferred    = isInferredMoment(d)

    if (ay === parseInt(dIso.split("-")[0], 10) && am === dm) {
      // Same-month compact: "Jan 15–20"
      const range = `${months[am - 1]} ${ad}–${dd}`
      return (aInferred || dInferred) ? `<span class="date-inferred">${range}</span>` : range
    }

    const aFrag = aInferred ? `<span class="date-inferred">${formatShortDate(aIso)}</span>` : formatShortDate(aIso)
    const dFrag = dInferred ? `<span class="date-inferred">${formatShortDate(dIso)}</span>` : formatShortDate(dIso)
    return `${aFrag} • ${dFrag}`
  }

  // Fallback: label-aware fragments with direction icons
  function dateFrag(m: ResolvedMoment): string {
    const isInferred = isInferredMoment(m)
    let str: string
    if (!isInferred && m.date?.precision === "approximate") {
      str = m.label
    } else if (m.date?.precision === "absolute") {
      str = formatShortDate(m.date.value)
    } else if (m.anchor?.date) {
      str = formatShortDate(m.anchor.date)
    } else if (m.date?.precision === "approximate") {
      str = formatShortDate(m.date.estimate)
    } else {
      str = m.date?.value ?? ""
    }
    if (!str) return ""
    return isInferred ? `<span class="date-inferred">${str}</span>` : str
  }

  const af = dateFrag(a)
  const df = dateFrag(d)
  if (af && df) return `${af} • ${df}`
  if (af) return `${ICON_ARRIVES}${af}`
  if (df) return `${ICON_DEPARTS}${df}`
  return ""
}

function renderTransportLeg(leg: TransportLeg): string {
  const icon        = modeIconSvg(leg.mode)
  const hasContent  = !!(leg.departs || leg.arrives || leg.duration || leg.info?.length || leg.note)

  if (!hasContent) {
    return `<div class="transport transport-simple">
  <span class="transport-icon">${icon}</span>
  <div class="transport-body"><span class="transport-mode">${escape(formatMode(leg.mode))}</span></div>
</div>`
  }

  const from         = leg.from?.label ?? null
  const to           = leg.to?.label   ?? null
  const departsHtml  = leg.departs  ? wrapInferred(momentOrUnknown(leg.departs),  leg.departs)  : null
  const arrivesHtml  = leg.arrives  ? wrapInferred(momentOrUnknown(leg.arrives),  leg.arrives)  : null
  const durationText = leg.duration ? durOrUnknown(leg.duration) : null
  const noteHtml     = leg.note ? `<div class="note transport-note panel-note">${renderMarkdown(leg.note)}</div>` : ""
  const infoHtml     = leg.info?.length
    ? `<div class="transport-info">${leg.info.map(renderInfoItem).join("")}</div>`
    : ""

  const hasBoth  = !!(from || departsHtml) && !!(to || arrivesHtml)
  const routeHtml = hasBoth
    ? renderDetailedRoute(from, to, departsHtml, arrivesHtml, durationText)
    : renderSimpleRoute(from, to, departsHtml, arrivesHtml, durationText)

  return `<div class="transport">
  <span class="transport-icon">${icon}</span>
  <div class="transport-body">
    ${routeHtml}${noteHtml}${infoHtml}
  </div>
</div>`
}

function renderDetailedRoute(
  from: string | null, to: string | null,
  departsHtml: string | null, arrivesHtml: string | null,
  durationText: string | null,
): string {
  return `<div class="transport-route-block">
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name"${from ? ` data-hub-name="${escape(from)}"` : ""}>${from ? escape(from) : ""}</span>
      </div>
      <div class="tl-row">
        <div class="tl-marker tl-marker-line"><div class="tl-line"></div></div>
        <div class="tl-meta">
          ${departsHtml  ? `<span class="waypoint-time">${ICON_DEPARTS}${departsHtml}</span>`                : ""}
          ${durationText ? `<span class="waypoint-time segment-duration">${ICON_CLOCK}${durationText}</span>` : ""}
        </div>
      </div>
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name"${to ? ` data-hub-name="${escape(to)}"` : ""}>${to ? escape(to) : ""}</span>
      </div>
      ${arrivesHtml ? `<div class="tl-indent"><span class="waypoint-time">${ICON_ARRIVES}${arrivesHtml}</span></div>` : ""}
    </div>`
}

function renderSimpleRoute(
  from: string | null, to: string | null,
  departsHtml: string | null, arrivesHtml: string | null,
  durationText: string | null,
): string {
  const parts: string[] = []
  if (from || to) parts.push([from, to].filter(Boolean).map(s => escape(s!)).join(" → "))
  if (departsHtml)  parts.push(`${ICON_DEPARTS}${departsHtml}`)
  if (arrivesHtml)  parts.push(`${ICON_ARRIVES}${arrivesHtml}`)
  if (durationText) parts.push(`<span class="waypoint-time">${ICON_CLOCK}${durationText}</span>`)
  return parts.length ? `<div class="transport-simple">${parts.join(" · ")}</div>` : ""
}

function renderStayPanel(stay: Stay): string {
  const { mapLink: stayMapLink } = renderGeoAttrs(stay.location)

  const dateStr = stay.arrives && stay.departs ? formatPlainDateRange(stay.arrives, stay.departs)
                : stay.arrives ? formatMoment(stay.arrives)
                : stay.departs ? formatMoment(stay.departs) : ""

  const stickyMeta = dateStr ? `<span class="sticky-bar-meta">${escape(dateStr)}</span>` : ""

  const stayTags: string[] = []
  if (stay.location?.geocodingDisabled) stayTags.push(`<span class="tag tag--icon">${ICON_GLOBE_OFF} No map</span>`)
  ;(stay.tags ?? []).forEach(t => stayTags.push(`<span class="tag">${escape(t)}</span>`))
  const allStayTagsHtml = stayTags.join("")

  const parts: string[] = []

  parts.push(
    `<div class="panel-sticky-bar">` +
    `<span class="stay-icon-wrap sticky-bar-badge">${ICON_STAY}</span>` +
    `<span class="sticky-bar-body"><span class="sticky-bar-name">${escape(stay.name)}</span>${stickyMeta}</span>` +
    `<button class="panel-close sticky-bar-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` +
    `</div>`
  )

  parts.push(`<div class="panel-header">`)
  parts.push(`  <div class="panel-header-body">`)
  parts.push(`    <div class="panel-title-row">`)
  parts.push(`      <span class="stay-icon-wrap panel-stay-icon">${ICON_STAY}</span>`)
  parts.push(`      <div class="panel-title-body">`)
  parts.push(`        <h1 class="panel-stay-name"${stayMapLink}>${escape(stay.name)}</h1>`)
  if (dateStr) parts.push(`        <div class="trip-duration">${escape(dateStr)}</div>`)
  parts.push(`      </div>`)
  parts.push(`    </div>`)
  if (allStayTagsHtml) parts.push(`    <div class="tags">${allStayTagsHtml}</div>`)
  parts.push(`  </div>`)
  parts.push(`  <button class="panel-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`)
  parts.push(`</div>`)

  parts.push(`<div class="panel-stay-body">`)
  if (stay.arrives) { const a = momentOrUnknown(stay.arrives); if (a) parts.push(`  <span class="stay-date">${ICON_CORNER_DOWN_RIGHT}${wrapInferred(a, stay.arrives)}</span>`) }
  if (stay.departs) { const d = momentOrUnknown(stay.departs); if (d) parts.push(`  <span class="stay-date">${ICON_CORNER_UP_RIGHT}${wrapInferred(d, stay.departs)}</span>`) }
  if (stay.note)       parts.push(`  <div class="note stay-note panel-note">${renderMarkdown(stay.note)}</div>`)
  if (stay.info?.length) parts.push(`  <div class="stay-info">${stay.info.map(renderInfoItem).join("")}</div>`)
  parts.push(`</div>`)

  return parts.join("\n")
}

function renderStays(stays: Stay[]): string {
  const parts = [`  <div class="stays">`]
  for (const stay of stays) {
    const stayGeoAttr = !stay.location?.geocodingDisabled ? ` data-stay-name="${escape(stay.name)}"` : ""
    const { icon: stayGeoIcon, mapLink: stayMapLink } = renderGeoAttrs(stay.location)

    const dateLines: string[] = []
    if (stay.arrives) { const a = momentOrUnknown(stay.arrives); if (a) dateLines.push(`<span class="stay-date">${ICON_CORNER_DOWN_RIGHT}${wrapInferred(a, stay.arrives)}</span>`) }
    if (stay.departs) { const d = momentOrUnknown(stay.departs); if (d) dateLines.push(`<span class="stay-date">${ICON_CORNER_UP_RIGHT}${wrapInferred(d, stay.departs)}</span>`) }

    const infoStr = stay.info?.length
      ? `<div class="stay-info">${stay.info.map(renderInfoItem).join("")}</div>`
      : ""
    const noteStr = stay.note ? `<div class="note stay-note">${renderMarkdown(stay.note)}</div>` : ""

    const content = [`<span class="stay-name"${stayMapLink}>${escape(stay.name)}${stayGeoIcon}</span>`, ...dateLines, infoStr, noteStr].filter(Boolean).join("")
    parts.push(`    <div class="stay"${stayGeoAttr}><span class="stay-icon">${ICON_STAY}</span><div class="stay-content">${content}</div></div>`)
  }
  parts.push(`  </div>`)
  return parts.join("\n")
}

/** Shared counter type — threads across groups so letters are unique per place. */
interface ActCounter { n: number }

function renderUngrouped(container: UngroupedActivities, counter: ActCounter): string {
  return `    <ul class="activity-list ungrouped">${container.items.map(a => renderActivityItem(a, counter.n++)).join("\n")}</ul>`
}

function renderActivityGroup(group: ActivityGroup, counter: ActCounter, groupIndex = 0): string {
  const isPlan = group.kind === "plan"
  const cls    = isPlan ? "activity-group plan-group" : "activity-group"
  const kind   = isPlan ? "Plan" : group.kind === "week" ? "Week" : "Day"

  let header: string
  if (isPlan && group.title) {
    header = `<div class="group-header plan-header">${escape(group.title)}</div>`
  } else {
    const titleText   = escape(group.title ?? kind)
    const calDate     = !isPlan && group.time
      ? (formatGroupCalendarDate(group.time) || ((!group.time.date && !group.time.time) ? `<span class="value-unknown">${escape(group.time.label)}</span>` : ""))
      : ""
    const ordinalText = !isPlan && groupIndex > 0 ? formatOrdinal(groupIndex, group.kind as "day" | "week") : ""
    const dateLine    = [ordinalText, calDate].filter(Boolean).join(" • ")
    const dateHtml    = dateLine
      ? (group.time && isInferredMoment(group.time)
          ? `<span class="group-date date-inferred">${escape(dateLine)}</span>`
          : `<span class="group-date">${escape(dateLine)}</span>`)
      : ""
    header = `<div class="group-header">${titleText}${dateHtml}</div>`
  }

  const groupNum = isPlan ? undefined : (groupIndex > 0 ? groupIndex : undefined)
  const items = group.items.length
    ? `<ul class="activity-list">${group.items.map(a => renderActivityItem(a, counter.n++, groupNum)).join("\n")}</ul>`
    : ""

  return `    <div class="${cls}">\n      ${header}\n      ${items}\n    </div>`
}

function renderActivityPanel(act: Activity, actIndex: number, groupLabel?: string, groupNum?: number): string {
  const letter = activityLabel(actIndex, groupNum)

  const timeStr = act.time ? formatMomentTime(act.time) : ""
  const durStr  = act.duration ? durOrUnknown(act.duration) : ""
  const metaParts = [groupLabel, timeStr, durStr].filter(Boolean)
  const metaLine  = metaParts.length ? metaParts.join(" · ") : ""

  const stickyMeta = metaLine ? `<span class="sticky-bar-meta">${escape(metaLine)}</span>` : ""

  const iconTags: string[] = []
  if (act.priority === "must")         iconTags.push(`<span class="tag tag--icon">${ICON_PRIORITY_MUST} Must</span>`)
  if (act.priority === "maybe")        iconTags.push(`<span class="tag tag--icon">${ICON_PRIORITY_MAYBE} Maybe</span>`)
  if (act.location?.geocodingDisabled) iconTags.push(`<span class="tag tag--icon">${ICON_GLOBE_OFF} No map</span>`)
  const allTagsHtml = [...iconTags, ...(act.tags ?? []).map(t => `<span class="tag">${escape(t)}</span>`)].join("")

  const parts: string[] = []

  parts.push(
    `<div class="panel-sticky-bar">` +
    `<span class="act-badge sticky-bar-badge">${letter}</span>` +
    `<span class="sticky-bar-body"><span class="sticky-bar-name">${escape(act.name)}</span>${stickyMeta}</span>` +
    `<button class="panel-close sticky-bar-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` +
    `</div>`
  )

  parts.push(`<div class="panel-header">`)
  parts.push(`  <div class="panel-header-body">`)
  parts.push(`    <div class="panel-title-row">`)
  parts.push(`      <span class="act-badge panel-act-badge">${letter}</span>`)
  parts.push(`      <div class="panel-title-body">`)
  parts.push(`        <h1 class="panel-activity-name">${escape(act.name)}</h1>`)
  if (metaLine) parts.push(`        <div class="trip-duration">${escape(metaLine)}</div>`)
  parts.push(`      </div>`)
  parts.push(`    </div>`)
  if (allTagsHtml) parts.push(`    <div class="tags">${allTagsHtml}</div>`)
  parts.push(`  </div>`)
  parts.push(`  <button class="panel-close" id="nav-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`)
  parts.push(`</div>`)

  parts.push(`<div class="panel-activity-body">`)
  if (act.note) parts.push(`  <div class="note act-note panel-note">${renderMarkdown(act.note)}</div>`)
  if (act.info?.length) parts.push(`  <div class="act-info">${act.info.map(renderInfoItem).join("")}</div>`)
  parts.push(`</div>`)

  return parts.join("\n")
}

function renderActivityItem(act: Activity, actIndex?: number, groupNum?: number): string {
  // Letter label (A, B, C…) as map reference — shown only when index is provided
  const label = actIndex !== undefined
    ? `<span class="act-label">${activityLabel(actIndex, groupNum)}</span>`
    : ""

  const { icon: actGeoIcon, mapLink: actMapLink } = renderGeoAttrs(act.location)

  const priorityIcon = act.priority === "must"  ? `<span class="act-priority act-priority-must">${ICON_PRIORITY_MUST}</span>`
                     : act.priority === "maybe" ? `<span class="act-priority act-priority-maybe">${ICON_PRIORITY_MAYBE}</span>`
                     : ""
  const nameHtml = `<span class="act-name"${actMapLink}>${escape(act.name)}${priorityIcon}${actGeoIcon}</span>`
  const titleRow = `<div class="act-title-row">${nameHtml}</div>`

  let timeHtml = ""
  if (act.time) {
    const t = formatMomentTime(act.time)
    if (t) {
      const cls = isInferredMoment(act.time) ? `act-time date-inferred` : `act-time`
      timeHtml = `<span class="${cls}">${escape(t)}</span>`
    } else if (!act.time.date && !act.time.time) {
      timeHtml = `<span class="act-time value-unknown">${escape(act.time.label)}</span>`
    }
  }
  const durHtml = act.duration ? `<span class="act-duration">${durOrUnknown(act.duration)}</span>` : ""
  const sep = (timeHtml && durHtml) ? `<span class="act-meta-sep">•</span>` : ""
  const metaRow = (timeHtml || durHtml) ? `<div class="act-meta">${timeHtml}${sep}${durHtml}</div>` : ""

  const tags: string[] = []
  if (act.tags?.length) act.tags.forEach(t => tags.push(`<span class="tag">${escape(t)}</span>`))

  const contentParts: string[] = [titleRow]
  if (metaRow)         contentParts.push(metaRow)
  if (tags.length)     contentParts.push(`<div class="act-tags">${tags.join("")}</div>`)
  if (act.note)        contentParts.push(`<div class="note act-note">${renderInlineNote(act.note)}</div>`)
  if (act.info?.length) contentParts.push(`<div class="act-info">${act.info.map(renderInfoItem).join("")}</div>`)

  const geoAttr = !act.location?.geocodingDisabled
    ? ` data-act-name="${escape(act.name)}"`
    : ""

  return `<li class="activity-item"${geoAttr}>${label ? label + " " : ""}<div class="act-content">${contentParts.join("")}</div></li>`
}

function renderInfoItem(i: MetadataItem): string {
  return `<div class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`
}

function renderInfoList(info: MetadataItem[], indent: string): string {
  const items = info.map(i => `${indent}  ${renderInfoItem(i)}`).join("\n")
  return `${indent}<div class="info-list">\n${items}\n${indent}</div>`
}

function renderMarkdown(text: string): string {
  const inline = (s: string): string =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,     "<em>$1</em>")
      .replace(/`([^`]+)`/g,     "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  const blocks: string[] = []
  let paraLines: string[] = []
  let listItems: string[] = []

  const flushPara = () => {
    if (paraLines.length) { blocks.push(paraLines.join(" ")); paraLines = [] }
  }
  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map(li => `<li>${li}</li>`).join("")}</ul>`)
      listItems = []
    }
  }

  for (const raw of text.split("\n")) {
    const line    = raw.trimEnd()
    const liMatch = /^[-*]\s+(.+)/.exec(line)
    if (liMatch)      { flushPara(); listItems.push(inline(liMatch[1])) }
    else if (!line)   { flushPara(); flushList() }
    else              { flushList(); paraLines.push(inline(line)) }
  }
  flushPara()
  flushList()

  if (blocks.length === 1 && !blocks[0].startsWith("<ul>")) return blocks[0]
  return blocks.map(b => b.startsWith("<ul>") ? b : `<p>${b}</p>`).join("")
}

// ─── Popup meta ───────────────────────────────────────────────────────────────

export function buildPopupMeta(doc: CrumbDocument): Record<string, string> {
  const meta: Record<string, string> = {}

  for (const item of doc.itinerary) {
    if (item.type !== "place") continue

    const parts: string[] = []
    const dur = resolvePlaceDisplayDuration(item)
    if (dur && dur.type !== "unknown") parts.push(formatDuration(dur))
    const range = formatPlainDateRange(item.arrives, item.departs)
    if (range) parts.push(range)
    if (parts.length) meta[item.name] = parts.join(" • ")

    for (const stay of item.stay ?? []) {
      const r = formatPlainDateRange(stay.arrives, stay.departs)
      if (r) meta[stay.name] = r
    }

    for (const group of item.activities) {
      for (const act of group.items) {
        const ap: string[] = []
        if (act.time) {
          const t = formatMomentTime(act.time)
          if (t) ap.push(t)
        }
        if (act.duration && act.duration.type !== "unknown") ap.push(formatDuration(act.duration))
        if (ap.length) meta[act.name] = ap.join(" • ")
      }
    }
  }

  return meta
}

// ─── HtmlRenderer — reference implementation of CrumbRenderer ────────────────

/**
 * Reference implementation of the CrumbRenderer plugin interface.
 * Produces the itinerary body only (no app shell).
 * For the full mini-app output, use renderHtml() directly.
 */
export class HtmlRenderer implements CrumbRenderer {
  render(doc: CrumbDocument, _context: RenderContext): string {
    return renderItineraryBody(doc)
  }
}
