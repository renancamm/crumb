import * as yaml from "js-yaml"
import { pass1 } from "./pass1"
import { pass2 } from "./pass2"
import { pass3 } from "./pass3"
import { CrumbDocument } from "../types"

export function parse(source: string): CrumbDocument {
  const rawYaml = yaml.load(source)
  const raw     = pass1(rawYaml)
  const resolved = pass2(raw)
  return pass3(resolved)
}
