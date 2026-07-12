#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJsonInput(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{")) return JSON.parse(text);
  return null;
}

function slugify(value) {
  return (
    String(value || "execution-pilot")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-pilot"
  );
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function rowIsPilotEligible(row) {
  return ["structured_control_route_reviewable", "supervised_ui_fallback_reviewable"].includes(row.status);
}

function routeMode(row) {
  if (row.status === "structured_control_route_reviewable") return "structured_route_dry_run_pilot";
  if (row.status === "supervised_ui_fallback_reviewable") return "supervised_ui_fallback_dry_run_pilot";
  return "blocked_waiting_for_control_evidence";
}

function primaryAdapter(row) {
  if (Array.isArray(row.recommendedAdapters) && row.recommendedAdapters.length) return row.recommendedAdapters[0];
  if (row.status === "supervised_ui_fallback_reviewable") return "existing-windows-ui-automation";
  return "";
}

function requiredEvidence(row) {
  const common = [
    "every consequential action detail is tied to a reviewed logic source: numbered target, structured route, control profile, data field, teacher rule, preflight, or verifier",
    "teacher confirms one numbered target or says the target is route-only and needs no screen position",
    "dry-run execution package is reviewed before execute mode",
    "preflight and receipt are saved",
    "low-token post-action evidence checkpoint is created before screenshots or learning"
  ];
  if (row.status === "structured_control_route_reviewable") {
    return [
      "review exact API, macro, CLI/script, browser, or file mapping for this software",
      ...common,
      "teacher confirms route-specific execute flag only after rollback path exists"
    ];
  }
  if (row.status === "supervised_ui_fallback_reviewable") {
    return [
      "teacher confirms visible target window title",
      "teacher confirms one numbered target and coordinate bounds",
      ...common,
      "active-window preflight must pass before any UI event"
    ];
  }
  return ["teacher supplies API/CLI/file/browser/macro/window evidence before this row can become a pilot"];
}

function actionLogicSourceContract(row, adapter) {
  return {
    format: "transparent_ai_execution_action_logic_source_contract_v1",
    rule: "Every consequential software action detail must be backed by a reviewed logic source before execution.",
    sourceRowId: row.rowId || "",
    software: row.software || "software",
    routeStatus: row.status || "",
    preferredAdapter: adapter || "",
    requiredLogicSourceTypes: [
      "teacher_confirmed_numbered_target_or_exact_route",
      "reviewed_control_channel_profile",
      "reviewed_api_cli_file_browser_macro_mapping",
      "rollback_and_preflight_policy",
      "outcome_verifier_or_post_action_evidence_checkpoint"
    ],
    consequentialActionDetailsCovered: [
      "target software",
      "route or adapter",
      "target location or route-only assertion",
      "action kind",
      "input value or command payload",
      "timing/order",
      "expected observable outcome",
      "rollback/preflight requirement"
    ],
    missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
    surfaceSimilarityOrGuessingAllowed: false,
    unbackedActionDetailsBlocked: true,
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function writeActionPlan(path, row, goal) {
  const adapter = primaryAdapter(row);
  const logicSource = actionLogicSourceContract(row, adapter);
  const actionPlan = {
    format: "transparent_ai_all_software_execution_pilot_action_plan_v1",
    goal,
    software: row.software,
    targetSoftware: {
      name: row.software,
      processName: row.processName || "",
      windowTitle: row.windowTitle || ""
    },
    sourceRowId: row.rowId || "",
    routeMode: routeMode(row),
    preferredAdapters: adapter ? [adapter] : [],
    actions: [
      {
        id: "pilot-action-1",
        kind: adapter === "existing-windows-ui-automation" ? "click" : "review_existing_route",
        intent: "Teacher-reviewed pilot action placeholder; replace with a confirmed numbered target or exact reviewed route before execute mode.",
        at: adapter === "existing-windows-ui-automation" ? { x: 0.5, y: 0.5, coordinateSpace: "normalized_review_placeholder" } : null,
        logicSourceRequired: true,
        logicSource,
        blockedIfLogicSourceMissing: true
      }
    ],
    actionLogicSourceContract: logicSource,
    teacherConfirmationRequired: true,
    dryRunFirst: true,
    executeModeBlockedUntilTeacherConfirmation: true
  };
  writeFileSync(path, `${JSON.stringify(actionPlan, null, 2)}\n`, "utf8");
  return actionPlan;
}

function writeReadme(path, queue) {
  const lines = [
    "# All-Software Execution Pilot Queue",
    "",
    `Goal: ${queue.goal}`,
    "",
    "This queue turns reviewed control-channel coverage into teacher-reviewed dry-run pilot trials.",
    "",
    `Pilot items: ${queue.counts.pilotItems}`,
    `Blocked rows: ${queue.counts.blockedRows}`,
    `Adapter packages created: ${queue.counts.adapterPackagesCreated}`,
    "",
    "How to use:",
    "1. Pick one pilot item.",
    "2. Confirm the numbered target or exact structured route.",
    "3. Review the dry-run adapter package.",
    "4. Run only dry-run first.",
    "5. Use outcome verification and post-action evidence checkpoint before screenshots or memory.",
    "",
    "Locked boundaries:",
    "- No target software commands executed by this queue.",
    "- No UI events sent by this queue.",
    "- No screenshots captured.",
    "- No memory or rule enabled.",
    "- No universal native execution claim."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Turn all-software control-channel coverage into teacher-reviewed dry-run execution pilots."));
const auditInput = argValue("--coverage-audit", argValue("--audit", argValue("--control-channel-coverage-audit", "")));
const maxPilots = Number(argValue("--max-pilots", "8"));
const createAdapterPackages = hasFlag("--create-adapter-packages") || hasFlag("--create-dry-run-adapters");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-pilot-queues")));

const audit = readJsonInput(auditInput);
if (!audit || !Array.isArray(audit.rows)) {
  throw new Error("Provide --coverage-audit with transparent_ai_all_software_control_channel_coverage_audit_v1 JSON.");
}

mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
const pilotDir = join(queueDir, "pilot-items");
mkdirSync(pilotDir, { recursive: true });

const sourceRows = audit.rows.slice(0, Math.max(maxPilots * 2, maxPilots));
const pilots = [];
const blockedRows = [];

for (const row of sourceRows) {
  if (!rowIsPilotEligible(row)) {
    blockedRows.push({
      rowId: row.rowId || "",
      software: row.software || "software",
      status: row.status,
      reason: "control route evidence is not yet strong enough for an execution pilot"
    });
    continue;
  }
  if (pilots.length >= maxPilots) continue;
  const pilotId = `pilot-${String(pilots.length + 1).padStart(3, "0")}`;
  const itemDir = join(pilotDir, `${pilotId}-${slugify(row.software)}`);
  mkdirSync(itemDir, { recursive: true });
  const actionPlanPath = join(itemDir, "pilot-action-plan.json");
  writeActionPlan(actionPlanPath, row, goal);

  let adapterResult = null;
  if (createAdapterPackages) {
    const adapterArgs = [
      "--goal",
      `${goal} Pilot ${pilotId}: ${row.software}`,
      "--software",
      row.software || "software",
      "--action-plan",
      actionPlanPath,
      "--output-dir",
      join(itemDir, "existing-execution-adapter")
    ];
    if (row.profilePath) adapterArgs.push("--capability-profile", row.profilePath);
    adapterResult = runNodeScript("create-existing-software-execution-adapter.mjs", adapterArgs);
  }

  pilots.push({
    pilotId,
    sourceRowId: row.rowId || "",
    software: row.software || "software",
    processName: row.processName || "",
    windowTitle: row.windowTitle || "",
    sourceStatus: row.status,
    routeMode: routeMode(row),
    primaryAdapterId: primaryAdapter(row),
    recommendedAdapters: row.recommendedAdapters || [],
    numberedTargetRequired: true,
    teacherConfirmationRequired: true,
    dryRunFirst: true,
    executeModeBlockedUntilTeacherConfirmation: true,
    actionLogicSourceContract: actionLogicSourceContract(row, primaryAdapter(row)),
    logicSourceRequiredBeforeExecution: true,
    missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
    requiredEvidenceBeforeExecute: requiredEvidence(row),
    actionPlanPath,
    sourceProfilePath: row.profilePath || "",
    adapterSelectionPath: adapterResult?.selectionPath || "",
    adapterPackagePath: adapterResult?.executionPackagePath || "",
    nextCalls: [
      "confirm_engineering_command_target",
      "create_existing_software_execution_adapter",
      "start_teach_execute_supervised_execution",
      "verify_supervised_action_outcome",
      "create_post_action_evidence_checkpoint"
    ],
    blockedTransitions: [
      "execute_now",
      "generate_or_execute_unbacked_action_detail",
      "enable_rule",
      "accept_native_control",
      "unlock_packaging"
    ]
  });
}

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  teacherConfirmationRequiredBeforeExecution: true,
  dryRunFirst: true
};

const counts = {
  sourceRows: audit.rows.length,
  pilotItems: pilots.length,
  blockedRows: blockedRows.length,
  adapterPackagesCreated: pilots.filter((pilot) => pilot.adapterPackagePath).length,
  structuredRoutePilots: pilots.filter((pilot) => pilot.routeMode === "structured_route_dry_run_pilot").length,
  supervisedUiFallbackPilots: pilots.filter((pilot) => pilot.routeMode === "supervised_ui_fallback_dry_run_pilot").length
};

const queuePath = join(queueDir, "all-software-execution-pilot-queue.json");
const receiptPath = join(queueDir, "all-software-execution-pilot-queue-receipt.json");
const readmePath = join(queueDir, "ALL_SOFTWARE_EXECUTION_PILOT_QUEUE_START_HERE.md");

const queue = {
  ok: true,
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  sourceAuditPath: auditInput,
  counts,
  pilots,
  blockedRows,
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This queue moves reviewed control-channel coverage into dry-run pilot trials, but live execution still requires one teacher-confirmed target or route, preflight, receipt verification, and post-action evidence for each software item."
  },
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_execution_pilot_queue_receipt_v1",
  queuePath,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_for_one_dry_run_pilot", "blocked"],
  blockedDecisions: ["accepted", "execute_now", "native_universal_execution_proven", "unlock_packaging"],
  locks
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, queue);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: queue.format,
      queuePath,
      receiptPath,
      readmePath,
      counts,
      locks
    },
    null,
    2
  )
);
