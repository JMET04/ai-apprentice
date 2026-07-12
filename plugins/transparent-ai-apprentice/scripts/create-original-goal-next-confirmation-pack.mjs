#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function slugify(value) {
  return (
    String(value || "original-goal-next-confirmation-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-next-confirmation-pack"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function compact(value, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    confirmationPackDoesNotReadLogs: true,
    confirmationPackDoesNotReadFullLogs: true,
    confirmationPackDoesNotCaptureScreenshots: true,
    confirmationPackDoesNotExecuteTargetSoftware: true,
    confirmationPackDoesNotRegisterSchedule: true,
    confirmationPackDoesNotLaunchRunner: true,
    confirmationPackDoesNotEnableRules: true,
    confirmationPackDoesNotWriteMemory: true,
    confirmationPackDoesNotTreatRagAsAuthority: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    screenshotsCaptured: false,
    fullLogsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function optionalJson(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
}

function commandText(path) {
  if (!path || !existsSync(path)) return "";
  return readFileSync(path, "utf8").trim();
}

function firstExisting(...paths) {
  return paths.filter(Boolean).find((path) => existsSync(path)) || paths.filter(Boolean)[0] || "";
}

function sibling(path, file) {
  return path ? join(dirname(path), file) : "";
}

function latestManualReviewPack(paths) {
  const html = paths.originalGoalLowTokenFallbackRouteManualReviewPackHtml || "";
  const json = sibling(html, "low-token-fallback-route-manual-review-pack.json");
  const template = sibling(html, "teacher-manual-route-review-patch-template.json");
  return {
    html,
    json,
    template,
    pack: optionalJson(json),
    patch: optionalJson(template)
  };
}

function compactEvidencePack(paths) {
  const html = paths.originalGoalLowTokenCompactEvidenceRequestPackHtml || "";
  const packet = sibling(html, "original-goal-low-token-compact-evidence-request-pack.json");
  const receipt = sibling(html, "teacher-low-token-compact-evidence-request-receipt-template.json");
  const validateCommand = sibling(html, "validate-low-token-compact-evidence-request-receipt.command.txt");
  const runCommand = sibling(html, "run-confirmed-low-token-compact-evidence-collection.command.txt");
  const launchpadHtml = paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml || "";
  const launchpad = launchpadHtml
    ? sibling(launchpadHtml, "original-goal-low-token-compact-evidence-teacher-launchpad.json")
    : paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad || "";
  return {
    html,
    packet,
    receipt,
    validateCommand,
    runCommand,
    launchpadHtml,
    launchpad,
    pack: optionalJson(packet),
    launchpadPacket: optionalJson(launchpad)
  };
}

function actionLogicPack(paths) {
  const html = paths.actionLogicSourceShortlistHtml || paths.actionLogicSourceContractPackageHtml || "";
  return {
    html,
    shortlist: paths.actionLogicSourceShortlist || "",
    shortlistReceipt: paths.actionLogicSourceShortlistReceiptTemplate || "",
    package: paths.actionLogicSourceContractPackage || "",
    packageHtml: paths.actionLogicSourceContractPackageHtml || "",
    packageReceipt: paths.actionLogicSourceContractReceiptTemplate || "",
    packageJson: optionalJson(paths.actionLogicSourceContractPackage || "")
  };
}

function teacherActions(paths) {
  const json = paths.teacherActionShortlist || "";
  const receipt = paths.teacherActionShortlistRouterReceiptTemplate || "";
  const shortlist = optionalJson(json);
  return {
    json,
    receipt,
    count: Array.isArray(shortlist?.actions) ? shortlist.actions.length : 0,
    firstActions: (shortlist?.actions || []).slice(0, 5).map((action) => ({
      id: action.id || action.actionId || action.reviewEntryId || "",
      title: action.title || action.label || "",
      lane: action.lane || "",
      openPath: action.openPath || "",
      validationCommand: action.validationCommand || "",
      instruction: action.teacherInstruction || ""
    }))
  };
}

function manualRows(manual) {
  const candidates = [
    manual.pack?.manualRows,
    manual.pack?.manualReviewRows,
    manual.pack?.rows,
    manual.pack?.routeRows,
    manual.pack?.blockedRows,
    manual.patch?.rowDecisions
  ].find(Array.isArray);
  return (candidates || []).map((row, index) => ({
    rowId: row.rowId || row.id || `manual-row-${index + 1}`,
    software: row.software || row.name || "",
    category: row.category || row.softwareCategory || "",
    recommendedRoute:
      row.recommendedRoute ||
      row.recommendedRouteId ||
      row.route ||
      row.recommendation?.safestRouteId ||
      row.receiptPatchRow?.recommendedRouteId ||
      "",
    recommendedDecision:
      row.recommendedDecision ||
      row.teacherDecision ||
      row.decision ||
      row.recommendation?.recommendedDecision ||
      row.receiptPatchRow?.recommendedDecision ||
      "needs_teacher_review"
  }));
}

function confirmationItems({ refreshedEvidence, paths, manual, compactPack, actionPack, teacherActionPack }) {
  const launchpadRows = Number(
    refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRows ??
      compactPack.launchpadPacket?.counts?.reviewRows ??
      0
  );
  const receiptBuilderRows = Number(refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderRows ?? 0);
  const compactMetadataRows = Math.max(
    launchpadRows,
    receiptBuilderRows,
    Number(refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackEligibleRows ?? 0),
    Number(refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewMetadataOnlyRows ?? 0)
  );
  const compactMetadataRowLabel = compactMetadataRows > 0 ? String(compactMetadataRows) : "ready";
  const items = [
    {
      itemId: "low-token-compact-evidence-metadata-only-rows",
      title: `Approve or reject compact metadata-only evidence for ${compactMetadataRowLabel} low-token rows`,
      whyItMatters:
        "This is the next low-token path toward all-software learning without reading full logs, screenshots, target execution, memory writes, or scheduled registration.",
      currentEvidence: {
        eligibleRows: compactMetadataRows,
        blockedRows:
          refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadBlockedRows ??
          refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackBlockedRows,
        status:
          refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadStatus ||
          refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackStatus ||
          ""
      },
      openPath: compactPack.launchpadHtml || compactPack.html,
      receiptTemplate: compactPack.receipt,
      validationCommand: commandText(compactPack.validateCommand),
      nextRunCommandAfterValidation: commandText(compactPack.runCommand),
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["approve_compact_metadata_request", "keep_blocked", "request_narrower_metadata_request"],
      stopIf: [
        "the receipt asks to read full logs",
        "the receipt asks for screenshots",
        "the receipt asks to execute target software",
        "the receipt asks to write memory or enable rules"
      ]
    },
    {
      itemId: "low-token-manual-sensitive-3-rows",
      title: "Choose safe fallback routes for the 3 sensitive low-token rows",
      whyItMatters:
        "Remote-control and chat software need explicit teacher decisions so the all-software scope stays privacy-safe instead of blindly monitoring everything.",
      currentEvidence: {
        manualRows: manualRows(manual),
        expectedManualRows: refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewRowsStillNeedingOneByOneReview
      },
      openPath: manual.html,
      receiptTemplate: manual.template,
      validationCommand: paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || "",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: [
        "mark_remote_control_out_of_scope",
        "select_privacy_preserving_state_metadata",
        "select_manual_marker_only",
        "keep_blocked"
      ],
      stopIf: [
        "the route would inspect chat contents",
        "the route would control remote-control software automatically",
        "the route would capture screenshots without teacher confirmation"
      ]
    },
    {
      itemId: "transparent-overlay-real-teacher-packet",
      title: "Attach a real teacher-exported transparent sketch packet and detail-logic validation",
      whyItMatters:
        "The 2D, perspective, and 3D/depth rehearsal exists, but real execution must wait for a real overlay packet, numbered target confirmation, and validated detail logic.",
      currentEvidence: {
        transparentSketchDepthDemonstrationRehearsalReady:
          refreshedEvidence.transparentSketchDepthDemonstrationRehearsalReady,
        transparentSketch2DPerspective3DImplemented: refreshedEvidence.transparentSketch2DPerspective3DImplemented,
        formalSpatialIntentEvidencePresent: refreshedEvidence.formalSpatialIntentEvidencePresent,
        spatialIntentEvidenceReceiptValidationStatus: refreshedEvidence.spatialIntentEvidenceReceiptValidationStatus || ""
      },
      openPath: paths.spatialIntentEvidenceRequestHtml || paths.transparentSketchDepthDemonstrationRehearsalHtml || "",
      receiptTemplate: paths.spatialIntentEvidenceReceiptTemplate || "",
      validationCommand: paths.spatialIntentEvidenceReceiptValidationCommandTemplate || "",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["provide_real_overlay_packet", "request_spatial_correction", "keep_blocked"],
      stopIf: [
        "the overlay packet is a placeholder",
        "detail logic validation is missing",
        "numbered target confirmation is missing",
        "the request tries to execute immediately"
      ]
    },
    {
      itemId: "action-logic-source-contract-review",
      title: "Review action-level logic contracts before medium-runtime reuse or dry-run pilots",
      whyItMatters:
        "This connects teacher intent, target binding, data-to-action logic, spatial relationships, rollback, and verifier evidence before any software action can be attempted.",
      currentEvidence: {
        contractRows: actionPack.packageJson?.counts?.totalRows ?? null,
        rowsNeedingTeacherLogic: actionPack.packageJson?.counts?.rowsNeedingTeacherLogic ?? null,
        status: actionPack.packageJson?.status || ""
      },
      openPath: firstExisting(actionPack.html, actionPack.packageHtml),
      receiptTemplate: firstExisting(actionPack.shortlistReceipt, actionPack.packageReceipt),
      validationCommand: actionPack.packageJson?.nextValidationCommand || "",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["teacher_confirmed_logic_contract", "blocked_needs_more_evidence", "needs_teacher_review"],
      stopIf: [
        "RAG is treated as authority",
        "medium runtime is allowed without teacher validated contract",
        "rollback or outcome verifier is missing",
        "the receipt asks to execute now"
      ]
    },
    {
      itemId: "teacher-action-router-5-current-gates",
      title: "Route the 5 current high-level teacher actions into one reviewed handoff queue",
      whyItMatters:
        "This keeps progress ordered and low-token: teacher reviews one gate at a time, then the router prepares the next review-only handoff instead of running tools directly.",
      currentEvidence: {
        actionCount: teacherActionPack.count,
        firstActions: teacherActionPack.firstActions
      },
      openPath: teacherActionPack.json,
      receiptTemplate: teacherActionPack.receipt,
      validationCommand: paths.teacherActionShortlistRouterReceiptValidationCommandTemplate || "",
      teacherDecisionDefault: "needs_teacher_review",
      allowedTeacherDecisions: ["route_one_review_item", "keep_all_blocked", "request_smaller_review_pack"],
      stopIf: [
        "the receipt accepts the whole goal",
        "the receipt unlocks packaging",
        "the receipt executes or registers tasks without a downstream teacher gate"
      ]
    }
  ];

  return items.map((item, index) => ({
    order: index + 1,
    ...item,
    locks: {
      reviewOnly: true,
      executeNow: false,
      captureNow: false,
      readLogsNow: false,
      registerNow: false,
      enableRulesNow: false,
      writeMemoryNow: false,
      acceptTechnologyNow: false,
      unlockPackagingNow: false
    }
  }));
}

function writeReadme(path, pack) {
  const lines = [
    "# Original Goal Next Confirmation Pack",
    "",
    `Status: ${pack.status}`,
    "",
    "This is a review-only confirmation layer over existing evidence. It does not run compact evidence collection, read logs, capture screenshots, execute software, register recurring tasks, write memory, enable rules, or claim completion.",
    "",
    "Use it as the next discussion surface:",
    "1. Open the HTML.",
    "2. Pick exactly the next teacher decision to review.",
    "3. Fill the linked receipt in the source package.",
    "4. Run the linked validation command only after the teacher fills the receipt.",
    "5. Keep rollback points until the teacher confirms the direction."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pack) {
  const rows = pack.confirmationItems
    .map(
      (item) => `<tr>
        <td>${item.order}</td>
        <td>${htmlEscape(item.title)}<br><small>${htmlEscape(item.itemId)}</small></td>
        <td>${htmlEscape(item.whyItMatters)}</td>
        <td>${item.openPath ? `<a href="${htmlEscape(fileHref(item.openPath))}">${htmlEscape(basename(item.openPath))}</a>` : ""}</td>
        <td><code>${htmlEscape(compact(item.validationCommand || "(wait for teacher receipt)", 260))}</code></td>
        <td>${htmlEscape(item.teacherDecisionDefault)}</td>
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
  <title>Original Goal Next Confirmation Pack</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.55; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    small { color: #56677f; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; overflow-wrap: anywhere; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Next Confirmation Pack</h1>
    <p>${htmlEscape(pack.summary)}</p>
    <p class="lock">Review-only: no log reads, screenshots, software execution, schedule registration, memory writes, rule enablement, packaging unlock, or completion claim.</p>
    <table>
      <thead>
        <tr><th>#</th><th>Decision</th><th>Why</th><th>Open</th><th>Validation</th><th>Default</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const statusRefreshPath = resolve(argValue("--status-refresh", ""));
if (!statusRefreshPath || !existsSync(statusRefreshPath)) throw new Error("--status-refresh is required");
const statusRefresh = readJson(statusRefreshPath);
const paths = statusRefresh.paths || {};
const refreshedEvidence = statusRefresh.refreshedEvidence || {};
const goal = argValue("--goal", statusRefresh.goal || "Continue original goal next teacher confirmation.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "original-goal-next-confirmation-packs")));
mkdirSync(outputRoot, { recursive: true });
const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const outDir = join(outputRoot, packId);
mkdirSync(outDir, { recursive: true });

const manual = latestManualReviewPack(paths);
const compactPack = compactEvidencePack(paths);
const actionPack = actionLogicPack(paths);
const teacherActionPack = teacherActions(paths);
const lockState = locks();
const packPath = join(outDir, "original-goal-next-confirmation-pack.json");
const htmlPath = join(outDir, "original-goal-next-confirmation-pack.html");
const readmePath = join(outDir, "ORIGINAL_GOAL_NEXT_CONFIRMATION_PACK_START_HERE.md");
const receiptTemplatePath = join(outDir, "teacher-next-confirmation-pack-receipt-template.json");

const confirmationItemsValue = confirmationItems({
  refreshedEvidence,
  paths,
  manual,
  compactPack,
  actionPack,
  teacherActionPack
});
const compactEvidenceItem = confirmationItemsValue.find(
  (item) =>
    item.itemId === "low-token-compact-evidence-metadata-only-rows" ||
    item.itemId === "low-token-compact-evidence-10-metadata-only-rows"
);
const sensitiveManualItem = confirmationItemsValue.find((item) => item.itemId === "low-token-manual-sensitive-3-rows");
const compactMetadataRows = Math.max(
  Number(compactEvidenceItem?.currentEvidence?.eligibleRows ?? 0),
  Number(refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewMetadataOnlyRows ?? 0)
);
const sensitiveManualRows = Math.max(
  Number(sensitiveManualItem?.currentEvidence?.manualRows?.length ?? 0),
  Number(refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewRowsStillNeedingOneByOneReview ?? 0)
);

const pack = {
  ok: true,
  format: "transparent_ai_original_goal_next_confirmation_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_next_confirmation_review",
  summary:
    "The full objective is not complete; this pack compresses the next teacher decisions for all-software low-token learning, transparent sketch/spatial evidence, action logic contracts, and current router gates.",
  sourceEvidence: {
    statusRefresh: statusRefreshPath,
    dashboard: paths.dashboard || paths.currentStatusDashboardHtml || "",
    teacherActionShortlist: paths.teacherActionShortlist || "",
    compactEvidenceRequestPack: compactPack.packet,
    manualSensitiveReviewPack: manual.json,
    actionLogicSourcePackage: actionPack.package,
    spatialIntentEvidenceRequest: paths.spatialIntentEvidenceRequestHtml || ""
  },
  counts: {
    lowTokenLedgerRows: refreshedEvidence.originalGoalLowTokenCoverageLedgerRows ?? null,
    lowTokenWaitingRows: refreshedEvidence.originalGoalLowTokenCoverageWaitingRows ?? null,
    compactMetadataRows: compactMetadataRows || null,
    sensitiveManualRows: sensitiveManualRows || null,
    teacherRouterActions: teacherActionPack.count,
    confirmationItems: confirmationItemsValue.length
  },
  statusSnapshot: {
    compactEvidenceRunReady: refreshedEvidence.originalGoalLowTokenCompactEvidenceRunReady === true,
    compactLearningHandoffReady: refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffReady === true,
    transparentSketchDepthDemonstrationRehearsalReady:
      refreshedEvidence.transparentSketchDepthDemonstrationRehearsalReady === true,
    transparentSketch2DPerspective3DImplemented: refreshedEvidence.transparentSketch2DPerspective3DImplemented === true,
    formalSpatialIntentEvidencePresent: refreshedEvidence.formalSpatialIntentEvidencePresent === true,
    spatialIntentEvidenceReceiptValidationStatus: refreshedEvidence.spatialIntentEvidenceReceiptValidationStatus || "",
    goalComplete: false
  },
  confirmationItems: confirmationItemsValue,
  receiptTemplate: {
    format: "transparent_ai_original_goal_next_confirmation_pack_receipt_v1",
    packId,
    decision: "needs_teacher_review",
    itemDecisions: confirmationItemsValue.map((item) => ({
      itemId: item.itemId,
      teacherDecision: "needs_teacher_review",
      reviewedOpenPath: false,
      reviewedValidationCommand: false,
      teacherNote: ""
    })),
    locks: lockState
  },
  nextInstruction:
    "Teacher should choose one item, fill the linked source receipt, validate that receipt, and keep rollback points retained before any runner or target-software path.",
  blockedActions: [
    "run_compact_evidence_without_teacher_receipt",
    "inspect_chat_contents",
    "control_remote_software_without_teacher_route",
    "use_placeholder_overlay_packet",
    "execute_spatial_target_without_numbered_confirmation",
    "allow_medium_runtime_without_logic_contract",
    "register_recurring_monitor_without_teacher_gate",
    "claim_original_goal_complete"
  ],
  locks: lockState,
  paths: {
    pack: packPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath
  }
};

writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(pack.receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, pack);
writeHtml(htmlPath, pack);

console.log(JSON.stringify(pack, null, 2));
