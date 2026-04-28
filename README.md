# Crumb

> *Leave a trail.*

Crumb is an open format for travel itineraries. It is designed to be readable without any tools, editable in any text editor, and structured enough that tools can display it as a map, a timeline, or a day-by-day planner — and precise enough that AI can generate it from a conversation.

The core idea is **progressive detail**. A list of city names is a valid crumb. So is a fully timed schedule with bookings, activities, and transport legs. You add detail as plans take shape.

Crumbs are designed to be shared, remixed, and assembled — the way a recipe is adapted each time someone makes it their own.

---

## Quick example

The simplest possible crumb — just places in order:

```yaml
itinerary:
  - Tokyo
  - Kyoto
  - Osaka
```

The same trip with more detail:

```yaml
itinerary:
  - Tokyo:
      duration: 5 nights
      activities:
        - Senso-ji Temple:
            priority: must
            time: morning
        - Shibuya Crossing
        - teamLab Planets:
            priority: must

  - train

  - Kyoto:
      duration: 3 nights
      activities:
        - day:
            title: Temples
            items:
              - Fushimi Inari:
                  time: 8am
                  duration: 2h
              - Kinkaku-ji:
                  time: 11am
```

---

## Render a crumb

This repository includes a reference renderer. It takes any crumb file and produces a self-contained HTML file with an interactive map, a visual itinerary, and an in-browser editor with live re-rendering.

```sh
npm install
npx ts-node src/cli.ts examples/europe-backpacking.crumb > out.html
open out.html
```

To write to a file directly:

```sh
npx ts-node src/cli.ts examples/europe-backpacking.crumb dist/europe.html
```

---

## Verify changes

```sh
npx tsc --noEmit
npx ts-node src/cli.ts examples/europe-backpacking.crumb > /dev/null
```

---

## Project layout

```
src/
  cli.ts                   entry point — parses a .crumb file, renders to HTML
  browser-entry.ts         browser bundle entry (esbuild, for live re-rendering)
  parser/
    index.ts               parse(source) → CrumbDocument
    pass1-classify.ts      raw YAML → typed raw tree
    pass2-resolve.ts       raw tree → resolved fields
    pass3-infer.ts         resolved tree → inferred dates + endpoints
  renderer/
    html.ts                renderHtml() + renderItineraryBody()
    css.ts                 all styles
    format.ts              pure formatting helpers
    types.ts               CrumbRenderer interface (for third-party renderers)
  types/
    primitives.ts          shared scalars and enums
    raw.ts                 Pass 1 output types
    resolved.ts            Pass 3 output types (public contract)
examples/                  sample .crumb files
spec/
  CRUMB_SPEC.md            format specification — what valid crumb documents look like
  SPEC_STYLE.md            editorial rules for AI systems updating the SPEC
  reference/
    parser.md              three-pass pipeline + worked example (for tool builders)
    data-model.md          CrumbDocument TypeScript interfaces (for tool builders)
```

---

## Specification

- [spec/CRUMB_SPEC.md](spec/CRUMB_SPEC.md) — format specification: valid fields, types, and date forms
- [spec/reference/parser.md](spec/reference/parser.md) — parsing pipeline, resolution rules, worked example
- [spec/reference/data-model.md](spec/reference/data-model.md) — output TypeScript interfaces

---

## Status

Proof of concept. Specification and output format are in active development.
