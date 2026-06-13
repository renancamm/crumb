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

  - place: Tokyo
    duration: 5 nights

  - transport: train

  - place: Kyoto
    duration: 3 nights
    plan:
      - Fushimi Inari
      - activity: Nishiki Market
        priority: must
      - activity: Arashiyama Bamboo Grove
        priority: maybe

  - transport: train
    duration: 15m

  - place: Osaka
    duration: 2 nights
    plan:
      - stay: Namba Hotel
        arrives: 3pm
        departs: morning
      - activity: Dotonbori
        priority: must
        tags: [landmark, food, nightlife]
      - activity: Osaka Castle
        priority: must
        tags: [landmark, history]
      - activity: Shinsekai
        priority: maybe
        tags: [landmark, food]

  - transport: train
    to: Hiroshima
    departs: 2026-09-15T09:00

  - place: Hiroshima
    arrives: 2026-09-15
    departs: 2026-09-18
    duration: 3 nights
    plan:
      - stay: Hiroshima Garden Hotel
        arrives: 2026-09-15
        departs: 2026-09-18
        info:
          website: https://www.example.com
          reference: HGH-220
        note: Ask for a room facing the garden.

      - activity: Peace Memorial Park
        priority: must
        tags: [landmark, history]
        location: Peace Memorial Park, Hiroshima
        note: Allow a **full morning**. The museum is deeply moving.

      - day:
        plan:
          - Mitaki-dera Temple
          - Hiroshima Museum of Art

      - day:
        plan:
          - Itsukushima Shrine
          - Mt. Misen

      - day: Peace and history
        time: 2026-09-18
        plan:
          - activity: Peace Memorial Museum
            time: 9am
            duration: 2h
            note: Book tickets in advance.
          - activity: Atomic Bomb Dome
            time: 11am
            duration: 1h
            location:
              lat: 34.3955
              lng: 132.4530
          - activity: Okonomi-mura
            time: midday
            duration: 1h
            note: Try the **Hiroshima-style** okonomiyaki — layered, not mixed.

  - transport: train
    from: Hiroshima
    to: Tokyo
    departs: 2026-09-18T17:00+09:00
    arrives: 2026-09-18T19:30+09:00

  - transport: flight
    from:
      address: 2-6-5 Hanedakuko, Ota City, Tokyo
      lat: 35.5494
      lng: 139.7798
    to:
      address: London Heathrow Airport
      lat: 51.4700
      lng: -0.4543
    departs: 2026-09-18T23:00+09:00
    arrives: 2026-09-19T06:00+01:00
    info:
      operator: JAL
      reference: JL44-8821
      gate: 114
      terminal: International Terminal
```

---

## How the Format Works

Three rules shape everything in Crumb.

**1. Each item in a list declares its kind.**
A crumb is built from lists — the `itinerary`, and the `plan` inside each place. Every list has a **default kind**. An item written as a bare string is one of that default kind, with a name and nothing else. To add fields, write a mapping whose key names the kind: the key's value is the item's name (or, for transport, its mode; for a group, its title), and the item's other fields are sibling keys in the same mapping. The kinds, and their default per list, are given in [Itinerary: Places](#itinerary-places) and [Itinerary: Transport](#itinerary-transport).

**2. Dates, times, and durations are flexible.**
Write `2026-09-15` or just `September`. Write `9am` or `afternoon`. Write `2h` or `at least half day`. A wide range of formats are valid, from exact timestamps to loose human expressions.

**3. Everything is optional.**
A bare place name is valid. An activity with just a name is valid. You add fields as your plans take shape. The only required part of any item is its kind and name.

> **Note:** Names must be valid YAML strings. If a name could be read as something else by YAML — for example a number like `2026`, or the word `null` — wrap it in quotes: `place: "2026"`, `activity: "null"`.

> A crumb can mix any level of detail freely. One place can have confirmed dates and a booking reference; another in the same itinerary can be just a name. Dates, durations, and locations are all independent — a place can have an exact arrival date and a rough duration, or a specific hotel location and no dates at all. The right level of precision for any field is the level that reflects what's actually known. An approximate value like `early October` signals an estimate; a missing field signals that the information isn't available.

> Every block has a **fixed set of fields**, listed in that block's field table. The single exception is `info`, which holds custom key-value pairs of your choosing. Anything that is not a listed field belongs under `info` — see [MetadataList](#metadatalist).

---

## Top-level Fields

A Crumb document has two top-level keys: `trip` and `itinerary`.

### `trip`

Optional metadata about the trip.

```yaml
trip:
  name: Japan in 2 Weeks
  author: Ana Yamamoto
  duration: 2 weeks
  tags: [asia, food, city]
  note: A two-week circuit through Japan's most iconic cities.
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Title of the trip |
| `author` | string | Name or handle of the person who wrote this crumb |
| `duration` | Duration | Total length of the trip. |
| `tags` | list | Keywords describing the trip style and focus |
| `info` | MetadataList | Supplementary key-value details (e.g. booking platform, guide website, trip code) |
| `note` | Text | Free-text description of the trip |

