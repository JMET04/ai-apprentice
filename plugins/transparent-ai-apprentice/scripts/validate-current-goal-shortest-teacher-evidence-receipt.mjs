#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

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

function safeSlug(value) {
  return (
    String(value || "shortest-teacher-evidence-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "shortest-teacher-evidence-receipt-validation"
  );
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

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) {
    return {
      ok: false,
      status: "script_failed",
      scriptName,
      stderr: result.stderr || "",
      stdout: result.stdout || ""
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      status: "script_output_parse_failed",
      scriptName,
      error: error.message,
      stdout: result.stdout || ""
    };
  }
}

function isBlankOrPlaceholder(value) {
  const text = String(value ?? "").trim();
  return !text || /^<.*>$/.test(text) || text.includes("teacher-filled") || text.includes("placeholder");
}

function pathExists(value) {
  return !isBlankOrPlaceholder(value) && existsSync(resolve(value));
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotRecordScreen: true,
    validationDoesNotRegisterMonitor: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    validationDoesNotDowngradeRuntime: true,
    validationDoesNotDeleteRollbackPoints: true,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function blocked(status, reasons, pack, receipt, outputDir) {
  return {
    ok: false,
    format: "transparent_ai_current_goal_shortest_teacher_evidence_receipt_validation_v1",
    status,
    validationDecision: status,
    reasons,
    sourcePackPath: pack?.paths?.pack || "",
    sourceReceiptDecision: receipt?.teacherDecision || "",
    derivedTeacherTrialReceiptPath: "",
    derivedTeacherTrialReceiptValidationPath: "",
    derivedTeacherTrialReceiptValidationStatus: "",
    nextManualCommands: [],
    readyForTeacherTrialReceiptValidation: false,
    readyForFinalAcceptanceValidation: false,
    readyForNextManualCommand: false,
    nextManualCommand: "",
    outputDir,
    locks: locks(),
    goalComplete: false
  };
}

function commonValidation(pack, receipt, outputDir) {
  return {
    ok: true,
    format: "transparent_ai_current_goal_shortest_teacher_evidence_receipt_validation_v1",
    status: "validated_review_only_waiting_for_next_manual_gate",
    validationDecision: receipt.teacherDecision,
    reasons: [],
    sourcePackPath: pack.paths.pack,
    sourceReceiptDecision: receipt.teacherDecision,
    selectedSoftware: receipt.selectedSoftware || "",
    selectedLowTokenRouteId: receipt.selectedLowTokenRouteId || "",
    derivedTeacherTrialReceiptPath: "",
    derivedTeacherTrialReceiptValidationPath: "",
    derivedTeacherTrialReceiptValidationStatus: "",
    derivedTeacherTrialReceiptValidationResult: null,
    nextManualCommands: [],
    readyForTeacherTrialReceiptValidation: false,
    readyForFinalAcceptanceValidation: false,
    readyForNextManualCommand: false,
    nextManualCommand: "",
    evidenceChecks: {},
    outputDir,
    locks: locks(),
    goalComplete: false
  };
}

function attachDerivedTrialValidation(validation, pack, derivedPath, outputDir) {
  const result = runNodeScript("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
    "--workbench",
    pack.paths.teacherTrialWorkbench || "<current-goal-teacher-trial-workbench.json>",
    "--receipt",
    derivedPath,
    "--output-dir",
    join(outputDir, "derived-trial-validation")
  ]);
  const next = {
    ...validation,
    derivedTeacherTrialReceiptValidationResult: result,
    derivedTeacherTrialReceiptValidationPath: result.validationPath || "",
    derivedTeacherTrialReceiptValidationStatus: result.status || ""
  };
  if (result.ok !== true || !result.validationPath) {
    return {
      ...next,
      ok: false,
      status: "blocked_for_derived_teacher_trial_validation_failure",
      reasons: [
        "derived_teacher_trial_validation_failed",
        result.status || "derived_teacher_trial_validation_missing_status"
      ]
    };
  }
  const derivedValidation = readJson(result.validationPath);
  const nextManualCommand = derivedValidation.nextManualCommand || result.nextManualCommand || "";
  return {
    ...next,
    status: derivedValidation.status || result.status || "derived_teacher_trial_validation_completed",
    readyForNextManualCommand: derivedValidation.readyForNextManualCommand === true,
    nextManualCommand,
    nextManualCommands: nextManualCommand
      ? [...validation.nextManualCommands, nextManualCommand]
      : validation.nextManualCommands
  };
}

