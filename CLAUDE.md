# Crumb — Developer Guide

## What this repo is

Crumb is a **spec-first** open format for travel itineraries. The format is the product; this TypeScript codebase is the reference implementation. The format spec (`spec/CRUMB_SPEC.md`) and the code are versioned together — a parser change that breaks spec compliance is a bug.

## Architecture at a glance

| Layer | Files | Role |
|---|---|---|
| Raw types | `src/types/raw.ts` | Pass 1 internal representation — never imported outside `src/parser/` |
| Public types | `src/types/resolved.ts` | The only output contract. Renderer, browser, and tests import from here |
| Parser | `src/parser/` | Three sequential passes: classify → resolve → infer |
| Renderer (CLI) | `src/renderer/html.ts` | `renderHtml()` (full app shell) + `renderItineraryBody()` (content-only, used for live re-render) |
| Viewer bundle | `src/viewer-entry.ts` → `src/renderer/browser-app.ts` + `app-map.ts` + `app-focus.ts` + `app-sheet.ts` | Standalone map + panel UI. No editor dependency. Listens for `crumb:doc-updated` event. |
| Editor bundle | `src/editor-entry.ts` → `src/renderer/app-editor.ts` + `app-menus.ts` | YAML editor overlay, menus, dialogs. Fires `crumb:doc-updated` after re-parse. |
| Format helpers | `src/renderer/format.ts` | Pure functions, no HTML — reusable by any renderer |
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

3. **Pass 3 runs 5 phases in a fixed order** (`inferTimeline()` in `pass3-infer.ts:158`):
   - Phase 1: intra-item (given 2 of {arrives, departs, duration}, derive the 3rd)
   - Phase 4: even distribution (split remaining time across duration-less places)
   - Phase 1 again: re-run with newly distributed durations
   - Phase 2: forward sweep (propagate end dates left→right)
   - Phase 3: backward sweep (propagate start dates right→left)
   
   Do not reorder these phases. Phase 4 distributes durations that the second Phase 1 run then uses.

4. **Inferred moments carry `anchor.precedence === "inferred"`.** This is how Phase 4 distinguishes authored dates from computed ones. Overwriting this precedence breaks time distribution.

5. **The browser bundles read initial state via globals** set by `html.ts` before the bundles run. The viewer bundle always gets:
   - `window.__CRUMB_DATA` — parsed `CrumbDocument`
   - `window.__CRUMB_POPUPS` — pre-computed popup metadata

   The editor bundle additionally gets (only injected in editor mode):
   - `window.__CRUMB_SOURCE` — original YAML string (pre-fills the editor textarea)
   - `window.__CRUMB_EXAMPLES` — example file contents
   - `window.__CRUMB_SPEC` — `CRUMB_SPEC.md` text (embedded for AI use)

   The two bundles communicate via a `crumb:doc-updated` CustomEvent: the editor writes new values to `window.__CRUMB_DATA` and `window.__CRUMB_POPUPS`, then fires the event; the viewer re-renders in response.

6. **Geocoding requests are strictly sequential with a 1100ms gap** (Nominatim ToS: ≤1 req/sec). The `geoQueue` promise chain in `geocoder.ts` enforces this. Never parallelize these fetches.

7. **`resolveDuration` `"unknown"` type is a graceful fallback**, not an error. Unrecognized duration strings become `{ type: "unknown", label: "..." }` and are displayed as-is.

8. **`renderMarkdown()` in `html.ts` is intentionally minimal** — it handles bold, italic, code, links, and bullet lists only. It is not CommonMark-compliant by design. Do not replace it with a library.

9. **Geocoding cache uses versioned localStorage keys** (`"crumb-geo-v2:"`). If geocoding query logic changes in a way that would produce different results for the same place name, bump `GEO_CACHE_VERSION` in `geocoder.ts` and update `migrateGeoCache()`.

## Where to put things

**New transport mode** (e.g. "subway"):
- Add to `TransportMode` union in `src/types/primitives.ts`
- Add to `TRANSPORT_KEYWORDS` set in `src/parser/pass1-classify.ts`
- Add SVG icon in `src/renderer/icons.ts`
- Handle in `modeIconSvg()` in `src/renderer/html.ts`

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
npm run build          # render japan-2026.crumb → dist/index.html (with editor shell)
npm run typecheck      # tsc --noEmit (zero errors required)
npm run test           # vitest run (single pass, used in CI)
npm run test:watch     # vitest (watch mode for development)
npm run render -- examples/japan-2026.crumb /tmp/out.html            # viewer-only (default)
npm run render -- examples/japan-2026.crumb /tmp/out.html --editor   # with editor shell
```

## Test targets

- **Primary:** Parser functions (`resolveMoment`, `resolveDuration`, `parse()` end-to-end). These contain regex dispatch, 8-variant logic, and the 5-phase inference algorithm — the highest regression risk.
- **Secondary:** Pure formatting helpers in `src/renderer/format.ts`.
- **Do not test:** Browser DOM behavior or geocoding (network-dependent, too much mocking complexity).

Test files live in `tests/` mirroring `src/` structure:
```
tests/
  parser/
    pass2-resolve.test.ts   # resolveMoment, resolveDuration
    pass3-infer.test.ts     # addDays + timeline inference
    parse-integration.test.ts
  renderer/
    format.test.ts
```

## Before touching pass3-infer.ts

The 5-phase timeline algorithm is the most complex part of the codebase. Before changing it:
1. Read `spec/reference/parser.md` section 3.4 for the full algorithm description
2. Run `npm run test` to establish a baseline
3. After your change, render `examples/japan-2026.crumb` and `examples/europe-backpacking.crumb` and verify that dates are correct in the output
