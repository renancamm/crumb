/**
 * Clipboard helper — the async Clipboard API with a synchronous execCommand
 * fallback for non-secure contexts (e.g. file://). Shared by the editor
 * (app-menus.ts) and the docs page (app-docs.ts) so there's one implementation.
 */

export function copyText(text: string, done: () => void): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done))
  } else {
    fallbackCopy(text, done)
  }
}

function fallbackCopy(text: string, done: () => void): void {
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"; ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand("copy"); done() } finally { document.body.removeChild(ta) }
}
