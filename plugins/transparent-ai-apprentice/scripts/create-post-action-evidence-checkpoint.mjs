#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return (
    String(value || "post-action-evidence")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "post-action-evidence"
  );
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function safeStat(targetPath, maxChildren) {
  const resolved = resolve(targetPath);
  if (!existsSync(resolved)) {
    return {
      path: resolved,
      exists: false,
      kind: "missing",
      name: basename(resolved),
      extension: extname(resolved).toLowerCase(),
      contentRead: false
    };
  }
  const stats = statSync(resolved);
  const item = {
    path: resolved,
    exists: true,
    kind: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
    name: basename(resolved),
    extension: extname(resolved).toLowerCase(),
    sizeBytes: stats.isFile() ? stats.size : null,
    mtimeMs: Math.trunc(stats.mtimeMs),
    mtimeIso: stats.mtime.toISOString(),
    contentRead: false
  };
  if (stats.isDirectory()) {
    const children = readdirSync(resolved, { withFileTypes: true }).slice(0, maxChildren);
    item.childCountSampled = children.length;
    item.children = children.map((child) => {
      const childPath = join(resolved, child.name);
      let childStats = null;
      try {
        childStats = statSync(childPath);
      } catch {
        childStats = null;
      }
      return {
        name: child.name,
        kind: child.isDirectory() ? "directory" : child.isFile() ? "file" : "other",
        extension: extname(child.name).toLowerCase(),
        sizeBytes: childStats?.isFile() ? childStats.size : null,
        mtimeMs: childStats ? Math.trunc(childStats.mtimeMs) : null,
        contentRead: false
      };
    });
  }
  return item;
}

function normalizeState(packet) {
  if (!packet) return null;
  if (packet.format === "transparent_ai_post_action_low_token_state_snapshot_v1") return packet;
  if (packet.stateSnapshot?.format === "transparent_ai_post_action_low_token_state_snapshot_v1") return packet.stateSnapshot;
  return null;
}

function itemKey(item) {
  return item.path || item.name;
}

function compareStates(beforeState, afterState) {
  if (!beforeState || !afterState) {
    return {
      compared: false,
      changedItems: [],
      unchangedItems: [],
      missingBefore: !beforeState,
      missingAfter: !afterState
    };
  }
  const beforeMap = new Map((beforeState.items ?? []).map((item) => [itemKey(item), item]));
  const afterMap = new Map((afterState.items ?? []).map((item) => [itemKey(item), item]));
  const keys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();
  const changedItems = [];
  const unchangedItems = [];
  for (const key of keys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    const changed =
      !before ||
      !after ||
      before.exists !== after.exists ||
      before.kind !== after.kind ||
      before.sizeBytes !== after.sizeBytes ||
      before.mtimeMs !== after.mtimeMs ||
      before.childCountSampled !== after.childCountSampled ||
      JSON.stringify(before.children ?? []) !== JSON.stringify(after.children ?? []);
    const row = {
      path: key,
      beforeExists: before?.exists ?? false,
      afterExists: after?.exists ?? false,
      beforeSizeBytes: before?.sizeBytes ?? null,
      afterSizeBytes: after?.sizeBytes ?? null,
      beforeMtimeMs: before?.mtimeMs ?? null,
      afterMtimeMs: after?.mtimeMs ?? null,
      contentRead: false
    };
    if (changed) changedItems.push(row);
    else unchangedItems.push(row);
  }
  return {
    compared: true,
    changedItems,
    unchangedItems,
    changedItemCount: changedItems.length,
    unchangedItemCount: unchangedItems.length,
    contentRead: false
  };
}

function receiptStatus(receipt) {
  return String(receipt?.status || "unknown");
}

function receiptFamily(receipt) {
  if (receipt?.format === "transparent_ai_existing_software_execution_receipt_v1") return "existing_software_execution";
  if (receipt?.format === "transparent_ai_supervised_software_action_execution_receipt_v1") return "supervised_ui_action";
  return receipt ? "unknown_receipt" : "none";
}