function validate(pack, receipt, outputDir, options = {}) {
  const allowed = new Set([
    "needs_teacher_review",
    "ready_for_trial_receipt_routing",
    "ready_for_final_acceptance_review",
    "blocked"
  ]);
  const forbiddenDecision = new Set([
    "accepted",
    "execute_now",
    "register_monitor_now",
    "read_logs_now",
    "capture_screenshot_now",
    "write_memory_now",
    "enable_rule_now",
    "downgrade_to_medium_now",
    "delete_rollback_points"
  ]);
  const reasons = [];
  const decision = receipt?.teacherDecision || "";

  if (pack?.format !== "transparent_ai_current_goal_shortest_teacher_evidence_pack_v1") {
    reasons.push("pack_format_mismatch");
  }
  if (receipt?.format !== "transparent_ai_current_goal_shortest_teacher_evidence_receipt_v1") {
    reasons.push("receipt_format_mismatch");
  }
  if (!allowed.has(decision)) reasons.push(`unsupported_teacher_decision:${decision || "missing"}`);
  if (forbiddenDecision.has(decision)) reasons.push(`forbidden_teacher_decision:${decision}`);
  for (const forbidden of receipt?.forbiddenDecisions || []) {
    if (receipt.teacherDecision === forbidden) reasons.push(`forbidden_receipt_decision:${forbidden}`);
  }
  if (receipt?.locks?.teacherReceiptDoesNotReadLogs !== true) reasons.push("receipt_lock_allows_log_read");
  if (receipt?.locks?.teacherReceiptDoesNotCaptureScreenshots !== true) reasons.push("receipt_lock_allows_screenshot");
  if (receipt?.locks?.teacherReceiptDoesNotRegisterMonitor !== true) reasons.push("receipt_lock_allows_monitor_registration");
  if (receipt?.locks?.teacherReceiptDoesNotExecuteTargetSoftware !== true) reasons.push("receipt_lock_allows_software_execution");
  if (receipt?.locks?.teacherReceiptDoesNotWriteMemory !== true) reasons.push("receipt_lock_allows_memory_write");
  if (receipt?.locks?.teacherReceiptDoesNotEnableRules !== true) reasons.push("receipt_lock_allows_rule_enablement");
  if (receipt?.locks?.teacherReceiptDoesNotDeleteRollbackPoints !== true) reasons.push("receipt_lock_allows_rollback_deletion");
  if (receipt?.locks?.softwareActionsExecuted === true) reasons.push("receipt_claims_software_execution");
  if (receipt?.locks?.memoryWritten === true) reasons.push("receipt_claims_memory_write");
  if (receipt?.locks?.ruleEnabled === true) reasons.push("receipt_claims_rule_enabled");
  if (receipt?.locks?.goalComplete === true) reasons.push("receipt_claims_goal_complete");

  if (reasons.length > 0) {
    return blocked("blocked_for_invalid_or_forbidden_shortest_teacher_evidence_receipt", reasons, pack, receipt, outputDir);
  }

  if (decision === "blocked") {
    return {
      ...commonValidation(pack, receipt, outputDir),
      ok: false,
      status: "teacher_marked_shortest_evidence_blocked",
      reasons: ["teacher_marked_shortest_evidence_blocked"]
    };
  }

  if (decision === "needs_teacher_review") {
    return {
      ...commonValidation(pack, receipt, outputDir),
      status: "waiting_for_teacher_to_collect_shortest_evidence",
      nextManualCommands: [pack.paths.html].filter(Boolean)
    };
  }

  const requiredTrialPaths = [
    "validatedLowTokenRouteReceiptPath",
    "teacherOverlayPacketPath",
    "teacherOverlayPacketValidationPath",
    "teacherReviewedSpatialIntentPath",
    "teacherMethodContractPath"
  ];
  const missingTrial = requiredTrialPaths.filter((key) => !pathExists(receipt[key]));
  if (isBlankOrPlaceholder(receipt.selectedSoftware)) missingTrial.push("selectedSoftware_missing");
  if (isBlankOrPlaceholder(receipt.selectedLowTokenRouteId)) missingTrial.push("selectedLowTokenRouteId_missing");
  if (receipt.teacherReviewedMethodProfile !== true) missingTrial.push("teacherReviewedMethodProfile_not_true");
  if (isBlankOrPlaceholder(receipt.confirmedRollbackPoint)) missingTrial.push("confirmedRollbackPoint_missing");

  if (decision === "ready_for_trial_receipt_routing" || decision === "ready_for_final_acceptance_review") {
    if (missingTrial.length > 0) {
      return blocked("needs_all_shortest_teacher_evidence_before_trial_routing", missingTrial, pack, receipt, outputDir);
    }
    const derivedReceipt = {
      format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1",
      teacherDecision: "ready_for_execution_gate_prep",
      allowedTeacherDecisions: [
        "needs_teacher_trial",
        "ready_for_low_token_route_selection",
        "ready_for_overlay_packet_validation",
        "ready_for_method_contract_review",
        "ready_for_execution_gate_prep",
        "blocked"
      ],
      forbiddenDecisions: [
        "accepted",
        "execute_now",
        "enable_rule_now",
        "write_memory_now",
        "downgrade_to_medium_now",
        "delete_rollback_points"
      ],
      sourceShortestTeacherEvidenceReceiptPath: receipt.__sourceReceiptPath || "",
      selectedSoftware: receipt.selectedSoftware,
      selectedLowTokenRouteId: receipt.selectedLowTokenRouteId,
      validatedLowTokenRouteReceiptPath: resolve(receipt.validatedLowTokenRouteReceiptPath),
      teacherOverlayPacketPath: resolve(receipt.teacherOverlayPacketPath),
      teacherOverlayPacketValidationPath: resolve(receipt.teacherOverlayPacketValidationPath),
      teacherReviewedSpatialIntentPath: resolve(receipt.teacherReviewedSpatialIntentPath),
      teacherReviewedMethodProfile: true,
      teacherMethodProfilePath: receipt.teacherMethodProfilePath || "",
      teacherMethodContractPath: resolve(receipt.teacherMethodContractPath),
      confirmedRollbackPoint: receipt.confirmedRollbackPoint,
      teacherNotes: receipt.teacherNotes || "",
      locks: {
        softwareActionsExecuted: false,
        memoryWritten: false,
        ruleEnabled: false,
        goalComplete: false
      }
    };
    const derivedPath = join(outputDir, "derived-teacher-trial-workbench-receipt.json");
    writeFileSync(derivedPath, `${JSON.stringify(derivedReceipt, null, 2)}\n`, "utf8");
    const trialValidationCommand = commandText("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
      "--workbench",
      pack.paths.teacherTrialWorkbench || "<current-goal-teacher-trial-workbench.json>",
      "--receipt",
      derivedPath,
      "--output-dir",
      join("artifacts", "current-goal-teacher-trial-workbench-receipt-validations")
    ]);
    const validation = {
      ...commonValidation(pack, receipt, outputDir),
      status: "ready_for_existing_teacher_trial_receipt_validation_manual_command",
      derivedTeacherTrialReceiptPath: derivedPath,
      nextManualCommands: [trialValidationCommand],
      readyForTeacherTrialReceiptValidation: true,
      evidenceChecks: Object.fromEntries(requiredTrialPaths.map((key) => [key, resolve(receipt[key])]))
    };
    const trialValidation = options.validateDerivedTrial
      ? attachDerivedTrialValidation(validation, pack, derivedPath, outputDir)
      : validation;
    if (trialValidation.ok === false) return trialValidation;
    if (decision === "ready_for_final_acceptance_review") {
      if (!pathExists(receipt.finalTeacherAcceptanceReceiptPath)) {
        return blocked(
          "needs_existing_final_teacher_acceptance_receipt_before_final_validation",
          ["finalTeacherAcceptanceReceiptPath_missing_or_not_found"],
          pack,
          receipt,
          outputDir
        );
      }
      trialValidation.status =
        options.validateDerivedTrial && trialValidation.ok !== false
          ? "ready_for_derived_trial_and_final_acceptance_validation_manual_commands"
          : "ready_for_existing_trial_and_final_acceptance_validation_manual_commands";
      trialValidation.readyForFinalAcceptanceValidation = true;
      trialValidation.nextManualCommands.push(
        commandText("validate-current-goal-final-teacher-acceptance-receipt.mjs", [
          "--final-convergence-readiness-gate",
          pack.paths.finalConvergenceReadinessGate || "<current-goal-final-convergence-readiness-gate.json>",
          "--receipt",
          resolve(receipt.finalTeacherAcceptanceReceiptPath),
          "--output-dir",
          join("artifacts", "current-goal-final-teacher-acceptance-receipt-validations")
        ])
      );
    }
    return trialValidation;
  }

  return blocked("blocked_for_unhandled_shortest_teacher_evidence_decision", [`unhandled:${decision}`], pack, receipt, outputDir);
}

