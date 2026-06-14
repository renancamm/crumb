# Crumb — Developer Guide

## What this repo is

Crumb is a **spec-first** open format for travel itineraries. The format is the product; this TypeScript codebase is the reference implementation. The format spec (`spec/crumb-spec.md`) and the code are versioned together — a parser change that breaks spec compliance is a bug.

## Architecture at a glance

`src/` is organised by concern: **`parser/`** + **`types/`** (the format core), **`entries/`**
(thin esbuild/CLI bundle targets), **`generate/`** (node, build-time HTML/CSS string emitters —
`generate/landing/` + `generate/docs/`), **`app/`** (browser runtime: `app/viewer/`, `app/editor/`,
`app/docs/`, `app/embed/`), **`geo/`** (geocoding), and **`shared/`** (used by both node and browser).
A module's directory tells you whether it runs at build time (`generate/`) or in the browser (`app/`).

| Layer | Files | Role |
|---|---|---|
| Raw types | `src/types/raw.ts` | Pass 1 internal representation — never imported outside `src/parser/` |
| Public types | `src/types/resolved.ts` | The only output contract. Renderer, browser, and tests import from here |
| Parser | `src/parser/` | Three sequential passes: classify → resolve → infer |
| Renderer | `src/generate/html.ts` | `renderHtml()` (full self-contained app shell, used by the CLI) + the panel renderers (`renderTripPanel`, `renderPlacePanel`, `renderSinglePlacePanel`, `renderTransportPanel`, `renderModalContent`) the viewer calls for live re-render |
| Styles | `src/generate/css.ts` | All CSS, as concatenated string constants → one `<style>` block. `:root` is split into **theme tokens** (colours/shadows that flip in dark mode) and **static tokens** (radius/type/motion/layout/z-index). See invariant 10. |
| Icons | `src/shared/icons.ts` | Every UI icon is a Lucide SVG built by the `icon()` factory (`class="crumb-icon"`, styled only by CSS). Never hand-roll inline `<svg>` in renderers — add an `ICON_*` here. |
| Viewer bundle | `src/entries/viewer.ts` → `src/app/viewer/viewer-app.ts` + `app-map.ts` + `app-focus.ts` + `app-sheet.ts` | Standalone map + panel UI. No editor dependency. Listens for `crumb:doc-updated` event. |
| Editor bundle | `src/entries/editor.ts` → `src/app/editor/app-editor.ts` (CodeMirror 6) + `app-menus.ts` + `app-layout.ts` | YAML editor (live highlighting, lint, autocomplete) in a resizable split against the map; menus sit atop the code pane. Fires `crumb:doc-updated` after re-parse and `crumb:layout-resized` when the split is dragged/toggled. |
| Landing page | `src/generate/landing/html-landing.ts` (→ `landing-css.ts` + `yaml-highlight.ts`), bundle `src/entries/landing.ts` | Standalone scrolling `index.html` (not the app shell). Reuses the design tokens; drives the hero/example embeds via `postMessage` (see invariant 5). Copy lives in the `html-landing.ts` markup; visual direction is in its header comment. |
| Docs page | `src/generate/docs/html-docs.ts` (→ `docs-css.ts`) + `src/generate/docs/markdown.ts`, bundle `src/entries/docs.ts` → `app-docs.ts` | Standalone wiki-style `docs.html` (not the app shell). **Generated at build time from the `spec/*.md` source of truth** (`markdown.ts` = build-time markdown-it wrapper, node-only — never bundled to the browser; it strips each source's leading H1 so the page header owns the title). One self-contained page: a two-region sidebar (grouped doc list + the active doc's TOC), a breadcrumb, and a uniform per-doc header (kicker/description/actions) all driven by the `DOCS` registry in `markdown.ts` — its `kicker/description/group` are **navigational copy only** (no field/type claims) so they can't drift. `spec/reference/overview.md` is the home/orientation doc. Source bodies (spec, AI guide, parser, data-model) are framed by chrome, never edited for the site. `tests/docs-build.test.ts` guards anchor/link/metadata drift. Copy/Download use the shared `src/shared/clipboard.ts`. |
| Embed page | `src/entries/embed.ts` → `viewer-app.ts` + `src/app/embed/embed-boot.ts` | Generic, content-agnostic `embed.html`: a viewer that loads a crumb at runtime by `?src=` (fetch) or inline `postMessage`. `?card` is the compact map+legend card variant. |
| Render-API bundles | `src/entries/render-viewer.ts` (no parser) · `src/entries/render-full.ts` (+ `parse`) | The `window.Crumb` render fns. Viewer-only output ships the parser-free one (tree-shakes js-yaml); the editor **and** embed ship the `+parse` one for live/runtime re-parsing. |
| Format helpers | `src/shared/format.ts` | Pure functions, no HTML — reusable by any renderer |
| Geo targets | `src/geo/geo-targets.ts` | DOM-free collection of geocoding queries from a doc. Shared by `app-map.ts` (viewer) and `scripts/gen-geocache.ts` so both issue byte-identical queries. |
| Geocoding | `src/geo/geocoder.ts` | Nominatim integration, localStorage cache, sequential request queue |

