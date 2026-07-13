#!/usr/bin/env node
import { readJson, validateArtifactEnvelope, writeJson } from "../rules/rule-dsl-core.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const input = arg("--input", process.argv[2] || "");
const out = arg("--out", "");
if (!input) throw new Error("Provide --input");
const artifact = readJson(input);
const normalized = {
  schema_version: "0.1",
  units: "mm",
  source_refs: [],
  context: {},
  objects: [],
  relations: [],
  topology: {},
  geometry: {},
  ...artifact
};
const validation = validateArtifactEnvelope(normalized);
if (out) writeJson(out, normalized);
console.log(JSON.stringify({ ok: validation.ok, errors: validation.errors, out }, null, 2));
if (!validation.ok) process.exit(1);
