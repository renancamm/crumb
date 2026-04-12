# Crumb Specification

> *Leave a trail.*

An open format for travel itineraries. Plan trips in plain text. Share the pieces.

---

## Introduction

Crumb is a human-writable format for describing travel itineraries. It is designed to be readable without any tools, editable in any text editor, and structured enough that tools can display it as a map, a timeline, or a day-by-day planner.

The core idea is **progressive detail**. You can write as little or as much as you know. A list of city names is a valid crumb. So is a fully timed, day-by-day schedule with bookings and coordinates. Both live in the same format — you just add fields as your plans become more concrete.

A crumb can represent a full trip, a single city, a favourite weekend route, or just a handful of restaurant picks. Crumbs are designed to be shared, remixed, and assembled into something new — the way a recipe is adapted each time someone makes it their own.

Crumb files use the `.crumb` extension and are valid YAML documents.

---

## A Quick Look

Here are two examples that show the range of what Crumb looks like in practice.

### The simplest possible crumb

Just a list of places, in order.

```yaml
itinerary:
  - Tokyo
  - Kyoto
  - Osaka
  - Hiroshima
```

### A more detailed crumb

The same trip, progressively enriched — each place and transport leg adds a little more detail than the last.

```yaml
trip:
  name: Japan in 2 Weeks
  author: Ana Yamamoto
  tags: [asia, food, temples, city]
  note: A two-week circuit through Japan's most iconic cities. Best visited in autumn.

itinerary:

  - Tokyo:
      duration: 5 nights

  - train

  - Kyoto:
      duration: 3 nights
      activities:
        - Fushimi Inari
        - Nishiki Market:
            priority: must
        - Arashiyama Bamboo Grove:
            priority: maybe

  - train:
      duration: 15m

  - Osaka:
      duration: 2 nights
      stay:
        - Namba Hotel:
            arrives: 3pm
            departs: morning
      activities:
        - Dotonbori:
            priority: must
            tags: [landmark, food, nightlife]
        - Osaka Castle:
            priority: must
            tags: [landmark, history]
        - Shinsekai:
            priority: maybe
            tags: [landmark, food]

  - train:
      to: Hiroshima
      departs: 2026-09-15T09:00

  - Hiroshima:
      arrives: 2026-09-15
      departs: 2026-09-18
      duration: 3 nights
      stay:
        - Hiroshima Garden Hotel:
            arrives: 2026-09-15
            departs: 2026-09-18
            info:
              - website: https://www.example.com
              - reference: HGH-220
            note: Ask for a room facing the garden.
      activities:
        - Peace Memorial Park:
            priority: must
            tags: [landmark, history]
            location: Peace Memorial Park, Hiroshima
            note: Allow a **full morning**. The museum is deeply moving.
        - Miyajima Island:
            priority: must
            tags: [nature, landmark]
            note: Time your visit around low tide to walk up to the torii gate.

        - day:
            - Mitaki-dera Temple
            - Hiroshima Museum of Art

        - day:
            - Itsukushima Shrine
            - Mt. Misen

        - day:
            - Hiroshima Prefectural Art Museum
            - Mazda Museum

        - day:
            title: Peace and history
            time: 2026-09-18
            items:
              - Peace Memorial Museum:
                  time: 9am
                  duration: 2h
                  note: Book tickets in advance.
              - Atomic Bomb Dome:
                  time: 11am
                  duration: 1h
                  location:
                    name: Genbaku Dome
                    lat: 34.3955
                    lng: 132.4530
              - Okonomi-mura:
                  time: midday
                  duration: 1h
                  note: Try the **Hiroshima-style** okonomiyaki — layered, not mixed.
              - Hiroshima Castle:
                  time: 2pm
                  duration: 1h30m
              - Shukkeien Garden:
                  time: late afternoon
                  duration: 1h
                  note: A quiet end to the trip.

  - train:
      from: Hiroshima
      to: Tokyo
      departs: 2026-09-18T17:00+09:00
      arrives: 2026-09-18T19:30+09:00

  - flight:
      from:
        name: Tokyo Haneda Airport
        address: 2-6-5 Hanedakuko, Ota City, Tokyo
        lat: 35.5494
        lng: 139.7798
      to:
        name: London Heathrow Airport
        lat: 51.4700
        lng: -0.4543
      departs: 2026-09-18T23:00+09:00
      arrives: 2026-09-19T06:00+01:00
      info:
        - operator: JAL
        - reference: JL44-8821
        - gate: 114
        - terminal: International Terminal
```

---

## How the Format Works

Three rules shape everything in Crumb.

**1. The itinerary is a list of places and transport legs.**
Each place is a named key. All information about that place — accommodation, activities, and day plans — lives nested inside it. Transport legs connect places and sit between them in the list.

**2. Dates, times, and durations are flexible.**
Write `2026-09-15` or just `September`. Write `9am` or `afternoon`. Write `2h` or `at least half day`. Crumb understands a wide range, from exact timestamps to loose human expressions.

**3. Everything is optional.**
A bare place name is valid. An activity with just a name is valid. You add fields as your plans take shape.

> **Note:** Place names must be valid YAML strings. If a name could be read as something else by YAML — for example a number like `2026`, or the word `null` — wrap it in quotes: `- "2026"`, `- "null"`.

---

## Top-level Fields

A Crumb document has two top-level keys: `trip` and `itinerary`.

### `trip`

Optional metadata about the trip.

