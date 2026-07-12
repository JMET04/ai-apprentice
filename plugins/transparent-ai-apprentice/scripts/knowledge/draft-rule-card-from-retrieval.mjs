#!/usr/bin/env node
import { resolve } from "node:path";
import { validateRuleCard } from "../rules/rule-dsl-core.mjs";
import { arg, draftRuleCardFromRetrieval, readJson, writeJson } from "./knowledge-core.mjs";

const packetPath = resolve(arg("--retrieval-packet", ""));
const outPath = resolve(arg("--out", ".transparent-apprentice/knowledge/retrieval-rule-draft.json"));
const ruleId = arg("--rule-id", "knowledge.review_only.draft");
const domain = arg("--domain", "knowledge.grounded_rule");

if (!packetPath) {
  throw new Error("Usage: node draft-rule-card-from-retrieval.mjs --retrieval-packet <path> [--out <path>]");
}

const packet = readJson(packetPath);
if (packet.locks?.can_enable_rules !== false || packet.locks?.can_execute_target_software !== false) {
  throw new Error("Retrieval packet is missing evidence-only safety locks.");
}

const rule = draftRuleCardFromRetrieval({ packet, ruleId, domain });
const validation = validateRuleCard(rule);
if (!validation.ok) {
  console.error(JSON.stringify({ ok: false, validation }, null, 2));
  process.exit(1);
}

writeJson(outPath, rule);
console.log(JSON.stringify({ ok: true, outPath, lifecycle: rule.lifecycle, evidenceRefs: rule.source.evidence_refs.length }, null, 2));
