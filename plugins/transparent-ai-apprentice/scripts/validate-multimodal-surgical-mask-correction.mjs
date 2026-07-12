#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function addCheck(checks, name, pass, evidence) {
  checks.push({ name, pass: Boolean(pass), evidence });
}

export function validateMultimodalSurgicalMask(packet) {
  const checks = [];
  const targets = Array.isArray(packet?.modificationTargets) ? packet.modificationTargets : [];
  const changeTargets = Array.isArray(packet?.changeTargets) ? packet.changeTargets : [];
  const contract = packet?.surgicalEditContract || {};
  const locks = packet?.locks || {};

  addCheck(checks, "Packet uses the multimodal surgical mask contract", packet?.modificationFormat === "mingtu_multimodal_surgical_mask_correction_v1", packet?.modificationFormat);
  addCheck(checks, "Content type is text image or engineering", ["text", "image", "engineering"].includes(packet?.activeContentType), packet?.activeContentType);
  addCheck(checks, "At least one exact change target exists", changeTargets.length > 0 && changeTargets.every((target) => target.role === "change"), `changeTargets=${changeTargets.length}`);
  addCheck(checks, "Every change target has complete teacher evidence", changeTargets.length > 0 && changeTargets.every((target) => target.completeness?.complete === true), changeTargets.filter((target) => !target.completeness?.complete).map((target) => `${target.id}:${target.completeness?.reason}`).join(", ") || "complete");
  addCheck(checks, "Every mask preserves content outside its boundary", targets.every((target) => target.preserveOutsideThisMask === true), `targets=${targets.length}`);
  addCheck(checks, "Surgical contract changes only selected targets", contract.changeOnlyInsideSelectedTargets === true && contract.preserveAllUnmarkedContent === true, JSON.stringify({ changeOnlyInsideSelectedTargets: contract.changeOnlyInsideSelectedTargets, preserveAllUnmarkedContent: contract.preserveAllUnmarkedContent }));
  addCheck(checks, "Before/after validation rejects unmarked changes", contract.validation?.beforeAfterComparisonRequired === true && contract.validation?.rejectIfUnmarkedContentChanged === true, JSON.stringify(contract.validation || {}));
  addCheck(checks, "Full regeneration requires explicit teacher policy", contract.policy === "teacher_requested_regeneration" ? contract.fullRegenerationAllowed === true : contract.fullRegenerationAllowed === false, `policy=${contract.policy}; fullRegenerationAllowed=${contract.fullRegenerationAllowed}`);

  const textTargets = changeTargets.filter((target) => target.contentType === "text");
  addCheck(checks, "Text replacement targets keep native locator exact source and replacement text", textTargets.every((target) => target.editIntent?.sourceText && (target.editIntent.documentType === "plain_text" || target.editIntent?.locator) && (target.editIntent.operation !== "replace" || target.editIntent?.replacementText)), `textTargets=${textTargets.length}`);
  const engineeringTargets = changeTargets.filter((target) => target.contentType === "engineering");
  addCheck(checks, "Engineering targets bind an object id and exact parameter when needed", engineeringTargets.every((target) => target.editIntent?.objectId && (target.editIntent.action !== "change_dimension" || (target.editIntent?.expectedValue && target.editIntent?.unit))), `engineeringTargets=${engineeringTargets.length}`);
  addCheck(checks, "Engineering values never come from pixels", engineeringTargets.every((target) => target.editIntent?.dimensionsMayNotBeInferredFromPixels === true), `engineeringTargets=${engineeringTargets.length}`);
  addCheck(checks, "Review locks prove no software or memory side effects", locks.accepted === false && locks.ruleEnabled === false && locks.packagingGated === true && locks.softwareActionsExecuted === false && locks.targetSoftwareCommandsExecuted === false && locks.uiEventsSent === false && locks.memoryWritten === false, JSON.stringify(locks));

  const failed = checks.filter((check) => !check.pass);
  return {
    format: "mingtu_multimodal_surgical_mask_validation_v1",
    status: failed.length ? "blocked" : "passed_review_contract",
    passed: failed.length === 0,
    checks,
    failedChecks: failed.map((check) => check.name),
    contentType: packet?.activeContentType || null,
    targetCount: targets.length,
    changeTargetCount: changeTargets.length,
    readyForTeacherReviewedAdapterPlanning: failed.length === 0,
    readyForExecution: false,
    locks: {
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      softwareActionsExecuted: false,
      memoryWritten: false
    }
  };
}

function main() {
  const inputPath = argValue("--input");
  if (!inputPath) throw new Error("--input <mask-correction.json> is required");
  const packet = JSON.parse(readFileSync(resolve(inputPath), "utf8").replace(/^\uFEFF/, ""));
  const result = validateMultimodalSurgicalMask(packet);
  const outputPath = argValue("--output");
  if (outputPath) writeFileSync(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