```yaml
trip:
  name: Japan in 2 Weeks
  author: Ana Yamamoto
  tags: [asia, food, city]
  note: A two-week circuit through Japan's most iconic cities.
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Title of the trip |
| `author` | string | Name or handle of the person who wrote this crumb |
| `tags` | list | Keywords describing the trip style and focus |
| `info` | MetadataList | Supplementary key-value details (e.g. booking platform, guide website, trip code) |
| `note` | Text | Free-text description of the trip |

### `itinerary`

An ordered list of places and transport legs. Order implies chronological sequence.

```yaml
itinerary:
  - Tokyo
  - train:
      to: Kyoto
  - Kyoto
```

---

## Itinerary: Places

A place is the primary building block of an itinerary. At its simplest, it is a bare string — just a name. Add a colon and indent fields underneath to describe it further.

```yaml
# Minimal
- Tokyo

# With fields
- Tokyo:
    duration: 5 nights
    tags: [city, food]
    note: Base yourself in Shinjuku.
```

A place can have accommodation, activities, and notes — or none of these.

```yaml
- Tokyo:
    arrives: 2026-09-10
    departs: 2026-09-15
    duration: 5 nights
    timezone: Asia/Tokyo
    location: Tokyo, Japan
    tags: [city, food, culture]
    stay:
      - Shinjuku Granbell Hotel:
            arrives: 2026-09-10
            departs: 2026-09-15
    activities:
      - Senso-ji Temple:
          priority: must
          tags: [temple, landmark]
    info:
      - guide: https://www.gotokyo.org
    note: Get a **Suica card** on arrival.
```

| Field | Type | Description |
|---|---|---|
| `arrives` | Moment | When you arrive at this place |
| `departs` | Moment | When you leave this place |
| `duration` | Duration | How long you are spending here |
| `timezone` | string | IANA timezone name for this place (e.g. `Asia/Tokyo`, `Europe/London`). Applies to all times within this place that don't carry an explicit UTC offset. |
| `location` | Geolocation | Geographic reference for this place |
| `tags` | list | Keywords for filtering and display |
| `stay` | list | Accommodation — see [Stay](#stay) |
| `activities` | list | Things to do — see [Activities](#activities) |
| `info` | MetadataList | Supplementary key-value details |
| `note` | Text | Free-text description or tips |

---

### Stay

The `stay` field holds a list of accommodation items for a place. Each item follows the same pattern — the key is the property name, and fields go underneath. Multiple stays are supported for when you leave and return to the same place, or switch hotels mid-visit.

```yaml
# Minimal
- Kyoto:
    stay:
      - Gion Hatanaka Ryokan

# With fields
- Kyoto:
    stay:
      - Gion Hatanaka Ryokan:
            arrives: 2026-09-15
            departs: 2026-09-18
            duration: 3 nights
            location: Nijo, Gion, Kyoto
            tags: [ryokan]
            info:
              - website: https://www.hatanaka.jp
              - reference: ABC123
            note: Traditional **kaiseki** dinner included.
```

| Field | Type | Description |
|---|---|---|
| `arrives` | Moment | Arrival date or time |
| `departs` | Moment | Departure date or time |
| `duration` | Duration | Length of stay |
| `location` | Geolocation | Property address or coordinates |
| `tags` | list | Keywords |
| `info` | MetadataList | Supplementary key-value details |
| `note` | Text | Free-text notes |

---

### Activities

The `activities` field holds a list of things to do at a place. Three kinds of items can be mixed freely in any order:

- **A bare activity** — just a name, nothing else
- **A detailed activity** — a name with any combination of fields
- **An activity group** — `day`, `week`, or `plan`, used to group activities

```yaml
- Kyoto:
    activities:
      - Fushimi Inari                 # bare

      - Nishiki Market:               # detailed
          priority: must
          tags: [market, food]

      - day:                          # day group — shorthand list
          - Kinkaku-ji
          - Ryoan-ji

      - day:                          # day group — with title and time
          title: Temple hopping
          time: 2026-09-16
          items:
            - Kinkaku-ji:
                time: 9am
            - Ryoan-ji:
                time: 11am

      - Arashiyama Bamboo Grove:      # back to detailed, outside any group
          priority: maybe
```

A bare activity has no fields and no priority. A detailed activity uses the activity name as the key, with all fields optional.

```yaml
- Senso-ji Temple:
    priority: must
    tags: [temple, landmark]
    time: 8am
    duration: 1h30m
    location: Asakusa, Tokyo
    info:
      - tripadvisor: https://www.tripadvisor.com/example
    note: |
      Arrive before **8am** to avoid crowds.
      The side streets around the temple are worth exploring too.
```

| Field | Type | Description |
|---|---|---|
| `priority` | enum | How important this activity is: `must`, `maybe` |
| `tags` | list | Activity type and practical keywords |
| `time` | Moment | When to go |
| `duration` | Duration | How long it takes |
| `location` | Geolocation | If different from the parent place |
| `info` | MetadataList | Supplementary key-value details |
| `note` | Text | Free-text tips or description |

---

### Activity groups

Activity groups collect activities into named units — useful for day-by-day planning. Three keywords are available, each implying a different time unit. Activity groups cannot be nested.

`day`, `week`, `plan`

Use `plan` when the group doesn't fit a specific time unit — for themed groups, alternatives, or ideas. A `plan` group is **not scheduled**: it does not participate in date sequencing, and activities inside it do not get resolved dates even if they have a `time` field. `plan` groups are display-only containers.

Each keyword accepts two forms. The shorthand form takes a list of activities directly. The detailed form takes a group with optional `title`, `time`, `duration`, and `items`.

```yaml
# Shorthand — a list of activities
- day:
    - Fushimi Inari
    - Kinkaku-ji

