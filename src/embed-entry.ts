/**
 * Embed bundle entry point.
 *
 * The viewer plus the embed bootstrap: reads ?src/?geo/?card (and a host's
 * crumb:load postMessage), fetches the .crumb, parses it, and renders. Injected
 * into embed.html, which ships window.Crumb *with* parse (the editor render
 * bundle) so a fetched document can be parsed client-side.
 */
import "./renderer/browser-app"
import "./renderer/embed-boot"
