#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "low-token-trigger-budget-plan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "low-token-trigger-budget-plan"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classificationNeedsVisual(classification = "") {
  return /failure|error|blocker|warning|ambiguous|teacher/i.test(String(classification));
}

function action(id, fields) {
  return {
    id,
    route: fields.route,
    priority: fields.priority ?? 50,
    estimatedTokenCost: fields.estimatedTokenCost ?? 1,
    screenshotCostClass: fields.screenshotCostClass ?? "none",
    status: fields.status ?? "waiting_for_teacher_review",
    software: fields.software || "",
    reason: fields.reason || "",
    evidencePath: fields.evidencePath || "",
    nextTool: fields.nextTool || "",
    nextInstruction: fields.nextInstruction || "",
    blockedUntil: fields.blockedUntil || [],
    locks: {
      reviewOnly: true,
      captureNow: false,
      executeNow: false,
      writeMemoryNow: false,
      enableRulesNow: false
    }
  };
}

function actionsFromCycle(cycle, cyclePath) {
  const actions = [];
  let index = 1;

  for (const metadataRun of cycle.metadataGateRuns || []) {
    const changed = Number(metadataRun.changedLogMetadata || 0);
    const scanned = Number(metadataRun.scannedLogMetadata || 0);
    if (changed > 0) {
      actions.push(
        action(`metadata-tail-first-${index++}`, {
          route: "bounded_tail_review_before_visual_check",
          priority: 15,
          estimatedTokenCost: 1,
          software: metadataRun.software || "",
          reason: `${changed} changed log metadata rows out of ${scanned}; bounded tail review is cheaper than a screenshot.`,
          evidencePath: metadataRun.gatePath || cyclePath,
          nextTool: "run_all_software_low_token_learning_cycle",
          nextInstruction: "Review bounded changed-log snippets first. Request one visual check only if the compact evidence is still ambiguous.",
          blockedUntil: ["teacher_reviews_changed_metadata_or_bounded_tail"]
        })
      );
    } else if (scanned > 0) {
      actions.push(
        action(`skip-unchanged-metadata-${index++}`, {
          route: "skip_visual_check_unchanged_metadata",
          priority: 90,
          estimatedTokenCost: 0,
          software: metadataRun.software || "",
          reason: "Metadata did not change, so screenshot and tail reads stay skipped.",
          evidencePath: metadataRun.gatePath || cyclePath,
          nextInstruction: "Wait for the next metadata delta instead of spending screenshot tokens."
        })
      );
    }
  }

  for (const watchRun of cycle.watchRuns || []) {
    for (const changedItem of watchRun.changedItems || []) {
      const classifications = changedItem.classifications || [];
      const needsVisual = changedItem.screenshotRecommended === true || classifications.some(classificationNeedsVisual);
      actions.push(
        action(`changed-item-${index++}`, {
          route: needsVisual ? "one_screenshot_after_teacher_confirmation" : "compact_learning_review_only",
          priority: needsVisual ? 25 : 20,
          estimatedTokenCost: needsVisual ? 8 : 2,
          screenshotCostClass: needsVisual ? "bounded_single_screenshot" : "none",
          software: changedItem.software || "",
          reason: needsVisual
            ? `Changed item has visual-trigger classification: ${classifications.join(", ") || "screenshotRecommended"}`
            : "Changed item can be reviewed from compact low-token evidence first.",
          evidencePath: watchRun.watchCyclePath || cyclePath,
          nextTool: needsVisual ? "capture_triggered_visual_check" : "teach_apprentice",
          nextInstruction: needsVisual
            ? "Ask the teacher before capturing at most one bounded screenshot."
            : "Teach from the compact changed evidence without screenshot capture.",
          blockedUntil: needsVisual ? ["teacher_confirms_one_bounded_screenshot"] : ["teacher_reviews_compact_event"]
        })
      );
    }
  }

  for (const learningRun of cycle.learningRuns || []) {
    const compactEventCount = Number(learningRun.compactEventCount || 0);
    if (compactEventCount <= 0) continue;
    const classifications = learningRun.classifications || [];
    const needsVisual = classifications.some(classificationNeedsVisual);
    actions.push(
      action(`compact-learning-${index++}`, {
        route: needsVisual ? "compact_learning_then_optional_visual_check" : "compact_learning_review_only",
        priority: needsVisual ? 18 : 12,
        estimatedTokenCost: needsVisual ? 3 : 2,
        screenshotCostClass: "deferred_optional",
        software: learningRun.software || "",
        reason: `${compactEventCount} compact learning events are ready; ${needsVisual ? "visual check remains optional after teacher review" : "no visual check is needed yet"}.`,
        evidencePath: learningRun.compactLearningEventsPath || learningRun.observationPath || cyclePath,
        nextTool: "teach_apprentice",
        nextInstruction: "Review compact learning events before memory, screenshots, or rule enablement.",
        blockedUntil: ["teacher_reviews_compact_learning_events"]
      })
    );
  }

  return actions;
}

