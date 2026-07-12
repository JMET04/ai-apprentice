#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function write(path, text) {
  writeFileSync(path, text, "utf8");
  return path;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runAudit(args) {
  const result = spawnSync(process.execPath, [join("plugins", "transparent-ai-apprentice", "scripts", "audit-original-goal-review-entrypoint-health.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "audit failed");
  return JSON.parse(result.stdout);
}

const smokeRoot = join(process.cwd(), ".transparent-apprentice", "original-goal-review-entrypoint-health-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const readme = write(join(smokeRoot, "START_HERE.md"), "# Start\n");
const dashboard = write(join(smokeRoot, "dashboard.html"), "<!doctype html><html><head><title>Dashboard</title></head><body>ok</body></html>\n");
const activation = write(join(smokeRoot, "activation.html"), "<!doctype html><html><head><title>Activation</title></head><body>ok</body></html>\n");
const coverage = write(join(smokeRoot, "coverage.html"), "<!doctype html><html><head><title>Coverage</title></head><body>ok</body></html>\n");
const routerHtml = write(join(smokeRoot, "router.html"), "<!doctype html><html><head><title>Router</title></head><body>ok</body></html>\n");
const budget = write(join(smokeRoot, "budget.json"), "{\"ok\":true}\n");
const routerPath = writeJson(join(smokeRoot, "router.json"), {
  format: "transparent_ai_original_goal_teacher_action_router_v1",
  paths: {
    router: join(smokeRoot, "router.json"),
    html: routerHtml
  },
  routeRows: [
    {
      id: "route-1",
      reviewEntryId: "activation_receipt_builder",
      openPath: activation
    },
    {
      id: "route-2",
      reviewEntryId: "coverage_rollout_receipt_builder",
      openPath: coverage
    }
  ]
});
const refreshPath = writeJson(join(smokeRoot, "refresh.json"), {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Audit entrypoint health smoke",
  paths: {
    refresh: join(smokeRoot, "refresh.json"),
    readme,
    currentStatusDashboardHtml: dashboard,
    teacherActionRouter: routerPath,
    teacherActionRouterHtml: routerHtml,
    optionalMissingPath: join(smokeRoot, "missing-optional.html")
  },
  directReviewEntryPoints: [
    { id: "activation_receipt_builder", label: "Activation receipt builder", path: activation },
    { id: "coverage_rollout_receipt_builder", label: "Coverage rollout receipt builder", path: coverage }
  ],
  nextCommands: [
    { label: "Open teacher action router", command: routerHtml },
    { label: "Run command that should be ignored", command: "node plugins\\transparent-ai-apprentice\\scripts\\example.mjs" }
  ]
});

const healthyResult = runAudit(["--status-refresh", refreshPath, "--output-dir", join(smokeRoot, "healthy")]);
const healthyAudit = readJson(healthyResult.auditPath);
const healthyHtml = readFileSync(healthyResult.htmlPath, "utf8");

const missingRefreshPath = writeJson(join(smokeRoot, "refresh-missing.json"), {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Audit entrypoint health smoke missing",
  paths: {
    refresh: join(smokeRoot, "refresh-missing.json"),
    readme,
    currentStatusDashboardHtml: dashboard,
    teacherActionRouter: routerPath,
    teacherActionRouterHtml: routerHtml
  },
  directReviewEntryPoints: [
    { id: "missing_required", label: "Missing required review page", path: join(smokeRoot, "missing-required.html") }
  ],
  nextCommands: []
});
const missingResult = runAudit(["--status-refresh", missingRefreshPath, "--output-dir", join(smokeRoot, "missing")]);
const missingAudit = readJson(missingResult.auditPath);

const checks = [
  {
    name: "Entrypoint health audit proves required review links are openable",
    pass:
      healthyAudit.format === "transparent_ai_original_goal_review_entrypoint_health_audit_v1" &&
      healthyAudit.status === "all_required_review_entrypoints_openable" &&
      healthyAudit.counts.failedRequired === 0 &&
      healthyAudit.entries.some((entry) => entry.source === "teacherActionRouter.routeRows" && entry.label === "activation_receipt_builder") &&
      healthyAudit.entries.some((entry) => entry.source === "directReviewEntryPoints" && entry.label === "Coverage rollout receipt builder") &&
      healthyHtml.includes("Original Goal Review Entrypoint Health"),
    evidence: healthyResult.htmlPath
  },
  {
    name: "Entrypoint health audit reports missing required review links without executing actions",
    pass:
      missingAudit.status === "missing_or_unopenable_required_review_entrypoints" &&
      missingAudit.counts.failedRequired === 1 &&
      missingAudit.failedRequired[0]?.label === "Missing required review page" &&
      missingAudit.locks.auditDoesNotRunCommands === true &&
      missingAudit.locks.auditDoesNotExecuteTargetSoftware === true &&
      missingAudit.locks.auditDoesNotCaptureScreenshots === true &&
      missingAudit.locks.goalComplete === false,
    evidence: missingResult.auditPath
  },
  {
    name: "Entrypoint health audit keeps optional and command-template paths out of the critical failure lane",
    pass:
      healthyAudit.entries.some((entry) => entry.label === "optionalMissingPath" && entry.status === "missing_optional_entrypoint" && entry.pass === true) &&
      !healthyAudit.entries.some((entry) => entry.label === "Run command that should be ignored") &&
      healthyAudit.locks.nativeUniversalExecution === false &&
      healthyAudit.locks.memoryWritten === false,
    evidence: healthyResult.auditPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_original_goal_review_entrypoint_health_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    healthyAudit: healthyResult.auditPath,
    missingAudit: missingResult.auditPath
  }
};
console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
