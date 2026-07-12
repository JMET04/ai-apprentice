#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-blocked-waiting-row-evidence-plan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-blocked-waiting-row-evidence-plan"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    evidencePlanOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    planDoesNotRunMetadataGate: true,
    planDoesNotReadLogs: true,
    planDoesNotReadFullLogs: true,
    planDoesNotCaptureScreenshots: true,
    planDoesNotExecuteTargetSoftware: true,
    planDoesNotRegisterSchedule: true,
    planDoesNotWriteMemory: true,
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

function actionForRow(row, cockpit, outputDir) {
  const blockers = new Set([...(row.blockers || []), ...(row.proofSnapshotReview?.blockers || [])]);
  const hasReviewedLogSourceOrFallback =
    row.logSourceLedgerReview?.present === true ||
    row.logSourceLedgerReview?.inheritedFromCoverageProofSnapshot === true;
  const needsLogSource = blockers.has("log_source_route_not_found_in_ledger") || !hasReviewedLogSourceOrFallback;
  const needsWatchEvidence = blockers.has("missing_watch_or_compact_learning_evidence");
  const needsTeacherReview = blockers.has("blocked_until_teacher_review");
  const commandTemplates = [];
  const evidenceRequests = [];
  const teacherSteps = [];

  if (needsLogSource) {
    evidenceRequests.push(
      "reviewed log-source discovery ledger row or teacher-provided log/fallback source marker",
      "teacher exclusion if this software should not be monitored"
    );
    teacherSteps.push(
      "Open or regenerate the all-software log-source discovery ledger and find this software row.",
      "If no direct log exists, record a reviewed low-token fallback signal such as Windows Event source, config/state file metadata, process/window metadata, or explicit teacher exclusion.",
      "Do not read full logs; only collect metadata/fallback route evidence."
    );
    commandTemplates.push(
      commandLine("create-all-software-log-source-discovery-ledger.mjs", [
        ["--inventory", "<all-software-inventory.json>"],
        ["--output-dir", join(outputDir, "log-source-discovery-ledger-refresh")]
      ])
    );
  }

  if (needsWatchEvidence) {
    evidenceRequests.push("compact watch-cycle or automatic low-token runner evidence for this row");
    teacherSteps.push(
      "Use the existing low-token observer/runner lane to collect only changed metadata or compact event evidence.",
      "Escalate to one visual check only through the existing triggered visual-check review gate, not from this plan."
    );
    commandTemplates.push(
      commandLine("run-all-software-low-token-learning-cycle.mjs", [
        ["--queue", "<teacher-reviewed-observer-queue.json>"],
        ["--teacher-reviewed", "true"],
        ["--output-dir", join(outputDir, "low-token-learning-cycle-evidence")]
      ])
    );
  }

  if (needsTeacherReview) {
    evidenceRequests.push("teacher review receipt confirming source route, fallback signal, or exclusion");
    teacherSteps.push(
      "Teacher reviews the row after log-source/fallback evidence is present.",
      "Only then return to the waiting-row cockpit receipt validator."
    );
    commandTemplates.push(
      commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
        ["--cockpit", cockpit.paths?.cockpit || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
        ["--receipt", "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"],
        ["--output-dir", join(outputDir, "waiting-row-cockpit-receipt-validation")]
      ])
    );
  }

  const uniqueCommands = [...new Set(commandTemplates)];
  const coverageContractReview = row.coverageContractReview || {
    present: false,
    status: "coverage_contract_missing_from_waiting_row_cockpit",
    missingRequirements: ["coverage_contract_review"],
    allowsMetadataGateReview: false
  };
  return {
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    reviewStatus: row.reviewStatus || "",
    blockers: [...blockers],
    coverageContractReview,
    lowTokenRouteGap: {
      logSourceLedgerRoutePresent: row.logSourceLedgerReview?.present === true,
      inheritedFallbackFromCoverageProofSnapshot:
        row.logSourceLedgerReview?.inheritedFromCoverageProofSnapshot === true,
      coverageContractAllowsMetadataGateReview: coverageContractReview.allowsMetadataGateReview === true,
      missingLedgerRouteBlocksReturn: needsLogSource,
      reason: needsLogSource
        ? "coverage contract is preserved, but the row still needs a reviewed log-source ledger route or teacher-approved fallback before returning to cockpit review"
        : "reviewed log-source route or inherited low-token fallback is present; continue with remaining compact evidence and teacher review requirements"
    },
    missingEvidenceKinds: [
      needsLogSource ? "log_source_route_or_reviewed_fallback" : "",
      needsWatchEvidence ? "compact_watch_or_learning_evidence" : "",
      needsTeacherReview ? "teacher_review_receipt" : ""
    ].filter(Boolean),
    evidenceRequests,
    existingToolsToReuse: [
      needsLogSource ? "create-all-software-log-source-discovery-ledger.mjs" : "",
      needsWatchEvidence ? "run-all-software-low-token-learning-cycle.mjs" : "",
      "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
    ].filter(Boolean),
    orderedTeacherSteps: teacherSteps,
    commandTemplates: uniqueCommands,
    stopConditions: [
      "Teacher cannot identify a source route, fallback signal, or exclusion.",
      "A step would require full log content rather than metadata or bounded review.",
      "A step would execute target software, capture screenshots, register schedules, write memory, or claim coverage."
    ],
    readyToReturnToCockpitReview: false,
    locks: locks()
  };
}

