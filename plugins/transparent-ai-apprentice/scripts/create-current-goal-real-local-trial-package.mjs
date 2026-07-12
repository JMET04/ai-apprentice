#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "current-goal-real-local-trial-package")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-real-local-trial-package"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileLink(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(pathToFileURL(path).href)}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    realLocalTrialDoesNotRegisterMonitor: true,
    realLocalTrialDoesNotCaptureScreenshots: true,
    realLocalTrialDoesNotRecordScreen: true,
    realLocalTrialDoesNotExecuteTargetSoftware: true,
    realLocalTrialDoesNotWriteMemory: true,
    realLocalTrialDoesNotEnableRules: true,
    realLocalTrialDoesNotDowngradeRuntime: true,
    realLocalTrialDoesNotDeleteRollbackPoints: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function runIntegratedSmoke(outputDir) {
  const result = spawnSync(
    process.execPath,
    [join(pluginRoot, "scripts", "smoke-real-local-full-goal-integrated-cycle.mjs"), "--output-dir", outputDir],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 240000
    }
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "real local integrated smoke failed");
  return JSON.parse(result.stdout);
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter(Boolean)
    .map((part) => {
      const text = String(part);
      return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
    })
    .join(" ");
}

function writeHtml(path, packet) {
  const checkRows = packet.checks
    .map(
      (check) => `<tr>
        <td>${htmlEscape(check.name)}</td>
        <td>${check.pass ? "pass" : "fail"}</td>
        <td>${htmlEscape(check.evidence || "")}</td>
      </tr>`
    )
    .join("\n");
  const pathRows = Object.entries(packet.paths)
    .map(([key, value]) => `<tr><td><code>${htmlEscape(key)}</code></td><td>${fileLink(value || "missing", value)}</td></tr>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Real Local Trial Package</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1180px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-top: 1px solid #e5e8ef; padding: 8px; text-align: left; vertical-align: top; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
    .locked { color: #8a2f18; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Real Local Trial Package</h1>
  <p class="status">${htmlEscape(packet.status)}</p>
  <section>
    <h2>Boundary</h2>
    <p class="locked">This package reuses the existing real-local integrated smoke to prove a bounded review-only path on this machine. It does not register monitors, capture screenshots, record screen, execute target software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Real Local Software</h2>
    <pre>${htmlEscape(JSON.stringify(packet.realLocalSoftware, null, 2))}</pre>
  </section>
  <section>
    <h2>Checks</h2>
    <table>
      <thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead>
      <tbody>${checkRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Evidence Paths</h2>
    <table>${pathRows}</table>
  </section>
  <section>
    <h2>Next Manual Command</h2>
    <pre>${htmlEscape(packet.nextManualCommand)}</pre>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Current Goal Real Local Trial Package",
    "",
    `Status: ${packet.status}`,
    "",
    "This package runs the existing real-local integrated review-only cycle and fixes the output under artifacts for teacher discussion.",
    "",
    `- Real local software: ${packet.realLocalSoftware.software || "unknown"}`,
    `- Process: ${packet.realLocalSoftware.processName || "unknown"}`,
    `- Checks passed: ${packet.checks.filter((check) => check.pass).length}/${packet.checks.length}`,
    `- Goal complete: ${packet.goalComplete}`,
    "",
    "## Important boundary",
    "",
    "- No monitor registration.",
    "- No screenshots or screen recording.",
    "- No target software execution.",
    "- No memory write or rule enablement.",
    "- No rollback deletion.",
    "",
    "## Next manual command",
    "",
    packet.nextManualCommand,
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Prove the current objective on real local context as a bounded review-only trial before teacher acceptance."
);
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-real-local-trial-packages")));
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const packageDir = join(outputRoot, packageId);
const evidenceDir = join(packageDir, "integrated-cycle-evidence");
mkdirSync(evidenceDir, { recursive: true });

const smoke = runIntegratedSmoke(evidenceDir);
const summary = readJson(smoke.summaryPath);
const packetPath = join(packageDir, "current-goal-real-local-trial-package.json");
const htmlPath = join(packageDir, "current-goal-real-local-trial-package.html");
const readmePath = join(packageDir, "CURRENT_GOAL_REAL_LOCAL_TRIAL_PACKAGE.md");
const passed = summary.checks.filter((check) => check.pass).length;
const failed = summary.checks.filter((check) => !check.pass);
const status = failed.length === 0
  ? "real_local_trial_evidence_ready_review_only_goal_not_complete"
  : "real_local_trial_evidence_failed_review_required";
const nextManualCommand = commandText("create-current-goal-teacher-trial-intake-router.mjs", [
  "--launchpad",
  join("artifacts", "current-goal-start-here", "current-goal-start-here.json"),
  "--receipt",
  "<teacher-filled-trial-workbench-receipt.json>",
  "--output-dir",
  join("artifacts", "current-goal-teacher-trial-intake-routers")
]);
const packet = {
  ok: failed.length === 0,
  format: "transparent_ai_current_goal_real_local_trial_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceSmoke: "smoke-real-local-full-goal-integrated-cycle.mjs",
  smokeSummaryPath: smoke.summaryPath,
  smokeRoot: smoke.smokeRoot,
  realLocalSoftware: smoke.realLocalSoftware || summary.realLocalSoftware || {},
  checkSummary: {
    total: summary.checks.length,
    passed,
    failed: failed.length
  },
  checks: summary.checks.map((check) => ({
    name: check.name,
    pass: Boolean(check.pass),
    evidence: typeof check.evidence === "string" ? check.evidence : JSON.stringify(check.evidence || {})
  })),
  paths: {
    package: packetPath,
    html: htmlPath,
    readme: readmePath,
    smokeSummary: smoke.summaryPath,
    ...summary.paths
  },
  nextManualCommand,
  completionBoundary: {
    goalComplete: false,
    reason:
      "This is bounded real-local review-only evidence. It proves integration on sampled local context, not teacher acceptance or all-software completion."
  },
  blockedActions: [
    "claim_goal_complete_from_real_local_trial_package",
    "register_monitor_from_real_local_trial_package",
    "capture_screenshot_from_real_local_trial_package",
    "record_screen_from_real_local_trial_package",
    "execute_target_software_from_real_local_trial_package",
    "write_memory_from_real_local_trial_package",
    "enable_rules_from_real_local_trial_package",
    "downgrade_to_medium_runtime_from_real_local_trial_package",
    "delete_rollback_points_from_real_local_trial_package"
  ],
  locks: locks(),
  goalComplete: false
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_current_goal_real_local_trial_package_result_v1",
      status,
      packagePath: packetPath,
      htmlPath,
      readmePath,
      smokeSummaryPath: smoke.summaryPath,
      realLocalSoftware: packet.realLocalSoftware,
      checkSummary: packet.checkSummary,
      goalComplete: false,
      locks: packet.locks
    },
    null,
    2
  )
);
