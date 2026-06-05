/**
 * HTML Renderer
 *
 *   renderHtml(doc, options) — complete self-contained mini-app HTML.
 *     Split layout: editor panel (left, toggled) | sidebar list | map.
 *     Used by the CLI to produce the final output file.
 *
 *   The panel renderers (renderTripPanel, renderPlacePanel, renderTransportPanel,
 *   renderModalContent, …) produce the live panel content the browser bundle injects.
 */

import type { MetadataItem } from "../types/primitives"
import type {
  Activity,
  CrumbDocument,
  Place,
  ResolvedDuration,
  ResolvedMoment,
  Stay,
  TransportLeg,
} from "../types/resolved"
import {
  placeStays,
  placeActivityItems,
} from "./plan-view"
import { CSS } from "./css"
import { ICON_STAY, ICON_ARRIVES, ICON_DEPARTS, ICON_CLOCK, ICON_PIN_OFF, ICON_PRIORITY_MUST, ICON_PRIORITY_MAYBE, ICON_CLOSE, ICON_CHEVRON_DOWN, modeIconSvg } from "./icons"
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

// ─── AppOptions ───────────────────────────────────────────────────────────────

export interface AppOptions {
  /** Esbuild bundle for window.Crumb: render functions (+ parse in editor mode). */
  crumbBundle: string
  /** Esbuild bundle: map, panel navigation, geocoding, mobile sheet. */
  viewerBundle: string
  /** Esbuild bundle: YAML editor, menus, dialogs. Only injected when includeEditor is true. */
  editorBundle: string
  /** When true (default), inject the editor bundle and editor-specific globals. */
  includeEditor?: boolean
  /** Original YAML source — embedded for the editor. Only used when includeEditor is true. */
  source?: string
  /** Example files keyed by filename. Only used when includeEditor is true. */
  examples?: Record<string, string>
  /** CRUMB_SPEC.md content (full reference). Only used when includeEditor is true. */
  specContent?: string
  /** CRUMB_FOR_AI.md content — the compact authoring guide used by the "Generate with AI" prompt. Only used when includeEditor is true. */
  aiGuideContent?: string
}


function renderInlineNote(text: string): string {
  const html = renderMarkdown(text)
  if (text.length <= 140) return html
  return `<span class="note-trunc">${html}</span><span class="note-more"> more</span>`
}

/**
 * Tag row. `leadingIcons` are pre-built icon chips (priority, "no map") that sort
 * before the plain text tags. Returns "" when there is nothing to show.
 */
function renderTags(tags?: string[], leadingIcons: string[] = []): string {
  const chips = [...leadingIcons, ...(tags ?? []).map(t => `<span class="tag">${escape(t)}</span>`)]
  return chips.length ? `<div class="tags">${chips.join("")}</div>` : ""
}

/**
 * Note block. Trip/place notes are inline truncating prose; transport/stay/activity
 * notes are full markdown in a boxed `.panel-note`. Returns "" for empty text.
 */
function renderNote(text?: string, opts: { boxed?: boolean } = {}): string {
  if (!text) return ""
  return opts.boxed
    ? `<div class="note panel-note">${renderMarkdown(text)}</div>`
    : `<div class="note">${renderInlineNote(text)}</div>`
}

// ─── Trip level renders ───────────────────────────────────────────────────────

