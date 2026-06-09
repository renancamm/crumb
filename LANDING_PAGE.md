# Crumb — Landing Page Brief

> Working document. We refine this in text before any code is written.
> Status: **content draft**, not final. Open questions tracked at the bottom.

## Goal

A simple page to share Crumb with friends. It should make someone *get* what
Crumb is and want to play with it — not sell them a product.

The primary action we'd be happiest to see: **someone plays with the live demo
in the hero.**

**Expected flow:** land on the hero and play with the live Japan demo → maybe
scroll on to read the text and the other examples → reach "Give it a try" for
what to do next. There's **no hero CTA button** — the live demo *is* the call to
action.

## Audience

Friends — a mix of travel-curious people and a few who build things. The page
speaks to the first group by default; the builder points are quiet and live
near the bottom for the people who'll notice them.

## Tone

Warm, humble, and plain — a project page to share with friends and strangers
alike. It presents a small project the maker is quietly proud of, without
selling it: no marketing imperatives, no bold claims, no leaning hard on "AI".

The "personal project" framing sets the *spirit* (warm, unpretentious) — it does
**not** mean the page must be written in the first person. This is a tech project
presentation, not a personal blog; "I" doesn't need to appear. Warm and humble,
but still a clear presentation of what the project is.

## Constraints

- **Simple.** One scrolling page. Roughly one or two screens of real content.
- **Mobile-friendly.** Must read and scroll cleanly on a phone; the live map
  must never fight page scroll (see hero notes).

## Visual direction

**Technical, minimalist, humble.** Purely clean and typographic — whitespace and
the live demo carry the page. Reference: **vercel.com**.

- **Colour comes from the content, not the chrome.** The map is the only source
  of colour; everything around it stays monochrome and restrained, so the
  simplicity frames the colourful demo rather than competing with it.
- **Inherit the app's design system.** Geist (sans) + mono, the monochrome
  zinc / black-white palette with the single warm orange accent, rounded
  corners. The page *extends* this system rather than inventing a new look, so
  the embedded viewer never reads as a foreign object.
- **One personality move spent on nothing.** No display typeface, no trail/route
  motif — clean type, generous whitespace, and the demo do the work.
- **Hero framing.** The live viewer sits inside a **large rounded-corner card**
  (no shadow) — reads as a big embedded map, *not* full-bleed.
- **Borders over shadows.** Hairline 1px borders (zinc-200 / zinc-800) are the
  only separation device — no drop shadows anywhere on the page.
- **Dark mode.** Inherited from the app's system-preference theme, so the page
  flips together with the embedded viewer.
- **Type scale.** Add **landing-specific larger sizes** beyond the app's 30px
  ceiling (the design system predates a landing page); big, tight-tracked Geist
  for the hero, Vercel-style.
- **Motion.** Kept minimal for the first iteration (just the pill morph). Subtle,
  elegant scroll/entrance animation is wanted but deferred — see Later tasks.

## Navigation

**No top nav bar.** The sticky detail-level pill owns the top edge, so a fixed
header would collide with it. The `Crumb` wordmark sits in the hero; all nav
links — **Live editor · Spec · GitHub** — live in the **footer**.

---

## Page structure

```
        ┌─ [Sketch · Planned · Full] ── one shared control, sticky across ─┐
        │  both sections below; un-pins after "It's just text"             │
HERO     Leave a trail. + live viewer (control swaps the Japan trip)
IT'S JUST TEXT  Reveal the YAML for the selected detail level
        └──────────────────────────────────────────────────────────────────┘
DIFFERENT WAYS  Other shapes of trip — Lisbon / Copenhagen / SE Asia → viewer
OF USING IT
GIVE IT A TRY   ① Generate with any AI  ② Open the live editor
                ③ Embed the viewer      ④ Build your own
                (each a mini paragraph + a link)
FOOTER          Live editor · Spec · GitHub   (all nav lives here; no top bar)
```

### Shared detail-level control (hero + "It's just text")

One segmented control — **Sketch · Planned · Full** — drives a single
`detailLevel` state that *both* the hero viewer and the "It's just text" YAML
reveal read from. It's not a per-section toggle; it's the spine of the top of
the page.

- **Sticky behaviour.** The control is pinned (`position: sticky` on a wrapper
  spanning both sections) from the top of the hero through the bottom of "It's
  just text", then un-pins once you scroll past the text section — exactly the
  span where switching detail is meaningful.
- **Two shapes (decided: morph).** Full-width segmented control while it sits in
  the hero; shrinks to a compact floating **pill** once pinned, so it doesn't
  dominate the content being read.
