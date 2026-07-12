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
  if (!existsSync(root)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(root);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function slugify(value) {
  const slug =
    String(value || "current-goal-final-teacher-acceptance-review-pack")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "current-goal-final-teacher-acceptance-review-pack";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-pack`);
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotValidateReceipt: true,
    packDoesNotRunFinalGate: true,
    packDoesNotRunCommands: true,
    packDoesNotReadLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotRegisterSchedule: true,
    packDoesNotLaunchRunner: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotWriteMemory: true,
    packDoesNotEnableRules: true,
    packDoesNotDeleteRollbackPoints: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    scheduledTaskInstalled: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, pack) {
  const lines = [
    "# Current Goal Final Teacher Acceptance Review Pack",
    "",
    `Status: ${pack.status}`,
    `Ready for teacher final acceptance review: ${pack.readyForTeacherFinalAcceptanceReview}`,
    `Source convergence gate: ${pack.paths.sourceFinalConvergenceReadinessGate}`,
    "",
    "This pack is the handoff for the final human review. It does not itself accept the goal.",
    "",
    `- Review HTML: ${pack.paths.html}`,
    `- Pack JSON: ${pack.paths.pack}`,
    `- Receipt template: ${pack.paths.receiptTemplate}`,
    `- Next validation command: ${pack.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- The default receipt decision is needs_teacher_review.",
    "- A teacher must review every lane and explicitly accept the full original scope before validation can become ready.",
    "- This pack does not validate, run final gates, execute software, read logs, capture screenshots, write memory, enable rules, delete rollback points, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pack) {
  const rows = pack.reviewRows
    .map((row) => {
      const href = fileHref(row.evidencePath);
      const disabled = row.canBeTeacherConfirmed ? "" : "disabled";
      return `<article class="row" data-lane-id="${htmlEscape(row.laneId)}">
        <header><strong>${htmlEscape(row.laneId)}</strong><span>${htmlEscape(row.evidenceStatus || row.finalGateStatus)}</span></header>
        <p>Review evidence ready: <code>${htmlEscape(row.reviewEvidenceReady)}</code>; completion ready: <code>${htmlEscape(row.completionReady)}</code></p>
        <p>${htmlEscape(row.blocker)}</p>
        ${href ? `<p><a href="${htmlEscape(href)}">Open evidence</a></p>` : ""}
        <label class="inline"><input type="checkbox" data-field="teacherReviewed" ${disabled}> Teacher reviewed this lane</label>
        <label>Lane decision
          <select data-field="teacherDecision" ${disabled}>
            <option value="needs_teacher_review">needs_teacher_review</option>
            <option value="confirmed">confirmed</option>
            <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
          </select>
        </label>
        <label>Teacher note <input data-field="teacherNote" placeholder="What was checked?"></label>
      </article>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Current Goal Final Teacher Acceptance Review</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .panel, .row { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 12px; }
    .row header { display: flex; justify-content: space-between; gap: 8px; }
    .row header span { color: #586579; font-size: 12px; }
    label { display: block; margin: 8px 0; }
    label.inline { display: flex; align-items: center; gap: 6px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="checkbox"] { width: 18px; height: 18px; }
    textarea { min-height: 260px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Final Teacher Acceptance Review</h1>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(pack.status)}</p>
    <p><strong>Review evidence ready lanes:</strong> ${htmlEscape(pack.summary.reviewEvidenceReadyLanes)} / ${htmlEscape(pack.summary.totalLanes)}</p>
    <p class="lock">This page creates a teacher-filled JSON receipt only. It does not run commands, execute software, read logs, capture screenshots, write memory, enable rules, delete rollback points, unlock packaging, or claim completion.</p>
    <label>Teacher decision
      <select id="teacherDecision">
        <option value="needs_teacher_review">needs_teacher_review</option>
        <option value="accept_full_original_goal_completion">accept_full_original_goal_completion</option>
        <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
      </select>
    </label>
    <label class="inline"><input id="teacherConfirmedFullOriginalScope" type="checkbox"> Teacher confirms the full original scope was reviewed</label>
    <label class="inline"><input id="teacherReviewedEveryEvidenceLane" type="checkbox"> Teacher reviewed every evidence lane</label>
    <label class="inline"><input id="teacherAcceptsReviewOnlyBoundary" type="checkbox"> Teacher accepts the review-only boundary of these artifacts</label>
    <label class="inline"><input id="teacherAcceptsRemainingCompletionBoundary" type="checkbox"> Teacher accepts the remaining completion boundary and honest limitations</label>
    <label class="inline"><input id="forbiddenAutomationRequested" type="checkbox"> Forbidden automation was requested</label>
    <label>Teacher summary note <input id="teacherSummaryNote" placeholder="Final acceptance review note"></label>
    <p><strong>Next validation command:</strong> <code>${htmlEscape(pack.nextValidationCommand)}</code></p>
  </section>
  <h2>Evidence Lanes</h2>
  <section class="grid">${rows}</section>
  <h2>Receipt JSON</h2>
  <section class="panel">
    <p><button id="generate">Generate Receipt JSON</button> <button id="copy" class="secondary">Copy</button> <button id="download" class="secondary">Download Receipt JSON</button></p>
    <textarea id="output"></textarea>
  </section>
</main>
<script>
const pack = ${jsonForScript(pack)};
function laneReviews() {
  return Array.from(document.querySelectorAll("[data-lane-id]")).map((node) => ({
    laneId: node.dataset.laneId,
    teacherReviewed: Boolean(node.querySelector('[data-field="teacherReviewed"]')?.checked),
    teacherDecision: node.querySelector('[data-field="teacherDecision"]')?.value || "needs_teacher_review",
    teacherNote: node.querySelector('[data-field="teacherNote"]')?.value || ""
  }));
}
function generateReceipt() {
  return {
    format: "transparent_ai_current_goal_final_teacher_acceptance_receipt_v1",
    packId: pack.packId,
    sourceFinalConvergenceReadinessGate: pack.paths.sourceFinalConvergenceReadinessGate,
    teacherDecision: document.getElementById("teacherDecision").value,
    teacherConfirmedFullOriginalScope: document.getElementById("teacherConfirmedFullOriginalScope").checked,
    teacherReviewedEveryEvidenceLane: document.getElementById("teacherReviewedEveryEvidenceLane").checked,
    teacherAcceptsReviewOnlyBoundary: document.getElementById("teacherAcceptsReviewOnlyBoundary").checked,
    teacherAcceptsRemainingCompletionBoundary: document.getElementById("teacherAcceptsRemainingCompletionBoundary").checked,
    forbiddenAutomationRequested: document.getElementById("forbiddenAutomationRequested").checked,
    teacherSummaryNote: document.getElementById("teacherSummaryNote").value || "",
    laneReviews: laneReviews(),
    locks: pack.locks
  };
}
function render() {
  document.getElementById("output").value = JSON.stringify(generateReceipt(), null, 2);
}
document.getElementById("generate").addEventListener("click", render);
document.getElementById("copy").addEventListener("click", async () => {
  render();
  await navigator.clipboard.writeText(document.getElementById("output").value);
});
document.getElementById("download").addEventListener("click", () => {
  render();
  const blob = new Blob([document.getElementById("output").value + "\\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "current-goal-final-teacher-acceptance-receipt.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
render();
</script>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue("--goal", "Build current goal final teacher acceptance review pack without claiming completion.");
const gatePath = resolve(
  argValue(
    "--final-convergence-readiness-gate",
    argValue(
      "--gate",
      newestFile(
        join(repoRoot, "artifacts", "current-goal-final-convergence-readiness-gates"),
        "current-goal-final-convergence-readiness-gate.json"
      )
    )
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-final-teacher-acceptance-review-packs")));
if (!gatePath || !existsSync(gatePath)) throw new Error("Missing current-goal final convergence readiness gate.");
const gate = readJson(gatePath);
if (gate.format !== "transparent_ai_current_goal_final_convergence_readiness_gate_v1") {
  throw new Error("--final-convergence-readiness-gate must be transparent_ai_current_goal_final_convergence_readiness_gate_v1");
}

const lanes = Array.isArray(gate.lanes) ? gate.lanes : [];
const totalLanes = Number(gate.summary?.totalLanes ?? lanes.length);
const reviewEvidenceReadyLanes = Number(gate.summary?.reviewEvidenceReadyLanes ?? lanes.filter((lane) => lane.reviewEvidenceReady).length);
const onlyFinalTeacherAcceptanceMissing =
  gate.status === "convergence_evidence_ready_for_final_teacher_review_not_completion" &&
  totalLanes > 0 &&
  reviewEvidenceReadyLanes === totalLanes - 1 &&
  Number(gate.summary?.completionReadyLanes ?? 0) === 0 &&
  gate.summary?.finalGoalCompletionAllowed === false &&
  lanes.some((lane) => lane.laneId === "explicit_final_teacher_acceptance" && lane.reviewEvidenceReady === false);
const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });
const packPath = join(packDir, "current-goal-final-teacher-acceptance-review-pack.json");
const htmlPath = join(packDir, "current-goal-final-teacher-acceptance-review-pack.html");
const receiptTemplatePath = join(packDir, "current-goal-final-teacher-acceptance-receipt-template.json");
const readmePath = join(packDir, "CURRENT_GOAL_FINAL_TEACHER_ACCEPTANCE_REVIEW_PACK_START_HERE.md");
const nextValidationCommand = commandLine("validate-current-goal-final-teacher-acceptance-receipt.mjs", [
  ["--final-convergence-readiness-gate", gatePath],
  ["--receipt", "<teacher-downloaded-current-goal-final-acceptance-receipt.json>"],
  ["--output-dir", join(packDir, "validated-final-teacher-acceptance")]
]);
const lockState = locks();
const reviewRows = lanes.map((lane) => ({
  laneId: lane.laneId,
  finalGateStatus: lane.finalGateStatus || "",
  evidencePath: lane.evidencePath || "",
  evidenceFormat: lane.evidenceFormat || "",
  evidenceStatus: lane.evidenceStatus || "",
  reviewEvidenceReady: lane.reviewEvidenceReady === true,
  completionReady: lane.completionReady === true,
  canBeTeacherConfirmed: lane.laneId === "explicit_final_teacher_acceptance" || lane.reviewEvidenceReady === true,
  blocker: lane.blocker || ""
}));
const receiptTemplate = {
  format: "transparent_ai_current_goal_final_teacher_acceptance_receipt_v1",
  packId,
  sourceFinalConvergenceReadinessGate: gatePath,
  teacherDecision: "needs_teacher_review",
  teacherConfirmedFullOriginalScope: false,
  teacherReviewedEveryEvidenceLane: false,
  teacherAcceptsReviewOnlyBoundary: false,
  teacherAcceptsRemainingCompletionBoundary: false,
  forbiddenAutomationRequested: false,
  teacherSummaryNote: "",
  laneReviews: reviewRows.map((row) => ({
    laneId: row.laneId,
    teacherReviewed: false,
    teacherDecision: "needs_teacher_review",
    teacherNote: ""
  })),
  locks: lockState
};
const pack = {
  ok: true,
  format: "transparent_ai_current_goal_final_teacher_acceptance_review_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: onlyFinalTeacherAcceptanceMissing
    ? "ready_for_final_teacher_acceptance_review_not_completion"
    : "blocked_before_final_teacher_acceptance_review_pack",
  readyForTeacherFinalAcceptanceReview: onlyFinalTeacherAcceptanceMissing,
  sourceGateStatus: gate.status || "",
  summary: {
    totalLanes,
    reviewEvidenceReadyLanes,
    missingReviewEvidenceLanes: totalLanes - reviewEvidenceReadyLanes,
    completionReadyLanes: Number(gate.summary?.completionReadyLanes ?? 0),
    finalGoalCompletionAllowed: gate.summary?.finalGoalCompletionAllowed === true
  },
  reviewRows,
  receiptTemplate,
  nextValidationCommand,
  blockedActions: [
    "claim_goal_complete_from_final_teacher_acceptance_pack",
    "treat_receipt_template_as_teacher_acceptance",
    "run_commands_from_final_teacher_acceptance_pack",
    "read_logs_from_final_teacher_acceptance_pack",
    "capture_screenshots_from_final_teacher_acceptance_pack",
    "execute_target_software_from_final_teacher_acceptance_pack",
    "write_memory_from_final_teacher_acceptance_pack",
    "enable_rules_from_final_teacher_acceptance_pack",
    "delete_rollback_points_from_final_teacher_acceptance_pack",
    "unlock_packaging_from_final_teacher_acceptance_pack"
  ],
  paths: {
    sourceFinalConvergenceReadinessGate: gatePath,
    pack: packPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath
  },
  locks: lockState
};

writeJson(packPath, pack);
writeJson(receiptTemplatePath, receiptTemplate);
writeHtml(htmlPath, pack);
writeReadme(readmePath, pack);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_final_teacher_acceptance_review_pack_result_v1",
      status: pack.status,
      readyForTeacherFinalAcceptanceReview: pack.readyForTeacherFinalAcceptanceReview,
      packPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      nextValidationCommand,
      locks: lockState
    },
    null,
    2
  )
);