> When a crumb describes a single place — a city guide, a weekend — `trip`-level `note`, `tags`, and `info` are the natural home for the document's metadata; the lone place can stay bare rather than repeating them.

### `itinerary`

An ordered list of items. Order implies chronological sequence. The default kind is `place`; the other kind is `transport`.

```yaml
itinerary:
  - Tokyo
  - transport: train
    to: Kyoto
  - Kyoto
```

---

## Itinerary: Places

A place is the default kind in the itinerary. A bare string is a place with a name and nothing else. To add fields, write a mapping keyed `place`, whose value is the name, with the place's fields as sibling keys.

```yaml
# Minimal
- Tokyo

# With fields
- place: Tokyo
  duration: 5 nights
  tags: [city, food]
  note: Base yourself in Shinjuku.
```

The place fields are siblings of the `place` key, at the same indentation — they are not nested underneath it.

A place's stays, activities, and day-plans all live in its `plan` — a single ordered list, described below.

```yaml
- place: Tokyo
  arrives: 2026-09-10
  departs: 2026-09-15
  duration: 5 nights
  location: Tokyo, Japan
  tags: [city, food, culture]
  plan:
    - stay: Shinjuku Granbell Hotel
      arrives: 2026-09-10
      departs: 2026-09-15
    - activity: Senso-ji Temple
      priority: must
      tags: [temple, landmark]
  info:
    guide: https://www.gotokyo.org
  note: Get a **Suica card** on arrival.
```

