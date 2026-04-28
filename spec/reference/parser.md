# Crumb Parser Reference

This document is for tool builders. It defines the complete parsing pipeline for a Crumb document — from raw YAML to a fully resolved `CrumbDocument` value.

Parsing runs in three passes. **Pass 1** reads the raw YAML and classifies every node into a typed tree without interpreting any field values. **Pass 2** resolves each field value into its output type. **Pass 3** fills in everything implied by the structure — inferred dates, assembled groups, and resolved contradictions. Each pass takes the output of the previous one as its input.

Parsers are forgiving throughout. Invalid or unrecognised values are stored as-is rather than causing errors. The only hard failure is a YAML parse error at the document level — everything else degrades gracefully.

The TypeScript implementation lives in `src/parser/`:
- `pass1-classify.ts` — implements Pass 1
- `pass2-resolve.ts` — implements Pass 2
- `pass3-infer.ts` — implements Pass 3

---

## Pass 1 — Structure

*Input: raw YAML. Output: `RawCrumbDocument`.*

### 1.1 Document validation

- A valid Crumb document is a YAML file whose root is a mapping.
- The root mapping must contain at least one of the keys `trip` or `itinerary`.
- If neither key is present, the document is invalid and parsing stops.
- If YAML parsing fails entirely, parsing stops.
- An `itinerary` value that is an empty list is valid.
- Unknown root-level keys are ignored.

### 1.2 Itinerary items

Each item in `itinerary` is either a bare string or a single-key mapping. Classify as follows:

- A bare string whose value exactly matches a transport keyword in lowercase → `RawTransportLeg` with no fields.
- A single-key mapping whose key exactly matches a transport keyword in lowercase → `RawTransportLeg` with fields from the mapping value.
- Any other bare string → `RawPlace` with that string as `name` and no fields.
- Any other single-key mapping → `RawPlace` with the key as `name` and fields from the mapping value.
- Items that are not a string or single-key mapping are ignored.

Transport keywords (case-sensitive, lowercase only): `train`, `flight`, `bus`, `car`, `ferry`, `walk`, `bike`, `transport`. A capitalised form such as `Train` is a place name, not a transport leg.

**YAML string note:** Place names must be valid YAML strings. YAML parses bare values such as `null`, `true`, `false`, `yes`, `no`, `on`, `off`, and plain numbers as non-string scalars — these will not be classified as places. Quote them when needed: `- "null"`, `- "2026"`. Items that fail to parse as a string or single-key mapping are silently ignored.

### 1.3 Place fields

Recognised fields on a `RawPlace` node: `arrives`, `departs`, `duration`, `timezone`, `location`, `tags`, `stay`, `activities`, `info`, `note`. All other keys are ignored.

- `timezone` must be a string. A non-string value is ignored and `timezone` is treated as absent. No validation of the timezone name is performed by the parser — it is stored as-is and passed to consumers.

- `stay` must be a YAML list. A non-list value is ignored and `stay` is treated as absent.
- `activities` must be a YAML list. A non-list value is ignored and `activities` is treated as absent.
- `tags` and `info` must be YAML lists. Non-list values are stored as-is and resolved in Pass 2.

### 1.4 Transport fields

Recognised fields on a `RawTransportLeg` node: `from`, `to`, `departs`, `arrives`, `duration`, `info`, `note`. All other keys are ignored.

### 1.5 Activity items

Each item in `activities` is either a bare string or a single-key mapping. Classify as follows:

- A bare string → `RawActivity` with that string as `name` and no other fields.
- A single-key mapping whose key exactly matches an activity group keyword → `RawActivityGroup` with that keyword as `kind`.
- A single-key mapping whose key does not match an activity group keyword → `RawActivity` with the key as `name` and fields from the mapping value.
- If the value of a detailed activity mapping is not itself a mapping, treat it as a bare `RawActivity` with just the name.
- Items that are not a string or single-key mapping are ignored.

Activity group keywords (case-sensitive, lowercase only): `day`, `week`, `plan`.

### 1.6 Activity group fields

A `RawActivityGroup` node is produced in one of two forms:

