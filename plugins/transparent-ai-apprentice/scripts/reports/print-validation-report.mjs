#!/usr/bin/env node
import { readJson } from "../rules/rule-dsl-core.mjs";

export function printValidationReport(report) {
  console.log(`Validation ${report.validation_id}: status=${report.status} delivery_allowed=${report.delivery_allowed}`);
  for (const result of report.results || []) {
    console.log(`- ${result.status} ${result.rule_id} ${result.validator}: ${result.message}`);
  }
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  printValidationReport(readJson(process.argv[2] || process.argv[process.argv.indexOf("--report") + 1]));
}