### Parser passes

```
src/parser/
  index.ts          parse(source) → CrumbDocument   (orchestrates passes)
  pass1-classify.ts YAML string  → RawCrumbDocument (structure detection only)
  pass2-resolve.ts  RawCrumb     → CrumbDocument     (string fields → typed values)
  pass3-infer.ts    CrumbDocument→ CrumbDocument     (timeline inference, endpoint filling)
```

**Pass 1** detects structure: which YAML keys are places, transport legs, activity groups, etc. Values are left as raw strings.

**Pass 2** resolves values: `resolveMoment()`, `resolveDuration()`, `resolveGeolocation()` convert raw strings to typed objects. Raw types are discarded after this pass.

**Pass 3** enriches the document: infers transport endpoints from neighbouring places, runs the 5-phase timeline constraint propagation, resolves relative dates ("Day 3" → calendar date).

## Key invariants — do not break these

1. **Raw types never leave the parser.** Nothing outside `src/parser/` imports from `src/types/raw.ts`. The raw representation is an implementation detail.

2. **`parse()` is synchronous and does no I/O.** Geocoding is entirely browser-side and lazy. The CLI never makes network requests.

3. **Pass 3 runs 5 phases in a fixed order** (`inferTimeline()` in `pass3-infer.ts:149`):
   - Phase 1: intra-item (given 2 of {arrives, departs, duration}, derive the 3rd)
   - Phase 4: even distribution (split remaining time across duration-less places)
   - Phase 1 again: re-run with newly distributed durations
   - Phase 2: forward sweep (propagate end dates left→right)
   - Phase 3: backward sweep (propagate start dates right→left)
   
   Do not reorder these phases. Phase 4 distributes durations that the second Phase 1 run then uses.

4. **Inferred moments carry `anchor.precedence === "inferred"`.** This is how Phase 4 distinguishes authored dates from computed ones. Overwriting this precedence breaks time distribution.

5. **The browser bundles read initial state via globals** set by `html.ts` before the bundles run. The viewer bundle always gets:
   - `window.__CRUMB_DATA` — parsed `CrumbDocument`

   The editor bundle additionally gets (only injected in editor mode):
   - `window.__CRUMB_SOURCE` — original YAML string (pre-fills the editor textarea)
   - `window.__CRUMB_SPEC` — `crumb-spec.md` text (embedded for AI use)
   - `window.__CRUMB_FOR_AI` — `crumb-for-ai.md` authoring guide (for the "Generate with AI" prompt)

   Examples are **not** baked into any page: the build copies `examples/*.crumb` to
   `dist/examples/`, and the editor's `?example=<file>` deep link fetches them at
   runtime by relative path (`app-menus.ts`).

   Two more modes set their own globals:
   - `window.__CRUMB_EMBED` (embed only) — flips the viewer into a locked-preview map with an expand→fullscreen control (`setupEmbedMode` in `viewer-app.ts`). The doc is loaded at runtime, not baked.
   - `window.__CRUMB_LANDING` (landing only, set by `html-landing.ts`) — the per-stage YAML + crumb + geo the landing bundle posts into its embeds.
   - `window.__CRUMB_GEO_DATA` / `__CRUMB_GEO_MODE` — optional baked geo-cache seeded into localStorage before any geocoding runs (see `gen-geocache.ts`).

   The two bundles communicate via a `crumb:doc-updated` CustomEvent: the editor writes the new value to `window.__CRUMB_DATA`, then fires the event; the viewer re-renders in response. **Embeds load documents at runtime, not via globals**: `embed.html` takes a crumb either by `?src=<url>` (fetch) or inline via `postMessage({ type: "crumb:load", crumb, geo })`, then drives the same `crumb:doc-updated` path. An embed that boots before its host is wired up posts `crumb:ready` to its parent and waits — robust for lazy iframes (`embed-boot.ts`).

