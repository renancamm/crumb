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

## For tool builders

The following reference documents are aimed at tool builders implementing parsers or consuming the output data model.

- **[Parser Reference](reference/parser.md)** — the three-pass parsing pipeline (classify → resolve → infer), field resolution rules, a worked example, and the raw data model (Pass 1 output).
- **[Output Data Model](reference/data-model.md)** — the complete `CrumbDocument` TypeScript interface definitions. The canonical source is `src/types/`; this document is a readable companion.

