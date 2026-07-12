#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function slug(value) {
  return (
    String(value || "tlcl-medium-runtime-dry-run-prep-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-medium-runtime-dry-run-prep-review"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    doesNotValidateReceipt: true,
    doesNotRunDryRun: true,
    noSoftwareExecution: true,
    noTargetSoftwareCommands: true,
    noUiEvents: true,
    noScreenshots: true,
    noFullLogs: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher review receipt for TLCL medium runtime dry-run prep.");
const prepInput = readJsonInput(
  argValue("--prep", argValue("--dry-run-prep", argValue("--tlcl-medium-runtime-dry-run-prep", ""))),
  "--prep",
  "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-prep-review-builders"))
);
const prep = prepInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-medium-runtime-dry-run-prep-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-medium-runtime-dry-run-prep-review-receipt-template.json");
const htmlPath = join(builderDir, "tlcl-medium-runtime-dry-run-prep-review-receipt-builder.html");
const readmePath = join(builderDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_PREP_REVIEW_RECEIPT_BUILDER_START_HERE.md");

const routeCandidates = prep.dryRunPreparation?.routeCandidates || [];
const reviewRows = routeCandidates.map((route, index) => ({
  routeIndex: Number(route.index || index + 1),
  adapterId: route.adapterId || "",
  label: route.label || route.adapterId || `route-${index + 1}`,
  dryRunHandoff: route.dryRunHandoff || null,
  requiredEvidenceBeforeDryRun: route.requiredEvidenceBeforeDryRun || [],
  blockersBeforeExecute: route.blockersBeforeExecute || [],
  defaultTeacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_route_ready_for_dry_run",
    "needs_more_route_evidence",
    "correction_to_senior_compile"
  ],
  blockedTeacherDecisions: ["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]
}));
const receiptTemplate = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_receipt_v1",
  builderId,
  sourcePrepPath: prepInput.path,
  prepId: prep.prepId || "",
  teacherDecision: "needs_teacher_review",
  selectedRouteIndex: 0,
  routeEvidenceReviewed: false,
  selectedTargetReviewed: false,
  logicContractReviewed: false,
  teacherCorrection: "",
  teacherNote: "",
  blockedActionsConfirmed: true,
  locks: locks()
};
const builder = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "receipt_builder_ready_for_teacher_use",
  sourcePrepStatus: prep.status || "",
  routeCandidateCount: routeCandidates.length,
  reviewRows,
  defaultReceipt: receiptTemplate,
  allowedTeacherDecisions: receiptTemplate.teacherDecision
    ? ["needs_teacher_review", "teacher_reviewed_route_ready_for_dry_run", "needs_more_route_evidence", "correction_to_senior_compile"]
    : [],
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs --prep "' +
    (prepInput.path || "<tlcl-medium-runtime-dry-run-prep.json>") +
    '" --receipt "<teacher-filled-tlcl-medium-runtime-dry-run-prep-review-receipt.json>"',
  blockedActions: [
    "execute_target_software_from_receipt_builder",
    "run_dry_run_from_receipt_builder",
    "send_ui_events_from_receipt_builder",
    "enable_rule_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "unlock_packaging_from_receipt_builder",
    "claim_completion_from_receipt_builder"
  ],
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    sourcePrep: prepInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Dry-Run Prep Review Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source prep: ${prepInput.path || "<inline>"}`,
    "",
    "Use this builder to let the teacher choose whether a medium-runtime dry-run prep may proceed to a separate dry-run route review, needs more evidence, or must return to senior compile.",
    "",
    "The builder does not validate the receipt, run dry-runs, execute target software, send UI events, enable rules, write memory, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Medium Runtime Dry-Run Prep Review</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #f7f8fb; color: #17202a; }
    main { max-width: 1040px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; margin-top: 14px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 10px; }
    select, input, textarea, button { font: inherit; }
    select, input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; }
    textarea { min-height: 220px; font-family: Consolas, monospace; font-size: 13px; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
    .route { border: 1px solid #d8dee8; border-radius: 8px; padding: 10px; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Medium Runtime Dry-Run Prep Review</h1>
    <p>This page builds a review receipt only. It does not run dry-runs or execute software.</p>
    <section>
      <h2>Route Candidates</h2>
      <div class="grid" id="routes"></div>
    </section>
    <section>
      <h2>Teacher Decision</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="teacher_reviewed_route_ready_for_dry_run">teacher_reviewed_route_ready_for_dry_run</option>
          <option value="needs_more_route_evidence">needs_more_route_evidence</option>
          <option value="correction_to_senior_compile">correction_to_senior_compile</option>
        </select>
      </label>
      <label>Selected route index<input id="routeIndex" type="number" min="0" value="0"></label>
      <label><input id="routeEvidence" type="checkbox"> Route evidence reviewed</label>
      <label><input id="targetReviewed" type="checkbox"> Selected numbered target reviewed</label>
      <label><input id="logicReviewed" type="checkbox"> Logic contract reviewed</label>
      <label>Teacher correction<input id="correction" type="text"></label>
      <label>Teacher note<input id="note" type="text"></label>
      <p><button id="generate">Generate Receipt JSON</button></p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const routes = document.getElementById("routes");
    const receiptEl = document.getElementById("receipt");
    for (const route of builder.reviewRows) {
      const card = document.createElement("article");
      card.className = "route";
      card.innerHTML = '<strong>' + route.routeIndex + '. ' + route.label + '</strong><p class="muted">Adapter: <code>' + route.adapterId + '</code></p>';
      routes.appendChild(card);
    }
    function buildReceipt() {
      return {
        ...builder.defaultReceipt,
        teacherDecision: document.getElementById("decision").value,
        selectedRouteIndex: Number(document.getElementById("routeIndex").value || 0),
        routeEvidenceReviewed: document.getElementById("routeEvidence").checked,
        selectedTargetReviewed: document.getElementById("targetReviewed").checked,
        logicContractReviewed: document.getElementById("logicReviewed").checked,
        teacherCorrection: document.getElementById("correction").value,
        teacherNote: document.getElementById("note").value
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("generate").addEventListener("click", render);
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      routeCandidateCount: routeCandidates.length,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);