# Detailed — with title and time
- day:
    title: Temple hopping
    time: 2026-09-16
    items:
      - Fushimi Inari:
          time: 8am
      - Kinkaku-ji:
          time: 11am

# Week group
- week:
    title: First week in Tokyo
    items:
      - Senso-ji Temple
      - teamLab Planets
      - Shibuya Crossing

# Plan group — for thematic groups or ideas
- plan:
    title: Rainy day alternatives
    items:
      - teamLab Planets
      - Mori Art Museum
      - Shibuya shopping

- plan:
    title: Weekend in Nikko
    items:
      - Tosho-gu Shrine
      - Kegon Falls
```

When a `day` or `week` group has no explicit `time`, it automatically continues from the previous one — each group starts the day or week after the previous one, beginning from the place's arrival date. An explicit `time` on any group resets the sequence from that point. `plan` groups are never part of this sequence.

| Field | Type | Description |
|---|---|---|
| `title` | string | Optional title |
| `time` | Moment | When this group takes place. Defaults to `next day` for `day` groups and `next week` for `week` groups when omitted. |
| `duration` | Duration | How long this group spans. Optional on all group types. |
| `items` | list | Bare or detailed activities. No nested activity groups. |

---

## Itinerary: Transport

A transport leg connects two places. Use the mode of transport as the key — or as a bare string when no fields are needed. The surrounding places in the list determine the departure and arrival points — you only need to be explicit when the actual point differs from the place name, such as a specific airport.

```yaml
# Bare string — no fields needed
- train

# With fields
- train:
    to: Kyoto

# With full detail
- flight:
    from: Tokyo Haneda
    to: Osaka Kansai
    departs: 2026-09-12T07:30+09:00
    arrives: 2026-09-12T08:45+09:00
    info:
      - operator: ANA
      - reference: NH425
    note: Check in at least **2 hours** before departure.
```

The available transport modes are:

`train`, `flight`, `bus`, `car`, `ferry`, `walk`, `bike`, `transport`

Use `transport` when the mode doesn't fit any of the above.

| Field | Type | Description |
|---|---|---|
| `from` | Geolocation | Departure point. Inferred from previous place when omitted. |
| `to` | Geolocation | Arrival point. Inferred from next place when omitted. |
| `departs` | Moment | Departure time |
| `arrives` | Moment | Arrival time |
| `duration` | Duration | Journey time |
| `info` | MetadataList | Supplementary key-value details |
| `note` | Text | Free-text notes |

---

## Field Types

Crumb uses a small set of named types, referenced consistently in every field table throughout this document.

### Primitive types

| Type | Description | Example |
|---|---|---|
| `string` | Plain text | `name: Tokyo` |
| `number` | Decimal number | `lat: 34.9671` |
| `list` | YAML list of strings, flow or block syntax | `tags: [food, city]` |
| `enum` | String with a fixed set of valid values | `priority: must` |

### Special field types

These types have their own grammar, defined in the [Field Reference](#field-reference) section below.

| Type | Description |
|---|---|
| `Duration` | A duration string — `2h30m`, `3 nights`, `around 2 hours`. |
| `MetadataList` | A list of custom key-value pairs for supplementary details. |
| `Geolocation` | A place name, address, or a block with optional `name`, `address`, `lat`, `lng`. |
| `Text` | Free-text string supporting CommonMark markdown. Supports multiline content. |
| `Moment` | Any temporal expression — exact, relative, or a natural language label. |

---

## Field Reference

This section describes the grammar for each special field type.

---

### `Duration`

How long something takes or lasts. Accepts shorthand, plain English, named spans, and any of these with a modifier expressing uncertainty.

**Used on:** places, stays, activities, activity groups, transport legs.

---

#### Shorthand

Compact unit codes. Compound forms are accepted.

```yaml
duration: 30m
duration: 2h
duration: 2h30m
duration: 3d
duration: 2w
duration: 3n          # nights
```

**Units:** `h` (hours), `m` (minutes), `d` (days), `w` (weeks), `n` (nights)

---

#### Plain English

```yaml
duration: 30 minutes
duration: 2 hours
duration: 2 hours 30 minutes
duration: 3 days
duration: 2 weeks
duration: 3 nights
```

**Units:** `minute`, `minutes`, `hour`, `hours`, `day`, `days`, `night`, `nights`, `week`, `weeks`

---

#### Named spans

Fixed labels for durations that are better described by name than by quantity. Each has an approximate equivalent that tools can use for scheduling.

| Value | Estimate |
|---|---|
| `all day` | 10 hours |
| `half day` | 5 hours |
| `overnight` | 1 night |

```yaml
duration: all day
duration: half day
duration: overnight
```

---

#### Approximate

The author has a reasonable estimate but not a fixed value.

```yaml
# Numeric
duration: around 2h
duration: around 30 minutes
duration: around 3 nights

# Named span
duration: around all day
duration: around overnight
```

---

#### Minimum

A lower bound — the activity or stay takes at least this long.

```yaml
# Numeric
duration: at least 1h
duration: at least 3 nights
duration: at least 2 days