**Shorthand form** — the mapping value is a YAML list.
- Treat the list directly as `items`. Each item is classified as an activity item per 1.5, except that nested `RawActivityGroup` items are ignored.

**Detailed form** — the mapping value is a YAML mapping.
- Recognised fields: `title`, `time`, `duration`, `items`.
- `items` must be a YAML list. A non-list value is ignored and `items` is treated as an empty list.
- Each item in `items` is classified as an activity item per 1.5, except that nested `RawActivityGroup` items are ignored.
- All other keys are ignored.

If the mapping value is neither a list nor a mapping, the group has no items and no fields.

### 1.7 Stay items

Each item in `stay` is either a bare string or a single-key mapping. Classify as follows:

- A bare string → `RawStay` with that string as `name` and no other fields.
- A single-key mapping → `RawStay` with the key as `name` and fields from the mapping value.
- Items that are not a string or single-key mapping are ignored.

Recognised fields on a `RawStay` node: `arrives`, `departs`, `duration`, `location`, `tags`, `info`, `note`. All other keys are ignored.

---

## Pass 2 — Field resolution

*Input: `RawCrumbDocument`. Output: resolved node tree — same structure as `RawCrumbDocument` but with all `RawMoment`, `RawDuration`, and `RawGeolocation` fields replaced by their resolved counterparts. `priority` is narrowed to `Priority` or omitted. `tags` is validated to `string[]` or absent. `info` is validated to `MetadataItem[]`. `note` is validated to `string` or absent.*

Every field value is resolved independently. Resolution never inspects neighbouring nodes — that is the job of Pass 3. The original string is always preserved in `label` on `ResolvedMoment` and in `label` on `ResolvedDuration`, regardless of whether resolution succeeds.

Valid input forms for all field types are defined in CRUMB_SPEC.md. This section defines how each form is classified and what output type it produces.

### 2.1 `Moment` → `ResolvedMoment`

Resolve each Moment string into a `ResolvedMoment`. The string is parsed into an optional `date` part, an optional `time` part, and a `label` preserving the original. All three can coexist independently.

**Combination forms (`X at Y`, weekday + named period):** Split on `at` first. The left side is resolved as the date part; the right side as the time part. A weekday followed directly by a named period (no `at`) is split on the first named period keyword.

**Date part — `DateRef`:**

| Input form | Precision | Notes |
|---|---|---|
| `YYYY-MM-DD` | absolute | |
| `YYYY-MM-DDTHH:MM` | absolute | Date extracted; time resolved separately |
| `YYYY-MM-DDTHH:MM±HH:MM` | absolute | Date extracted; UTC offset stored on time part |
| Month-name + day + year | absolute | Normalised to `YYYY-MM-DD`. Full and abbreviated month names accepted. Day-before-month and month-before-day both valid. Ordinal suffixes (`st`, `nd`, `rd`, `th`) accepted and stripped. |
| Month-name + day (no year) | relative | Resolved against current year at parse time in Pass 3; rolls forward if date has passed. Stored as-is in `value`. |
| Month-name + year (no day) | relative | Month precision only. Stored as-is in `value`. |
| Month-name only | relative | No day or year. Stored as-is in `value`. |
| `early [Month] [Year?]` | approximate | `estimate` = 5th of that month. Year inferred if omitted: current year if month is upcoming, next year if passed. |
| `mid [Month] [Year?]` / `middle of [Month] [Year?]` | approximate | `estimate` = 15th of that month. Same year inference rule. |
| `late [Month] [Year?]` | approximate | `estimate` = 25th of that month. Same year inference rule. |
| `sometime in [Month] [Year?]` | approximate | `estimate` = 15th of that month. Same year inference rule. |
| `around [Month] [Day][, Year?]` / `around [Day] [Month] [Year?]` | approximate | `estimate` = that calendar date. Ordinal suffixes accepted and stripped. Same year inference rule. |
| `spring [Year]` | approximate | `estimate` = Apr 1 of that year. Year required. |
| `summer [Year]` | approximate | `estimate` = Jul 1 of that year. Year required. |
| `fall [Year]` / `autumn [Year]` | approximate | `estimate` = Oct 1 of that year. Year required. |
| `winter [Year]` | approximate | `estimate` = Jan 1 of year+1 (e.g. `winter 2026` → `2027-01-01`). Year required. |
| `Day N` / `Nth day` (N a positive integer) | relative | Both forms equivalent. `Day 0` / `0th day` invalid — treated as unrecognised. |
| `Week N` / `Nth week` (N a positive integer) | relative | Both forms equivalent. `Week 0` invalid. |
| `first day` | relative | Equivalent to `Day 1`. |
| `last day` | relative | Requires place `departs` to resolve in Pass 3. Stored as-is otherwise. |
| `next day` | relative | Scope-aware stepper. Resolved in Pass 3 step 3.5. |
| `next week` | relative | Scope-aware stepper. Resolved in Pass 3 step 3.5. |
| `Monday` through `Sunday` | relative | Resolved to next occurrence on or after place `arrives` in Pass 3 step 3.5. |
| Unrecognised | — | `date` absent; string stored in `label` only. |