function writeReadme(path, plan) {
  const lines = [
    "# Original Goal Low-Token Blocked Waiting Row Evidence Plan",
    "",
    `Status: ${plan.status}`,
    `Blocked rows: ${plan.counts.blockedRows}`,
    `Rows needing log-source route: ${plan.counts.rowsNeedingLogSourceRoute}`,
    "",
    "This plan turns blocked low-token waiting-row cockpit rows into teacher-reviewable evidence requests.",
    "",
    "Safety boundary:",
    "- This plan is review-only.",
    "- It does not run metadata gates, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- Command templates are copy-only and still require teacher confirmation, receipts, and rollback gates in their own tools.",
    "",
    "Rows:",
    ...plan.actionRows.map((row, index) => `${index + 1}. ${row.rowId} ${row.software}: ${row.missingEvidenceKinds.join(", ")}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, plan) {
  const rows = plan.actionRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.missingEvidenceKinds.join(", ")
      )}</td><td>${htmlEscape(row.existingToolsToReuse.join(", "))}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blocked Waiting Row Evidence Plan</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6ebf2; padding: 8px; vertical-align: top; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .warn { background: #fff7df; color: #795400; }
  </style>
</head>
<body>
  <main>
    <h1>Blocked Waiting Row Evidence Plan</h1>
    <p><span class="badge">review only</span> <span class="badge warn">no log reads</span></p>
    <section class="panel">
      <p>Status: <code>${htmlEscape(plan.status)}</code></p>
      <p>Blocked rows: <code>${htmlEscape(plan.counts.blockedRows)}</code>; rows needing log-source route: <code>${htmlEscape(
        plan.counts.rowsNeedingLogSourceRoute
      )}</code></p>
    </section>
    <section class="panel">
      <table>
        <thead><tr><th>Row</th><th>Software</th><th>Missing Evidence</th><th>Existing Tools To Reuse</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Command Templates</h2>
      ${plan.commandTemplates.map((command) => `<p><code>${htmlEscape(command)}</code></p>`).join("\n")}
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Plan evidence acquisition for blocked original-goal low-token waiting rows.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", argValue("--waiting-row-cockpit", "")),
  "--cockpit",
  "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-blocked-waiting-row-evidence-plans"))
);
mkdirSync(outputRoot, { recursive: true });
const planId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const planDir = join(outputRoot, planId);
mkdirSync(planDir, { recursive: true });
const planPath = join(planDir, "original-goal-low-token-blocked-waiting-row-evidence-plan.json");
const htmlPath = join(planDir, "original-goal-low-token-blocked-waiting-row-evidence-plan.html");
const readmePath = join(planDir, "ORIGINAL_GOAL_LOW_TOKEN_BLOCKED_WAITING_ROW_EVIDENCE_PLAN_START_HERE.md");

const cockpit = cockpitInput.value;
const blockedRows = (cockpit.reviewRows || []).filter(
  (row) => row.reviewStatus !== "ready_for_teacher_confirmed_metadata_gate_receipt"
);
const actionRows = blockedRows.map((row) => actionForRow(row, cockpit, planDir));
const commandTemplates = [...new Set(actionRows.flatMap((row) => row.commandTemplates || []))];
const planLocks = locks();
const plan = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1",
  planId,
  createdAt: new Date().toISOString(),
  goal,
  status: actionRows.length
    ? "blocked_waiting_rows_need_reviewed_low_token_evidence"
    : "no_blocked_waiting_rows_waiting_for_cockpit_receipt_review",
  sourceEvidence: {
    cockpit: cockpitInput.path,
    sourceDossier: cockpit.paths?.sourceDossier || "",
    sourceMetadataGatePreflight: cockpit.paths?.sourceMetadataGatePreflight || "",
    sourceLogSourceDiscoveryLedger: cockpit.paths?.sourceLogSourceDiscoveryLedger || ""
  },
  counts: {
    cockpitRows: cockpit.reviewRows?.length || 0,
    readyRows: (cockpit.reviewRows || []).filter(
      (row) => row.reviewStatus === "ready_for_teacher_confirmed_metadata_gate_receipt"
    ).length,
    blockedRows: actionRows.length,
    rowsWithCoverageContractReadyForMetadataGate: actionRows.filter(
      (row) => row.coverageContractReview?.allowsMetadataGateReview === true
    ).length,
    rowsNeedingLogSourceRoute: actionRows.filter((row) => row.missingEvidenceKinds.includes("log_source_route_or_reviewed_fallback")).length,
    rowsNeedingCompactWatchEvidence: actionRows.filter((row) => row.missingEvidenceKinds.includes("compact_watch_or_learning_evidence")).length,
    rowsNeedingTeacherReview: actionRows.filter((row) => row.missingEvidenceKinds.includes("teacher_review_receipt")).length
  },
  actionRows,
  commandTemplates,
  nextReviewHandoff: {
    executeNow: false,
    instruction:
      "Collect reviewed log-source/fallback, compact watch evidence, or teacher exclusion for blocked rows, then return to the waiting-row cockpit receipt validator.",
    returnCommandTemplate: commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
      ["--cockpit", cockpitInput.path || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
      ["--receipt", "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"],
      ["--output-dir", join(planDir, "waiting-row-cockpit-receipt-validation")]
    ])
  },
  blockedShortcuts: [
    "Do not read logs or full logs from this plan.",
    "Do not run metadata gates from this plan.",
    "Do not capture screenshots from this plan.",
    "Do not execute target software from this plan.",
    "Do not register schedules, write memory, enable rules, accept coverage, unlock packaging, or claim completion."
  ],
  paths: {
    plan: planPath,
    html: htmlPath,
    readme: readmePath,
    sourceCockpit: cockpitInput.path
  },
  locks: planLocks
};

writeJson(planPath, plan);
writeHtml(htmlPath, plan);
writeReadme(readmePath, plan);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_result_v1",
      planId,
      status: plan.status,
      planPath,
      htmlPath,
      readmePath,
      counts: plan.counts,
      locks: planLocks
    },
    null,
    2
  )
);
