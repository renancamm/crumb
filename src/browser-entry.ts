// Browser bundle entry point.
// Only exports what the browser JS needs for live re-parsing after edits.
export { parse }                            from "./parser"
export { renderItineraryBody, buildPopupMeta } from "./renderer/html"
