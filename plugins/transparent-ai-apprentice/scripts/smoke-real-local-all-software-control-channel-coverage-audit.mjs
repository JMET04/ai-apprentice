#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-control-channel-coverage-audit-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const goal =
  "Audit control-channel coverage across real local software so voice, text, and sketch intent can choose reviewed existing routes before UI fallback.";

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const probe = runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "8",
  "-MaxInstalled",
  "8",
  "-MaxLogFilesPerCandidate",
  "1"
]);
if (probe.status !== 0 || !existsSync(inventoryPath)) {
  throw new Error(probe.stderr || probe.stdout || "real local inventory probe failed");
}

const auditResult = runNodeScript("create-all-software-control-channel-coverage-audit.mjs", [
  "--goal",
  goal,
  "--inventory",
  inventoryPath,
  "--max-software",
  "8",
  "--create-profiles",
  "--output-dir",
  join(smokeRoot, "control-channel-coverage")
]);

const audit = readJson(auditResult.auditPath);
const repairQueue = readJson(auditResult.repairQueuePath);
const receipt = readJson(auditResult.receiptPath);
const rowProfilePaths = audit.rows.map((row) => row.profilePath).filter(Boolean);
const firstProfile = rowProfilePaths[0] ? readJson(rowProfilePaths[0]) : null;

const checks = [
  check(
    "Real local inventory feeds all-software control-channel coverage audit",
    audit.format === "transparent_ai_all_software_control_channel_coverage_audit_v1" &&
      audit.counts.totalRows > 0 &&
      audit.sourcePath === inventoryPath,
    `${auditResult.auditPath}; rows=${audit.counts.totalRows}`
  ),
  check(
    "Audit classifies every row into structured route, UI fallback, observation-only, or missing teacher evidence",
    audit.rows.length === audit.counts.totalRows &&
      audit.rows.every((row) =>
        [
          "structured_control_route_reviewable",
          "supervised_ui_fallback_reviewable",
          "observation_only_needs_control_evidence",
          "needs_teacher_control_evidence"
        ].includes(row.status)
      ),
    JSON.stringify(audit.counts)
  ),
  check(
    "Audit reuses existing control-channel profile creator for reviewed rows",
    audit.counts.profilePacketsCreated === audit.counts.totalRows &&
      rowProfilePaths.every((path) => existsSync(path)) &&
      firstProfile?.format === "transparent_ai_software_control_channel_profile_v1",
    rowProfilePaths.join("; ")
  ),
  check(
    "Repair queue preserves control gaps instead of claiming universal native execution",
    repairQueue.format === "transparent_ai_all_software_control_channel_repair_queue_v1" &&
      repairQueue.items.every((item) => item.blockedTransitions.includes("accept_native_control")) &&
      audit.completionBoundary.nativeUniversalExecution === false &&
      audit.completionBoundary.allSoftwareControlComplete === false,
    audit.completionBoundary.reason
  ),
  check(
    "Coverage audit keeps screenshots memory software execution native control and packaging locked",
    receipt.format === "transparent_ai_all_software_control_channel_coverage_audit_receipt_v1" &&
      receipt.locks.screenshotsCaptured === false &&
      receipt.locks.softwareActionsExecuted === false &&
      receipt.locks.targetSoftwareCommandsExecuted === false &&
      receipt.locks.memoryWritten === false &&
      receipt.locks.nativeUniversalExecution === false &&
      receipt.locks.packagingGated === true,
    auditResult.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_control_channel_coverage_audit_smoke_v1",
  smokeRoot,
  counts: audit.counts,
  paths: {
    inventory: inventoryPath,
    audit: auditResult.auditPath,
    repairQueue: auditResult.repairQueuePath,
    receipt: auditResult.receiptPath,
    firstProfile: rowProfilePaths[0] || ""
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
