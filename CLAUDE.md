# Crumb — Developer Guide

## What this repo is

Crumb is a **spec-first** open format for travel itineraries. The format is the product; this TypeScript codebase is the reference implementation. The format spec (`spec/CRUMB_SPEC.md`) and the code are versioned together — a parser change that breaks spec compliance is a bug.

## Architecture at a glance

| Layer | Files | Role |
|---|---|---|
| Raw types | `src/types/raw.ts` | Pass 1 internal representation — never imported outside `src/parser/` |
| Public types | `src/types/resolved.ts` | The only output contract. Renderer, browser, and tests import from here |
| Parser | `src/parser/` | Three sequential passes: classify → resolve → infer |
| Renderer | `src/renderer/html.ts` | `renderHtml()` (full self-contained app shell, used by the CLI) + the panel renderers (`renderTripPanel`, `renderPlacePanel`, `renderSinglePlacePanel`, `renderTransportPanel`, `renderModalContent`) the viewer calls for live re-render |
| Styles | `src/renderer/css.ts` | All CSS, as concatenated string constants → one `<style>` block. `:root` is split into **theme tokens** (colours/shadows that flip in dark mode) and **static tokens** (radius/type/motion/layout/z-index). See invariant 10. |
| Icons | `src/renderer/icons.ts` | Every UI icon is a Lucide SVG built by the `icon()` factory (`class="crumb-icon"`, styled only by CSS). Never hand-roll inline `<svg>` in renderers — add an `ICON_*` here. |
| Viewer bundle | `src/viewer-entry.ts` → `src/renderer/browser-app.ts` + `app-map.ts` + `app-focus.ts` + `app-sheet.ts` | Standalone map + panel UI. No editor dependency. Listens for `crumb:doc-updated` event. |
| Editor bundle | `src/editor-entry.ts` → `src/renderer/app-editor.ts` + `app-menus.ts` | YAML editor overlay, menus, dialogs. Fires `crumb:doc-updated` after re-parse. |
| Landing page | `src/renderer/html-landing.ts` (→ `landing-css.ts` + `yaml-highlight.ts`), bundle `src/landing-entry.ts` | Standalone scrolling `index.html` (not the app shell). Reuses the design tokens; drives the hero/example embeds via `postMessage` (see invariant 5). Copy lives in the `html-landing.ts` markup; visual direction is in its header comment. |
| Embed page | `src/embed-entry.ts` → `browser-app.ts` + `src/renderer/embed-boot.ts` | Generic, content-agnostic `embed.html`: a viewer that loads a crumb at runtime by `?src=` (fetch) or inline `postMessage`. `?card` is the compact map+legend card variant. |
| Render-API bundles | `src/viewer-render-entry.ts` (no parser) · `src/browser-entry.ts` (+ `parse`) | The `window.Crumb` render fns. Viewer-only output ships the parser-free one (tree-shakes js-yaml); the editor **and** embed ship the `+parse` one for live/runtime re-parsing. |
| Format helpers | `src/renderer/format.ts` | Pure functions, no HTML — reusable by any renderer |
| Geo targets | `src/renderer/geo-targets.ts` | DOM-free collection of geocoding queries from a doc. Shared by `app-map.ts` (viewer) and `scripts/gen-geocache.ts` so both issue byte-identical queries. |
| Geocoding | `src/renderer/geocoder.ts` | Nominatim integration, localStorage cache, sequential request queue |

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
   - `window.__CRUMB_EXAMPLES` — example file contents
   - `window.__CRUMB_SPEC` — `CRUMB_SPEC.md` text (embedded for AI use)
   - `window.__CRUMB_FOR_AI` — `CRUMB_FOR_AI.md` authoring guide (for the "Generate with AI" prompt)

   Two more modes set their own globals:
   - `window.__CRUMB_EMBED` (embed only) — flips the viewer into a locked-preview map with an expand→fullscreen control (`setupEmbedMode` in `browser-app.ts`). The doc is loaded at runtime, not baked.
   - `window.__CRUMB_LANDING` (landing only, set by `html-landing.ts`) — the per-stage YAML + crumb + geo the landing bundle posts into its embeds.
   - `window.__CRUMB_GEO_DATA` / `__CRUMB_GEO_MODE` — optional baked geo-cache seeded into localStorage before any geocoding runs (see `gen-geocache.ts`).

   The two bundles communicate via a `crumb:doc-updated` CustomEvent: the editor writes the new value to `window.__CRUMB_DATA`, then fires the event; the viewer re-renders in response. **Embeds load documents at runtime, not via globals**: `embed.html` takes a crumb either by `?src=<url>` (fetch) or inline via `postMessage({ type: "crumb:load", crumb, geo })`, then drives the same `crumb:doc-updated` path. An embed that boots before its host is wired up posts `crumb:ready` to its parent and waits — robust for lazy iframes (`embed-boot.ts`).

