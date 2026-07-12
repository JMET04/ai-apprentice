#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(process.cwd());
const tmpRoot = join(tmpdir(), `transparent-ai-ready-metadata-gate-shortlist-${Date.now()}`);
mkdirSync(tmpRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const stdout = execFileSync("node", [join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

function runValidator(receiptPath, label, expectFailure = false) {
  const outputDir = join(tmpRoot, label);
  try {
    const result = runScript("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
      "--cockpit",
      cockpitPath,
      "--receipt",
      receiptPath,
      "--output-dir",
      outputDir
    ]);
    if (expectFailure) throw new Error(`${label} should have failed`);
    return readJson(result.validationPath);
  } catch (error) {
    if (!expectFailure) throw error;
    const stdout = String(error.stdout || "");
    const result = stdout.trim() ? JSON.parse(stdout) : null;
    if (!result?.validationPath) throw error;
    return readJson(result.validationPath);
  }
}

const cockpit = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId: "smoke-ready-shortlist-cockpit",
  status: "waiting_for_teacher_low_token_waiting_row_review",
  counts: {
    totalRows: 3,
    readyForTeacherConfirmedMetadataGateRows: 2,
    blockedRows: 1
  },
  reviewRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: "001",
      software: "ReadyAppOne",
      processName: "ready-one.exe",
      reviewStatus: "ready_for_teacher_confirmed_metadata_gate_receipt",
      coverageContractReview: {
        present: true,
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        missingRequirements: ["teacher_receipt_before_completion_claim"],
        allowsMetadataGateReview: true
      },
      metadataGatePreflightReview: {
        present: true,
        status: "ready_for_teacher_confirmed_metadata_gate_receipt",
        readyForTeacherConfirmedMetadataGate: true
      },
      logSourceLedgerReview: {
        present: true,
        discoveryStatus: "direct_log_candidate_ready"
      }
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: "002",
      software: "ReadyAppTwo",
      processName: "ready-two.exe",
      reviewStatus: "ready_for_teacher_confirmed_metadata_gate_receipt",
      coverageContractReview: {
        present: true,
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        missingRequirements: ["teacher_receipt_before_completion_claim"],
        allowsMetadataGateReview: true
      },
      metadataGatePreflightReview: {
        present: true,
        status: "ready_for_teacher_confirmed_metadata_gate_receipt",
        readyForTeacherConfirmedMetadataGate: true
      },
      logSourceLedgerReview: {
        present: true,
        discoveryStatus: "event_metadata_ready"
      }
    },
    {
      rowId: "low-token-waiting-003",
      ledgerNumber: "003",
      software: "BlockedApp",
      processName: "blocked.exe",
      reviewStatus: "blocked_needs_more_low_token_evidence",
      blockers: ["metadata_gate_preflight_not_ready"],
      coverageContractReview: {
        present: true,
        status: "coverage_contract_waiting_for_queue_binding",
        missingRequirements: ["observer_queue_or_teacher_scope_binding"],
        nextContractAction: "Collect compact route evidence first.",
        allowsMetadataGateReview: false
      },
      metadataGatePreflightReview: {
        present: true,
        status: "blocked",
        readyForTeacherConfirmedMetadataGate: false
      },
      logSourceLedgerReview: {
        present: false,
        discoveryStatus: "missing_log_source_ledger_row"
      }
    }
  ],
  paths: {
    sourceDossier: join(tmpRoot, "dossier.json"),
    sourceMetadataGatePreflight: join(tmpRoot, "metadata-gate-preflight.json"),
    sourceLogSourceDiscoveryLedger: join(tmpRoot, "log-source-ledger.json")
  },
  locks: {
    reviewOnly: true,
    cockpitDoesNotRunMetadataGate: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
};

