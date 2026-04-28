# CRUMB_SPEC Editorial Style Guide

This document is a brief for AI systems tasked with editing `CRUMB_SPEC.md`. Include it as context whenever asking an AI to update the SPEC. Apply the [Verification Checklist](#verification-checklist) to verify that any proposed change stays within scope and remains useful to all reader types.

---

## What CRUMB_SPEC.md Is

- A **format specification**: defines what makes a document a valid crumb
- **Implementation-agnostic**: a team in any language should be able to build a compliant parser and renderer from it alone, without reading any code in this repository
- **Usable as an AI prompt context**: any section should be independently legible when pasted into a chat
- **Not** a user manual for any specific tool
- **Not** a parser reference — that is `reference/parser.md`
- **Not** a data model reference — that is `reference/data-model.md`

---

## Reader Types

Understanding who reads the SPEC — and why — determines every editorial rule.

### Authors

Entities that produce crumb documents. Primarily AI systems generating itineraries from conversation. Secondarily, humans sketching a trip.

What authors need:
- A strong minimal example showing that a bare list of names is genuinely valid, not just theoretically
- Complete vocabulary lists for all bounded sets — any hint of "some examples include" causes AI systems to hallucinate additional values that do not exist
- Consistent, single-term naming for every element type — synonym variation in the SPEC produces synonym variation in output
- Minimal form shown before detailed form — AI systems default to the first example they see

### Implementers

Entities building parsers or renderers.

What implementers need:
- Precise semantic definitions — what values mean, not how to implement them
- Clear optionality — which fields are required, which are optional
- Explicit disambiguation for constructs with easily confused forms

Both reader types share the same needs: no implementation language, example-led sections, consistent structure.

---

## Required Structure

These sections must appear in `CRUMB_SPEC.md` in this order:

| # | Section | Constraint |
|---|---|---|
| 1 | Introduction | One paragraph. What a crumb document is. No tool behavior. |
| 2 | A Quick Look | Minimal example first (bare names only), then detailed. Never reverse. |
| 3 | How the Format Works | Core rules as format properties, not tool behaviors. |
| 4 | Top-level Fields | `trip` and `itinerary` |
| 5 | Itinerary: Places | Including Stay and Activities sub-sections |
| 6 | Itinerary: Transport | |
| 7 | Field Types | Named type overview table |
| 8 | Field Reference | Grammar for each named type. Minimal form before detailed form within each type. |
| 9 | For tool builders | Links only. No content. |

---

## Editorial Rules

### Rule 1 — The format is the subject, not a tool

Every sentence must have a field, value, or document as its subject. Never use "the parser", "the renderer", "the tool", "the engine", or the format name as a stand-in for an implementation.

| Bad | Good |
|---|---|
| *"The parser does not perform geocoding."* | *"Geocoding is not part of the Crumb format."* |
| *"Crumb understands a wide range of date formats."* | *"A wide range of date formats are valid."* |
| *"Crumb resolves relative dates from context."* | *"Relative dates are resolved from the surrounding itinerary context."* |

### Rule 2 — Semantics, not behaviors

State what a value *means*, not what an implementation *does* with it. The SPEC defines the contract; the reference documents define how to honor it.

| Bad | Good |
|---|---|
| *"Activities inside a `plan` group do not get resolved dates."* | *"A `plan` group is unscheduled — its contents are not part of the itinerary's chronological sequence."* |
| *"Used as-is for display when no arrival date is set."* | *"When no arrival date is known, relative values describe position within the stay."* |

### Rule 3 — No implementation vocabulary

These words and phrases must not appear in `CRUMB_SPEC.md`:

`parse phase` · `render phase` · `resolve` · `resolved dates` · `infer` · `inferred` · `geocoding service` · `date sequencing` · `display-only` · `used as-is` · `pass 1/2/3` · `output type` · `data model`

### Rule 4 — No renderer output vocabulary

The SPEC does not describe what appears on screen, on a map, or in any rendered view. Rendering is a separate concern with no normative status in the format specification.

Phrases to avoid: "appears on the map", "shown in the timeline", "displayed as", "rendered as".

### Rule 5 — Minimal form first, detailed form second

Within any field section or type description, show the simplest valid form before the most detailed. For AI authors, the first example encountered becomes the default. Leading with a detailed form produces verbose output; leading with a bare form teaches that sparse is valid.

Required pattern for every element with optional sub-fields:

```yaml
# Minimal
- Tokyo

# With fields
- Tokyo:
    duration: 5 nights
    tags: [city, food]
```

### Rule 6 — Exhaust all bounded vocabularies

Every enum, keyword list, or fixed vocabulary must be listed completely. Never use "e.g.", "such as", "for example", or "including" when describing a finite set. The phrase "some examples include" signals to an AI reader that unlisted values are also valid.

| Bad | Good |
|---|---|
| *"Transport modes include `train`, `flight`, and `bus`."* | *"Valid modes: `train`, `flight`, `bus`, `car`, `ferry`, `walk`, `bike`, `transport`."* |
| *"Priority can be set to values like `must`."* | *"Valid values: `must`, `maybe`."* |

### Rule 7 — One term per concept

Pick one word for each element type and use it consistently throughout the SPEC. Never introduce a synonym for a concept already named. An AI system that sees "place", "city", "destination", and "stop" used interchangeably will use all of them interchangeably in its output.

Canonical terms in `CRUMB_SPEC.md`:

| Concept | Canonical term |
|---|---|
| A stop in the itinerary | `place` |
| A leg between places | `transport leg` |
| Accommodation within a place | `stay` |
| A thing to do at a place | `activity` |
| A named collection of activities | `activity group` |
| The ordered list of places and transport legs | `itinerary` |
| A temporal expression | `Moment` |
| A length of time | `Duration` |
| A geographic reference | `Geolocation` |
| A list of custom key-value pairs | `MetadataList` |
| A free-text string supporting markdown | `Text` |

### Rule 8 — Counter-examples for ambiguous constructs

When a construct has a form that is easy to confuse or get wrong — especially YAML-sensitive or capitalization-sensitive forms — include an explicit note on what is NOT valid.

Example of required disambiguation:

> Transport keywords are lowercase-only. `train` is a transport leg; `Train` is a place name.

Example of required special-value disambiguation:

> `location: none` opts a place out of geocoding. `location: null` is not valid.

### Rule 9 — Field tables are consistent

Every field table has exactly three columns with these headers: `Field`, `Type`, `Description`.

- `Field`: the YAML key name, in backticks
- `Type`: a named type from the Field Types section, or one of the primitives `string`, `number`, `list`, `enum`
- `Description`: what the value means — not what tools do with it

---

## Verification Checklist

Apply before committing any change to `CRUMB_SPEC.md`.

**Scope**
- [ ] No sentence uses "the parser", "the renderer", "the tool", "automatically", "Crumb understands", or "Crumb resolves" as its framing
- [ ] No implementation vocabulary from Rule 3 appears in the edited section
- [ ] No renderer output vocabulary from Rule 4 appears in the edited section

**Completeness**
- [ ] All enums and fixed vocabularies in the edited section are listed exhaustively — no "e.g." or "such as" for a finite set
- [ ] No synonym introduced for a concept already named in the canonical term list (Rule 7)
- [ ] Every field section shows the minimal valid form before the detailed form

**Clarity for crumb document authors**
- [ ] An AI system given only this section could generate a valid crumb document using the construct being described
- [ ] Ambiguous or capitalization-sensitive forms include an explicit note on what is NOT valid

**Format**
- [ ] Every new field appears in a table with `Field | Type | Description` columns
- [ ] Every new type has at least one YAML example
- [ ] Every new example uses a realistic travel scenario, not placeholder text like `foo` or `example`

---

## Anti-patterns

These are real drift instances found in `CRUMB_SPEC.md`. They serve as named examples of the rules above.

---

### Anti-pattern A — "The parser does not…"

**Where:** `### Geolocation`, geocoding paragraph

**Problem (Rule 1, Rule 4):** The geocoding note says "This is a render-phase concern — the parser does not perform geocoding." This makes the parser and renderer subjects of SPEC sentences, and describes renderer behavior.

**Fix:** Describe only what `location: none` signals as a format value.

> Bad: *"This is a render-phase concern — the parser does not perform geocoding. The parsed output always contains the authored text; the renderer decides whether to resolve it to coordinates."*
>
> Good: *"`location: none` marks a place as having no geographic coordinates. Coordinate lookup and map placement are outside the scope of the Crumb format."*

---

### Anti-pattern B — "Does not get resolved dates"

**Where:** `### Activity groups`, `plan` group description

**Problem (Rule 2, Rule 3):** "Does not participate in date sequencing", "activities inside it do not get resolved dates", "display-only containers" are all parser and renderer concepts.

**Fix:** Define what `plan` means as a format value.

> Bad: *"A `plan` group is not scheduled: it does not participate in date sequencing, and activities inside it do not get resolved dates even if they have a `time` field. `plan` groups are display-only containers."*
>
> Good: *"A `plan` group is unscheduled — its contents are not part of the itinerary's chronological sequence. Use it for themed collections, alternatives, or ideas that don't belong to a specific day or week."*

---

### Anti-pattern C — "Used as-is for display"

**Where:** `#### Relative`, `Moment` section

**Problem (Rule 2, Rule 4):** "When no arrival date is set, these values are used as-is for display" describes renderer behavior, not format semantics.

**Fix:** Describe what relative values mean when no arrival date is present.

> Bad: *"When no arrival date is set, these values are used as-is for display."*
>
> Good: *"When no arrival date is set, relative values describe position within the stay without resolving to a calendar date."*

---

### Anti-pattern D — "Automatically continues"

**Where:** `### Activity groups`, sequencing paragraph

**Problem (Rule 1):** "It automatically continues from the previous one" uses "automatically" as shorthand for "a parser does this". The word "automatically" implies implementation behavior.

**Fix:** State the semantic rule directly.

> Bad: *"When a `day` or `week` group has no explicit `time`, it automatically continues from the previous one."*
>
> Good: *"When a `day` or `week` group has no explicit `time`, it begins the day or week immediately following the previous group."*