const packPath = argValue("--pack");
const receiptPath = argValue("--receipt");
if (!packPath || !receiptPath) throw new Error("Usage: --pack <shortest-pack.json> --receipt <teacher receipt.json>");
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-shortest-teacher-evidence-receipt-validations")));
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSlug(basename(receiptPath))}`;
const outputDir = join(outputRoot, validationId);
mkdirSync(outputDir, { recursive: true });

const pack = readJson(packPath);
const receipt = { ...readJson(receiptPath), __sourceReceiptPath: resolve(receiptPath) };
const validation = validate(pack, receipt, outputDir, { validateDerivedTrial: hasFlag("--validate-derived-trial") });
const validationPath = join(outputDir, "shortest-teacher-evidence-receipt-validation.json");
writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: validation.ok === true,
      format: "transparent_ai_current_goal_shortest_teacher_evidence_receipt_validation_result_v1",
      status: validation.status,
      validationPath,
      derivedTeacherTrialReceiptPath: validation.derivedTeacherTrialReceiptPath,
      derivedTeacherTrialReceiptValidationPath: validation.derivedTeacherTrialReceiptValidationPath,
      derivedTeacherTrialReceiptValidationStatus: validation.derivedTeacherTrialReceiptValidationStatus,
      readyForTeacherTrialReceiptValidation: validation.readyForTeacherTrialReceiptValidation,
      readyForFinalAcceptanceValidation: validation.readyForFinalAcceptanceValidation,
      readyForNextManualCommand: validation.readyForNextManualCommand,
      nextManualCommand: validation.nextManualCommand,
      nextManualCommands: validation.nextManualCommands,
      locks: validation.locks
    },
    null,
    2
  )
);
