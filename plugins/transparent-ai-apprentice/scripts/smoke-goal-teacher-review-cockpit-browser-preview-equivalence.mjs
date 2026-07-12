#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "goal-teacher-review-cockpit-browser-preview-equivalence-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

function control(rowId, field, value) {
  return {
    dataset: { rowId, field },
    value: field === "evidenceReviewed" ? "" : value,
    checked: field === "evidenceReviewed" ? Boolean(value) : false
  };
}

function browserPreviewFromHtml(html, receiptRows) {
  const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  if (!scriptMatch) throw new Error("cockpit HTML script block not found");
  const controls = receiptRows.flatMap((row) => [
    control(row.id, "teacherDecision", row.teacherDecision),
    control(row.id, "evidenceReviewed", row.evidenceReviewed),
    control(row.id, "teacherNote", row.teacherNote || "")
  ]);
  const output = { value: "", addEventListener() {} };
  const elementsById = {
    output,
    items: { appendChild() {} },
    copyReceipt: { addEventListener() {} },
    copyJson: { addEventListener() {} },
    copyValidation: { addEventListener() {} },
    generateReceipt: { addEventListener() {} },
    downloadReceipt: { addEventListener() {} },
    previewValidation: { addEventListener() {} }
  };
  const fakeElement = () => ({
    className: "",
    textContent: "",
    innerHTML: "",
    href: "",
    download: "",
    dataset: {},
    appendChild() {},
    addEventListener() {},
    click() {},
    remove() {}
  });
  const context = {
    console,
    Map,
    Set,
    Array,
    Boolean,
    Blob: class Blob {},
    URL: {
      createObjectURL: () => "blob:preview",
      revokeObjectURL() {}
    },
    navigator: { clipboard: { writeText() {} } },
    document: {
      getElementById: (id) => elementsById[id] || { addEventListener() {} },
      createElement: () => fakeElement(),
      body: { appendChild() {} },
      querySelectorAll: () => controls
    }
  };
  vm.createContext(context);
  vm.runInContext(
    `${scriptMatch[1]}\nthis.__preview = validationPreview();\nthis.__receipt = reviewedReceipt();`,
    context,
    { timeout: 5000 }
  );
  return { preview: context.__preview, receipt: context.__receipt };
}

const centerDir = join(smokeRoot, "center");
mkdirSync(centerDir, { recursive: true });
const activationHtml = writeJson(join(centerDir, "activation-builder.html"), { marker: "html placeholder" });
const coverageHtml = writeJson(join(centerDir, "coverage-builder.html"), { marker: "html placeholder" });
const voiceHtml = writeJson(join(centerDir, "voice-workbench.html"), { marker: "html placeholder" });
const overlayHtml = writeJson(join(centerDir, "overlay.html"), { marker: "html placeholder" });
const statusPath = writeJson(join(centerDir, "status.json"), {
  format: "transparent_ai_all_software_operational_status_console_v1",
  scan: { missingEvidence: ["coverage_rollout_receipt_validation"] },
  lanes: [
    { id: "automatic_learning_activation_path", status: "activation_waiting", detail: "waiting" },
    { id: "coverage_rollout_receipt_gate", status: "coverage_ready", detail: "ready" },
    { id: "non_expert_engineering_voice_control", status: "voice_ready", detail: "ready" },
    { id: "original_goal_boundary", status: "not_complete", detail: "still gated" }
  ],
  nextSafeActions: [{ label: "Open activation receipt validation", command: "node activation-validation.mjs" }]
});
const centerPath = writeJson(join(centerDir, "goal-command-center.json"), {
  format: "transparent_ai_goal_command_center_v1",
  goal: "fixture goal",
  paths: {
    operationalStatusConsole: statusPath,
    activationReceiptBuilderHtml: activationHtml,
    activationReceiptValidation: join(centerDir, "activation-validation.json"),
    activationReviewPacket: join(centerDir, "activation-packet.json"),
    coverageRolloutReceiptBuilderHtml: coverageHtml,
    coverageConvergence: join(centerDir, "coverage-convergence.json"),
    coverageExpansionPlan: join(centerDir, "coverage-plan.json"),
    voiceWorkbenchHtml: voiceHtml,
    voiceWorkbench: join(centerDir, "voice.json"),
    transparentOverlay: overlayHtml,
    teachExecuteLoop: join(centerDir, "teach-execute.json")
  },
  entryLinks: [{ id: "engineering_voice_control_workbench", path: voiceHtml }],
  nextCalls: {
    coverageRolloutReceiptValidation: {
      arguments: { plan: join(centerDir, "coverage-plan.json") }
    },
    confirmNumberedTarget: {
      arguments: { confirmCommandTemplate: "node confirm-engineering-command-target.mjs --selected-number __SELECTED_NUMBER__" }
    }
  }
});

const cockpitResult = runNode("create-goal-teacher-review-cockpit.mjs", [
  "--goal",
  "Browser preview equivalence fixture",
  "--command-center",
  centerPath,
  "--output-dir",
  join(smokeRoot, "cockpit")
]);
const html = readFileSync(cockpitResult.htmlPath, "utf8");
const receiptRows = [
  { id: "coverage_rollout_receipt", teacherDecision: "teacher_reviewed_continue", evidenceReviewed: true },
  { id: "voice_text_numbered_target", teacherDecision: "blocked_needs_more_evidence", evidenceReviewed: true },
  { id: "transparent_sketch_overlay", teacherDecision: "needs_teacher_review", evidenceReviewed: false }
];
const browser = browserPreviewFromHtml(html, receiptRows);
const receiptPath = writeJson(join(smokeRoot, "browser-generated-receipt.json"), browser.receipt);
const validationResult = runNode("validate-goal-teacher-review-cockpit-receipt.mjs", [
  "--cockpit",
  cockpitResult.cockpitPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(smokeRoot, "validation")
]);
const validation = readJson(validationResult.validationPath);

const checks = [
  check(
    "Browser preview and validator agree on high-level decision",
    browser.preview.format === "transparent_ai_goal_teacher_review_cockpit_browser_validation_preview_v1" &&
      browser.preview.validationDecision === validation.validationDecision &&
      browser.preview.readyRowCount === validation.readyRowCount &&
      browser.preview.waitingRowCount === validation.waitingRowCount,
    validationResult.validationPath
  ),
  check(
    "Browser preview and validator agree on safe downstream commands",
    browser.preview.nextSafeCommands.length === validation.nextSafeCommands.length &&
      browser.preview.nextSafeCommands[0]?.command === validation.nextSafeCommands[0]?.command &&
      browser.preview.nextSafeCommands.every((command) => command.executesNow === false) &&
      validation.nextSafeCommands.every((command) => command.executesNow === false),
    JSON.stringify(browser.preview.nextSafeCommands)
  ),
  check(
    "Browser preview keeps the no-execution lock while matching validator rows",
    browser.preview.commandsExecuted === false &&
      browser.preview.writesFiles === false &&
      browser.preview.runsValidationScript === false &&
      validation.locks.commandsExecuted === false &&
      validation.locks.targetSoftwareCommandsExecuted === false &&
      browser.preview.validationRows.map((row) => `${row.id}:${row.status}`).join("|") ===
        validation.validationRows.map((row) => `${row.id}:${row.status}`).join("|"),
    cockpitResult.htmlPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_goal_teacher_review_cockpit_browser_preview_equivalence_smoke_v1",
  smokeRoot,
  paths: {
    cockpit: cockpitResult.cockpitPath,
    html: cockpitResult.htmlPath,
    receipt: receiptPath,
    validation: validationResult.validationPath
  },
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
