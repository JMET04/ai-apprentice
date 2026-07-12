#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "low-token-compact-evidence-request-pack")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "low-token-compact-evidence-request-pack"
  );
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
    requestOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    requestDoesNotRunMetadataGate: true,
    requestDoesNotRunWatchCycle: true,
    requestDoesNotReadLogs: true,
    requestDoesNotReadFullLogs: true,
    requestDoesNotCaptureScreenshots: true,
    requestDoesNotExecuteTargetSoftware: true,
    requestDoesNotRegisterSchedule: true,
    requestDoesNotWriteMemory: true,
    compactEvidenceNotCollectedYet: true,
    selectedRouteIsNotCoverage: true,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function extractRoute(row) {
  const signal = String(row.reviewedEvidencePathOrSignal || "");
  const routeIdFromPath = signal.includes(":") ? signal.split(":").pop() : "";
  const summary = String(row.sourceRouteOrFallbackSummary || "");
  const kindMatch = summary.match(/\(([^)]+)\)/);
  return {
    routeId: routeIdFromPath || "unknown_selected_route",
    routeKind: kindMatch?.[1] || "unknown_route_kind",
    summary
  };
}

function evidencePlanForRoute(routeId, routeKind) {
  const route = `${routeId} ${routeKind}`.toLowerCase();
  if (route.includes("windows_event")) {
    return {
      evidenceMode: "windows_event_metadata_only",
      compactFields: [
        "event log name",
        "provider names",
        "event id histogram",
        "level histogram",
        "bounded time-window count",
        "newest timestamp"
      ],
      forbiddenFields: ["full event message body", "raw event export", "screenshots", "software commands"],
      collectionBoundary:
        "Use provider/count/id/level/time metadata only. Message body previews require separate teacher confirmation."
    };
  }
  if (route.includes("process_window")) {
    return {
      evidenceMode: "process_window_metadata_only",
      compactFields: [
        "process name",
        "process id",
        "window title",
        "window class if available",
        "executable path hash",
        "executable mtime/size"
      ],
      forbiddenFields: ["screen capture", "keystrokes", "window content OCR", "software commands"],
      collectionBoundary:
        "Use process/window identity metadata only. Do not inspect private window contents."
    };
  }
  if (route.includes("runtime_install") || route.includes("installed_runtime")) {
    return {
      evidenceMode: "runtime_install_metadata_only",
      compactFields: [
        "runtime display name",
        "version",
        "install path",
        "binary or manifest hash",
        "mtime/size"
      ],
      forbiddenFields: ["source file contents", "package private data", "software execution"],
      collectionBoundary:
        "Use install/version/path/hash metadata only to learn how the runtime should be monitored."
    };
  }
  if (route.includes("crash_helper") || route.includes("parent_process")) {
    return {
      evidenceMode: "crash_helper_parent_mapping_metadata_only",
      compactFields: [
        "helper process name",
        "parent process name/id when available",
        "mapped owning app",
        "crash artifact count",
        "artifact mtime/size/hash"
      ],
      forbiddenFields: ["crash dump contents", "memory dump content", "screenshots", "software commands"],
      collectionBoundary:
        "Map helper process to owning application and artifact metadata only; never open dump contents by default."
    };
  }
  if (route.includes("privacy") || route.includes("chat")) {
    return {
      evidenceMode: "privacy_sensitive_state_metadata_or_teacher_marker",
      compactFields: [
        "app/process identity",
        "state file existence",
        "state file mtime/size/hash",
        "teacher marker label"
      ],
      forbiddenFields: ["chat content", "contacts", "message history", "account identifiers", "screenshots"],
      collectionBoundary:
        "Use state metadata or a teacher marker only. Content inspection must stay blocked unless the teacher provides sanitized evidence."
    };
  }
  if (route.includes("browser") || route.includes("vendor") || route.includes("media")) {
    return {
      evidenceMode: "vendor_state_file_metadata_only",
      compactFields: [
        "state root",
        "file count",
        "extension histogram",
        "mtime/size/hash",
        "newest changed artifact"
      ],
      forbiddenFields: ["browser history", "account data", "media content", "screenshots", "software commands"],
      collectionBoundary:
        "Use file metadata only and keep user-content paths/content out of the evidence packet."
    };
  }
  return {
    evidenceMode: "manual_teacher_marker_or_generic_metadata",
    compactFields: [
      "software identity",
      "selected route id",
      "teacher marker",
      "mtime/size/hash if a safe artifact is identified"
    ],
    forbiddenFields: ["full log contents", "screenshots", "software commands", "private content"],
    collectionBoundary:
      "Ask the teacher which compact non-content signal represents the task before any collection."
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Low-Token Compact Evidence Request Pack",
    "",
    `Status: ${packet.status}`,
    `Eligible compact evidence rows: ${packet.counts.eligibleRows}`,
    `Blocked rows: ${packet.counts.blockedRows}`,
    "",
    "Purpose:",
    "- Turn teacher-reviewed fallback routes into exact compact evidence requests.",
    "- Keep the next step metadata-only and review-only.",
    "- Avoid full log reads, continuous recording, screenshots, target software execution, schedules, memory writes, and completion claims.",
    "",
    "Next:",
    "- Teacher reviews the receipt template.",
    "- Only confirmed rows can move into a later metadata collection command.",
    "- Any correction returns to high-reasoning repair rather than enabling rules directly.",
    "",
    `Receipt template: ${packet.paths.defaultReceipt}`,
    `Command template: ${packet.paths.commandTemplate}`
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const rows = packet.requestRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.routeId)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.evidenceMode)}</td>
        <td>${htmlEscape(row.nextTeacherQuestion)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Compact Evidence Request Pack</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    p, li { line-height: 1.55; }
    .panel, table { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 32, 56, .06); }
    .panel { padding: 16px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Low-Token Compact Evidence Request Pack</h1>
    <section class="panel">
      <p><strong>Status:</strong> ${htmlEscape(packet.status)}</p>
      <p><strong>Eligible rows:</strong> ${htmlEscape(packet.counts.eligibleRows)}; <strong>blocked rows:</strong> ${htmlEscape(packet.counts.blockedRows)}</p>
      <p>This pack is request-only. It does not run a metadata gate, read logs, capture screenshots, execute target software, register schedules, write memory, accept technology, unlock packaging, or claim goal completion.</p>
      <p><strong>Receipt template:</strong> <code>${htmlEscape(packet.paths.defaultReceipt)}</code></p>
      <p><strong>Command template:</strong> <code>${htmlEscape(packet.paths.commandTemplate)}</code></p>
    </section>
    <table>
      <thead><tr><th>#</th><th>Software</th><th>Route</th><th>Status</th><th>Evidence Mode</th><th>Teacher Question</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const draftInput = readJsonInput(
  argValue("--partial-draft", argValue("--draft", "")),
  "--partial-draft",
  "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_v1"
);
const draft = draftInput.value;
const receiptPath = argValue("--receipt", draft.paths?.draftReceipt || "");
const receiptInput = readJsonInput(
  receiptPath,
  "--receipt",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-request-packs")
  )
);

