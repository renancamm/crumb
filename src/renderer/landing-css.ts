/**
 * Landing-page-only styles. Reuses the design tokens from css.ts (colours, radius,
 * fonts, motion) and adds what the app's utilitarian scale lacks: larger display
 * type, a scrolling page layout, the hero card, the detail-level pill, example
 * cards, the YAML block, and the footer.
 *
 * Visual direction (see LANDING_PAGE.md): technical, minimal, humble; Vercel-
 * referenced; colour only from the embedded map; hairline borders over shadows;
 * dark mode inherited from the app tokens.
 */

export const landingCSS = `
/* ── Page document: override the app's full-height app-shell base ──────────── */
html.landing, body.landing { height: auto; overflow: visible; }
body.landing {
  display: block;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
.landing-wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

/* Landing display type — beyond the app's --text-xl (30px) ceiling. */
.landing-h1   { font-size: clamp(38px, 7vw, 64px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.05; margin: 0 auto; max-width: 20ch; text-wrap: balance; }
.landing-lede { font-size: clamp(17px, 2.2vw, 21px); color: var(--text-secondary); line-height: 1.55; max-width: 46ch; margin: 16px auto 0; text-wrap: balance; }
.landing-h2   { font-size: clamp(24px, 4vw, 34px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 12px; }

.landing-brand { font-family: var(--mono); font-size: 20px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); }

/* ── Section rhythm — airy, no hairline dividers ──────────────────────────── */
.landing-section { padding: 140px 0; }
.landing-hero    { padding: 56px 0 48px; }
@media (max-width: 767px) {
  .landing-section { padding: 88px 0; }
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.hero-head { display: flex; flex-direction: column; text-align: center; }
.hero-nav  { display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }

/* Detail-level pill — centred segmented control at rest; floats (still centred)
   when pinned, so it reads as the same element sliding up. */
/* Orange simpler→more-detailed scale. The pill stays dead-centre (1fr | auto | 1fr
   grid, so unequal labels never shift it); each side is a label + a small chevron
   whose shaft fades toward the pill. */
.pill-wrap {
  margin: 48px 0 20px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0;
}
.pill-scale { display: inline-flex; align-items: center; gap: 6px; color: var(--activity); font-size: var(--text-sm); font-weight: 500; transition: opacity 0.25s ease, transform 0.25s ease; }
.pill-scale--left  { justify-self: end; }
.pill-scale--right { justify-self: start; }
.pill-label { white-space: nowrap; font-family: "Caveat", cursive; font-size: 22px; font-weight: 600; line-height: 1; position: relative; top: -1px; }
.pill-arrow { position: relative; display: inline-flex; align-items: center; width: 46px; height: 16px; }
.pill-arrow--left  { justify-content: flex-start; }
.pill-arrow--right { justify-content: flex-end; }
.pill-arrow .crumb-icon { position: relative; z-index: 1; width: 15px; height: 15px; stroke-width: 2.5; }
.pill-arrow::before {
  content: "";
  position: absolute;
  top: 50%; height: 2px;
  transform: translateY(-50%);
}
.pill-arrow--left::before  { left: 5px; right: 0; background: linear-gradient(to right, var(--activity), transparent); }
.pill-arrow--right::before { left: 0; right: 5px; background: linear-gradient(to left,  var(--activity), transparent); }
/* Handwritten −/+ shown in place of the arrow+label on mobile. */
.pill-sign { display: none; font-family: "Caveat", cursive; font-size: 40px; font-weight: 700; line-height: 1; color: var(--activity); padding: 0 12px; position: relative; top: -2px; }
/* Optical nudge: Caveat's left bearing on "More"/"+" reads as a wider gap on the
   right than the left's trailing "s"/"−"; pull the right side back to match. */
.pill-scale--right .pill-label { margin-left: -3px; }
.pill-scale--right .pill-sign  { padding-left: 8px; }
/* Hide the scale while the pill is floating (pinned) — it belongs to the hero. */
.pill-wrap:has(.detail-pill.is-pinned) .pill-scale { opacity: 0; transform: translateY(-4px); }
@media (max-width: 559px) {
  .pill-label, .pill-arrow { display: none; }
  .pill-sign { display: inline-block; }
}
.detail-pill {
  grid-column: 2;   /* stay in the centre track even when the scales are display:none (mobile) */
  justify-self: center;
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--surface);
  transition: background var(--duration), box-shadow var(--duration), opacity 0.25s ease;
}
.pill-opt {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  padding: 7px 18px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--duration), color var(--duration);
}
.pill-opt:hover { color: var(--text); }
.pill-opt.is-active { background: var(--primary); color: var(--primary-fg); }

/* Pinned: detached, compact, floating at the top edge. */
.detail-pill.is-pinned {
  position: fixed;
  top: 14px; left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-menu);
  background: var(--bg);
  box-shadow: var(--shadow-md);
}
.detail-pill.is-hidden { opacity: 0; pointer-events: none; }

/* Hero map card — reads as a big embedded map; rounded, hairline, no shadow. */
.hero-card {
  border: 1px solid var(--border);
  /* panel radius + its 12px inset, so the inner panel corners nest concentrically */
  border-radius: calc(var(--radius-xl) + 12px);
  overflow: hidden;
  background: var(--surface);
  height: min(64vh, 620px);
}
.hero-frame { display: block; width: 100%; height: 100%; border: 0; }
@media (max-width: 767px) {
  .hero-card { height: 70vh; border-radius: var(--radius-xl); }
}

/* ── "It's just text" — copy column beside a fixed-height code block ──────── */
/* Four grid children — heading, lede (1st paragraph), body (rest), visual —
   placed by named areas. On mobile the visual sits between the lede and the body
   (title → lede → visual → body); on desktop heading + lede + body stack on the
   left and the visual spans the right. */
.text-cols {
  display: grid;
  gap: 32px;
  grid-template-areas: "title" "lede" "visual" "body";
}
.text-cols > .landing-h2  { grid-area: title; margin: 0 0 8px; }
.text-cols > .text-body-p { grid-area: lede; }
.text-cols > .text-col    { grid-area: body; }
.text-cols > .yaml-block,
.text-cols > .card-stack  { grid-area: visual; }
@media (min-width: 820px) {
  .text-cols {
    grid-template-columns: 1fr 1fr;
    /* Trailing 1fr spacer row absorbs the visual's extra height, so the text rows
       stay at content size and their gaps don't stretch with the visual. */
    grid-template-rows: auto auto auto 1fr;
    grid-template-areas:
      "title visual"
      "lede  visual"
      "body  visual"
      ".     visual";
    column-gap: 56px;
    row-gap: 16px;
    align-items: start;
  }
}
/* Mobile: tuck the first paragraph closer to the heading (the other stacked gaps
   keep the 24px grid gap). */
@media (max-width: 819px) {
  .text-cols > .landing-h2 { margin-bottom: -10px; }
}
.text-col { display: flex; flex-direction: column; align-items: flex-start; }
.text-body-p { font-size: clamp(17px, 2.2vw, 21px); color: var(--text-secondary); line-height: 1.6; margin: 0; max-width: 46ch; }
.text-body-p + .text-body-p { margin-top: 16px; }
.text-doc-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 24px;
  padding: 11px 24px;
  font-size: 15px;
  font-weight: 500;
  color: var(--primary-fg);
  text-decoration: none;
  background: var(--primary);
  border: 1px solid var(--primary);
  border-radius: var(--radius-full);
  transition: transform var(--duration), background var(--duration), border-color var(--duration);
}
.text-doc-btn:hover { transform: translateY(-1px); background: var(--primary-hover); border-color: var(--primary-hover); }

.yaml-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  overflow: hidden;
  height: min(58vh, 460px);
}
.yaml-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  font-family: var(--mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.yaml-head .crumb-icon { width: 15px; height: 15px; color: var(--muted); }

@media (max-width: 819px) { .yaml-block { height: 340px; } }
.yaml-block pre { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 20px; }
.yaml-block code {
  font-family: var(--mono);
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text);
  white-space: pre;
}
.yml-k { color: var(--text); font-weight: 500; }
.yml-v { color: var(--text-secondary); }
.yml-c { color: var(--muted); font-style: italic; }
.yml-p { color: var(--muted); }
.yml-s { color: var(--text-secondary); }   /* block-scalar body (note text), not parsed as YAML */

/* ── Example cards ────────────────────────────────────────────────────────── */
/* Section splits in two: heading + copy in the left column, a vertical stack of
   cards on the right. Inherits .text-cols' 1fr 1fr so the cards column lines up
   with the "It's just text" code block. */
.card-stack { display: flex; flex-direction: column; gap: 12px; }
.example-card {
  display: block;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg);
  text-decoration: none;
  color: inherit;
  transition: transform var(--duration), border-color var(--duration), background var(--duration);
}
.example-card:hover { transform: translateY(-2px); border-color: var(--primary); background: var(--surface); }
/* The whole card is one real embed (embed.html?…&card): map on the left, the
   trip-overview panel as a legend on the right. Inert so the card stays a single
   link to the editor. */
.example-card-frame {
  display: block;
  width: 100%;
  aspect-ratio: 7 / 2;
  border: 0;
  pointer-events: none;
  background: var(--muted-bg);
}

/* ── "Give it a try" paths ────────────────────────────────────────────────── */
.try-list { display: grid; gap: 56px; margin-top: 40px; }
@media (min-width: 768px) { .try-list { grid-template-columns: 1fr 1fr; gap: 56px 40px; } }
.try-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  margin-bottom: 16px;
}
.try-item-icon .crumb-icon { width: 19px; height: 19px; }
.try-item-title { font-size: clamp(18px, 2.1vw, 20px); font-weight: 600; margin-bottom: 8px; }
.try-item-desc  { font-size: clamp(15px, 1.7vw, 16px); color: var(--text-secondary); line-height: 1.6; }
.try-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
  padding: 9px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-fg);
  text-decoration: none;
  background: var(--primary);
  border: 1px solid var(--primary);
  border-radius: var(--radius-full);
  transition: transform var(--duration), background var(--duration), border-color var(--duration);
}
.try-link:hover { transform: translateY(-1px); background: var(--primary-hover); border-color: var(--primary-hover); }
.try-link.is-disabled { color: var(--muted); background: var(--muted-bg); border-color: var(--muted-bg); pointer-events: none; }

/* Light-gray band from "Give it a try" through the footer to the page end. */
.section-tint, .landing-footer { background: var(--muted-bg); }
/* Soft, uneven transition into the gray band. A full-width linear fade is the base
   (uniform across the width, so it never seams at the sides); two soft radials lift
   it unevenly — taller on the left, a gentle bump on the right — and all layers fade
   to transparent, so nothing reads as a hard edge. Gradient falloff, not blur(). */
.section-tint { position: relative; margin-top: 160px; padding-top: 8px; }
.section-tint > .landing-wrap { position: relative; z-index: 1; }
.section-tint::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  top: -300px;
  height: 304px;   /* bottom lands on the section's top edge so solid meets solid — no step */
  background:
    radial-gradient(95% 135% at 15% 100%, var(--muted-bg) 22%, transparent 70%),
    radial-gradient(48% 62% at 78% 100%, var(--muted-bg) 20%, transparent 60%),
    linear-gradient(to top, var(--muted-bg) 0%, var(--muted-bg) 5%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.landing-footer { padding: 80px 0; }
.landing-footer-inner { display: flex; justify-content: center; text-align: center; }
.footer-brand { font-family: var(--mono); font-size: clamp(15px, 1.8vw, 17px); letter-spacing: -0.02em; color: var(--muted); }
`
