#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "real-local-all-software-low-token-readiness")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "real-local-all-software-low-token-readiness";
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: Number(argValue("--child-timeout-ms", "120000"))
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function powershellCandidates() {
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const candidates = [
    join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    join(windowsRoot, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe"),
    join("C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    join("C:\\Windows", "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe"),
    "powershell.exe",
    "powershell"
  ];
  return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
}

function runPowerShell(args, cwd) {
  const tried = [];
  let result = null;
  for (const command of powershellCandidates()) {
    tried.push(command);
    result = spawnSync(command, ["-ExecutionPolicy", "Bypass", ...args], {
      cwd,
      encoding: "utf8",
      timeout: Number(argValue("--child-timeout-ms", "120000")),
      maxBuffer: 20 * 1024 * 1024
    });
    if (!result.error || result.error.code !== "ENOENT") break;
  }
  if (result.status !== 0) {
    const details = [
      result.error?.message ? `error=${result.error.message}` : "",
      tried.length ? `tried=${tried.join(", ")}` : "",
      result.status !== null ? `status=${result.status}` : "status=null",
      result.signal ? `signal=${result.signal}` : "",
      result.stderr ? `stderr=${result.stderr}` : "",
      result.stdout ? `stdout=${result.stdout}` : ""
    ].filter(Boolean);
    throw new Error(details.join("\n") || `${args.join(" ")} failed`);
  }
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTeacherReviewDashboard({ packageJson, logSourceLedger, repair, visualQueueJson }) {
  const statusCounts = Object.entries(
    (logSourceLedger.rows || []).reduce((acc, row) => {
      acc[row.discoveryStatus || "unknown"] = (acc[row.discoveryStatus || "unknown"] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([status, count]) => `<li><strong>${escapeHtml(status)}</strong>: ${count}</li>`)
    .join("\n");
  const reviewRows = (repair.repairItems || []).slice(0, 12);
  const repairRows = reviewRows.length
    ? reviewRows
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.software)}</td>
              <td>${escapeHtml(item.actionKind)}</td>
              <td>${escapeHtml(item.reason)}</td>
              <td>${item.screenshotsAllowedNow === true ? "yes" : "no"}</td>
              <td>${item.executionAllowedNow === true ? "yes" : "no"}</td>
            </tr>`
        )
        .join("\n")
    : `<tr><td colspan="5">No repair rows are waiting.</td></tr>`;
  const visualRequests = Array.isArray(visualQueueJson?.requests) ? visualQueueJson.requests.length : 0;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Real Local All-Software Low-Token Teacher Review</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2933; background: #f7f8fa; }
    main { max-width: 1120px; margin: 0 auto; }
    section { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 16px; margin: 0 0 16px; }
    h1, h2 { margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e2e6ee; border-radius: 6px; padding: 12px; background: #fbfcfe; }
    .metric strong { display: block; font-size: 22px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5e9f0; text-align: left; padding: 8px; vertical-align: top; }
    th { background: #eef2f7; }
    code { word-break: break-all; }
  </style>
</head>
<body>
<main>
  <h1>Real Local All-Software Low-Token Teacher Review</h1>
  <section>
    <h2>Coverage Snapshot</h2>
    <div class="grid">
      <div class="metric"><strong>${packageJson.counts.realLocalCandidates}</strong>real local candidates</div>
      <div class="metric"><strong>${packageJson.counts.nonCadSolidWorksCandidates}</strong>non-CAD/SolidWorks candidates</div>
      <div class="metric"><strong>${packageJson.counts.logSourceDiscoveryRows}</strong>source-route rows</div>
      <div class="metric"><strong>${packageJson.counts.logSourceDiscoveryMissingRows}</strong>missing source rows</div>
      <div class="metric"><strong>${packageJson.counts.directLogCandidatesReadyForMetadataGate}</strong>direct log routes</div>
      <div class="metric"><strong>${packageJson.counts.lowTokenFallbackRoutesReadyForReview}</strong>fallback routes needing review</div>
      <div class="metric"><strong>${packageJson.counts.compactLearningEvents}</strong>compact learning events</div>
      <div class="metric"><strong>${packageJson.counts.repairItems}</strong>teacher review repair items</div>
      <div class="metric"><strong>${visualRequests}</strong>triggered visual requests</div>
    </div>
  </section>
  <section>
    <h2>Source Route Types</h2>
    <ul>${statusCounts}</ul>
  </section>
  <section>
    <h2>Teacher Review Queue</h2>
    <p>These rows are review-only. Screenshots, target software execution, memory writes, schedule registration, rule enablement, and packaging remain locked.</p>
    <table>
      <thead><tr><th>Software</th><th>Action</th><th>Reason</th><th>Screenshot now</th><th>Execute now</th></tr></thead>
      <tbody>${repairRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Next Files</h2>
    <p>Package: <code>${escapeHtml(packageJson.paths.packageDir)}</code></p>
    <p>Ledger: <code>${escapeHtml(packageJson.paths.logSourceDiscoveryLedger)}</code></p>
    <p>Repair queue: <code>${escapeHtml(packageJson.paths.repairQueue)}</code></p>
    <p>Triggered visual queue: <code>${escapeHtml(packageJson.paths.triggeredVisualCheckQueue || "not created")}</code></p>
  </section>
</main>
</body>
</html>`;
}

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path)) || "";
}

function isCadOrSolidWorksCandidate(row = {}) {
  const text = [row.software, row.processName, row.windowTitle, row.installPath]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return /\b(cad|solidworks|sw\d*|autocad|fusion\s*360|inventor)\b/.test(text);
}

function buildScopeEvidence(inventory, logSourceLedger) {
  const candidates = Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates : [];
  const ledgerRows = Array.isArray(logSourceLedger.rows) ? logSourceLedger.rows : [];
  const nonCadRows = ledgerRows.filter((row) => !isCadOrSolidWorksCandidate(row));
  return {
    scopeClaim: "real_local_bounded_all_software_not_cad_solidworks_only",
    realLocalCandidateRows: candidates.length,
    cadOrSolidWorksCandidateRows: candidates.filter(isCadOrSolidWorksCandidate).length,
    nonCadSolidWorksCandidateRows: candidates.filter((row) => !isCadOrSolidWorksCandidate(row)).length,
    nonCadSolidWorksLedgerRows: nonCadRows.length,
    sampledNonCadSolidWorksRows: nonCadRows.slice(0, 6).map((row) => ({
      software: row.software || "",
      processName: row.processName || "",
      discoveryStatus: row.discoveryStatus || "",
      candidateLogFileCount: row.candidateLogFileCount || 0,
      windowsEventLogCount: row.windowsEventLogCount || 0,
      canAttemptAutomaticLogReadAfterMetadataGate: row.canAttemptAutomaticLogReadAfterMetadataGate === true
    })),
    boundedNotComplete: true,
    proofBoundary:
      "This proves a bounded real-local sample is not CAD/SolidWorks-only. It does not prove every installed application is covered or accepted."
  };
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsReadByInventory: false,
    fullLogsRead: false,
    fileContentsReadByInventory: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    nativeUniversalExecution: false,
    longTermMemoryWritten: false,
    scheduledTaskInstalled: false,
    teacherConfirmationRequiredBeforeScheduleRegistration: true,
    teacherConfirmationRequiredBeforeScreenshots: true,
    teacherConfirmationRequiredBeforeMemory: true
  };
}