6. **Geocoding requests are strictly sequential with a 1100ms gap** (Nominatim ToS: ≤1 req/sec). The `geoQueue` promise chain in `geocoder.ts` enforces this. Never parallelize these fetches.

7. **`resolveDuration` `"unknown"` type is a graceful fallback**, not an error. Unrecognized duration strings become `{ type: "unknown", label: "..." }` and are displayed as-is.

8. **`renderMarkdown()` in `html.ts` is intentionally minimal** — it handles bold, italic, code, links, and bullet lists only. It is not CommonMark-compliant by design. Do not replace it with a library.

9. **Geocoding cache uses versioned localStorage keys** (`"crumb-geo-v4:"`). If geocoding query logic changes in a way that would produce different results for the same place name, bump `GEO_CACHE_VERSION` in `geocoder.ts` and update `migrateGeoCache()`.

10. **Every colour goes through a token; the `:root` theme/static split is the dark-theme seam.** No raw hex/rgb in component CSS — use a `var(--…)` token. Colours and shadows that invert in dark mode live in the **theme-token** group at the top of `tokensCSS`; radius, type scale, fonts, motion, layout, and z-index live in the **static-token** group and must not be duplicated per-theme. Dark mode is a single `@media (prefers-color-scheme: dark) { :root { … } }` block (right after `tokensCSS`) that re-declares **only** the theme group — system-preference driven, no toggle. So a new themed colour means: add the token to the theme group **and** its dark value to that `@media` block. Three deliberate exceptions stay fixed in both themes: the `--marker-*` (fill/ring/fg, dark-on-light over the always-light map — `--marker-bg` matches `ROUTE_COLOR` in `app-state.ts`) and `--chip-*` map-overlay tokens, and the `--ed-*` editor surface (self-contained Catppuccin Mocha).

11. **Shipped output stays dependency-light; hand-roll before reaching for a library.** Two surfaces are kept lean: the **browser bundle / rendered HTML** (it inlines into every self-contained crumb file, so every byte counts) and the **spec-critical parser** (its only runtime dependency is `js-yaml`). This is why the YAML highlighter (`yaml-highlight.ts`), `renderMarkdown()` (invariant 8), the icons, and the CSS are all hand-rolled rather than pulled from a library. Build-time tooling (esbuild, ts-node, vitest) is pragmatic and may take a dependency that clearly pays off. Before adding any dependency, ask: (1) does it ship into every output? (2) does it touch the parser? (3) is the hand-rolled version genuinely small?

## Where to put things

**New transport mode** (e.g. "subway"):
- Add to the `TRANSPORT_MODES` tuple in `src/types/primitives.ts` (the `TransportMode` union and pass 1's `TRANSPORT_MODE_SET` both derive from it)
- Add the SVG icon and its `modeIconSvg()` mapping in `src/renderer/icons.ts`

**New date expression format** (e.g. "next month"):
- Add a match branch in `resolveMoment()` in `src/parser/pass2-resolve.ts`
- Add a test case in `tests/parser/pass2-resolve.test.ts`

**New duration variant**:
- Add a match branch in `resolveDuration()` in `src/parser/pass2-resolve.ts`
- Add the new variant to the `ResolvedDuration` union in `src/types/resolved.ts`
- Add a `formatDuration()` case in `src/renderer/format.ts`

**New YAML field on a place/activity/transport**:
- Add to the appropriate `Raw*` type in `src/types/raw.ts`
- Parse it in `src/parser/pass1-classify.ts`
- Resolve it in `src/parser/pass2-resolve.ts`
- Add the resolved field to the appropriate type in `src/types/resolved.ts`

**Pure formatting helper (no HTML)** → `src/renderer/format.ts`

**HTML renderer helper** → private function in `src/renderer/html.ts`

**Viewer-side browser interaction** (map, panel navigation, focus, mobile sheet) → `src/renderer/browser-app.ts` (and the other `app-*.ts` modules imported by `src/viewer-entry.ts`)

**Editor-side browser interaction** (YAML textarea, menus, dialogs) → `src/renderer/app-editor.ts` or `src/renderer/app-menus.ts` (imported by `src/editor-entry.ts`)

## Dev commands

```bash
npm run build          # build the site → dist/{index,editor,embed}.html (scripts/build-site.ts)
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
- **Secondary:** Pure formatting helpers in `src/renderer/format.ts`.
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
  renderer/
    format.test.ts
  spec-sync.test.ts           # code constants ↔ CRUMB_FOR_AI.md vocab stay in sync
```

## Before touching pass3-infer.ts

The 5-phase timeline algorithm is the most complex part of the codebase. Before changing it:
1. Read `spec/reference/parser.md` section 3.4 for the full algorithm description
2. Run `npm run test` to establish a baseline
3. After your change, render `examples/japan-detailed.crumb` and `examples/southeast-asia.crumb` and verify that dates are correct in the output (e.g. `npm run build:viewer`)
