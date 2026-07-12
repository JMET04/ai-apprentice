#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, retrieveFromCorpus } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "smoke", "rag-research-intake-queue");
mkdirSync(root, { recursive: true });

const scriptPath = join(pluginRoot, "scripts", "knowledge", "create-rag-research-intake-queue.mjs");
const run = spawnSync(process.execPath, [scriptPath, "--out-dir", root], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (run.status !== 0) {
  throw new Error(`Research intake queue failed:\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
}

const result = JSON.parse(run.stdout);
const queue = readJson(result.queuePath);
const corpus = readJson(queue.corpus.indexPath);
const retrievalPacket = retrieveFromCorpus({
  corpusIndex: corpus,
  query: "RAG evidence teacher review knowledge enhancement",
  topK: 2
});

if (queue.format !== "transparent_ai_rag_research_intake_queue_v1") {
  throw new Error("Unexpected queue format.");
}
if (!existsSync(result.readmePath) || !existsSync(queue.corpus.indexPath)) {
  throw new Error("Queue must write a README and corpus index.");
}
if (queue.sourceCandidates.length < 5) {
  throw new Error("Queue must include adviser note plus external research leads.");
}
if (!queue.sourceCandidates.some((candidate) => candidate.candidate_id === "zhejiang_university_research_lead")) {
  throw new Error("Queue must preserve the Zhejiang University lead as an unverified research item.");
}
if (!queue.sourceCandidates.every((candidate) => candidate.source_card.review.accepted === false)) {
  throw new Error("Research intake queue must not accept source candidates.");
}
if (!queue.sourceCandidates.every((candidate) => candidate.source_card.review.review_only === true)) {
  throw new Error("Research intake queue must keep every source candidate review-only.");
}
if (queue.sourceCandidates.find((candidate) => candidate.candidate_id === "zhejiang_university_research_lead")?.source_card.trust_level !== "unverified") {
  throw new Error("Zhejiang University lead must stay unverified until primary-source research.");
}
if (queue.locks.ruleEnabled !== false || queue.locks.softwareActionsExecuted !== false || queue.locks.packagingGated !== true) {
  throw new Error("Research intake queue must keep rule, execution, and packaging locks closed.");
}
if (!queue.forbiddenActions.includes("treat_unverified_leads_as_citations")) {
  throw new Error("Queue must explicitly block treating unverified leads as citations.");
}
if (retrievalPacket.status !== "evidence_found") {
  throw new Error("The adviser note corpus should be locally retrievable.");
}
if (retrievalPacket.locks.can_enable_rules !== false || retrievalPacket.locks.can_execute_target_software !== false) {
  throw new Error("Retrieval from the research intake corpus must preserve evidence-only locks.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_research_intake_queue_smoke_v1",
      queuePath: result.queuePath,
      readmePath: result.readmePath,
      corpusIndexPath: queue.corpus.indexPath,
      sourceCandidates: queue.sourceCandidates.length,
      retrievalStatus: retrievalPacket.status,
      locks: queue.locks
    },
    null,
    2
  )
);
