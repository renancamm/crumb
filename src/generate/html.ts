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
} from "../shared/plan-view"
import { CSS } from "./css"
import { ICON_STAY, ICON_ARRIVES, ICON_DEPARTS, ICON_CLOCK, ICON_PIN_OFF, ICON_PRIORITY_MUST, ICON_PRIORITY_MAYBE, ICON_CLOSE, ICON_COPY, ICON_CHEVRON_DOWN, ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, ICON_UNDO, ICON_REDO, ICON_HELP, ICON_CODE, ICON_MAP, modeIconSvg } from "../shared/icons"
import {
  escape,
  jsonForScript,
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
} from "../shared/format"

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
  /** crumb-spec.md content (full reference). Only used when includeEditor is true. */
  specContent?: string
  /** crumb-for-ai.md content — the compact authoring guide offered as "Download guide" in the "Generate with AI" modal (the prompt itself lives in shared/ai-prompt.ts). Only used when includeEditor is true. */
  aiGuideContent?: string
  /** Baked geocoding cache ({ query: {lat,lng} }). When provided, the viewer seeds
   *  localStorage from it so known places resolve with zero network requests. */
  geoData?: Record<string, { lat: number; lng: number }>
  /** Set to "online" to embed geoData but skip seeding (force live geocoding). */
  geoMode?: "online" | "static"
  /** Embed mode: a generic, content-agnostic embed. The page ships no baked doc;
   *  it loads a crumb at runtime from `?src=<.crumb url>` (see embed-boot.ts),
   *  with the map locked + an expand→fullscreen control. Pass `doc = null`. */
  embed?: boolean
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

/**
 * Sticky bar + trip header block (crumb eyebrow, name, tags, note, author). Shared
 * by the trip and single-place panels.
 *
 * `legend: true` is the static card-embed variant: it drops the floating sticky bar
 * (a scroll duplicate that's meaningless in a non-scrolling card) and the tags, but
 * keeps the eyebrow + name + note. The `--legend` class lets the panel suppress the
 * timeline connector and lets CSS size the miniature down.
 */