**Time part — `TimeOfDay`:**

| Input form | Precision | Notes |
|---|---|---|
| `HH:MM` | exact | 24-hour. Normalised to `"HH:MM"` string. |
| `H:MMam`, `Ham`, `H:MM AM`, `HAM` and variations | exact | 12-hour. Normalised to 24-hour. Case-insensitive. Space before `am`/`pm` optional. |
| Named period | loose | Normalised to canonical `LoosePeriod` value; `estimate` assigned. |
| Unrecognised | — | `time` absent. |

**Named period canonical values and sort estimates:**

| Input | `LoosePeriod` value | Estimate |
|---|---|---|
| `early morning` | `"early morning"` | `06:00` |
| `morning` | `"morning"` | `09:00` |
| `midday` | `"midday"` | `12:00` |
| `afternoon` | `"afternoon"` | `14:30` |
| `late afternoon` | `"late afternoon"` | `17:00` |
| `evening` | `"evening"` | `19:30` |
| `night` | `"night"` | `22:00` |
| `late night` | `"late night"` | `02:00` |
| `midnight` | `"midnight"` | `23:59` |

No synonyms are accepted. Any value not exactly matching a named period is unrecognised and falls through to the unrecognised case.

### 2.2 `Duration` → `ResolvedDuration`

Parse each Duration string and classify into one of the output types below. `label` always preserves the original string.

**Numeric values (N, M must be positive numbers; zero and negative are invalid → `unknown`):**

| Input form | Output type |
|---|---|
| `Nh`, `Nm`, `NhNm`, `Nd`, `Nw`, `Nn` | `exact` |
| `N unit` / `N unit M unit` | `exact` |
| `around N unit`, `around Nh` etc. | `approximate` |
| `at least N unit`, `at least Nh` etc. | `minimum` |
| `N to M unit`, `Nh to Mh`, `N-M unit`, `Nh-Mh` | `range` |

Valid shorthand units: `h` (hours), `m` (minutes), `d` (days), `w` (weeks), `n` (nights).

Valid plain English units: `minute`, `minutes`, `hour`, `hours`, `day`, `days`, `night`, `nights`, `week`, `weeks`.

For `range`, N must be less than M. If N ≥ M, treat as `unknown`.

**Named spans:**

| Input form | Output type | `span` value | Estimate |
|---|---|---|---|
| `all day` | `named` | `"all day"` | `{ value: 10, unit: "hours" }` |
| `half day` | `named` | `"half day"` | `{ value: 5, unit: "hours" }` |
| `overnight` | `named` | `"overnight"` | `{ value: 1, unit: "nights" }` |
| `around <span>` | `named-approximate` | as above | as above |
| `at least <span>` | `named-minimum` | as above | as above |
| `<span> to <span>`, `<span>-<span>` | `named-range` | `min`, `max` | `minEstimate` and `maxEstimate` from each span |

For `named-range`, `min` and `max` must be different spans. If the same span appears on both sides, treat as `unknown`.

**Fallback:**

Anything not matching the above → `{ type: "unknown", label: <original string> }`.

### 2.3 `Geolocation` → `ResolvedGeolocation`

