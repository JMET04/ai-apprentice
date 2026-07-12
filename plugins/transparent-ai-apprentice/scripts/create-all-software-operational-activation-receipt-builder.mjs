#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-activation-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-activation-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
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

function writeReadme(path, builder) {
  const lines = [
    "# All-Software Operational Activation Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    "",
    "Use this HTML page to generate a teacher-filled receipt JSON from the activation review packet.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Source review packet: ${builder.paths.sourceReviewPacket}`,
    "",
    "Safety boundary:",
    "- This builder does not write the generated receipt to disk.",
    "- It does not validate the receipt.",
    "- It does not register scheduled tasks, launch runners, execute wrappers, execute target software, capture screenshots, write memory, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing activation receipt generator.");
const packetInput = readJsonInput(
  argValue("--review-packet", argValue("--packet", "")),
  "--review-packet",
  "transparent_ai_all_software_operational_activation_review_packet_v1"
);
if (!packetInput.value) throw new Error("--review-packet is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const reviewPacket = packetInput.value;
const htmlPath = join(builderDir, "all-software-operational-activation-receipt-builder.html");
const builderPath = join(builderDir, "all-software-operational-activation-receipt-builder.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_OPERATIONAL_ACTIVATION_RECEIPT_BUILDER_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  builderDoesNotWriteReceipt: true,
  builderDoesNotValidateReceipt: true,
  builderDoesNotRegisterTask: true,
  builderDoesNotLaunchRunner: true,
  builderDoesNotExecuteWrapper: true,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskUnregistered: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false
};

const builder = {
  ok: true,
  format: "transparent_ai_all_software_operational_activation_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "receipt_builder_ready_for_teacher_use",
  sourceReviewPacketStatus: reviewPacket.status,
  missingConfirmationCount: reviewPacket.missingConfirmationCount ?? 0,
  operationalScope: reviewPacket.operationalScope || null,
  lowTokenSourceRouteEvidence: reviewPacket.lowTokenSourceRouteEvidence || null,
  confirmationRows: reviewPacket.confirmationRows || [],
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    sourceReviewPacket: packetInput.path,
    sourceActivationGate: reviewPacket.paths?.sourceActivationGate || "",
    sourceTrial: reviewPacket.paths?.sourceTrial || "",
    sourceLogSourceDiscoveryLedger: reviewPacket.paths?.sourceLogSourceDiscoveryLedger || "",
    sourceLogSourceDiscoveryLedgerReadme: reviewPacket.paths?.sourceLogSourceDiscoveryLedgerReadme || ""
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-operational-activation-review-receipt.mjs --review-packet "' +
    (packetInput.path || "<activation-review-packet.json>") +
    '" --receipt "<teacher-filled-activation-review-receipt.json>"',
  blockedActions: [
    "register_scheduled_task_from_receipt_builder",
    "start_recurring_runner_from_receipt_builder",
    "execute_activation_wrapper_from_receipt_builder",
    "execute_target_software_from_receipt_builder",
    "write_long_term_memory_from_receipt_builder",
    "claim_goal_complete_from_receipt_builder"
  ],
  locks
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Activation Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 16px; }
    label { display: block; margin: 8px 0; }
    input[type="checkbox"] { width: 18px; height: 18px; vertical-align: middle; }
    textarea { width: 100%; min-height: 220px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Activation Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Generate receipt JSON</h2>
      <p>Check only the confirmations you mean to give. This page only builds JSON in your browser. It does not save files, validate, register tasks, launch runners, or execute software.</p>
      <div id="rows" class="grid"></div>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    for (const row of builder.confirmationRows) {
      const card = document.createElement("article");
      card.className = "row";
      const checked = row.current === "confirmed" ? " checked" : "";
      const disabled = row.current === "confirmed" ? " disabled" : "";
      card.innerHTML =
        '<label><input type="checkbox" data-row-id="' + row.id + '"' + checked + disabled + '> ' +
        row.label + '</label><p class="muted">Current: <code>' + row.current + '</code></p><p>Required phrase: <code>' +
        row.requiredPhrase + '</code></p>';
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const checks = new Map(Array.from(document.querySelectorAll("input[data-row-id]")).map((input) => [input.dataset.rowId, input.checked]));
      return {
        format: "transparent_ai_all_software_operational_activation_review_receipt_template_v1",
        packetId: builder.builderId,
        decision: "ready_to_rerun_activation_gate",
        sourceReviewPacket: builder.paths.sourceReviewPacket,
        operationalScope: builder.operationalScope,
        lowTokenSourceRouteEvidence: builder.lowTokenSourceRouteEvidence,
        confirmationRows: builder.confirmationRows.map((row) => {
          const confirmed = row.current === "confirmed" || checks.get(row.id) === true;
          return {
            id: row.id,
            teacherDecision: confirmed ? (row.current === "confirmed" ? "already_confirmed" : "confirmed") : "needs_teacher_review",
            teacherObservedEvidence: confirmed ? row.requiredPhrase : "",
            requiredPhrase: row.requiredPhrase
          };
        }),
        locks: builder.locks
      };
    }
    function render() {
      receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
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
      format: "transparent_ai_all_software_operational_activation_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      readmePath,
      missingConfirmationCount: builder.missingConfirmationCount,
      locks
    },
    null,
    2
  )
);
