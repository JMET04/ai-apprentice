#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateRuleCard } from "../rules/rule-dsl-core.mjs";
import { buildCorpusIndex, draftRuleCardFromRetrieval, retrieveFromCorpus, writeJson } from "../knowledge/knowledge-core.mjs";

const root = resolve(".transparent-apprentice", "smoke", "knowledge-rag-rule-draft");
const sourceDir = join(root, "source");
const outDir = join(root, "out");
mkdirSync(sourceDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const sourcePath = join(sourceDir, "teacher-software-execution-note.md");
writeFileSync(
  sourcePath,
  [
    "# Teacher execution safety note",
    "",
    "For medium or high risk software actions, the apprentice must collect explicit teacher approval and retain a rollback point before execution.",
    "",
    "Retrieved knowledge is evidence only. It can suggest a disabled rule draft, but it cannot enable rules, execute target software, write memory, or unlock packaging."
  ].join("\n"),
  "utf8"
);

const { index, indexPath } = buildCorpusIndex({
  sourcePath: sourceDir,
  outDir,
  sourceIdPrefix: "smoke.teacher",
  sourceType: "teacher_note",
  domain: "system.execution"
});

const packet = retrieveFromCorpus({
  corpusIndex: index,
  query: "teacher approval rollback high risk software execution",
  topK: 2
});
const packetPath = join(outDir, "retrieval-evidence-packet.json");
writeJson(packetPath, packet);

if (packet.status !== "evidence_found") throw new Error("Expected local keyword retrieval to find evidence.");
if (packet.locks.can_enable_rules !== false) throw new Error("Retrieval packet must not enable rules.");
if (packet.locks.can_execute_target_software !== false) throw new Error("Retrieval packet must not execute software.");
if (packet.locks.can_unlock_packaging !== false) throw new Error("Retrieval packet must not unlock packaging.");

const rule = draftRuleCardFromRetrieval({
  packet,
  ruleId: "knowledge.smoke.teacher_approval_rollback.review_only",
  domain: "system.execution"
});
const rulePath = join(outDir, "retrieval-rule-draft.json");
writeJson(rulePath, rule);

const validation = validateRuleCard(rule);
if (!validation.ok) throw new Error(`Draft rule should validate: ${JSON.stringify(validation.errors)}`);
if (rule.lifecycle !== "draft_disabled") throw new Error("RAG handoff must create a disabled rule draft.");
if (rule.owner.reviewer_id !== null || rule.owner.approved_at !== null) throw new Error("RAG handoff must not fake teacher review.");
if (!rule.source.evidence_refs.every((ref) => ref.startsWith(`retrieval://${packet.retrieval_id}/`))) {
  throw new Error("Rule draft must cite retrieval chunk references.");
}

const forbiddenActiveProbe = validateRuleCard({ ...rule, lifecycle: "active" });
if (forbiddenActiveProbe.ok) throw new Error("Active rule without reviewer and approval should fail validation.");
const expectedForbiddenActiveError = "ACTIVE_RULE_REQUIRES_REVIEWER_AND_APPROVED_AT";
if (!forbiddenActiveProbe.errors.some((error) => error.error_code === expectedForbiddenActiveError)) {
  throw new Error(`Expected ${expectedForbiddenActiveError} from active rule probe.`);
}

const result = {
  ok: true,
  smoke: "transparent_ai_knowledge_rag_rule_draft_smoke_v1",
  indexPath,
  packetPath,
  rulePath,
  retrievedChunks: packet.chunks.length,
  locks: packet.locks,
  ruleLifecycle: rule.lifecycle,
  expectedForbiddenActiveError,
  forbiddenActiveProbeErrors: forbiddenActiveProbe.errors.map((error) => error.error_code)
};

console.log(JSON.stringify(result, null, 2));