const goal = argValue(
  "--goal",
  "Prepare real local all-software automatic low-token learning readiness without registering schedules, screenshots, memory, or software execution."
);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "real-local-all-software-low-token-readiness-packages")));
const maxProcesses = Math.max(1, Number(argValue("--max-processes", "12")));
const maxInstalled = Math.max(1, Number(argValue("--max-installed", "12")));
const maxLogFilesPerCandidate = Math.max(0, Number(argValue("--max-log-files-per-candidate", "1")));
const maxQueueCandidates = Math.max(1, Number(argValue("--max-queue-candidates", "8")));
const maxRunnerItems = Math.max(1, Number(argValue("--max-runner-items", "4")));
const maxLogsPerItem = Math.max(1, Number(argValue("--max-logs-per-item", "1")));
const maxTailBytes = Math.max(256, Number(argValue("--max-tail-bytes", "1024")));
const maxTailLines = Math.max(1, Number(argValue("--max-tail-lines", "16")));
const maxLearningItems = Math.max(1, Number(argValue("--max-learning-items", "2")));
const runOnePass = !hasFlag("--no-runner-pass");

mkdirSync(outputRoot, { recursive: true });
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--max-processes",
  String(maxProcesses),
  "--max-installed",
  String(maxInstalled),
  "--max-log-files-per-candidate",
  String(maxLogFilesPerCandidate),
  "--output-dir",
  join(packageDir, "inventory-kit")
]);

