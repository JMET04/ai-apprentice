#!/usr/bin/env node
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { semanticPreflight } from "./aicad-handoff-adapter.mjs";
import { reviewMaskCorrection, submitMaskCorrection, validateMaskCorrectionPacket } from "./mask-correction-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".ta-smoke", "product-failure-matrix");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const pythonTemp = join(root, "temp");
mkdirSync(pythonTemp, { recursive: true });
const officeEditor = join(__dirname, "surgical-office-text-edit.py");
const aicadAdapter = join(__dirname, "aicad-object-mask-adapter.mjs");
const sourcePlan = join(pluginRoot, "assets", "examples", "aicad-object-mask-source.plan.json");
const packagingImage = join(pluginRoot, "assets", "examples", "engineering-object-index.png");
const storePath = join(root, "mask-store.json");
const scenarios = [];

function shaFile(path) {
  return crypto.createHash("sha256").update(readFileSync(path)).digest("hex");
}

function scenario(category, name, blocked, evidence) {
  scenarios.push({ category, name, expected: "blocked", pass: Boolean(blocked), evidence });
}

function runPython(args) {
  const result = spawnSync("python", ["-B", officeEditor, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1", TEMP: pythonTemp, TMP: pythonTemp }
  });
  return { result, payload: JSON.parse(result.stdout || "{}") };
}

function request(documentType, locator, sourceText, replacementText, id, operation = "replace") {
  const target = {
    id,
    contentType: "text",
    role: "change",
    editIntent: {
      kind: "text_edit", documentType, locator, operation, sourceText, replacementText,
      sourceTextConfirmedByTeacher: true, requiresExactTextMatch: true
    },
    preserveOutsideThisMask: true,
    teacherReviewRequired: true,
    completeness: { complete: true, reason: "exact_source_and_text_operation_present" }
  };
  return {
    format: "transparent_ai_sketch_overlay_packet_v1",
    modificationFormat: "transparent_ai_apprentice_multimodal_surgical_mask_correction_v1",
    changeTargets: [target],
    surgicalEditContract: { changeOnlyInsideSelectedTargets: true },
    locks: { accepted: false, ruleEnabled: false, packagingGated: true }
  };
}

function officeCase(name, packet, input, output = join(root, `${scenarios.length}-${name}.out`)) {
  const requestPath = join(root, `${scenarios.length}-${name}.json`);
  writeFileSync(requestPath, JSON.stringify(packet, null, 2), "utf8");
  const run = runPython(["--request", requestPath, "--input", input, "--output", output]);
  scenario("office", name, run.result.status !== 0 && run.payload.status === "blocked", run.payload.error || run.result.stderr);
}

const fixtures = runPython(["--create-test-fixtures", join(root, "fixtures")]).payload;
if (![fixtures.docx, fixtures.xlsx, fixtures.complexDocx, fixtures.complexXlsx].every(path => existsSync(path))) {
  throw new Error("Real Office fixtures were not created.");
}

officeCase("source overwrite", request("word_docx", "paragraph:2", "周五", "周一", "o1"), fixtures.docx, fixtures.docx);
officeCase("invalid Word locator syntax", request("word_docx", "page:1", "项目", "任务", "o2"), fixtures.docx);
officeCase("Word paragraph zero", request("word_docx", "paragraph:0", "项目", "任务", "o3"), fixtures.docx);
officeCase("Word paragraph out of range", request("word_docx", "paragraph:99", "项目", "任务", "o4"), fixtures.docx);
officeCase("Word table out of range", request("word_docx", "table:9/row:1/cell:1/paragraph:1", "审核中", "已审核", "o5"), fixtures.complexDocx);
officeCase("Word table row out of range", request("word_docx", "table:1/row:9/cell:1/paragraph:1", "审核中", "已审核", "o6"), fixtures.complexDocx);
officeCase("Word table cell out of range", request("word_docx", "table:1/row:1/cell:9/paragraph:1", "审核中", "已审核", "o7"), fixtures.complexDocx);
officeCase("Word table paragraph out of range", request("word_docx", "table:1/row:1/cell:1/paragraph:9", "审核中", "已审核", "o8"), fixtures.complexDocx);
officeCase("Word source mismatch", request("word_docx", "paragraph:2", "不存在", "不应写入", "o9"), fixtures.docx);
officeCase("Word format-only unsupported", request("word_docx", "paragraph:2", "周五", "周一", "o10", "format"), fixtures.docx);
officeCase("invalid Excel locator syntax", request("excel_xlsx", "B2", "待处理", "已完成", "o11"), fixtures.xlsx);
officeCase("Excel worksheet missing", request("excel_xlsx", "不存在!B2", "待处理", "已完成", "o12"), fixtures.xlsx);
officeCase("Excel cell missing", request("excel_xlsx", "进度表!Z99", "待处理", "已完成", "o13"), fixtures.xlsx);
officeCase("Excel merged non-anchor", request("excel_xlsx", "进度表!B1", "待处理", "不应写入", "o14"), fixtures.complexXlsx);
officeCase("Excel formula cell", request("excel_xlsx", "进度表!C1", "2", "3", "o15"), fixtures.complexXlsx);
officeCase("Office document type mismatch", request("word_docx", "paragraph:2", "周五", "周一", "o16"), fixtures.xlsx);