- The plain string `"none"` → `{ label: "none", geocodingDisabled: true }`. Signals to renderers that this location should not be geocoded.
- Any other plain string value → `{ label: <original string> }`. No other fields set.
- A mapping value must contain at least one of `name`, `address`, `lat`, or `lng`. An empty mapping is ignored and `location` treated as absent.
- `lat` and `lng` are only valid as a pair. If one is present without the other, both are discarded.
- `lat` must be between −90 and 90 inclusive. `lng` must be between −180 and 180 inclusive. Out-of-range values cause the coordinate pair to be discarded.
- `label` is derived in order of preference: `name` → `address` → `"lat,lng"` string.

`from` and `to` on `RawTransportLeg` nodes follow the same resolution rules.

### 2.4 `priority` → `Priority`

- `"must"` → `Priority.must`
- `"maybe"` → `Priority.maybe`
- Any other value, or absent → field omitted from output.

### 2.5 `MetadataList` → `MetadataItem[]`

Each item in the `info` list must be a single-key mapping where the key is a non-empty string and the value is a string or number.

- The key must be a non-empty string.
- The value must be a string or number. Values of any other type are ignored.
- Items that do not meet these requirements are ignored.
- Valid items are emitted as `{ key: string, value: string | number }`.

### 2.6 `tags` → `string[]`

- `tags` must be a YAML list. A non-list value is ignored and `tags` is treated as absent.
- Each item must be a string. Non-string items are ignored.
- If all items are invalid, `tags` is treated as absent.

### 2.7 `note` → `string`

- `note` must be a string. A non-string value is ignored and `note` is treated as absent.
- The value is stored as-is with no transformation. CommonMark markdown within the string is not parsed — that is a renderer concern.

---

## Pass 3 — Inference

*Input: resolved node tree. Output: `CrumbDocument`.*

Pass 3 runs five steps in order. Each step may produce information that a later step depends on.

### 3.1 `UngroupedActivities` assembly

For each resolved Place in the itinerary:
- Collect all resolved Activity nodes that appear directly in `activities` and are not inside any resolved ActivityGroup.
- If at least one exists, wrap them in an `UngroupedActivities` node, preserving source order.
- Insert `UngroupedActivities` as the first item in `Place.activities`.
- Append all resolved ActivityGroup nodes from `activities`, in source order, as `ActivityGroup` nodes in `Place.activities`.
- If no standalone activities exist, `UngroupedActivities` is not emitted and `Place.activities` begins with the first `ActivityGroup` in source order.

### 3.2 Transport endpoint inference

For each `TransportLeg` in the itinerary:

- If `from` is absent, scan backward through the itinerary for the nearest preceding `Place`. If found, set `from` to `{ label: place.name }`.
- If `to` is absent, scan forward through the itinerary for the nearest following `Place`. If found, set `to` to `{ label: place.name }`.
- If no preceding or following `Place` exists, the field remains absent.
- An explicitly authored `from` or `to` is never overwritten.

### 3.3 Group time injection

For each `Place`, walk its `activities` array and inject a default `time` value on any `day` or `week` group that has no explicit `time` field.

- A `day` group with no `time` → set `time` to `{ date: { precision: "relative", value: "next day" }, label: "next day" }`.
- A `week` group with no `time` → set `time` to `{ date: { precision: "relative", value: "next week" }, label: "next week" }`.
- Groups that already have a `time` field are never overwritten.

`plan` groups and `UngroupedActivities` are not affected.

After this step, every `day` and `week` group in the document is guaranteed to have a `time` field.

### 3.4 Anchor propagation

Anchor propagation gives every `ResolvedMoment` in the document a resolved date context where one can be determined.

**Anchor sources and precedence** (highest to lowest):

| Precedence | Source |
|---|---|
| `"transit"` | `TransportLeg.departs` / `TransportLeg.arrives` |
| `"place"` | `Place.arrives` / `Place.departs` |
| `"stay"` | `Stay.arrives` / `Stay.departs` |
| `"explicit"` | Any `ActivityGroup.time` with an explicitly authored or injected date |
| `"inferred"` | Duration arithmetic |

A higher-precedence anchor never overwrites one set by a higher source. Within the same precedence level, the nearest source wins.

