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
    String(value || "original-goal-teacher-action-router")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-teacher-action-router"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readOptionalJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function compact(value, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function laneRank(row = {}) {
  const lane = String(row.lane || "");
  const review = String(row.reviewEntryId || "");
  if (review.includes("activation") || lane.includes("activation") || row.id === "status_lane_operational_learning") return 10;
  if (lane.includes("transparent_spatial") || review.includes("spatial_intent")) return 20;
  if (lane.includes("coverage")) return 30;
  if (review.includes("action_logic_source_contract")) return 35;
  if (lane.includes("execution")) return 40;
  if (lane.includes("current_status")) return 90;
  return 70;
}

function teacherInstruction(row = {}) {
  const lane = String(row.lane || "");
  const review = String(row.reviewEntryId || "");
  if (review.includes("activation") || lane.includes("activation") || row.id === "status_lane_operational_learning") {
    return "Open the activation receipt builder, confirm only evidence the teacher truly observed, then validate one teacher-filled activation receipt before any registration dry run or task registration.";
  }
  if (lane.includes("transparent_spatial") || review.includes("spatial_intent")) {
    return "Open the spatial intent request, export a real transparent sketch packet, attach passed universal detail-logic validation, then validate the spatial receipt before numbered target confirmation.";
  }
  if (lane.includes("coverage")) {
    return "Open the coverage rollout receipt builder once, cover the listed coverage rows in one teacher receipt, then validate before any reviewed coverage rollout command.";
  }
  if (review.includes("execution_gap_review_cockpit")) {
    return "Open the execution gap review cockpit once, confirm the control route evidence and action logic together, then validate the related receipt before medium-runtime reuse or any dry-run pilot.";
  }
  if (review.includes("action_logic_source_contract")) {
    return "Open the action logic source contract package, let the teacher confirm the source logic and evidence-only RAG/provider boundaries, then validate before medium-runtime reuse or any dry-run pilot.";
  }
  if (lane.includes("execution")) {
    return "Open the execution follow-up receipt builder once, cover the listed execution gaps in one teacher receipt, then validate before any dry-run pilot runner.";
  }
  return "Open the linked review entry and validate a teacher-filled receipt before any downstream action.";
}

function doneCondition(row = {}) {
  const lane = String(row.lane || "");
  const review = String(row.reviewEntryId || "");
  if (review.includes("activation") || lane.includes("activation") || row.id === "status_lane_operational_learning") {
    return "activation receipt validation returns a review-only rerun command with no forbidden decisions";
  }
  if (lane.includes("transparent_spatial") || review.includes("spatial_intent")) {
    return "spatial receipt validation prepares a review-only spatial target confirmation command from a real exported overlay packet";
  }
  if (lane.includes("coverage")) return "coverage receipt validation prepares reviewed coverage follow-up without running batches";
  if (review.includes("execution_gap_review_cockpit")) {
    return "combined execution gap review confirms route evidence plus action logic while keeping execution, memory, rules, and medium-runtime authorization locked";
  }
  if (review.includes("action_logic_source_contract")) {
    return "action logic source receipt validation emits only reviewed matrix patch rows and still keeps execution, memory, rules, and medium-runtime authorization locked";
  }
  if (lane.includes("execution")) return "execution receipt validation prepares reviewed dry-run follow-up without executing target software";
  return "teacher receipt validates without acceptance, execution, memory, or packaging unlock";
}

function stopCondition(row = {}) {
  const lane = String(row.lane || "");
  const review = String(row.reviewEntryId || "");
  if (lane.includes("transparent_spatial")) return "stop if the overlay packet is a placeholder or detail logic validation is missing";
  if (lane.includes("coverage")) return "stop if the receipt requests teacher-reviewed batch execution or coverage acceptance";
  if (review.includes("execution_gap_review_cockpit")) {
    return "stop if control route evidence, action logic, target binding, rollback, verifier, reasoning-tier boundary, or medium runtime reuse condition is missing, or if the receipt asks to execute now";
  }
  if (review.includes("action_logic_source_contract")) {
    return "stop if the receipt accepts technology, treats RAG as authority, enables rules, writes memory, executes software, or allows medium runtime without a validated contract";
  }
  if (lane.includes("execution")) return "stop if the receipt requests execute mode, target software control, or native-universal completion";
  if (lane.includes("activation") || row.id === "status_lane_operational_learning") {
    return "stop if any activation confirmation is missing, ambiguous, or asks to register now";
  }
  return "stop on any accepted, execute_now, enable_memory, claim_complete, or unlock_packaging decision";
}

