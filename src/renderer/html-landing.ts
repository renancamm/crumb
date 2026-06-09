/**
 * Landing page renderer. Produces the self-contained `index.html`: hero with the
 * detail-level pill + embedded-map <iframe>, the "it's just text" YAML reveal,
 * the example gallery, the "give it a try" paths, and the footer.
 *
 * The page is a normal scrolling document (not the app shell) — it reuses the
 * design tokens via CSS + landingCSS and ships only the small landing bundle. The
 * live map lives in embed.html, loaded in the hero <iframe>. Copy is the source of
 * truth in LANDING_PAGE.md.
 */

import { CSS }           from "./css"
import { landingCSS }    from "./landing-css"
import { escape }        from "./format"
import { highlightYaml } from "./yaml-highlight"
import { ICON_SPARKLES, ICON_PENCIL, ICON_CODE, ICON_WRENCH } from "./icons"

export interface LandingStage {
  label:  string   // "Sketch" | "Planned" | "Full"
  source: string   // raw .crumb YAML, shown in the "it's just text" block
}

export interface LandingLinks {
  editor:  string  // live editor page (cards deep-link with ?example=)
  spec:    string  // CRUMB_SPEC.md
  aiGuide: string  // CRUMB_FOR_AI.md
  github:  string
}

export interface LandingOptions {
  landingBundle: string
  stages:        LandingStage[]   // [sketch, planning, full]
  links:         LandingLinks
  defaultStage?: number           // index shown on load (default 0 = Sketch)
}

const EXAMPLES = [
  { title: "Lisbon",         desc: "a single-city guide",     file: "lisbon-guide.crumb" },
  { title: "Copenhagen",     desc: "a weekend",               file: "copenhagen-weekend.crumb" },
  { title: "Southeast Asia", desc: "months of backpacking",   file: "southeast-asia.crumb" },
]

export function renderLandingHtml(opts: LandingOptions): string {
  const def = opts.defaultStage ?? 0
  const yamlHtml = opts.stages.map(s => highlightYaml(s.source))

  const pillOpts = opts.stages.map((s, i) =>
    `<button class="pill-opt${i === def ? " is-active" : ""}" role="tab" aria-selected="${i === def}">${escape(s.label)}</button>`
  ).join("")

  const cards = EXAMPLES.map(e =>
    `<a class="example-card" href="${escape(opts.links.editor)}?example=${encodeURIComponent(e.file)}">
        <div class="example-card-thumb" aria-hidden="true"></div>
        <div class="example-card-body">
          <div class="example-card-title">${escape(e.title)}</div>
          <div class="example-card-desc">${escape(e.desc)}</div>
        </div>
      </a>`
  ).join("\n      ")

  const tryItems = [
    { icon: ICON_SPARKLES, title: "Generate one with AI",
      desc: "Because a crumb is just plain text with a simple vocabulary, an AI can write a whole itinerary from a chat, and tweak it when plans change. Give it the format guide, describe your trip, and see what comes back.",
      link: { label: "The authoring guide", href: opts.links.aiGuide } },
    { icon: ICON_PENCIL, title: "Open it in the live editor",
      desc: "Paste a crumb, yours or one an AI wrote, and watch it turn into a map and a timeline as you type.",
      link: { label: "Live editor", href: opts.links.editor } },
    { icon: ICON_CODE, title: "Embed it anywhere",
      desc: "A crumb's interactive map is self-contained, so you can drop it straight into your own site or blog as a single HTML embed.",
      link: { label: "How to embed (coming soon)", href: null } },
    { icon: ICON_WRENCH, title: "Build your own",
      desc: "The format is open and fully specified. This parser is just one implementation, so read the spec and build your own viewer, exporter, or whatever you need.",
      link: { label: "Spec & parser reference", href: opts.links.spec } },
  ].map(t => {
    const link = t.link.href
      ? `<a class="try-link" href="${escape(t.link.href)}">${escape(t.link.label)} →</a>`
      : `<span class="try-link is-disabled">${escape(t.link.label)}</span>`
    return `<div class="try-item">
        <div class="try-item-icon" aria-hidden="true">${t.icon}</div>
        <div class="try-item-title">${escape(t.title)}</div>
        <div class="try-item-desc">${escape(t.desc)}</div>
        ${link}
      </div>`
  }).join("\n      ")

  return `<!DOCTYPE html>
<html lang="en" class="landing">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crumb · Leave a trail</title>
  <meta name="description" content="Crumb is an open format for trip itineraries: a plain-text document that turns a list of places into an interactive map.">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <style>${CSS}
${landingCSS}</style>
</head>
<body class="landing">

  <!-- Hero -->
  <header class="landing-hero">
    <div class="landing-wrap hero-head">
      <div class="hero-nav"><span class="landing-brand">crumb</span></div>
      <h1 class="landing-h1">An open format for trip itineraries</h1>
      <p class="landing-lede">A list of a few cities, or a fully-timed schedule with every activity. You add detail as plans take shape.</p>

      <div class="pill-wrap">
        <div class="detail-pill" id="detail-pill" role="tablist" aria-label="Level of detail">${pillOpts}</div>
      </div>

      <div class="hero-card">
        <iframe id="hero-frame" class="hero-frame" src="embed.html" title="Live Crumb map" allow="fullscreen" allowfullscreen></iframe>
      </div>
    </div>
  </header>

  <!-- It's just text -->
  <section class="landing-section" id="sec-text">
    <div class="landing-wrap">
      <h2 class="landing-h2">It's just text</h2>
      <div class="text-stage">
        <div class="text-float">
          <p class="landing-p">The trip above is just plain text. Under the hood, that's YAML, a handful of simple fields.</p>
          <p class="landing-p">You can read it in any text editor, keep it in a folder, or send it to a friend like any other message.</p>
          <p class="landing-p">And like a recipe, a crumb is meant to be shared and made your own. Take someone else's trip, remix it into yours, and pass it on.</p>
          <p class="landing-p"><a href="${escape(opts.links.spec)}">Learn the format in the documentation →</a></p>
        </div>
        <div class="yaml-block"><pre><code id="yaml-code">${yamlHtml[def]}</code></pre></div>
      </div>
    </div>
  </section>

  <!-- Different ways of using it -->
  <section class="landing-section">
    <div class="landing-wrap">
      <h2 class="landing-h2">Different ways of using it</h2>
      <p class="landing-p">The same format works for a single afternoon or months of travel. Check a few examples:</p>
      <div class="card-grid">
      ${cards}
      </div>
    </div>
  </section>

  <!-- Give it a try -->
  <section class="landing-section">
    <div class="landing-wrap">
      <h2 class="landing-h2">Give it a try</h2>
      <div class="try-list">
      ${tryItems}
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="landing-footer">
    <div class="landing-wrap landing-footer-inner">
      <span class="footer-brand">Leave a trail</span>
      <nav class="footer-links">
        <a href="${escape(opts.links.editor)}">Live editor</a>
        <a href="${escape(opts.links.spec)}">Spec</a>
        <a href="${escape(opts.links.github)}">GitHub</a>
      </nav>
    </div>
  </footer>

  <script>
    window.__CRUMB_LANDING = { yaml: ${JSON.stringify(yamlHtml)}, defaultStage: ${def} };
  </script>
  <script>${opts.landingBundle}</script>
</body>
</html>`
}