const lockState = locks();
const now = new Date().toISOString();
const packId = `${now.replace(/[:.]/g, "-")}-${slug(draft.draftId || "compact-evidence-request-pack")}`;
const packDir = join(outputRoot, packId);
const packPath = join(packDir, "original-goal-low-token-compact-evidence-request-pack.json");
const receiptTemplatePath = join(packDir, "teacher-low-token-compact-evidence-request-receipt-template.json");
const htmlPath = join(packDir, "original-goal-low-token-compact-evidence-request-pack.html");
const readmePath = join(packDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_REQUEST_PACK_START_HERE.md");
const commandTemplatePath = join(packDir, "run-confirmed-low-token-compact-evidence-collection.command.txt");
const validationCommandTemplatePath = join(packDir, "validate-low-token-compact-evidence-request-receipt.command.txt");

const sourceReceipt = receiptInput.value;
const rows = Array.isArray(sourceReceipt.receiptRows) ? sourceReceipt.receiptRows : [];
const requestRows = rows.map((row) => {
  const eligible =
    row.logSourceOrFallbackReviewed === true &&
    row.compactWatchEvidenceReviewed !== true &&
    row.teacherDecision !== "teacher_excluded_from_monitoring";
  const route = extractRoute(row);
  const plan = evidencePlanForRoute(route.routeId, route.routeKind);
  return {
    rowId: row.rowId || "",
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    routeId: route.routeId,
    routeKind: route.routeKind,
    sourceRouteOrFallbackSummary: route.summary,
    status: eligible ? "ready_for_teacher_confirmed_compact_evidence_request" : "blocked_before_compact_evidence_request",
    readyForTeacherConfirmedCompactEvidenceRequest: eligible,
    blockers: eligible
      ? []
      : [
          row.logSourceOrFallbackReviewed === true ? "" : "fallback_route_not_reviewed",
          row.compactWatchEvidenceReviewed === true ? "compact_evidence_already_reviewed" : "",
          row.teacherDecision === "teacher_excluded_from_monitoring" ? "teacher_excluded_from_monitoring" : ""
        ].filter(Boolean),
    evidenceMode: plan.evidenceMode,
    compactFields: plan.compactFields,
    forbiddenFields: plan.forbiddenFields,
    collectionBoundary: plan.collectionBoundary,
    nextTeacherQuestion:
      "Confirm this metadata-only evidence request, exclude the row, or provide a correction that should return to high-reasoning repair.",
    reviewedEvidencePathOrSignal: row.reviewedEvidencePathOrSignal || "",
    locks: lockState
  };
});

const eligibleRows = requestRows.filter((row) => row.readyForTeacherConfirmedCompactEvidenceRequest);
const blockedRows = requestRows.filter((row) => !row.readyForTeacherConfirmedCompactEvidenceRequest);
const defaultReceipt = {
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_v1",
  receiptFor: "original_goal_low_token_compact_evidence_request_pack",
  sourceRequestPackPath: packPath,
  sourcePartialDraftPath: draftInput.path,
  sourceFallbackRouteReceiptPath: receiptInput.path,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "compact_metadata_request_confirmed",
    "blocked_needs_manual_teacher_marker",
    "teacher_excluded_from_monitoring",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "run_metadata_gate_now",
    "run_watch_cycle_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "register_schedule",
    "unlock_packaging",
    "claim_complete"
  ],
  rollbackRetained: false,
  noFullLogReadConfirmed: true,
  noScreenshotConfirmed: true,
  noSoftwareExecutionConfirmed: true,
  requestRows: requestRows.map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    routeId: row.routeId,
    evidenceMode: row.evidenceMode,
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "compact_metadata_request_confirmed",
      "blocked_needs_manual_teacher_marker",
      "teacher_excluded_from_monitoring",
      "correction_to_high_reasoning_repair"
    ],
    reviewedCompactEvidenceRequest: false,
    compactEvidenceCollected: false,
    teacherNote: "",
    blockers: row.blockers
  })),
  locks: lockState
};