function routeRowsFromTriage(triage) {
  const rows = Array.isArray(triage?.rows) ? triage.rows : [];
  const groups = new Map();
  for (const row of rows) {
    const key = [row.reviewEntryId || "", row.openPath || "", row.validationCommand || "", row.lane || ""].join("\u001f");
    const existing = groups.get(key);
    const covered = {
      id: row.id || "",
      lane: row.lane || "",
      reviewEntryId: row.reviewEntryId || "",
      order: Number(row.order || 999)
    };
    if (!existing) {
      groups.set(key, {
        source: "next_action_triage",
        sourceRowIds: [covered.id].filter(Boolean),
        lane: row.lane || "",
        reviewEntryId: row.reviewEntryId || "",
        openPath: row.openPath || "",
        validationCommand: row.validationCommand || "",
        firstOrder: Number(row.order || 999),
        priority: laneRank(row),
        teacherInstruction: teacherInstruction(row),
        doneCondition: doneCondition(row),
        stopCondition: stopCondition(row),
        coveredRows: [covered]
      });
    } else {
      if (covered.id) existing.sourceRowIds.push(covered.id);
      existing.coveredRows.push(covered);
      existing.firstOrder = Math.min(existing.firstOrder, Number(row.order || 999));
      existing.priority = Math.min(existing.priority, laneRank(row));
    }
  }
  return [...groups.values()];
}

function firstExistingPath(...paths) {
  const candidates = paths.filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0] || "";
}

function routeRowsFromBudgetPlan(plan) {
  const rows = Array.isArray(plan?.selectedActions) ? plan.selectedActions : [];
  return rows
    .slice(0, 6)
    .map((row, index) => ({
      source: "low_token_trigger_budget_plan",
      sourceRowIds: [row.id || `budget-${index + 1}`],
      lane: "low_token_budget_review",
      reviewEntryId: row.route || "",
      openPath: firstExistingPath(row.evidencePath, plan?.paths?.html, plan?.paths?.plan),
      validationCommand: "",
      firstOrder: 100 + index,
      priority: 50 + index,
      teacherInstruction: row.nextInstruction || "Review this compact low-token evidence before screenshots, memory, or rule enablement.",
      doneCondition: "teacher reviewed compact evidence or explicitly confirmed one bounded screenshot request",
      stopCondition: "stop if the next action would capture screenshots without teacher confirmation or read full logs",
      coveredRows: [
        {
          id: row.id || `budget-${index + 1}`,
          lane: "low_token_budget_review",
          reviewEntryId: row.route || "",
          order: 100 + index
        }
      ],
      estimatedTokenCost: row.estimatedTokenCost || 0,
      screenshotCostClass: row.screenshotCostClass || "none"
    }));
}

function normalizeRows(rows) {
  return rows
    .sort((a, b) => a.priority - b.priority || a.firstOrder - b.firstOrder)
    .map((row, index) => ({
      order: index + 1,
      id: `teacher-action-${index + 1}`,
      source: row.source,
      lane: row.lane,
      reviewEntryId: row.reviewEntryId,
      openPath: row.openPath,
      validationCommand: row.validationCommand,
      teacherInstruction: row.teacherInstruction,
      doneCondition: row.doneCondition,
      stopCondition: row.stopCondition,
      coveredRowCount: row.coveredRows.length,
      coveredRows: row.coveredRows,
      estimatedTokenCost: row.estimatedTokenCost ?? null,
      screenshotCostClass: row.screenshotCostClass || "none",
      locks: {
        reviewOnly: true,
        executeNow: false,
        captureNow: false,
        writeMemoryNow: false,
        enableRulesNow: false,
        acceptTechnologyNow: false,
        unlockPackagingNow: false
      }
    }));
}

