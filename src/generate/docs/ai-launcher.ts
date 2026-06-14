/**
 * The "Generate your crumb" launcher embedded in the AI Authoring Guide page
 * (spec/reference/using-ai.md). Build-time only (node), like the rest of the docs
 * generators — it produces an HTML widget injected into that doc's body by
 * build-site.ts (which replaces the `<!-- ai-launcher -->` marker).
 *
 * The prompt and deeplinks come from shared/ai-prompt.ts (the single source of truth
 * shared with the editor's Generate-with-AI modal). The box shows AI_PROMPT escaped;
 * the buttons reuse the docs page's delegated handlers in app-docs.ts
 * (`data-copy-target` for the prompt, `data-download` for the spec).
 */

import { escape }                               from "../../shared/format"
import { AI_PROMPT, AI_DEEPLINKS, aiDeeplinkUrl } from "../../shared/ai-prompt"

/** HTML for the prompt box + action row injected into the AI guide body. */
export function renderAiLauncher(): string {
  const links = AI_DEEPLINKS.map(d =>
    `<a class="doc-action" href="${escape(aiDeeplinkUrl(d.base))}" target="_blank" rel="noopener">${d.label} ↗</a>`
  ).join("\n      ")

  return `<div class="ai-launcher">
    <pre class="doc-code" id="ai-prompt"><code>${escape(AI_PROMPT)}</code></pre>
    <div class="ai-launcher-actions">
      <button class="doc-action doc-action--ghost" data-copy-target="ai-prompt">Copy prompt</button>
      <button class="doc-action doc-action--ghost" data-download="doc-ai-guide">Download the guide</button>
      ${links}
    </div>
  </div>`
}
