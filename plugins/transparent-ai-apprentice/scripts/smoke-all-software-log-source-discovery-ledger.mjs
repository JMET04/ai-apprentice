#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = mkdtempSync(join(tmpdir(), "transparent-ai-log-source-ledger-"));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function findRow(ledger, software) {
  return ledger.rows.find((row) => row.software === software);
}

const directLogPath = join(smokeRoot, "has-direct-log.log");
writeFileSync(directLogPath, "fixture baseline\n", "utf8");

const inventoryPath = join(smokeRoot, "inventory.json");
const queuePath = join(smokeRoot, "queue.json");
writeFileSync(inventoryPath, JSON.stringify({
  format: "transparent_ai_software_observer_inventory_v1",
  inventoryId: "fixture-log-source-discovery",
  goal: "Fixture all-software log source discovery",
  softwareCandidates: [
    {
      software: "HasDirectLog",
      processName: "direct",
      candidateLogFiles: [{ path: directLogPath, bytes: 17, lastWriteTimeUtc: "2026-06-12T00:00:00.000Z" }],
      candidateLogRoots: [smokeRoot],
      windowsEventLogs: ["Application"],
      reason: "fixture_direct_log"
    },
    {
      software: "NoLogFallbackApp",
      processName: "fallback",
      candidateLogFiles: [],
      candidateLogRoots: [join(smokeRoot, "fallback-root")],
      windowsEventLogs: ["Application"],
      reason: "fixture_no_log_with_queue_fallback"
    },
    {
      software: "EventOnlyApp",
      processName: "eventonly",
      candidateLogFiles: [],
      candidateLogRoots: [],
      windowsEventLogs: ["Application", "System"],
      reason: "fixture_event_only"
    },
    {
      software: "MissingSourceApp",
      processName: "missing",
      candidateLogFiles: [],
      candidateLogRoots: [],
      windowsEventLogs: [],
      reason: "fixture_missing_source"
    },
    {
      software: "PrivateApp",
      processName: "private",
      candidateLogFiles: [],
      candidateLogRoots: [],
      windowsEventLogs: [],
      reason: "fixture_teacher_excluded"
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
}, null, 2), "utf8");

writeFileSync(queuePath, JSON.stringify({
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "fixture-log-source-discovery-queue",
  queue: [
    {
      queueItemId: "hasdirectlog-direct",
      software: "HasDirectLog",
      processName: "direct",
      recentLogCandidates: [{ path: directLogPath, source: "fixture_queue_log" }],
      nextMetadataDeltaGateCall: {
        tool: "watch_log_source_metadata_deltas",
        arguments: { queue: queuePath, item: "hasdirectlog-direct" }
      }
    },
    {
      queueItemId: "nologfallbackapp-fallback",
      software: "NoLogFallbackApp",
      processName: "fallback",
      recentLogCandidates: [],
      nonLogFallbackRequired: true,
      nonLogFallbackSignals: [
        { sourceType: "process_window_metadata", lowTokenUse: "metadata_only" },
        { sourceType: "manual_teacher_marker", lowTokenUse: "short_teacher_label" }
      ],
      nextNonLogFallbackRunCall: {
        tool: "run_software_observer_queue_item",
        arguments: { queue: queuePath, item: "nologfallbackapp-fallback", nonLogFallback: true }
      }
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
}, null, 2), "utf8");

const result = runNodeScript("create-all-software-log-source-discovery-ledger.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queuePath,
  "--teacher-excluded",
  "PrivateApp",
  "--output-dir",
  join(smokeRoot, "out")
]);
const ledger = readJson(result.ledgerPath);
const receipt = readJson(result.receiptPath);

const checks = [
  {
    name: "Log source discovery ledger writes expected artifact format",
    pass:
      result.format === "transparent_ai_all_software_log_source_discovery_ledger_result_v1" &&
      ledger.format === "transparent_ai_all_software_log_source_discovery_ledger_v1" &&
      receipt.format === "transparent_ai_all_software_log_source_discovery_ledger_receipt_v1" &&
      existsSync(result.teacherReadme),
    evidence: result.ledgerPath
  },
  {
    name: "Direct log candidates route to metadata gate before tail read",
    pass:
      findRow(ledger, "HasDirectLog")?.discoveryStatus === "direct_log_candidates_ready_for_metadata_gate" &&
      findRow(ledger, "HasDirectLog")?.canAttemptAutomaticLogReadAfterMetadataGate === true &&
      JSON.stringify(findRow(ledger, "HasDirectLog")?.nextActions || []).includes("watch_log_source_metadata_deltas"),
    evidence: JSON.stringify(findRow(ledger, "HasDirectLog")?.nextActions)
  },
  {
    name: "No-log apps route to low-token fallback before screenshots",
    pass:
      findRow(ledger, "NoLogFallbackApp")?.discoveryStatus === "non_log_low_token_fallback_ready_for_review" &&
      findRow(ledger, "NoLogFallbackApp")?.nonLogFallbackSignalCount === 2 &&
      JSON.stringify(findRow(ledger, "NoLogFallbackApp")?.nextActions || []).includes("run_software_observer_queue_item"),
    evidence: JSON.stringify(findRow(ledger, "NoLogFallbackApp")?.nextActions)
  },
  {
    name: "Event-only apps get Windows Event fallback route",
    pass:
      findRow(ledger, "EventOnlyApp")?.discoveryStatus === "windows_event_log_fallback_ready_for_review" &&
      JSON.stringify(findRow(ledger, "EventOnlyApp")?.nextActions || []).includes("create_software_capability_profile"),
    evidence: JSON.stringify(findRow(ledger, "EventOnlyApp")?.nextActions)
  },
  {
    name: "Rows with no source ask teacher for source or exclusion",
    pass:
      findRow(ledger, "MissingSourceApp")?.discoveryStatus === "needs_teacher_log_source_or_exclusion" &&
      JSON.stringify(findRow(ledger, "MissingSourceApp")?.nextActions || []).includes("ask_teacher_for_log_source_marker_or_exclusion"),
    evidence: JSON.stringify(findRow(ledger, "MissingSourceApp")?.nextActions)
  },
  {
    name: "Teacher exclusions stay locked and do not become coverage",
    pass:
      findRow(ledger, "PrivateApp")?.discoveryStatus === "teacher_excluded_or_private" &&
      ledger.allSoftwareLogSourceDiscoveryComplete === false &&
      receipt.allSoftwareLogSourceDiscoveryComplete === false,
    evidence: JSON.stringify(findRow(ledger, "PrivateApp"))
  },
  {
    name: "Ledger exposes review status without claiming completion",
    pass:
      ledger.status === "waiting_for_teacher_log_source_or_exclusion" &&
      receipt.status === ledger.status &&
      result.status === ledger.status &&
      ledger.allSoftwareLogSourceDiscoveryComplete === false &&
      result.allSoftwareLogSourceDiscoveryComplete === false,
    evidence: JSON.stringify({
      ledgerStatus: ledger.status,
      receiptStatus: receipt.status,
      resultStatus: result.status,
      complete: ledger.allSoftwareLogSourceDiscoveryComplete
    })
  },
  {
    name: "Ledger never reads logs, screenshots, software actions, memory, native execution, or packaging",
    pass:
      ledger.locks.logContentsRead === false &&
      ledger.locks.fullLogsRead === false &&
      ledger.locks.screenshotsCaptured === false &&
      ledger.locks.softwareActionsExecuted === false &&
      ledger.locks.memoryWritten === false &&
      ledger.locks.nativeUniversalExecution === false &&
      ledger.locks.packagingGated === true,
    evidence: JSON.stringify(ledger.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_log_source_discovery_ledger_smoke_v1",
  passed,
  total: checks.length,
  ledgerPath: result.ledgerPath,
  receiptPath: result.receiptPath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