**Propagation direction:** Propagation is **forward-only**. Once an absolute date is established at any point in the itinerary, it propagates forward to subsequent nodes. Each `Place.duration` and `TransportLeg.duration` advances the running date estimate. No backward propagation is performed.

**Duration arithmetic for propagation:**

Calendar-day conversion rules:
- `N nights` = N calendar days (5 nights from Oct 10 → departs Oct 15).
- `N days` = N calendar days.
- `N weeks` = N × 7 calendar days.
- `hours` and `minutes` do **not** advance the calendar date anchor — they are ignored for propagation.
- `overnight` (named span) = 1 calendar day advance.
- `all day` and `half day` (named spans) = hours only, no date advance.

Qualified durations:
- `approximate` (e.g. `around 3 nights`): use the stated value as-is, same as exact.
- `minimum` (e.g. `at least 3 nights`): use the stated value as the estimate.
- `range` (e.g. `2 to 3 nights`): use the **max** value as the estimate.
- `unknown`: duration is ignored; no propagation.

Transport leg `duration` contributes to forward propagation using the same rules (hours/minutes are ignored, days/nights advance the date).

**`plan` groups:** `plan` groups and their activities do not participate in anchor propagation. Any `time` field on a `plan` group or its activities is stored as-is and receives no anchor.

**Anchor fields:**
- `anchor.date` (`YYYY-MM-DD`) is set whenever a calendar date can be resolved.
- `anchor.offset` (1-based ordinal from itinerary start) is set in relative-only itineraries where no calendar date exists anywhere. Once any absolute date is established, `offset`-based anchors are promoted to `date` anchors where reachable.
- At least one of `date` or `offset` is always present on any `Anchor`.

**When an anchor is set:**
- When `date.precision` is `"relative"`.
- When `date` is entirely absent (e.g. a time-only `ResolvedMoment` such as `"morning"` on an activity inside a resolved day group).
- Never when `date.precision` is `"absolute"` — the date is already explicit.

**When no anchor can be set:** If no anchor of any kind is reachable through forward propagation, the `ResolvedMoment` carries no `anchor`. This is valid and expected for fully isolated relative values.

### 3.5 Relative date resolution

This step walks every `ResolvedMoment` in the document that has a `date.precision` of `"relative"` and attempts to resolve it to a calendar date, stored in `anchor.date`. The `DateRef` itself is never modified — the resolved date is always placed on the `anchor`.

`approximate` DateRef values are not processed in this step — their `estimate` is already a resolved calendar date assigned in Pass 2. They carry no `anchor`.

Resolution depends on what relative form was authored or injected:

**Month-name + day without year (e.g. `September 15`)**
- Resolved using the current year at parse time.
- If the resulting date has already passed within the current year, advance to the following year.
- Precedence: `"explicit"`.

**Month-name + year without day (e.g. `September 2026`)**
- Resolved to the first day of that month.
- Precedence: `"explicit"`.

**Month-name only (e.g. `September`)**
- Resolved to the first day of that month in the current year at parse time; rolls forward to the following year if the month has passed.
- Precedence: `"explicit"`.

**`Day N` / `Nth day` / `first day`**
- Resolved relative to the parent place's `arrives` date. `Day 1` = `arrives`, `Day 2` = `arrives + 1 day`. `first day` is equivalent to `Day 1`.
- If no `arrives` date is available, attempt to derive one from an adjacent transport leg or anchor propagation.
- If no date context is available, stored as a display-only label and no `anchor.date` is set.
- Precedence: `"explicit"`.

**`Week N` / `Nth week`**
- Resolved relative to the parent place's `arrives` date. `Week 1` = `arrives`, `Week 2` = `arrives + 7 days`.
- Same fallback and precedence rules as day ordinals.

**`last day`**
- Resolved to the parent place's `departs` date.
- If no `departs` date is available, stored as a display-only label and no `anchor.date` is set.
- Precedence: `"explicit"`.

