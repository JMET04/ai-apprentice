#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function safeSlug(value) {
  return (
    String(value || "teacher-trial-workbench-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "teacher-trial-workbench-receipt-validation"
  );
}

function isBlankOrPlaceholder(value) {
  const text = String(value ?? "").trim();
  return !text || /^<.*>$/.test(text) || text.includes("teacher-filled") || text.includes("placeholder");
}

function pathExists(value) {
  return !isBlankOrPlaceholder(value) && existsSync(resolve(value));
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunWorkbench: true,
    validationDoesNotRegisterMonitor: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotRecordScreen: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    validationDoesNotDowngradeRuntime: true,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function commandForPhase(workbench, id, key = "commandOrFile") {
  const phase = Array.isArray(workbench?.trialPhases) ? workbench.trialPhases.find((item) => item.id === id) : null;
  return phase?.[key] || phase?.commandOrFile || "";
}

function executionApprovalCommand(receipt) {
  return commandText("create-spatial-to-software-execution-gate-package.mjs", [
    "--refresh-root",
    join("artifacts", "original-goal-current-status-refreshes"),
    "--spatial-validation",
    resolve(receipt.teacherReviewedSpatialIntentPath),
    "--rollback-point",
    receipt.confirmedRollbackPoint,
    "--software",
    receipt.selectedSoftware || "RealLocalAllSoftware",
    "--output-dir",
    join("artifacts", "current-goal-spatial-to-software-execution-gate-packages")
  ]);
}

function blocked(status, reasons, workbench, receipt, outputDir) {
  return {
    ok: false,
    format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_validation_v1",
    status,
    validationDecision: status,
    reasons,
    sourceWorkbenchPath: workbench?.paths?.workbench || "",
    sourceReceiptDecision: receipt?.teacherDecision || "",
    nextManualCommand: "",
    readyForNextManualCommand: false,
    locks: locks(),
    outputDir
  };
}

function validate(workbench, receipt, outputDir) {
  const allowed = new Set([
    "needs_teacher_trial",
    "ready_for_low_token_route_selection",
    "ready_for_overlay_packet_validation",
    "ready_for_method_contract_review",
    "ready_for_execution_gate_prep",
    "blocked"
  ]);
  const forbiddenDecision = new Set([
    "accepted",
    "execute_now",
    "enable_rule_now",
    "write_memory_now",
    "downgrade_to_medium_now",
    "delete_rollback_points"
  ]);
  const decision = receipt?.teacherDecision || "";
  const reasons = [];

  if (workbench?.format !== "transparent_ai_current_goal_teacher_trial_workbench_v1") {
    reasons.push("workbench_format_mismatch");
  }
  if (receipt?.format !== "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1") {
    reasons.push("receipt_format_mismatch");
  }
  if (!allowed.has(decision)) reasons.push(`unsupported_teacher_decision:${decision || "missing"}`);
  if (forbiddenDecision.has(decision)) reasons.push(`forbidden_teacher_decision:${decision}`);
  for (const forbidden of receipt?.forbiddenDecisions || []) {
    if (receipt?.teacherDecision === forbidden) reasons.push(`forbidden_receipt_decision:${forbidden}`);
  }
  if (receipt?.locks?.softwareActionsExecuted === true) reasons.push("receipt_claims_software_execution");
  if (receipt?.locks?.memoryWritten === true) reasons.push("receipt_claims_memory_write");
  if (receipt?.locks?.ruleEnabled === true) reasons.push("receipt_claims_rule_enabled");
  if (receipt?.locks?.goalComplete === true) reasons.push("receipt_claims_goal_complete");

  if (reasons.length > 0) return blocked("blocked_for_invalid_or_forbidden_teacher_trial_receipt", reasons, workbench, receipt, outputDir);

  const lockState = locks();
  const common = {
    ok: true,
    format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_validation_v1",
    sourceWorkbenchPath: workbench.paths.workbench,
    sourceReceiptDecision: decision,
    selectedSoftware: receipt.selectedSoftware || "",
    selectedLowTokenRouteId: receipt.selectedLowTokenRouteId || "",
    teacherNotes: receipt.teacherNotes || "",
    readyForNextManualCommand: false,
    nextManualCommand: "",
    evidenceChecks: {},
    locks: lockState,
    goalComplete: false
  };

  if (decision === "blocked") {
    return {
      ...common,
      status: "teacher_trial_blocked_waiting_for_clarification",
      validationDecision: "blocked",
      reasons: ["teacher_marked_trial_blocked"]
    };
  }

  if (decision === "needs_teacher_trial") {
    return {
      ...common,
      status: "waiting_for_teacher_to_run_trial_workbench",
      validationDecision: "needs_teacher_trial",
      nextManualCommand: workbench.paths.html,
      readyForNextManualCommand: Boolean(workbench.paths.html)
    };
  }

  if (decision === "ready_for_low_token_route_selection") {
    if (isBlankOrPlaceholder(receipt.selectedLowTokenRouteId)) {
      return blocked(
        "needs_selected_low_token_route_before_validation",
        ["selectedLowTokenRouteId_missing"],
        workbench,
        receipt,
        outputDir
      );
    }
    return {
      ...common,
      status: "ready_for_low_token_route_receipt_validation_manual_command",
      validationDecision: decision,
      nextManualCommand: commandForPhase(workbench, "select_low_token_route", "validationCommand"),
      readyForNextManualCommand: Boolean(commandForPhase(workbench, "select_low_token_route", "validationCommand")),
      evidenceChecks: { selectedLowTokenRouteId: receipt.selectedLowTokenRouteId }
    };
  }

  if (decision === "ready_for_overlay_packet_validation") {
    const ok = pathExists(receipt.teacherOverlayPacketPath);
    if (!ok) {
      return blocked(
        "needs_existing_teacher_overlay_packet_before_validation",
        ["teacherOverlayPacketPath_missing_or_not_found"],
        workbench,
        receipt,
        outputDir
      );
    }
    return {
      ...common,
      status: "ready_for_teacher_overlay_packet_validation_manual_command",
      validationDecision: decision,
      nextManualCommand: commandForPhase(workbench, "draw_transparent_overlay_packet", "validationCommand"),
      readyForNextManualCommand: Boolean(commandForPhase(workbench, "draw_transparent_overlay_packet", "validationCommand")),
      evidenceChecks: { teacherOverlayPacketPathExists: ok }
    };
  }

  if (decision === "ready_for_method_contract_review") {
    const rollbackReady = !isBlankOrPlaceholder(receipt.confirmedRollbackPoint);
    if (receipt.teacherReviewedMethodProfile !== true || !rollbackReady) {
      return blocked(
        "needs_teacher_method_review_and_rollback_before_contract",
        ["teacherReviewedMethodProfile_or_confirmedRollbackPoint_missing"],
        workbench,
        receipt,
        outputDir
      );
    }
    return {
      ...common,
      status: "ready_for_teacher_method_contract_manual_command",
      validationDecision: decision,
      nextManualCommand: commandForPhase(workbench, "review_teacher_method_profile", "contractCommand"),
      readyForNextManualCommand: Boolean(commandForPhase(workbench, "review_teacher_method_profile", "contractCommand")),
      evidenceChecks: {
        teacherReviewedMethodProfile: true,
        confirmedRollbackPoint: receipt.confirmedRollbackPoint
      }
    };
  }

  if (decision === "ready_for_execution_gate_prep") {
    const requiredPaths = [
      "validatedLowTokenRouteReceiptPath",
      "teacherOverlayPacketValidationPath",
      "teacherReviewedSpatialIntentPath",
      "teacherMethodContractPath"
    ];
    const missing = requiredPaths.filter((key) => !pathExists(receipt[key]));
    if (missing.length > 0 || isBlankOrPlaceholder(receipt.confirmedRollbackPoint)) {
      return blocked(
        "needs_all_reviewed_evidence_before_execution_gate_prep",
        [...missing.map((key) => `${key}_missing_or_not_found`), "confirmedRollbackPoint_required"].filter(
          (item) => item !== "confirmedRollbackPoint_required" || isBlankOrPlaceholder(receipt.confirmedRollbackPoint)
        ),
        workbench,
        receipt,
        outputDir
      );
    }
    const nextManualCommand = executionApprovalCommand(receipt);
    return {
      ...common,
      status: "ready_for_separate_execution_approval_gate_manual_command",
      validationDecision: decision,
      nextManualCommand,
      readyForNextManualCommand: Boolean(nextManualCommand),
      evidenceChecks: {
        ...Object.fromEntries(requiredPaths.map((key) => [key, resolve(receipt[key])])),
        confirmedRollbackPoint: receipt.confirmedRollbackPoint
      }
    };
  }

  return blocked("blocked_for_unhandled_teacher_trial_decision", [`unhandled:${decision}`], workbench, receipt, outputDir);
}

const workbenchPath = argValue("--workbench");
const receiptPath = argValue("--receipt");
if (!workbenchPath || !receiptPath) throw new Error("Usage: --workbench <workbench.json> --receipt <teacher receipt.json>");
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-teacher-trial-workbench-receipt-validations")));
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSlug(basename(receiptPath))}`;
const outputDir = join(outputRoot, validationId);
mkdirSync(outputDir, { recursive: true });

const workbench = readJson(workbenchPath);
const receipt = readJson(receiptPath);
const validation = validate(workbench, receipt, outputDir);
const validationPath = join(outputDir, "teacher-trial-workbench-receipt-validation.json");
writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: validation.ok === true,
      format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_validation_result_v1",
      status: validation.status,
      validationPath,
      readyForNextManualCommand: validation.readyForNextManualCommand,
      nextManualCommand: validation.nextManualCommand,
      locks: validation.locks
    },
    null,
    2
  )
);