6. **Geocoding requests are strictly sequential with a 1100ms gap** (Nominatim ToS: ≤1 req/sec). The `geoQueue` promise chain in `geocoder.ts` enforces this. Never parallelize these fetches.

7. **`resolveDuration` `"unknown"` type is a graceful fallback**, not an error. Unrecognized duration strings become `{ type: "unknown", label: "..." }` and are displayed as-is.

8. **`renderMarkdown()` in `html.ts` is intentionally minimal** — it handles bold, italic, code, links, and bullet lists only. It is not CommonMark-compliant by design. Do not replace it with a library.

9. **Geocoding cache uses versioned localStorage keys** (`"crumb-geo-v4:"`). If geocoding query logic changes in a way that would produce different results for the same place name, bump `GEO_CACHE_VERSION` in `geocoder.ts` and update `migrateGeoCache()`.

10. **Every colour goes through a token; the `:root` theme/static split is the dark-theme seam.** No raw hex/rgb in component CSS — use a `var(--…)` token. Colours and shadows that invert in dark mode live in the **theme-token** group at the top of `tokensCSS`; radius, type scale, fonts, motion, layout, and z-index live in the **static-token** group and must not be duplicated per-theme. Dark mode is a single `@media (prefers-color-scheme: dark) { :root { … } }` block (right after `tokensCSS`) that re-declares **only** the theme group — system-preference driven, no toggle. So a new themed colour means: add the token to the theme group **and** its dark value to that `@media` block. Three deliberate exceptions stay fixed in both themes: the `--marker-*` (fill/ring/fg, dark-on-light over the always-light map — `--marker-bg` matches `ROUTE_COLOR` in `app-state.ts`) and `--chip-*` map-overlay tokens, and the `--ed-*` editor surface (a self-contained always-dark editor skinned with Crumb's own dark-mode palette).

11. **Shipped output stays dependency-light; hand-roll before reaching for a library.** The real axis is *what inlines into every output*, not "no libraries." Two surfaces are kept lean: the **viewer/embed bundle + rendered HTML** (it inlines into every self-contained crumb file, so every byte counts) and the **spec-critical parser** (its only runtime dependency is `js-yaml`). This is why the YAML highlighter (`yaml-highlight.ts`, build-time landing only), `renderMarkdown()` (invariant 8), the icons, and the CSS are all hand-rolled. Build-time tooling (esbuild, ts-node, vitest) is pragmatic. Before adding a dependency, ask: (1) does it ship into the *viewer/embed* output? (2) does it touch the parser? (3) is the hand-rolled version genuinely small? (4) if it must ship, can it load via CDN+SRI instead of inlining (like maplibre-gl)? **Deliberate exception:** CodeMirror 6 ships into the **editor** bundle only (`editor.html` and `--editor` renders) — never the viewer/embed/`.crumb` output — to power the full editor (highlighting, lint, autocomplete, find). Esbuild minifies all bundles (`build-site.ts`), so editor weight is bounded and the viewer stays unaffected (verify: the built viewer bundle contains no `codemirror`).

## Where to put things

**New transport mode** (e.g. "subway"):
- Add to the `TRANSPORT_MODES` tuple in `src/types/primitives.ts` (the `TransportMode` union and pass 1's `TRANSPORT_MODE_SET` both derive from it)
- Add the SVG icon and its `modeIconSvg()` mapping in `src/shared/icons.ts`

**New date expression format** (e.g. "next month"):
- Add a match branch in `resolveMoment()` in `src/parser/pass2-resolve.ts`
- Add a test case in `tests/parser/pass2-resolve.test.ts`

**New duration variant**:
- Add a match branch in `resolveDuration()` in `src/parser/pass2-resolve.ts`
- Add the new variant to the `ResolvedDuration` union in `src/types/resolved.ts`
- Add a `formatDuration()` case in `src/shared/format.ts`

**New YAML field on a place/activity/transport**:
- Add to the appropriate `Raw*` type in `src/types/raw.ts`
- Parse it in `src/parser/pass1-classify.ts`
- Resolve it in `src/parser/pass2-resolve.ts`
- Add the resolved field to the appropriate type in `src/types/resolved.ts`

**Pure formatting helper (no HTML)** → `src/shared/format.ts`

**HTML renderer helper** → private function in `src/generate/html.ts`

**Viewer-side browser interaction** (map, panel navigation, focus, mobile sheet) → `src/app/viewer/viewer-app.ts` (and the other `app-*.ts` modules imported by `src/entries/viewer.ts`)

**Editor-side browser interaction** (CodeMirror editor, menus, dialogs, split layout) → `src/app/editor/app-editor.ts`, `app-menus.ts`, or `app-layout.ts` (imported by `src/entries/editor.ts`)

## Dev commands

```bash
npm run build          # build the site → dist/{index,editor,embed,docs}.html + dist/examples/ (scripts/build-site.ts)
npm run build:viewer   # render examples/japan-detailed.crumb → dist/viewer.html (single viewer, dev)
npm run gen:geocache   # regenerate examples/*.geo.json baked caches (hits Nominatim, ToS-paced)
npm run typecheck      # tsc --noEmit (zero errors required)
npm run test           # vitest run (single pass, used in CI)
npm run test:watch     # vitest (watch mode for development)
npm run render -- examples/japan-detailed.crumb /tmp/out.html            # viewer-only (default)
npm run render -- examples/japan-detailed.crumb /tmp/out.html --editor   # with editor shell
```

The CLI/build stay no-I/O at parse time (invariant 2); `gen:geocache` is the one
script that hits the network, offline and ahead of time, baking `examples/*.geo.json`
so embeds resolve known places with zero requests.

## Test targets

- **Primary:** Parser functions (`resolveMoment`, `resolveDuration`, `parse()` end-to-end). These contain regex dispatch, 8-variant logic, and the 5-phase inference algorithm — the highest regression risk.
- **Secondary:** Pure formatting helpers in `src/shared/format.ts`.
- **Do not test:** Browser DOM behavior or geocoding (network-dependent, too much mocking complexity).

Test files live in `tests/` mirroring `src/` structure:
```
tests/
  parser/
    pass1-classify.test.ts    # structure detection
    pass2-resolve.test.ts     # resolveMoment, resolveDuration
    pass3-infer.test.ts       # addDays + timeline inference
    parse-integration.test.ts
    examples.test.ts          # every examples/*.crumb parses
    regression.test.ts        # determinism / regression cases
  shared/
    format.test.ts
  docs-build.test.ts          # docs.html anchor/link/metadata drift guard
  spec-sync.test.ts           # code constants ↔ crumb-for-ai.md vocab stay in sync
```

## Before touching pass3-infer.ts

The 5-phase timeline algorithm is the most complex part of the codebase. Before changing it:
1. Read `spec/reference/parser.md` section 3.4 for the full algorithm description
2. Run `npm run test` to establish a baseline
3. After your change, render `examples/japan-detailed.crumb` and `examples/southeast-asia.crumb` and verify that dates are correct in the output (e.g. `npm run build:viewer`)