**`next day` / `next week`**
- Scan backward through the parent place's `activities` array for the nearest preceding `ActivityGroup` that has a resolved `anchor.date`. `plan` groups and `UngroupedActivities` are skipped.
- If a preceding anchored group is found: `next day` = that group's `anchor.date` + 1 day; `next week` = + 7 days. Precedence: `"explicit"`.
- If no preceding anchored group exists (this is the **first** `day`/`week` group in the place): resolve against the place `arrives` date directly. `next day` = `arrives`; `next week` = `arrives`. Precedence: `"place"`.
  - **Note:** For the first group, `next day` resolves to the `arrives` date — that is, Day 1 of the stay. "Next" means "the next available day slot in the sequence starting from arrival," not "the day after arrival." Subsequent groups advance by one day or one week from the previous group.
- If no place date context is available, stored as a display-only label and no `anchor.date` is set.

**`Monday` through `Sunday`**
- Resolved to the next occurrence of that weekday on or after the parent place's `arrives` date.
- If `arrives` itself falls on the named weekday, that date is used.
- If no place date context is available, stored as a display-only label and no `anchor.date` is set.
- Precedence: `"explicit"`.

**Combined weekday + named period (e.g. `Monday morning`)**
- The date part is resolved using the weekday rule above.
- The time part was already resolved to a `TimeOfDay` in Pass 2.
- Both results are combined into the single `ResolvedMoment`.

**Activity anchoring within groups:**
- Each `Activity` inside a `day` or `week` group that has a resolved anchor inherits the group's date as its own anchor when the activity's `time` has no date or has a relative date.
- Activities with an absolute `time` are not affected.
- Activities inside a `plan` group are **not** affected by this rule — they receive no anchor from the group.

### 3.6 Contradiction resolution

**`arrives`/`departs` vs `duration` on the same node:**
- If both are present on a `Place` or `Stay`, `arrives` and `departs` take precedence.
- `duration` is only used for sequencing when no explicit dates are present.

**`Place` dates vs `Stay` dates:**
- A `Place` and its `Stay` items describe complementary scopes: place dates define the overall visit window; stay dates define the accommodation window.
- For anchor propagation purposes, `place` outranks `stay`. When resolving anchors for activities and groups within a place, place dates are preferred over stay dates.

---

## Worked Example

This section walks a small crumb document through all three passes and shows the final `CrumbDocument` output. Use it as a reference implementation test case.

### Source

```yaml
itinerary:

  - Kyoto:
      arrives: 2026-10-12
      departs: 2026-10-14
      stay:
        - Gion Guesthouse:
            arrives: 2026-10-12
            departs: 2026-10-14
      activities:
        - Nishiki Market:
            priority: must
            time: morning
        - day:
            title: Temple day
            items:
              - Fushimi Inari:
                  time: 8am
                  duration: 2h
              - Kinkaku-ji:
                  time: 11am
                  duration: 1h
        - day:
            title: Arashiyama
            items:
              - Bamboo Grove:
                  time: morning
              - Tenryu-ji:
                  priority: must
                  time: afternoon

  - train:
      departs: 2026-10-14T10:00

  - Osaka:
      arrives: 2026-10-14
      duration: 2 nights
```

### What each pass does to it

**Pass 1** classifies every node. `Kyoto` and `Osaka` become `RawPlace` nodes. `train` matches a transport keyword and becomes a `RawTransportLeg`. `Nishiki Market` becomes a `RawActivity`. The two `day` mappings become `RawActivityGroup` nodes with `kind: "day"`.

**Pass 2** resolves all field values. ISO dates become absolute `DateRef` values. `morning` and `afternoon` become loose `TimeOfDay` values with estimates. `8am` and `11am` become exact `TimeOfDay` values. `must` becomes `Priority`. `2h` and `1h` become exact `ResolvedDuration` values. `2 nights` becomes an exact `ResolvedDuration`.

**Pass 3** runs five steps:
- **3.1** — `Nishiki Market` is standalone; it is wrapped in `UngroupedActivities` and placed first in `Kyoto.activities`. The two `day` groups follow in source order.
- **3.2** — The train has no `from` or `to`; both are inferred from neighbouring places: `from: { label: "Kyoto" }`, `to: { label: "Osaka" }`.
- **3.3** — Neither `day` group has a `time`; `next day` is injected on both.
- **3.4** — Anchor propagation gives every relative or date-absent `ResolvedMoment` a date from context. `Kyoto.arrives` (2026-10-12) propagates as a `"place"` anchor to the ungrouped activity and activities inside the first group.
- **3.5** — The first `day` group's injected `next day` has no preceding anchored group, so it resolves to the place `arrives` date: **2026-10-12**. The second `day` group's `next day` finds the first group as its predecessor and resolves to **2026-10-13**. Activities inside each group inherit their group's resolved date.

