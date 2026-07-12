#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-plan-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Build bounded real-local evidence for an enrollment follow-up plan.",
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const probe = spawnSync("powershell", [
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "6",
  "-MaxInstalled",
  "6",
  "-MaxLogFilesPerCandidate",
  "1"
], { cwd: smokeRoot, encoding: "utf8", timeout: 60000 });
if (probe.status !== 0) throw new Error(probe.stderr || probe.stdout || "read-only inventory probe failed");

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
  "--max-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "observer-queue")
]);

const audit = runNodeScript("create-all-software-observer-coverage-audit.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "coverage-audit")
]);

const ledgerResult = runNodeScript("create-all-software-coverage-enrollment-ledger.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--coverage-audit",
  audit.auditPath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "ledger")
]);
const fullLedger = readJson(ledgerResult.ledgerPath);
const subsetLedgerPath = join(smokeRoot, "teacher-reviewed-follow-up-subset-ledger.json");
const subsetRows = (fullLedger.rows || []).filter((row) => !(row.readyForTeacherCoverageReview || row.teacherExcluded)).slice(0, 2);
writeFileSync(
  subsetLedgerPath,
  `${JSON.stringify(
    {
      ...fullLedger,
      ledgerId: `${fullLedger.ledgerId || "ledger"}-teacher-reviewed-subset`,
      sourceLedgerPath: ledgerResult.ledgerPath,
      subsetPurpose:
        "Contains only low-token coverage rows that the teacher reviewed in the original-goal coverage dossier receipt and marked ready for follow-up.",
      rows: subsetRows,
      counts: {
        ...(fullLedger.counts || {}),
        sourceLedgerRows: (fullLedger.rows || []).length,
        reviewedFollowUpRows: subsetRows.length,
        unreviewedRowsExcluded: Math.max(0, (fullLedger.rows || []).length - subsetRows.length)
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const followUpResult = runNodeScript("create-all-software-coverage-enrollment-follow-up-plan.mjs", [
  "--ledger",
  ledgerResult.ledgerPath,
  "--max-items",
  "6",
  "--output-dir",
  join(smokeRoot, "follow-up-plan")
]);
const plan = readJson(followUpResult.planPath);
const receipt = readJson(followUpResult.receiptPath);
const subsetFollowUpResult = runNodeScript("create-all-software-coverage-enrollment-follow-up-plan.mjs", [
  "--ledger",
  subsetLedgerPath,
  "--max-items",
  "6",
  "--output-dir",
  join(smokeRoot, "subset-follow-up-plan")
]);
const subsetPlan = readJson(subsetFollowUpResult.planPath);
const subsetReceipt = readJson(subsetFollowUpResult.receiptPath);
const mcpServerText = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");

const checks = [
  {
    name: "Follow-up plan consumes an enrollment ledger and creates per-row next actions",
    pass:
      plan.format === "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1" &&
      receipt.format === "transparent_ai_all_software_coverage_enrollment_follow_up_plan_receipt_v1" &&
      plan.followUpItems.length === followUpResult.followUpItemCount &&
      plan.followUpItems.length > 0 &&
      plan.followUpItems.every((item) => item.tool && item.route && item.expectedEvidence),
    evidence: followUpResult.planPath
  },
  {
    name: "Follow-up plan resolves reviewed source paths instead of leaving placeholders",
    pass:
      plan.followUpItems.every((item) => {
        const queueArg = item.arguments?.queue || "";
        const inventory = item.arguments?.inventory || "";
        return (
          !String(queueArg).includes("<") &&
          !String(inventory).includes("<") &&
          (!queueArg || queueArg === queue.queuePath || existsSync(queueArg)) &&
          (!inventory || existsSync(inventory))
        );
      }) &&
      plan.followUpItems.some((item) => item.arguments?.queue === queue.queuePath),
    evidence: JSON.stringify(plan.followUpItems.map((item) => item.arguments).slice(0, 3))
  },
  {
    name: "Follow-up plan prioritizes existing low-token tools instead of new automation",
    pass:
      plan.followUpItems.some((item) => item.tool === "watch_log_source_metadata_deltas" || item.tool === "create_software_observer_queue" || item.tool === "teach_apprentice") &&
      plan.completionBoundary.requiredBeforeCompletion.includes("rerun coverage audit and enrollment ledger after new evidence"),
    evidence: JSON.stringify(plan.routeCounts)
  },
  {
    name: "Follow-up plan keeps all-software completion unclaimed",
    pass:
      plan.completionBoundary.allSoftwareCoverageComplete === false &&
      receipt.allSoftwareCoverageComplete === false &&
      followUpResult.allSoftwareCoverageComplete === false,
    evidence: JSON.stringify(plan.completionBoundary)
  },
  {
    name: "Follow-up plan preserves teacher-reviewed subset ledger scope",
    pass:
      subsetPlan.reviewScope.scopeKind === "teacher_reviewed_subset_ledger" &&
      subsetPlan.reviewScope.sourceLedgerPath === ledgerResult.ledgerPath &&
      subsetPlan.reviewScope.currentLedgerPath === subsetLedgerPath &&
      subsetPlan.reviewScope.reviewedFollowUpRows === subsetRows.length &&
      subsetPlan.reviewScope.unreviewedRowsExcluded >= 0 &&
      subsetPlan.counts.sourceRows === subsetRows.length &&
      subsetReceipt.reviewScope.scopeKind === "teacher_reviewed_subset_ledger" &&
      subsetFollowUpResult.reviewScope.scopeKind === "teacher_reviewed_subset_ledger",
    evidence: subsetFollowUpResult.planPath
  },
  {
    name: "Follow-up plan preserves low-token and safety locks",
    pass:
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.logContentsRead === false &&
      receipt.fileContentsRead === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.targetSoftwareCommandsExecuted === false &&
      receipt.scheduledTaskInstalled === false &&
      receipt.memoryWritten === false &&
      receipt.nativeUniversalExecution === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true,
    evidence: followUpResult.receiptPath
  },
  {
    name: "MCP advanced surface exposes enrollment follow-up plan",
    pass: mcpServerText.includes('name: "create_all_software_coverage_enrollment_follow_up_plan"'),
    evidence: "mcp-server.mjs contains create_all_software_coverage_enrollment_follow_up_plan"
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
