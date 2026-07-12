#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-proof-gap-closure-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-closure-pack"
  );
}

function readJson(path, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`JSON file is required: ${path || "(missing)"}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotValidateReceipts: true,
    packDoesNotRunCommands: true,
    packDoesNotRegisterTask: true,
    packDoesNotLaunchRunner: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotReadFullLogs: true,
    packDoesNotWriteMemory: true,
    packDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function pathEntry(paths, key, label = key) {
  const value = paths?.[key] || "";
  return value
    ? {
        key,
        label,
        kind: existsSync(value) ? "existing_file" : "command_or_placeholder",
        value,
        exists: existsSync(value),
        basename: existsSync(value) ? basename(value) : ""
      }
    : null;
}

function entries(paths, specs) {
  return specs.map((spec) => pathEntry(paths, spec[0], spec[1] || spec[0])).filter(Boolean);
}

function commandRisk(command) {
  const lower = String(command || "").toLowerCase();
  const markers = [
    "--execute-approved-gate",
    "--execute-approved-registration",
    "--allow-system-change",
    "--allow-runner-trigger",
    "--teacher-confirmed",
    "--teacher-confirmation",
    "--execute",
    "register-scheduledtask",
    "schtasks /create",
    "capture-triggered-visual-check.mjs",
    "run-all-software-execution-approved-gate-runner.mjs",
    "run-all-software-operational-learning-registration-approved-runner.mjs",
    "run-all-software-operational-learning-post-registration-output-witness-runner.mjs"
  ];
  return markers.filter((marker) => lower.includes(marker));
}

function routeForMissing(requirementId, missingText, paths) {
  const text = String(missingText || "").toLowerCase();
  if (requirementId === "all_software_low_token_learning") {
    if (text.includes("unattended")) {
      return {
        routeId: "unattended_monitor_audit_route",
        title: "Close unattended all-software monitor audit gaps",
        teacherAction: "Review the unattended audit, then fill the recurring monitor teacher confirmation receipt before any registration.",
        evidence: entries(paths, [
          ["allSoftwareUnattendedLearningAuditReadme", "Unattended audit"],
          ["recurringMonitorTeacherConfirmationPackageHtml", "Recurring monitor teacher confirmation package"],
          ["recurringMonitorTeacherConfirmationReceiptTemplate", "Recurring monitor teacher confirmation receipt template"],
          ["recurringMonitorTeacherConfirmationValidationCommandTemplate", "Recurring monitor confirmation validation command"]
        ]),
        commandTemplate: paths.recurringMonitorTeacherConfirmationValidationCommandTemplate || "",
        requiredTeacherInputs: ["teacher-filled recurring monitor confirmation receipt"],
        blockedUntilTeacher: true
      };
    }
    if (text.includes("registration")) {
      return {
        routeId: "teacher_confirmed_registration_route",
        title: "Prove teacher-confirmed recurring monitor registration",
        teacherAction:
          "Use the operational registration approved command builder only after the activation receipt and rollback point are reviewed.",
        evidence: entries(paths, [
          ["operationalRegistrationApprovedCommandBuilderHtml", "Operational registration approved command builder"],
          ["operationalRegistrationApprovedRunnerCommandTemplate", "Operational registration approved runner command"],
          ["allSoftwareUnattendedLearningAuditReadme", "Unattended audit"]
        ]),
        commandTemplate: paths.operationalRegistrationApprovedRunnerCommandTemplate || "",
        requiredTeacherInputs: ["teacher confirmation text", "retained rollback point", "approved registration gate"],
        blockedUntilTeacher: true
      };
    }
    return {
      routeId: "post_registration_output_witness_route",
      title: "Prove runner launch and bounded output witness",
      teacherAction:
        "After teacher-confirmed registration, build and review the post-registration output witness command and receipt.",
      evidence: entries(paths, [
        ["operationalPostRegistrationOutputWitnessCommandBuilderHtml", "Post-registration output witness command builder"],
        ["operationalPostRegistrationOutputWitnessReceiptBuilderHtml", "Post-registration output witness receipt builder"],
        ["operationalPostRegistrationOutputWitnessReceiptTemplate", "Post-registration output witness receipt template"],
        ["operationalPostRegistrationOutputWitnessRunnerCommandTemplate", "Post-registration output witness runner command"]
      ]),
      commandTemplate: paths.operationalPostRegistrationOutputWitnessRunnerCommandTemplate || "",
      requiredTeacherInputs: ["registered-and-matching monitor status", "teacher confirmation text", "output witness receipt"],
      blockedUntilTeacher: true
    };
  }

  if (requirementId === "adapt_any_teacher_learning_method") {
    if (text.includes("receipt") || text.includes("profile")) {
      return {
        routeId: "current_teacher_method_receipt_route",
        title: "Validate the current teacher method/profile receipt",
        teacherAction: "Open the teacher review cockpit or teacher action router, confirm how this teacher wants to teach, then validate the receipt.",
        evidence: entries(paths, [
          ["teacherLearningMethodProfile", "Teacher learning method profile"],
          ["teacherReviewCockpitHtml", "Teacher review cockpit"],
          ["teacherReviewCockpitReceiptTemplate", "Teacher review cockpit receipt template"],
          ["teacherReviewCockpitReceiptValidationCommandTemplate", "Teacher review cockpit receipt validation command"]
        ]),
        commandTemplate: paths.teacherReviewCockpitReceiptValidationCommandTemplate || "",
        requiredTeacherInputs: ["teacher-filled method/profile or cockpit receipt"],
        blockedUntilTeacher: true
      };
    }
    return {
      routeId: "teacher_method_reuse_result_route",
      title: "Prove confirmed reuse improves the next run",
      teacherAction:
        "Review the teacher-method execution learning contract, then use a corrected next run as evidence before medium-runtime reuse.",
      evidence: entries(paths, [
        ["teacherMethodExecutionLearningContractReadme", "Teacher-method execution learning contract"],
        ["teacherMethodExecutionLearningContractCommandTemplate", "Teacher-method execution contract command"],
        ["teacherActionRouterHtml", "Teacher action router"]
      ]),
      commandTemplate: paths.teacherMethodExecutionLearningContractCommandTemplate || "",
      requiredTeacherInputs: ["teacher-reviewed method contract", "confirmed reuse result or correction"],
      blockedUntilTeacher: true
    };
  }

  if (requirementId === "transparent_mask_spatial_depth_understanding") {
    if (text.includes("depth")) {
      return {
        routeId: "transparent_depth_rehearsal_receipt_route",
        title: "Validate transparent 2D/perspective/3D depth rehearsal review",
        teacherAction:
          "Open the depth rehearsal receipt builder, confirm or correct every 2D/perspective/3D row, then validate the teacher-filled receipt.",
        evidence: entries(paths, [
          ["transparentSketchDepthDemonstrationRehearsalHtml", "Transparent sketch depth rehearsal"],
          ["transparentSketchDepthRehearsalReviewReceiptBuilderHtml", "Depth rehearsal review receipt builder"],
          ["transparentSketchDepthRehearsalReviewReceiptTemplate", "Depth rehearsal review receipt template"],
          ["transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate", "Depth rehearsal review receipt validation command"]
        ]),
        commandTemplate: paths.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || "",
        requiredTeacherInputs: ["teacher-filled transparent sketch depth rehearsal receipt"],
        blockedUntilTeacher: true
      };
    }
    return {
      routeId: "spatial_target_to_execution_gate_route",
      title: "Feed teacher-confirmed spatial target into a later execution gate",
      teacherAction:
        "Validate the teacher-exported spatial intent receipt, confirm one numbered target, then hand that single target to the execution gate.",
      evidence: entries(paths, [
        ["spatialIntentEvidenceReceiptBuilderHtml", "Spatial intent evidence receipt builder"],
        ["spatialIntentEvidenceReceiptTemplate", "Spatial intent receipt template"],
        ["spatialIntentEvidenceReceiptValidationCommandTemplate", "Spatial intent receipt validation command"],
        ["executionApprovedGateCommandBuilderHtml", "Execution approved gate command builder"]
      ]),
      commandTemplate: paths.spatialIntentEvidenceReceiptValidationCommandTemplate || "",
      requiredTeacherInputs: ["teacher-exported overlay/spatial intent receipt", "one confirmed numbered target"],
      blockedUntilTeacher: true
    };
  }

  return {
    routeId: "teacher_confirmed_execution_gate_route",
    title: "Close teacher-confirmed execution proof",
    teacherAction:
      "Advance exactly one reviewed target through execution approval, retained rollback, runner output, and post-action teacher outcome review.",
    evidence: entries(paths, [
      ["executionApprovedGateCommandBuilderHtml", "Execution approved gate command builder"],
      ["executionApprovedGateRunnerCommandTemplate", "Execution approved gate runner command"],
      ["executionFollowUpHandoffItemReceiptBuilderCommandTemplate", "Execution follow-up receipt builder command"],
      ["executionFollowUpHandoffItemReceiptValidationCommandTemplate", "Execution follow-up receipt validation command"]
    ]),
    commandTemplate: paths.executionApprovedGateRunnerCommandTemplate || "",
    requiredTeacherInputs: ["one selected numbered target", "teacher-approved execution gate", "retained rollback point", "post-action outcome review"],
    blockedUntilTeacher: true
  };
}

function writeHtml(path, pack) {
  const rows = pack.closureRoutes
    .map((row) => {
      const links = row.evidence
        .map((entry) =>
          entry.exists
            ? `<a href="${htmlEscape(fileHref(entry.value))}">${htmlEscape(entry.label)}</a>`
            : `<code>${htmlEscape(entry.value || entry.label)}</code>`
        )
        .join("<br>");
      return `<tr>
        <td>${htmlEscape(row.requirementId)}</td>
        <td>${htmlEscape(row.missingProof)}</td>
        <td>${htmlEscape(row.routeId)}</td>
        <td>${htmlEscape(row.teacherAction)}</td>
        <td>${links}</td>
        <td><code>${htmlEscape(row.commandTemplate)}</code></td>
        <td>${htmlEscape(row.risk.matchedHighRiskMarkers.join(", ") || "review-only")}</td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Proof Gap Closure Pack</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1260px; margin: 0 auto; padding: 26px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e2ef; }
    th, td { padding: 9px; border-bottom: 1px solid #e3eaf3; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf3f8; color: #2d4058; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
    .lock { color: #58677a; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Proof Gap Closure Pack</h1>
  <p>Status: <code>${htmlEscape(pack.status)}</code>; missing proof routes: <code>${htmlEscape(pack.counts.closureRoutes)}</code>; high-risk gated routes: <code>${htmlEscape(pack.counts.highRiskGatedRoutes)}</code>.</p>
  <p class="lock">This pack only maps missing proof to existing review entry points and command templates. It does not validate receipts, run commands, register schedules, launch runners, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or claim completion.</p>
  <table>
    <thead><tr><th>Requirement</th><th>Missing Proof</th><th>Route</th><th>Teacher Action</th><th>Evidence</th><th>Command Template</th><th>Risk</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, pack) {
  const lines = [
    "# Original Goal Proof Gap Closure Pack",
    "",
    `Status: ${pack.status}`,
    `Closure routes: ${pack.counts.closureRoutes}`,
    `High-risk gated routes: ${pack.counts.highRiskGatedRoutes}`,
    "",
    "Use this after the proof ledger. It converts each remaining missing-proof item into the shortest existing teacher-review route.",
    "",
    "Routes:",
    ...pack.closureRoutes.map(
      (row) => `- ${row.requirementId}: ${row.routeId}; ${row.teacherAction}`
    ),
    "",
    "Locks:",
    ...Object.entries(pack.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const refreshInput = argValue("--status-refresh", argValue("--refresh", ""));
if (!refreshInput) {
  throw new Error("Usage: node create-original-goal-proof-gap-closure-pack.mjs --status-refresh <refresh.json> [--proof-ledger <ledger.json>]");
}

const statusRefreshPath = resolve(refreshInput);
const refresh = readJson(statusRefreshPath, true);
const proofLedgerPath = resolve(argValue("--proof-ledger", refresh.paths?.originalGoalProofLedger || ""));
const proofLedger = readJson(proofLedgerPath, true);
const goal = argValue("--goal", refresh.goal || "Close original-goal proof gaps through existing review gates.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-closure-packs"))
);
const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });

