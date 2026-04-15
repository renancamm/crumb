import * as yaml from "js-yaml"
import { classify } from "./pass1-classify"
import { resolve }  from "./pass2-resolve"
import { infer }    from "./pass3-infer"
import { CrumbDocument } from "../types/resolved"

/**
 * Parse a Crumb YAML source string into a CrumbDocument.
 *
 * Three-pass pipeline:
 *   classify — YAML object → RawCrumbDocument (structure only, no value resolution)
 *   resolve  — raw strings → typed fields (moments, durations, geolocations)
 *   infer    — enrich with inferred data (anchors, endpoints, relative dates)
 */
export function parse(source: string): CrumbDocument {
  const rawYaml = yaml.load(source)
  const raw     = classify(rawYaml)
  const resolved = resolve(raw)
  return infer(resolved)
}