const inventoryPath = join(packageDir, "real-local-software-observer-inventory.json");
runPowerShell(
  [
    "-File",
    inventoryKit.readOnlyProbe,
    "-OutputPath",
    inventoryPath,
    "-MaxProcesses",
    String(maxProcesses),
    "-MaxInstalled",
    String(maxInstalled),
    "-MaxLogFilesPerCandidate",
    String(maxLogFilesPerCandidate)
  ],
  packageDir
);
const inventory = readJson(inventoryPath);
const inventoryCandidateCount = Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates.length : 0;

const observerQueue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  String(maxQueueCandidates),
  "--max-files-per-candidate",
  String(maxLogFilesPerCandidate),
  "--max-depth",
  "0",
  "--max-entries-per-dir",
  "40",
  "--output-dir",
  join(packageDir, "observer-queue")
]);
const queue = readJson(observerQueue.queuePath);

const logSourceDiscoveryLedger = runNodeScript("create-all-software-log-source-discovery-ledger.mjs", [
  "--goal",
  `${goal} Map every bounded real-local software row to a log source or reviewed low-token fallback before learning.`,
  "--inventory",
  inventoryPath,
  "--queue",
  observerQueue.queuePath,
  "--max-rows",
  String(Math.max(maxQueueCandidates, inventoryCandidateCount)),
  "--output-dir",
  join(packageDir, "log-source-discovery-ledger")
]);
const logSourceLedger = readJson(logSourceDiscoveryLedger.ledgerPath);
const scopeEvidence = buildScopeEvidence(inventory, logSourceLedger);

let runner = null;
let runnerJournal = null;
let runnerReceipt = null;
if (runOnePass) {
  runner = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
    "--goal",
    goal,
    "--queue",
    observerQueue.queuePath,
    "--runs",
    "1",
    "--interval-ms",
    "0",
    "--max-items",
    String(maxRunnerItems),
    "--max-logs-per-item",
    String(maxLogsPerItem),
    "--max-tail-bytes",
    String(maxTailBytes),
    "--max-tail-lines",
    String(maxTailLines),
    "--max-learning-items",
    String(maxLearningItems),
    "--output-dir",
    join(packageDir, "automatic-runner")
  ]);
  runnerJournal = readJson(runner.journalPath);
  runnerReceipt = readJson(runner.receiptPath);
}

const learningCyclePaths = (runnerJournal?.runRecords || [])
  .map((record) => record.learningCyclePath)
  .filter((path) => path && existsSync(path));

const coverageArgs = [
  "--goal",
  goal,
  "--inventory",
  inventoryPath,
  "--queue",
  observerQueue.queuePath,
  "--max-rows",
  String(maxQueueCandidates),
  "--output-dir",
  join(packageDir, "coverage-audit")
];
for (const cyclePath of learningCyclePaths) coverageArgs.push("--learning-cycle", cyclePath);
const coverageAudit = runNodeScript("create-all-software-observer-coverage-audit.mjs", coverageArgs);
const coverage = readJson(coverageAudit.auditPath);