const closureRoutes = [];
for (const requirement of array(proofLedger.requirements)) {
  for (const missingProof of array(requirement.missingProof)) {
    const route = routeForMissing(requirement.id, missingProof, refresh.paths || {});
    const matchedHighRiskMarkers = commandRisk(route.commandTemplate);
    closureRoutes.push({
      requirementId: requirement.id,
      proofState: requirement.proofState || "",
      missingProof,
      routeId: route.routeId,
      title: route.title,
      teacherAction: route.teacherAction,
      evidence: route.evidence,
      commandTemplate: route.commandTemplate,
      requiredTeacherInputs: route.requiredTeacherInputs,
      blockedUntilTeacher: route.blockedUntilTeacher === true,
      risk: {
        matchedHighRiskMarkers,
        requiresExplicitTeacherConfirmation: route.blockedUntilTeacher === true || matchedHighRiskMarkers.length > 0,
        reviewOnlySafeToOpen: true,
        safeToRunAutomatically: false
      }
    });
  }
}

const packPath = join(packDir, "original-goal-proof-gap-closure-pack.json");
const htmlPath = join(packDir, "original-goal-proof-gap-closure-pack.html");
const readmePath = join(packDir, "ORIGINAL_GOAL_PROOF_GAP_CLOSURE_PACK_START_HERE.md");
const pack = {
  format: "transparent_ai_original_goal_proof_gap_closure_pack_v1",
  packId,
  status: closureRoutes.length > 0 ? "waiting_for_teacher_to_close_proof_gaps" : "no_missing_proof_routes",
  sourceEvidence: {
    statusRefresh: statusRefreshPath,
    proofLedger: proofLedgerPath
  },
  counts: {
    requirements: array(proofLedger.requirements).length,
    missingProofItems: closureRoutes.length,
    closureRoutes: closureRoutes.length,
    highRiskGatedRoutes: closureRoutes.filter((row) => row.risk.matchedHighRiskMarkers.length > 0).length,
    routesBlockedUntilTeacher: closureRoutes.filter((row) => row.blockedUntilTeacher).length
  },
  closureRoutes,
  completionBoundary: {
    completionAllowed: false,
    reason: "The pack maps missing proof to existing teacher-review routes; it does not supply teacher receipts, run commands, register monitors, launch runners, execute software, or prove completion."
  },
  locks: locks()
};

writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
writeHtml(htmlPath, pack);
writeReadme(readmePath, pack);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_closure_pack_result_v1",
      packId,
      packPath,
      htmlPath,
      readmePath,
      status: pack.status,
      counts: pack.counts,
      locks: pack.locks
    },
    null,
    2
  )
);
