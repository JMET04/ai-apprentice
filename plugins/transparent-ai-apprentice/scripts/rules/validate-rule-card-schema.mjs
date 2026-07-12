#!/usr/bin/env node
import { loadRuleCard, validateRuleCard } from "./rule-dsl-core.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const rulePath = arg("--rule", process.argv[2] || "");
if (!rulePath) throw new Error("Provide --rule");
const rule = loadRuleCard(rulePath);
const result = validateRuleCard(rule);
console.log(JSON.stringify({ ...result, rule_id: rule.rule_id, rulePath }, null, 2));
if (!result.ok) process.exit(1);
