#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const knowledgeRoot = join(pluginRoot, "scripts", "knowledge");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.name.endsWith(".mjs") ? [fullPath] : [];
  });
}

const nextReviewHashPattern =
  /["']([A-Z0-9_]*(?:NEXT_REVIEW|NEXT_REVIEW_LOGIC|NEXT_REVIEW_PLANNING)[A-Z0-9_]*HASH_MISMATCH)["']/g;

const sourceFiles = walk(knowledgeRoot);
const errorCodes = [
  ...new Set(
    sourceFiles.flatMap((filePath) => {
      const text = readFileSync(filePath, "utf8");
      return [...text.matchAll(nextReviewHashPattern)].map((match) => match[1]);
    })
  )
].sort();

const coverageTargets = [
  "README.md",
  "KNOWLEDGE_AUGMENTED_RAG_RESEARCH_DIRECTION.md",
  "scripts/verify-plugin.mjs",
  "scripts/smoke-goal-coverage.mjs"
].map((targetPath) => ({
  path: targetPath,
  text: readFileSync(join(pluginRoot, targetPath), "utf8")
}));

const missingCoverage = [];
for (const errorCode of errorCodes) {
  for (const target of coverageTargets) {
    if (!target.text.includes(errorCode)) {
      missingCoverage.push({
        errorCode,
        missingTarget: target.path
      });
    }
  }
}

if (errorCodes.length === 0) {
  throw new Error("RAG_NEXT_REVIEW_HASH_COVERAGE_AUDIT_FOUND_NO_ERROR_CODES");
}

if (missingCoverage.length > 0) {
  throw new Error(
    [
      "RAG_NEXT_REVIEW_HASH_COVERAGE_AUDIT_MISSING_TARGETS",
      JSON.stringify(missingCoverage, null, 2)
    ].join("\n")
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_next_review_hash_coverage_audit_smoke_v1",
      scannedKnowledgeFiles: sourceFiles.map((filePath) => relative(pluginRoot, filePath).replaceAll("\\", "/")),
      coveredErrorCodes: errorCodes,
      coverageTargets: coverageTargets.map((target) => target.path),
      missingCoverage,
      locks: {
        reviewOnly: true,
        evidenceOnly: true,
        externalFetchPerformed: false,
        softwareActionsExecuted: false,
        memoryWritten: false,
        ruleEnabled: false,
        packagingUnlocked: false,
        deliveryGateOpen: false
      }
    },
    null,
    2
  )
);
