#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "teacher-method-low-token-workflow-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "teacher-method-low-token-workflow-gate"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function optionalPath(value) {
  const text = String(value || "").trim();
  return text ? resolve(text) : "";
}

function optionalJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    if (!statSync(path).isFile()) return null;
  } catch {
    return null;
  }
  return readJson(path);
}

function latestRefreshPath(root) {
  const refreshRoot = resolve(root || join(process.cwd(), ".transparent-apprentice", "original-goal-current-status-refreshes"));
  if (!existsSync(refreshRoot)) return "";
  const latest = readdirSync(refreshRoot)
    .map((name) => join(refreshRoot, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory() && existsSync(join(path, "original-goal-current-status-refresh.json"));
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  return latest ? join(latest, "original-goal-current-status-refresh.json") : "";
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function closedLocks() {
  return {
    reviewOnly: true,
    gatePackageOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packageDoesNotValidateReceipt: true,
    packageDoesNotCompileRules: true,
    packageDoesNotEnableRules: true,
    packageDoesNotRunLowTokenCycle: true,
    packageDoesNotReadLogs: true,
    packageDoesNotReadFullLogs: true,
    packageDoesNotCaptureScreenshots: true,
    packageDoesNotExecuteSoftware: true,
    packageDoesNotWriteMemory: true,
    packageDoesNotRegisterSchedule: true,
    rulePackageCompiled: false,
    activeRulesEnabled: false,
    lowTokenCycleInvoked: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function gateRow(id, label, status, ready, evidencePath, blocker, nextAction) {
  return {
    id,
    label,
    status: status || "missing",
    ready: ready === true,
    evidencePath: evidencePath || "",
    blocker: ready === true ? "" : blocker,
    nextAction: ready === true ? "continue_to_next_gate" : nextAction,
    locks: closedLocks()
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) parts.push(flag);
    else parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function profileMatchesCurrentGoal(profile, contract) {
  const profileGoal = String(profile?.goal || "").toLowerCase();
  const contractGoal = String(contract?.goal || "").toLowerCase();
  if (!profileGoal || !contractGoal) return false;
  const currentSignals = ["all software", "low-token", "transparent", "sketch", "spatial", "execute only after confirmation"];
  return currentSignals.some((signal) => profileGoal.includes(signal)) && currentSignals.some((signal) => contractGoal.includes(signal));
}

function writeReadme(path, packet) {
  const lines = [
    "# Teacher Method Low-Token Workflow Gate Package",
    "",
    `Status: ${packet.status}`,
    `Ready for medium-runtime reuse: ${packet.readyForMediumRuntimeReuse}`,
    "",
    "This package checks whether the teacher's learning method has been converted into a reviewed, low-token, reusable workflow gate.",
    "It does not compile or enable rules, run low-token learning, read logs, capture screenshots, execute software, write memory, register schedules, accept technology, unlock packaging, or claim completion.",
    "",
    "Gates:",
    ...packet.gates.map((row, index) => `${index + 1}. ${row.id}: ${row.status}; ready=${row.ready}; blocker=${row.blocker || "none"}`),
    "",
    "Next commands:",
    ...packet.nextCommands.map((entry, index) => `${index + 1}. ${entry.id}: ${entry.command}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const rows = packet.gates
    .map(
      (row) => `<article class="row">
        <h2>${htmlEscape(row.id)}</h2>
        <p><strong>Status:</strong> <code>${htmlEscape(row.status)}</code> <strong>Ready:</strong> <code>${htmlEscape(row.ready)}</code></p>
        <p><strong>Evidence:</strong> <a href="${htmlEscape(fileHref(row.evidencePath))}">${htmlEscape(row.evidencePath || "missing")}</a></p>
        <p><strong>Blocker:</strong> ${htmlEscape(row.blocker || "none")}</p>
        <p><strong>Next:</strong> ${htmlEscape(row.nextAction)}</p>
      </article>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Teacher Method Low-Token Workflow Gate</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f6f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .summary, .row { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    code { background: #edf3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Teacher Method Low-Token Workflow Gate</h1>
  <section class="summary">
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Ready for medium-runtime reuse:</strong> <code>${htmlEscape(packet.readyForMediumRuntimeReuse)}</code></p>
    <p>This is a deterministic gate summary only. It does not execute or enable anything.</p>
  </section>
  ${rows}
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const refreshPath = optionalPath(argValue("--refresh", latestRefreshPath(argValue("--refresh-root", ""))));
if (!refreshPath || !existsSync(refreshPath)) {
  throw new Error("Usage: node create-teacher-method-low-token-workflow-gate-package.mjs --refresh <original-goal-current-status-refresh.json>");
}
const refresh = readJson(refreshPath);
const profilePath = optionalPath(argValue("--profile", refresh.paths?.teacherLearningMethodProfile || ""));
const contractPath = optionalPath(argValue("--contract", refresh.paths?.teacherMethodExecutionLearningContract || ""));
const compactHandoffPath = optionalPath(
  argValue(
    "--compact-handoff",
    refresh.paths?.originalGoalLowTokenCompactEvidenceLearningHandoff || refresh.paths?.originalGoalLowTokenCompactEvidenceRequestPack || ""
  )
);
const ragIntakePath = optionalPath(argValue("--rag-intake", refresh.paths?.ragResearchIntakeQueue || ""));
const runtimeGatePath = optionalPath(argValue("--runtime-gate", refresh.paths?.tlclRuntimeGate || ""));
const statusRefreshPath = optionalPath(argValue("--tlcl-status", refresh.paths?.tlclStatusRefresh || ""));

const profile = optionalJson(profilePath);
const contract = optionalJson(contractPath);
const compactHandoff = optionalJson(compactHandoffPath);
const ragIntake = optionalJson(ragIntakePath);
const runtimeGate = optionalJson(runtimeGatePath);
const tlclStatus = optionalJson(statusRefreshPath);

const contractCoverage = contract?.coverage || {};
const modelTierPolicy = contract?.modelTierPolicy || {};
const profileReady = profile?.format === "transparent_ai_teacher_learning_method_profile_v1";
const profileGoalMatches = profileMatchesCurrentGoal(profile, contract);
const contractReady =
  contract?.format === "transparent_ai_teacher_method_execution_learning_contract_v1" &&
  contract.status === "ready_for_teacher_method_execution_learning_contract_review" &&
  contract.teacherReviewedMethod === true &&
  contractCoverage.everyTeacherModeHasRoute === true &&
  contractCoverage.lowTokenMetadataFirst === true &&
  contractCoverage.transparentOverlaySpatialIntent === true &&
  contractCoverage.highToMediumModelTierPolicy === true;
const modelTierReady =
  Array.isArray(modelTierPolicy.highReasoningUseCases) &&
  modelTierPolicy.highReasoningUseCases.length > 0 &&
  Array.isArray(modelTierPolicy.mediumReasoningUseCases) &&
  modelTierPolicy.mediumReasoningUseCases.length > 0 &&
  String(modelTierPolicy.downgradeCondition || "").includes("teacher-reviewed") &&
  String(modelTierPolicy.escalationCondition || "").includes("teacher correction");
const compactHandoffReady =
  compactHandoff?.format === "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1" ||
  compactHandoff?.format === "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1";
const ragEvidenceReady =
  ragIntake?.format === "transparent_ai_rag_research_intake_queue_v1" ||
  ragIntake?.format === "transparent_ai_rag_research_intake_queue_json_v1";
const ragEvidenceStatus = ragEvidenceReady
  ? ragIntake?.status || "rag_intake_or_source_lane_present_waiting_for_teacher_review"
  : "missing_rag_intake_or_confirmed_source_lane";
const runtimeReady =
  runtimeGate?.readyForMediumRuntimeReuse === true ||
  runtimeGate?.status === "ready_for_medium_runtime_reuse" ||
  (runtimeGate?.format === "transparent_ai_tlcl_runtime_gate_v1" &&
    runtimeGate?.decision === "medium_runtime_allowed" &&
    runtimeGate?.runtimePermission?.canPrepareReviewedDryRun === true &&
    runtimeGate?.runtimePermission?.canExecuteTargetSoftware === false &&
    runtimeGate?.runtimePermission?.canEnableRules === false &&
    runtimeGate?.runtimePermission?.canWriteMemory === false &&
    runtimeGate?.runtimePermission?.canClaimCompletion === false &&
    runtimeGate?.locks?.reviewOnly === true) ||
  tlclStatus?.readyForMediumRuntimeReuse === true;
const runtimeStatus = runtimeGate?.status || runtimeGate?.decision || tlclStatus?.status || "missing_medium_runtime_reuse_gate";

const gates = [
  gateRow(
    "teacher_method_profile",
    "Teacher learning method profile exists and matches current all-software goal",
    profileReady ? (profileGoalMatches ? "current_goal_profile_ready" : "profile_exists_but_goal_mismatch") : "missing_teacher_method_profile",
    profileReady && profileGoalMatches,
    profilePath,
    profileReady ? "profile goal does not match current all-software transparent low-token goal" : "missing teacher method profile",
    "regenerate teacher learning method profile from the current objective and teacher corrections"
  ),
  gateRow(
    "teacher_method_execution_contract",
    "Teacher method execution learning contract covers all required teaching modes",
    contract?.status || "missing_teacher_method_contract",
    contractReady,
    contractPath,
    "contract missing teacher-reviewed method, low-token metadata-first route, transparent overlay route, or high-to-medium model policy",
    "review or regenerate teacher method execution learning contract"
  ),
  gateRow(
    "reasoning_tier_policy",
    "High reasoning builds and repairs rules; medium reasoning reuses confirmed workflow",
    modelTierReady ? "model_tier_policy_ready" : "model_tier_policy_incomplete",
    modelTierReady,
    contractPath,
    "high/medium reasoning downgrade or escalation policy is incomplete",
    "repair model tier policy in teacher method contract"
  ),
  gateRow(
    "low_token_compact_learning_handoff",
    "Low-token compact evidence handoff exists before any routine run",
    compactHandoff?.status || "missing_low_token_compact_learning_handoff",
    compactHandoffReady,
    compactHandoffPath,
    "missing low-token compact evidence handoff or request pack",
    "create/review compact evidence learning handoff before routine execution"
  ),
  gateRow(
    "rag_knowledge_augmented_evidence",
    "RAG or knowledge-augmented evidence lane is present as source-backed evidence only",
    ragEvidenceStatus,
    ragEvidenceReady,
    ragIntakePath,
    "missing RAG research intake or confirmed source lane",
    "review RAG intake queue and confirm sources before knowledge-augmented low-token learning"
  ),
  gateRow(
    "medium_runtime_reuse_gate",
    "Reviewed workflow can be reused by medium runtime only after gates pass",
    runtimeStatus,
    runtimeReady,
    runtimeGatePath || statusRefreshPath,
    "medium runtime reuse gate is missing or not ready",
    "create TLCL runtime gate after reviewed contract, active rules, rollback, and dry-run evidence"
  )
];
const readyForMediumRuntimeReuse = gates.every((row) => row.ready === true);
const firstBlocker = gates.find((row) => row.ready !== true);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "teacher-method-low-token-workflow-gate-packages")));
const goal = contract?.goal || refresh.goal || "teacher method low-token workflow gate";
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, packageId);
mkdirSync(dir, { recursive: true });

const packagePath = join(dir, "teacher-method-low-token-workflow-gate-package.json");
const readmePath = join(dir, "TEACHER_METHOD_LOW_TOKEN_WORKFLOW_GATE_START_HERE.md");
const htmlPath = join(dir, "teacher-method-low-token-workflow-gate-package.html");
const locks = closedLocks();
const nextCommands = [
  {
    id: "regenerate_current_teacher_method_profile",
    status: profileReady && profileGoalMatches ? "already_ready" : "blocked_until_current_profile_generated",
    command: commandLine("create-teacher-learning-method-profile.mjs", [
      ["--goal", goal],
      ["--software", "RealLocalAllSoftware"],
      ["--output-dir", join(dir, "teacher-method-profile")]
    ]),
    allowedInThisPackage: false
  },
  {
    id: "review_teacher_method_contract",
    status: contractReady ? "already_ready" : "blocked_until_contract_review",
    command: commandLine("create-teacher-method-execution-learning-contract.mjs", [
      ["--goal", goal],
      ["--software", "RealLocalAllSoftware"],
      ["--profile", profilePath || "<current-teacher-method-profile.json>"],
      ["--output-dir", join(dir, "teacher-method-contract")]
    ]),
    allowedInThisPackage: false
  },
  {
    id: "create_tlcl_runtime_gate_after_reviewed_contract",
    status: readyForMediumRuntimeReuse ? "already_ready" : "blocked_until_all_teacher_method_gates_ready",
    command: commandLine("create-tlcl-runtime-gate.mjs", [
      ["--goal", goal],
      ["--contract", contractPath || "<teacher-method-execution-learning-contract.json>"],
      ["--output-dir", join(dir, "tlcl-runtime-gate")]
    ]),
    allowedInThisPackage: false
  }
];
const packet = {
  ok: true,
  format: "transparent_ai_teacher_method_low_token_workflow_gate_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: readyForMediumRuntimeReuse ? "ready_for_medium_runtime_reuse_review" : "blocked_before_medium_runtime_reuse",
  readyForMediumRuntimeReuse,
  firstBlocker: firstBlocker ? { id: firstBlocker.id, status: firstBlocker.status, blocker: firstBlocker.blocker } : null,
  goal,
  sourceEvidence: {
    refresh: refreshPath,
    teacherLearningMethodProfile: profilePath,
    teacherMethodExecutionLearningContract: contractPath,
    lowTokenCompactHandoff: compactHandoffPath,
    ragIntake: ragIntakePath,
    tlclRuntimeGate: runtimeGatePath,
    tlclStatusRefresh: statusRefreshPath
  },
  modelTierPolicySummary: {
    highReasoningUseCases: modelTierPolicy.highReasoningUseCases || [],
    mediumReasoningUseCases: modelTierPolicy.mediumReasoningUseCases || [],
    downgradeCondition: modelTierPolicy.downgradeCondition || "",
    escalationCondition: modelTierPolicy.escalationCondition || "",
    ready: modelTierReady
  },
  gates,
  nextCommands,
  paths: {
    package: packagePath,
    readme: readmePath,
    html: htmlPath
  },
  completionBoundary:
    "This package gates teacher-method adaptation into low-token workflow reuse. It does not compile/enable rules, run learning, read logs, execute software, write memory, register schedules, accept technology, unlock packaging, or claim goal completion.",
  locks
};

writeFileSync(packagePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teacher_method_low_token_workflow_gate_package_result_v1",
      packageId,
      status: packet.status,
      readyForMediumRuntimeReuse,
      firstBlocker: packet.firstBlocker,
      packagePath,
      readmePath,
      htmlPath,
      locks
    },
    null,
    2
  )
);
