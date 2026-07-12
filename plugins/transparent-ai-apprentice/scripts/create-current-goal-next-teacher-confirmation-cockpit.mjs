#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(fileHref(path))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function commandText(scriptName, args = []) {
  const parts = ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName)];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function entryById(launchpad, id) {
  return (launchpad.entryLinks || []).find((item) => item.id === id) || {};
}

function actionById(launchpad, id) {
  return (launchpad.safeNextActions || []).find((item) => item.id === id) || {};
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    cockpitDoesNotValidateReceipts: true,
    cockpitDoesNotCreateQueues: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotCaptureScreenshots: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    cockpitDoesNotWriteMemory: true,
    cockpitDoesNotEnableRules: true,
    cockpitDoesNotDeleteRollbackPoints: true,
    cockpitDoesNotClaimCompletion: true,
    memoryWritten: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    goalComplete: false
  };
}

function card({
  id,
  title,
  status,
  purpose,
  openPath,
  evidencePath,
  command,
  teacherMustConfirm,
  blockedUntilTeacher
}) {
  return {
    id,
    title,
    status: status || "missing_or_waiting_for_teacher_review",
    purpose,
    openPath: openPath || "",
    openPathExists: Boolean(openPath && existsSync(openPath)),
    evidencePath: evidencePath || "",
    evidencePathExists: Boolean(evidencePath && existsSync(evidencePath)),
    nextCommandAfterTeacherReview: command || "",
    teacherMustConfirm,
    defaultDecision: "needs_teacher_review",
    allowedTeacherDecisions: ["needs_teacher_review", "ready_for_follow_up", "blocked"],
    blockedTeacherDecisions: ["accepted", "execute_now", "enable_rule", "write_memory", "delete_rollback_point"],
    blockedUntilTeacher
  };
}

