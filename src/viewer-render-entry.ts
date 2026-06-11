// Crumb global for viewer-only output: render functions only (no parser).
//
// Omitting `parse` lets esbuild tree-shake js-yaml + the three parser passes
// out of the bundle — the viewer receives the document pre-parsed as
// window.__CRUMB_DATA and never re-parses. The editor build uses browser-entry.ts
// instead, which additionally exports `parse` for live re-parsing.
export {
  renderTripHeader,
  renderTripPanel,
  renderPlacePanel,
  renderSinglePlacePanel,
  renderTransportPanel,
  renderModalContent,
} from "./renderer/html"
