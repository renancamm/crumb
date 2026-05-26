/**
 * Lucide icons — inline SVG strings.
 *
 * Each constant is a self-contained <svg> element with class="crumb-icon".
 * Styling (size, stroke, color) is controlled entirely by the .crumb-icon CSS rule
 * in css.ts — no inline style attributes here.
 *
 * Sources: https://lucide.dev  (MIT license)
 * viewBox 0 0 24 24, stroke-linecap/linejoin round are inherited from .crumb-icon.
 */

function icon(inner: string): string {
  return `<svg class="crumb-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`
}

// ─── Transport modes ──────────────────────────────────────────────────────────

export const ICON_PLANE = icon(
  `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>`
)

export const ICON_TRAIN = icon(
  `<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/>` +
  `<path d="m9 15-1-1"/>` +
  `<path d="m15 15 1-1"/>` +
  `<path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/>` +
  `<path d="m8 19-2 3"/>` +
  `<path d="m16 19 2 3"/>`
)

export const ICON_BUS = icon(
  `<path d="M8 6v6"/>` +
  `<path d="M15 6v6"/>` +
  `<path d="M2 12h19.6"/>` +
  `<path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>` +
  `<circle cx="7" cy="18" r="2"/>` +
  `<path d="M9 18h5"/>` +
  `<circle cx="16" cy="18" r="2"/>`
)

export const ICON_CAR = icon(
  `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>` +
  `<circle cx="7" cy="17" r="2"/>` +
  `<path d="M9 17h6"/>` +
  `<circle cx="17" cy="17" r="2"/>`
)

export const ICON_SHIP = icon(
  `<path d="M12 10.189V14"/>` +
  `<path d="M12 2v3"/>` +
  `<path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>` +
  `<path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/>` +
  `<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>`
)

export const ICON_WALK = icon(
  `<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/>` +
  `<path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>` +
  `<path d="M16 17h4"/>` +
  `<path d="M4 13h4"/>`
)

export const ICON_BIKE = icon(
  `<circle cx="18.5" cy="17.5" r="3.5"/>` +
  `<circle cx="5.5" cy="17.5" r="3.5"/>` +
  `<circle cx="15" cy="5" r="1"/>` +
  `<path d="M12 17.5V14l-3-3 4-3 2 3h2"/>`
)

export const ICON_ROUTE = icon(
  `<circle cx="6" cy="19" r="3"/>` +
  `<path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>` +
  `<circle cx="18" cy="5" r="3"/>`
)

// ─── Content ──────────────────────────────────────────────────────────────────

export const ICON_STAY = icon(
  `<path d="M2 4v16"/>` +
  `<path d="M2 8h18a2 2 0 0 1 2 2v10"/>` +
  `<path d="M2 17h20"/>` +
  `<path d="M6 8v9"/>`
)

export const ICON_INFO = icon(
  `<circle cx="12" cy="12" r="10"/>` +
  `<path d="M12 16v-4"/>` +
  `<path d="M12 8h.01"/>`
)

export const ICON_NOTE = icon(
  `<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/>` +
  `<path d="M2 6h4"/>` +
  `<path d="M2 10h4"/>` +
  `<path d="M2 14h4"/>` +
  `<path d="M2 18h4"/>` +
  `<path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>`
)

export const ICON_GLOBE_OFF = icon(
  `<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/>` +
  `<path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/>` +
  `<path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/>` +
  `<circle cx="12" cy="12" r="10"/>` +
  `<line x1="2" y1="2" x2="22" y2="22"/>`
)

// ─── Direction ───────────────────────────────────────────────────────────────

export const ICON_ARRIVES = icon(
  `<polyline points="10 15 15 20 20 15"/>` +
  `<path d="M4 4h7a4 4 0 0 1 4 4v12"/>`
)

export const ICON_DEPARTS = icon(
  `<polyline points="10 9 15 4 20 9"/>` +
  `<path d="M4 20h7a4 4 0 0 0 4-4V4"/>`
)

export const ICON_CORNER_DOWN_RIGHT = icon(
  `<polyline points="15 10 20 15 15 20"/>` +
  `<path d="M4 4v7a4 4 0 0 0 4 4h12"/>`
)

export const ICON_CORNER_UP_RIGHT = icon(
  `<polyline points="15 14 20 9 15 4"/>` +
  `<path d="M4 20v-7a4 4 0 0 1 4-4h12"/>`
)

// ─── Duration ─────────────────────────────────────────────────────────────────

export const ICON_CLOCK = icon(
  `<circle cx="12" cy="12" r="10"/>` +
  `<polyline points="12 6 12 12 16 14"/>`
)

// ─── Priority ─────────────────────────────────────────────────────────────────

export const ICON_PRIORITY_MUST = icon(
  `<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`
)

export const ICON_PRIORITY_MAYBE = icon(
  `<line x1="12" x2="12" y1="2" y2="22"/>` +
  `<line x1="20" x2="4" y1="8" y2="16"/>` +
  `<line x1="20" x2="4" y1="16" y2="8"/>`
)

// ─── Mode → icon lookup ───────────────────────────────────────────────────────

const MODE_ICONS: Record<string, string> = {
  flight:    ICON_PLANE,
  train:     ICON_TRAIN,
  bus:       ICON_BUS,
  car:       ICON_CAR,
  ferry:     ICON_SHIP,
  walk:      ICON_WALK,
  bike:      ICON_BIKE,
  transport: ICON_ROUTE,
}

export function modeIconSvg(mode: string): string {
  return MODE_ICONS[mode] ?? ICON_ROUTE
}
