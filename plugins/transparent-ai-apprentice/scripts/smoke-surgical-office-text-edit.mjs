#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMultimodalSurgicalMask } from "./validate-multimodal-surgical-mask-correction.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeParent = join(repoRoot, ".ta-smoke");
mkdirSync(smokeParent, { recursive: true });
const root = mkdtempSync(join(smokeParent, "mingtu-office-surgical-edit-"));
const editor = join(__dirname, "surgical-office-text-edit.py");
const checks = [];

function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

function runPython(args, expectSuccess = true) {
  const result = spawnSync("python", ["-B", editor, ...args], { encoding: "utf8", timeout: 120000, env: { ...process.env, PYTHONUTF8: "1" } });
  const payload = JSON.parse((result.stdout || "{}").replace(/^\uFEFF/, ""));
  if (expectSuccess && result.status !== 0) throw new Error(result.stderr || result.stdout || "Office surgical editor failed");
  return { result, payload };
}

function request(contentType, locator, sourceText, replacementText, targetId) {
  const target = {
    id: targetId,
    contentType: "text",
    role: "change",
    label: `${locator}: ${sourceText} -> ${replacementText}`,
    maskGeometry: { kind: "rect", box: [0.2, 0.2, 0.7, 0.3], points: [], coordinateUnits: "normalized_0_to_1" },
    editIntent: {
      kind: "text_edit",
      documentType: contentType,
      locator,
      operation: "replace",
      sourceText,
      replacementText,
      typographyNote: "preserve existing style",
      sourceTextConfirmedByTeacher: true,
      requiresExactTextMatch: true
    },
    preserveOutsideThisMask: true,
    teacherReviewRequired: true,
    completeness: { complete: true, reason: "exact_source_and_text_operation_present" }
  };
  return {
    format: "transparent_ai_sketch_overlay_packet_v1",
    workbenchFormat: "mingtu_teacher_mask_correction_v1",
    modificationFormat: "mingtu_multimodal_surgical_mask_correction_v1",
    activeContentType: "text",
    supportedContentTypes: ["text", "image", "engineering"],
    modificationTargets: [target],
    changeTargets: [target],
    preservationRegions: [],
    surgicalEditContract: {
      format: "mingtu_surgical_edit_contract_v1",
      policy: "surgical_only",
      selectedChangeTargetIds: [targetId],
      explicitProtectionRegionIds: [],
      globalPreserveInstruction: "Preserve every unselected paragraph, cell, style, formula, and package part.",
      changeOnlyInsideSelectedTargets: true,
      preserveAllUnmarkedContent: true,
      fullRegenerationAllowed: false,
      localEditFailureBehavior: "block_and_return_to_teacher_without_regenerating",
      validation: {
        textOutsideTargets: "exact_text_and_style_match_required",
        imageOutsideTargets: "not_applicable",
        engineeringOutsideTargets: "not_applicable",
        beforeAfterComparisonRequired: true,
        rejectIfUnmarkedContentChanged: true
      }
    },
    teacherCorrection: {
      requestedEditMode: "text_region_edit_only",
      editScopePolicy: "surgical_only",
      preserveUnmarkedRegions: true,
      rejectWholeArtifactReplacementForLocalIssue: true
    },
    proposedSoftwareAction: {
      executionMode: "teacher_review_only",
      nativeExecutionImplemented: false,
      targetIds: [targetId],
      fullArtifactReplacementPrepared: false
    },
    locks: {
      ruleEnabled: false,
      accepted: false,
      technologyAccepted: false,
      packagingGated: true,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      memoryWritten: false
    }
  };
}

const fixtures = runPython(["--create-test-fixtures", join(root, "fixtures")]).payload;
check("Portable test fixtures are created without Office dependencies", existsSync(fixtures.docx) && existsSync(fixtures.xlsx), JSON.stringify(fixtures));

