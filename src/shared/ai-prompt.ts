/**
 * The ready-to-use "generate a crumb with AI" prompt, shared by the docs launcher
 * (src/generate/docs/ai-launcher.ts, build-time) and the editor's File → Generate
 * with AI modal (src/generate/html.ts markup + src/app/editor/app-menus.ts, browser).
 *
 * Defined ONCE here so the prompt text and the deeplink URLs can't drift between the
 * two surfaces. Pure data — consumers HTML-escape it themselves at render time.
 */

/** Raw URL of the compact AI prompt — handed to a model that can browse. */
export const RAW_SPEC_URL =
  "https://raw.githubusercontent.com/renancamm/crumb/main/spec/crumb-for-ai.md"

/** The prompt. Tells the model to read the format, interview the user, then emit YAML. */
export const AI_PROMPT =
  `Read the AI guide for the Crumb itinerary format here: ${RAW_SPEC_URL} ` +
  `(if you can't access the link, ask me to upload the spec instead).

Then ask me 3-5 short questions about the trip I'm planning, covering things like ` +
  `destination or region, rough dates or duration, and the overall vibe or focus I'm going for.

Once I've answered, write a valid .crumb file for the trip following the spec exactly. ` +
  `Output it as a fenced YAML code block so I can copy it.`

/**
 * New-chat deeplinks that prefill the prompt via a `?q=` URL parameter. (Gemini has
 * no such parameter, so it's intentionally omitted.) Kept as plain `base` literals —
 * paired with the lazy `aiDeeplinkUrl()` below so this module has no top-level side
 * effects and tree-shakes cleanly out of the viewer/embed render bundle (invariant 11).
 */
export const AI_DEEPLINKS: ReadonlyArray<{ label: string; base: string }> = [
  { label: "Open in ChatGPT", base: "https://chatgpt.com/?q=" },
  { label: "Open in Claude",  base: "https://claude.ai/new?q=" },
]

/** Build a deeplink href: a provider base + the URL-encoded prompt. */
export function aiDeeplinkUrl(base: string): string {
  return base + encodeURIComponent(AI_PROMPT)
}
