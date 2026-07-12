import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fileHref(file) {
  if (!file) return "";
  return `file:///${resolve(file).replaceAll("\\", "/").replaceAll(" ", "%20")}`;
}

function commandValue(value) {
  if (!value) return "";
  if (typeof value !== "string") return String(value);
  if (existsSync(value) && !value.toLowerCase().endsWith(".json")) {
    return readFileSync(value, "utf8").trim();
  }
  return value;
}

function slugify(value) {
  return String(value || "compact-evidence-teacher-launchpad")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "compact-evidence-teacher-launchpad";
}

function findLatestNamedFile(root, fileName) {
  const matches = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    try {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".git"].includes(entry.name)) stack.push(full);
        } else if (entry.isFile() && entry.name === fileName) {
          matches.push({ file: full, mtimeMs: statSync(full).mtimeMs });
        }
      }
    } catch {
      // Ignore directories that cannot be scanned.
    }
  }
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.file || "";
}

const goal = argValue(
  "--goal",
  "Create a teacher launchpad for the latest low-token compact evidence request receipt."
);
const statusRefreshPath = argValue("--status-refresh", "");
const outputDir = argValue(
  "--output-dir",
  join(".transparent-apprentice", "original-goal-low-token-compact-evidence-teacher-launchpads")
);

const statusRefresh =
  statusRefreshPath && existsSync(statusRefreshPath)
    ? readJson(statusRefreshPath)
    : {};
const root = process.cwd();
const paths = statusRefresh.paths || {};
const evidence = statusRefresh.refreshedEvidence || {};
const latestRequestPack =
  paths.originalGoalLowTokenCompactEvidenceRequestPack ||
  findLatestNamedFile(root, "original-goal-low-token-compact-evidence-request-pack.json");
const latestBuilder =
  paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilder ||
  findLatestNamedFile(root, "original-goal-low-token-compact-evidence-request-receipt-builder.json");
const builderPacket = latestBuilder && existsSync(latestBuilder) ? readJson(latestBuilder) : {};
const requestPacket = latestRequestPack && existsSync(latestRequestPack) ? readJson(latestRequestPack) : {};

const reviewRows =
  evidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderRows ??
  builderPacket.counts?.reviewRows ??
  requestPacket.counts?.eligibleRows ??
  0;
const eligibleRows =
  evidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderEligibleRows ??
  builderPacket.counts?.eligibleRows ??
  requestPacket.counts?.eligibleRows ??
  0;
const blockedRows =
  evidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderBlockedRows ??
  builderPacket.counts?.blockedRows ??
  requestPacket.counts?.blockedRows ??
  0;
const validationCommand =
  commandValue(
    paths.originalGoalLowTokenCompactEvidenceRequestValidationCommandTemplate ||
      requestPacket.paths?.validationCommandTemplate ||
      ""
  );
const runCommand = commandValue(
  paths.originalGoalLowTokenCompactEvidenceRequestCommandTemplate ||
    requestPacket.paths?.runCommandTemplate ||
    requestPacket.paths?.commandTemplate ||
    ""
);
const rollbackPointManifest =
  paths.rollbackPointManifest ||
  statusRefresh.rollbackPoint?.manifestPath ||
  "";
const rollbackPointDir =
  paths.rollbackPointDir ||
  statusRefresh.rollbackPoint?.rollbackDir ||
  (rollbackPointManifest ? dirname(rollbackPointManifest) : "");

const launchpadId = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(outputDir, `${launchpadId}-${slugify(goal)}`);
mkdirSync(outDir, { recursive: true });