function cyclePathsFromRunner(runner) {
  return (runner?.runRecords || [])
    .map((record) => record.learningCyclePath)
    .filter((path) => path && existsSync(path));
}

function actionsFromVisualQueue(queue, queuePath) {
  return (queue?.requests || []).map((request, index) =>
    action(`visual-request-${index + 1}`, {
      route: "one_screenshot_after_teacher_confirmation",
      priority: 30,
      estimatedTokenCost: 8,
      screenshotCostClass: "bounded_single_screenshot",
      software: request.software || "",
      reason: request.triggerReason || "visual check requested by automatic low-token queue",
      evidencePath: queuePath || request.learningCyclePath || request.sourcePath || "",
      nextTool: "capture_triggered_visual_check",
      nextInstruction: "Capture at most one bounded screenshot only after the teacher confirms this request.",
      blockedUntil: ["teacher_confirms_visual_check_request"]
    })
  );
}

function actionsFromPreflightPolicy(policy, policyPath) {
  return (policy?.preflightLanes || [])
    .filter((lane) => !["evidence_present", "no_visual_check_needed", "ready_for_teacher_execute_review"].includes(String(lane.status || "")))
    .map((lane, index) =>
      action(`preflight-gap-${index + 1}`, {
        route: "fill_preflight_gap_before_spending_tokens",
        priority: 10 + index,
        estimatedTokenCost: 1,
        reason: `${lane.id || "preflight lane"} is ${lane.status || "waiting"}`,
        evidencePath: lane.evidencePath || policyPath || "",
        nextTool: "",
        nextInstruction: lane.nextReviewAction || "Fill the missing preflight evidence before screenshots or execution.",
        blockedUntil: ["missing_preflight_evidence"]
      })
    );
}

