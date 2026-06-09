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
.landing-h1   { font-size: clamp(40px, 7vw, 64px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.05; margin: 0; text-wrap: balance; }
.landing-lede { font-size: clamp(17px, 2.2vw, 21px); color: var(--text-secondary); line-height: 1.55; max-width: 46ch; margin: 16px auto 0; text-wrap: balance; }
.landing-h2   { font-size: clamp(24px, 4vw, 34px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 12px; }
.landing-p    { font-size: var(--text-lg); color: var(--text-secondary); line-height: 1.6; max-width: 56ch; margin: 0; }

.landing-brand { font-family: var(--mono); font-size: 20px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); }

/* ── Section rhythm — airy, no hairline dividers ──────────────────────────── */
.landing-section { padding: 96px 0; }
.landing-hero    { padding: 56px 0 48px; }
@media (max-width: 767px) {
  .landing-section { padding: 64px 0; }
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.hero-head { display: flex; flex-direction: column; text-align: center; }
.hero-nav  { display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }

/* Detail-level pill — centred segmented control at rest; floats (still centred)
   when pinned, so it reads as the same element sliding up. */
.pill-wrap { margin: 28px 0 20px; text-align: center; }
.detail-pill {
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--surface);
  transition: background var(--duration), box-shadow var(--duration);
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
.detail-pill.is-hidden { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(-8px); }

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

/* ── "It's just text" — section-wide code block with a floating copy card ─── */
.text-stage { position: relative; }

.yaml-block {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius-xl) + 12px);   /* concentric with the inset panel, like the hero card */
  background: var(--surface);
  overflow: auto;
  height: min(64vh, 620px);          /* same height logic as the embed map card */
}

/* Heading sits above the code; the copy floats over the lower-right of it. */
#sec-text .landing-h2 { margin-bottom: 24px; }
/* Styled like the embed's floating sidebar panel, but pinned right. Same 12px
   inset, width, radius, shadow, and solid surface — no border. */
.text-float {
  position: absolute;
  top: 12px; right: 12px; bottom: 12px;
  width: 320px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 32px;
  background: var(--bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sidebar);
  overflow: hidden;
}
.text-float .landing-p + .landing-p { margin-top: 14px; }
.text-float a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
}
.text-float a:hover { border-color: var(--text); }

@media (max-width: 767px) {
  /* Mobile: the panel becomes a bottom sheet rising over the code block (like
     the embed panel does). The stage clips its square bottom corners. */
  .text-stage { overflow: hidden; border-radius: var(--radius-xl); }
  .text-float {
    top: auto; left: 0; right: 0; bottom: 0;
    width: auto;
    padding: 24px;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: var(--shadow-sheet);
  }
  .yaml-block { height: 70vh; border-radius: var(--radius-xl); }
}
.yaml-block pre { margin: 0; padding: 20px; }
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

/* ── Example cards ────────────────────────────────────────────────────────── */
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 28px; }
.example-card {
  display: block;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg);
  text-decoration: none;
  color: inherit;
  transition: transform var(--duration), border-color var(--duration), background var(--duration);
}
.example-card:hover { transform: translateY(-2px); border-color: var(--primary); background: var(--surface); }
/* Full-bleed thumbnail placeholder — a real map preview lands here later. */
.example-card-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--muted-bg);
  border-bottom: 1px solid var(--border);
}
.example-card-body  { padding: 16px 20px; }
.example-card-title { font-size: var(--text-lg); font-weight: 600; }
.example-card-desc  { font-size: var(--text-sm); color: var(--muted); margin-top: 4px; }

/* ── "Give it a try" paths ────────────────────────────────────────────────── */
.try-list { display: grid; gap: 28px; margin-top: 28px; }
@media (min-width: 768px) { .try-list { grid-template-columns: 1fr 1fr; gap: 28px 40px; } }
.try-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  margin-bottom: 14px;
}
.try-item-icon .crumb-icon { width: 18px; height: 18px; }
.try-item-title { font-size: var(--text-lg); font-weight: 600; margin-bottom: 6px; }
.try-item-desc  { font-size: var(--text-base); color: var(--text-secondary); line-height: 1.6; }
.try-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 8px 16px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
  text-decoration: none;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: transform var(--duration), border-color var(--duration), background var(--duration);
}
.try-link:hover { transform: translateY(-1px); border-color: var(--primary); background: var(--surface); }
.try-link.is-disabled { color: var(--muted); background: var(--muted-bg); border-style: dashed; pointer-events: none; }

/* ── Footer ───────────────────────────────────────────────────────────────── */
.landing-footer { padding: 40px 0; }
.landing-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.footer-links { display: flex; gap: 20px; }
.footer-links a { font-size: var(--text-sm); color: var(--text-secondary); text-decoration: none; }
.footer-links a:hover { color: var(--text); }
.footer-brand { font-size: var(--text-sm); color: var(--muted); }
`
