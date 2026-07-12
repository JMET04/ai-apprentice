#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-coverage-waiting-row-cockpit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-coverage-waiting-row-cockpit"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function asciiJson(value) {
  return JSON.stringify(value, null, 2)
    .replace(/[\u007f-\uffff]/g, (char) => {
      const code = char.charCodeAt(0).toString(16).padStart(4, "0");
      return `\\u${code}`;
    })
    .replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    cockpitWritesDefaultReceiptTemplate: true,
    cockpitDoesNotWriteTeacherFilledReceipt: true,
    defaultReceiptTemplateIsApproval: false,
    cockpitDoesNotValidateReceipt: true,
    cockpitDoesNotRunMetadataGate: true,
    cockpitUsesSafeTextRendering: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotReadFullLogs: true,
    cockpitDoesNotCaptureScreenshots: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    cockpitDoesNotRegisterSchedule: true,
    cockpitDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
    screenshotsCaptured: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function softwareKey(value) {
  return String(value || "").trim().toLowerCase();
}

function identityKeys(row = {}) {
  return [row.software, row.processName]
    .map((value) => softwareKey(value))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function proofRows(dossier) {
  if (Array.isArray(dossier?.proofSnapshot?.proofRows)) return dossier.proofSnapshot.proofRows;
  return [];
}

function preflightRows(preflight) {
  if (Array.isArray(preflight?.rows)) return preflight.rows;
  return [];
}

function ledgerRows(ledger) {
  if (Array.isArray(ledger?.rows)) return ledger.rows;
  return [];
}

function byIdentity(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const key of identityKeys(row)) {
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

function findByIdentity(map, row) {
  for (const key of identityKeys(row)) {
    if (map.has(key)) return { row: map.get(key), matchedBy: key };
  }
  return { row: null, matchedBy: "" };
}

const REVIEWABLE_LOW_TOKEN_FALLBACK_KINDS = new Set([
  "log_root_or_folder_mtime_metadata",
  "windows_event_count_preview",
  "non_log_fallback_signal_metadata",
  "process_window_metadata",
  "process_and_window_state_metadata",
  "file_state_metadata",
  "manual_teacher_marker"
]);

function inheritedFallbackFromCoverageProof(proof = {}) {
  const kinds = Array.isArray(proof.lowTokenEvidenceKinds) ? proof.lowTokenEvidenceKinds : [];
  const matchedKinds = kinds.filter((kind) => REVIEWABLE_LOW_TOKEN_FALLBACK_KINDS.has(String(kind || "")));
  return {
    present: proof.queueItemMatched === true && proof.metadataGateReady === true && matchedKinds.length > 0,
    evidenceKinds: matchedKinds
  };
}

function receiptTemplate(cockpit) {
  return {
    format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
    templateOnly: true,
    defaultDecision: "needs_teacher_review",
    cockpitId: cockpit.cockpitId,
    sourceDossier: cockpit.paths.sourceDossier,
    sourceMetadataGatePreflight: cockpit.paths.sourceMetadataGatePreflight,
    sourceLogSourceDiscoveryLedger: cockpit.paths.sourceLogSourceDiscoveryLedger,
    decision: "needs_teacher_review",
    rowDecisions: cockpit.reviewRows.map((row) => ({
      rowId: row.rowId,
      software: row.software,
      coverageContractStatus: row.coverageContractReview?.status || "",
      coverageContractMissingRequirements: row.coverageContractReview?.missingRequirements || [],
      teacherDecision: "needs_teacher_review",
      evidenceReviewed: false,
      allowMetadataGatePreparation: false,
      requireMoreEvidence: row.reviewStatus !== "ready_for_teacher_confirmed_metadata_gate_receipt",
      teacherNote: ""
    })),
    blockedTeacherDecisions: [
      "accepted",
      "run_metadata_gate_now",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution"
    ],
    locks: cockpit.locks
  };
}

function writeReadme(path, cockpit) {
  const lines = [
    "# Original Goal Low-Token Coverage Waiting Row Cockpit",
    "",
    `Status: ${cockpit.status}`,
    `Rows: ${cockpit.counts.totalRows}`,
    `Ready metadata-gate rows: ${cockpit.counts.readyForTeacherConfirmedMetadataGateRows}`,
    `Rows without current log-source ledger match: ${cockpit.counts.rowsWithoutCurrentLogSourceLedgerMatch}`,
    `Likely coverage/log-source scope mismatch: ${cockpit.scopeDiagnostics.likelyCoverageLedgerScopeMismatch}`,
    "",
    "This cockpit merges the low-token coverage proof snapshot, metadata-gate preflight, and log-source discovery ledger into one teacher review surface.",
    cockpit.scopeDiagnostics.likelyCoverageLedgerScopeMismatch
      ? "Current diagnostic: refresh or realign the coverage enrollment ledger from the current log-source discovery ledger before collecting teacher coverage receipts."
      : "Current diagnostic: coverage waiting rows can be reviewed against the current log-source discovery ledger.",
    "",
    `- Cockpit HTML: ${cockpit.paths.html}`,
    `- Cockpit packet: ${cockpit.paths.cockpit}`,
    `- Receipt template: ${cockpit.paths.receiptTemplate}`,
    `- Source dossier: ${cockpit.paths.sourceDossier}`,
    `- Source metadata-gate preflight: ${cockpit.paths.sourceMetadataGatePreflight}`,
    `- Source log-source ledger: ${cockpit.paths.sourceLogSourceDiscoveryLedger}`,
    "",
    "Safety boundary:",
    "- This cockpit is review-only.",
    "- It does not run metadata gates, read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, accept coverage, or claim completion.",
    "- Prepared metadata-gate commands still require the separate receipt validation, explicit teacher confirmation, and a retained rollback point."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function buildRows(dossier, preflight, ledger) {
  const preflightByIdentity = byIdentity(preflightRows(preflight));
  const ledgerByIdentity = byIdentity(ledgerRows(ledger));
  const sourceLogSourceLedgerRows = ledgerRows(ledger).length;
  return proofRows(dossier).map((proof, index) => {
    const preflightMatch = findByIdentity(preflightByIdentity, proof);
    const ledgerMatch = findByIdentity(ledgerByIdentity, proof);
    const preflightRow = preflightMatch.row;
    const ledgerRow = ledgerMatch.row;
    const coverageContract = proof.coverageContract || {
      status: "coverage_contract_missing_from_proof_snapshot",
      missingRequirements: ["coverage_contract_missing_from_proof_snapshot"],
      nextContractAction: "Regenerate the low-token coverage dossier before cockpit review.",
      satisfiedBeforeTeacherReceipt: false,
      teacherExcluded: false,
      checks: []
    };
    const coverageContractAllowsMetadataGate =
      coverageContract.status === "coverage_contract_metadata_gate_ready_pending_teacher_review";
    const metadataGateReady = preflightRow?.readyForTeacherConfirmedMetadataGate === true;
    const inheritedFallback = inheritedFallbackFromCoverageProof(proof);
    const ledgerRoutePresent = Boolean(
      ledgerRow &&
        (ledgerRow.canAttemptAutomaticLogReadAfterMetadataGate === true ||
          ledgerRow.directLogCandidateCount > 0 ||
          ledgerRow.candidateLogRootCount > 0 ||
          ledgerRow.windowsEventLogCount > 0 ||
          ledgerRow.nonLogFallbackSignalCount > 0)
    ) || inheritedFallback.present;
    const blockers = [
      coverageContractAllowsMetadataGate ? "" : "coverage_contract_not_ready_for_metadata_gate_review",
      metadataGateReady ? "" : "metadata_gate_preflight_not_ready",
      ledgerRoutePresent
        ? ""
        : sourceLogSourceLedgerRows > 0
          ? "coverage_waiting_row_not_in_current_log_source_ledger_scope"
          : "log_source_route_not_found_in_ledger",
      proof.metadataGateReady === true ? "" : "proof_snapshot_metadata_gate_not_ready"
    ].filter(Boolean);
    return {
      rowId: `low-token-waiting-${String(index + 1).padStart(3, "0")}`,
      ledgerNumber: proof.ledgerNumber || ledgerRow?.ledgerNumber || "",
      software: proof.software || ledgerRow?.software || `unknown-software-${index + 1}`,
      processName: proof.processName || ledgerRow?.processName || "",
      reviewStatus:
        coverageContractAllowsMetadataGate && metadataGateReady && ledgerRoutePresent
          ? "ready_for_teacher_confirmed_metadata_gate_receipt"
          : "blocked_needs_more_low_token_evidence",
      coverageContractReview: {
        present: Boolean(proof.coverageContract),
        status: coverageContract.status,
        missingRequirements: coverageContract.missingRequirements || [],
        nextContractAction: coverageContract.nextContractAction || "",
        satisfiedBeforeTeacherReceipt: coverageContract.satisfiedBeforeTeacherReceipt === true,
        teacherExcluded: coverageContract.teacherExcluded === true,
        allowsMetadataGateReview: coverageContractAllowsMetadataGate
      },
      proofSnapshotReview: {
        present: true,
        followUpId: proof.followUpId || "",
        queueItemId: proof.queueItemId || "",
        metadataGateReady: proof.metadataGateReady === true,
        queueItemMatched: proof.queueItemMatched === true,
        lowTokenEvidenceKinds: proof.lowTokenEvidenceKinds || [],
        blockers: proof.blockers || []
      },
      metadataGatePreflightReview: preflightRow
        ? {
            present: true,
            status: preflightRow.status || "",
            readyForTeacherConfirmedMetadataGate: metadataGateReady,
            nextSafeAction: preflightRow.nextSafeAction || "",
            blockers: preflightRow.blockers || []
          }
        : {
            present: false,
            status: "missing_metadata_gate_preflight_row",
            readyForTeacherConfirmedMetadataGate: false,
            nextSafeAction: "",
            blockers: ["metadata_gate_preflight_row_missing"]
          },
      logSourceLedgerReview: ledgerRow
        ? {
            present: true,
            currentLedgerContainsRow: true,
            matchedBy: ledgerMatch.matchedBy,
            discoveryStatus: ledgerRow.discoveryStatus || ledgerRow.status || "",
            inheritedFromCoverageProofSnapshot: false,
            inheritedFallbackEvidenceKinds: [],
            canAttemptAutomaticLogReadAfterMetadataGate:
              ledgerRow.canAttemptAutomaticLogReadAfterMetadataGate === true,
            directLogCandidateCount: ledgerRow.directLogCandidateCount || 0,
            candidateLogRootCount: ledgerRow.candidateLogRootCount || 0,
            windowsEventLogCount: ledgerRow.windowsEventLogCount || 0,
            nonLogFallbackSignalCount: ledgerRow.nonLogFallbackSignalCount || 0,
            logReadRequiresTrigger: ledgerRow.logReadRequiresTrigger === true
          }
        : {
            present: false,
            currentLedgerContainsRow: false,
            matchedBy: "",
            discoveryStatus: inheritedFallback.present
              ? "inherited_low_token_fallback_from_coverage_proof_snapshot"
              : sourceLogSourceLedgerRows > 0
                ? "coverage_waiting_row_not_in_current_log_source_ledger_scope"
                : "missing_log_source_ledger_row",
            inheritedFromCoverageProofSnapshot: inheritedFallback.present,
            inheritedFallbackEvidenceKinds: inheritedFallback.evidenceKinds,
            canAttemptAutomaticLogReadAfterMetadataGate: false,
            directLogCandidateCount: 0,
            candidateLogRootCount: 0,
            windowsEventLogCount: 0,
            nonLogFallbackSignalCount: inheritedFallback.evidenceKinds.length,
            logReadRequiresTrigger: true,
            sourceLogSourceLedgerRows
          },
      optimizedTeacherPrompt:
        "Confirm whether this software row may proceed to a metadata-only low-token gate. Do not approve full log reads, screenshots, target software execution, memory, coverage acceptance, or completion from this cockpit.",
      defaultDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "needs_teacher_review",
        "teacher_ready_for_metadata_gate_receipt",
        "blocked_needs_more_low_token_evidence"
      ],
      blockedTeacherDecisions: [
        "accepted",
        "run_metadata_gate_now",
        "read_logs_now",
        "read_full_logs",
        "capture_screenshot_now",
        "execute_now",
        "memory_enabled",
        "claim_complete",
        "native_universal_execution"
      ],
      blockers,
      locks: locks()
    };
  });
}

const goal = argValue("--goal", "Review low-token coverage waiting rows before teacher-confirmed metadata gates.");
const dossierInput = readJsonInput(
  argValue("--dossier", argValue("--coverage-dossier", "")),
  "--dossier",
  "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1"
);
const preflightInput = readJsonInput(
  argValue("--metadata-gate-preflight", argValue("--preflight", "")),
  "--metadata-gate-preflight",
  "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1"
);
const ledgerInput = readJsonInput(
  argValue("--log-source-ledger", argValue("--ledger", "")),
  "--log-source-ledger",
  "transparent_ai_all_software_log_source_discovery_ledger_v1"
);

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-coverage-waiting-row-cockpits"))
);
mkdirSync(outputRoot, { recursive: true });
const cockpitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const cockpitDir = join(outputRoot, cockpitId);
mkdirSync(cockpitDir, { recursive: true });

const cockpitPath = join(cockpitDir, "original-goal-low-token-coverage-waiting-row-cockpit.json");
const htmlPath = join(cockpitDir, "original-goal-low-token-coverage-waiting-row-cockpit.html");
const readmePath = join(cockpitDir, "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_WAITING_ROW_COCKPIT_START_HERE.md");
const receiptTemplatePath = join(cockpitDir, "original-goal-low-token-coverage-waiting-row-cockpit-receipt-template.json");
const reviewRows = buildRows(dossierInput.value, preflightInput.value, ledgerInput.value);
const cockpitLocks = locks();
const rowsWithLogSourceLedgerRoute = reviewRows.filter(
  (row) => row.logSourceLedgerReview.present || row.logSourceLedgerReview.inheritedFromCoverageProofSnapshot === true
).length;
const rowsWithoutCurrentLogSourceLedgerMatch = reviewRows.filter(
  (row) =>
    row.logSourceLedgerReview.currentLedgerContainsRow === false &&
    row.logSourceLedgerReview.inheritedFromCoverageProofSnapshot !== true
).length;
const likelyCoverageLedgerScopeMismatch =
  reviewRows.length > 0 &&
  rowsWithLogSourceLedgerRoute === 0 &&
  rowsWithoutCurrentLogSourceLedgerMatch === reviewRows.length &&
  ledgerRows(ledgerInput.value).length > 0;
const cockpit = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    likelyCoverageLedgerScopeMismatch
      ? "blocked_log_source_ledger_scope_mismatch_waiting_for_coverage_ledger_refresh"
      : 
    reviewRows.some((row) => row.reviewStatus === "ready_for_teacher_confirmed_metadata_gate_receipt")
      ? "waiting_for_teacher_low_token_waiting_row_review"
      : "blocked_no_ready_metadata_gate_rows",
  counts: {
    totalRows: reviewRows.length,
    rowsWithLogSourceLedgerRoute,
    rowsWithoutCurrentLogSourceLedgerMatch,
    rowsWithInheritedCoverageProofFallbackRoute: reviewRows.filter(
      (row) => row.logSourceLedgerReview.inheritedFromCoverageProofSnapshot === true
    ).length,
    rowsWithMetadataGatePreflight: reviewRows.filter((row) => row.metadataGatePreflightReview.present).length,
    rowsWithCoverageContract: reviewRows.filter((row) => row.coverageContractReview.present).length,
    rowsWithCoverageContractReadyForMetadataGate: reviewRows.filter(
      (row) => row.coverageContractReview.allowsMetadataGateReview
    ).length,
    readyForTeacherConfirmedMetadataGateRows: reviewRows.filter(
      (row) => row.reviewStatus === "ready_for_teacher_confirmed_metadata_gate_receipt"
    ).length,
    blockedRows: reviewRows.filter((row) => row.reviewStatus !== "ready_for_teacher_confirmed_metadata_gate_receipt").length
  },
  scopeDiagnostics: {
    likelyCoverageLedgerScopeMismatch,
    sourceLogSourceLedgerRows: ledgerRows(ledgerInput.value).length,
    sourceDossierProofRows: proofRows(dossierInput.value).length,
    explanation: likelyCoverageLedgerScopeMismatch
      ? "The current log-source discovery ledger has reviewable routes, but none of the coverage waiting rows match it by software or process name. Refresh or realign the coverage enrollment ledger from the current log-source discovery ledger before collecting teacher coverage receipts."
      : "Coverage waiting rows can be compared against the current log-source discovery ledger by software or process name."
  },
  reviewRows,
  paths: {
    cockpit: cockpitPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceDossier: dossierInput.path,
    sourceMetadataGatePreflight: preflightInput.path,
    sourceLogSourceDiscoveryLedger: ledgerInput.path
  },
  nextValidationCommand: commandLine("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs", [
    ["--preflight", preflightInput.path],
    ["--receipt", "<teacher-filled-low-token-metadata-gate-preflight-receipt.json>"]
  ]),
  nextSafeCommandAfterReceiptValidation: commandLine("run-original-goal-low-token-metadata-gate-validation-command.mjs", [
    ["--validation", "<low-token-metadata-gate-preflight-receipt-validation.json>"],
    ["--command-id", "<teacher-reviewed-command-id>"],
    ["--teacher-confirmation", "<teacher-confirmed-low-token-metadata-gate-text>"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"]
  ]),
  blockedActions: [
    "run_metadata_gate_from_cockpit",
    "read_logs_from_cockpit",
    "read_full_logs_from_cockpit",
    "capture_screenshot_from_cockpit",
    "execute_target_software_from_cockpit",
    "register_schedule_from_cockpit",
    "write_memory_from_cockpit",
    "claim_all_software_coverage_from_cockpit",
    "render_untrusted_row_text_with_inner_html"
  ],
  locks: cockpitLocks
};
const template = receiptTemplate(cockpit);

writeFileSync(cockpitPath, `${asciiJson(cockpit)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${asciiJson(template)}\n`, "utf8");
writeReadme(readmePath, cockpit);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Coverage Waiting Row Cockpit</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; margin-top: 16px; }
    label { display: block; margin: 8px 0; }
    select { min-height: 34px; width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; min-height: 280px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .warn { background: #fff7df; color: #795400; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Low-Token Coverage Waiting Row Cockpit</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span> <span class="badge warn">no log reads</span></p>
    <section class="panel">
      <h2>Generate Teacher Receipt JSON</h2>
      <p>Review waiting rows before the separate metadata-gate receipt and allowlist runner. This page only builds JSON in your browser; it does not run metadata gates, read logs, capture screenshots, execute software, write memory, or claim completion.</p>
      <p class="muted">Scope diagnostic: <code>${htmlEscape(cockpit.scopeDiagnostics.explanation)}</code></p>
      <p class="muted">Receipt template: <code>${htmlEscape(cockpit.paths.receiptTemplate)}</code></p>
      <div id="rows" class="grid"></div>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(cockpit.nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const cockpit = ${jsonForScript(cockpit)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    function appendText(parent, tagName, text, className) {
      const el = document.createElement(tagName);
      if (className) el.className = className;
      el.textContent = String(text ?? "");
      parent.appendChild(el);
      return el;
    }
    function appendCodeLine(parent, label, value, className) {
      const p = document.createElement("p");
      if (className) p.className = className;
      p.appendChild(document.createTextNode(label + ": "));
      const code = document.createElement("code");
      code.textContent = String(value ?? "");
      p.appendChild(code);
      parent.appendChild(p);
      return p;
    }
    for (const row of cockpit.reviewRows) {
      const card = document.createElement("article");
      card.className = "row";
      appendText(card, "label", row.software);
      const select = document.createElement("select");
      select.dataset.rowId = row.rowId;
      for (const decision of row.allowedTeacherDecisions) {
        const option = document.createElement("option");
        option.value = decision;
        option.textContent = decision;
        select.appendChild(option);
      }
      card.appendChild(select);
      appendCodeLine(card, "Status", row.reviewStatus, "muted");
      appendCodeLine(card, "Coverage contract", row.coverageContractReview.status);
      appendCodeLine(card, "Contract missing", row.coverageContractReview.missingRequirements.join(", "), "muted");
      appendCodeLine(card, "Ledger route", row.logSourceLedgerReview.present);
      appendCodeLine(card, "Metadata preflight", row.metadataGatePreflightReview.status);
      appendCodeLine(card, "Blockers", row.blockers.join(", "), "muted");
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const decisions = new Map(Array.from(document.querySelectorAll("select[data-row-id]")).map((select) => [select.dataset.rowId, select.value]));
      return {
        format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
        cockpitId: cockpit.cockpitId,
        sourceDossier: cockpit.paths.sourceDossier,
        sourceMetadataGatePreflight: cockpit.paths.sourceMetadataGatePreflight,
        sourceLogSourceDiscoveryLedger: cockpit.paths.sourceLogSourceDiscoveryLedger,
        decision: "needs_teacher_review",
        rowDecisions: cockpit.reviewRows.map((row) => {
          const decision = decisions.get(row.rowId) || "needs_teacher_review";
          return {
            rowId: row.rowId,
            software: row.software,
            teacherDecision: decision,
            evidenceReviewed: decision !== "needs_teacher_review",
            allowMetadataGatePreparation: decision === "teacher_ready_for_metadata_gate_receipt",
            requireMoreEvidence: decision !== "teacher_ready_for_metadata_gate_receipt",
            teacherNote: ""
          };
        }),
        locks: cockpit.locks
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_result_v1",
      cockpitId,
      status: cockpit.status,
      cockpitPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      counts: cockpit.counts,
      scopeDiagnostics: cockpit.scopeDiagnostics,
      locks: cockpitLocks
    },
    null,
    2
  )
);