const cockpitPath = join(tmpRoot, "cockpit.json");
const metadataReceiptTemplate = join(tmpRoot, "teacher-metadata-gate-preflight-receipt-template.json");
writeJson(cockpitPath, cockpit);
writeJson(metadataReceiptTemplate, { format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1" });

const result = runScript("create-original-goal-low-token-ready-metadata-gate-shortlist.mjs", [
  "--goal",
  "Smoke ready metadata gate shortlist",
  "--cockpit",
  cockpitPath,
  "--metadata-gate-receipt-template",
  metadataReceiptTemplate,
  "--output-dir",
  join(tmpRoot, "shortlist")
]);

const shortlist = readJson(result.shortlistPath);
const draftReceipt = readJson(result.draftReceiptPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const draftValidation = runValidator(result.draftReceiptPath, "draft-validation", true);

const teacherConfirmedReceiptPath = join(tmpRoot, "teacher-confirmed-receipt.json");
const teacherConfirmedReceipt = {
  ...draftReceipt,
  templateOnly: false,
  draftOnly: false,
  rowDecisions: draftReceipt.rowDecisions.map((row) =>
    row.teacherDecision === "teacher_ready_for_metadata_gate_receipt"
      ? {
          ...row,
          evidenceReviewed: true,
          allowMetadataGatePreparation: true,
          teacherNote: "teacher reviewed compact route and allows metadata-gate preparation"
        }
      : {
          ...row,
          evidenceReviewed: true,
          teacherNote: "still blocked"
        }
  )
};
writeJson(teacherConfirmedReceiptPath, teacherConfirmedReceipt);
const confirmedValidation = runValidator(teacherConfirmedReceiptPath, "confirmed-validation");

const assertions = [
  {
    name: "Ready metadata-gate shortlist is review-only and emits visible artifacts",
    pass:
      result.ok === true &&
      shortlist.format === "transparent_ai_original_goal_low_token_ready_metadata_gate_shortlist_v1" &&
      shortlist.status === "waiting_for_teacher_to_review_ready_metadata_gate_shortlist" &&
      existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      existsSync(result.draftReceiptPath) &&
      shortlist.counts.readyRows === 2 &&
      shortlist.counts.blockedRows === 1 &&
      shortlist.counts.rowsThatWouldValidateWithoutTeacherEdits === 0 &&
      shortlist.locks.shortlistDoesNotRunMetadataGate === true &&
      shortlist.locks.shortlistDoesNotReadLogs === true &&
      shortlist.locks.shortlistDoesNotExecuteTargetSoftware === true &&
      shortlist.locks.draftReceiptIsNotTeacherConfirmation === true &&
      shortlist.locks.goalComplete === false
  },
  {
    name: "Draft receipt pre-fills suggestions but intentionally fails validation until teacher edits evidence flags",
    pass:
      draftReceipt.format === "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1" &&
      draftReceipt.draftOnly === true &&
      draftReceipt.teacherMustEditBeforeValidation === true &&
      draftReceipt.rowDecisions.filter((row) => row.teacherDecision === "teacher_ready_for_metadata_gate_receipt").length === 2 &&
      draftReceipt.rowDecisions
        .filter((row) => row.teacherDecision === "teacher_ready_for_metadata_gate_receipt")
        .every((row) => row.evidenceReviewed === false && row.allowMetadataGatePreparation === false) &&
      draftValidation.ok === false &&
      draftValidation.status === "blocked" &&
      draftValidation.validationRows.some((row) => row.status === "blocked_missing_evidence_review_or_metadata_preparation_flag")
  },
  {
    name: "Teacher-edited receipt can advance only to the next metadata preflight receipt review",
    pass:
      confirmedValidation.ok === true &&
      confirmedValidation.status === "waiting_for_metadata_gate_preflight_receipt_after_cockpit_review" &&
      confirmedValidation.counts.readyRows === 2 &&
      confirmedValidation.nextSafeCommand?.executesNow === false &&
      confirmedValidation.nextSafeCommand?.commandLine.includes("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs") &&
      confirmedValidation.locks.validationDoesNotRunMetadataGate === true &&
      confirmedValidation.locks.validationDoesNotReadLogs === true &&
      confirmedValidation.locks.validationDoesNotExecuteTargetSoftware === true
  },
  {
    name: "Shortlist HTML and README explain the teacher-only boundary",
    pass:
      html.includes("Ready Metadata Gate Shortlist") &&
      html.includes("draft is not teacher confirmation") &&
      html.includes("no metadata gate run") &&
      readme.includes("The draft receipt is not teacher confirmation") &&
      readme.includes("It does not run metadata gates, read logs, capture screenshots, execute target software")
  }
];

const failed = assertions.filter((assertion) => !assertion.pass);
rmSync(tmpRoot, { recursive: true, force: true });
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      assertions: assertions.length,
      resultFormat: result.format,
      readyRows: shortlist.counts.readyRows
    },
    null,
    2
  )
);