const repairQueue = runNodeScript("create-all-software-coverage-repair-queue.mjs", [
  "--goal",
  goal,
  "--audit",
  coverageAudit.auditPath,
  "--repair-plan",
  coverageAudit.repairPlanPath,
  "--max-items",
  String(maxQueueCandidates),
  "--output-dir",
  join(packageDir, "coverage-repair-queue")
]);
const repair = readJson(repairQueue.queuePath);

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  goal,
  "--queue",
  observerQueue.queuePath,
  "--task-name",
  "TransparentAI-RealLocal-AllSoftware-LowTokenLearning",
  "--interval-minutes",
  "15",
  "--runs-per-launch",
  "1",
  "--max-items",
  String(maxRunnerItems),
  "--max-logs-per-item",
  String(maxLogsPerItem),
  "--max-tail-bytes",
  String(maxTailBytes),
  "--max-tail-lines",
  String(maxTailLines),
  "--max-learning-items",
  String(maxLearningItems),
  "--output-dir",
  join(packageDir, "automatic-schedule")
]);
const scheduleJson = readJson(schedule.schedulePath);

let visualQueue = null;
let visualQueueJson = null;
if (runner?.journalPath) {
  visualQueue = runNodeScript("create-automatic-triggered-visual-check-queue.mjs", [
    "--goal",
    goal,
    "--runner",
    runner.journalPath,
    "--max-requests",
    "3",
    "--output-dir",
    join(packageDir, "triggered-visual-check-queue")
  ]);
  visualQueueJson = readJson(visualQueue.queuePath);
}

const packagePath = join(packageDir, "real-local-all-software-low-token-readiness-package.json");
const receiptPath = join(packageDir, "real-local-all-software-low-token-readiness-receipt.json");
const readmePath = join(packageDir, "REAL_LOCAL_ALL_SOFTWARE_LOW_TOKEN_READINESS_START_HERE.md");
const teacherReviewDashboardPath = join(packageDir, "real-local-all-software-low-token-teacher-review.html");

const readinessLocks = locks();
const packageJson = {
  format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_review_before_registration_or_learning_memory",
  goal,
  purpose:
    "One bounded real-local package for widening automatic all-software low-token learning: inventory, queue, per-software log-source discovery ledger, runner baseline/change pass, coverage audit, repair queue, schedule package, and triggered visual-check queue.",
  existingAbilitiesReused: [
    "create_software_observer_inventory",
    "create_software_observer_queue",
    "create_all_software_log_source_discovery_ledger",
    "run_automatic_low_token_learning_runner",
    "create_all_software_observer_coverage_audit",
    "create_all_software_coverage_repair_queue",
    "create_automatic_low_token_learning_schedule",
    "create_automatic_triggered_visual_check_queue"
  ],
  paths: {
    packageDir,
    inventoryKit: inventoryKit.manifest,
    readOnlyProbe: inventoryKit.readOnlyProbe,
    inventory: inventoryPath,
    observerQueue: observerQueue.queuePath,
    logSourceDiscoveryLedger: logSourceDiscoveryLedger.ledgerPath,
    logSourceDiscoveryLedgerReceipt: logSourceDiscoveryLedger.receiptPath,
    logSourceDiscoveryLedgerReadme: logSourceDiscoveryLedger.teacherReadme,
    automaticRunner: runner?.journalPath || "",
    automaticRunnerReceipt: runner?.receiptPath || "",
    firstLearningCycle: firstExisting(learningCyclePaths),
    coverageAudit: coverageAudit.auditPath,
    coverageRepairPlan: coverageAudit.repairPlanPath,
    repairQueue: repairQueue.queuePath,
    automaticSchedule: schedule.schedulePath,
    scheduledRunner: schedule.runnerPath,
    scheduleRegisterScript: schedule.registerPath,
    triggeredVisualCheckQueue: visualQueue?.queuePath || "",
    teacherReviewDashboard: teacherReviewDashboardPath,
    readme: readmePath
  },
  counts: {
    realLocalCandidates: inventoryCandidateCount,
    cadOrSolidWorksCandidates: scopeEvidence.cadOrSolidWorksCandidateRows,
    nonCadSolidWorksCandidates: scopeEvidence.nonCadSolidWorksCandidateRows,
    nonCadSolidWorksLedgerRows: scopeEvidence.nonCadSolidWorksLedgerRows,
    queuedSoftware: Array.isArray(queue.queue) ? queue.queue.length : 0,
    logSourceDiscoveryRows: logSourceLedger.counts?.ledgerRows || logSourceLedger.rows?.length || 0,
    logSourceDiscoveryMissingRows: logSourceLedger.counts?.needsTeacherLogSourceOrExclusion || 0,
    directLogCandidatesReadyForMetadataGate:
      logSourceLedger.counts?.directLogCandidatesReadyForMetadataGate || 0,
    lowTokenFallbackRoutesReadyForReview:
      (logSourceLedger.counts?.nonLogLowTokenFallbackReadyForReview || 0) +
      (logSourceLedger.counts?.windowsEventLogFallbackReadyForReview || 0),
    runnerRuns: runnerJournal?.runRecords?.length || 0,
    metadataGateRuns: runnerJournal?.totals?.metadataGateRuns || 0,
    compactLearningEvents: runnerJournal?.totals?.compactLearningEvents || 0,
    coverageRows: coverage.counts?.totalRows || coverage.coverageRows?.length || 0,
    coverageGaps: coverage.counts?.coverageGaps || coverage.counts?.needsTeacherReviewOrManualSignal || 0,
    repairItems: repair.counts?.repairItems || 0,
    triggeredVisualRequests: visualQueueJson?.requests?.length || 0
  },
  scopeEvidence,
  nextTeacherReviewOrder: [
    "Review private/out-of-scope software candidates before widening observation.",
    "Review the observer queue and the log-source discovery ledger before any tail reads.",
    "Run metadata gates only for direct log candidates, and review fallback routes before screenshots.",
    "Review the coverage audit rows.",
    "Use the repair queue for rows without low-token signals.",
    "Run the generated scheduled runner manually before registering a Windows task.",
    "Register the scheduled task only with explicit teacher confirmation.",
    "Capture at most one screenshot only from a triggered visual-check request after teacher confirmation.",
    "Approve memory only after reviewing compact learning events and corrections."
  ],
  boundaries: {
    broadAllInstalledSoftwareComplete: false,
    arbitraryNativeExecutionComplete: false,
    everyAppHasUsefulLogs: false,
    logSourceDiscoveryComplete: false,
    allRowsHaveCurrentSourceRoute: logSourceLedger.allRowsHaveSourceRoute === true,
    scheduledTaskRegistered: false,
    screenshotsCaptured: false,
    longTermMemoryWritten: false
  },
  locks: readinessLocks
};

