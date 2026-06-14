/**
 * Landing page renderer. Produces the self-contained `index.html`: hero with the
 * detail-level pill + embedded-map <iframe>, the "it's just text" YAML reveal,
 * the example gallery, the "give it a try" paths, and the footer.
 *
 * The page is a normal scrolling document (not the app shell) — it reuses the
 * design tokens via CSS + landingCSS and ships only the small landing bundle. The
 * live map lives in embed.html, loaded in the hero <iframe>. The copy in the markup
 * below is the source of truth.
 */

import { CSS }           from "../css"
import { landingCSS }    from "./landing-css"
import { escape, jsonForScript } from "../../shared/format"
import { highlightYaml } from "./yaml-highlight"
import { ICON_SPARKLES, ICON_PENCIL, ICON_CODE, ICON_WRENCH, ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, ICON_FILE } from "../../shared/icons"

export interface LandingStage {
  label:  string   // "Sketch" | "Planned" | "Detailed"
  file:   string   // example filename, shown as the code tab (e.g. japan-sketch.crumb)
  source: string   // raw .crumb YAML — shown in the "it's just text" block AND posted to the hero embed
  geo:    Record<string, { lat: number; lng: number }>  // baked geo-cache, posted with the source
}

export interface LandingLinks {
  editor:  string  // live editor page (cards deep-link with ?example=)
  docs:    string  // documentation page (docs.html; deep-linked with #doc-… anchors)
  spec:    string  // crumb-spec.md
  aiGuide: string  // crumb-for-ai.md
  github:  string
}

export interface LandingExample {
  key:    string   // filename minus .crumb — used for the card's aria-label
  file:   string   // example filename for the ?example= editor deep link
  source: string   // raw .crumb YAML, posted inline to the card embed
  geo:    Record<string, { lat: number; lng: number }>  // baked geo-cache, posted with the source
}

export interface LandingOptions {
  landingBundle: string
  stages:        LandingStage[]    // [sketch, planning, full]
  links:         LandingLinks
  examples:      LandingExample[]  // gallery cards (Lisbon / Copenhagen / SE Asia)
  defaultStage?: number            // index shown on load (default 0 = Sketch)
}

