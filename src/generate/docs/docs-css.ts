/**
 * Documentation-page styles (docs.html). Reuses the design tokens from css.ts
 * (colours, radius, fonts, motion, z-index) and adds a wiki layout: a sticky top
 * bar with a breadcrumb, a two-region sidebar (an always-visible doc list + the
 * active doc's "On this page" TOC), a uniform per-doc header, and typographic
 * styles for the Markdown rendered by markdown.ts into each `.doc-section`.
 *
 * Visual direction matches the landing: technical, minimal, hairline borders over
 * shadows, dark mode inherited from the app tokens (every colour is a var(--…)).
 * On mobile (≤767px) the sidebar becomes an off-canvas drawer behind a hamburger.
 */

export const docsCSS = `
.docs {
  --docs-topbar-h: 56px;
  --docs-nav-w:    278px;
}

/* Page document: override the app's full-height app-shell base. */
html.docs, body.docs { height: auto; overflow: visible; }
body.docs {
  display: block;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

/* ── Top bar + breadcrumb ─────────────────────────────────────────────────── */
.docs-topbar {
  position: sticky; top: 0; z-index: var(--z-appbar);
  display: flex; align-items: center; gap: 14px;
  height: var(--docs-topbar-h);
  padding: 0 20px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.docs-brand { flex-shrink: 0; font-family: var(--mono); font-weight: 600; font-size: 18px; letter-spacing: -0.02em; color: var(--text); text-decoration: none; }
.docs-crumbs { display: flex; align-items: center; gap: 8px; flex: 0 1 auto; min-width: 0; font-size: var(--text-sm); }
.docs-crumb { color: var(--muted); text-decoration: none; white-space: nowrap; }
a.docs-crumb:hover { color: var(--text); }
.docs-crumb--doc { color: var(--text); font-weight: 500; }
.docs-crumb--head { color: var(--text-secondary); min-width: 0; overflow: hidden; text-overflow: ellipsis; display: none; }
.docs-crumb-sep { color: var(--muted); opacity: 0.55; }
.docs-topbar-link {
  flex-shrink: 0; margin-left: auto;
  font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); text-decoration: none;
  padding: 6px 14px; border: 1px solid var(--border); border-radius: var(--radius-full);
  transition: background var(--duration), color var(--duration), border-color var(--duration);
}
.docs-topbar-link:hover { color: var(--text); background: var(--muted-bg); }
.docs-menu-btn {
  display: none;   /* shown only on mobile */
  align-items: center; justify-content: center;
  width: 36px; height: 36px; margin-left: -6px;
  border: 0; background: transparent; color: var(--text);
  border-radius: var(--radius-sm); cursor: pointer;
}
.docs-menu-btn:hover { background: var(--muted-bg); }

/* ── Shell: sticky two-region sidebar + content ───────────────────────────── */
.docs-shell { display: flex; align-items: flex-start; max-width: 1280px; margin: 0 auto; }
.docs-nav {
  position: sticky; top: var(--docs-topbar-h);
  flex-shrink: 0; width: var(--docs-nav-w);
  height: calc(100vh - var(--docs-topbar-h));
  display: flex; flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.docs-main { flex: 1; min-width: 0; padding: 44px 56px 120px; }

/* Doc list — always visible, so every doc stays one click away. */
.docs-doclist { flex-shrink: 0; padding: 24px 14px 16px; }
.docs-doclist-label { font-size: var(--text-2xs); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); padding: 0 10px; margin: 16px 0 6px; }
.docs-doc {
  display: block; padding: 7px 10px;
  font-size: var(--text-base); font-weight: 500; color: var(--text-secondary); text-decoration: none;
  border-radius: var(--radius-sm);
  transition: background var(--duration), color var(--duration);
}
.docs-doc:hover { background: var(--muted-bg); color: var(--text); }
.docs-doc.is-active { background: var(--muted-bg); color: var(--text); font-weight: 600; }

/* "On this page" — the active doc's TOC, scrolling independently of the doc list. */
.docs-toc-wrap { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 14px 56px; border-top: 1px solid var(--border); }
.docs-toc-label { font-size: var(--text-2xs); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); padding: 6px 10px; }
.docs-toc { list-style: none; margin: 0; padding: 0; display: none; }
.docs-toc.is-active { display: block; }
.docs-toc-link {
  display: block; padding: 5px 10px 5px 12px;
  font-size: var(--text-sm); color: var(--text-secondary); text-decoration: none;
  border-left: 2px solid transparent;
  transition: color var(--duration), background var(--duration), border-color var(--duration);
}
.docs-toc-link[data-level="3"] { padding-left: 26px; }
.docs-toc-link:hover { color: var(--text); }
.docs-toc-link.is-current { color: var(--text); font-weight: 500; border-left-color: var(--primary); background: var(--muted-bg); }

.docs-backdrop { display: none; }

/* ── Doc sections (one shown at a time) ───────────────────────────────────── */
.doc-section { display: none; max-width: 780px; }
.doc-section.is-active { display: block; }

/* Uniform per-doc header (kicker / title / description / actions). */
.doc-head { margin: 0 0 30px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
.doc-kicker { font-size: var(--text-2xs); font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.doc-section .doc-title { font-size: clamp(30px, 4.5vw, 40px); font-weight: 600; letter-spacing: -0.025em; line-height: 1.1; margin: 0 0 12px; }
.doc-desc { font-size: clamp(16px, 2vw, 18px); line-height: 1.55; color: var(--text-secondary); margin: 0; max-width: 60ch; }
.doc-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.doc-action {
  display: inline-flex; align-items: center; gap: 6px;
  font: inherit; font-size: var(--text-sm); font-weight: 500;
  padding: 7px 15px; border-radius: var(--radius-full);
  border: 1px solid var(--primary); background: var(--primary); color: var(--primary-fg);
  text-decoration: none; cursor: pointer;
  transition: transform var(--duration), background var(--duration), border-color var(--duration), color var(--duration);
}
.doc-action:hover { transform: translateY(-1px); background: var(--primary-hover); border-color: var(--primary-hover); }
.doc-action--ghost { background: transparent; color: var(--text-secondary); border-color: var(--border); }
.doc-action--ghost:hover { transform: none; background: var(--muted-bg); color: var(--text); border-color: var(--border); }

/* AI guide launcher (ai-launcher.ts): the ready prompt box + its action row. The
   prompt wraps (and breaks long URLs) so it's readable instead of scrolling; the
   doc-section prefix out-specifies the base pre.doc-code code white-space rule. */
.ai-launcher { margin: 0 0 18px; }
.ai-launcher pre.doc-code { margin: 0 0 14px; }
.doc-section .ai-launcher pre.doc-code code { white-space: pre-wrap; overflow-wrap: anywhere; }
.ai-launcher-actions { display: flex; flex-wrap: wrap; gap: 10px; }

/* ── Rendered Markdown typography ─────────────────────────────────────────── */
.doc-section h2, .doc-section h3, .doc-section h4 {
  color: var(--text); scroll-margin-top: calc(var(--docs-topbar-h) + 16px);
}
.doc-section h2 { font-size: clamp(22px, 3vw, 27px); font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; margin: 52px 0 14px; }
.doc-section h3 { font-size: 19px; font-weight: 600; margin: 34px 0 10px; }
.doc-section h4 { font-size: 16px; font-weight: 600; margin: 24px 0 8px; }
.doc-section p  { line-height: 1.7; margin: 0 0 16px; color: var(--text-secondary); }
.doc-section strong { color: var(--text); font-weight: 600; }
.doc-section em { font-style: italic; }
.doc-section ul, .doc-section ol { margin: 0 0 16px; padding-left: 24px; }
.doc-section li { line-height: 1.7; margin: 4px 0; color: var(--text-secondary); }
.doc-section li > ul, .doc-section li > ol { margin: 4px 0; }
/* Prose links only — exclude .doc-action buttons (View source, launcher deeplinks),
   which would otherwise inherit body-link colour + underline over their button fill. */
.doc-section a:not(.doc-action) { color: var(--text); text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 3px; }
.doc-section a:not(.doc-action):hover { text-decoration-color: var(--text); }
.doc-section hr { border: 0; border-top: 1px solid var(--border); margin: 36px 0; }

/* Inline code (not inside a fenced block). */
.doc-section :not(pre) > code {
  font-family: var(--mono); font-size: 0.875em;
  background: var(--muted-bg); color: var(--text);
  padding: 0.12em 0.4em; border-radius: var(--radius-xs);
}

/* Fenced code blocks (markdown.ts emits <pre class="doc-code">). */
.doc-section pre.doc-code {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 16px 18px; margin: 0 0 18px; overflow-x: auto;
}
.doc-section pre.doc-code code {
  font-family: var(--mono); font-size: var(--text-sm); line-height: 1.7; color: var(--text); white-space: pre;
}

/* Blockquotes. */
.doc-section blockquote { margin: 0 0 18px; padding: 2px 0 2px 18px; border-left: 3px solid var(--border); }
.doc-section blockquote p { color: var(--muted); margin-bottom: 8px; }

/* Tables — wrapped in .doc-table for horizontal scroll on narrow screens. */
.doc-table { overflow-x: auto; margin: 0 0 18px; }
.doc-section table { border-collapse: collapse; width: 100%; font-size: var(--text-sm); }
.doc-section th, .doc-section td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; vertical-align: top; }
.doc-section th { background: var(--muted-bg); color: var(--text); font-weight: 600; white-space: nowrap; }
.doc-section td { color: var(--text-secondary); }
.doc-section td code { white-space: nowrap; }

/* ── Mobile: sidebar → off-canvas drawer ──────────────────────────────────── */
@media (max-width: 767px) {
  .docs-menu-btn { display: inline-flex; }
  .docs-nav {
    position: fixed; top: var(--docs-topbar-h); left: 0; bottom: 0;
    width: min(86vw, 330px); height: auto; z-index: var(--z-sidebar);
    background: var(--bg);
    transform: translateX(-100%); transition: transform var(--duration-sheet) ease;
  }
  body.docs-nav-open .docs-nav { transform: translateX(0); box-shadow: var(--shadow-sidebar); }
  .docs-backdrop {
    display: block; position: fixed; inset: var(--docs-topbar-h) 0 0 0;
    z-index: calc(var(--z-sidebar) - 1);
    background: var(--overlay); opacity: 0; pointer-events: none;
    transition: opacity var(--duration);
  }
  body.docs-nav-open .docs-backdrop { opacity: 1; pointer-events: auto; }
  .docs-main { padding: 28px 20px 100px; }
  .doc-section { max-width: none; }
  /* Breadcrumb collapses to the current doc (and heading, if any). */
  .docs-crumb--home, .docs-crumb-sep:not(.docs-crumb--head) { display: none; }
}
`