- **Mobile.** The pill *is* the mobile answer: full-width bar at rest, compact
  pinned pill on scroll, so it never eats a small screen.

This is also the answer to "should the text section mirror the hero?" — yes,
because they share this one control.

### 1. Hero — *the unique thing: flexibility / progressive detail*

A live, embedded viewer showing the Japan trip. The shared control above swaps
it between three real example files:

- **Sketch** → `examples/japan-sketch.crumb`
- **Planned** → `examples/japan-planning.crumb`
- **Full** → `examples/japan-full.crumb`

The control is the whole point: *the same trip, as much or as little detail as
you want, mixed freely.*

**Draft copy**

> # Leave a trail.
> Crumb is a small, open format for trip itineraries: a plain-text document that
> turns a list of places into an interactive map. Add as little or as much detail
> as you feel like.

**No CTA button.** The live demo *is* the hero's call to action — the visitor
plays with the Sketch/Planned/Full control rather than clicking through to
somewhere else.

**Technical approach (hero)**

- **Pre-baked, parser-free.** At build time, parse the three Japan files and
  emit their digested `CrumbDocument` JSON (we already keep `.geo.json` siblings
  for coordinates). The hero ships three ready-made model objects; the toggle
  just swaps which one the lean read-only viewer renders. No parser, no YAML
  parsing, no `crumb:doc-updated` round-trip in the embed.
- Reuses the viewer-only build, which already strips the parser (commit
  `5565537`).

**Mobile handling**

- Inline map is a **static preview** — pan/zoom locked, so a normal swipe
  scrolls the page right past it.
- A **top-right expand button** opens the real interactive map fullscreen.

### 2. It's just text — *why it exists, shown not told*

Right after the hero, reveal the actual YAML source for the **currently
selected detail level** (driven by the shared sticky control above). The two
sections become one gesture: *here's the trip, and here are the few lines that
made it* — and switching the control updates both at once.

**Draft copy**

> ## It's just text
> Everything above is a plain text file — this one. You can read it without any
> tools, keep it in a folder, or send it to a friend like any other message.

**Rendering:** the YAML is **lightly syntax-highlighted** (mono font, hairline
border, no heavy code-editor chrome) — the full example is too hard to read as
flat monospace.

### 3. Different ways of using it — *different use cases / examples gallery*

Cards for trips of a different *shape* than the Japan hero, each opening the
real crumb in the viewer:

- **Lisbon** — a single-city guide (`lisbon-guide.crumb`)
- **Copenhagen** — a weekend (`copenhagen-weekend.crumb`)
- **Southeast Asia** — months of backpacking (`southeast-asia.crumb`)

**Cards (first iteration):** text only — title + one line, hairline border, no
thumbnail. Map thumbnails would add colour and life but are deferred to keep the
first pass simple (see Later tasks).

**Draft copy**

> ## Different ways of using it
> The same format works for a single afternoon or months of travel. Check a few
> examples:

### 4. Give it a try — *the call to action: "what do I do with this?"*

The closing section that answers the obvious visitor question. Four paths, each
a short paragraph and a link. First two are for everyone; last two are for the
people who build things.

> ## Give it a try

**① Generate one with AI**
> Because a crumb is just plain text with a simple vocabulary, an AI can write a
> whole itinerary from a chat — and tweak it when plans change. Give it the format
> guide, describe your trip, and see what comes back.
> → *The authoring guide* (`spec/CRUMB_FOR_AI.md`)

**② Open it in the live editor**
> Paste a crumb — yours or one an AI wrote — and watch it turn into a map and a
> timeline as you type.
> → *Live editor* (the deployed editor)

**③ Embed it anywhere**
> A crumb's interactive map is self-contained, so you can drop it straight into
> your own site or blog as a single HTML embed.
> → *How to embed — coming soon*

**④ Build your own**
> The format is open and fully specified. This parser is just one implementation
> — read the spec and build your own viewer, exporter, or whatever you need.
> → *Spec & parser reference* (`spec/CRUMB_SPEC.md`, `spec/reference/parser.md`)

### Footer

Holds all the page's navigation (there is no top nav): **Live editor · Spec ·
GitHub**. No personal sign-off (dropped).

---

## Build / architecture

**No new framework.** Extend the existing pipeline — TS template render +
`css.ts` tokens + esbuild inline bundle, deployed static to Netlify. **Zero new
runtime dependencies.**

