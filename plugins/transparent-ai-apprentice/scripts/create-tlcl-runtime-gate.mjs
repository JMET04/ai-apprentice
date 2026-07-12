#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-runtime-gate")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-runtime-gate"
  );
}

function addTrigger(triggers, trigger) {
  if (!triggers.includes(trigger)) triggers.push(trigger);
}

function resultTriggers(validationReport) {
  const triggers = [];
  for (const result of validationReport?.results || []) {
    if (result.status === "unknown") addTrigger(triggers, "validator_unknown");
    if (result.status === "error") addTrigger(triggers, "validator_error");
    if (result.status === "fail" && result.lifecycle === "active" && result.severity === "blocking") {
      addTrigger(triggers, "blocking_failure");
    }
  }
  if (validationReport?.status === "unknown") addTrigger(triggers, "validator_unknown");
  if (validationReport?.status === "error") addTrigger(triggers, "validator_error");
  if (validationReport && validationReport.delivery_allowed !== true) addTrigger(triggers, "blocking_failure");
  return triggers;
}

function repairTasksFor(triggers) {
  const tasks = [];
  if (triggers.includes("teacher_correction")) {
    tasks.push("Senior compiler drafts a corrected Rule Card and regression test from the teacher correction.");
  }
  if (triggers.includes("validator_unknown")) {
    tasks.push("Senior compiler adds missing evidence, clarifies inputs, or narrows the validator scope before runtime continues.");
  }
  if (triggers.includes("validator_error")) {
    tasks.push("Senior compiler repairs invalid Rule DSL, validator routing, or artifact envelope structure.");
  }
  if (triggers.includes("blocking_failure")) {
    tasks.push("Senior compiler repairs the contract or output logic, then reruns deterministic validation before medium runtime.");
  }
  if (triggers.includes("missing_evidence")) {
    tasks.push("Collect or regenerate the missing status refresh, validation report, rollback, or teacher review evidence.");
  }
  if (
    triggers.includes("missing_provider_role_use_plan") ||
    triggers.includes("invalid_provider_role_use_plan") ||
    triggers.includes("provider_role_use_plan_not_ready")
  ) {
    tasks.push("Regenerate the provider role-use plan from an approved TLCL provider card before retrying the runtime gate.");
  }
  if (triggers.includes("provider_role_use_plan_not_medium_runtime")) {
    tasks.push("Route non-medium provider roles to their own role gate; do not pass low-reasoning tools or senior compilers into medium runtime.");
  }
  if (triggers.includes("provider_role_use_plan_locks_not_preserved")) {
    tasks.push("Repair the role-use plan locks so provider execution, memory writes, TLCL bypass, and packaging unlock remain impossible at this gate.");
  }
  if (!tasks.length) tasks.push("No senior repair is required; medium runtime may prepare only reviewed dry-run work.");
  return tasks;
}