export function renderTripHeader(doc: CrumbDocument, opts: { legend?: boolean } = {}): string {
  const legend = opts.legend === true
  const parts: string[] = []

  if (doc.trip && !legend) {
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
  parts.push(`<div class="panel-trip-header${legend ? " panel-trip-header--legend" : ""}">`)
  parts.push(`  <div class="trip-eyebrow"><span class="trip-eyebrow-logo">crumb</span>${durSuffix}</div>`)
  if (doc.trip) {
    const { name, author, note, tags } = doc.trip
    parts.push(`  <h1 class="panel-trip-name">${escape(name ?? "Itinerary")}</h1>`)
    const tagsHtml = legend ? "" : renderTags(tags)
    if (tagsHtml) parts.push(`  ${tagsHtml}`)
    const noteHtml = renderNote(note)
    if (noteHtml) parts.push(`  ${noteHtml}`)
    if (author) parts.push(`  <p class="trip-author">by ${escape(author)}</p>`)
  }
  parts.push(`</div>`)
  return parts.join("\n")
}

/**
 * Desktop panel content for the trip level.
 *
 * `variant: "legend"` is the static card-embed legend (see embedCSS): it renders the
 * legend trip header (no sticky bar / tags) and flags the list `--flat` to drop the
 * timeline connector. Everything else is the same markup, sized down by CSS.
 */
export function renderTripPanel(doc: CrumbDocument, opts: { variant?: "legend" } = {}): string {
  const legend = opts.variant === "legend"
  const parts: string[] = []
  parts.push(renderTripHeader(doc, legend ? { legend: true } : {}))

  parts.push(`<ul class="panel-list${legend ? " panel-list--flat" : ""}">`)
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
export function renderHtml(doc: CrumbDocument | null, options: AppOptions): string {
  const includeEditor  = options.includeEditor !== false
  const title          = "Crumb" + (doc?.trip?.name ? " — " + escape(doc.trip.name) : "")
  const panelBody      = includeEditor || !doc ? "" : renderTripPanel(doc)
  const docJson        = includeEditor || !doc ? "null" : jsonForScript(doc)

  // Inner editor body: CodeMirror mount + a persistent bottom status bar (always
  // rendered, so errors never reflow the layout) + the circular expand button
  // shown only in the collapsed (slim-rail) state. The menu pill (app bar) floats
  // over the top-left, positioned absolutely within #editor-pane.
  const editorBodyDom = includeEditor ? `
      <div id="editor" class="editor-host"></div>
      <div id="editor-status">● ready</div>
      <button id="editor-collapse" class="editor-edge-btn" title="Hide editor" aria-label="Hide editor">${ICON_CHEVRON_LEFT}</button>
      <button id="editor-reopen" class="editor-edge-btn" title="Show editor" aria-label="Show editor">${ICON_CHEVRON_RIGHT}</button>` : ""

  const chevronSvg = `<span class="app-bar-chevron">${ICON_CHEVRON_DOWN}</span>`

  const appBarDom = includeEditor ? `
  <!-- Floating menu pill (editor mode only) -->
  <div id="app-bar">
    <!-- File menu -->
    <div class="app-bar-item" id="menu-file">File ${chevronSvg}
      <div class="app-bar-submenu" id="file-sub">
        <div class="menu-sub-item" id="menu-new">New</div>
        <div class="menu-sub-item" id="menu-generate">Generate with AI…</div>
        <div class="menu-sub-sep"></div>
        <div class="menu-sub-item" id="menu-open">Open…</div>
        <div class="menu-sub-item menu-sub-parent" id="menu-open-recent">Open recent
          <span class="menu-sub-arrow">${ICON_CHEVRON_RIGHT}</span>
          <div class="app-bar-submenu menu-flyout" id="recent-sub">
            <div id="recent-list"></div>
          </div>
        </div>
        <div class="menu-sub-item" id="menu-save">Save</div>
        <div class="menu-sub-item menu-sub-parent" id="menu-export">Export
          <span class="menu-sub-arrow">${ICON_CHEVRON_RIGHT}</span>
          <div class="app-bar-submenu menu-flyout" id="export-sub">
            <div class="menu-sub-item" id="menu-download">Download .crumb</div>
            <div class="menu-sub-item" id="menu-embed">Generate map embed</div>
          </div>
        </div>
        <div class="menu-sub-sep"></div>
        <div class="menu-sub-item" id="menu-revert">Revert changes</div>
        <div class="menu-sub-item" id="menu-delete">Delete</div>
      </div>
    </div>

    <div class="app-bar-sep"></div>

    <!-- History -->
    <button class="app-bar-icon-btn" id="menu-undo" title="Undo" aria-label="Undo">${ICON_UNDO}</button>
    <button class="app-bar-icon-btn" id="menu-redo" title="Redo" aria-label="Redo">${ICON_REDO}</button>

    <div class="app-bar-sep"></div>

    <!-- Help → landing page -->
    <a class="app-bar-icon-btn" id="menu-help" href="index.html" target="_blank" rel="noopener" title="About Crumb" aria-label="About Crumb">${ICON_HELP}</a>
  </div>
  <input type="file" id="open-file-input" accept=".crumb,.yaml,.yml,.txt,.md" style="display:none">` : ""

  const modalsDom = includeEditor ? `
  <!-- Generate map embed modal -->
  <div class="modal-overlay" id="embed-modal">
    <div class="modal-box">
      <button class="modal-x" id="embed-close-x">${ICON_CLOSE}</button>
      <div class="modal-header">
        <div class="modal-title">Embed this map</div>
        <div class="modal-description">Paste this snippet into any web page. It loads the map from this site's <code>embed.html</code> and passes your current itinerary in — so the page must be served over http(s).</div>
      </div>
      <div class="modal-body">
        <textarea
          id="embed-snippet"
          class="embed-snippet"
          readonly
          spellcheck="false"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="action-btn primary" id="embed-copy-btn">Copy snippet</button>
      </div>
    </div>
  </div>

  <!-- Generate with AI modal -->
  <div class="modal-overlay" id="generate-modal">
    <div class="modal-box">
      <button class="modal-x" id="generate-close-x">${ICON_CLOSE}</button>
      <div class="modal-header">
        <div class="modal-title">Generate with AI</div>
        <div class="modal-description">Open this prompt in ChatGPT or Claude (or copy it into any assistant). It has the AI read the Crumb format, ask a few questions about your trip, then write the file — paste the result back into the editor.</div>
      </div>
      <div class="modal-body">
        <!-- Prompt text + ChatGPT/Claude deeplinks are filled by app-menus.ts (editor
             bundle) so the prompt stays out of the viewer/embed render bundle. -->
        <div class="ref-prompt-block">
          <div class="ref-prompt-head">
            <span class="ref-prompt-label">The prompt</span>
            <button class="prompt-copy-btn" id="copy-prompt-btn" aria-label="Copy prompt" title="Copy prompt">${ICON_COPY}</button>
          </div>
          <div class="ref-prompt-text ref-prompt-text--prompt" id="ai-prompt-text"></div>
        </div>
        <div class="modal-launch-row" id="ai-launch-row"></div>
        <p class="modal-fallback">Your assistant can't open links? <button class="linklike" id="dl-guide-btn">Download the guide</button> and upload it instead.</p>
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
    window.__CRUMB_SPEC     = ${jsonForScript(options.specContent ?? "")};
    window.__CRUMB_FOR_AI   = ${jsonForScript(options.aiGuideContent ?? "")};` : ""

  const editorScript = includeEditor ? `\n  <script>${options.editorBundle}</script>` : ""

  const geoGlobals = options.geoData ? `
    window.__CRUMB_GEO_DATA = ${jsonForScript(options.geoData)};${options.geoMode ? `\n    window.__CRUMB_GEO_MODE = ${jsonForScript(options.geoMode)};` : ""}` : ""

  const embedGlobals = options.embed ? `
    window.__CRUMB_EMBED = true;` : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" integrity="sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V" crossorigin="anonymous" />
  <style>${CSS}</style>
</head>
<body${options.embed ? ` class="embed"` : ""}>
  <!-- Main split view: editor pane (menus + code) | draggable splitter | map -->
  <div id="main">${includeEditor ? `
    <!-- Editor pane (left split): menus sit only atop the code side -->
    <div id="editor-pane">${appBarDom}${editorBodyDom}
    </div>
    <div id="editor-splitter" title="Drag to resize"></div>` : ""}
    <!-- Map (fills remaining area; sidebar floats inside it) -->
    <div id="map">
      <!-- Floating sidebar panel (desktop) / bottom sheet (mobile) -->
      <div id="sidebar">
        <div id="sheet-handle"><div class="sheet-handle-bar"></div></div>
        <div id="panel-nav"></div>
        <div id="panel-content">${panelBody}</div>
        <div id="panel-footer"></div>
      </div>
    </div>${options.embed ? `\n    <div id="embed-card-legend"></div>` : ""}${includeEditor ? `
    <!-- Mobile-only editor/map toggle (top-right of the screen) -->
    <button id="editor-mobile-toggle" aria-label="Toggle editor / map">
      <span class="ic-map">${ICON_MAP}</span><span class="ic-code">${ICON_CODE}</span>
    </button>` : ""}

  </div>
${modalsDom}
  <!-- Geocoding status chip -->
  <div id="map-status" class="map-status-chip"></div>

  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" integrity="sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj" crossorigin="anonymous"></script>
  <script>${options.crumbBundle}</script>
  <script>
    window.__CRUMB_DATA   = ${docJson};${editorGlobals}${geoGlobals}${embedGlobals}
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
  // decorateTransportWaypoints() in viewer-app — it owns link/icon/spinner state.
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
