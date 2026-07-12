#!/usr/bin/env node
import { loadRuleCard, writeJson } from "./rule-dsl-core.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const rulePath = arg("--rule", process.argv[2] || "");
const out = arg("--out", "");
if (!rulePath) throw new Error("Provide --rule");
const card = loadRuleCard(rulePath);
if (out) writeJson(out, card);
console.log(JSON.stringify({ ok: true, rule_id: card.rule_id, lifecycle: card.lifecycle, out }, null, 2));