/** Sticky bar + trip header block (crumb eyebrow, name, tags, note, author). Shared by the trip and single-place panels. */
function renderTripHeader(doc: CrumbDocument): string {
  const parts: string[] = []

  if (doc.trip) {
    const { name, duration } = doc.trip
    const stickyDur = duration && duration.type !== "unknown" ? `<span class="sticky-bar-meta">${escape(formatDuration(duration))}</span>` : ""
    parts.push(`<div class="panel-sticky-bar"><div class="panel-sticky-inner"><span class="sticky-bar-name">${escape(name ?? "Itinerary")}</span>${stickyDur}</div></div>`)
  }

  const dur = doc.trip?.duration
  const durSuffix = dur && dur.type !== "unknown"
    ? `<span class="trip-eyebrow-sep">·</span>${escape(formatDuration(dur))}`
    : dur?.type === "unknown"
    ? `<span class="trip-eyebrow-sep">·</span><span class="value-unknown">${escape(dur.label)}</span>`
    : ""
  parts.push(`<div class="panel-trip-header">`)
  parts.push(`  <div class="trip-eyebrow"><span class="trip-eyebrow-logo">crumb</span>${durSuffix}</div>`)
  if (doc.trip) {
    const { name, author, note, tags } = doc.trip
    parts.push(`  <h1 class="panel-trip-name">${escape(name ?? "Itinerary")}</h1>`)
    const tagsHtml = renderTags(tags)
    if (tagsHtml) parts.push(`  ${tagsHtml}`)
    const noteHtml = renderNote(note)
    if (noteHtml) parts.push(`  ${noteHtml}`)
    if (author) parts.push(`  <p class="trip-author">by ${escape(author)}</p>`)
  }
  parts.push(`</div>`)
  return parts.join("\n")
}

