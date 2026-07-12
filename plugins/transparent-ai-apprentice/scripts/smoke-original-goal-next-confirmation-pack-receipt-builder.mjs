#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-next-confirmation-pack-receipt-builder-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const compactHtml = join(smokeRoot, "compact", "original-goal-low-token-compact-evidence-request-pack.html");
const spatialHtml = join(smokeRoot, "spatial", "spatial-intent-evidence-request.html");
mkdirSync(dirname(compactHtml), { recursive: true });
mkdirSync(dirname(spatialHtml), { recursive: true });
writeFileSync(compactHtml, "<!doctype html><title>compact</title>\n", "utf8");
writeFileSync(spatialHtml, "<!doctype html><title>spatial</title>\n", "utf8");

const packPath = writeJson(join(smokeRoot, "pack", "original-goal-next-confirmation-pack.json"), {
  ok: true,
  format: "transparent_ai_original_goal_next_confirmation_pack_v1",
  packId: "smoke-next-confirmation-pack-builder",
  status: "waiting_for_teacher_next_confirmation_review",
  confirmationItems: [
    {
      order: 1,
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      title: "Approve or reject compact metadata-only evidence for 10 low-token rows",
      whyItMatters: "low-token metadata first",
      openPath: compactHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-compact-evidence-request-receipt.mjs --request-pack fixture.json --receipt <teacher-filled-compact-evidence-request-receipt.json>",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["approve_compact_metadata_request", "keep_blocked"],
      stopIf: ["the receipt asks to read full logs"]
    },
    {
      order: 2,
      itemId: "transparent-overlay-real-teacher-packet",
      title: "Attach a real teacher-exported transparent sketch packet and detail-logic validation",
      whyItMatters: "transparent 2D perspective 3D packet",
      openPath: spatialHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request fixture.json --receipt <teacher-filled-spatial-intent-evidence-receipt.json>",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["provide_real_overlay_packet", "keep_blocked"],
      stopIf: ["the overlay packet is a placeholder"]
    }
  ],
  receiptTemplate: {
    format: "transparent_ai_original_goal_next_confirmation_pack_receipt_v1",
    packId: "smoke-next-confirmation-pack-builder",
    decision: "needs_teacher_review",
    itemDecisions: [],
    locks: {
      reviewOnly: true,
      goalComplete: false
    }
  },
  blockedActions: ["claim_original_goal_complete"],
  locks: {
    reviewOnly: true,
    goalComplete: false
  }
});

const builderResult = runScript("create-original-goal-next-confirmation-pack-receipt-builder.mjs", [
  "--goal",
  "smoke build next confirmation pack receipt",
  "--pack",
  packPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");

const defaultValidationResult = runScript("validate-original-goal-next-confirmation-pack-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  builderResult.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "default-validation")
]);
const defaultValidation = readJson(defaultValidationResult.validationPath);

const goodReceiptPath = writeJson(join(smokeRoot, "receipts", "good-receipt.json"), {
  ...template,
  itemDecisions: [
    {
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      teacherDecision: "approve_compact_metadata_request",
      reviewedOpenPath: true,
      reviewedValidationCommand: true,
      teacherNote: "teacher reviewed compact metadata source"
    },
    {
      itemId: "transparent-overlay-real-teacher-packet",
      teacherDecision: "needs_teacher_review",
      reviewedOpenPath: false,
      reviewedValidationCommand: false,
      teacherNote: ""
    }
  ]
});
const goodValidationResult = runScript("validate-original-goal-next-confirmation-pack-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  goodReceiptPath,
  "--output-dir",
  join(smokeRoot, "good-validation")
]);
const goodValidation = readJson(goodValidationResult.validationPath);

const checks = [
  check(
    "Next confirmation pack receipt builder creates browser receipt generator",
    builder.format === "transparent_ai_original_goal_next_confirmation_pack_receipt_builder_v1" &&
      builder.status === "waiting_for_teacher_next_confirmation_pack_receipt" &&
      builder.counts.reviewRows === 2 &&
      builder.counts.itemsWithValidationCommand === 2 &&
      builder.browserReceiptBuilder?.generatesReceiptJsonInBrowser === true &&
      builder.browserReceiptBuilder?.doesNotWriteReceiptToDisk === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.goalComplete === false,
    builderResult.builderPath
  ),
  check(
    "Next confirmation pack receipt builder writes usable HTML controls",
    existsSync(builderResult.htmlPath) &&
      html.includes("Original Goal Next Confirmation Pack Receipt Builder") &&
      html.includes("Generate reviewed receipt JSON") &&
      html.includes("Download receipt JSON") &&
      html.includes("Copy validation command") &&
      html.includes("original_goal_next_confirmation_pack_browser_receipt_builder"),
    builderResult.htmlPath
  ),
  check(
    "Next confirmation pack receipt builder template defaults stay review-only",
    template.format === "transparent_ai_original_goal_next_confirmation_pack_receipt_v1" &&
      template.decision === "needs_teacher_review" &&
      template.itemDecisions.length === 2 &&
      template.itemDecisions.every((row) => row.teacherDecision === "needs_teacher_review") &&
      template.locks.builderDoesNotReadFullLogs === true &&
      template.locks.goalComplete === false,
    builderResult.receiptTemplatePath
  ),
  check(
    "Default builder receipt validates to no queue",
    defaultValidation.status === "waiting_for_teacher_next_confirmation_review" &&
      defaultValidation.counts.readyRows === 0 &&
      defaultValidation.nextReviewQueue.length === 0,
    defaultValidationResult.validationPath
  ),
  check(
    "Teacher-reviewed builder receipt validates only to source receipt queue",
    goodValidation.status === "validated_with_next_confirmation_review_queue" &&
      goodValidation.counts.readyRows === 1 &&
      goodValidation.nextReviewQueue.length === 1 &&
      goodValidation.nextReviewQueue[0].commandExecutableNow === false &&
      goodValidation.locks.validationDoesNotExecuteCommands === true,
    goodValidationResult.validationPath
  )
];

const failed = checks.filter((item) => !item.pass);
const result = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_next_confirmation_pack_receipt_builder_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    template: builderResult.receiptTemplatePath,
    defaultValidation: defaultValidationResult.validationPath,
    goodValidation: goodValidationResult.validationPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