# Named span
duration: at least half day
duration: at least overnight
```

---

#### Range

A bounded estimate. Both `to` and `-` are accepted as separators and produce identical output.

```yaml
# Numeric with "to"
duration: 2 to 3 hours
duration: 1 to 2 weeks
duration: 2h to 3h

# Numeric with hyphen
duration: 2-3 hours
duration: 1-2 weeks
duration: 2h-3h

# Named span range
duration: half day to all day
```

---

### `MetadataList`

A list of custom key-value pairs for supplementary details. The key is a user-defined string label. The value is a string or number — numbers are common for travel metadata such as flight numbers, confirmation codes, and gate numbers.

```yaml
info:
  - website: https://www.kikunoi.jp
  - tripadvisor: https://www.tripadvisor.com/example
  - reservation: KIK-882
  - dress-code: Smart casual
```

**Used on:** places, stays, activities, transport legs.

---

### `Geolocation`

A geographic reference. Write it as a plain string or as a block with any combination of the fields below.

```yaml
# Plain string
location: Fushimi Inari, Kyoto

# Block
location:
  name: Fushimi Inari Taisha
  address: 68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto
  lat: 34.9671
  lng: 135.7727

# Opt out of geocoding
location: none
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Human-readable place name |
| `address` | string | Street address |
| `lat` | number | Latitude in decimal degrees |
| `lng` | number | Longitude in decimal degrees |

**`Geolocation` used on:** places, stays, activities.
**`from` and `to` on transport legs** follow the same grammar.

#### Geocoding and `location: none`

When a place, stay, or activity has no coordinates, a rendering tool may automatically look up coordinates by name using a geocoding service (such as Google Maps or OpenStreetMap). This is a **render-phase** concern — the parser does not perform geocoding. The parsed output always contains the authored text; the renderer decides whether to resolve it to coordinates.

To explicitly **opt out of geocoding** for a specific location, use the special value `location: none`. This signals to renderers that the place should not be geocoded — it will appear in lists and notes but will not be pinned on a map. Useful for unnamed waypoints, intentionally abstract places, or privacy.

```yaml
- Somewhere private:
    location: none
    duration: 2 nights
```

---

### `Text`