function writeHtml(path, router) {
  const rows = router.routeRows
    .map(
      (row) => `<tr>
        <td>${row.order}</td>
        <td>${htmlEscape(row.lane)}</td>
        <td>${htmlEscape(row.teacherInstruction)}</td>
        <td>${row.openPath ? `<a href="${htmlEscape(fileHref(row.openPath))}">${htmlEscape(basename(row.openPath))}</a>` : ""}</td>
        <td><code>${htmlEscape(compact(row.validationCommand || "(review only)", 220))}</code></td>
        <td>${row.coveredRowCount}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Teacher Action Router</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.55; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; overflow-wrap: anywhere; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Teacher Action Router</h1>
    <p><strong>Status:</strong> ${htmlEscape(router.status)}</p>
    <p><strong>Completion boundary:</strong> ${htmlEscape(router.completionBoundary)}</p>
    <p class="lock">This router does not validate receipts, register tasks, launch runners, capture screenshots, execute software, write memory, enable rules, accept technology, unlock packaging, or claim completion.</p>
    <table>
      <thead><tr><th>#</th><th>Lane</th><th>Teacher Action</th><th>Open</th><th>Validation</th><th>Rows</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, router) {
  const lines = [
    "# Original Goal Teacher Action Router",
    "",
    `Status: ${router.status}`,
    `Completion boundary: ${router.completionBoundary}`,
    "",
    "This package merges the current gap board, next-action triage, and low-token budget plan into the shortest teacher-review route I can safely present.",
    "",
    `- Router HTML: ${router.paths.html}`,
    `- Router JSON: ${router.paths.router}`,
    "",
    "Route:",
    ...router.routeRows.map((row) => `- ${row.order}. ${row.lane}: ${row.teacherInstruction} (${row.coveredRowCount} row(s))`),
    "",
    "Safety boundary:",
    "- It does not validate receipts.",
    "- It does not register scheduled tasks or launch runners.",
    "- It does not capture screenshots, execute target software, send UI events, write memory, enable rules, accept technology, unlock packaging, or claim goal completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Route the remaining original-goal teacher actions with the fewest repeated review steps.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-teacher-action-routers"))
);
const statusRefreshInput = readOptionalJsonInput(argValue("--status-refresh", argValue("--refresh", "")), "--status-refresh");
let statusRefresh = statusRefreshInput.value;
const gapInput = readOptionalJsonInput(argValue("--gap-board", statusRefresh?.paths?.gapActionBoard || ""), "--gap-board");
const triageInput = readOptionalJsonInput(argValue("--triage", statusRefresh?.paths?.nextActionTriage || ""), "--triage");
const budgetInput = readOptionalJsonInput(argValue("--budget-plan", statusRefresh?.paths?.lowTokenTriggerBudgetPlan || ""), "--budget-plan");

mkdirSync(outputRoot, { recursive: true });
const routerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const routerDir = join(outputRoot, routerId);
mkdirSync(routerDir, { recursive: true });

const routeRows = normalizeRows([
  ...routeRowsFromTriage(triageInput.value),
  ...routeRowsFromBudgetPlan(budgetInput.value)
]);
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  routerDoesNotValidateReceipts: true,
  routerDoesNotRegisterTask: true,
  routerDoesNotLaunchRunner: true,
  routerDoesNotExecuteWrapper: true,
  routerDoesNotExecuteTargetSoftware: true,
  routerDoesNotCaptureScreenshots: true,
  routerDoesNotReadFullLogs: true,
  routerDoesNotWriteMemory: true,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};

const routerPath = join(routerDir, "original-goal-teacher-action-router.json");
const htmlPath = join(routerDir, "original-goal-teacher-action-router.html");
const readmePath = join(routerDir, "ORIGINAL_GOAL_TEACHER_ACTION_ROUTER_START_HERE.md");
const router = {
  ok: true,
  format: "transparent_ai_original_goal_teacher_action_router_v1",
  routerId,
  createdAt: new Date().toISOString(),
  goal,
  status: routeRows.length ? "waiting_for_teacher_action_route_review" : "blocked_missing_gap_triage_or_budget_evidence",
  completionBoundary:
    statusRefresh?.completionDecision ||
    "not_complete_full_objective_because_teacher_review_and_universal_native_execution_evidence_are_not_proven",
  sourceEvidence: {
    statusRefresh: statusRefreshInput.path,
    gapBoard: gapInput.path,
    gapBoardFormat: gapInput.value?.format || "",
    triage: triageInput.path,
    triageFormat: triageInput.value?.format || "",
    lowTokenTriggerBudgetPlan: budgetInput.path,
    lowTokenTriggerBudgetPlanFormat: budgetInput.value?.format || "",
    gapRows: Array.isArray(gapInput.value?.actionRows) ? gapInput.value.actionRows.length : 0,
    triageRows: Array.isArray(triageInput.value?.rows) ? triageInput.value.rows.length : 0,
    budgetSelectedActions: Array.isArray(budgetInput.value?.selectedActions) ? budgetInput.value.selectedActions.length : 0
  },
  counts: {
    routeRows: routeRows.length,
    coveredTriageRows: routeRows
      .filter((row) => row.source === "next_action_triage")
      .reduce((sum, row) => sum + row.coveredRowCount, 0),
    lowTokenBudgetRows: routeRows.filter((row) => row.source === "low_token_trigger_budget_plan").length
  },
  routeRows,
  blockedActions: [
    "validate_receipt_from_router",
    "register_scheduled_task_from_router",
    "launch_runner_from_router",
    "capture_screenshot_from_router",
    "execute_target_software_from_router",
    "send_ui_events_from_router",
    "write_memory_from_router",
    "enable_rule_from_router",
    "accept_technology_from_router",
    "unlock_packaging_from_router",
    "claim_goal_complete_from_router"
  ],
  locks,
  paths: {
    router: routerPath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(routerPath, `${JSON.stringify(router, null, 2)}\n`, "utf8");
writeHtml(htmlPath, router);
writeReadme(readmePath, router);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_teacher_action_router_result_v1",
      routerPath,
      htmlPath,
      readmePath,
      status: router.status,
      routeRowCount: routeRows.length,
      locks
    },
    null,
    2
  )
);
