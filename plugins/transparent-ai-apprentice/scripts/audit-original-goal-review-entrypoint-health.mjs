#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-review-entrypoint-health")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-review-entrypoint-health"
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

function isLikelyPath(value) {
  const text = String(value || "").trim();
  if (!text || text.includes("<") || text.includes(">")) return false;
  if (/^(node|npm|cmd|powershell|python|npx)\b/i.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^file:\/\//i.test(text)) return true;
  return /^[a-zA-Z]:[\\/]/.test(text) || text.startsWith(".") || text.includes("\\") || text.includes("/");
}

function normalizePath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^file:\/\//i.test(text)) return fileURLToPath(text);
  return resolve(text);
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function collectPathItems(refresh, router) {
  const items = [];
  const push = (source, label, value, required = true) => {
    if (!isLikelyPath(value)) return;
    const path = normalizePath(value);
    const key = `${source}|${path}`;
    if (items.some((item) => item.key === key)) return;
    items.push({ key, source, label, path, required });
  };

  push("status_refresh", "Status refresh JSON", refresh?.paths?.refresh || "", true);
  push("status_refresh", "Status refresh start-here", refresh?.paths?.readme || "", true);
  push("status_refresh", "Status dashboard", refresh?.paths?.currentStatusDashboardHtml || "", true);
  push("teacher_action_router", "Teacher action router JSON", refresh?.paths?.teacherActionRouter || router?.paths?.router || "", true);
  push("teacher_action_router", "Teacher action router HTML", refresh?.paths?.teacherActionRouterHtml || router?.paths?.html || "", true);

  for (const [key, value] of Object.entries(refresh?.paths || {})) {
    push("refresh.paths", key, value, false);
  }
  for (const [key, value] of Object.entries(refresh?.discoveredEvidence || {})) {
    if (typeof value === "string") push("discoveredEvidence", key, value, false);
  }
  for (const entry of refresh?.directReviewEntryPoints || []) {
    push("directReviewEntryPoints", entry.label || entry.id || "review entry", entry.path, true);
  }
  for (const row of refresh?.nextCommands || []) {
    push("nextCommands", row.label || "next command", row.command, String(row.label || "").toLowerCase().startsWith("open"));
  }
  for (const row of router?.routeRows || []) {
    push("teacherActionRouter.routeRows", row.reviewEntryId || row.id || "route row", row.openPath, true);
  }
  return items;
}

function classifyFile(item) {
  const exists = existsSync(item.path);
  if (!exists) {
    return {
      ...item,
      exists: false,
      isFile: false,
      bytes: 0,
      extension: extname(item.path).toLowerCase(),
      status: item.required ? "missing_required_entrypoint" : "missing_optional_entrypoint",
      title: ""
    };
  }
  const stats = statSync(item.path);
  const isFile = stats.isFile();
  const bytes = isFile ? stats.size : 0;
  const extension = extname(item.path).toLowerCase();
  let title = "";
  let contentLooksOpenable = isFile && bytes > 0;
  if (isFile && bytes > 0 && [".html", ".htm", ".md", ".json"].includes(extension)) {
    const text = readFileSync(item.path, "utf8").replace(/^\uFEFF/, "");
    if (extension === ".html" || extension === ".htm") {
      contentLooksOpenable = /<html[\s>]/i.test(text) || /<!doctype html>/i.test(text);
      title = text.match(/<title>(.*?)<\/title>/i)?.[1] || "";
    } else if (extension === ".json") {
      contentLooksOpenable = text.trim().startsWith("{") || text.trim().startsWith("[");
    } else if (extension === ".md") {
      contentLooksOpenable = text.trim().length > 0;
    }
  }
  const status = !isFile
    ? "path_is_not_file"
    : bytes === 0
      ? "empty_file"
      : contentLooksOpenable
        ? "openable"
        : item.required
          ? "required_entrypoint_content_unrecognized"
          : "optional_entrypoint_content_unrecognized";
  return {
    ...item,
    exists: true,
    isFile,
    bytes,
    extension,
    status,
    title
  };
}

function writeHtml(path, audit) {
  const rows = audit.entries
    .map(
      (entry) => `<tr class="${entry.pass ? "ok" : "bad"}">
        <td>${htmlEscape(entry.source)}</td>
        <td>${htmlEscape(entry.label)}</td>
        <td>${entry.path ? `<a href="${htmlEscape(fileHref(entry.path))}">${htmlEscape(basename(entry.path))}</a>` : ""}</td>
        <td>${htmlEscape(entry.status)}</td>
        <td>${entry.bytes}</td>
        <td>${entry.required ? "required" : "optional"}</td>
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
  <title>Original Goal Review Entrypoint Health</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    tr.bad { background: #fff0f0; }
    tr.ok { background: #fff; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Review Entrypoint Health</h1>
    <p><strong>Status:</strong> ${htmlEscape(audit.status)}</p>
    <p><strong>Required entries:</strong> ${audit.counts.required}; <strong>failed required:</strong> ${audit.counts.failedRequired}; <strong>total checked:</strong> ${audit.counts.checked}</p>
    <p class="lock">This audit only checks local entrypoint files. It does not open software, register tasks, run commands, capture screenshots, validate receipts, write memory, accept technology, unlock packaging, or claim completion.</p>
    <table>
      <thead><tr><th>Source</th><th>Label</th><th>Open</th><th>Status</th><th>Bytes</th><th>Required</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, audit) {
  const lines = [
    "# Original Goal Review Entrypoint Health",
    "",
    `Status: ${audit.status}`,
    `Checked: ${audit.counts.checked}`,
    `Failed required: ${audit.counts.failedRequired}`,
    "",
    `- HTML: ${audit.paths.html}`,
    `- JSON: ${audit.paths.audit}`,
    "",
    "Safety boundary:",
    "- This audit only checks local file existence and basic openability.",
    "- It does not run commands, validate receipts, capture screenshots, execute software, write memory, accept technology, unlock packaging, or claim goal completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const statusRefreshPath = resolve(argValue("--status-refresh", argValue("--refresh", "")));
if (!statusRefreshPath || !existsSync(statusRefreshPath)) throw new Error("--status-refresh is required");
const refresh = readJson(statusRefreshPath);
const routerPath = argValue("--router", refresh?.paths?.teacherActionRouter || "");
const router = routerPath && existsSync(routerPath) ? readJson(routerPath) : null;
const goal = argValue("--goal", refresh.goal || "Audit original-goal review entrypoint health.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-review-entrypoint-health-audits"))
);
mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const rawItems = collectPathItems(refresh, router);
const entries = rawItems.map(classifyFile).map((entry) => ({
  source: entry.source,
  label: entry.label,
  path: entry.path,
  required: entry.required,
  exists: entry.exists,
  isFile: entry.isFile,
  bytes: entry.bytes,
  extension: entry.extension,
  title: entry.title,
  status: entry.status,
  pass: entry.status === "openable" || (!entry.required && entry.status.startsWith("missing_optional"))
}));
const failedRequired = entries.filter((entry) => entry.required && !entry.pass);
const failedOptional = entries.filter((entry) => !entry.required && !entry.pass);
const auditPath = join(auditDir, "original-goal-review-entrypoint-health-audit.json");
const htmlPath = join(auditDir, "original-goal-review-entrypoint-health-audit.html");
const readmePath = join(auditDir, "ORIGINAL_GOAL_REVIEW_ENTRYPOINT_HEALTH_START_HERE.md");
const audit = {
  ok: failedRequired.length === 0,
  format: "transparent_ai_original_goal_review_entrypoint_health_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: failedRequired.length === 0 ? "all_required_review_entrypoints_openable" : "missing_or_unopenable_required_review_entrypoints",
  sourceEvidence: {
    statusRefresh: statusRefreshPath,
    teacherActionRouter: routerPath || ""
  },
  counts: {
    checked: entries.length,
    required: entries.filter((entry) => entry.required).length,
    optional: entries.filter((entry) => !entry.required).length,
    failedRequired: failedRequired.length,
    failedOptional: failedOptional.length
  },
  entries,
  failedRequired,
  failedOptional,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    auditDoesNotOpenBrowser: true,
    auditDoesNotRunCommands: true,
    auditDoesNotValidateReceipts: true,
    auditDoesNotRegisterTask: true,
    auditDoesNotLaunchRunner: true,
    auditDoesNotExecuteTargetSoftware: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotReadFullLogs: true,
    auditDoesNotWriteMemory: true,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  },
  paths: {
    audit: auditPath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeHtml(htmlPath, audit);
writeReadme(readmePath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_review_entrypoint_health_audit_result_v1",
      auditPath,
      htmlPath,
      readmePath,
      status: audit.status,
      checked: audit.counts.checked,
      failedRequired: audit.counts.failedRequired,
      locks: audit.locks
    },
    null,
    2
  )
);
