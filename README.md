# Crumb

> *Leave a trail.*

An open format for travel itineraries. Write trips in plain YAML — a list of city names is a valid crumb, and so is a fully timed, day-by-day schedule with geocoded locations. Both live in the same format.

---

## Quick example

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

```sh
npm install
npx ts-node src/cli.ts examples/japan-2-weeks.crumb > out.html
open out.html
```

Produces a self-contained HTML file with an interactive map, a visual itinerary, and an in-browser editor with live re-rendering.

To write to a file directly:

```sh
npx ts-node src/cli.ts examples/japan-2-weeks.crumb dist/japan.html
```

---

## Verify changes

```sh
npx tsc --noEmit
npx ts-node src/cli.ts examples/japan-2-weeks.crumb > /dev/null
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
  CRUMB_SPEC.md            user guide
  reference/
    parser.md              three-pass pipeline + worked example (for tool builders)
    data-model.md          CrumbDocument TypeScript interfaces (for tool builders)
```

---

## Specification

- [spec/CRUMB_SPEC.md](spec/CRUMB_SPEC.md) — format overview, field reference, examples
- [spec/reference/parser.md](spec/reference/parser.md) — parsing pipeline, resolution rules, worked example
- [spec/reference/data-model.md](spec/reference/data-model.md) — output TypeScript interfaces

---

## Status

Proof of concept. Specification and output format are in active development.