### Final output

```json
{
  "itinerary": [
    {
      "type": "place",
      "name": "Kyoto",
      "arrives": {
        "date": { "precision": "absolute", "value": "2026-10-12" },
        "label": "2026-10-12"
      },
      "departs": {
        "date": { "precision": "absolute", "value": "2026-10-14" },
        "label": "2026-10-14"
      },
      "stay": [
        {
          "name": "Gion Guesthouse",
          "arrives": {
            "date": { "precision": "absolute", "value": "2026-10-12" },
            "label": "2026-10-12"
          },
          "departs": {
            "date": { "precision": "absolute", "value": "2026-10-14" },
            "label": "2026-10-14"
          }
        }
      ],
      "activities": [

        {
          "type": "ungrouped",
          "items": [
            {
              "name": "Nishiki Market",
              "priority": "must",
              "time": {
                "time": { "precision": "loose", "value": "morning", "estimate": "09:00" },
                "anchor": { "date": "2026-10-12", "precedence": "place" },
                "label": "morning"
              }
            }
          ]
        },

        {
          "type": "group",
          "kind": "day",
          "title": "Temple day",
          "time": {
            "date": { "precision": "relative", "value": "next day" },
            "anchor": { "date": "2026-10-12", "precedence": "place" },
            "label": "next day"
          },
          "items": [
            {
              "name": "Fushimi Inari",
              "time": {
                "time": { "precision": "exact", "value": "08:00" },
                "anchor": { "date": "2026-10-12", "precedence": "explicit" },
                "label": "8am"
              },
              "duration": { "type": "exact", "value": 2, "unit": "hours", "label": "2h" }
            },
            {
              "name": "Kinkaku-ji",
              "time": {
                "time": { "precision": "exact", "value": "11:00" },
                "anchor": { "date": "2026-10-12", "precedence": "explicit" },
                "label": "11am"
              },
              "duration": { "type": "exact", "value": 1, "unit": "hours", "label": "1h" }
            }
          ]
        },

        {
          "type": "group",
          "kind": "day",
          "title": "Arashiyama",
          "time": {
            "date": { "precision": "relative", "value": "next day" },
            "anchor": { "date": "2026-10-13", "precedence": "explicit" },
            "label": "next day"
          },
          "items": [
            {
              "name": "Bamboo Grove",
              "time": {
                "time": { "precision": "loose", "value": "morning", "estimate": "09:00" },
                "anchor": { "date": "2026-10-13", "precedence": "explicit" },
                "label": "morning"
              }
            },
            {
              "name": "Tenryu-ji",
              "priority": "must",
              "time": {
                "time": { "precision": "loose", "value": "afternoon", "estimate": "14:30" },
                "anchor": { "date": "2026-10-13", "precedence": "explicit" },
                "label": "afternoon"
              }
            }
          ]
        }

      ]
    },

    {
      "type": "transport",
      "mode": "train",
      "from": { "label": "Kyoto" },
      "to": { "label": "Osaka" },
      "departs": {
        "date": { "precision": "absolute", "value": "2026-10-14" },
        "time": { "precision": "exact", "value": "10:00" },
        "label": "2026-10-14T10:00"
      }
    },

    {
      "type": "place",
      "name": "Osaka",
      "arrives": {
        "date": { "precision": "absolute", "value": "2026-10-14" },
        "label": "2026-10-14"
      },
      "duration": { "type": "exact", "value": 2, "unit": "nights", "label": "2 nights" },
      "activities": []
    }

  ]
}
```

### Key transformations to verify

