/**
 * Renderer plugin interface
 *
 * Implement CrumbRenderer to build an alternative renderer (Markdown,
 * plain text, Notion, etc.). Pass a RenderContext for formatting helpers
 * so you don't need to reimplement date/duration display logic.
 *
 * The HTML renderer in html.ts is the reference implementation.
 */

import type {
  CrumbDocument,
  ResolvedDuration,
  ResolvedMoment,
} from "../types/resolved"

/** Minimum interface for a third-party renderer. */
export interface CrumbRenderer {
  render(doc: CrumbDocument, context: RenderContext): string
}

/** Formatting helpers injected into every renderer. All functions are pure. */
export interface RenderContext {
  /** Format a full moment (date + time). */
  formatMoment(m: ResolvedMoment): string
  /** Format only the date portion of a moment. */
  formatMomentDate(m: ResolvedMoment): string
  /** Format only the time portion of a moment. */
  formatMomentTime(m: ResolvedMoment): string
  /** Format a duration (e.g. "2h 30m", "~3 nights"). */
  formatDuration(d: ResolvedDuration): string
  /** Escape a string for safe insertion into HTML. */
  escape(s: string): string
}