const goal = argValue("--goal", "tlcl-runtime-gate");
const statusRefreshPath = argValue("--status-refresh", "");
const validationReportPath = argValue("--validation-report", "");
const providerRoleUsePlanPath = argValue("--provider-role-use-plan", argValue("--role-use-plan", ""));
const teacherCorrection = argValue("--teacher-correction", "");
const outRoot = resolve(argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-runtime-gates")));
const gateDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`);
const gatePath = join(gateDir, "tlcl-runtime-gate.json");

const triggers = [];
const evidence = {
  statusRefreshPath: statusRefreshPath ? resolve(statusRefreshPath) : "",
  validationReportPath: validationReportPath ? resolve(validationReportPath) : "",
  providerRoleUsePlanPath: providerRoleUsePlanPath ? resolve(providerRoleUsePlanPath) : "",
  teacherCorrectionProvided: Boolean(teacherCorrection.trim()),
  hashes: {}
};

let statusRefresh = null;
let validationReport = null;
let providerRoleUsePlan = null;

if (!statusRefreshPath || !existsSync(resolve(statusRefreshPath))) {
  addTrigger(triggers, "missing_evidence");
} else {
  statusRefresh = readJson(statusRefreshPath);
  evidence.hashes.statusRefreshHash = sha256Object(statusRefresh);
  if (statusRefresh.format !== "transparent_ai_tlcl_status_refresh_v1" || statusRefresh.status !== "ready_for_teacher_review") {
    addTrigger(triggers, "missing_evidence");
  }
  if (Array.isArray(statusRefresh.gaps) && statusRefresh.gaps.length > 0) addTrigger(triggers, "missing_evidence");
}

if (!validationReportPath || !existsSync(resolve(validationReportPath))) {
  addTrigger(triggers, "missing_evidence");
} else {
  validationReport = readJson(validationReportPath);
  evidence.hashes.validationReportHash = sha256Object(validationReport);
  for (const trigger of resultTriggers(validationReport)) addTrigger(triggers, trigger);
}

if (providerRoleUsePlanPath) {
  if (!existsSync(resolve(providerRoleUsePlanPath))) {
    addTrigger(triggers, "missing_provider_role_use_plan");
  } else {
    providerRoleUsePlan = readJson(providerRoleUsePlanPath);
    evidence.hashes.providerRoleUsePlanHash = sha256Object(providerRoleUsePlan);
    if (providerRoleUsePlan.format !== "transparent_ai_tlcl_capability_provider_role_use_plan_v1") {
      addTrigger(triggers, "invalid_provider_role_use_plan");
    }
    if (
      providerRoleUsePlan.status !== "tlcl_capability_provider_role_use_ready_for_runtime_gate" ||
      providerRoleUsePlan.providerRoleUseAllowed !== true
    ) {
      addTrigger(triggers, "provider_role_use_plan_not_ready");
    }
    if (
      providerRoleUsePlan.providerRole !== "medium_reasoning_runtime" ||
      providerRoleUsePlan.requestedRole !== "medium_reasoning_runtime" ||
      providerRoleUsePlan.roleGate?.nextGate !== "tlcl_runtime_gate_before_medium_runtime"
    ) {
      addTrigger(triggers, "provider_role_use_plan_not_medium_runtime");
    }
    if (
      providerRoleUsePlan.locks?.providerMayExecuteTargetSoftware !== false ||
      providerRoleUsePlan.locks?.providerMayWriteMemory !== false ||
      providerRoleUsePlan.locks?.providerMayBypassTlcl !== false
    ) {
      addTrigger(triggers, "provider_role_use_plan_locks_not_preserved");
    }
  }
}

if (teacherCorrection.trim()) addTrigger(triggers, "teacher_correction");

const decision = triggers.length ? "escalate_to_senior_compile" : "medium_runtime_allowed";
const runtimeGate = {
  format: "transparent_ai_tlcl_runtime_gate_v1",
  gateId: `tlcl-runtime-gate.${new Date().toISOString().replace(/[:.]/g, "-")}`,
  goal,
  createdAt: new Date().toISOString(),
  decision,
  routing: {
    compile_tier: "senior_reasoning_compile",
    runtime_tier: "medium_reasoning_runtime",
    fixed_transform_tier: "low_reasoning_tool",
    validation_authority: "deterministic_validator",
    approval_authority: "human_teacher_review"
  },
  runtimePermission: {
    canPrepareReviewedDryRun: decision === "medium_runtime_allowed",
    providerRoleUsePlanRequiredForScopedProvider: Boolean(providerRoleUsePlanPath),
    providerRoleUsePlanAccepted:
      decision === "medium_runtime_allowed" &&
      Boolean(providerRoleUsePlanPath) &&
      providerRoleUsePlan?.providerRole === "medium_reasoning_runtime",
    providerRole: providerRoleUsePlan?.providerRole || "",
    canExecuteTargetSoftware: false,
    canEnableRules: false,
    canWriteMemory: false,
    canClaimCompletion: false,
    permissionText:
      decision === "medium_runtime_allowed"
        ? "Medium reasoning may prepare only reviewed dry-run outputs under the existing contract; execution still needs downstream teacher approval gates."
        : "Medium runtime is blocked; senior reasoning must repair the contract before another runtime attempt."
  },
  escalationPacket: {
    escalates_to: "senior_reasoning_compile",
    triggers,
    teacherCorrection,
    repairTasks: repairTasksFor(triggers)
  },
  evidence,
  nextActions:
    decision === "medium_runtime_allowed"
      ? [
          "Prepare a reviewed dry-run plan under the existing Rule Package and Validation Report.",
          providerRoleUsePlanPath
            ? "Carry the accepted medium-runtime provider role-use plan into the dry-run prep evidence bundle."
            : "If a scoped provider is used, attach a medium-runtime provider role-use plan before dry-run prep.",
          "Do not execute target software until the separate teacher approval gate passes.",
          "If the teacher corrects the dry-run, rerun this gate with teacher_correction to return to senior compile."
        ]
      : [
          "Send escalationPacket to the senior reasoning compile layer.",
          "Draft disabled Rule Card repairs and regression tests.",
          "Rerun deterministic validation before allowing medium runtime again."
        ],
  locks: {
    reviewOnly: true,
    noSoftwareExecution: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true
  },
  paths: {
    gate: gatePath
  }
};

writeJson(gatePath, runtimeGate);
console.log(
  JSON.stringify(
    {
      status: decision,
      gatePath,
      triggers,
      canPrepareReviewedDryRun: runtimeGate.runtimePermission.canPrepareReviewedDryRun,
      providerRoleUsePlanAccepted: runtimeGate.runtimePermission.providerRoleUsePlanAccepted
    },
    null,
    2
  )
);
