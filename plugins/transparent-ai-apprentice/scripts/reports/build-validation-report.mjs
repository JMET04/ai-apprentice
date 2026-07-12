#!/usr/bin/env node
import { evaluateRulePackage } from "../rules/evaluate-rule-package.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const report = await evaluateRulePackage({ rulesPath: arg("--rules"), artifactPath: arg("--artifact"), outPath: arg("--out") });
console.log(JSON.stringify({ ok: true, reportPath: arg("--out"), status: report.status, delivery_allowed: report.delivery_allowed }, null, 2));
