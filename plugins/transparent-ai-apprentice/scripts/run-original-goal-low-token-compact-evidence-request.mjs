#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "low-token-compact-evidence-run")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "low-token-compact-evidence-run"
  );
}

function hashText(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex").slice(0, 16);
}

function hasTeacherConfirmation(value) {
  const text = String(value || "").trim();
  return text.length >= 8 && /confirm|confirmed|teacher|review|approve|ok|yes|确认|同意|老师|审核|已看/i.test(text);
}

function retainedRollbackPoint(path) {
  if (!path || !existsSync(path)) return { ok: false, reason: "rollback_point_path_not_found", manifestPath: "" };
  const stats = statSync(path);
  const manifestPath = stats.isDirectory() ? join(path, "rollback-point.json") : path;
  if (!existsSync(manifestPath)) return { ok: false, reason: "rollback_point_manifest_not_found", manifestPath };
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch {
    return { ok: false, reason: "rollback_point_manifest_not_valid_json", manifestPath };
  }
  const ok =
    manifest.format === "transparent_ai_rollback_point_v1" &&
    manifest.status === "waiting_for_teacher_confirmation" &&
    manifest.deleteOnlyAfterTeacherConfirmation === true;
  return {
    ok,
    reason: ok ? "" : "rollback_point_manifest_not_retained_contract",
    manifestPath,
    rollbackDir: stats.isDirectory() ? path : dirname(path),
    manifest
  };
}

