#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-all-software-low-token-learning-handoff", String(Date.now()));
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = runNodeScript("create-current-goal-all-software-low-token-learning-handoff.mjs", [
  "--goal",
  "Smoke all-software low-token learning handoff.",
  "--output-dir",
  smokeRoot
]);
const packet = readJson(result.handoffPath);
const coverageScopeIsExplicit =
  packet.currentEvidence.logSourceDiscoveryLedgerReady === true &&
  packet.coverageScopeSummary?.ledgerRows >= 1 &&
  packet.coverageScopeSummary?.totalInventoryRows >= packet.coverageScopeSummary?.ledgerRows &&
  packet.coverageScopeSummary?.needsTeacherLogSourceOrExclusion === 0 &&
  packet.coverageScopeSummary?.allRowsHaveSourceRoute === true &&
  Array.isArray(packet.coverageScopeSummary?.representativeSoftware) &&
  packet.coverageScopeSummary.representativeSoftware.length >= 3 &&
  packet.coverageScopeSummary.representativeSoftware.every((row) => row.software && row.discoveryStatus && row.lowTokenRoute);
const routeActionPacksAreReady =
  packet.routeRows.length >= 3 &&
  packet.routeRows.every((row) => {
    const actionPack = row.teacherRouteSelectionActionPack || {};
    return (
      actionPack.receiptSelectedRouteId === row.routeId &&
      actionPack.routeReceiptBuilderHtml &&
      actionPack.routeReceiptTemplatePath &&
      actionPack.routeReceiptValidationCommandTemplate.includes("validate-original-goal-low-token-monitor-bridge-receipt.mjs") &&
      actionPack.selectedRouteCommandBuilderCommandTemplate.includes(
        "create-original-goal-low-token-monitor-selected-route-command-builder.mjs"
      ) &&
      actionPack.routeNextGateCommandPreview === row.commandTemplate &&
      actionPack.nextGateMayRunOnlyAfterSeparateTeacherApproval === true &&
      actionPack.keepsLowTokenLocksClosed === true
    );
  });

const checks = [
  {
    name: "Handoff gathers current low-token bridge routes into one teacher-facing package",
    pass:
      packet.format === "transparent_ai_current_goal_all_software_low_token_learning_handoff_v1" &&
      packet.currentEvidence.lowTokenMonitorBridgeReady === true &&
      packet.currentEvidence.logSourceDiscoveryLedgerReady === true &&
      packet.routeRows.length >= 3 &&
      existsSync(packet.paths.html),
    evidence: result.handoffPath
  },
  {
    name: "Handoff exposes the all-software coverage scope behind the low-token routes",
    pass: coverageScopeIsExplicit,
    evidence: packet.coverageScopeSummary
  },
  {
    name: "Low-token handoff preserves teacher route selection before monitor registration",
    pass:
      packet.teacherRouteSelectionActionPack.status === "ready_for_teacher_route_selection_receipt_then_validation" &&
      packet.teacherRouteSelectionActionPack.routeReceiptTemplatePath &&
      packet.teacherRouteSelectionActionPack.routeReceiptValidationCommandTemplate.includes(
        "validate-original-goal-low-token-monitor-bridge-receipt.mjs"
      ) &&
      packet.teacherRouteSelectionActionPack.selectedRouteCommandBuilderCommandTemplate.includes(
        "create-original-goal-low-token-monitor-selected-route-command-builder.mjs"
      ) &&
      packet.nextCommands.some((item) => item.id === "validate_teacher_route_receipt") &&
      packet.nextCommands.some((item) => item.id === "build_selected_route_command_after_validation") &&
      packet.nextCommands.some((item) => item.id === "review_recurring_monitor_confirmation_package"),
    evidence: packet.paths.routeReceiptBuilderHtml
  },
  {
    name: "Every low-token route carries a teacher action pack for receipt validation then selected-route command building",
    pass: routeActionPacksAreReady,
    evidence: packet.routeRows.map((row) => ({
      routeId: row.routeId,
      routeReceiptTemplatePath: row.teacherRouteSelectionActionPack?.routeReceiptTemplatePath || "",
      selectedRouteCommandBuilderCommandTemplate:
        row.teacherRouteSelectionActionPack?.selectedRouteCommandBuilderCommandTemplate || ""
    }))
  },
  {
    name: "Handoff does not read logs register schedules write memory execute software or claim completion",
    pass:
      packet.locks.handoffDoesNotReadLogs === true &&
      packet.locks.handoffDoesNotRegisterTask === true &&
      packet.locks.handoffDoesNotWriteMemory === true &&
      packet.locks.handoffDoesNotExecuteTargetSoftware === true &&
      packet.goalComplete === false,
    evidence: result.handoffPath
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_all_software_low_token_learning_handoff_smoke_v1",
      smokeRoot,
      checks,
      artifact: result.handoffPath
    },
    null,
    2
  )
);