function engineeringPacket({ objectId = "D04", value = 450, unit = "mm", protect = ["D08", "D10"], action = "set_dimension" } = {}) {
  return {
    format: "transparent_ai_apprentice_multimodal_surgical_mask_correction_v1",
    surfaceKind: "engineering_native_object",
    target: { objectType: "尺寸标注", objectId, action, targetValue: value, unit },
    maskSemantics: { modify: [{ id: `change-${objectId}-${value}` }], protect: [], reference: [] },
    invariants: { protectObjectIds: protect },
    reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true
  };
}

function runCad(id, source = sourcePlan) {
  return spawnSync(process.execPath, [
    aicadAdapter, "--action", "apply", "--correction-id", id, "--store", storePath,
    "--source-plan", source, "--output-dir", join(root, "cad", id)
  ], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
}

function reviewedCad(packet) {
  const record = submitMaskCorrection({ packet, storePath });
  reviewMaskCorrection({ id: record.id, decision: "approved_for_separate_execution", storePath });
  return record.id;
}

const unreviewed = submitMaskCorrection({ packet: engineeringPacket({ value: 441 }), storePath });
let cad = runCad(unreviewed.id);
scenario("cad", "unreviewed correction", cad.status !== 0 && /teacher-reviewed/.test(cad.stderr), cad.stderr);
cad = runCad(reviewedCad(engineeringPacket({ objectId: "D99", value: 442 })));
scenario("cad", "target object missing", cad.status !== 0 && /Target object not found/.test(cad.stderr), cad.stderr);
cad = runCad(reviewedCad(engineeringPacket({ value: 443, protect: ["D99"] })));
scenario("cad", "protected object missing", cad.status !== 0 && /Protected object not found/.test(cad.stderr), cad.stderr);
cad = runCad(reviewedCad(engineeringPacket({ value: 444, unit: "cm" })));
scenario("cad", "unit mismatch", cad.status !== 0 && /Unit mismatch/.test(cad.stderr), cad.stderr);
cad = runCad(reviewedCad(engineeringPacket({ value: 0 })));
scenario("cad", "nonpositive dimension", cad.status !== 0 && /positive and finite/.test(cad.stderr), cad.stderr);
cad = runCad(reviewedCad(engineeringPacket({ value: 445, action: "move_object" })));
scenario("cad", "unsupported engineering action", cad.status !== 0 && /does not support action/.test(cad.stderr), cad.stderr);
cad = runCad(reviewedCad(engineeringPacket({ value: 446 })), join(root, "missing.plan.json"));
scenario("cad", "source engineering plan missing", cad.status !== 0 && /Source AICAD plan not found/.test(cad.stderr), cad.stderr);

const unsafeMask = engineeringPacket({ value: 447 });
unsafeMask.accepted = true;
scenario("mask", "unsafe accepted flag", !validateMaskCorrectionPacket(unsafeMask).ok, validateMaskCorrectionPacket(unsafeMask).errors.join("; "));
const emptyMask = engineeringPacket({ value: 448 });
emptyMask.maskSemantics.modify = [];
scenario("mask", "missing modification mask", !validateMaskCorrectionPacket(emptyMask).ok, validateMaskCorrectionPacket(emptyMask).errors.join("; "));

const packagingImageSha256 = shaFile(packagingImage);
function packagingRequest() {
  return {
    format: "transparent_ai_apprentice_aicad_request_v1",
    handoffId: "failure-matrix",
    safety: { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true, productionApprovalClaimed: false },
    engineeringTruth: { imagePixelsUsedAsDimensions: false },
    evidence: { image2Sample: { path: packagingImage, sha256: packagingImageSha256, role: "visual_topology_only", pixelMeasurementsAllowed: false } },
    product: { dimensions: [{ name: "length", value: 200, unit: "mm", authority: "teacher_explicit" }] },
    localModifications: [{ id: "D04", requiredGlobalRevalidation: true }]
  };
}
function preflightCase(name, mutate, expected) {
  const value = packagingRequest();
  mutate(value);
  let error = "";
  try { semanticPreflight(value); } catch (caught) { error = caught.message; }
  scenario("packaging", name, error.includes(expected), error);
}
preflightCase("image pixels used as dimensions", value => { value.engineeringTruth.imagePixelsUsedAsDimensions = true; }, "PIXEL_DIMENSION_FORBIDDEN");
preflightCase("invalid Image2 evidence role", value => { value.evidence.image2Sample.role = "dimension_authority"; }, "IMAGE2_ROLE_INVALID");
preflightCase("untrusted dimension authority", value => { value.product.dimensions[0].authority = "image_pixel"; }, "UNTRUSTED_DIMENSION_AUTHORITY");
preflightCase("local edit missing global revalidation", value => { value.localModifications[0].requiredGlobalRevalidation = false; }, "GLOBAL_REVALIDATION_REQUIRED");

const failed = scenarios.filter(item => !item.pass);
const byCategory = Object.fromEntries([...new Set(scenarios.map(item => item.category))].map(category => [category, scenarios.filter(item => item.category === category).length]));
const report = {
  format: "ai_apprentice_product_failure_matrix_v1",
  status: failed.length ? "failed" : "passed",
  expectedBlockedScenarios: scenarios.length,
  passed: scenarios.length - failed.length,
  failed: failed.length,
  byCategory,
  realArtifacts: { office: fixtures, aicadPlan: sourcePlan, packagingImage, packagingImageSha256 },
  scenarios
};
writeFileSync(join(root, "failure-matrix-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length || scenarios.length < 20 || scenarios.length > 30) process.exit(1);
