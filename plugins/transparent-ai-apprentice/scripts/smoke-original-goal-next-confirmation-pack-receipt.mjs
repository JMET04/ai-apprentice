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

function runScript(script, args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${script} unexpectedly succeeded`);
    return { ...JSON.parse(result.stdout.replace(/^\uFEFF/, "")), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-next-confirmation-pack-receipt-smoke", String(Date.now()))
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
  packId: "smoke-next-confirmation-pack",
  status: "waiting_for_teacher_next_confirmation_review",
  counts: {
    confirmationItems: 2
  },
  confirmationItems: [
    {
      order: 1,
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      title: "Approve or reject compact metadata-only evidence for 10 low-token rows",
      openPath: compactHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-compact-evidence-request-receipt.mjs --request-pack fixture.json --receipt <teacher-filled-compact-evidence-request-receipt.json>",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["approve_compact_metadata_request", "keep_blocked", "request_narrower_metadata_request"],
      locks: {
        reviewOnly: true,
        executeNow: false
      }
    },
    {
      order: 2,
      itemId: "transparent-overlay-real-teacher-packet",
      title: "Attach a real teacher-exported transparent sketch packet and detail-logic validation",
      openPath: spatialHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request fixture.json --receipt <teacher-filled-spatial-intent-evidence-receipt.json>",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["provide_real_overlay_packet", "request_spatial_correction", "keep_blocked"],
      locks: {
        reviewOnly: true,
        executeNow: false
      }
    }
  ],
  blockedActions: ["claim_original_goal_complete"],
  locks: {
    reviewOnly: true,
    accepted: false,
    goalComplete: false
  }
});

const templatePath = writeJson(join(smokeRoot, "receipts", "teacher-next-confirmation-pack-receipt-template.json"), {
  format: "transparent_ai_original_goal_next_confirmation_pack_receipt_v1",
  packId: "smoke-next-confirmation-pack",
  decision: "needs_teacher_review",
  itemDecisions: [
    {
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      teacherDecision: "needs_teacher_review",
      reviewedOpenPath: false,
      reviewedValidationCommand: false,
      teacherNote: ""
    },
    {
      itemId: "transparent-overlay-real-teacher-packet",
      teacherDecision: "needs_teacher_review",
      reviewedOpenPath: false,
      reviewedValidationCommand: false,
      teacherNote: ""
    }
  ],
  locks: {
    reviewOnly: true,
    goalComplete: false
  }
});
const template = readJson(templatePath);

const goodReceiptPath = writeJson(join(smokeRoot, "receipts", "good-receipt.json"), {
  ...template,
  itemDecisions: [
    {
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      teacherDecision: "approve_compact_metadata_request",
      reviewedOpenPath: true,
      reviewedValidationCommand: true,
      teacherNote: "compact metadata request reviewed"
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
const forbiddenReceiptPath = writeJson(join(smokeRoot, "receipts", "forbidden-receipt.json"), {
  ...template,
  decision: "claim_complete",
  itemDecisions: [
    {
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      teacherDecision: "execute_now",
      reviewedOpenPath: true,
      reviewedValidationCommand: true,
      teacherNote: "unsafe fixture"
    }
  ]
});
const missingReviewReceiptPath = writeJson(join(smokeRoot, "receipts", "missing-review-receipt.json"), {
  ...template,
  itemDecisions: [
    {
      itemId: "low-token-compact-evidence-10-metadata-only-rows",
      teacherDecision: "approve_compact_metadata_request",
      reviewedOpenPath: false,
      reviewedValidationCommand: false,
      teacherNote: ""
    }
  ]
});

const goodResult = runScript("validate-original-goal-next-confirmation-pack-receipt.mjs", [
  "--goal",
  "smoke validate next confirmation pack receipt",
  "--pack",
  packPath,
  "--receipt",
  goodReceiptPath,
  "--output-dir",
  join(smokeRoot, "good-validation")
]);
const goodValidation = readJson(goodResult.validationPath);
const defaultResult = runScript("validate-original-goal-next-confirmation-pack-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  templatePath,
  "--output-dir",
  join(smokeRoot, "default-validation")
]);
const defaultValidation = readJson(defaultResult.validationPath);
const forbiddenResult = runScript("validate-original-goal-next-confirmation-pack-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });
const forbiddenValidation = readJson(forbiddenResult.validationPath);
const missingReviewResult = runScript("validate-original-goal-next-confirmation-pack-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  missingReviewReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-review-validation")
]);
const missingReviewValidation = readJson(missingReviewResult.validationPath);

const checks = [
  check(
    "Next confirmation pack receipt validation produces review-only source validation queue after teacher review",
    goodValidation.format === "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_v1" &&
      goodValidation.status === "validated_with_next_confirmation_review_queue" &&
      goodValidation.validationDecision === "some_items_ready_for_source_receipt_validation" &&
      goodValidation.counts.readyRows === 1 &&
      goodValidation.nextReviewQueue.length === 1 &&
      goodValidation.nextReviewQueue[0].handoffKind === "source_receipt_validation" &&
      goodValidation.nextReviewQueue[0].commandExecutableNow === false &&
      goodValidation.locks.validationDoesNotExecuteCommands === true &&
      goodValidation.locks.validationDoesNotReadFullLogs === true &&
      goodValidation.locks.goalComplete === false,
    goodResult.validationPath
  ),
  check(
    "Next confirmation pack receipt validation keeps default receipt waiting",
    defaultValidation.status === "waiting_for_teacher_next_confirmation_review" &&
      defaultValidation.validationDecision === "needs_teacher_review" &&
      defaultValidation.counts.readyRows === 0 &&
      defaultValidation.nextReviewQueue.length === 0,
    defaultResult.validationPath
  ),
  check(
    "Next confirmation pack receipt validation fails closed on forbidden completion or execution decisions",
    forbiddenResult.failedAsExpected === true &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.locks.validationDoesNotExecuteTargetSoftware === true,
    forbiddenResult.validationPath
  ),
  check(
    "Next confirmation pack receipt validation blocks advance without explicit teacher review flags",
    missingReviewValidation.status === "waiting_for_teacher_next_confirmation_review" &&
      missingReviewValidation.counts.readyRows === 0 &&
      missingReviewValidation.validationRows[0].status === "blocked_for_missing_teacher_review_flags" &&
      missingReviewValidation.locks.validationDoesNotWriteMemory === true,
    missingReviewResult.validationPath
  ),
  check(
    "Next confirmation pack receipt validation writes visible start files",
    existsSync(goodResult.readmePath) &&
      readFileSync(goodResult.readmePath, "utf8").includes("Original Goal Next Confirmation Pack Receipt Validation"),
    goodResult.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const result = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_next_confirmation_pack_receipt_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    goodValidation: goodResult.validationPath,
    defaultValidation: defaultResult.validationPath,
    forbiddenValidation: forbiddenResult.validationPath,
    missingReviewValidation: missingReviewResult.validationPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
