# Overview

**Crumb is an open format for travel itineraries** — a plain-text file that turns a
list of places into an interactive map and timeline. It's designed around *progressive
detail*: a bare list of city names is already a valid crumb, and you add dates, stays,
transport, and activities as your plans firm up. The format is the product; everything
here documents it.

A crumb is just YAML with a small, friendly vocabulary, so you can write one by hand,
have an AI generate one, or build your own tool around it.

## How these docs are organized

- **[Format Specification](#doc-spec)** — the complete, authoritative definition: every
  field, type, and rule, with examples.
- **[AI Authoring Guide](#doc-ai-guide)** — how to have an AI draft your crumb from a
  plain-language description, then open the result in the editor.
- **[Embedding](#doc-embedding)** — drop a crumb's interactive map into your own site or
  blog as a single self-contained embed.
- **[Parser Reference](#doc-parser)** — how a parser turns crumb text into a resolved
  document, pass by pass.
- **[Data Model](#doc-data-model)** — the exact TypeScript shape a parser outputs, which
  every viewer reads.

## Where to start

**Just want to make one?** You don't need to read the spec. Open the
[live editor](editor.html) and start typing, or follow the
[AI Authoring Guide](#doc-ai-guide) to have an AI write the crumb from a plain-language
description of your trip.

**Putting a trip on your website?** Go straight to [Embedding](#doc-embedding). The map
is self-contained — no server, build step, or API key.

**Building a tool that reads or displays crumbs?** Start with the
[Format Specification](#doc-spec) to learn the vocabulary, then use the
[Parser Reference](#doc-parser) and [Data Model](#doc-data-model) to implement or
consume a parser. There's a reference implementation in TypeScript to build on.

## The shape of a crumb

The simplest crumb is an ordered list of places:

```crumb
itinerary:
  - Tokyo
  - Kyoto
  - Osaka
```

The same trip, with detail added as it becomes known:

```crumb
trip:
  name: Japan in Autumn
  note: Two weeks, Tokyo down to Hiroshima.
itinerary:
  - place: Tokyo
    arrives: Nov 3
    duration: 4 nights
  - transport: train
    to: Kyoto
    duration: 2h 15m
  - place: Kyoto
    duration: 3 nights
```

Both are valid. That range — from a sketch to a fully timed schedule, in one format — is
the whole idea. The [Format Specification](#doc-spec) covers everything you can express.
