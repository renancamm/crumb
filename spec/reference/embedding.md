# Embedding a Crumb

A crumb's interactive map is **self-contained**: it is a single page that runs
entirely in the browser, with no server, build step, or API key. To put one on
your own site or blog, you embed `embed.html` in an `<iframe>` and hand it a
crumb. This page covers every way to do that.

The easiest path is the [live editor](editor.html): open your crumb, choose
**Embed**, and copy the snippet it generates. The rest of this page explains what
that snippet does and the other options, so you can wire an embed by hand.

## The generated snippet

The editor's **Embed** button produces an `<iframe>` plus a tiny script that
hands the crumb to the embed once it is ready:

```html
<iframe src="https://your-host/embed.html" width="100%" height="480" loading="lazy" style="border:0;border-radius:12px"></iframe>
<script>
(function(){var f=document.currentScript.previousElementSibling,c=/* your crumb, as a JSON string */;
window.addEventListener("message",function(e){if(e.source===f.contentWindow&&e.data&&e.data.type==="crumb:ready")
f.contentWindow.postMessage({type:"crumb:load",crumb:c},"*");});})();
</script>
```

The crumb's text is baked into the snippet as a string, so the embed has no file
to fetch — paste it into any HTML page and it works. The handshake (`crumb:ready`
→ `crumb:load`) is what makes this robust for lazy iframes; see
[How the handshake works](#how-the-handshake-works) below.

## How to give the embed a crumb

`embed.html` is generic and content-agnostic — it ships no itinerary of its own.
You give it one in one of two ways.

### By URL — `?src=`

Point the embed at a hosted `.crumb` file and it fetches it:

```html
<iframe src="embed.html?src=https://your-host/trips/japan.crumb"
        width="100%" height="480" style="border:0"></iframe>
```

An optional `&geo=` parameter points at a baked geocode cache (a `.geo.json`
file) so known places resolve with zero network requests:

```html
<iframe src="embed.html?src=https://your-host/japan.crumb&geo=https://your-host/japan.geo.json"></iframe>
```

Use this when the crumb already lives at a stable URL. The trade-off is the
extra fetch (and that the file must be reachable and CORS-permitted from the
host page).

### Inline — `postMessage`

Send the crumb to the embed as data, with no file to host. This is what the
generated snippet uses. After the iframe loads, post a `crumb:load` message:

```js
const frame = document.querySelector("iframe")
frame.contentWindow.postMessage({
  type:  "crumb:load",
  crumb: "trip:\n  name: My trip\nitinerary:\n  - place: Lisbon",  // the .crumb text
  geo:   { "Lisbon": { lat: 38.72, lng: -9.14 } }                  // optional baked cache
}, "*")
```

The same message also **swaps** the crumb at runtime — post it again with a
different `crumb` and the map re-renders in place, no reload. (The landing page
uses exactly this to flip its hero map between detail levels.)

### How the handshake works

An iframe may finish loading before *or* after the host page is ready to talk to
it — especially with `loading="lazy"`. To make timing irrelevant, an embed that
has no `?src` and no baked-in data announces itself to its parent:

```
embed  ──  postMessage({ type: "crumb:ready" })  ──▶  host
host   ──  postMessage({ type: "crumb:load", crumb, geo })  ──▶  embed
```

So instead of racing the iframe's `load` event, you wait for its `crumb:ready`
and reply with the data. That is the whole of the generated snippet's script.

## The card variant — `?card`

Add `?card` to get a compact map-plus-legend card instead of the full map UI:

```html
<iframe src="embed.html?card&src=https://your-host/japan.crumb"
        width="100%" height="200" style="border:0"></iframe>
```

The card shows the map alongside a small trip header (name + note) and the
overview as a legend — good for a gallery of trips or an inline preview. `?card`
combines with either delivery method (`?src=` or inline `postMessage`).

## Sizing and styling

The embed fills its iframe, so size it from the host page:

| Attribute | Notes |
|---|---|
| `width` / `height` | Set on the `<iframe>`. `width="100%"` with a fixed `height` (e.g. `480`) is a good default; cards are shorter. |
| `loading="lazy"` | Defers offscreen embeds. The handshake makes this safe. |
| `style="border:0;border-radius:12px"` | The embed has no border of its own; round and frame it from the host. |
| `allow="fullscreen"` | Optional — lets the embed's expand control go fullscreen. |

The embed follows the viewer's own light/dark theme (it honours the host's
`prefers-color-scheme`); the map tiles stay light in both.

## What you are *not* shipping

There is no Crumb runtime to install on your site and no account to create. The
embed is a static page that parses and renders the crumb in the visitor's
browser. Geocoding (turning place names into map pins) happens lazily,
browser-side, against the public Nominatim service — or not at all if you supply
a baked `geo` cache. If you would rather render a crumb yourself instead of
embedding this viewer, see the [Parser Reference](parser.md) and
[Data Model](data-model.md).
