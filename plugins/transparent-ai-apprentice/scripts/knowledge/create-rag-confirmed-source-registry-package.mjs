#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const validationPath = resolve(arg("--validation", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-confirmed-source-registry-package")));

if (!validationPath) {
  throw new Error(
    "Usage: node create-rag-confirmed-source-registry-package.mjs --validation <rag-research-intake-or-primary-source-validation.json> [--out-dir <dir>]"
  );
}

const validation = readJson(validationPath);
const supportedValidation = {
  transparent_ai_rag_research_intake_receipt_validation_v1: {
    readyStatus: "ready_for_review_only_confirmed_source_ingest",
    followUpKind: "research_intake_confirmed_sources"
  },
  transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1: {
    readyStatus: "ready_for_review_only_primary_source_registry_follow_up",
    followUpKind: "primary_source_evidence_follow_up"
  }
}[validation.format];

if (!supportedValidation) {
  throw new Error(
    "Expected transparent_ai_rag_research_intake_receipt_validation_v1 or transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1."
  );
}
if (validation.status !== supportedValidation.readyStatus) {
  throw new Error(`Receipt validation is not ready for confirmed source ingest: ${validation.status}`);
}
if (!Array.isArray(validation.confirmedSources) || validation.confirmedSources.length === 0) {
  throw new Error("No confirmed sources available for registry package.");
}
if (
  validation.locks?.reviewOnly !== true ||
  validation.locks?.accepted !== false ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.memoryEnabled !== false ||
  validation.locks?.softwareActionsExecuted !== false ||
  validation.locks?.externalFetchPerformed !== false ||
  validation.locks?.packagingUnlocked !== false
) {
  throw new Error("Confirmed source registry package requires locked review-only validation.");
}

const packageId = stableId("rag_confirmed_source_registry", validationPath);
const packageDir = join(outDir, packageId);
mkdirSync(packageDir, { recursive: true });
const planningLogicEvidence = validation.planningLogicEvidence || null;
const planningLogicEvidenceHash = validation.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = validation.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = validation.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_SOURCE_REGISTRY_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}

function normalizeLocalPath(uri) {
  if (String(uri).startsWith("file://")) return decodeURIComponent(String(uri).replace(/^file:\/+/, ""));
  if (/^[A-Za-z]:\\/.test(String(uri)) || String(uri).startsWith("/")) return String(uri);
  return "";
}

function commandLine(scriptName, args) {
  return [
    "node",
    `plugins\\transparent-ai-apprentice\\scripts\\knowledge\\${scriptName}`,
    ...args.map(([flag, value]) => `${flag} "${String(value).replace(/"/g, '\\"')}"`)
  ].join(" ");
}

const sourceRows = validation.confirmedSources.map((source) => {
  const localPath = normalizeLocalPath(source.uri);
  const isHttp = /^https?:\/\//.test(String(source.uri));
  const localReadable = localPath ? existsSync(localPath) : false;
  const supportedText = localReadable && [".md", ".markdown", ".txt", ".json"].includes(extname(localPath).toLowerCase());
  const ingestStatus = supportedText
    ? "ready_for_review_only_local_corpus_ingest"
    : isHttp
      ? "external_reference_registered_no_fetch"
      : "registered_but_source_file_unavailable";
  return {
    sourceId: source.source_id,
    title: source.title,
    uri: source.uri,
    sourceType: source.source_type,
    domain: source.domain,
    trustLevel: source.trust_level,
    permissionStatus: source.permission?.status || "unknown",
    logicExtractionHint: source.review?.logic_extraction_hint || "",
    reviewOnly: source.review?.review_only === true,
    accepted: false,
    packagingGated: true,
    localReadable,
    supportedText,
    ingestStatus,
    ingestCommand: supportedText
      ? commandLine("ingest-local-corpus.mjs", [
          ["--source", localPath],
          ["--out-dir", join(packageDir, "corpus", source.source_id)],
          ["--source-id-prefix", `confirmed.${source.source_id}`],
          ["--source-type", source.source_type],
          ["--domain", source.domain]
        ])
      : "",
    blockedReason: supportedText
      ? ""
      : isHttp
        ? "External source registered only. Fetching or quoting it requires a separate teacher/research approval step."
        : "Source URI is not a readable supported local text file."
  };
});

const packagePacket = {
  format: "transparent_ai_rag_confirmed_source_registry_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  validationPath,
  validationFormat: validation.format,
  sourceRegistryFollowUpKind: supportedValidation.followUpKind,
  validationHash: hashText(JSON.stringify(validation)),
  planningLogicEvidence,
  planningLogicEvidenceHash,
  sourceCount: sourceRows.length,
  readyLocalIngestCount: sourceRows.filter((row) => row.ingestStatus === "ready_for_review_only_local_corpus_ingest").length,
  externalReferenceCount: sourceRows.filter((row) => row.ingestStatus === "external_reference_registered_no_fetch").length,
  confirmedSourceCardsPath: join(packageDir, "confirmed-knowledge-source-cards.json"),
  sourceRegistryPath: join(packageDir, "rag-confirmed-source-registry.json"),
  sourceRows,
  nextReview: {
    instruction: "Review confirmed source cards, then run only the prepared local ingest commands for readable local sources.",
    stopCondition: "Stop if a source URI, trust level, permission status, or review note no longer matches the teacher/research receipt.",
    mayFetchExternalSources: false,
    mayEnableRules: false,
    mayExecuteSoftware: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    planningLogicEvidence,
    planningLogicEvidenceHash
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

writeJson(packagePacket.confirmedSourceCardsPath, validation.confirmedSources);
writeJson(packagePacket.sourceRegistryPath, packagePacket);

const readmePath = join(packageDir, "RAG_CONFIRMED_SOURCE_REGISTRY_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Confirmed Source Registry",
    "",
    "This package records teacher/researcher-confirmed knowledge source cards from a validated RAG receipt.",
    "",
    `- Registry: ${packagePacket.sourceRegistryPath}`,
    `- Confirmed source cards: ${packagePacket.confirmedSourceCardsPath}`,
    `- Validation: ${validationPath}`,
    `- Follow-up kind: ${supportedValidation.followUpKind}`,
    "",
    "## Safe Next Step",
    "",
    "Run only the prepared local ingest commands for rows marked `ready_for_review_only_local_corpus_ingest`.",
    "",
    "External references are registered only. This package does not fetch websites, cite unverified leads, enable rules, write memory, execute software, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: packagePacket.format,
      sourceRegistryPath: packagePacket.sourceRegistryPath,
      confirmedSourceCardsPath: packagePacket.confirmedSourceCardsPath,
      readmePath,
      sourceCount: packagePacket.sourceCount,
      readyLocalIngestCount: packagePacket.readyLocalIngestCount,
      locks: packagePacket.locks
    },
    null,
    2
  )
);
