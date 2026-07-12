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

function slugify(value) {
  return (
    String(value || "teacher-method-final-review-pack")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "teacher-method-final-review-pack"
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
    packDoesNotReviewMethodForTeacher: true,
    packDoesNotRunCommands: true,
    packDoesNotCreateTeacherReviewedContract: true,
    packDoesNotValidateReceipt: true,
    packDoesNotEnableRules: true,
    packDoesNotWriteMemory: true,
    packDoesNotRegisterMonitor: true,
    packDoesNotReadLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteTargetSoftware: true,
    fullContinuousRecording: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function profileModes(profile) {
  return (Array.isArray(profile?.preferredTeachingModes) ? profile.preferredTeachingModes : [])
    .map((mode) => mode?.mode)
    .filter(Boolean);
}

function requirementById(gate, id) {
  return (Array.isArray(gate?.requirements) ? gate.requirements : []).find((item) => item?.id === id) || null;
}

function finalLaneById(gate, id) {
  return (Array.isArray(gate?.lanes) ? gate.lanes : []).find((item) => item?.id === id) || null;
}

function writeReadme(path, pack) {
  const lines = [
    "# Teacher Method Final Review Pack",
    "",
    `Status: ${pack.status}`,
    "",
    "This pack collects the current teacher-method evidence and the next teacher-review steps.",
    "It does not create teacher acceptance, run software, write memory, enable rules, unlock packaging, or claim the goal complete.",
    "",
    "## Start Here",
    "",
    `1. Review the teacher method profile: ${pack.sourceEvidence.teacherMethodReadme || pack.sourceEvidence.teacherMethodProfile || "missing"}`,
    "2. If the teacher confirms/corrects the method, retain a rollback point and run the post-review contract command.",
    "3. Build and validate the contract receipt only after the teacher fills the receipt.",
    "4. After a later reuse run, build and validate before/after reuse-result proof.",
    "",
    "## Locked Actions",
    "",
    "- No target software execution.",
    "- No rule enablement.",
    "- No long-term memory write.",
    "- No medium-runtime reuse.",
    "- No final completion claim.",
    "",
    "## Next Commands",
    ""
  ];
  for (const command of pack.nextReviewCommands) {
    lines.push(`### ${command.id}`, "", command.purpose, "", "```powershell", command.command, "```", "");
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pack, receiptTemplate) {
  const modeRows = pack.teacherMethodModes
    .map((mode) => `<tr><td><code>${htmlEscape(mode)}</code></td></tr>`)
    .join("\n");
  const commandRows = pack.nextReviewCommands
    .map(
      (command) => `<section>
        <h2>${htmlEscape(command.id)}</h2>
        <p>${htmlEscape(command.purpose)}</p>
        <pre>${htmlEscape(command.command)}</pre>
      </section>`
    )
    .join("\n");
  const receiptRows = receiptTemplate.reviewRows
    .map(
      (row) => `<tr><td><code>${htmlEscape(row.id)}</code></td><td>${htmlEscape(row.teacherQuestion)}</td><td>${htmlEscape(row.defaultAnswer)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Teacher Method Final Review Pack</title>
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
  <h1>Teacher Method Final Review Pack</h1>
  <section>
    <p>Status: <code>${htmlEscape(pack.status)}</code></p>
    <p class="lock">Review-only. No software execution, rule enablement, memory write, packaging unlock, or completion claim.</p>
    <p>Teacher profile: <a href="${htmlEscape(fileHref(pack.sourceEvidence.teacherMethodProfile))}">${htmlEscape(pack.sourceEvidence.teacherMethodProfile || "missing")}</a></p>
    <p>Receipt template: <a href="${htmlEscape(fileHref(pack.paths.teacherReviewReceiptTemplate))}">${htmlEscape(pack.paths.teacherReviewReceiptTemplate)}</a></p>
  </section>
  <section>
    <h2>Detected Teacher Method Modes</h2>
    <table><thead><tr><th>Mode</th></tr></thead><tbody>${modeRows}</tbody></table>
  </section>
  <section>
    <h2>Teacher Receipt Rows</h2>
    <table><thead><tr><th>Row</th><th>Question</th><th>Default</th></tr></thead><tbody>${receiptRows}</tbody></table>
  </section>
  ${commandRows}
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
  "Teacher-method final review pack for high-reasoning contract construction and medium-runtime reuse gating."
);
const handoffPath = resolve(
  argValue(
    "--handoff",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-adaptation-handoffs"), "current-goal-teacher-method-adaptation-handoff.json")
  )
);
const integratedGatePath = resolve(
  argValue(
    "--integrated-evidence-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-integrated-evidence-gates"), "current-goal-integrated-evidence-gate.json")
  )
);
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-teacher-method-final-review-packs")));

if (!existsSync(handoffPath)) throw new Error(`Missing teacher method handoff: ${handoffPath}`);
if (!existsSync(integratedGatePath)) throw new Error(`Missing integrated evidence gate: ${integratedGatePath}`);

const handoff = readJson(handoffPath);
const profilePath = handoff?.paths?.teacherLearningMethodProfile || "";
const profile = profilePath && existsSync(profilePath) ? readJson(profilePath) : null;
const integratedGate = readJson(integratedGatePath);
const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const methodRequirement = requirementById(integratedGate, "teacher_method_adaptation");
const reasoningRequirement = requirementById(integratedGate, "high_to_medium_reasoning_cost_control");
const finalLane = finalLaneById(finalGate, "teacher_method_adaptation_reuse_result_proof");
const teacherMethodModes = profileModes(profile);
const lockState = locks();
const blockers = [];
if (handoff?.status !== "waiting_for_teacher_method_review_before_contract_or_medium_runtime_reuse") {
  blockers.push("teacher_method_handoff_not_waiting_for_teacher_review");
}
if (teacherMethodModes.length < 1) blockers.push("teacher_method_profile_modes_missing");
if (methodRequirement?.status !== "partial_review_ready") blockers.push("integrated_teacher_method_requirement_not_partial_review_ready");
if (reasoningRequirement?.status !== "policy_review_ready") blockers.push("integrated_reasoning_requirement_not_policy_review_ready");
if (reasoningRequirement?.evidenceSummary?.mediumRuntimeReuseEnabled !== false) {
  blockers.push("medium_runtime_reuse_not_locked");
}
if (!finalLane || finalLane.ready !== false) blockers.push("final_teacher_method_lane_not_explicitly_blocked");

const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });
const packPath = join(packDir, "teacher-method-final-review-pack.json");
const receiptPath = join(packDir, "teacher-method-final-review-receipt-template.json");
const readmePath = join(packDir, "TEACHER_METHOD_FINAL_REVIEW_START_HERE.md");
const htmlPath = join(packDir, "teacher-method-final-review-pack.html");

const contractCommand = methodRequirement?.nextActionCommand || handoff.nextCommands?.find((item) => item.id.includes("contract"))?.command || "";
const workflowGateCommand = reasoningRequirement?.nextActionCommand || handoff.nextCommands?.find((item) => item.id.includes("low_token"))?.command || "";
const reuseBuilderCommand =
  handoff.nextCommands?.find((item) => item.id === "prove_teacher_method_reuse_result_after_later_run")?.command ||
  commandLine("create-teacher-method-reuse-result-proof-builder.mjs", [
    "--contract-receipt-validation",
    "<teacher-method-contract-receipt-validation.json>",
    "--contract",
    "<teacher-method-execution-learning-contract.json>",
    "--output-dir",
    "artifacts\\current-goal-teacher-method-reuse-result-proof-builders"
  ]);

const receiptTemplate = {
  format: "transparent_ai_teacher_method_final_review_receipt_template_v1",
  packId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "teacher_corrected_method", "ready_for_contract_generation", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_now",
    "enable_rule",
    "write_memory",
    "unlock_packaging",
    "claim_complete",
    "medium_runtime_reuse_approved"
  ],
  reviewRows: [
    {
      id: "teacher_method_profile_review",
      teacherQuestion: "Does the detected method profile match how the teacher wants to teach the apprentice?",
      defaultAnswer: "not_reviewed_yet",
      requiredBefore: "create_teacher_method_execution_learning_contract_after_review"
    },
    {
      id: "rollback_retention_review",
      teacherQuestion: "Which rollback point is retained before converting this method into a reusable contract?",
      defaultAnswer: "not_selected_yet",
      requiredBefore: "create_teacher_method_execution_learning_contract_after_review"
    },
    {
      id: "high_to_medium_reasoning_review",
      teacherQuestion: "Does the teacher agree that medium-runtime reuse stays locked until the contract, low-token gate, dry-run validation, and later reuse proof pass?",
      defaultAnswer: "not_reviewed_yet",
      requiredBefore: "medium_runtime_reuse_gate"
    },
    {
      id: "reuse_result_proof_review",
      teacherQuestion: "After a later run, did before/after evidence prove the reviewed method improved the result?",
      defaultAnswer: "not_run_yet",
      requiredBefore: "final_goal_completion_claim"
    }
  ],
  locks: lockState
};

const pack = {
  ok: blockers.length === 0,
  format: "transparent_ai_teacher_method_final_review_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: blockers.length
    ? "blocked_waiting_for_current_teacher_method_review_inputs"
    : "waiting_for_teacher_review_before_contract_or_medium_runtime_reuse",
  blockers,
  teacherMethodModes,
  sourceEvidence: {
    teacherMethodHandoff: handoffPath,
    teacherMethodProfile: profilePath,
    teacherMethodReadme: handoff?.paths?.teacherLearningMethodReadme || "",
    integratedEvidenceGate: integratedGatePath,
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    finalTeacherMethodLaneStatus: finalLane?.status || "missing",
    finalTeacherMethodLaneEvidence: finalLane?.evidence || "",
    integratedTeacherMethodStatus: methodRequirement?.status || "missing",
    integratedSupportedMethodLaneCount: methodRequirement?.evidenceSummary?.supportedMethodLaneCount ?? teacherMethodModes.length,
    integratedReasoningStatus: reasoningRequirement?.status || "missing",
    integratedMediumRuntimeReuseEnabled: reasoningRequirement?.evidenceSummary?.mediumRuntimeReuseEnabled
  },
  nextReviewCommands: [
    {
      id: "review_teacher_method_profile",
      purpose: "Teacher opens the profile and corrects any misunderstood teaching method before reusable contracts.",
      command: handoff?.paths?.teacherLearningMethodReadme || profilePath
    },
    {
      id: "post_teacher_review_create_method_contract",
      purpose: "Run only after real teacher review and retained rollback. This command contains --teacher-reviewed-method as a post-review gate, not as an automated action.",
      command: contractCommand,
      requiresRealTeacherReview: true
    },
    {
      id: "after_contract_build_contract_receipt",
      purpose: "After the method contract exists, build the teacher-filled receipt template for that contract.",
      command: commandLine("create-teacher-method-execution-learning-contract-receipt-builder.mjs", [
        "--contract",
        "<teacher-method-execution-learning-contract.json>",
        "--output-dir",
        "artifacts\\current-goal-teacher-method-execution-learning-contract-receipt-builders"
      ])
    },
    {
      id: "after_teacher_fills_contract_receipt_validate_it",
      purpose: "Validate a teacher-filled method contract receipt. Default or forbidden decisions remain blocked.",
      command: commandLine("validate-teacher-method-execution-learning-contract-receipt.mjs", [
        "--contract",
        "<teacher-method-execution-learning-contract.json>",
        "--receipt",
        "<teacher-filled-contract-receipt.json>",
        "--output-dir",
        "artifacts\\current-goal-teacher-method-execution-learning-contract-receipt-validations"
      ])
    },
    {
      id: "after_later_reuse_run_build_reuse_result_proof",
      purpose: "After a later run, prepare before/after evidence review for whether the teacher method actually improved reuse.",
      command: reuseBuilderCommand
    },
    {
      id: "after_teacher_fills_reuse_result_receipt_validate_it",
      purpose: "Validate teacher-reviewed before/after reuse result proof before any medium-runtime reuse gate.",
      command: commandLine("validate-teacher-method-reuse-result-proof-receipt.mjs", [
        "--contract-receipt-validation",
        "<teacher-method-contract-receipt-validation.json>",
        "--contract",
        "<teacher-method-execution-learning-contract.json>",
        "--receipt",
        "<teacher-filled-reuse-result-proof-receipt.json>",
        "--output-dir",
        "artifacts\\current-goal-teacher-method-reuse-result-proof-validations"
      ])
    },
    {
      id: "after_contract_and_reuse_proof_build_low_token_gate",
      purpose: "Only after teacher contract and reuse proof, prepare the low-token/high-to-medium reasoning gate.",
      command: workflowGateCommand
    }
  ],
  completionBoundary: {
    finalGoalCompletionAllowed: false,
    reason:
      "This pack only organizes teacher review. Final completion still needs confirmed contract receipt validation and teacher-reviewed before/after reuse-result proof."
  },
  paths: {
    pack: packPath,
    teacherReviewReceiptTemplate: receiptPath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

writeJson(packPath, pack);
writeJson(receiptPath, receiptTemplate);
writeReadme(readmePath, pack);
writeHtml(htmlPath, pack, receiptTemplate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teacher_method_final_review_pack_result_v1",
      status: pack.status,
      packPath,
      receiptTemplatePath: receiptPath,
      readmePath,
      htmlPath,
      blockers,
      teacherMethodModeCount: teacherMethodModes.length,
      locks: lockState
    },
    null,
    2
  )
);