function locks({ runnerInvoked = false } = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    compactEvidenceRunnerInvoked: runnerInvoked,
    metadataOnlyCollection: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function failClosed(message, details = {}) {
  const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-runs")));
  mkdirSync(outputRoot, { recursive: true });
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-blocked-${slug(message)}`;
  const runDir = join(outputRoot, runId);
  const runPath = join(runDir, "original-goal-low-token-compact-evidence-run.json");
  const packet = {
    ok: false,
    format: "transparent_ai_original_goal_low_token_compact_evidence_run_v1",
    runId,
    status: "blocked",
    blockedReason: message,
    details,
    locks: locks(),
    executeNow: false,
    goalComplete: false
  };
  writeJson(runPath, packet);
  console.log(JSON.stringify({ ok: false, runPath, status: "blocked", blockedReason: message, locks: packet.locks }, null, 2));
  process.exit(1);
}

function safePowerShellJson(command, timeout = 20000) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", timeout }
  );
  if (result.status !== 0) return { ok: false, error: result.stderr || result.stdout || `powershell exited ${result.status}` };
  try {
    return { ok: true, value: JSON.parse(result.stdout || "null") };
  } catch {
    return { ok: false, error: "powershell_json_parse_failed", stdout: result.stdout };
  }
}

function processMetadata(software) {
  const needle = String(software || "").replace(/'/g, "''").slice(0, 80);
  const ps = `
$needle='${needle}'.ToLowerInvariant()
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName.ToLowerInvariant().Contains($needle) -or $needle.Contains($_.ProcessName.ToLowerInvariant()) } |
  Select-Object -First 8 ProcessName,Id,@{Name='WorkingSetMB';Expression={[math]::Round($_.WorkingSet64/1MB,1)}},@{Name='PathHash';Expression={ if ($_.Path) { $bytes=[System.Text.Encoding]::UTF8.GetBytes($_.Path); $sha=[System.Security.Cryptography.SHA256]::Create(); ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').Substring(0,16).ToLowerInvariant() } else { '' } }} |
  ConvertTo-Json -Depth 4
`;
  const result = safePowerShellJson(ps);
  return {
    source: "process_metadata",
    ok: result.ok,
    count: Array.isArray(result.value) ? result.value.length : result.value ? 1 : 0,
    rows: Array.isArray(result.value) ? result.value : result.value ? [result.value] : [],
    error: result.error || ""
  };
}

function eventMetadata() {
  const ps = `
$since=(Get-Date).AddHours(-6)
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since} -MaxEvents 120 -ErrorAction SilentlyContinue |
  Group-Object ProviderName,Id,LevelDisplayName |
  Select-Object -First 20 @{Name='ProviderIdLevel';Expression={$_.Name}},Count |
  ConvertTo-Json -Depth 4
`;
  const result = safePowerShellJson(ps, 30000);
  return {
    source: "windows_event_metadata",
    ok: result.ok,
    windowHours: 6,
    groupCount: Array.isArray(result.value) ? result.value.length : result.value ? 1 : 0,
    histogram: Array.isArray(result.value) ? result.value : result.value ? [result.value] : [],
    messageBodiesRead: false,
    error: result.error || ""
  };
}

function runtimeInstallMetadata() {
  const roots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.ProgramData,
    process.env.LOCALAPPDATA
  ].filter(Boolean);
  return {
    source: "runtime_install_metadata",
    roots: roots.map((root) => {
      try {
        const stat = statSync(root);
        return {
          pathHash: hashText(resolve(root)),
          exists: true,
          mtimeUtc: stat.mtime.toISOString(),
          size: stat.size
        };
      } catch {
        return { pathHash: hashText(root), exists: false };
      }
    }),
    fileContentsRead: false
  };
}

function genericMetadata(row) {
  return {
    source: "generic_request_metadata",
    routeId: row.routeId,
    routeKind: row.routeKind,
    evidenceMode: row.evidenceMode,
    softwareHash: hashText(row.software),
    compactFieldCount: Array.isArray(row.compactFields) ? row.compactFields.length : 0,
    contentRead: false
  };
}

function collectMetadata(row, fixtureByRowId) {
  const fixture = fixtureByRowId.get(row.rowId);
  if (fixture) {
    return {
      source: "metadata_fixture",
      fixtureUsed: true,
      evidenceMode: row.evidenceMode,
      compactEvidence: fixture.compactEvidence || fixture,
      contentRead: false
    };
  }
  const mode = String(row.evidenceMode || "");
  if (mode === "windows_event_metadata_only") return eventMetadata();
  if (mode === "process_window_metadata_only" || mode === "crash_helper_parent_mapping_metadata_only") {
    return processMetadata(row.software);
  }
  if (mode === "runtime_install_metadata_only") return runtimeInstallMetadata();
  return genericMetadata(row);
}

const validationPath = resolve(argValue("--validation", argValue("--receipt-validation", "")));
if (!validationPath || !existsSync(validationPath)) failClosed("validation_json_is_required", { validationPath });
const validation = readJson(validationPath);
if (validation.format !== "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_validation_v1") {
  failClosed("validation_format_not_supported", { format: validation.format || "" });
}
if (validation.status !== "validated_with_prepared_compact_metadata_collection_command" && validation.ok !== true) {
  failClosed("validation_status_not_ready", { status: validation.status || "", ok: validation.ok });
}
if (!hasFlag("--run-confirmed-metadata-only") || !hasFlag("--allow-compact-evidence-runner")) {
  failClosed("runner_requires_explicit_run_flags", {
    requiredFlags: ["--run-confirmed-metadata-only", "--allow-compact-evidence-runner"]
  });
}
const teacherConfirmation = argValue("--teacher-confirmation", "");
if (!hasTeacherConfirmation(teacherConfirmation)) {
  failClosed("runner_requires_teacher_confirmation_text", { teacherConfirmation });
}
const rollbackPoint = resolve(argValue("--rollback-point", ""));
if (!rollbackPoint || !existsSync(rollbackPoint)) {
  failClosed("runner_requires_existing_retained_rollback_point", { rollbackPoint });
}
const rollbackPointContract = retainedRollbackPoint(rollbackPoint);
if (!rollbackPointContract.ok) {
  failClosed("runner_requires_retained_rollback_point_manifest", {
    rollbackPoint,
    reason: rollbackPointContract.reason,
    manifestPath: rollbackPointContract.manifestPath
  });
}

const fixturePath = argValue("--metadata-fixture", "");
const fixture = fixturePath && existsSync(fixturePath) ? readJson(resolve(fixturePath)) : {};
const fixtureRows = Array.isArray(fixture.rows) ? fixture.rows : [];
const fixtureByRowId = new Map(fixtureRows.map((row) => [String(row.rowId || ""), row]));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-runs")));
mkdirSync(outputRoot, { recursive: true });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(validation.validationId || "compact-evidence-run")}`;
const runDir = join(outputRoot, runId);
const runPath = join(runDir, "original-goal-low-token-compact-evidence-run.json");
const receiptPath = join(runDir, "original-goal-low-token-compact-evidence-run-receipt.json");
const readmePath = join(runDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_RUN_START_HERE.md");
const readyRows = (validation.validationRows || []).filter((row) => row.readyForMetadataOnlyCollection === true);
const evidenceRows = readyRows.map((row) => {
  const collected = collectMetadata(row, fixtureByRowId);
  return {
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    routeId: row.routeId || "",
    evidenceMode: row.evidenceMode || "",
    status: "metadata_only_evidence_collected_waiting_for_teacher_review",
    collected,
    compactEvidenceHash: hashText(JSON.stringify(collected)),
    contentBoundary: {
      logContentsRead: false,
      fullLogsRead: false,
      screenshotsCaptured: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false
    }
  };
});
const lockState = locks({ runnerInvoked: true });
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  status: "metadata_only_evidence_collected_waiting_for_teacher_review",
  sourceValidationPath: validationPath,
  teacherConfirmation,
  rollbackPoint,
  rollbackPointManifest: rollbackPointContract.manifestPath,
  rollbackPointContract: {
    format: rollbackPointContract.manifest?.format || "",
    status: rollbackPointContract.manifest?.status || "",
    deleteOnlyAfterTeacherConfirmation:
      rollbackPointContract.manifest?.deleteOnlyAfterTeacherConfirmation === true
  },
  metadataFixturePath: fixturePath ? resolve(fixturePath) : "",
  counts: {
    readyRows: readyRows.length,
    evidenceRows: evidenceRows.length,
    fixtureRowsUsed: evidenceRows.filter((row) => row.collected.fixtureUsed === true).length
  },
  evidenceRows,
  paths: {
    run: runPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceValidation: validationPath
  },
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false,
    reason:
      "This runner only collected metadata-only compact evidence for teacher-reviewed rows. Teacher review, rule extraction, cockpit return, recurring registration, and native software execution proof remain required."
  },
  locks: lockState,
  goalComplete: false
};
const receipt = {
  format: "transparent_ai_original_goal_low_token_compact_evidence_run_receipt_v1",
  sourceRunPath: runPath,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "metadata_evidence_reviewed_return_to_cockpit",
    "blocked_needs_more_metadata_evidence",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "enable_rule_now",
    "write_memory_now",
    "execute_software_now",
    "register_schedule_now",
    "unlock_packaging",
    "claim_complete"
  ],
  rollbackRetained: false,
  evidenceRows: evidenceRows.map((row) => ({
    rowId: row.rowId,
    software: row.software,
    evidenceMode: row.evidenceMode,
    compactEvidenceHash: row.compactEvidenceHash,
    teacherDecision: "needs_teacher_review",
    reviewedMetadataEvidence: false,
    teacherNote: ""
  })),
  locks: lockState
};
writeJson(runPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Compact Evidence Run",
    "",
    `Status: ${packet.status}`,
    `Evidence rows: ${evidenceRows.length}`,
    "",
    "This runner collected metadata-only compact evidence. It did not read full logs, retain raw log contents, capture screenshots, execute target software, register schedules, write memory, enable rules, or claim goal completion.",
    "",
    `Teacher review receipt: ${receiptPath}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      runPath,
      receiptPath,
      readmePath,
      status: packet.status,
      counts: packet.counts,
      locks: lockState,
      goalComplete: false
    },
    null,
    2
  )
);
