#!/usr/bin/env node
import { readJson } from "./rule-dsl-core.mjs";

const report = readJson(process.argv[2] || process.argv[process.argv.indexOf("--report") + 1]);
for (const result of report.results || []) {
  console.log(`${result.status.toUpperCase()} ${result.rule_id}: ${result.message}`);
}