const launchpadPath = join(outDir, "original-goal-low-token-compact-evidence-teacher-launchpad.json");
const htmlPath = join(outDir, "original-goal-low-token-compact-evidence-teacher-launchpad.html");
const readmePath = join(outDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_TEACHER_LAUNCHPAD_START_HERE.md");
const rollbackPointCommandTemplate = `node plugins\\transparent-ai-apprentice\\scripts\\create-rollback-point.mjs --label "compact evidence run ${launchpadId}" --reason "Retain before teacher-confirmed compact metadata-only evidence collection." --path plugins\\transparent-ai-apprentice --output-dir "${join(outDir, "rollback-point")}"`;

const launchpad = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_teacher_launchpad_v1",
  launchpadId,
  goal,
  status: latestBuilder ? "waiting_for_teacher_compact_evidence_receipt" : "missing_compact_evidence_receipt_builder",
  counts: {
    reviewRows,
    eligibleRows,
    blockedRows
  },
  teacherPrompt:
    "Review the 22 compact metadata-only evidence rows, confirm the rollback point is retained, keep full logs/screenshots/software execution/memory disabled, then copy or download the teacher receipt JSON from the browser builder.",
  paths: {
    statusRefresh: statusRefreshPath || "",
    requestPack: latestRequestPack,
    requestPackHtml: requestPacket.paths?.html || paths.originalGoalLowTokenCompactEvidenceRequestPackHtml || "",
    receiptBuilder: latestBuilder,
    receiptBuilderHtml: builderPacket.paths?.html || paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderHtml || "",
    receiptTemplate: builderPacket.paths?.receiptTemplate || paths.originalGoalLowTokenCompactEvidenceRequestReceiptTemplate || "",
    rollbackPointManifest,
    rollbackPointDir,
    rollbackPointCommandTemplate,
    validationCommandTemplate: validationCommand,
    runCommandAfterValidationTemplate: runCommand,
    launchpad: launchpadPath,
    html: htmlPath,
    readme: readmePath
  },
  nextSteps: [
    {
      order: 1,
      label: "Open the browser receipt builder",
      path: builderPacket.paths?.html || paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderHtml || "",
      requiredBefore: ["validation", "compact-evidence-run"]
    },
    {
      order: 2,
      label: "Create or confirm the retained rollback point before filling the receipt",
      command: rollbackPointDir ? "" : rollbackPointCommandTemplate,
      path: rollbackPointManifest || "<retained-rollback-point-manifest.json>",
      requiredBefore: ["validation", "compact-evidence-run"]
    },
    {
      order: 3,
      label: "Save the teacher-filled compact evidence request receipt JSON",
      path: "<teacher-filled-compact-evidence-request-receipt.json>",
      requiredBefore: ["validation", "compact-evidence-run"]
    },
    {
      order: 4,
      label: "Validate the teacher receipt",
      command: validationCommand,
      requiredBefore: ["compact-evidence-run"]
    },
    {
      order: 5,
      label: "Only after validation and retained rollback, run the compact evidence request",
      command: runCommand,
      requiredBefore: ["learning-handoff", "disabled-rule-draft"]
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    launchpadDoesNotValidateReceipt: true,
    launchpadDoesNotCreateRollbackPoint: true,
    launchpadDoesNotRunMetadataCollection: true,
    launchpadDoesNotReadLogs: true,
    launchpadDoesNotCaptureScreenshots: true,
    launchpadDoesNotExecuteTargetSoftware: true,
    launchpadDoesNotRegisterSchedule: true,
    launchpadDoesNotWriteMemory: true,
    commandsExecuted: false,
    rollbackPointCreatedByLaunchpad: false,
    metadataCollectionRun: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    goalComplete: false
  }
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Low-token Compact Evidence Teacher Launchpad</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; line-height: 1.45; color: #1f2937; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #94a3b8; border-radius: 6px; background: #f8fafc; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin: 18px 0; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; background: #fff; }
    code, pre { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; }
    a { color: #075985; }
  </style>
</head>
<body>
  <h1>Low-token Compact Evidence Teacher Launchpad</h1>
  <p class="status">${htmlEscape(launchpad.status)}</p>
  <p>${htmlEscape(launchpad.teacherPrompt)}</p>
  <div class="grid">
    <div class="card"><strong>Review rows</strong><br>${htmlEscape(reviewRows)}</div>
    <div class="card"><strong>Eligible rows</strong><br>${htmlEscape(eligibleRows)}</div>
    <div class="card"><strong>Blocked rows</strong><br>${htmlEscape(blockedRows)}</div>
    <div class="card"><strong>Run ready now</strong><br>false</div>
  </div>
  <h2>Open First</h2>
  <p><a href="${htmlEscape(fileHref(launchpad.paths.receiptBuilderHtml))}">${htmlEscape(launchpad.paths.receiptBuilderHtml || "Missing receipt builder")}</a></p>
  <h2>Create Or Confirm Rollback Point Before Filling Receipt</h2>
  <p>Existing rollback point: <a href="${htmlEscape(fileHref(launchpad.paths.rollbackPointManifest))}">${htmlEscape(launchpad.paths.rollbackPointManifest || "No retained rollback point found in the status refresh")}</a></p>
  <pre>${htmlEscape(rollbackPointDir ? `Use retained rollback point: ${rollbackPointDir}` : rollbackPointCommandTemplate)}</pre>
  <h2>Reference Pack</h2>
  <p><a href="${htmlEscape(fileHref(launchpad.paths.requestPackHtml || launchpad.paths.requestPack))}">${htmlEscape(launchpad.paths.requestPackHtml || launchpad.paths.requestPack || "Missing request pack")}</a></p>
  <h2>Validate After Teacher Fills Receipt</h2>
  <pre>${htmlEscape(validationCommand || "Validation command is missing from current evidence.")}</pre>
  <h2>Only After Validation And Retained Rollback</h2>
  <pre>${htmlEscape(runCommand || "Run command is missing from current evidence.")}</pre>
  <h2>Locks</h2>
  <pre>${htmlEscape(JSON.stringify(launchpad.locks, null, 2))}</pre>
</body>
</html>
`;

const readme = [
  "# Original Goal Low-token Compact Evidence Teacher Launchpad",
  "",
  `Status: ${launchpad.status}`,
  `Review rows: ${reviewRows}`,
  `Eligible rows: ${eligibleRows}`,
  `Blocked rows: ${blockedRows}`,
  "",
  "Open the browser receipt builder first:",
  launchpad.paths.receiptBuilderHtml || "",
  "",
  "Create or confirm the retained rollback point before filling the receipt:",
  launchpad.paths.rollbackPointManifest || rollbackPointCommandTemplate,
  "",
  "Then validate the teacher-filled receipt with:",
  validationCommand || "",
  "",
  "Only after validation and retained rollback, use the run command template:",
  runCommand || "",
  "",
  "This launchpad is review-only. It does not validate, run metadata collection, read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, unlock packaging, or claim completion."
].join("\n");

writeJson(launchpadPath, launchpad);
writeFileSync(htmlPath, html, "utf8");
writeFileSync(readmePath, `${readme}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_compact_evidence_teacher_launchpad_result_v1",
      launchpadPath,
      htmlPath,
      readmePath,
      status: launchpad.status,
      counts: launchpad.counts,
      locks: launchpad.locks
    },
    null,
    2
  )
);
