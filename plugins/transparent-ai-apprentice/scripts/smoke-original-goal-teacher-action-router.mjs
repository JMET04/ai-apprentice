#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const smokeRoot = join(process.cwd(), ".transparent-apprentice", "original-goal-teacher-action-router-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

const triagePath = join(smokeRoot, "original-goal-next-action-triage.json");
const gapPath = join(smokeRoot, "original-goal-gap-action-board.json");
const budgetPath = join(smokeRoot, "low-token-trigger-budget-plan.json");
const statusPath = join(smokeRoot, "original-goal-current-status-refresh.json");
const activationHtml = join(smokeRoot, "activation-receipt-builder.html");
const spatialHtml = join(smokeRoot, "spatial-intent-evidence-request.html");
const coverageHtml = join(smokeRoot, "coverage-rollout-receipt-builder.html");
const actionLogicHtml = join(smokeRoot, "action-logic-source-contract-package.html");
const executionHtml = join(smokeRoot, "execution-follow-up-receipt-builder.html");
writeFileSync(activationHtml, "<html>activation</html>\n", "utf8");
writeFileSync(spatialHtml, "<html>spatial</html>\n", "utf8");
writeFileSync(coverageHtml, "<html>coverage</html>\n", "utf8");
writeFileSync(actionLogicHtml, "<html>action logic contract</html>\n", "utf8");
writeFileSync(executionHtml, "<html>execution</html>\n", "utf8");

