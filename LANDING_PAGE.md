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

## Navigation

`Crumb` *(logo links home)*  ·  Live editor  ·  Spec

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
FOOTER          GitHub · Spec
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

### 3. Different ways of using it — *different use cases / examples gallery*

Cards for trips of a different *shape* than the Japan hero, each opening the
real crumb in the viewer:

- **Lisbon** — a single-city guide (`lisbon-guide.crumb`)
- **Copenhagen** — a weekend (`copenhagen-weekend.crumb`)
- **Southeast Asia** — months of backpacking (`southeast-asia.crumb`)

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

Just links — no personal sign-off (dropped). GitHub · Spec

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
- One scrolling page; nav = **Live editor · Spec** (the Crumb logo links home,
  so no separate "Home" item).
- Tone: warm, humble, plain — a project presentation, not a product pitch and
  not a first-person blog; AI mentioned in passing, not spotlighted.
- Free / no-account line intentionally **skipped** — implied by "open format" +
  "plain text"; not worth the words.
- Example cards: Lisbon (guide) · Copenhagen (weekend) · Southeast Asia
  (backpacking) — chosen because they differ in shape from the Japan hero.
- No personal sign-off in the footer (dropped) — just GitHub · Spec links.
- "Embed it anywhere" (③) link ships as *coming soon*; the actual embedding doc
  is a later fast-follow task, not a launch blocker.
- Live-editor link (②) and the nav "Live editor" item use a **dummy URL** for
  now; real deploy target gets wired in later.

## Later tasks (not blocking the page)

- Write the embedding doc the "coming soon" link will point to (confirm how
  embedding works in the current build first, then document it).
- Wire the real live-editor URL into path ② and the nav (replace the dummy
  link once the deploy target is settled).
