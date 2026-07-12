#!/usr/bin/env node
import { loadRuleCard } from "./rule-dsl-core.mjs";

const path = process.argv[2] || process.argv[process.argv.indexOf("--rule") + 1];
if (!path) throw new Error("Usage: node load-rule-card.mjs --rule <rule-card>");
console.log(JSON.stringify(loadRuleCard(path), null, 2));