function writeHtml(path, plan) {
  const rows = plan.selectedActions
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.route)}</td>
        <td>${row.estimatedTokenCost}</td>
        <td>${escapeHtml(row.screenshotCostClass)}</td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${escapeHtml(row.nextInstruction)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Low Token Trigger Budget Plan</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #17202a; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #ccd1d1; padding: 8px; vertical-align: top; }
    th { background: #eef2f3; text-align: left; }
    code { background: #eef2f3; padding: 2px 4px; }
  </style>
</head>
<body>
  <h1>Low Token Trigger Budget Plan</h1>
  <p>Status: <strong>${escapeHtml(plan.status)}</strong></p>
  <p>Budget: ${plan.tokenBudget}; selected cost: ${plan.selectedEstimatedTokenCost}</p>
  <table>
    <thead><tr><th>ID</th><th>Route</th><th>Cost</th><th>Screenshot</th><th>Reason</th><th>Next instruction</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Plan JSON: <code>${escapeHtml(plan.paths.plan)}</code></p>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Plan the lowest-token next action after automatic software evidence changes.");
const software = argValue("--software", argValue("--app", ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "low-token-trigger-budget-plans")));
const tokenBudget = Math.max(1, Number(argValue("--token-budget", "12")));
const maxActions = Math.max(1, Number(argValue("--max-actions", "8")));

const runnerInput = readJsonInput(argValue("--runner", argValue("--runner-journal", "")), "--runner");
const cycleInput = readJsonInput(argValue("--learning-cycle", argValue("--cycle", "")), "--learning-cycle");
const visualQueueInput = readJsonInput(argValue("--visual-check-queue", argValue("--automatic-visual-check-queue", "")), "--visual-check-queue");
const preflightInput = readJsonInput(argValue("--preflight-policy", argValue("--policy", "")), "--preflight-policy");

mkdirSync(outputRoot, { recursive: true });
const planId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const planDir = join(outputRoot, planId);
mkdirSync(planDir, { recursive: true });

const cycleEntries = [];
if (cycleInput.value) cycleEntries.push({ value: cycleInput.value, path: cycleInput.path });
for (const path of cyclePathsFromRunner(runnerInput.value)) cycleEntries.push({ value: readJson(path), path });

const rawCandidateActions = [
  ...cycleEntries.flatMap((entry) => actionsFromCycle(entry.value, entry.path)),
  ...actionsFromVisualQueue(visualQueueInput.value, visualQueueInput.path),
  ...actionsFromPreflightPolicy(preflightInput.value, preflightInput.path)
];
const candidateActions = [];
const seenActionKeys = new Set();
const idCounts = new Map();
for (const row of rawCandidateActions) {
  const dedupeKey = [row.route, row.id, row.evidencePath, row.nextInstruction, row.reason].join("\u001f");
  if (seenActionKeys.has(dedupeKey)) continue;
  seenActionKeys.add(dedupeKey);
  const baseId = row.id || `budget-action-${candidateActions.length + 1}`;
  const nextCount = idCounts.get(baseId) || 0;
  idCounts.set(baseId, nextCount + 1);
  candidateActions.push({
    ...row,
    id: nextCount === 0 ? baseId : `${baseId}-${nextCount + 1}`,
    software: row.software || software
  });
}

const sortedActions = candidateActions
  .sort((a, b) => a.priority - b.priority || a.estimatedTokenCost - b.estimatedTokenCost || a.id.localeCompare(b.id))
  .slice(0, maxActions);

let spent = 0;
const selectedActions = [];
const deferredActions = [];
for (const row of sortedActions) {
  if (spent + row.estimatedTokenCost <= tokenBudget || selectedActions.length === 0) {
    selectedActions.push(row);
    spent += row.estimatedTokenCost;
  } else {
    deferredActions.push({ ...row, deferredReason: "token_budget_exceeded" });
  }
}

const hasEvidence = Boolean(runnerInput.value || cycleInput.value || visualQueueInput.value || preflightInput.value);
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  metadataFirst: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  scheduledTaskRegistered: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeCapture: true,
  teacherConfirmationRequiredBeforeExecution: true
};

const planPath = join(planDir, "low-token-trigger-budget-plan.json");
const htmlPath = join(planDir, "low-token-trigger-budget-plan.html");
const readmePath = join(planDir, "LOW_TOKEN_TRIGGER_BUDGET_PLAN_START_HERE.md");

const plan = {
  ok: true,
  format: "transparent_ai_low_token_trigger_budget_plan_v1",
  planId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status: !hasEvidence
    ? "blocked_waiting_for_low_token_runner_cycle_visual_queue_or_preflight_policy"
    : selectedActions.length
      ? "waiting_for_teacher_low_token_trigger_budget_review"
      : "no_low_token_trigger_action_needed",
  purpose:
    "Choose the cheapest reviewed next action after log/state evidence changes: skip unchanged sources, prefer compact evidence, and ask for at most one screenshot only when the signal justifies it.",
  tokenBudget,
  selectedEstimatedTokenCost: spent,
  candidateActionCount: candidateActions.length,
  selectedActionCount: selectedActions.length,
  deferredActionCount: deferredActions.length,
  sourceEvidence: {
    runnerPath: runnerInput.path,
    runnerFormat: runnerInput.value?.format || "",
    learningCyclePath: cycleInput.path,
    learningCycleFormat: cycleInput.value?.format || "",
    visualCheckQueuePath: visualQueueInput.path,
    visualCheckQueueFormat: visualQueueInput.value?.format || "",
    preflightPolicyPath: preflightInput.path,
    preflightPolicyFormat: preflightInput.value?.format || "",
    inspectedCycleCount: cycleEntries.length
  },
  budgetRules: [
    "unchanged metadata costs zero and never triggers screenshots",
    "changed metadata routes to bounded tail or compact evidence first",
    "compact learning events go to teacher review before memory",
    "visual checks are deferred and limited to one screenshot after teacher confirmation",
    "execution remains outside this plan and requires the separate execution gate"
  ],
  selectedActions,
  deferredActions,
  blockedActions: [
    "continuous_recording",
    "screenshot_without_teacher_confirmation",
    "bulk_screenshot_collection",
    "full_log_retention",
    "software_execution",
    "ui_event_dispatch",
    "long_term_memory_write",
    "rule_enablement",
    "packaging_or_goal_completion_claim"
  ],
  locks,
  paths: {
    plan: planPath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
writeHtml(htmlPath, plan);
writeFileSync(
  readmePath,
  [
    "# Low Token Trigger Budget Plan",
    "",
    `Status: ${plan.status}`,
    `Token budget: ${plan.tokenBudget}`,
    `Selected estimated cost: ${plan.selectedEstimatedTokenCost}`,
    "",
    "Selected actions:",
    ...(selectedActions.length
      ? selectedActions.map((row) => `- ${row.id}: ${row.route}; cost=${row.estimatedTokenCost}; ${compact(row.reason)}`)
      : ["- none"]),
    "",
    "This plan does not capture screenshots, read full logs, execute software, send UI events, write memory, enable rules, unlock packaging, or claim completion.",
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_low_token_trigger_budget_plan_result_v1",
      planPath,
      htmlPath,
      readmePath,
      status: plan.status,
      selectedActionCount: selectedActions.length,
      selectedEstimatedTokenCost: spent,
      locks
    },
    null,
    2
  )
);
