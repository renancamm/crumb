# Crumb

> *Leave a trail.*

An open format for travel itineraries. Plan trips in plain text. Share the pieces.

Crumb is a human-writable format for describing travel itineraries. Write as little or as much as you know — a list of city names is a valid crumb, and so is a fully timed, day-by-day schedule with bookings and coordinates. Both live in the same format.

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

## Specification

The full specification is in [`CRUMB_SPEC.md`](CRUMB_SPEC.md). It covers:

- **User guide** — format overview, field reference, examples
- **Parser Reference** — three-pass pipeline for tool builders
- **Data models** — TypeScript interfaces for raw and resolved output
- **Worked example** — a complete source crumb with annotated JSON output

---

## Examples

The [`examples/`](examples/) directory contains sample `.crumb` files.

---

## File format

Crumb files use the `.crumb` extension and are valid YAML documents.

```
trip.crumb
japan-2026.crumb
weekend-in-lisbon.crumb
```

---

## Status

The specification is in active development. Feedback and contributions welcome.