export function renderLandingHtml(opts: LandingOptions): string {
  const def = opts.defaultStage ?? 0
  const yamlHtml = opts.stages.map(s => highlightYaml(s.source))

  const pillOpts = opts.stages.map((s, i) =>
    `<button class="pill-opt${i === def ? " is-active" : ""}" role="tab" aria-selected="${i === def}">${escape(s.label)}</button>`
  ).join("")

  // Each card is one shared embed (embed.html?card) fed its crumb + geo inline via
  // postMessage (entries/landing) — no external .crumb fetch. The <a> carries the
  // a11y label since the visible title lives inside the iframe.
  const cards = opts.examples.map(e => {
    const label = e.key.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    return `<a class="example-card" href="${escape(opts.links.editor)}?example=${encodeURIComponent(e.file)}&view=map" aria-label="Open ${escape(label)} in the editor">
        <iframe class="example-card-frame" src="embed.html?card" title="${escape(label)} map" loading="lazy" tabindex="-1"></iframe>
      </a>`
  }).join("\n      ")

  const tryItems = [
    { icon: ICON_SPARKLES, title: "Generate one with AI",
      desc: "A crumb is just plain text with a simple vocabulary, so an AI can write a whole itinerary from a chat. Give it the format guide and describe your trip.",
      link: { label: "The AI authoring guide", href: `${opts.links.docs}#doc-ai-guide` } },
    { icon: ICON_PENCIL, title: "Open it in the live editor",
      desc: "Paste a crumb, yours or one an AI wrote, and watch it turn into a live map and timeline as you type. Load existing files and save your edits back out.",
      link: { label: "Live editor", href: opts.links.editor } },
    { icon: ICON_CODE, title: "Embed it anywhere",
      desc: "A crumb's interactive map is fully self-contained, so you can drop it into your own site or blog as a single HTML embed, with nothing to set up.",
      link: { label: "How to embed", href: `${opts.links.docs}#doc-embedding` } },
    { icon: ICON_WRENCH, title: "Build your own view",
      desc: "Build a brand-new way to display a crumb, or extend an existing one into the view you have in mind. The format is fully specified, with a reference parser to build on.",
      link: { label: "Spec & parser reference", href: `${opts.links.docs}#doc-parser` } },
  ].map(t => {
    const link = t.link.href
      ? `<a class="try-link" href="${escape(t.link.href)}">${escape(t.link.label)}</a>`
      : `<span class="try-link is-disabled">${escape(t.link.label)} (coming soon)</span>`
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
  <style>${CSS}
${landingCSS}</style>
</head>
<body class="landing">

  <!-- Hero -->
  <header class="landing-hero">
    <div class="landing-wrap hero-head">
      <div class="hero-nav"><span class="landing-brand">crumb</span></div>
      <h1 class="landing-h1">An open format for trip itineraries</h1>
      <p class="landing-lede">A list of a few cities, or a fully timed schedule with every activity. You add detail as plans take shape.</p>

      <div class="pill-wrap">
        <span class="pill-scale pill-scale--left" aria-hidden="true">
          <span class="pill-label">Less detail</span>
          <span class="pill-arrow pill-arrow--left">${ICON_CHEVRON_LEFT}</span>
          <span class="pill-sign">&minus;</span>
        </span>
        <div class="detail-pill" id="detail-pill" role="tablist" aria-label="Level of detail"><span class="pill-thumb" aria-hidden="true"></span>${pillOpts}</div>
        <span class="pill-scale pill-scale--right" aria-hidden="true">
          <span class="pill-sign">+</span>
          <span class="pill-arrow pill-arrow--right">${ICON_CHEVRON_RIGHT}</span>
          <span class="pill-label">More detail</span>
        </span>
      </div>

      <div class="hero-card">
        <iframe id="hero-frame" class="hero-frame" src="embed.html" title="Live Crumb map" allow="fullscreen" allowfullscreen></iframe>
      </div>
    </div>
  </header>

  <!-- It's just text -->
  <section class="landing-section" id="sec-text">
    <div class="landing-wrap">
      <div class="text-cols">
        <h2 class="landing-h2">It's just text</h2>
        <p class="text-body-p">The map above comes from this plain-text file, written in YAML with a handful of simple fields.</p>
        <div class="text-col">
          <p class="text-body-p">You can read it in any text editor, keep it in a folder, or send it to a friend like any other message.</p>
          <p class="text-body-p">The format was designed with half-formed plans in mind, so details and dates can stay as vague as yours, and it still works out a timeline.</p>
          <a class="text-doc-btn" href="${escape(opts.links.docs)}">Read the documentation</a>
        </div>
        <div class="yaml-block">
          <div class="yaml-head">${ICON_FILE}<span id="yaml-file">${escape(opts.stages[def].file)}</span></div>
          <pre><code id="yaml-code">${yamlHtml[def]}</code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Different ways of using it -->
  <section class="landing-section">
    <div class="landing-wrap">
      <div class="text-cols ways-cols">
        <h2 class="landing-h2">Different ways of using it</h2>
        <p class="text-body-p">The same format carries a city guide, a weekend away, or months on the road.</p>
        <div class="text-col">
          <p class="text-body-p">And it isn't bound to one look. The same crumb can be displayed as one large interactive map, or a list of small cards like these.</p>
          <p class="text-body-p">Because the format is open, you can build any other view you imagine.</p>
        </div>
        <div class="card-stack">
        ${cards}
        </div>
      </div>
    </div>
  </section>

  <!-- Give it a try -->
  <section class="landing-section section-tint">
    <div class="landing-wrap">
      <h2 class="landing-h2">Give it a try</h2>
      <p class="text-body-p">A few ways in, for travelers and builders alike.</p>
      <div class="try-list">
      ${tryItems}
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="landing-footer">
    <div class="landing-wrap landing-footer-inner">
      <span class="footer-brand">Leave a trail</span>
    </div>
  </footer>

  <script>
    window.__CRUMB_LANDING = {
      yaml: ${jsonForScript(yamlHtml)},
      files: ${jsonForScript(opts.stages.map(s => s.file))},
      defaultStage: ${def},
      hero: ${jsonForScript(opts.stages.map(s => ({ crumb: s.source, geo: s.geo })))},
      cards: ${jsonForScript(opts.examples.map(e => ({ crumb: e.source, geo: e.geo })))}
    };
  </script>
  <script>${opts.landingBundle}</script>
</body>
</html>`
}