function writeHtml(path, cockpit) {
  const cards = cockpit.reviewCards
    .map(
      (item, index) => `<article class="card">
        <p class="kicker">Step ${index + 1}</p>
        <h2>${htmlEscape(item.title)}</h2>
        <p><strong>Status:</strong> ${htmlEscape(item.status)}</p>
        <p>${htmlEscape(item.purpose)}</p>
        <p>${link("Open review page", item.openPath)}</p>
        <p>${link("Open evidence", item.evidencePath)}</p>
        <h3>Teacher must confirm</h3>
        <ul>${item.teacherMustConfirm.map((row) => `<li>${htmlEscape(row)}</li>`).join("")}</ul>
        <h3>Next command after teacher review</h3>
        <pre>${htmlEscape(item.nextCommandAfterTeacherReview || "waiting_for_teacher_review")}</pre>
        <div class="controls">
          <label>Teacher decision
            <select data-row-id="${htmlEscape(item.id)}" data-field="teacherDecision">
              <option value="needs_teacher_review">needs_teacher_review</option>
              <option value="teacher_reviewed_continue">teacher_reviewed_continue</option>
              <option value="blocked">blocked</option>
            </select>
          </label>
          <label class="inline"><input type="checkbox" data-row-id="${htmlEscape(item.id)}" data-field="evidenceReviewed" /> Evidence reviewed</label>
          <label>Teacher note <input type="text" data-row-id="${htmlEscape(item.id)}" data-field="teacherNote" /></label>
        </div>
        <p class="boundary">${htmlEscape(item.blockedUntilTeacher)}</p>
      </article>`
    )
    .join("\n");
  const order = cockpit.suggestedOrder.map((item) => `<li>${htmlEscape(item)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Next Teacher Confirmation Cockpit</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1120px; margin: 0 auto; }
    section, .card { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    h1, h2, h3 { margin: 0 0 10px; }
    a { color: #135cc8; }
    pre { white-space: pre-wrap; background: #f0f3f7; border-radius: 6px; padding: 12px; overflow-wrap: anywhere; }
    .kicker, .boundary { color: #5b6472; font-size: 13px; }
    .lock { color: #7b1f1f; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button { min-height: 34px; border: 1px solid #135cc8; background: #135cc8; color: white; border-radius: 6px; padding: 0 10px; cursor: pointer; }
    button.secondary { background: white; color: #135cc8; }
    textarea { box-sizing: border-box; width: 100%; min-height: 190px; margin-top: 12px; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    .controls { display: grid; gap: 8px; margin-top: 12px; border-top: 1px solid #edf1f6; padding-top: 12px; }
    label { display: grid; gap: 4px; color: #344154; font-size: 13px; }
    select, input[type="text"] { min-height: 34px; border: 1px solid #cfd7e4; border-radius: 6px; padding: 0 8px; font: inherit; }
    .inline { display: flex; gap: 8px; align-items: center; }
    .inline input { width: 18px; height: 18px; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Next Teacher Confirmation Cockpit</h1>
  <section>
    <p>This page gathers the next teacher confirmation surfaces for the current goal. It does not validate receipts, create queues, read logs, capture screenshots, execute software, write memory, delete rollback points, or claim completion.</p>
    <p class="lock">Goal complete: ${htmlEscape(String(cockpit.goalComplete))}</p>
    <div class="actions">
      <button id="generateReceipt">Generate reviewed receipt JSON</button>
      <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
      <button id="copyTemplate" class="secondary">Copy blank receipt template</button>
      <button id="copyValidation" class="secondary">Copy validation command</button>
    </div>
    <textarea id="receiptOutput" spellcheck="false"></textarea>
  </section>
  <section>
    <h2>Suggested order</h2>
    <ol>${order}</ol>
  </section>
  ${cards}
</main>
<script>
  const cockpit = ${jsonForScript(cockpit)};
  const output = document.getElementById("receiptOutput");
  function reviewedReceipt() {
    const receipt = JSON.parse(JSON.stringify(cockpit.receiptTemplate));
    for (const row of receipt.rowDecisions) {
      const controls = Array.from(document.querySelectorAll("[data-row-id]")).filter((control) => control.dataset.rowId === row.id);
      row.teacherDecision = controls.find((control) => control.dataset.field === "teacherDecision")?.value || "needs_teacher_review";
      row.evidenceReviewed = controls.find((control) => control.dataset.field === "evidenceReviewed")?.checked === true;
      row.teacherNote = controls.find((control) => control.dataset.field === "teacherNote")?.value || "";
    }
    receipt.generatedBy = "current_goal_next_teacher_confirmation_cockpit_browser_receipt_builder";
    receipt.generatedAt = new Date().toISOString();
    receipt.builderLocks = cockpit.locks;
    return receipt;
  }
  function writeOutput(value) {
    output.value = JSON.stringify(value, null, 2);
    return output.value;
  }
  function downloadReceipt() {
    const text = writeOutput(reviewedReceipt());
    const blob = new Blob([text + "\\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "teacher-filled-current-goal-next-teacher-confirmation-cockpit-receipt.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  document.getElementById("generateReceipt").addEventListener("click", () => writeOutput(reviewedReceipt()));
  document.getElementById("downloadReceipt").addEventListener("click", downloadReceipt);
  document.getElementById("copyTemplate").addEventListener("click", () => navigator.clipboard?.writeText(JSON.stringify(cockpit.receiptTemplate, null, 2)));
  document.getElementById("copyValidation").addEventListener("click", () => navigator.clipboard?.writeText(cockpit.nextValidationCommand || ""));
  writeOutput(cockpit.receiptTemplate);
</script>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, cockpit) {
  const lines = [
    "# Current Goal Next Teacher Confirmation Cockpit",
    "",
    "This is a review-only cockpit. It gathers the next teacher confirmation pages and copyable commands without running them.",
    "",
    `- Status: ${cockpit.status}`,
    `- Cards: ${cockpit.reviewCards.length}`,
    `- Receipt template: ${cockpit.paths.receiptTemplate}`,
    `- Next validation command: ${cockpit.nextValidationCommand}`,
    `- Goal complete: ${cockpit.goalComplete}`,
    "",
    "## Suggested Order",
    ...cockpit.suggestedOrder.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Locks",
    ...Object.entries(cockpit.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const launchpadPath = resolve(
  argValue("--launchpad", join(process.cwd(), "artifacts", "current-goal-start-here", "current-goal-start-here.json"))
);
if (!existsSync(launchpadPath)) throw new Error("--launchpad is required");
const launchpad = readJson(launchpadPath);
if (launchpad.format !== "transparent_ai_current_goal_start_here_launchpad_v1") {
  throw new Error("--launchpad must be transparent_ai_current_goal_start_here_launchpad_v1");
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "current-goal-next-teacher-confirmation-cockpits")));
mkdirSync(outputRoot, { recursive: true });
const cockpitPath = join(outputRoot, "current-goal-next-teacher-confirmation-cockpit.json");
const htmlPath = join(outputRoot, "current-goal-next-teacher-confirmation-cockpit.html");
const readmePath = join(outputRoot, "CURRENT_GOAL_NEXT_TEACHER_CONFIRMATION_COCKPIT.md");
const receiptTemplatePath = join(outputRoot, "current-goal-next-teacher-confirmation-cockpit-receipt-template.json");

const status = launchpad.statusSummary || {};
const paths = launchpad.paths || {};
const batchAction = actionById(launchpad, "build_all_software_reviewed_queue_from_receipt");
const proofAction = actionById(launchpad, "validate_proof_gap_teacher_queue_receipt");
const overlayAction = actionById(launchpad, "validate_teacher_overlay_packet");
const shortestAction = actionById(launchpad, "validate_shortest_teacher_evidence_receipt");
const finalAction = actionById(launchpad, "validate_final_teacher_acceptance_receipt");

const reviewCards = [
  card({
    id: "all_software_batch_review",
    title: "All-software batch review",
    status: status.allSoftwareObserverInventoryBatchReviewBuilderStatus,
    purpose: "Teacher approves, defers, or excludes a small high-signal set of local software candidates before any low-token observer queue is created.",
    openPath:
      paths.allSoftwareObserverInventoryBatchReviewBuilderHtml ||
      entryById(launchpad, "all_software_observer_inventory_batch_review_builder_html").path,
    evidencePath: paths.allSoftwareObserverInventoryProbeOutput || entryById(launchpad, "all_software_observer_inventory_probe_output").path,
    command:
      batchAction.commandOrPath ||
      commandText("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
        ["--inventory", paths.allSoftwareObserverInventoryProbeOutput || "<software-observer-inventory.json>"],
        ["--receipt", "<teacher-filled-all-software-inventory-batch-review-receipt.json>"],
        ["--output-dir", join("artifacts", "current-goal-all-software-observer-reviewed-queues")]
      ]),
    teacherMustConfirm: [
      "private or out-of-scope software is excluded",
      "the row is safe for read-only low-token observation",
      "the teaching style or priority hint is correct"
    ],
    blockedUntilTeacher: "No queue, watch cycle, log read, screenshot, memory write, or software action before teacher review."
  }),
  card({
    id: "proof_gap_focused_receipt",
    title: "Next proof gap focused receipt",
    status: status.nextProofGapFocusedReceiptBuilderStatus,
    purpose: "Teacher reviews the one active missing proof route and fills explicit evidence confirmation plus retained rollback point fields.",
    openPath:
      paths.proofGapNextFocusedReceiptBuilderHtml ||
      entryById(launchpad, "next_proof_gap_focused_receipt_builder_html").path,
    evidencePath: status.nextProofGapCandidateEvidencePath || entryById(launchpad, "proof_gap_evidence_prefill_html").path,
    command: proofAction.commandOrPath || "",
    teacherMustConfirm: [
      "candidate evidence was personally reviewed",
      "rollback point remains retained",
      "the proof route should continue or remain blocked"
    ],
    blockedUntilTeacher: "No proof-gap validation handoff, runner, monitor registration, or completion claim before the teacher-filled receipt."
  }),
  card({
    id: "transparent_overlay_packet",
    title: "Transparent overlay packet",
    status: status.spatialStatus,
    purpose: "Teacher draws 2D position, perspective, angle, or 3D depth intent on the transparent mask before numbered target confirmation.",
    openPath: paths.teacherSpatialOverlayHtml || entryById(launchpad, "transparent_overlay_browser_html").path,
    evidencePath: paths.teacherSpatialSampleOverlayPacket || entryById(launchpad, "spatial_handoff_html").path,
    command: overlayAction.commandOrPath || "",
    teacherMustConfirm: [
      "the exported overlay packet reflects the teacher's intended geometry",
      "2D, perspective, angle, or 3D depth relation is explicit",
      "numbered target confirmation happens before execution"
    ],
    blockedUntilTeacher: "No spatial execution, target software command, rule enablement, or memory write before packet validation and numbered target confirmation."
  }),
  card({
    id: "shortest_unified_evidence",
    title: "Shortest unified evidence route",
    status: status.shortestTeacherEvidencePackStatus,
    purpose: "Teacher uses the shortest route to tie together real route selection, overlay/spatial evidence, teaching-method evidence, receipt validation, and final review.",
    openPath: entryById(launchpad, "shortest_teacher_evidence_pack_html").path || paths.shortestTeacherEvidencePack,
    evidencePath: entryById(launchpad, "shortest_teacher_evidence_receipt_builder_html").path,
    command: shortestAction.commandOrPath || "",
    teacherMustConfirm: [
      "the selected route is the real route to test next",
      "all referenced evidence was reviewed rather than inferred",
      "any derived trial validation remains review-only"
    ],
    blockedUntilTeacher: "No final convergence or completion claim before the shortest evidence receipt validates."
  }),
  card({
    id: "final_review_later",
    title: "Final teacher acceptance review",
    status: status.finalTeacherAcceptanceReviewPackStatus,
    purpose: "Teacher uses the final pack only after real evidence lanes are reviewed. This cockpit keeps it visible but does not advance acceptance.",
    openPath: entryById(launchpad, "final_teacher_acceptance_review_pack_html").path || paths.finalTeacherAcceptanceReviewPack,
    evidencePath: entryById(launchpad, "final_convergence_readiness_gate_html").path || paths.finalConvergenceReadinessGate,
    command: finalAction.commandOrPath || "",
    teacherMustConfirm: [
      "all goal lanes have real evidence",
      "universal software learning is not claimed from a narrow test",
      "final acceptance is explicit and separate from this cockpit"
    ],
    blockedUntilTeacher: "Final acceptance, packaging, rule enablement, and goal completion remain blocked outside the strict final receipt gate."
  })
];

const receiptTemplate = {
  format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_v1",
  defaultDecision: "needs_teacher_review",
  cockpitPath,
  rowDecisions: reviewCards.map((item) => ({
    id: item.id,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    teacherNote: ""
  })),
  blockedActionsConfirmed: false,
  teacherSummary: ""
};
const nextValidationCommand = commandText("validate-current-goal-next-teacher-confirmation-cockpit-receipt.mjs", [
  ["--cockpit", cockpitPath],
  ["--receipt", "<teacher-filled-current-goal-next-teacher-confirmation-cockpit-receipt.json>"],
  ["--output-dir", join("artifacts", "current-goal-next-teacher-confirmation-cockpit-receipt-validations")]
]);

const cockpit = {
  ok: true,
  format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_v1",
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_confirmation_across_current_goal_next_actions",
  launchpadPath,
  launchpadDir: dirname(launchpadPath),
  suggestedOrder: [
    "Fill the all-software batch review receipt.",
    "Fill the focused next-proof-gap receipt.",
    "Export and validate the transparent overlay packet, then confirm numbered targets.",
    "Use the shortest unified evidence receipt if a single end-to-end teacher route is preferred.",
    "Use the final teacher acceptance review only after evidence is real and reviewed."
  ],
  counts: {
    reviewCards: reviewCards.length,
    cardsWithOpenPaths: reviewCards.filter((item) => item.openPathExists).length,
    cardsWithCommands: reviewCards.filter((item) => item.nextCommandAfterTeacherReview).length,
    receiptRows: receiptTemplate.rowDecisions.length
  },
  reviewCards,
  receiptTemplate,
  nextValidationCommand,
  interactiveReceiptBuilder: {
    available: true,
    outputFormat: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_v1",
    generatesReceiptJsonInBrowser: true,
    downloadsReceiptJsonOnly: true,
    runsValidation: false,
    executesCommands: false,
    defaultDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "teacher_reviewed_continue", "blocked"]
  },
  blockedActions: [
    "validate_receipt_from_browser",
    "execute_command_from_cockpit",
    "create_queue_from_cockpit",
    "read_logs_from_cockpit",
    "capture_screenshot_from_cockpit",
    "write_memory_from_cockpit",
    "delete_rollback_point_from_cockpit",
    "claim_goal_complete_from_cockpit"
  ],
  paths: {
    cockpit: cockpitPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    launchpad: launchpadPath
  },
  locks: locks(),
  goalComplete: false
};

writeFileSync(cockpitPath, `${JSON.stringify(cockpit, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, cockpit);
writeReadme(readmePath, cockpit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_result_v1",
      status: cockpit.status,
      cockpitPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      counts: cockpit.counts,
      goalComplete: false
    },
    null,
    2
  )
);