const commandTemplate = commandLine("run-original-goal-low-token-compact-evidence-request.mjs", [
  ["--validation", "<ready-compact-evidence-request-receipt-validation.json>"],
  ["--run-confirmed-metadata-only", "true"],
  ["--allow-compact-evidence-runner", "true"],
  ["--teacher-confirmation", "<teacher-confirmed-compact-evidence-request-text>"],
  ["--rollback-point-created", "true"],
  ["--rollback-point", "<retained-rollback-point-path-or-label>"],
  ["--output-dir", join(packDir, "confirmed-compact-evidence-collection")]
]);
const validationCommandTemplate = commandLine("validate-original-goal-low-token-compact-evidence-request-receipt.mjs", [
  ["--request-pack", packPath],
  ["--receipt", "<teacher-filled-compact-evidence-request-receipt.json>"],
  ["--output-dir", join(packDir, "compact-evidence-request-receipt-validation")]
]);

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1",
  packId,
  createdAt: now,
  sourcePartialDraftPath: draftInput.path,
  sourceFallbackRouteReceiptPath: receiptInput.path,
  status: eligibleRows.length > 0
    ? "waiting_for_teacher_compact_evidence_request_review"
    : "blocked_no_rows_ready_for_compact_evidence_request",
  counts: {
    sourceRows: rows.length,
    eligibleRows: eligibleRows.length,
    blockedRows: blockedRows.length,
    windowsEventMetadataRows: eligibleRows.filter((row) => row.evidenceMode === "windows_event_metadata_only").length,
    processWindowMetadataRows: eligibleRows.filter((row) => row.evidenceMode === "process_window_metadata_only").length,
    runtimeInstallMetadataRows: eligibleRows.filter((row) => row.evidenceMode === "runtime_install_metadata_only").length,
    crashHelperParentMappingRows: eligibleRows.filter((row) => row.evidenceMode === "crash_helper_parent_mapping_metadata_only").length,
    privacySensitiveRows: eligibleRows.filter((row) => row.evidenceMode === "privacy_sensitive_state_metadata_or_teacher_marker").length
  },
  requestRows,
  paths: {
    packet: packPath,
    defaultReceipt: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    commandTemplate: commandTemplatePath,
    validationCommandTemplate: validationCommandTemplatePath
  },
  commandTemplate,
  validationCommandTemplate,
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(packPath, packet);
writeJson(receiptTemplatePath, defaultReceipt);
writeFileSync(commandTemplatePath, `${commandTemplate}\n`, "utf8");
writeFileSync(validationCommandTemplatePath, `${validationCommandTemplate}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      packPath,
      defaultReceiptPath: receiptTemplatePath,
      htmlPath,
      readmePath,
      commandTemplatePath,
      validationCommandTemplatePath,
      counts: packet.counts,
      status: packet.status,
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