Free-text string supporting [CommonMark](https://commonmark.org) markdown. Use YAML's literal block scalar `|` for multiline content.

```yaml
# Single line
note: Go **early** to avoid crowds. See the [official site](https://www.example.com).

# Multiline
note: |
  Go **early** to avoid crowds.
  The upper shrine is less visited and worth the extra hike.
```

**Used on:** `trip`, places, stays, activities, transport legs.

---

### `Moment`

A temporal expression — from a precise machine datetime to a loose human label. Machine formats follow ISO 8601. Human formats are English, culturally neutral, and kept to a minimal vocabulary.

**Used on:** `time` on activities and activity groups, `arrives`/`departs` on places, stays, and transport legs.

---

#### Machine date

ISO 8601 date. Always resolves to an absolute date.

```yaml
arrives: 2026-09-15
```

#### Machine time

ISO 8601 24-hour time. Assumed local to the nearest place context.

```yaml
time: 09:15
time: 14:30
```

#### Machine datetime

ISO 8601 datetime. Without a UTC offset, local time is assumed.

```yaml
departs: 2026-09-15T09:15
departs: 2026-09-18T23:00+09:00
arrives: 2026-09-19T06:00+01:00
```

---

#### Human date — with year

Month-name formats. Both day-before-month and month-before-day are accepted. Abbreviations and ordinal suffixes (`st`, `nd`, `rd`, `th`) are accepted. Always resolves to an absolute date.

```yaml
arrives: September 15, 2026
arrives: 15 September 2026
arrives: Sep 15, 2026
arrives: 15th of September 2026
arrives: September 15th, 2026
```

#### Human date — without year

Same formats as above, without the year. Assumed to be the current or next upcoming occurrence of that date.

```yaml
arrives: September 15
arrives: 15 September
arrives: Sep 15
arrives: 15th of September
```

#### Human date — month and year

For itineraries where no specific day is known yet.

```yaml
arrives: September 2026
arrives: Sep 2026
```

#### Human date — month only

For early-stage planning when only the month is known.

```yaml
arrives: September
arrives: Sep
```

---

#### Human time

12-hour clock. Case-insensitive. Space between number and `am`/`pm` is optional.

```yaml
time: 9am
time: 3pm
time: 9:15am
time: 3:30pm
time: 9:00 AM
time: 11:30 PM
```

---

#### Named period

A fixed vocabulary of time-of-day labels.

| Value | Approximate span |
|---|---|
| `early morning` | 5am – 8am |
| `morning` | 8am – noon |
| `midday` | 11am – 1pm |
| `afternoon` | noon – 5pm |
| `late afternoon` | 4pm – 7pm |
| `evening` | 6pm – 10pm |
| `night` | 9pm – midnight |
| `late night` | midnight – 5am |
| `midnight` | around midnight |

```yaml
time: early morning
time: morning
time: midday
time: afternoon
time: late afternoon
time: evening
time: night
time: late night
time: midnight
```

---

#### Relative

Position within a place stay, relative to the place's arrival date. When no arrival date is set, these values are used as-is for display.

```yaml
# Ordinal day — two equivalent forms. Day 1 / 1st day = arrives date.
time: Day 1
time: 1st day
time: Day 3
time: 3rd day

# Ordinal week — two equivalent forms. Week 1 / 1st week = arrives date.
time: Week 1
time: 1st week
time: Week 2
time: 2nd week

# Named anchors
time: first day     # same as Day 1
time: last day      # final day of place stay

# Weekday — next occurrence on or after arrives date, inclusive
time: Monday
time: Friday
time: Saturday

# Sequence stepper — for day and week groups
time: next day      # the next day in this place, starting from arrival
time: next week     # the next week in this place, starting from arrival
```

`next day` and `next week` are the natural way to sequence day and week groups. Each group starts the day or week after the previous one. You rarely need to write them — they are the default when no `time` is given on a `day` or `week` group.

---

#### Combinations

Any date form and any time or named period can be combined using `at`. A weekday followed directly by a named period does not require `at`.

```yaml
# Machine date + human time
time: 2026-09-15 at 9am

# Machine date + named period
time: 2026-09-15 at morning

# Human date + human time
time: September 15 at 9am
time: 15th of September at 3pm

# Human date + named period
time: September 15 at morning
time: September 15, 2026 at late afternoon

# Weekday + human time
time: Monday at 9am
time: Friday at 3pm

# Weekday + named period — no "at" needed
time: Monday morning
time: Friday evening
time: Saturday night
```

---

## Parser Reference

This section is for tool builders. It defines the complete parsing pipeline for a Crumb document — from raw YAML to a fully resolved `CrumbDocument` value.

Parsing runs in three passes. **Pass 1** reads the raw YAML and classifies every node into a typed tree without interpreting any field values. **Pass 2** resolves each field value into its output type. **Pass 3** fills in everything implied by the structure — inferred dates, assembled groups, and resolved contradictions. Each pass takes the output of the previous one as its input.

Parsers are forgiving throughout. Invalid or unrecognised values are stored as-is rather than causing errors. The only hard failure is a YAML parse error at the document level — everything else degrades gracefully.

---

### Pass 1 — Structure

*Input: raw YAML. Output: `RawCrumbDocument`.*

#### 1.1 Document validation

- A valid Crumb document is a YAML file whose root is a mapping.
- The root mapping must contain at least one of the keys `trip` or `itinerary`.
- If neither key is present, the document is invalid and parsing stops.
- If YAML parsing fails entirely, parsing stops.
- An `itinerary` value that is an empty list is valid.
- Unknown root-level keys are ignored.

#### 1.2 Itinerary items

Each item in `itinerary` is either a bare string or a single-key mapping. Classify as follows:

- A bare string whose value exactly matches a transport keyword in lowercase → `RawTransportLeg` with no fields.
- A single-key mapping whose key exactly matches a transport keyword in lowercase → `RawTransportLeg` with fields from the mapping value.
- Any other bare string → `RawPlace` with that string as `name` and no fields.
- Any other single-key mapping → `RawPlace` with the key as `name` and fields from the mapping value.
- Items that are not a string or single-key mapping are ignored.

Transport keywords (case-sensitive, lowercase only): `train`, `flight`, `bus`, `car`, `ferry`, `walk`, `bike`, `transport`. A capitalised form such as `Train` is a place name, not a transport leg.

**YAML string note:** Place names must be valid YAML strings. YAML parses bare values such as `null`, `true`, `false`, `yes`, `no`, `on`, `off`, and plain numbers as non-string scalars — these will not be classified as places. Quote them when needed: `- "null"`, `- "2026"`. Items that fail to parse as a string or single-key mapping are silently ignored.

#### 1.3 Place fields

Recognised fields on a `RawPlace` node: `arrives`, `departs`, `duration`, `timezone`, `location`, `tags`, `stay`, `activities`, `info`, `note`. All other keys are ignored.

- `timezone` must be a string. A non-string value is ignored and `timezone` is treated as absent. No validation of the timezone name is performed by the parser — it is stored as-is and passed to consumers.

- `stay` must be a YAML list. A non-list value is ignored and `stay` is treated as absent.
- `activities` must be a YAML list. A non-list value is ignored and `activities` is treated as absent.
- `tags` and `info` must be YAML lists. Non-list values are stored as-is and resolved in Pass 2.

#### 1.4 Transport fields

Recognised fields on a `RawTransportLeg` node: `from`, `to`, `departs`, `arrives`, `duration`, `info`, `note`. All other keys are ignored.

#### 1.5 Activity items

Each item in `activities` is either a bare string or a single-key mapping. Classify as follows:

- A bare string → `RawActivity` with that string as `name` and no other fields.
- A single-key mapping whose key exactly matches an activity group keyword → `RawActivityGroup` with that keyword as `kind`.
- A single-key mapping whose key does not match an activity group keyword → `RawActivity` with the key as `name` and fields from the mapping value.
- If the value of a detailed activity mapping is not itself a mapping, treat it as a bare `RawActivity` with just the name.
- Items that are not a string or single-key mapping are ignored.

Activity group keywords (case-sensitive, lowercase only): `day`, `week`, `plan`.

#### 1.6 Activity group fields

A `RawActivityGroup` node is produced in one of two forms:

**Shorthand form** — the mapping value is a YAML list.
- Treat the list directly as `items`. Each item is classified as an activity item per 1.5, except that nested `RawActivityGroup` items are ignored.

**Detailed form** — the mapping value is a YAML mapping.
- Recognised fields: `title`, `time`, `duration`, `items`.
- `items` must be a YAML list. A non-list value is ignored and `items` is treated as an empty list.
- Each item in `items` is classified as an activity item per 1.5, except that nested `RawActivityGroup` items are ignored.
- All other keys are ignored.

If the mapping value is neither a list nor a mapping, the group has no items and no fields.

#### 1.7 Stay items

Each item in `stay` is either a bare string or a single-key mapping. Classify as follows:

- A bare string → `RawStay` with that string as `name` and no other fields.
- A single-key mapping → `RawStay` with the key as `name` and fields from the mapping value.
- Items that are not a string or single-key mapping are ignored.

Recognised fields on a `RawStay` node: `arrives`, `departs`, `duration`, `location`, `tags`, `info`, `note`. All other keys are ignored.

---

### Pass 2 — Field resolution

*Input: `RawCrumbDocument`. Output: resolved node tree — same structure as `RawCrumbDocument` but with all `RawMoment`, `RawDuration`, and `RawGeolocation` fields replaced by their resolved counterparts. `priority` is narrowed to `Priority` or omitted. `tags` is validated to `string[]` or absent. `info` is validated to `MetadataItem[]`. `note` is validated to `string` or absent.*

Every field value is resolved independently. Resolution never inspects neighbouring nodes — that is the job of Pass 3. The original string is always preserved in `label` on `ResolvedMoment` and in `label` on `ResolvedDuration`, regardless of whether resolution succeeds.

#### 2.1 `Moment` → `ResolvedMoment`

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

#### 2.2 `Duration` → `ResolvedDuration`

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

#### 2.3 `Geolocation` → `ResolvedGeolocation`

- The plain string `"none"` → `{ label: "none", geocodingDisabled: true }`. Signals to renderers that this location should not be geocoded.
- Any other plain string value → `{ label: <original string> }`. No other fields set.
- A mapping value must contain at least one of `name`, `address`, `lat`, or `lng`. An empty mapping is ignored and `location` treated as absent.
- `lat` and `lng` are only valid as a pair. If one is present without the other, both are discarded.
- `lat` must be between −90 and 90 inclusive. `lng` must be between −180 and 180 inclusive. Out-of-range values cause the coordinate pair to be discarded.
- `label` is derived in order of preference: `name` → `address` → `"lat,lng"` string.

`from` and `to` on `RawTransportLeg` nodes follow the same resolution rules.

#### 2.4 `priority` → `Priority`

- `"must"` → `Priority.must`
- `"maybe"` → `Priority.maybe`
- Any other value, or absent → field omitted from output.

#### 2.5 `MetadataList` → `MetadataItem[]`

Each item in the `info` list must be a single-key mapping where the key is a non-empty string and the value is a string or number.

- The key must be a non-empty string.
- The value must be a string or number. Values of any other type are ignored.
- Items that do not meet these requirements are ignored.
- Valid items are emitted as `{ key: string, value: string | number }`.

#### 2.6 `tags` → `string[]`

- `tags` must be a YAML list. A non-list value is ignored and `tags` is treated as absent.
- Each item must be a string. Non-string items are ignored.
- If all items are invalid, `tags` is treated as absent.

#### 2.7 `note` → `string`

- `note` must be a string. A non-string value is ignored and `note` is treated as absent.
- The value is stored as-is with no transformation. CommonMark markdown within the string is not parsed — that is a renderer concern.

---

### Pass 3 — Inference

*Input: resolved node tree. Output: `CrumbDocument`.*

Pass 3 runs five steps in order. Each step may produce information that a later step depends on.

#### 3.1 `UngroupedActivities` assembly

For each resolved Place in the itinerary:
- Collect all resolved Activity nodes that appear directly in `activities` and are not inside any resolved ActivityGroup.
- If at least one exists, wrap them in an `UngroupedActivities` node, preserving source order.
- Insert `UngroupedActivities` as the first item in `Place.activities`.
- Append all resolved ActivityGroup nodes from `activities`, in source order, as `ActivityGroup` nodes in `Place.activities`.
- If no standalone activities exist, `UngroupedActivities` is not emitted and `Place.activities` begins with the first `ActivityGroup` in source order.

#### 3.2 Transport endpoint inference

For each `TransportLeg` in the itinerary:

- If `from` is absent, scan backward through the itinerary for the nearest preceding `Place`. If found, set `from` to `{ label: place.name }`.
- If `to` is absent, scan forward through the itinerary for the nearest following `Place`. If found, set `to` to `{ label: place.name }`.
- If no preceding or following `Place` exists, the field remains absent.
- An explicitly authored `from` or `to` is never overwritten.

#### 3.3 Group time injection

For each `Place`, walk its `activities` array and inject a default `time` value on any `day` or `week` group that has no explicit `time` field.

- A `day` group with no `time` → set `time` to `{ date: { precision: "relative", value: "next day" }, label: "next day" }`.
- A `week` group with no `time` → set `time` to `{ date: { precision: "relative", value: "next week" }, label: "next week" }`.
- Groups that already have a `time` field are never overwritten.

`plan` groups and `UngroupedActivities` are not affected.

After this step, every `day` and `week` group in the document is guaranteed to have a `time` field.

#### 3.4 Anchor propagation

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

#### 3.5 Relative date resolution

This step walks every `ResolvedMoment` in the document that has a `date.precision` of `"relative"` and attempts to resolve it to a calendar date, stored in `anchor.date`. The `DateRef` itself is never modified — the resolved date is always placed on the `anchor`.

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

#### 3.6 Contradiction resolution

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

---

## Output Data Model

The output data model is the contract between the parser and any tool that consumes a Crumb document. A fully parsed document is a `CrumbDocument` value. All ambiguity and contradiction in the source is resolved before this point — consuming tools never need to infer, cascade, or handle missing data.

The model is defined as TypeScript interfaces. A JSON Schema companion is available separately for validation tooling.

```typescript
// ─── Primitives ──────────────────────────────────────────────────────────────

type TransportMode =
  | "train" | "flight" | "bus" | "car"
  | "ferry" | "walk"  | "bike" | "transport"

type GroupKind = "day" | "week" | "plan"

type Priority = "must" | "maybe"

type DurationUnit = "minutes" | "hours" | "days" | "nights" | "weeks"

// ─── Anchor ──────────────────────────────────────────────────────────────────
//
// A parser-inferred date context attached to a ResolvedMoment.
// Never authored — discard to round-trip back to source.
//
// Set whenever a date can be inferred from context — not only when
// date.precision is "relative", but also when date is absent entirely
// (e.g. a time-only value like "morning" inside a resolved day group).
// The only case that never carries an anchor is date.precision "absolute".
//
// date:   YYYY-MM-DD — set when a calendar date can be resolved.
// offset: 1-based ordinal day from the start of the itinerary — set in
//         relative-only itineraries where no calendar date is available.
//         At least one of date or offset is always present.
//
// precedence records which source provided the anchor. Higher-precedence
// anchors always win in a conflict:
//   "transit"  — transport leg departs/arrives             (highest)
//   "place"    — place arrives/departs
//   "stay"     — stay arrives/departs
//   "explicit" — activity group with authored or injected date
//   "inferred" — duration arithmetic                       (lowest)

interface Anchor {
  date?:       string                             // YYYY-MM-DD
  offset?:     number                             // 1-based day ordinal from itinerary start
  precedence:  "transit" | "place" | "stay" | "explicit" | "inferred"
}

// ─── LoosePeriod ─────────────────────────────────────────────────────────────
//
// Canonical named period values. No synonyms are accepted — input must
// exactly match one of these values.
//
// estimate is an HH:MM string used for chronological sorting. Loose and
// exact times share the same coordinate space — compare estimate against
// an exact HH:MM value to order them on the same day.
// All estimates are on the same anchor date — no day-crossing is applied.

type LoosePeriod =
  | "early morning"   // estimate 06:00
  | "morning"         // estimate 09:00
  | "midday"          // estimate 12:00
  | "afternoon"       // estimate 14:30
  | "late afternoon"  // estimate 17:00
  | "evening"         // estimate 19:30
  | "night"           // estimate 22:00
  | "late night"      // estimate 02:00
  | "midnight"        // estimate 23:59

// ─── TimeOfDay ───────────────────────────────────────────────────────────────
//
// exact:  normalised 24h clock time. Any authored format (9am, 9:00 AM,
//         09:00) normalises to "HH:MM". Use value directly for sorting.
//
// loose:  a canonical LoosePeriod with a parser-assigned estimate for
//         sorting. The original label is preserved in ResolvedMoment.label.

type TimeOfDay =
  | { precision: "exact"; value: string }
  | { precision: "loose"; value: LoosePeriod; estimate: string }

// ─── DateRef ─────────────────────────────────────────────────────────────────
//
// absolute: a resolved calendar date. Always "YYYY-MM-DD".
//
// relative: the authored value preserved exactly — "Day 1", "1st day",
//           "first day", "last day", "next day", "next week", "Monday",
//           "Week 2", "September 15" (year-less), "September 2026"
//           (month+year), "September" (month-only), etc.
//           Never collapsed into an absolute date. An Anchor may accompany
//           a relative DateRef on ResolvedMoment when a date can be inferred.

type DateRef =
  | { precision: "absolute"; value: string }
  | { precision: "relative"; value: string }

// ─── ResolvedMoment ──────────────────────────────────────────────────────────
//
// date and time are independent and both optional. Any combination is valid:
//
//   date only             "2026-09-15"              → { date: absolute }
//   human date with year  "September 15, 2026"      → { date: absolute }
//   human date no year    "September 15"            → { date: relative }
//   month and year        "September 2026"          → { date: relative }
//   month only            "September"               → { date: relative }
//   time only             "9am"                     → { time: exact "09:00" }
//   loose time only       "morning"                 → { time: loose "morning" }
//   date + exact time     "2026-09-15T09:00"        → { date: absolute, time: exact }
//   human date + time     "September 15 at 9am"     → { date: absolute, time: exact }
//   date + loose time     "Monday morning"          → { date: relative, time: loose }
//   relative only         "Day 1"                   → { date: relative }
//
// anchor: set whenever a date can be inferred from context. Present when
//         date.precision is "relative" OR when date is absent entirely.
//         Never present when date.precision is "absolute".
//         Parser-inferred — never authored. Discard to round-trip back to source.
//
// label: the original input string, always preserved. Sufficient on its own
//        to reconstruct the crumb. Use for display or round-tripping.

interface ResolvedMoment {
  date?:   DateRef
  time?:   TimeOfDay
  anchor?: Anchor
  label:   string
}

// ─── NamedSpan ───────────────────────────────────────────────────────────────

type NamedSpan = "all day" | "half day" | "overnight"

// ─── DurationEstimate ────────────────────────────────────────────────────────
//
// Parser-assigned numeric estimate for a named span.
// Used internally for anchoring, ordering, and timeline estimation.
// Never displayed to the user.
//
//   "all day"  → { value: 10, unit: "hours" }
//   "half day" → { value: 5,  unit: "hours" }
//   "overnight"→ { value: 1,  unit: "nights" }

interface DurationEstimate {
  value: number
  unit:  DurationUnit
}

// ─── ResolvedDuration ────────────────────────────────────────────────────────
//
// Discriminated union. "unknown" is the fallback for unrecognised strings —
// label is always preserved so a renderer can still display the original.

type ResolvedDuration =
  | { type: "exact";            value: number;  unit: DurationUnit; label: string }
  | { type: "approximate";      value: number;  unit: DurationUnit; label: string }
  | { type: "minimum";          value: number;  unit: DurationUnit; label: string }
  | { type: "range";            min: number; max: number; unit: DurationUnit; label: string }
  | { type: "named";            span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-approximate"; span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-minimum";    span: NamedSpan; estimate: DurationEstimate; label: string }
  | { type: "named-range";      min: NamedSpan; max: NamedSpan; minEstimate: DurationEstimate; maxEstimate: DurationEstimate; label: string }
  | { type: "unknown";          label: string }

// ─── ResolvedGeolocation ─────────────────────────────────────────────────────
//
// label:              safe display string in all cases. Set to the original plain
//                     string when written in string form; otherwise name ?? address ?? coords.
//
// geocodingDisabled:  true when the author wrote `location: none`. Renderers must
//                     not attempt to geocode this location. Absent otherwise.
//
// lat/lng:            always present as a pair or not at all.

interface ResolvedGeolocation {
  label:               string
  geocodingDisabled?:  true
  name?:               string
  address?:            string
  lat?:                number
  lng?:                number
}

// ─── MetadataItem ────────────────────────────────────────────────────────────

interface MetadataItem {
  key:   string
  value: string | number
}

// ─── Activity ────────────────────────────────────────────────────────────────
//
// type:     "activity" — discriminator consistent with all other output types.
// priority: only present when explicitly set by the author.

interface Activity {
  type:      "activity"
  name:      string
  priority?: Priority
  tags?:     string[]
  time?:     ResolvedMoment
  duration?: ResolvedDuration
  location?: ResolvedGeolocation
  info?:     MetadataItem[]
  note?:     string
}

// ─── UngroupedActivities ─────────────────────────────────────────────────────
//
// Wraps all standalone activities for a place into a single container.
// Only emitted when at least one standalone activity exists.
// Always the first item in Place.activities when present.

interface UngroupedActivities {
  type:  "ungrouped"
  items: Activity[]
}

// ─── ActivityGroup ───────────────────────────────────────────────────────────
//
// kind "day":  default time "next day" injected by Pass 3 step 3.3 when
//              no time is authored. duration present only when explicitly
//              authored.
// kind "week": default time "next week" injected by Pass 3 step 3.3 when
//              no time is authored. duration present only when explicitly
//              authored.
// kind "plan": not affected by time injection. Does not participate in
//              next day/next week sequencing.
//              duration present only when explicitly authored.

interface ActivityGroup {
  type:       "group"
  kind:       GroupKind
  title?:     string
  time?:      ResolvedMoment
  duration?:  ResolvedDuration
  items:      Activity[]
}

type ActivityItem = UngroupedActivities | ActivityGroup

// ─── Stay ────────────────────────────────────────────────────────────────────

interface Stay {
  name:      string
  arrives?:  ResolvedMoment
  departs?:  ResolvedMoment
  duration?: ResolvedDuration
  location?: ResolvedGeolocation
  tags?:     string[]
  info?:     MetadataItem[]
  note?:     string
}

// ─── Place ───────────────────────────────────────────────────────────────────
//
// activities: always an array, possibly empty. UngroupedActivities, if present,
//             is always first. Remaining groups follow in source order.
//
// When arrives/departs and duration are both present, arrives/departs
//   take precedence. duration is only used when no explicit dates exist.
//
// When a stay also carries arrives/departs, the place dates define the
//   overall visit window and the stay dates define the accommodation window.

interface Place {
  type:       "place"
  name:       string
  arrives?:   ResolvedMoment
  departs?:   ResolvedMoment
  duration?:  ResolvedDuration
  timezone?:  string          // IANA timezone name. Applies to times within this place lacking an explicit UTC offset.
  location?:  ResolvedGeolocation
  tags?:      string[]
  stay?:      Stay[]
  activities: ActivityItem[]
  info?:      MetadataItem[]
  note?:      string
}

// ─── TransportLeg ────────────────────────────────────────────────────────────
//
// from/to: inferred from neighbouring places in the itinerary when omitted.
//          Absent when inference is not possible.

interface TransportLeg {
  type:      "transport"
  mode:      TransportMode
  from?:     ResolvedGeolocation
  to?:       ResolvedGeolocation
  departs?:  ResolvedMoment
  arrives?:  ResolvedMoment
  duration?: ResolvedDuration
  info?:     MetadataItem[]
  note?:     string
}

// ─── Document root ───────────────────────────────────────────────────────────

interface TripMeta {
  name?:   string
  author?: string
  tags?:   string[]
  info?:   MetadataItem[]
  note?:   string
}

type ItineraryItem = Place | TransportLeg

interface CrumbDocument {
  trip?:     TripMeta
  itinerary: ItineraryItem[]  // always an array; empty if no itinerary key present
}
```