const docxRequest = request("word_docx", "paragraph:2", "周五", "周一", "word-paragraph-2");
const docxValidation = validateMultimodalSurgicalMask(docxRequest);
check("Word mask contract validates before editing", docxValidation.passed, JSON.stringify(docxValidation.failedChecks));
const docxRequestPath = join(root, "word-request.json");
const docxOutput = join(root, "word-edited.docx");
writeFileSync(docxRequestPath, JSON.stringify(docxRequest, null, 2), "utf8");
const docxRun = runPython(["--request", docxRequestPath, "--input", fixtures.docx, "--output", docxOutput]).payload;
check("Word edits only the confirmed paragraph text", docxRun.targetedEdit.targetBefore.includes("周五") && docxRun.targetedEdit.targetAfter.includes("周一"), JSON.stringify(docxRun.targetedEdit));
check("Word source file stays untouched", docxRun.verification.originalFileUnchanged && docxRun.locks.sourceOverwritten === false, docxRun.sourceFileSha256Before);
check("Word package changes only document.xml", docxRun.changedPackageParts.length === 1 && docxRun.changedPackageParts[0] === "word/document.xml", JSON.stringify(docxRun.changedPackageParts));
check("Word report narrows review to the target paragraph", docxRun.verification.fullDocumentRecheckRequired === false && docxRun.verification.reviewScope === "paragraph:2", JSON.stringify(docxRun.verification));

const xlsxRequest = request("excel_xlsx", "进度表!B2", "待处理", "已完成", "excel-progress-B2");
const xlsxValidation = validateMultimodalSurgicalMask(xlsxRequest);
check("Excel mask contract validates before editing", xlsxValidation.passed, JSON.stringify(xlsxValidation.failedChecks));
const xlsxRequestPath = join(root, "excel-request.json");
const xlsxOutput = join(root, "excel-edited.xlsx");
writeFileSync(xlsxRequestPath, JSON.stringify(xlsxRequest, null, 2), "utf8");
const xlsxRun = runPython(["--request", xlsxRequestPath, "--input", fixtures.xlsx, "--output", xlsxOutput]).payload;
check("Excel edits only the confirmed cell text", xlsxRun.targetedEdit.nativeTarget === "进度表!B2" && xlsxRun.targetedEdit.targetBefore === "待处理" && xlsxRun.targetedEdit.targetAfter === "已完成", JSON.stringify(xlsxRun.targetedEdit));
check("Excel source file stays untouched", xlsxRun.verification.originalFileUnchanged && xlsxRun.locks.sourceOverwritten === false, xlsxRun.sourceFileSha256Before);
check("Excel package changes only the selected worksheet XML", xlsxRun.changedPackageParts.length === 1 && xlsxRun.changedPackageParts[0] === "xl/worksheets/sheet1.xml", JSON.stringify(xlsxRun.changedPackageParts));
check("Excel report narrows review to the selected cell", xlsxRun.verification.fullDocumentRecheckRequired === false && xlsxRun.verification.reviewScope === "进度表!B2", JSON.stringify(xlsxRun.verification));

const badRequest = request("excel_xlsx", "进度表!B2", "不存在的原文", "不应写入", "excel-bad-source");
const badRequestPath = join(root, "bad-request.json");
const badOutput = join(root, "bad-output.xlsx");
writeFileSync(badRequestPath, JSON.stringify(badRequest, null, 2), "utf8");
const blocked = runPython(["--request", badRequestPath, "--input", fixtures.xlsx, "--output", badOutput], false);
check("Mismatched source text blocks instead of guessing or rewriting", blocked.result.status !== 0 && blocked.payload.status === "blocked" && !existsSync(badOutput), blocked.payload.error);

const failed = checks.filter((item) => !item.pass);
console.log(JSON.stringify({
  format: "mingtu_surgical_office_text_edit_smoke_v1",
  status: failed.length ? "failed" : "passed",
  root,
  passed: checks.length - failed.length,
  total: checks.length,
  checks
}, null, 2));
if (failed.length) process.exit(1);
