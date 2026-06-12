# Crumb

> *Leave a trail.*

Crumb is an open format for travel itineraries. It is designed to be readable without any tools, editable in any text editor, and structured enough that tools can display it as a map, a timeline, or a day-by-day planner — and precise enough that AI can generate it from a conversation.

The core idea is **progressive detail**. A list of city names is a valid crumb. So is a fully timed schedule with bookings, activities, and transport legs. You add detail as plans take shape.

Crumbs are designed to be shared, remixed, and assembled — the way a recipe is adapted each time someone makes it their own.

**[Try it live →](https://renancamm.github.io/crumb/)** — play with an interactive map, open the live editor, or see how a crumb embeds anywhere.

---

## Quick example

The simplest possible crumb — just places in order:

```yaml
itinerary:
  - Tokyo
  - Kyoto
  - Osaka
```

The same trip with more detail. Each item's **kind is its key** (`place`, `transport`, `stay`, `activity`, `day`); the rest of its fields sit beside that key, and a place's stays, activities, and groups all live in one `plan` list:

```yaml
trip:
  name: Japan in 2 Weeks
  duration: 10 nights
  tags: [asia, food, temples]

itinerary:

  - place: Tokyo
    arrives: 2026-10-05
    duration: 4 nights
    location: Tokyo, Japan
    plan:
      - Senso-ji Temple              # bare activity — just a name
      - activity: teamLab Planets    # an activity with fields
        priority: must
        time: morning
        duration: 2h
      - stay: Shinjuku Granbell Hotel
        arrives: 2026-10-05
      - day: Temple day              # a scheduled group
        plan:
          - Meiji Shrine
          - Harajuku

  - transport: train

  - place: Kyoto
    duration: 3 nights
    plan:
      - Fushimi Inari
      - Kinkaku-ji
```

See [`spec/CRUMB_FOR_AI.md`](spec/CRUMB_FOR_AI.md) for the full set of kinds, fields, and date forms.

---

## Render a crumb

This repository is the reference implementation. It takes any crumb file and produces a self-contained HTML file with an interactive map and a visual itinerary — no server, no build step in the output.

```sh
npm install
npm run render -- examples/japan-detailed.crumb out.html
open out.html
```

Add the live YAML editor shell (for authoring and showcase use):

```sh
npm run render -- examples/japan-detailed.crumb out.html --editor
```

Build the full site — landing page, live editor, and the embeddable map — into `dist/`:

```sh
npm run build           # → dist/{index,editor,embed}.html
```

---

## Verify changes

```sh
npm run typecheck       # tsc --noEmit
npm run test            # vitest suite (parser + formatters)
```

---

## Project layout

The format is the product; this repo is its TypeScript reference implementation.

- **`src/parser`** — `parse(source) → CrumbDocument`. Synchronous, no I/O, three sequential passes: classify structure → resolve values → infer the timeline.
- **`src/renderer`** — turns a parsed document into a self-contained HTML page: an interactive map + itinerary viewer, an optional editor shell, and an embeddable map card. All styles ship inline.
- **`examples/`** — sample `.crumb` files, from a bare sketch to a fully detailed trip.
- **`spec/`** — the format specification and authoring guides (see below).
- **`scripts/`** — the site builder and the offline geocoding-cache generator.

---

## Specification

- [spec/CRUMB_SPEC.md](spec/CRUMB_SPEC.md) — format specification: valid fields, types, and date forms
- [spec/CRUMB_FOR_AI.md](spec/CRUMB_FOR_AI.md) — compact authoring guide for AI systems writing crumbs
- [spec/reference/parser.md](spec/reference/parser.md) — parsing pipeline, resolution rules, worked example
- [spec/reference/data-model.md](spec/reference/data-model.md) — output TypeScript interfaces

---

## Status

Proof of concept. Specification and output format are in active development.

## License

[MIT](LICENSE)