function receiptWasDryRun(receipt) {
  const status = receiptStatus(receipt);
  return status === "dry_run" || status.startsWith("dry_run_no_") || receipt?.mode === "dry_run";
}

function receiptWasBlocked(receipt) {
  const status = receiptStatus(receipt);
  return status.startsWith("blocked_") || status === "blocked_by_preflight";
}

function receiptLooksExecuted(receipt) {
  const status = receiptStatus(receipt);
  return (
    Boolean(receipt?.teacherConfirmed) &&
    (Boolean(receipt?.executeSwitchPresent) ||
      Boolean(receipt?.execute) ||
      status.includes("executed") ||
      status.includes("completed") ||
      Number(receipt?.executedActionIds?.length ?? 0) > 0)
  );
}

function checkpointStatus(receipt, comparison, metadataGateResult, teacherMarkers) {
  if (receipt && receiptWasDryRun(receipt)) return "dry_run_checkpoint_verified_no_software_events";
  if (receipt && receiptWasBlocked(receipt)) return "blocked_checkpoint_verified_before_software_events";
  const changed =
    Number(comparison?.changedItemCount ?? 0) > 0 ||
    Number(metadataGateResult?.changedLogMetadata ?? 0) > 0 ||
    teacherMarkers.length > 0;
  if (receipt && receiptLooksExecuted(receipt) && changed) return "post_action_changed_waiting_for_teacher_review";
  if (receipt && receiptLooksExecuted(receipt) && !changed) return "post_action_no_cheap_change_waiting_for_teacher_or_visual_check";
  if (!comparison?.compared) return "state_checkpoint_captured_waiting_for_after_state";
  if (changed) return "state_changed_waiting_for_teacher_review";
  return "state_unchanged_waiting_for_teacher_review";
}

function nextTeacherActionFor(status) {
  if (status === "dry_run_checkpoint_verified_no_software_events") {
    return "Review the dry-run receipt and checkpoint before any teacher-confirmed execution.";
  }
  if (status === "blocked_checkpoint_verified_before_software_events") {
    return "Fix the blocker, route input, target window, or confirmation gate before execution.";
  }
  if (status === "post_action_changed_waiting_for_teacher_review") {
    return "Review the changed metadata against the teacher intent before saving memory or asking for a visual check.";
  }
  if (status === "post_action_no_cheap_change_waiting_for_teacher_or_visual_check") {
    return "Ask the teacher if the visible result changed; request one bounded screenshot only if cheap evidence is insufficient.";
  }
  if (status === "state_checkpoint_captured_waiting_for_after_state") {
    return "Capture the after-state with the same watched paths after the teacher-reviewed action.";
  }
  return "Ask the teacher whether this state delta matches the intended operation before learning.";
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "post-action-evidence-checkpoints")));
const goal = argValue("--goal", argValue("--task", "Verify software action outcome with low-token before/after evidence."));
const software = argValue("--software", argValue("--app", "target software"));
const phase = argValue("--phase", "");
const maxChildren = Number(argValue("--max-children", "24"));
const watchedPaths = [...multiArg("--file"), ...multiArg("--path"), ...multiArg("--watch-path")];
const receiptInput = readJsonInput(argValue("--receipt", argValue("--execution-receipt", "")), "--receipt", true);
const beforeInput = readJsonInput(argValue("--before-state", argValue("--before", "")), "--before-state", true);
const afterInput = readJsonInput(argValue("--after-state", argValue("--after", "")), "--after-state", true);
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue", true);
const teacherMarkers = multiArg("--teacher-marker");
const stateDir = argValue("--state-dir", join(outputRoot, "_metadata-state"));
const state = argValue("--state", "");
const maxItems = argValue("--max-items", "12");
const maxLogsPerItem = argValue("--max-logs-per-item", "8");