const receipt = {
  format: "transparent_ai_real_local_all_software_low_token_readiness_receipt_v1",
  packageId,
  status: packageJson.status,
  paths: packageJson.paths,
  counts: packageJson.counts,
  locks: readinessLocks
};

writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  teacherReviewDashboardPath,
  renderTeacherReviewDashboard({ packageJson, logSourceLedger, repair, visualQueueJson }),
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Real Local All-Software Low-Token Readiness",
    "",
    `Status: ${packageJson.status}`,
    "",
    "Open in this order:",
    `1. Teacher review dashboard: ${teacherReviewDashboardPath}`,
    `2. Inventory: ${inventoryPath}`,
    `3. Observer queue: ${observerQueue.queuePath}`,
    `4. Log-source discovery ledger: ${logSourceDiscoveryLedger.teacherReadme}`,
    `5. Coverage audit: ${coverageAudit.auditPath}`,
    `6. Repair queue: ${repairQueue.queuePath}`,
    `7. Automatic schedule package: ${schedule.schedulePath}`,
    visualQueue?.queuePath ? `8. Triggered visual-check queue: ${visualQueue.queuePath}` : "8. Triggered visual-check queue: not created because runner pass was disabled.",
    "",
    "Nothing here registers a scheduled task, captures screenshots, executes target software, writes memory, accepts technology, or unlocks packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_local_all_software_low_token_readiness_package_result_v1",
      packageId,
      status: packageJson.status,
      packagePath,
      receiptPath,
      readme: readmePath,
      teacherReviewDashboard: teacherReviewDashboardPath,
      counts: packageJson.counts,
      locks: readinessLocks
    },
    null,
    2
  )
);
