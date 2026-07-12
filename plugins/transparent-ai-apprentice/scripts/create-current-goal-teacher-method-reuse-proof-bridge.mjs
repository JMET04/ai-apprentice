#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  const rollbackRoot = resolve(root, ".transparent-apprentice", "rollback-points");
  return newestFile(rollbackRoot, "rollback-point.json");
}

function slugify(value) {
  return (
    String(value || "teacher-method-reuse-proof-bridge")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "teacher-method-reuse-proof-bridge"
  );
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandLine(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    bridgeDoesNotValidateReceipt: true,
    bridgeDoesNotRunCommands: true,
    bridgeDoesNotRegisterTask: true,
    bridgeDoesNotLaunchRunner: true,
    bridgeDoesNotExecuteTargetSoftware: true,
    bridgeDoesNotCaptureScreenshots: true,
    bridgeDoesNotReadFullLogs: true,
    bridgeDoesNotWriteMemory: true,
    bridgeDoesNotEnableRules: true,
    bridgeDoesNotDeleteRollbackPoint: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function laneById(gate, id) {
  return (Array.isArray(gate?.lanes) ? gate.lanes : []).find((lane) => lane?.id === id) || null;
}

function writeReadme(path, bridge) {
  const lines = [
    "# Current Goal Teacher Method Reuse Proof Bridge",
    "",
    `Status: ${bridge.status}`,
    "",
    "This bridge connects the current final-completion blocker to the existing teacher-method reuse-result proof flow.",
    "It is review-only. It does not run software, validate a receipt, write memory, enable rules, unlock packaging, or claim the goal complete.",
    "",
    "## Start Here",
    "",
    `1. Open the teacher receipt template: ${bridge.sourceEvidence.reuseResultReceiptTemplate || "missing"}`,
    "2. Fill before-run evidence, reuse-run evidence, improvement summary, rollback retention, medium-runtime reuse scope review, and high-reasoning repair route.",
    "3. Run the validation command only after the teacher fills the receipt.",
    "4. Keep rollback points until the teacher confirms this direction is correct.",
    "",
    "## Validation Command",
    "",
    "```powershell",
    bridge.nextValidationCommand,
    "```"
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, bridge) {
  const evidenceRows = Object.entries(bridge.sourceEvidence)
    .map(
      ([key, value]) =>
        `<tr><td><code>${htmlEscape(key)}</code></td><td><a href="${htmlEscape(fileHref(value))}">${htmlEscape(value || "missing")}</a></td></tr>`
    )
    .join("\n");
  const stepRows = bridge.teacherReviewSteps
    .map(
      (step) =>
        `<tr><td><code>${htmlEscape(step.id)}</code></td><td>${htmlEscape(step.teacherAction)}</td><td>${htmlEscape(step.continueCondition)}</td><td>${htmlEscape(step.stopCondition)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Teacher Method Reuse Proof Bridge</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Teacher Method Reuse Proof Bridge</h1>
  <section>
    <p>Status: <code>${htmlEscape(bridge.status)}</code></p>
    <p>Final lane ready: <code>${htmlEscape(bridge.finalLane.ready)}</code></p>
    <p class="lock">Review-only. No software execution, no rule enablement, no memory write, no packaging unlock, no completion claim.</p>
  </section>
  <section>
    <h2>Source Evidence</h2>
    <table><thead><tr><th>Source</th><th>Path</th></tr></thead><tbody>${evidenceRows}</tbody></table>
  </section>
  <section>
    <h2>Teacher Review Steps</h2>
    <table><thead><tr><th>Step</th><th>Teacher Action</th><th>Continue</th><th>Stop</th></tr></thead><tbody>${stepRows}</tbody></table>
  </section>
  <section>
    <h2>Next Validation Command</h2>
    <pre>${htmlEscape(bridge.nextValidationCommand)}</pre>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = process.cwd();
const goal = argValue(
  "--goal",
  "Bridge current final blocker to teacher-confirmed before/after teacher-method reuse-result proof."
);
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const startHerePath = resolve(
  argValue("--start-here", join(repoRoot, "artifacts", "current-goal-start-here", "current-goal-start-here.json"))
);
const builderPath = resolve(
  argValue(
    "--reuse-result-builder",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-reuse-result-proof-builders"), "teacher-method-reuse-result-proof-builder.json")
  )
);
const validationPath = resolve(
  argValue(
    "--reuse-result-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-reuse-result-proof-validations"), "teacher-method-reuse-result-proof-validation.json")
  )
);
const finalReviewPackPath = resolve(
  argValue(
    "--teacher-method-final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-final-review-packs"), "teacher-method-final-review-pack.json")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-teacher-method-reuse-proof-bridges"))
);

mkdirSync(outputRoot, { recursive: true });

const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const startHere = existsSync(startHerePath) ? readJson(startHerePath) : null;
const builder = existsSync(builderPath) ? readJson(builderPath) : null;
const validation = existsSync(validationPath) ? readJson(validationPath) : null;
const finalReviewPack = existsSync(finalReviewPackPath) ? readJson(finalReviewPackPath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const teacherLane = laneById(finalGate, "teacher_method_adaptation_reuse_result_proof");

const blockers = [];
if (!finalGate) blockers.push("final_completion_gate_missing");
if (!teacherLane) blockers.push("teacher_method_final_lane_missing");
if (teacherLane?.ready !== false) blockers.push("teacher_method_final_lane_not_current_blocker");
if (!builder) blockers.push("reuse_result_builder_missing");
if (!validation) blockers.push("reuse_result_validation_missing");
if (!finalReviewPack) blockers.push("teacher_method_final_review_pack_missing");
if (!rollback) blockers.push("rollback_point_missing");

const receiptTemplatePath = builder?.paths?.receiptTemplate || "";
const contractReceiptValidationPath =
  builder?.sourceEvidence?.contractReceiptValidation ||
  validation?.sourceEvidence?.contractReceiptValidation ||
  teacherLane?.sourcePath ||
  "";
const latestValidationReady = validation?.readyForMediumRuntimeReuseGate === true;
const latestValidationRepair = validation?.repairRequired === true;
const bridgeStatus = blockers.length
  ? "teacher_method_reuse_proof_bridge_needs_missing_source_evidence"
  : latestValidationReady
    ? "teacher_method_reuse_proof_bridge_ready_for_teacher_medium_runtime_gate_review"
    : latestValidationRepair
      ? "teacher_method_reuse_proof_bridge_routes_to_high_reasoning_repair_review"
      : "teacher_method_reuse_proof_bridge_waiting_for_teacher_before_after_reuse_proof";

const bridgeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const bridgeDir = join(outputRoot, bridgeId);
mkdirSync(bridgeDir, { recursive: true });
const bridgePath = join(bridgeDir, "current-goal-teacher-method-reuse-proof-bridge.json");
const htmlPath = join(bridgeDir, "current-goal-teacher-method-reuse-proof-bridge.html");
const readmePath = join(bridgeDir, "CURRENT_GOAL_TEACHER_METHOD_REUSE_PROOF_BRIDGE.md");

const nextValidationCommand =
  receiptTemplatePath && contractReceiptValidationPath
    ? commandLine("validate-teacher-method-reuse-result-proof-receipt.mjs", [
        "--contract-receipt-validation",
        contractReceiptValidationPath,
        "--receipt",
        receiptTemplatePath,
        "--output-dir",
        join("artifacts", "current-goal-teacher-method-reuse-result-proof-validations"),
        "--goal",
        "Validate teacher-filled before/after reuse-result proof for current final blocker."
      ])
    : "";

const bridge = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_teacher_method_reuse_proof_bridge_v1",
  bridgeId,
  createdAt: new Date().toISOString(),
  goal,
  status: bridgeStatus,
  blockers,
  finalLane: {
    id: teacherLane?.id || "teacher_method_adaptation_reuse_result_proof",
    ready: teacherLane?.ready === true,
    blocker: teacherLane?.blocker || "",
    sourcePath: teacherLane?.sourcePath || ""
  },
  currentStartHere: {
    path: existsSync(startHerePath) ? startHerePath : "",
    goalComplete: startHere?.goalComplete === true,
    nextProofGapRoute: startHere?.nextProofGapRoute || startHere?.currentStatus?.nextProofGapRoute || ""
  },
  latestEvidenceStatus: {
    builderStatus: builder?.status || "",
    validationStatus: validation?.status || "",
    readyForMediumRuntimeReuseGate: latestValidationReady,
    repairRequired: latestValidationRepair,
    finalReviewPackStatus: finalReviewPack?.status || "",
    rollbackStatus: rollback?.status || "",
    rollbackDeleteOnlyAfterTeacherConfirmation: rollback?.deleteOnlyAfterTeacherConfirmation === true
  },
  sourceEvidence: {
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    startHere: existsSync(startHerePath) ? startHerePath : "",
    finalLaneSource: teacherLane?.sourcePath || "",
    contractReceiptValidation: contractReceiptValidationPath,
    reuseResultBuilder: existsSync(builderPath) ? builderPath : "",
    reuseResultReceiptTemplate: receiptTemplatePath,
    reuseResultValidation: existsSync(validationPath) ? validationPath : "",
    teacherMethodFinalReviewPack: existsSync(finalReviewPackPath) ? finalReviewPackPath : "",
    rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
  },
  teacherReviewSteps: [
    {
      id: "fill_before_after_evidence",
      teacherAction:
        "Record the previous run evidence, reuse run evidence, and a concrete improvement summary in the reuse-result receipt.",
      continueCondition: "Both evidence references are real and the teacher-reviewed comparison is explicit.",
      stopCondition: "Any evidence is missing, placeholder-only, or not tied to the current teacher method."
    },
    {
      id: "confirm_cost_saving_execution_split",
      teacherAction:
        "Confirm the high-reasoning contract captures the teaching logic, while medium-runtime reuse remains only a reviewed gate until validation passes.",
      continueCondition: "Medium-runtime reuse scope is reviewed and still disabled by this bridge.",
      stopCondition: "The receipt tries to enable rules, write memory, run software, or unlock packaging."
    },
    {
      id: "route_failures_to_high_reasoning_repair",
      teacherAction:
        "If the reuse run still mismatches the teacher method, write the mismatch so the next pass returns to high-reasoning repair.",
      continueCondition: "No mismatch remains, or mismatch is explicitly routed to repair.",
      stopCondition: "The receipt claims completion while a mismatch or correction remains."
    }
  ],
  nextTeacherQuestion:
    "Did the teacher-reviewed before/after evidence prove that the learned method improved the next reuse run, while failures still route back to high-reasoning repair?",
  nextValidationCommand,
  paths: {
    bridge: bridgePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(bridgePath, bridge);
writeHtml(htmlPath, bridge);
writeReadme(readmePath, bridge);

console.log(
  JSON.stringify(
    {
      ok: true,
      bridgePath,
      htmlPath,
      readmePath,
      status: bridge.status,
      blockers: bridge.blockers,
      nextValidationCommand: bridge.nextValidationCommand
    },
    null,
    2
  )
);