const triage = {
  format: "transparent_ai_original_goal_next_action_triage_v1",
  rows: [
    {
      order: 1,
      id: "status_lane_operational_learning",
      lane: "current_status",
      reviewEntryId: "activation_receipt_builder",
      openPath: activationHtml,
      validationCommand: "node validate-all-software-operational-activation-review-receipt.mjs --receipt <teacher-filled.json>"
    },
    {
      order: 2,
      id: "spatial_spatial_intent_evidence_missing",
      lane: "transparent_spatial_intent",
      reviewEntryId: "spatial_intent_evidence_request",
      openPath: spatialHtml,
      validationCommand: "node validate-spatial-intent-evidence-receipt.mjs --receipt <teacher-filled.json>"
    },
    ...["coverage_batch-001", "coverage_batch-002", "coverage_batch-003"].map((id, index) => ({
      order: 3 + index,
      id,
      lane: "all_software_low_token_coverage",
      reviewEntryId: "coverage_rollout_receipt_builder",
      openPath: coverageHtml,
      validationCommand: "node validate-all-software-coverage-rollout-receipt.mjs --receipt <teacher-filled.json>"
    })),
    {
      order: 6,
      id: "execution_action_logic_source_missing",
      lane: "all_software_execution_capability",
      reviewEntryId: "action_logic_source_contract_package",
      openPath: actionLogicHtml,
      validationCommand: "node validate-all-software-action-logic-source-contract-receipt.mjs --package <action-logic-source-contract-package.json> --receipt <teacher-filled.json>"
    },
    {
      order: 7,
      id: "execution_dry_run_receipts_missing",
      lane: "all_software_execution_capability",
      reviewEntryId: "execution_follow_up_receipt_builder",
      openPath: executionHtml,
      validationCommand: "node validate-all-software-execution-follow-up-receipt.mjs --receipt <teacher-filled.json>"
    }
  ]
};
writeFileSync(triagePath, `${JSON.stringify(triage, null, 2)}\n`, "utf8");
writeFileSync(
  gapPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_gap_action_board_v1",
      actionRows: triage.rows.map((row) => ({ id: row.id, lane: row.lane }))
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  budgetPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_low_token_trigger_budget_plan_v1",
      status: "waiting_for_teacher_low_token_trigger_budget_review",
      selectedActions: [
        {
          id: "compact-learning-1",
          route: "compact_learning_review_only",
          estimatedTokenCost: 2,
          screenshotCostClass: "none",
          evidencePath: join(smokeRoot, "compact-learning-events.json"),
          nextInstruction: "Review compact learning evidence before screenshots."
        },
        {
          id: "visual-request-1",
          route: "one_screenshot_after_teacher_confirmation",
          estimatedTokenCost: 8,
          screenshotCostClass: "bounded_single_screenshot",
          evidencePath: join(smokeRoot, "visual-check-queue.json"),
          nextInstruction: "Ask the teacher before one bounded screenshot."
        }
      ],
      paths: {
        plan: budgetPath,
        html: join(smokeRoot, "low-token-trigger-budget-plan.html")
      },
      locks: {
        screenshotsCaptured: false,
        softwareActionsExecuted: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  statusPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_current_status_refresh_v1",
      completionDecision: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
      paths: {
        gapActionBoard: gapPath,
        nextActionTriage: triagePath,
        lowTokenTriggerBudgetPlan: budgetPath
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-original-goal-teacher-action-router.mjs", [
  "--status-refresh",
  statusPath,
  "--output-dir",
  join(smokeRoot, "router")
]);
const router = readJson(result.routerPath);
const html = readFileSync(result.htmlPath, "utf8");
const coverageRoute = router.routeRows.find((row) => row.reviewEntryId === "coverage_rollout_receipt_builder");
const activationRoute = router.routeRows.find((row) => row.reviewEntryId === "activation_receipt_builder");
const actionLogicRoute = router.routeRows.find((row) => row.reviewEntryId === "action_logic_source_contract_package");
const executionRoute = router.routeRows.find((row) => row.reviewEntryId === "execution_follow_up_receipt_builder");
const budgetRoutes = router.routeRows.filter((row) => row.source === "low_token_trigger_budget_plan");

const checks = [
  {
    name: "Teacher action router merges repeated receipt rows into one teacher step",
    pass:
      router.format === "transparent_ai_original_goal_teacher_action_router_v1" &&
      router.status === "waiting_for_teacher_action_route_review" &&
      activationRoute?.order === 1 &&
      coverageRoute?.coveredRowCount === 3 &&
      router.counts.coveredTriageRows === triage.rows.length,
    evidence: result.routerPath
  },
  {
    name: "Teacher action router prioritizes action logic contracts before execution dry runs",
    pass:
      actionLogicRoute?.openPath === actionLogicHtml &&
      actionLogicRoute?.order < executionRoute?.order &&
      actionLogicRoute?.teacherInstruction.includes("action logic source contract package") &&
      actionLogicRoute?.doneCondition.includes("matrix patch rows") &&
      actionLogicRoute?.stopCondition.includes("medium runtime"),
    evidence: result.routerPath
  },
  {
    name: "Teacher action router carries low-token budget review without screenshots",
    pass:
      budgetRoutes.length === 2 &&
      budgetRoutes.some((row) => row.reviewEntryId === "compact_learning_review_only") &&
      budgetRoutes.some((row) => row.reviewEntryId === "one_screenshot_after_teacher_confirmation") &&
      budgetRoutes.every((row) => existsSync(row.openPath)) &&
      router.locks.routerDoesNotCaptureScreenshots === true &&
      router.locks.softwareActionsExecuted === false,
    evidence: result.htmlPath
  },
  {
    name: "Teacher action router stays review-only and visible",
    pass:
      router.locks.routerDoesNotValidateReceipts === true &&
      router.locks.routerDoesNotRegisterTask === true &&
      router.locks.routerDoesNotExecuteTargetSoftware === true &&
      router.locks.goalComplete === false &&
      html.includes("Original Goal Teacher Action Router") &&
      html.includes("does not validate receipts"),
    evidence: result.readmePath
  }
];

const passed = checks.filter((check) => check.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_original_goal_teacher_action_router_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    router: result.routerPath,
    html: result.htmlPath,
    readme: result.readmePath
  }
};
console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