**Pages built by `npm run build`** (only two now):
- `index.html` — the landing page (new root; was the editor).
- the **live editor** — kept (moves off `index.html`, e.g. `editor.html`).
- The standalone **viewer page is dropped.** The "viewer" concept survives only
  as the hero's embedded map renderer.

**Hero embed.** `landing-entry.ts` (sibling of `viewer-entry.ts`) reuses the
viewer's render/map functions, fed three pre-baked `CrumbDocument` JSONs; the
sticky pill swaps which one renders and which YAML the text section shows.
- *Open:* inline/direct embed vs `viewer.html` in an `iframe`. **Lean direct** —
  the pill drives both the map and the YAML in one DOM; an iframe would need
  postMessage for the map half. Iframe is the fallback if the viewer's CSS bleeds
  into the page.

**Links out = the editor.** Example cards and path ② all **open in the live
editor**, pre-loaded with the chosen example (the editor already embeds the
examples via `window.__CRUMB_EXAMPLES`). One destination — leaner and more
consistent than a separate viewer.

**Landing styling.** New `landing-css.ts` appended to the existing tokens (big
display type, page layout, cards, footer) — separate file, **same tokens**, so
the frame and the embedded viewer stay in lockstep.

**Syntax highlighting.** Hand-rolled tiny YAML highlighter (keys / values /
comments) — no library. Not dogma: at YAML's scale it's ~30–50 lines, ships zero
bytes, and a library theme wouldn't match the tokens without work anyway.

**Dependency rule (clarified, not loosened).** Strict no-deps applies to the
**browser bundle / rendered output** (everything gets inlined into every
self-contained crumb file) and the **spec-critical parser**. Build-time tooling
is already pragmatic (esbuild, ts-node, vitest) and may take a dependency that
clearly pays off. Judge each case by: (1) does it ship into every output?
(2) does it touch the parser? (3) is the hand-rolled version genuinely small?

---

## Open questions

*(none — all resolved)*

## Decided

- Full **live viewer embed** in the hero (not side-by-side text/render, not
  static screenshots).
- Pre-baked digested models for the three hero stages; no parser in the embed.
- One **shared sticky detail-level control** (Sketch/Planned/Full) drives both
  the hero viewer and the "It's just text" YAML; sticky across both sections,
  un-pins after. (Resolves the old "mirror the hero?" question — yes.)
- Mobile: locked inline map + fullscreen expand button.
- **No hero CTA button** — the live demo is the call to action; flow is
  hero → (optional) text + examples → "Give it a try".
- One scrolling page. **No top nav** — all links (Live editor · Spec · GitHub)
  live in the footer; the sticky pill owns the top edge.
- Visual: technical / minimalist / humble, **Vercel-referenced**; purely
  typographic (no display face, no motif); colour only from the map.
- **Borders over shadows** page-wide (hairline 1px; no drop shadows).
- **Dark mode** inherited from the app (system preference).
- Add **landing-specific larger type** beyond the app's 30px ceiling.
- Example cards: **text-only first iteration**; map thumbnails deferred.
- "It's just text" YAML block: **light syntax highlighting**.
- **Motion minimal** for the first iteration (pill morph only).
- **Architecture:** no new framework; extend the TS render + `css.ts` +
  esbuild pipeline; zero new runtime deps.
- **Two pages only:** `index.html` (landing) + the live editor. Standalone
  viewer page dropped; "viewer" lives on only as the hero embed.
- Example cards + path ② **open in the editor** (pre-loaded example), not a
  viewer.
- YAML highlight **hand-rolled**, no library.
- Tone: warm, humble, plain — a project presentation, not a product pitch and
  not a first-person blog; AI mentioned in passing, not spotlighted.
- Free / no-account line intentionally **skipped** — implied by "open format" +
  "plain text"; not worth the words.
- Example cards: Lisbon (guide) · Copenhagen (weekend) · Southeast Asia
  (backpacking) — chosen because they differ in shape from the Japan hero.
- Footer holds all nav (Live editor · Spec · GitHub); no personal sign-off.
- "Embed it anywhere" (③) link ships as *coming soon*; the actual embedding doc
  is a later fast-follow task, not a launch blocker.
- Live-editor link (②) and the nav "Live editor" item use a **dummy URL** for
  now; real deploy target gets wired in later.

## Later tasks (not blocking the page)

- Write the embedding doc the "coming soon" link will point to (confirm how
  embedding works in the current build first, then document it).
- Wire the real live-editor URL into path ② and the footer (replace the dummy
  link once the deploy target is settled).
- Add **map thumbnails** to the example cards (deferred from first iteration).
- Add the **subtle scroll/entrance animations** (kept out of first iteration).