/** Desktop panel content for the trip level. */
export function renderTripPanel(doc: CrumbDocument): string {
  const parts: string[] = []
  parts.push(renderTripHeader(doc))

  parts.push(`<ul class="panel-list">`)
  const itin = doc.itinerary
  let pIdx = 0, tIdx = 0
  for (let ii = 0; ii < itin.length; ii++) {
    const item = itin[ii]
    if (item.type === "place") {
      const idx = ++pIdx
      const geoIcon = renderGeoIcon(item.location)
      const durStr  = item.duration && item.duration.type !== "unknown" ? formatDuration(item.duration) : ""
      const dateStr = item.arrives && item.departs ? formatPlainDateRange(item.arrives, item.departs)
                    : item.arrives ? formatMoment(item.arrives)
                    : item.departs ? formatMoment(item.departs) : ""
      const actCount = countActivities(item)
      const actStr   = actCount > 0 ? `${actCount} activit${actCount === 1 ? "y" : "ies"}` : ""
      const durDateStr  = [durStr ? escape(durStr) : "", dateStr ? escape(dateStr) : ""].filter(Boolean).join(", ")
      const metaStr     = durDateStr && actStr ? `${durDateStr} · ${actStr}`
                        : durDateStr ? durDateStr : actStr
      const metaHtml    = metaStr ? `<span class="list-item-meta">${metaStr}</span>` : ""
      parts.push(
        `  <li class="list-item list-item--place" data-place-idx="${idx}">` +
        `<span class="place-num place-num--sm">${idx}</span>` +
        `<span class="list-item-body"><span class="list-item-label">${escape(item.name)}${geoIcon}</span>${metaHtml}</span></li>`
      )
    } else {
      const ti   = tIdx++
      const icon = modeIconSvg(item.mode)
      const from = item.from?.label ?? null
      const to   = item.to?.label   ?? null
      const dur  = item.duration && item.duration.type !== "unknown" ? formatDuration(item.duration) : null

      // Omit from→to when both match the adjacent place names — pass 3
      // inferred them and showing them just repeats the visible list order.
      const prevPlace = itin.slice(0, ii).reverse().find(x => x.type === "place") as Place | undefined
      const nextPlace = itin.slice(ii + 1).find(x => x.type === "place") as Place | undefined
      const routeStr = (from && to && !(from === prevPlace?.name && to === nextPlace?.name))
        ? `${escape(from)} → ${escape(to)}` : null

      const metaParts = [routeStr, dur ? escape(dur) : null].filter((s): s is string => !!s)
      const metaHtml = metaParts.length ? `<span class="list-item-meta">${metaParts.join(" · ")}</span>` : ""
      parts.push(
        `  <li class="list-item list-item--transport" data-transport-idx="${ti}">` +
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

function renderActivityListItem(act: Activity, flatIdx: number, lbl: string): string {
  const pri   = act.priority === "must"  ? `<span class="card-indicator">${ICON_PRIORITY_MUST}</span>`
              : act.priority === "maybe" ? `<span class="card-indicator">${ICON_PRIORITY_MAYBE}</span>` : ""
  const noMap = act.location?.geocodingDisabled ? `<span class="card-indicator">${ICON_PIN_OFF}</span>` : ""
  const timeStr  = act.time     ? escape(formatMomentTime(act.time)) : ""
  const durStr   = act.duration && act.duration.type !== "unknown" ? escape(formatDuration(act.duration)) : ""
  const metaText = [timeStr, durStr].filter(Boolean).join(" · ")
  const indicators = pri + noMap

  // When there is no text meta, fold indicators into the label to avoid a lone-icon row
  const labelHtml = `<span class="list-item-label">${escape(act.name)}${metaText ? "" : indicators}</span>`
  const metaHtml  = metaText ? `<span class="list-item-meta">${metaText}${indicators}</span>` : ""

  return (
    `  <li class="list-item list-item--activity" data-act-idx="${flatIdx}" data-act-name="${escape(act.name)}">` +
    `<span class="act-badge">${lbl}</span>` +
    `<span class="list-item-body">${labelHtml}${metaHtml}</span></li>`
  )
}

function renderPlaceActivities(place: Place): string {
  const parts: string[] = []

  const stays = placeStays(place)
  if (stays.length) {
    stays.forEach((stay, sIdx) => {
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

  let actFlatIdx = 0, dayIdx = 0, weekIdx = 0, groupIdx = 0, ungroupedIdx = 0
  for (const actItem of placeActivityItems(place)) {
    if (actItem.type === "group") {
      const isPlan = actItem.kind === "group"
      const gIdx   = isPlan              ? ++groupIdx
                   : actItem.kind === "day"  ? ++dayIdx
                   : actItem.kind === "week" ? ++weekIdx : 0
      if (isPlan) {
        const label = actItem.title ?? "Group"
        parts.push(
          `  <li class="list-divider list-divider--plan">` +
          `<span class="list-item-body"><span class="list-item-label">${escape(label)}</span></span></li>`
        )
      } else {
        const kind    = actItem.kind === "week" ? "Week" : "Day"
        const ordinal = gIdx > 0 ? formatOrdinal(gIdx, actItem.kind as "day" | "week") : kind
        const calDate = actItem.time ? formatGroupCalendarDate(actItem.time, true) : ""
        // Ordinal + optional name share the left (wrapping as needed); date sits on the right.
        const leftText = actItem.title ? `${ordinal}, ${escape(actItem.title)}` : ordinal
        const dateHtml = calDate ? `<span class="day-divider-date">${calDate}</span>` : ""
        parts.push(
          `  <li class="list-divider list-divider--day">` +
          `<span class="day-divider-main">${leftText}</span>` +
          dateHtml +
          `</li>`
        )
      }
      let actGroupIdx = 0
      for (const act of actItem.items) {
        parts.push(renderActivityListItem(act, actFlatIdx++, activityLabel(actGroupIdx++, gIdx)))
      }
    } else {
      for (const act of actItem.items) {
        parts.push(renderActivityListItem(act, actFlatIdx++, activityLabel(ungroupedIdx++)))
      }
    }
  }
  return parts.join("\n")
}

// ─── Panel header helpers ─────────────────────────────────────────────────────

/** A close button carrying the shared ICON_CLOSE; extra classes select context (sticky bar, etc.). */
function closeBtn(extraClass = ""): string {
  return `<button class="panel-close${extraClass ? " " + extraClass : ""}" id="nav-back">${ICON_CLOSE}</button>`
}
const PANEL_CLOSE_BTN  = closeBtn()
const STICKY_CLOSE_BTN = closeBtn("sticky-bar-close")

function renderStickyBar(badge: string, name: string, meta?: string): string {
  const metaHtml = meta ? `<span class="sticky-bar-meta">${meta}</span>` : ""
  return (
    `<div class="panel-sticky-bar"><div class="panel-sticky-inner">` +
    badge +
    `<span class="sticky-bar-body"><span class="sticky-bar-name">${name}</span>${metaHtml}</span>` +
    STICKY_CLOSE_BTN +
    `</div></div>`
  )
}

interface PanelHeaderOpts {
  stickyBar?: string   // sticky scroll bar (omitted by the flat single-place view, which has its own)
  badge:      string
  title:      string   // full heading element HTML (h1 with class + content)
  meta?:      string   // optional subtitle (escaped text or HTML — Place: duration·dates, Activity: time·duration)
  flat?:      boolean  // single-place flat view: more air above the title, no nav chrome
  showClose?: boolean  // render the close button (default true)
}

function renderPanelHeader({ stickyBar, badge, title, meta, flat = false, showClose = true }: PanelHeaderOpts): string {
  const metaHtml = meta ? `\n        <div class="trip-duration">${meta}</div>` : ""
  return [
    stickyBar ?? "",
    `<div class="panel-header${flat ? " panel-header--flat" : ""}">`,
    `  <div class="panel-header-body">`,
    `    <div class="panel-title-row">`,
    `      ${badge}`,
    `      <div class="panel-title-body">`,
    `        ${title}${metaHtml}`,
    `      </div>`,
    `    </div>`,
    `  </div>`,
    showClose ? `  ${PANEL_CLOSE_BTN}` : "",
    `</div>`,
  ].filter(line => line !== "").join("\n")
}

/** Total activity count across all groups in a place (for card metadata). */
function countActivities(place: Place): number {
  let n = 0
  for (const actItem of placeActivityItems(place)) n += actItem.items.length
  return n
}

// ─── Desktop panel renderers ──────────────────────────────────────────────────

/** Desktop panel content for a single place (placeIdx is 1-based). */
export function renderPlacePanel(doc: CrumbDocument, placeIdx: number): string {
  const places = doc.itinerary.filter(i => i.type === "place") as Place[]
  const place  = places[placeIdx - 1]
  if (!place) return ""

  const geoIcon = renderGeoIcon(place.location)
  // Rich HTML for the panel header (carries date-inferred spans, icons, etc.)
  const metaLine = [renderPlaceDuration(resolvePlaceDisplayDuration(place)), renderPlaceDates(place)]
    .filter(Boolean).join(`<span class="place-meta-sep"> · </span>`)
  // Plain text for the sticky bar — avoids inheriting .place-duration / .place-dates font sizes
  const dur = resolvePlaceDisplayDuration(place)
  const durPlain  = dur && dur.type !== "unknown" ? escape(formatDuration(dur))
                  : dur?.type === "unknown"       ? escape(dur.label) : ""
  const datePlain = place.arrives && place.departs ? escape(formatPlainDateRange(place.arrives, place.departs))
                  : place.arrives                  ? escape(formatMoment(place.arrives))
                  : place.departs                  ? escape(formatMoment(place.departs)) : ""
  const stickyMeta = [durPlain, datePlain].filter(Boolean).join(" · ")

  const parts: string[] = []
  parts.push(renderPanelHeader({
    stickyBar: renderStickyBar(
      `<span class="place-num place-num--sm sticky-bar-badge">${placeIdx}</span>`,
      escape(place.name),
      stickyMeta || undefined,
    ),
    badge: `<span class="place-num place-num--sm">${placeIdx}</span>`,
    title: `<h1 class="panel-place-name">${escape(place.name)}${geoIcon}</h1>`,
    meta:  metaLine || undefined,
  }))

  const body = renderPlaceBody(place)
  if (body) parts.push(body)

  parts.push(`<ul class="panel-list">`)
  parts.push(renderPlaceActivities(place))
  parts.push(`</ul>`)
  return parts.join("\n")
}

/** Tags + note block beneath a place title. Returns "" when the place has neither. */
function renderPlaceBody(place: Place): string {
  const body = renderTags(place.tags) + renderNote(place.note)
  return body ? `<div class="panel-place-body">${body}</div>` : ""
}

/** Combined flat view for single-place docs: trip header + activities, no navigation chrome. */
export function renderSinglePlacePanel(doc: CrumbDocument): string {
  const places = doc.itinerary.filter(i => i.type === "place") as Place[]
  const place  = places[0]
  if (!place) return renderTripPanel(doc)

  const parts: string[] = []
  parts.push(renderTripHeader(doc))

  const geoIcon = renderGeoIcon(place.location)
  const metaLine = [renderPlaceDuration(resolvePlaceDisplayDuration(place)), renderPlaceDates(place)]
    .filter(Boolean).join(`<span class="place-meta-sep"> · </span>`)
  parts.push(renderPanelHeader({
    flat: true,
    showClose: false,
    badge: `<span class="place-num place-num--sm">1</span>`,
    title: `<h1 class="panel-place-name">${escape(place.name)}${geoIcon}</h1>`,
    meta:  metaLine || undefined,
  }))

  const body = renderPlaceBody(place)
  if (body) parts.push(body)

  parts.push(`<ul class="panel-list">`)
  parts.push(renderPlaceActivities(place))
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
  const noteHtml     = renderNote(leg.note, { boxed: true })
  const infoHtml     = leg.info?.length
    ? `<div class="panel-info">${leg.info.map(renderInfoItem).join("")}</div>`
    : ""

  const routeHtml = renderDetailedRoute(from, to, departsHtml, arrivesHtml, durationText)
  return `<div class="transport-body">${routeHtml}${noteHtml}${infoHtml}</div>`
}

/** Desktop panel content for a single transport leg (transportIdx is 0-based). */
export function renderTransportPanel(doc: CrumbDocument, transportIdx: number): string {
  const legs = doc.itinerary.filter(i => i.type === "transport") as TransportLeg[]
  const leg  = legs[transportIdx]
  if (!leg) return ""

  const icon     = modeIconSvg(leg.mode)
  const modeName = escape(formatMode(leg.mode))

  const parts: string[] = []
  parts.push(renderPanelHeader({
    stickyBar: renderStickyBar(`<span class="transport-icon-wrap sticky-bar-badge">${icon}</span>`, modeName),
    badge: `<span class="transport-icon-wrap panel-transport-icon">${icon}</span>`,
    title: `<h1 class="panel-transport-name">${modeName}</h1>`,
    // No meta in transport header — route/time details live in the body
  }))

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
function findActivityByFlatIndex(
  place: Place,
  flatIdx: number,
): { act: Activity; actGroupLetterIdx: number; groupLabel?: string; groupNum?: number } | null {
  let count = 0, dayIdx = 0, weekIdx = 0, groupIdx = 0, ungroupedIdx = 0
  for (const actItem of placeActivityItems(place)) {
    if (actItem.type === "group") {
      const isPlan = actItem.kind === "group"
      if (isPlan)                       groupIdx++
      else if (actItem.kind === "day")  dayIdx++
      else if (actItem.kind === "week") weekIdx++
      const gIdx = isPlan ? groupIdx : actItem.kind === "day" ? dayIdx : weekIdx
      let localIdx = 0
      for (const act of actItem.items) {
        if (count === flatIdx) return {
          act,
          actGroupLetterIdx: localIdx,
          groupNum: gIdx,
          groupLabel: isPlan ? (actItem.title ?? "Group") : formatOrdinal(gIdx, actItem.kind as "day" | "week"),
        }
        count++; localIdx++
      }
    } else {
      for (const act of actItem.items) {
        if (count === flatIdx) return { act, actGroupLetterIdx: ungroupedIdx }
        count++; ungroupedIdx++
      }
    }
  }
  return null
}

export function renderModalContent(doc: CrumbDocument, modal: ModalRef): string {
  if (modal.type === "trip") {
    return renderTripPanel(doc)
  }

  if (modal.type === "stay") {
    const places = doc.itinerary.filter(i => i.type === "place") as Place[]
    const place  = modal.placeIdx !== null ? places[modal.placeIdx - 1] : null
    const stay   = place ? placeStays(place)[modal.itemIdx] : undefined
    return stay ? renderStayPanel(stay) : ""
  }

  if (modal.type === "activity") {
    const places = doc.itinerary.filter(i => i.type === "place") as Place[]
    const place  = modal.placeIdx !== null ? places[modal.placeIdx - 1] : null
    if (!place) return ""
    const found = findActivityByFlatIndex(place, modal.itemIdx)
    return found ? renderActivityPanel(found.act, found.actGroupLetterIdx, found.groupLabel, found.groupNum) : ""
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
  const includeEditor  = options.includeEditor !== false
  const title          = "Crumb" + (doc.trip?.name ? " — " + escape(doc.trip.name) : "")
  const panelBody      = includeEditor ? "" : renderTripPanel(doc)
  const docJson        = includeEditor ? "null" : JSON.stringify(doc)

  const editorDom = includeEditor ? `
    <!-- Editor panel (left split, hidden by default) -->
    <div id="editor-panel" style="display:none">
      <div class="editor-header">
        <button id="editor-close-btn" class="editor-close-btn">
          ${ICON_CLOSE}
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
    </div>` : ""

  const exampleItemsHtml = Object.keys(options.examples ?? {})
    .map(name => `<div class="menu-sub-item" data-example="${escape(name)}">${escape(name.replace(/\.crumb$/, ""))}</div>`)
    .join("\n        ")

  const chevronSvg = `<span class="app-bar-chevron">${ICON_CHEVRON_DOWN}</span>`

  const appBarDom = includeEditor ? `
  <!-- App bar (editor mode only) -->
  <div id="app-bar">
    <span class="app-bar-brand">crumb</span>
    <div class="app-bar-sep"></div>

    <!-- File menu -->
    <div class="app-bar-item" id="menu-file">File ${chevronSvg}
      <div class="app-bar-submenu" id="file-sub">
        <div class="menu-sub-item" id="menu-edit">Edit</div>
        <div class="menu-sub-item" id="menu-new">New</div>
        <div class="menu-sub-sep"></div>
        <div class="menu-sub-item" id="menu-save">Save</div>
        <div class="menu-sub-item" id="menu-save-as">Save as…</div>
        <div class="menu-sub-sep"></div>
        <div class="menu-section-label">Open recent</div>
        <div id="recent-list"></div>
        <div class="menu-sub-sep"></div>
        <div class="menu-sub-item" id="menu-delete">Delete</div>
      </div>
    </div>

    <!-- Examples menu -->
    <div class="app-bar-item" id="menu-examples">Examples ${chevronSvg}
      <div class="app-bar-submenu" id="examples-sub">
        ${exampleItemsHtml}
      </div>
    </div>

    <!-- About menu -->
    <div class="app-bar-item" id="menu-about">About ${chevronSvg}
      <div class="app-bar-submenu" id="about-sub">
        <div class="menu-sub-item" id="about-what">What is a Crumb</div>
        <div class="menu-sub-item" id="about-generate">How to generate</div>
      </div>
    </div>
  </div>` : ""

  const modalsDom = includeEditor ? `
  <!-- New itinerary modal -->
  <div class="modal-overlay" id="new-modal">
    <div class="modal-box">
      <button class="modal-x" id="new-close-x">${ICON_CLOSE}</button>
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
      <button class="modal-x" id="generate-close-x">${ICON_CLOSE}</button>
      <div class="modal-header">
        <div class="modal-title">Generate with AI</div>
        <div class="modal-description">Copy the prompt into any AI assistant (ChatGPT, Claude, …), describe your trip, then paste the result back into the editor.</div>
      </div>
      <div class="modal-body">
        <div class="ref-prompt-block">
          <div class="ref-prompt-label">Then describe your trip, for example:</div>
          <div class="ref-prompt-text">Plan a 10-day trip to Italy in October: Rome (4 nights), Florence (3), Venice (2). High-speed trains between cities, fly home from Venice. Include must-do sights with morning/afternoon timings and a hotel in Rome.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="action-btn" id="generate-close">Close</button>
        <button class="action-btn" id="dl-guide-btn">Download guide</button>
        <button class="action-btn primary" id="copy-prompt-btn">Copy prompt</button>
      </div>
    </div>
  </div>

  <!-- About modal -->
  <div class="modal-overlay" id="about-modal">
    <div class="modal-box">
      <button class="modal-x" id="about-close-x">${ICON_CLOSE}</button>
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

  <!-- Delete confirmation modal -->
  <div class="modal-overlay" id="delete-confirm-modal">
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title">Delete itinerary?</div>
        <div class="modal-description" id="delete-confirm-desc"></div>
      </div>
      <div class="modal-footer">
        <button class="action-btn" id="delete-cancel">Cancel</button>
        <button class="action-btn action-btn--danger" id="delete-confirm-btn">Delete</button>
      </div>
    </div>
  </div>` : ""

  const editorGlobals = includeEditor ? `
    window.__CRUMB_SOURCE   = "";
    window.__CRUMB_SPEC     = ${JSON.stringify(options.specContent ?? "")};
    window.__CRUMB_FOR_AI   = ${JSON.stringify(options.aiGuideContent ?? "")};
    window.__CRUMB_EXAMPLES = ${JSON.stringify(options.examples ?? {})};` : ""

  const editorScript = includeEditor ? `\n  <script>${options.editorBundle}</script>` : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <style>${CSS}</style>
</head>
<body>
${appBarDom}
  <!-- Main split view -->
  <div id="main">
${editorDom}
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
${modalsDom}
  <!-- Geocoding status chip -->
  <div id="map-status" class="map-status-chip"></div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>${options.crumbBundle}</script>
  <script>
    window.__CRUMB_DATA   = ${docJson};${editorGlobals}
  </script>
  <script>${options.viewerBundle}</script>${editorScript}
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
  const stays = placeStays(place)
  if (stays.length === 1 && stays[0].duration) return stays[0].duration
  return undefined
}

function formatGroupCalendarDate(m: ResolvedMoment, shortWeekday = false): string {
  if (m.date?.precision === "absolute") return formatSmartDate(m.date.value, shortWeekday)
  if (m.anchor?.date)                   return formatSmartDate(m.anchor.date, shortWeekday)
  if (m.date?.precision === "approximate") return formatSmartDate(m.date.estimate, shortWeekday)
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


/** Geocoding indicator for a name: the "no map" pin icon when geocoding is disabled. */
function renderGeoIcon(location?: { geocodingDisabled?: boolean }): string {
  return location?.geocodingDisabled ? `<span class="geo-no-loc">${ICON_PIN_OFF}</span>` : ""
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
    return `${aFrag}–${dFrag}`
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
  if (af && df) return `${af}–${df}`
  if (af) return `${ICON_ARRIVES}${af}`
  if (df) return `${ICON_DEPARTS}${df}`
  return ""
}


function renderDetailedRoute(
  from: string | null, to: string | null,
  departsHtml: string | null, arrivesHtml: string | null,
  durationText: string | null,
): string {
  // The two .waypoint-name spans (origin, then destination) are decorated by
  // decorateTransportWaypoints() in browser-app — it owns link/icon/spinner state.
  return `<div class="transport-route-block">
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name">${from ? escape(from) : ""}</span>
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
        <span class="waypoint-name">${to ? escape(to) : ""}</span>
      </div>
      ${arrivesHtml ? `<div class="tl-indent"><span class="waypoint-time">${ICON_ARRIVES}${arrivesHtml}</span></div>` : ""}
    </div>`
}


function renderStayPanel(stay: Stay): string {
  const dateStr = stay.arrives && stay.departs ? formatPlainDateRange(stay.arrives, stay.departs)
                : stay.arrives ? formatMoment(stay.arrives)
                : stay.departs ? formatMoment(stay.departs) : ""

  const leadingIcons = stay.location?.geocodingDisabled ? [`<span class="tag tag--icon">${ICON_PIN_OFF} No map</span>`] : []
  const tagsHtml = renderTags(stay.tags, leadingIcons)

  const parts: string[] = []
  parts.push(renderPanelHeader({
    stickyBar: renderStickyBar(
      `<span class="stay-icon-wrap sticky-bar-badge">${ICON_STAY}</span>`,
      escape(stay.name),
      dateStr ? escape(dateStr) : undefined,
    ),
    badge: `<span class="stay-icon-wrap panel-stay-icon">${ICON_STAY}</span>`,
    title: `<h1 class="panel-stay-name">${escape(stay.name)}</h1>`,
    // No meta in stay header — arrive/depart details are in the body
  }))

  const aMoment = stay.arrives ? momentOrUnknown(stay.arrives) : ""
  const dMoment = stay.departs ? momentOrUnknown(stay.departs) : ""
  const arrivesHtml = aMoment ? wrapInferred(aMoment, stay.arrives!) : null
  const departsHtml = dMoment ? wrapInferred(dMoment, stay.departs!) : null

  parts.push(`<div class="panel-stay-body">`)
  if (tagsHtml) parts.push(`  ${tagsHtml}`)
  const timeline = renderStayTimeline(arrivesHtml, departsHtml)
  if (timeline) parts.push(timeline)
  const noteHtml = renderNote(stay.note, { boxed: true })
  if (noteHtml) parts.push(`  ${noteHtml}`)
  if (stay.info?.length) parts.push(`  <div class="panel-info">${stay.info.map(renderInfoItem).join("")}</div>`)
  parts.push(`</div>`)

  return parts.join("\n")
}

/** Arrives/Departs dashed timeline for the stay panel — mirrors renderDetailedRoute(). */
function renderStayTimeline(arrivesHtml: string | null, departsHtml: string | null): string {
  if (!arrivesHtml && !departsHtml) return ""

  // Single endpoint: dot + label + indented date, no connector line.
  if (!arrivesHtml || !departsHtml) {
    const label = arrivesHtml ? "Arrives" : "Departs"
    const date  = arrivesHtml ?? departsHtml
    return `<div class="transport-route-block">
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name">${label}</span>
      </div>
      <div class="tl-indent"><span class="waypoint-time">${date}</span></div>
    </div>`
  }

  return `<div class="transport-route-block">
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name">Arrives</span>
      </div>
      <div class="tl-row">
        <div class="tl-marker tl-marker-line"><div class="tl-line"></div></div>
        <div class="tl-meta">
          <span class="waypoint-time">${arrivesHtml}</span>
        </div>
      </div>
      <div class="tl-row">
        <div class="tl-marker"><div class="tl-dot"></div></div>
        <span class="waypoint-name">Departs</span>
      </div>
      <div class="tl-indent"><span class="waypoint-time">${departsHtml}</span></div>
    </div>`
}





function renderActivityPanel(act: Activity, actIndex: number, groupLabel?: string, groupNum?: number): string {
  const letter = activityLabel(actIndex, groupNum)

  const timeStr = act.time ? formatMomentTime(act.time) : ""
  const durStr  = act.duration ? durOrUnknown(act.duration) : ""
  const metaLine = [groupLabel, timeStr, durStr].filter(Boolean).join(" · ")

  const iconTags: string[] = []
  if (act.priority === "must")         iconTags.push(`<span class="tag tag--icon">${ICON_PRIORITY_MUST} Must</span>`)
  if (act.priority === "maybe")        iconTags.push(`<span class="tag tag--icon">${ICON_PRIORITY_MAYBE} Maybe</span>`)
  if (act.location?.geocodingDisabled) iconTags.push(`<span class="tag tag--icon">${ICON_PIN_OFF} No map</span>`)
  const tagsHtml = renderTags(act.tags, iconTags)

  const parts: string[] = []
  parts.push(renderPanelHeader({
    stickyBar: renderStickyBar(
      `<span class="act-badge sticky-bar-badge">${letter}</span>`,
      escape(act.name),
      metaLine ? escape(metaLine) : undefined,
    ),
    badge: `<span class="act-badge panel-act-badge">${letter}</span>`,
    title: `<h1 class="panel-activity-name">${escape(act.name)}</h1>`,
    meta:  metaLine ? escape(metaLine) : undefined,
  }))

  parts.push(`<div class="panel-activity-body">`)
  if (tagsHtml) parts.push(`  ${tagsHtml}`)
  const noteHtml = renderNote(act.note, { boxed: true })
  if (noteHtml) parts.push(`  ${noteHtml}`)
  if (act.info?.length) parts.push(`  <div class="panel-info">${act.info.map(renderInfoItem).join("")}</div>`)
  parts.push(`</div>`)

  return parts.join("\n")
}


function renderInfoItem(i: MetadataItem): string {
  return `<div class="info-item"><span class="info-key">${escape(String(i.key))}</span><span class="info-val">${escape(String(i.value))}</span></div>`
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