| What to check | Expected result |
|---|---|
| `Nishiki Market` wrapping | Inside `UngroupedActivities`, first in `Kyoto.activities` |
| Train `from` | `{ "label": "Kyoto" }` — inferred from preceding place |
| Train `to` | `{ "label": "Osaka" }` — inferred from following place |
| `Temple day` group `time.anchor.date` | `"2026-10-12"` — first `next day` resolves to arrival |
| `Arashiyama` group `time.anchor.date` | `"2026-10-13"` — second `next day` chains from previous |
| `Fushimi Inari` time anchor | `"2026-10-12"` — inherited from group |
| `Bamboo Grove` time anchor | `"2026-10-13"` — inherited from group |
| `Osaka.activities` | `[]` — empty array, never absent |

---

## Raw Data Model

The raw data model is the output of Pass 1. It mirrors the source structure exactly — all field values are preserved as raw strings. No interpretation has been applied. Pass 2 takes this as input and resolves field types. Pass 3 takes the resolved tree and produces the final `CrumbDocument`.

```typescript
// ─── Raw type aliases ─────────────────────────────────────────────────────────
//
// Raw field values are unresolved strings, exactly as authored.
// Pass 2 transforms these into their resolved counterparts.

type RawMoment   = string
type RawDuration = string  // shorthand, plain English, named span, or modified form

// ─── RawGeolocation ──────────────────────────────────────────────────────────
//
// Mirrors the two authoring forms: plain string or block with named fields.
// lat/lng are numbers because YAML parses them as numbers natively.
// The special string "none" opts out of geocoding — preserved as-is for Pass 2.

type RawGeolocation =
  | string                                                  // includes "none"
  | { name?: string; address?: string; lat?: number; lng?: number }

// ─── RawActivity ─────────────────────────────────────────────────────────────
//
// type: "activity" is a Pass 1 discriminator. It does not appear on the
// final Activity interface — it exists only to distinguish RawActivity
// from RawActivityGroup in the RawActivityItem union.
//
// priority is a raw string here. Pass 2 narrows it to Priority or omits it.

interface RawActivity {
  type:      "activity"
  name:      string
  priority?: string
  tags?:     string[]
  time?:     RawMoment
  duration?: RawDuration
  location?: RawGeolocation
  info?:     MetadataItem[]
  note?:     string
}

// ─── RawActivityGroup ────────────────────────────────────────────────────────
//
// kind is already typed as GroupKind — classification happens in Pass 1.
// activities contains the items list, already classified by Pass 1.

interface RawActivityGroup {
  type:   "group"
  kind:   GroupKind
  title?: string
  time?:  RawMoment
  duration?: RawDuration
  items:  RawActivity[]
}

type RawActivityItem = RawActivity | RawActivityGroup

// ─── RawStay ─────────────────────────────────────────────────────────────────

interface RawStay {
  name:      string
  arrives?:  RawMoment
  departs?:  RawMoment
  duration?: RawDuration
  location?: RawGeolocation
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}

// ─── RawPlace ────────────────────────────────────────────────────────────────
//
// activities is a flat list of RawActivity and RawActivityGroup items in
// source order. UngroupedActivities does not exist at this stage —
// it is assembled in Pass 3 step 3.1 from the standalone RawActivity items.

interface RawPlace {
  type:       "place"
  name:       string
  arrives?:   RawMoment
  departs?:   RawMoment
  duration?:  RawDuration
  timezone?:  string          // IANA timezone name, stored as-is — not validated by the parser
  location?:  RawGeolocation
  tags?:      string[]
  stay?:      RawStay[]
  activities: RawActivityItem[]
  info?:      MetadataItem[]
  note?:      string
}

// ─── RawTransportLeg ─────────────────────────────────────────────────────────
//
// from/to are raw at this stage — endpoint inference happens in Pass 3 step 3.2.

interface RawTransportLeg {
  type:      "transport"
  mode:      TransportMode
  from?:     RawGeolocation
  to?:       RawGeolocation
  departs?:  RawMoment
  arrives?:  RawMoment
  duration?: RawDuration
  info?:     MetadataItem[]
  note?:     string
}

type RawItineraryItem = RawPlace | RawTransportLeg

// ─── RawCrumbDocument ────────────────────────────────────────────────────────
//
// TripMeta is reused unchanged — it contains no fields that require resolution.
// itinerary is always an array; empty if no itinerary key is present in source.

interface RawCrumbDocument {
  trip?:     TripMeta
  itinerary: RawItineraryItem[]
}
```
