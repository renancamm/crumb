# Writing Crumb — A Guide for AI Systems

You are writing a **`.crumb`** file: a travel itinerary in YAML. Output **only valid YAML** following the rules below. Everything is optional — include only what is known, and use loose values (`September`, `morning`, `around 2h`) when exact ones aren't available. A bare list of place names is already a valid crumb; add detail as the plan firms up.

A crumb has two top-level keys:

```yaml
trip:                     # metadata (all fields optional)
  name: Japan in 2 Weeks
  author: Ana Yamamoto
  tags: [asia, food]
  note: Two-week autumn circuit.
itinerary:                # ordered list of places and transport legs
  - ...
```

**Single-place crumbs** (a city guide, a weekend) read best with the metadata at the `trip` level: put `note`, `tags`, and `info` on `trip` and leave the lone place bare, rather than repeating them on the one place.

---

## The one rule

**Every list has a default kind. An item is a bare string (the default kind, name only) or a mapping whose key names its kind.** The key's value is the item's name (or, for transport, its mode; for a group, its title). All other fields are **siblings** of that key — same indentation, *not* nested under it.

There are two lists:

- **`itinerary`** — default kind **`place`**; the other kind is **`transport`**.
- **`plan`** (a place's list of what happens there) — default kind **`activity`**; the others are **`stay`**, **`day`**, **`week`**, **`group`**.

A **`place` is a geographic location** — it can be put on a map. To organize recommendations by theme rather than by location (e.g. a city guide), keep one `place` for the destination and use `group`s inside its `plan` — do **not** turn a theme like "Where to eat" into a place.

```yaml
✅ - place: Tokyo          # 'place' and its fields are siblings
     duration: 5 nights
     tags: [city, food]

❌ - Tokyo:                # do NOT put the name in the key alone
     duration: 5 nights
❌ - name: Tokyo           # there is no 'name' key on an item
❌ - place: Tokyo
       duration: 5 nights  # do NOT nest fields under the key
```

A **bare string** is the default kind of its list — a place in `itinerary`, an activity in a `plan`:

```yaml
itinerary:
  - Tokyo                  # place
  - Kyoto                  # place
```

---

## Hard rules (where AIs go wrong)

**1. The kind is the key — never a `name` field.** `- place: Tokyo`, not `- Tokyo:` or `- name: Tokyo`. The only place a `name` appears is `trip.name`.

**2. Fields are siblings of the kind key, not nested under it.** Align them at the same column:
```yaml
✅ - place: Tokyo          ❌ - place: Tokyo
     duration: 5 nights          duration: 5 nights   # over-indented = nested = wrong
```

**3. Transport always uses `transport:`.** A bare string is always a place. `- train` is a place named "train"; `- transport: train` is the leg.

**4. A place's stays, activities, and groups all go in one `plan` list.** There is no separate `stay:` or `activities:` field — they are kinds inside `plan`:
```yaml
- place: Kyoto
  plan:
    - Fushimi Inari            # activity (default, bare)
    - activity: Nishiki Market # activity with fields
      priority: must
    - stay: Gion Ryokan        # accommodation
    - day: Temple day          # a group; its activities nest in its own plan
      plan:
        - Kinkaku-ji
        - Ryoan-ji
```

A loose activity (directly in `plan`) is a thing to do at the place that isn't tied to a specific day. A `day`/`week` group is a scheduled day or week. **List each activity once** — either loose, or inside one group, never both. When you schedule a must-see into a `day`, that is where it lives; don't also repeat it as a loose activity.

**5. Don't invent fields.** Every kind has a **fixed set of fields** (below). The only block that takes custom keys is `info`. Anything else — confirmation codes, gate numbers, operators — goes under `info`:
```yaml
✅ - transport: flight      ❌ - transport: flight
     info:                       operator: JAL        # not a transport field
       operator: JAL             gate: 114            # not a transport field
       gate: 114
```

**6. Quote YAML-ambiguous names.** Wrap names that read as numbers or keywords: `place: "2026"`, `activity: "null"`.

**7. Free text with punctuation breaks YAML — use a `|` block.** A `note` or `title` containing a colon-space (`: `), a `#`, or quotation marks is invalid as a plain value. Write any such free text as a `|` block (safest — no escaping needed), or wrap it in double quotes:
```yaml
✅ note: |                                  ❌ note: Eat like a local: a pastel de nata
     Eat like a local: a pastel de nata.         # the ": " breaks YAML parsing
```

---

## Fields per kind (these sets are closed)

- **place:** `duration, arrives, departs, location, tags, plan, info, note`
- **transport:** `from, to, departs, arrives, duration, info, note`
- **activity:** `priority, tags, time, duration, location, info, note`
- **stay:** `arrives, departs, duration, location, tags, info, note`
- **group** (`day` / `week` / `group`): value is the optional title; fields `time, duration, plan`
- **trip:** `name, author, duration, tags, info, note`

## Closed vocabularies (use only these values)

- **transport modes** (the `transport:` value): `train` `flight` `bus` `car` `ferry` `walk` `bike` `other`
- **group kinds** (the key of a group): `day` `week` `group` — `day`/`week` are scheduled; `group` is an unscheduled themed set / alternatives
- **priority:** `must` `maybe`
- **named time-of-day periods:** `early morning` `morning` `midday` `afternoon` `late afternoon` `evening` `night` `late night` `midnight`
- **seasons** (year required, e.g. `fall 2026`): `spring` `summer` `fall` `autumn` `winter`

---

## Dates, times, durations

Write them naturally — most reasonable phrasings are valid. Match precision to what's actually known.

- **dates:** `2026-09-15` · `September 15` · `September 2026` · `September` · `early October` · `mid March` · `late October` · `fall 2026`
- **times:** `09:15` · `9am` · `3:30pm` · a named period (`morning`)
- **datetime** (use a UTC offset for flights): `2026-09-18T23:00+09:00`
- **relative** (within a place stay): `Day 1` · `Day 3` · `first day` · `last day` · `Monday` · `next day` · `next week`
- **combine** date + time with `at`: `September 15 at 9am`, `2026-09-15 at morning`
- **durations:** `30m` `2h` `2h30m` `3d` `3n` (nights) · `2 hours` `3 nights` · `all day` `half day` `overnight` · `around 2h` · `at least 1h` · `2-3 hours`

## Locations

A `location` is a plain string (a name or address), a block with `address` / `lat` / `lng`, or `none` to opt out. No `name` field — the item already has a name.

```yaml
location: Fushimi Inari Taisha, Kyoto
location:
  address: 68 Fukakusa Yabunouchicho, Kyoto
  lat: 34.9671
  lng: 135.7727
```

---

## A complete example

<!-- include: examples/snippets/kitchen-sink.crumb -->
```yaml
trip:
  name: Japan Sampler
  tags: [asia, food, temples]
  note: A short autumn loop. Best late October.

itinerary:

  - Osaka                    # bare place — only the name is known so far

  - transport: train

  - place: Kyoto             # a little detail — just how long, a couple of ideas
    duration: 3 nights
    plan:
      - Fushimi Inari                  # bare activity
      - activity: Nishiki Market       # a touch more
        priority: maybe
        note: |
          Go early: the stalls open around 9 and it's packed by noon.

  - transport: train
    to: Tokyo
    departs: 2026-10-24T09:00

  - place: Tokyo             # fully detailed
    arrives: 2026-10-24
    duration: 4 nights
    location: Tokyo, Japan
    tags: [city, food]
    plan:
      - stay: Shinjuku Granbell Hotel
        arrives: 2026-10-24
        info:
          reference: SGH-2231
      - Senso-ji Temple                # bare activity
      - activity: teamLab Planets       # detailed activity
        priority: must
        time: morning
        duration: 2h
      - day:                            # group, title omitted
        plan:
          - Meiji Shrine
          - Harajuku
      - day: East Tokyo                 # group, with title
        time: 2026-10-26
        plan:
          - activity: Tokyo Skytree
            time: 9am
            duration: 1h30m
          - activity: Akihabara
            time: afternoon

  - transport: flight
    from: Tokyo Haneda
    to:
      address: London Heathrow
      lat: 51.4700
      lng: -0.4543
    departs: 2026-10-28T11:00+09:00
    arrives: 2026-10-28T15:30+00:00
    info:
      operator: JAL
      reference: JL043
```

---

## Common mistakes — check before you finish

- ❌ Name in the key (`- Tokyo:`) or a `name:` field on an item → ✅ `- place: Tokyo`
- ❌ Fields indented *under* the kind key → ✅ fields are siblings, same column
- ❌ A bare `- train` meaning a leg → ✅ `- transport: train`
- ❌ Separate `stay:` / `activities:` fields → ✅ one `plan:` list holding `stay`, activities, and groups
- ❌ Custom keys on a place/activity/transport → ✅ put them under `info`
- ❌ Invented modes/priorities/group kinds → ✅ use only the listed vocabularies
- ❌ A group nested inside a group → ✅ groups never nest
- ❌ The same activity both loose in `plan` and inside a `day` → ✅ each activity appears once — loose, or scheduled in one group
- ❌ A `name` inside `location` → ✅ `location` block is `address`/`lat`/`lng` only
- ❌ Unquoted ambiguous names (`2026`, `null`) → ✅ `"2026"`, `"null"`
- ❌ A `note`/`title` containing `: `, `#`, or quotes as a plain value → ✅ write it as a `|` block (or double-quote it)
- ❌ A theme as a place (`- place: Where to eat`) → ✅ one `place: <city>` with `- group: Where to eat` in its `plan`

---

Full reference: [`CRUMB_SPEC.md`](CRUMB_SPEC.md).