mkdirSync(outputRoot, { recursive: true });
const checkpointId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(software)}`;
const checkpointDir = join(outputRoot, checkpointId);
mkdirSync(checkpointDir, { recursive: true });

const nowState = {
  format: "transparent_ai_post_action_low_token_state_snapshot_v1",
  checkpointId,
  createdAt: new Date().toISOString(),
  phase: phase || (beforeInput.value ? "after" : "before"),
  goal,
  software,
  strategy:
    "Capture only cheap state metadata: exists, kind, size, mtime, sampled directory child metadata, log metadata, and teacher markers. Do not read file contents, capture screenshots, continuously record, execute software, or write memory.",
  items: watchedPaths.map((targetPath) => safeStat(targetPath, maxChildren)),
  teacherMarkers,
  locks: {
    fileContentsRead: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true
  }
};

const beforeState = normalizeState(beforeInput.value);
const explicitAfterState = normalizeState(afterInput.value);
const afterState = explicitAfterState || nowState;
const comparison = compareStates(beforeState, afterState);

let metadataGateResult = null;
if (queueInput.value) {
  const args = [
    "--queue",
    queueInput.path || JSON.stringify(queueInput.value),
    "--output-dir",
    join(checkpointDir, "metadata-gate"),
    "--state-dir",
    stateDir,
    "--max-items",
    maxItems,
    "--max-logs-per-item",
    maxLogsPerItem
  ];
  if (state) args.push("--state", state);
  for (const marker of teacherMarkers) args.push("--teacher-marker", marker);
  metadataGateResult = runNodeScript("watch-log-source-metadata-deltas.mjs", args);
}

const receipt = receiptInput.value;
const status = checkpointStatus(receipt, comparison, metadataGateResult, teacherMarkers);
const screenshotRecommended = status === "post_action_no_cheap_change_waiting_for_teacher_or_visual_check";
const statePath = join(checkpointDir, "state-snapshot.json");
const checkpointPath = join(checkpointDir, "post-action-evidence-checkpoint.json");
const receiptPath = join(checkpointDir, "post-action-evidence-checkpoint-receipt.json");
const readmePath = join(checkpointDir, "POST_ACTION_EVIDENCE_CHECKPOINT_START_HERE.md");

const locks = {
  reviewOnly: true,
  fileContentsRead: false,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  memoryWritten: false,
  outcomeAccepted: false,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherConfirmationRequired: true
};

const checkpoint = {
  format: "transparent_ai_post_action_low_token_evidence_checkpoint_v1",
  checkpointId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status,
  lowTokenStrategy:
    "Compare before/after cheap state metadata plus execution receipts, metadata-only log gates, and teacher markers before reading tails, requesting one screenshot, or learning.",
  sourceEvidence: {
    receiptPath: receiptInput.path,
    beforeStatePath: beforeInput.path,
    afterStatePath: afterInput.path || statePath,
    queuePath: queueInput.path,
    watchedPathCount: watchedPaths.length,
    teacherMarkers
  },
  executionReceipt: receipt
    ? {
        family: receiptFamily(receipt),
        format: receipt.format || "unknown",
        status: receiptStatus(receipt),
        mode: receipt.mode || "",
        teacherConfirmed: Boolean(receipt.teacherConfirmed),
        executeSwitchPresent: Boolean(receipt.executeSwitchPresent || receipt.execute),
        executedActionIds: Array.isArray(receipt.executedActionIds) ? receipt.executedActionIds.map(String) : [],
        uiEventsSent: receipt.uiEventsSent ?? null,
        commandExecuted: receipt.commandExecuted ?? null,
        apiRequestSent: receipt.apiRequestSent ?? null,
        filesWrittenForImport: receipt.filesWrittenForImport ?? null
      }
    : null,
  stateComparison: comparison,
  metadataGate: metadataGateResult
    ? {
        status: metadataGateResult.status,
        gatePath: metadataGateResult.gatePath,
        receiptPath: metadataGateResult.receiptPath,
        narrowedQueuePath: metadataGateResult.narrowedQueuePath,
        changedLogMetadata: metadataGateResult.changedLogMetadata,
        scannedLogMetadata: metadataGateResult.scannedLogMetadata,
        logContentsRead: false,
        screenshotsCaptured: false,
        fullContinuousRecording: false
      }
    : null,
  result: {
    status,
    outcomeAccepted: false,
    canSaveRule: false,
    canUnlockPackaging: false,
    teacherReviewRequired: true,
    screenshotRecommended,
    maxScreenshots: screenshotRecommended ? 1 : 0,
    nextTeacherAction: nextTeacherActionFor(status)
  },
  nextCalls: [
    {
      tool: "verify_supervised_action_outcome",
      when: "Use when there is an execution receipt and the teacher wants receipt/preflight/log metadata verification in the existing outcome verifier.",
      arguments: { receipt: receiptInput.path || "execution receipt JSON", queue: queueInput.path || "optional reviewed observer queue" }
    },
    screenshotRecommended
      ? {
          tool: "create_triggered_visual_check_request",
          when: "Only if the teacher agrees cheap state evidence is insufficient.",
          arguments: {
            goal,
            software,
            forceRequest: true,
            maxRequests: 1
          }
        }
      : null,
    {
      tool: "teach_apprentice",
      when: "Only after the teacher confirms whether the state delta matches the intended outcome.",
      arguments: { message: "Teacher-reviewed post-action checkpoint plus correction or approval.", file: checkpointPath }
    },
    {
      tool: "correct_last_result",
      when: "If the checkpoint contradicts the teacher intent.",
      arguments: { correction: "Teacher describes the mismatch and desired boundary." }
    }
  ].filter(Boolean),
  locks
};

const checkpointReceipt = {
  format: "transparent_ai_post_action_low_token_evidence_checkpoint_receipt_v1",
  checkpointId,
  status,
  checkpointPath,
  statePath,
  beforeStatePath: beforeInput.path,
  afterStatePath: afterInput.path || statePath,
  changedItemCount: comparison.changedItemCount ?? 0,
  changedLogMetadata: metadataGateResult?.changedLogMetadata ?? 0,
  screenshotRecommended,
  maxScreenshots: screenshotRecommended ? 1 : 0,
  outcomeAccepted: false,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fileContentsRead: false,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  nextTeacherAction: checkpoint.result.nextTeacherAction
};

writeFileSync(statePath, JSON.stringify(nowState, null, 2), "utf8");
writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(checkpointReceipt, null, 2), "utf8");
writeFileSync(
  readmePath,
  [
    "# Post-Action Low-Token Evidence Checkpoint",
    "",
    "This checkpoint compares cheap before/after evidence before learning from a software action.",
    "",
    "Review order:",
    "1. Inspect the execution receipt status and teacher confirmation fields.",
    "2. Compare changed file/directory metadata and optional log metadata gates.",
    "3. Ask the teacher whether the changed state matches the intended visible result.",
    "4. Request one bounded screenshot only if cheap evidence is insufficient.",
    "5. Paste the checkpoint into `teach_apprentice` only after teacher review.",
    "",
    "Locked defaults: fileContentsRead=false, logContentsRead=false, screenshotsCaptured=false, fullContinuousRecording=false, softwareActionsExecuted=false, nativeUniversalExecution=false, outcomeAccepted=false, ruleEnabled=false, accepted=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_post_action_low_token_evidence_checkpoint_result_v1",
      status,
      checkpointId,
      checkpointPath,
      statePath,
      receiptPath,
      readmePath,
      changedItemCount: comparison.changedItemCount ?? 0,
      changedLogMetadata: metadataGateResult?.changedLogMetadata ?? 0,
      screenshotRecommended,
      maxScreenshots: screenshotRecommended ? 1 : 0,
      outcomeAccepted: false,
      ruleEnabled: false,
      accepted: false,
      technologyAccepted: false,
      packagingGated: true,
      fileContentsRead: false,
      logContentsRead: false,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false
    },
    null,
    2
  )
);
