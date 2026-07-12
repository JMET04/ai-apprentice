import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return file;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = process.cwd();
const smokeRoot = mkdtempSync(join(tmpdir(), "ta-compact-evidence-teacher-launchpad-"));
const requestHtml = join(smokeRoot, "request.html");
const builderHtml = join(smokeRoot, "builder.html");
const receiptTemplate = join(smokeRoot, "teacher-receipt-template.json");
const rollbackManifest = join(smokeRoot, "rollback-point.json");
const rollbackDir = join(smokeRoot, "rollback-point");
writeFileSync(requestHtml, "<!doctype html><title>request</title>", "utf8");
writeFileSync(builderHtml, "<!doctype html><title>builder</title>", "utf8");
writeJson(receiptTemplate, { format: "teacher_receipt_template_fixture" });
writeJson(rollbackManifest, {
  format: "transparent_ai_rollback_point_v1",
  rollbackDir,
  deleteOnlyAfterTeacherConfirmation: true
});

const requestPack = writeJson(join(smokeRoot, "original-goal-low-token-compact-evidence-request-pack.json"), {
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1",
  status: "waiting_for_teacher_compact_evidence_request_review",
  counts: {
    eligibleRows: 22,
    blockedRows: 0
  },
  paths: {
    html: requestHtml,
    validationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-compact-evidence-request-receipt.mjs --request-pack fixture.json --receipt <teacher-filled-compact-evidence-request-receipt.json>",
    runCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\run-original-goal-low-token-compact-evidence-request.mjs --validation <ready-validation.json> --rollback-point <retained-rollback-point-dir> --rollback-point-created true"
  },
  locks: {
    reviewOnly: true,
    goalComplete: false
  }
});

const builderPacket = writeJson(
  join(smokeRoot, "original-goal-low-token-compact-evidence-request-receipt-builder.json"),
  {
    format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_builder_v1",
    status: "waiting_for_teacher_compact_evidence_request_receipt",
    counts: {
      reviewRows: 22,
      eligibleRows: 22,
      blockedRows: 0
    },
    paths: {
      html: builderHtml,
      receiptTemplate
    },
    locks: {
      reviewOnly: true,
      builderDoesNotReadLogs: true,
      builderDoesNotRunMetadataCollection: true,
      builderDoesNotExecuteTargetSoftware: true,
      goalComplete: false
    }
  }
);

const statusRefresh = writeJson(join(smokeRoot, "original-goal-current-status-refresh.json"), {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  completionDecision: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
  paths: {
    originalGoalLowTokenCompactEvidenceRequestPack: requestPack,
    originalGoalLowTokenCompactEvidenceRequestPackHtml: requestHtml,
    originalGoalLowTokenCompactEvidenceRequestReceiptBuilder: builderPacket,
    originalGoalLowTokenCompactEvidenceRequestReceiptBuilderHtml: builderHtml,
    originalGoalLowTokenCompactEvidenceRequestReceiptTemplate: receiptTemplate,
    rollbackPointManifest: rollbackManifest,
    rollbackPointDir: rollbackDir
  },
  refreshedEvidence: {
    originalGoalLowTokenCompactEvidenceRequestReceiptBuilderReady: true,
    originalGoalLowTokenCompactEvidenceRequestReceiptBuilderRows: 22,
    originalGoalLowTokenCompactEvidenceRequestReceiptBuilderEligibleRows: 22,
    originalGoalLowTokenCompactEvidenceRequestReceiptBuilderBlockedRows: 0,
    originalGoalLowTokenCompactEvidenceRunReady: false
  },
  locks: {
    goalComplete: false
  }
});

const result = spawnSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-compact-evidence-teacher-launchpad.mjs",
    "--status-refresh",
    statusRefresh,
    "--goal",
    "smoke teacher launchpad for compact evidence",
    "--output-dir",
    join(smokeRoot, "out")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status || 1);
}

const output = JSON.parse(result.stdout);
const launchpad = readJson(output.launchpadPath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

const checks = [
  {
    name: "Launchpad gathers latest compact evidence request and receipt builder into one teacher entry",
    pass:
      output.format === "transparent_ai_original_goal_low_token_compact_evidence_teacher_launchpad_result_v1" &&
      launchpad.format === "transparent_ai_original_goal_low_token_compact_evidence_teacher_launchpad_v1" &&
      launchpad.status === "waiting_for_teacher_compact_evidence_receipt" &&
      launchpad.counts.reviewRows === 22 &&
      launchpad.paths.receiptBuilderHtml === builderHtml &&
      launchpad.paths.requestPack === requestPack &&
      launchpad.paths.rollbackPointManifest === rollbackManifest &&
      launchpad.paths.rollbackPointDir === rollbackDir
  },
  {
    name: "Launchpad exposes validation and run command templates without executing them",
    pass:
      launchpad.paths.validationCommandTemplate.includes("validate-original-goal-low-token-compact-evidence-request-receipt.mjs") &&
      launchpad.paths.runCommandAfterValidationTemplate.includes("run-original-goal-low-token-compact-evidence-request.mjs") &&
      launchpad.paths.runCommandAfterValidationTemplate.includes("--rollback-point") &&
      launchpad.locks.commandsExecuted === false &&
      launchpad.locks.metadataCollectionRun === false
  },
  {
    name: "Launchpad exposes rollback point handoff before validation without creating it",
    pass:
      launchpad.nextSteps.some((step) => step.label.includes("rollback point") && step.path === rollbackManifest) &&
      launchpad.paths.rollbackPointCommandTemplate.includes("create-rollback-point.mjs") &&
      launchpad.locks.launchpadDoesNotCreateRollbackPoint === true &&
      launchpad.locks.rollbackPointCreatedByLaunchpad === false &&
      html.includes("Create Or Confirm Rollback Point Before Filling Receipt") &&
      html.includes(rollbackManifest) &&
      readme.includes("Create or confirm the retained rollback point")
  },
  {
    name: "Launchpad locks logs screenshots execution memory rules packaging and completion",
    pass:
      launchpad.locks.launchpadDoesNotReadLogs === true &&
      launchpad.locks.launchpadDoesNotCaptureScreenshots === true &&
      launchpad.locks.launchpadDoesNotExecuteTargetSoftware === true &&
      launchpad.locks.launchpadDoesNotWriteMemory === true &&
      launchpad.locks.ruleEnabled === false &&
      launchpad.locks.packagingGated === true &&
      launchpad.locks.goalComplete === false
  },
  {
    name: "Teacher-facing HTML and README point to the browser builder first",
    pass:
      html.includes("Low-token Compact Evidence Teacher Launchpad") &&
      html.includes(builderHtml) &&
      readme.includes("Open the browser receipt builder first") &&
      readme.includes(builderHtml)
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", checks, output }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_original_goal_low_token_compact_evidence_teacher_launchpad_smoke_v1",
      root: smokeRoot,
      launchpad: output.launchpadPath,
      checks
    },
    null,
    2
  )
);