| Field | Type | Description |
|---|---|---|
| `arrives` | Moment | When you arrive at this place |
| `departs` | Moment | When you leave this place |
| `duration` | Duration | How long you are spending here |
| `location` | Geolocation | Geographic reference for this place |
| `tags` | list | Keywords |
| `plan` | list | What happens here — see [Plan](#plan) |
| `info` | MetadataList | Supplementary key-value details |
| `note` | Text | Free-text description or tips |

---

### Plan

A place's `plan` is one ordered list holding everything that happens there. Its default kind is `activity`; a bare string is an activity. The other kinds — accommodation and activity groups — announce themselves with a keyword key:

| Key | Kind | |
|---|---|---|
| *(bare string)* / `activity` | an activity | the default |
| `stay` | accommodation | see [Stay](#stay) |
| `day` / `week` / `group` | an activity group | see [Activity groups](#activity-groups) |

```yaml
- place: Kyoto
  plan:
    - Fushimi Inari                  # bare string — an activity

    - activity: Nishiki Market       # an activity with fields
      priority: must

    - stay: Gion Hatanaka Ryokan     # accommodation
      duration: 3 nights

    - day: Temple hopping            # an activity group
      time: 2026-09-16
      plan:
        - Kinkaku-ji
        - Ryoan-ji
```

Because the list is ordered, stays and activities can be interleaved in the sequence they actually happen — useful when you change hotels mid-visit, or want a stay to sit between the activities around it.

An activity placed directly in the plan is loose — a thing to do at the place, not tied to a specific day. Placing an activity inside a `day` or `week` group schedules it to that day or week. An activity is normally listed once: either loose in the plan, or within a single group.

---

### Stay

A `stay` is accommodation within a place's plan. Its value is the property name; fields are siblings. Multiple stays are supported for when you leave and return, or switch hotels mid-visit.

```yaml
# Minimal
- place: Kyoto
  plan:
    - stay: Gion Hatanaka Ryokan

# With fields
- place: Kyoto
  plan:
    - stay: Gion Hatanaka Ryokan
      arrives: 2026-09-15
      departs: 2026-09-18
      duration: 3 nights
      location: Nijo, Gion, Kyoto
      tags: [ryokan]
      info:
        website: https://www.hatanaka.jp
        reference: ABC123
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

An activity is the default kind in a plan. A bare string is an activity with a name and nothing else. To add fields, write a mapping keyed `activity`, whose value is the name, with fields as siblings.

> A bare activity name is enough for anything worth noting but not yet planned in detail. Add `must` for definite priorities, `maybe` for things that depend on time or mood. Fields like `time` and `duration` suit activities where scheduling actually matters — leave them out for anything more loosely planned.

```yaml
- activity: Senso-ji Temple
  priority: must
  tags: [temple, landmark]
  time: 8am
  duration: 1h30m
  location: Asakusa, Tokyo
  info:
    tripadvisor: https://www.tripadvisor.com/example
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

An activity group collects activities into a named unit — useful for day-by-day planning. A group is keyed by its kind, and its value is an optional title. Its activities go in a nested `plan`. Activity groups cannot be nested, and a group's `plan` holds only activities.

Valid group kinds:

| Kind | Meaning |
|---|---|
| `day` | A single day. |
| `week` | A single week. |
| `group` | An unscheduled group — a themed collection, alternatives, or ideas. Its contents are not part of the itinerary's chronological sequence. |

```yaml
# A day — title omitted
- day:
  plan:
    - Fushimi Inari
    - Kinkaku-ji

# A day — with title and time
- day: Temple hopping
  time: 2026-09-16
  plan:
    - activity: Fushimi Inari
      time: 8am
    - activity: Kinkaku-ji
      time: 11am

# A week
- week: First week in Tokyo
  plan:
    - Senso-ji Temple
    - teamLab Planets
    - Shibuya Crossing

# An unscheduled group — for themed ideas or alternatives
- group: Rainy day alternatives
  plan:
    - teamLab Planets
    - Mori Art Museum
    - Shibuya shopping
```

When a `day` or `week` group has no explicit `time`, it begins the day or week immediately following the previous group, starting from the place's arrival date. An explicit `time` on any group resets the sequence from that point. `group` groups are never part of this sequence.

| Field | Type | Description |
|---|---|---|
| *(value)* | string | The group's title. Optional. |
| `time` | Moment | When this group takes place. Defaults to `next day` for `day` groups and `next week` for `week` groups when omitted. |
| `duration` | Duration | How long this group spans. Optional on all group kinds. |
| `plan` | list | Bare or detailed activities. No nested groups, no stays. |

---

## Itinerary: Transport

A transport leg connects two places. It is a mapping keyed `transport`, whose value is the mode. The surrounding places in the list determine the departure and arrival points — you only need to be explicit when the actual point differs from the place name, such as a specific airport.

```yaml
# Mode only — no fields needed
- transport: train

# With fields
- transport: train
  to: Kyoto

# With full detail
- transport: flight
  from: Tokyo Haneda
  to: Osaka Kansai
  departs: 2026-09-12T07:30+09:00
  arrives: 2026-09-12T08:45+09:00
  info:
    operator: ANA
    reference: NH425
  note: Check in at least **2 hours** before departure.
```

The available transport modes are:

`train`, `flight`, `bus`, `car`, `ferry`, `walk`, `bike`, `other`

Use `other` when the mode doesn't fit any of the above.

> A bare string in the itinerary is always a place. A transport leg always uses the `transport` key — so `- train` is a place named "train", while `- transport: train` is a transport leg.

| Field | Type | Description |
|---|---|---|
| `from` | Geolocation | Departure point. When absent, the nearest preceding place in the itinerary is used. |
| `to` | Geolocation | Arrival point. When absent, the nearest following place in the itinerary is used. |
| `departs` | Moment | Departure time |
| `arrives` | Moment | Arrival time |
| `duration` | Duration | Journey time. Computed from `departs` and `arrives` when both carry a UTC offset. |
| `info` | MetadataList | Supplementary key-value details |
| `note` | Text | Free-text notes |

> **Tip:** For flights and cross-timezone transport, include a UTC offset in `departs` and `arrives` (e.g. `2026-06-01T10:00+09:00`). When both carry an offset, `duration` is computed from the elapsed UTC time, correctly accounting for timezone differences.

---

## Field Types

Crumb uses a small set of named types, referenced consistently in every field table throughout this document.

### Primitive types

| Type | Description | Example |
|---|---|---|
| `string` | Plain text | `place: Tokyo` |
| `number` | Decimal number | `lat: 34.9671` |
| `list` | YAML list of strings, flow or block syntax | `tags: [food, city]` |
| `enum` | String with a fixed set of valid values | `priority: must` |

### Special field types

These types have their own grammar, defined in the [Field Reference](#field-reference) section below.

| Type | Description |
|---|---|
| `Duration` | A duration string — `2h30m`, `3 nights`, `around 2 hours`. |
| `MetadataList` | A map of custom key-value pairs for supplementary details. |
| `Geolocation` | A place name, address, or a block with optional `address`, `lat`, `lng`. |
| `Text` | Free-text string supporting CommonMark markdown. Supports multiline content. |
| `Moment` | Any temporal expression — exact, relative, or a natural language label. |

---

## Field Reference

This section describes the grammar for each special field type.

---

### `Duration`

How long something takes or lasts. Accepts shorthand, plain English, named spans, and any of these with a modifier expressing uncertainty.

**Used on:** places, stays, activities, activity groups, transport legs.

> Exact values suit confirmed or well-known durations. Approximate, minimum, or range forms suit estimates — `around 3 nights` or `2-3 hours` is more accurate than a precise value that isn't actually known. Named spans like `all day` or `half day` work when an activity fills a period without a specific hour count. Leave the field out when the length is unknown.

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

A map of custom key-value pairs for supplementary details. Each key is a user-defined string label. Each value is a string or number — numbers are common for travel metadata such as flight numbers, confirmation codes, and gate numbers.

`info` is the only block that accepts arbitrary keys. Every other block has a fixed set of fields; anything custom belongs here.

```yaml
info:
  website: https://www.kikunoi.jp
  tripadvisor: https://www.tripadvisor.com/example
  reservation: KIK-882
  dress-code: Smart casual
```

**Used on:** `trip`, places, stays, activities, transport legs.

---

### `Geolocation`

A geographic reference. Write it as a plain string or as a block with any combination of the fields below.

> A plain string is enough for any named location — a city, a neighbourhood, a landmark. Include coordinates only when a specific map pin matters beyond what a name provides. Use `location: none` when no geographic reference applies. Leave the field out when location isn't relevant.

```yaml
# Plain string — a name or address
location: Fushimi Inari Taisha, Kyoto

# Block
location:
  address: 68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto
  lat: 34.9671
  lng: 135.7727

# Opt out of geocoding
location: none
```

| Field | Type | Description |
|---|---|---|
| `address` | string | Street address |
| `lat` | number | Latitude in decimal degrees |
| `lng` | number | Longitude in decimal degrees |

A plain-string Geolocation carries the location's name or address directly; the surrounding item already supplies a name for display. The block form is for a precise address or coordinates.

An item's name is a label, not a geographic reference: a descriptive name (`Dotonbori at night`) does not locate a place. Add a `location` — a plain place-name string is enough (`location: Dotonbori`) — to give the item a geographic reference; coordinates are for when an exact point is required.

**`Geolocation` used on:** places, stays, activities.
**`from` and `to` on transport legs** follow the same grammar.

#### `location: none`

`location: none` marks a place, stay, or activity as having no geographic coordinates. Coordinate lookup and map placement are outside the scope of the Crumb format. Useful for unnamed waypoints, intentionally abstract places, or privacy.

```yaml
- place: Somewhere private
  location: none
  duration: 2 nights
```

`location: none` opts out of geographic reference. `location: null` is not valid.

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

> Machine formats suit confirmed dates and times. Human month-year or approximate forms suit plans still taking shape — `September 2026`, `early October`, or `fall 2026` is more honest than a specific date that isn't actually known. Named periods like `morning` or `afternoon` work for time-of-day when the exact time doesn't matter. Leave the field out entirely when timing is unknown.

---

#### Machine date

ISO 8601 date. Always an absolute date.

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

Month-name formats. Both day-before-month and month-before-day are accepted. Abbreviations and ordinal suffixes (`st`, `nd`, `rd`, `th`) are accepted. Always an absolute date.

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

#### Human date — approximate

For planning when you know roughly when something will happen but not a specific date. Year may be omitted — when it is, the current or next upcoming occurrence is assumed, the same rule as "Human date — without year".

```yaml
arrives: early October 2026
arrives: mid March 2026
arrives: late October
arrives: sometime in October 2026
arrives: around October 15, 2026
arrives: around 15 October
```

Seasons are also valid approximate dates. Year is required for season forms.

```yaml
arrives: spring 2026
arrives: summer 2026
arrives: fall 2026
arrives: autumn 2026
arrives: winter 2026
```

All recognized approximate forms:

| Form | Example |
|---|---|
| `early [Month] [Year?]` | `early October 2026`, `early October` |
| `mid [Month] [Year?]` | `mid March 2026`, `mid-March` |
| `late [Month] [Year?]` | `late October 2026`, `late October` |
| `sometime in [Month] [Year?]` | `sometime in October 2026` |
| `around [Month] [Day][, Year?]` | `around October 15, 2026`, `around October 15` |
| `around [Day] [Month] [Year?]` | `around 15 October 2026` |
| `spring [Year]` | `spring 2026` |
| `summer [Year]` | `summer 2026` |
| `fall [Year]` / `autumn [Year]` | `fall 2026`, `autumn 2026` |
| `winter [Year]` | `winter 2026` |

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

| Value | Refers to |
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

Position within a place stay, relative to the place's arrival date. When no arrival date is set, relative values describe position within the stay without resolving to a calendar date.

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

- [Parser Reference](reference/parser.md) — parsing pipeline, field resolution rules, worked example
- [Output Data Model](reference/data-model.md) — CrumbDocument TypeScript interfaces
- [Authoring Guide](crumb-for-ai.md) — compact format reference for AI systems generating crumbs
