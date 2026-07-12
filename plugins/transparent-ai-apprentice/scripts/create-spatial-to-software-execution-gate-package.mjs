#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-to-software-execution-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "spatial-to-software-execution-gate"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function optionalPath(value) {
  const text = String(value || "").trim();
  return text ? resolve(text) : "";
}

function optionalJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    if (!statSync(path).isFile()) return null;
  } catch {
    return null;
  }
  return readJson(path);
}

function latestRefreshPath(root) {
  const refreshRoot = resolve(root || join(process.cwd(), ".transparent-apprentice", "original-goal-current-status-refreshes"));
  if (!existsSync(refreshRoot)) return "";
  const latest = readdirSync(refreshRoot)
    .map((name) => join(refreshRoot, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory() && existsSync(join(path, "original-goal-current-status-refresh.json"));
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  return latest ? join(latest, "original-goal-current-status-refresh.json") : "";
}

function latestJsonUnder(root, fileName, expectedFormat = "") {
  const base = resolve(root);
  if (!existsSync(base)) return "";
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) walk(path);
      else if (name === fileName) {
        if (!expectedFormat) hits.push(path);
        else {
          try {
            const json = readJson(path);
            if (json.format === expectedFormat) hits.push(path);
          } catch {}
        }
      }
    }
  };
  walk(base);
  return hits.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || "";
}

function newestDirectoryWithFile(root, fileName) {
  const base = resolve(root);
  if (!existsSync(base)) return "";
  return (
    readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = join(base, entry.name);
        const file = join(dir, fileName);
        return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time)[0]?.file || ""
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
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function closedLocks() {
  return {
    reviewOnly: true,
    gatePackageOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packageDoesNotValidateReceipt: true,
    packageDoesNotRunSpatialTargetConfirmation: true,
    packageDoesNotRunRouteBridge: true,
    packageDoesNotExecuteSoftware: true,
    packageDoesNotCaptureScreenshots: true,
    packageDoesNotSendUiEvents: true,
    packageDoesNotWriteMemory: true,
    targetConfirmationInvoked: false,
    routeBridgeInvoked: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function gateRow(id, label, status, ready, evidencePath, blocker, nextAction) {
  return {
    id,
    label,
    status: status || "missing",
    ready: ready === true,
    evidencePath: evidencePath || "",
    blocker: ready === true ? "" : blocker,
    nextAction: ready === true ? "continue_to_next_gate" : nextAction,
    locks: closedLocks()
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) parts.push(flag);
    else parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function writeReadme(path, packet) {
  const lines = [
    "# Spatial To Software Execution Gate Package",
    "",
    `Status: ${packet.status}`,
    `Ready for dry-run route bridge: ${packet.readyForDryRunRouteBridge}`,
    "",
    "This package summarizes the gates from transparent sketch evidence to target software execution planning.",
    "It does not validate receipts, run target confirmation, run route bridge, execute software, capture screenshots, send UI events, write memory, enable rules, accept technology, unlock packaging, or claim completion.",
    "",
    "Gates:",
    ...packet.gates.map((row, index) => `${index + 1}. ${row.id}: ${row.status}; ready=${row.ready}; blocker=${row.blocker || "none"}`),
    "",
    "Next commands:",
    ...packet.nextCommands.map((entry, index) => `${index + 1}. ${entry.id}: ${entry.command}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const rows = packet.gates
    .map(
      (row) => `<article class="row">
        <h2>${htmlEscape(row.id)}</h2>
        <p><strong>Status:</strong> <code>${htmlEscape(row.status)}</code> <strong>Ready:</strong> <code>${htmlEscape(row.ready)}</code></p>
        <p><strong>Evidence:</strong> <a href="${htmlEscape(fileHref(row.evidencePath))}">${htmlEscape(row.evidencePath || "missing")}</a></p>
        <p><strong>Blocker:</strong> ${htmlEscape(row.blocker || "none")}</p>
        <p><strong>Next:</strong> ${htmlEscape(row.nextAction)}</p>
      </article>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial To Software Execution Gate Package</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f6f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .summary, .row { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    code { background: #edf3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Spatial To Software Execution Gate Package</h1>
  <section class="summary">
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Ready for dry-run route bridge:</strong> <code>${htmlEscape(packet.readyForDryRunRouteBridge)}</code></p>
    <p>This is a gate summary only. It does not execute software or run the bridge.</p>
  </section>
  ${rows}
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const refreshPath = resolve(argValue("--refresh", latestRefreshPath(argValue("--refresh-root", ""))));
if (!refreshPath || !existsSync(refreshPath)) {
  throw new Error("Usage: node create-spatial-to-software-execution-gate-package.mjs --refresh <original-goal-current-status-refresh.json>");
}
const refresh = readJson(refreshPath);
const latestEntrypoint = latestJsonUnder(
  argValue("--entrypoint-root", join(process.cwd(), "artifacts", "spatial-intent-formal-evidence-entrypoints")),
  "spatial-intent-formal-evidence-entrypoint.json",
  "transparent_ai_spatial_intent_formal_evidence_entrypoint_v1"
);

const entrypointPath = optionalPath(argValue("--entrypoint", latestEntrypoint));
const spatialValidationPath = optionalPath(argValue("--spatial-validation", refresh.paths?.spatialIntentEvidenceReceiptValidation || ""));
const rehearsalValidationPath = optionalPath(
  argValue("--depth-rehearsal-validation", refresh.paths?.transparentSketchDepthRehearsalReviewReceiptValidation || "")
);
const rehearsalPath = optionalPath(argValue("--rehearsal", refresh.paths?.transparentSketchDepthDemonstrationRehearsal || ""));
const targetConfirmationPath = optionalPath(argValue("--target-confirmation", refresh.paths?.spatialTargetConfirmationKit || ""));
const routeBridgePath = optionalPath(argValue("--route-bridge", refresh.paths?.spatialSoftwareExecutionRouteBridge || ""));
const confirmedRollbackPoint = String(argValue("--rollback-point", "") || "").trim();
const physicalWorldSpatialGroundingPath = optionalPath(
  argValue(
    "--physical-world-spatial-grounding-pack",
    refresh.paths?.physicalWorldSpatialGroundingPack ||
      newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "physical-world-spatial-grounding-packs"),
        "physical-world-spatial-grounding-pack.json"
      )
  )
);

const entrypoint = optionalJson(entrypointPath);
const spatialValidation = optionalJson(spatialValidationPath);
const rehearsalValidation = optionalJson(rehearsalValidationPath);
const rehearsal = optionalJson(rehearsalPath);
const targetConfirmation = optionalJson(targetConfirmationPath);
const routeBridge = optionalJson(routeBridgePath);
const physicalWorldSpatialGrounding = optionalJson(physicalWorldSpatialGroundingPath);
const selectedSoftware = String(argValue("--software", "") || "").trim() || rehearsal?.software || "RealLocalAllSoftware";

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "spatial-to-software-execution-gate-packages")));
const goal = refresh.goal || entrypoint?.goal || rehearsal?.goal || "transparent sketch to software execution";
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, packageId);
mkdirSync(dir, { recursive: true });

const spatialValidationReady =
  spatialValidation?.format === "transparent_ai_spatial_intent_evidence_receipt_validation_v1" &&
  [
    "ready_for_spatial_target_confirmation",
    "validated_with_ready_spatial_target_confirmation"
  ].includes(spatialValidation.status);
const depthReviewReady =
  rehearsalValidation?.format === "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1" &&
  rehearsalValidation.readyForExecution === true;
const targetConfirmationReady =
  (targetConfirmation?.format === "transparent_ai_spatial_target_confirmation_kit_v1" ||
    targetConfirmation?.format === "transparent_ai_spatial_target_confirmation_v1") &&
  Number(targetConfirmation.selectedNumber || targetConfirmation.selectedCandidateNumber || 0) > 0 &&
  targetConfirmation.teacherConfirmedNumber === true;
const routeBridgeReady =
  routeBridge?.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
  routeBridge.status === "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review";
const physicalGroundingReady =
  physicalWorldSpatialGrounding?.format === "transparent_ai_physical_world_spatial_grounding_pack_v1" &&
  physicalWorldSpatialGrounding.status === "source_project_grounding_ready_for_transparent_overlay_review" &&
  Number(physicalWorldSpatialGrounding.counts?.presentEvidenceRows || 0) >= 5 &&
  physicalWorldSpatialGrounding.locks?.noTargetSoftwareExecution === true &&
  physicalWorldSpatialGrounding.locks?.noRealWorldAuthorityClaim === true;
const rollbackReady = confirmedRollbackPoint.length > 0 && !/^<.*>$/.test(confirmedRollbackPoint);

const gates = [
  gateRow(
    "retained_rollback_point",
    "Teacher-confirmed retained rollback point before execution planning",
    rollbackReady ? "rollback_point_confirmed" : "missing_retained_rollback_point",
    rollbackReady,
    confirmedRollbackPoint,
    "missing retained rollback point from teacher-reviewed receipt",
    "create or select a rollback point before preparing spatial-to-software execution"
  ),
  gateRow(
    "formal_spatial_entrypoint",
    "Formal 2D perspective 3D overlay evidence entrypoint exists",
    entrypoint?.status || "missing_formal_entrypoint",
    entrypoint?.format === "transparent_ai_spatial_intent_formal_evidence_entrypoint_v1" && entrypoint?.dimensionCheck?.ready === true,
    entrypointPath,
    "missing formal entrypoint or dimension check",
    "create formal spatial evidence entrypoint"
  ),
  gateRow(
    "physical_world_spatial_grounding",
    "Physical-world spatial grounding for 2D perspective 3D overlay interpretation",
    physicalWorldSpatialGrounding?.status || "missing_physical_world_spatial_grounding_pack",
    physicalGroundingReady,
    physicalWorldSpatialGroundingPath,
    "missing review-only RGB-D/camera/point-cloud/panel-pose/fold-angle grounding pack",
    "run create-physical-world-spatial-grounding-pack before preparing spatial-to-software execution"
  ),
  gateRow(
    "teacher_exported_overlay_validation",
    "Teacher-exported overlay packet receipt validation",
    spatialValidation?.status || "missing_spatial_intent_validation",
    spatialValidationReady,
    spatialValidationPath,
    spatialValidation?.validationDecision || spatialValidation?.decision || "missing teacher exported overlay validation",
    "teacher exports/confirm real overlay packet, fills receipt, then run validate-spatial-intent-evidence-receipt"
  ),
  gateRow(
    "depth_rehearsal_teacher_review",
    "Transparent sketch depth rehearsal teacher review",
    rehearsalValidation?.status || "missing_depth_rehearsal_review_validation",
    depthReviewReady,
    rehearsalValidationPath,
    rehearsalValidation?.validationDecision || rehearsalValidation?.decision || "missing teacher depth rehearsal review",
    "teacher fills depth rehearsal review receipt and validate it"
  ),
  gateRow(
    "numbered_spatial_target_confirmation",
    "Teacher-confirmed numbered spatial target",
    targetConfirmation?.status || rehearsal?.status || "missing_numbered_target_confirmation",
    targetConfirmationReady,
    targetConfirmationPath,
    "selected target number is missing or not teacher-confirmed",
    "run create-spatial-target-confirmation-kit after spatial validation, then teacher confirms one numbered target"
  ),
  gateRow(
    "software_execution_route_bridge",
    "Selected spatial target bound to software execution route",
    routeBridge?.status || "missing_spatial_software_execution_route_bridge",
    routeBridgeReady,
    routeBridgePath,
    "route bridge not ready; requires teacher-confirmed numbered target and detail logic gate",
    "run create-spatial-software-execution-route-bridge only after target confirmation and detail logic validation"
  )
];
const readyForDryRunRouteBridge = gates.every((row) => row.ready === true);
const firstBlocker = gates.find((row) => row.ready !== true);
const locks = closedLocks();
const gatePath = join(dir, "spatial-to-software-execution-gate-package.json");
const readmePath = join(dir, "SPATIAL_TO_SOFTWARE_EXECUTION_GATE_START_HERE.md");
const htmlPath = join(dir, "spatial-to-software-execution-gate-package.html");
const nextCommands = [
  {
    id: "validate_real_teacher_spatial_receipt",
    status: spatialValidationReady ? "already_ready" : "blocked_until_teacher_receipt",
    command:
      refresh.paths?.spatialIntentEvidenceReceiptValidationCommandTemplate ||
      commandLine("validate-spatial-intent-evidence-receipt.mjs", [
        ["--request", refresh.paths?.spatialIntentEvidenceRequest || "<spatial-intent-evidence-request.json>"],
        ["--receipt", "<teacher-filled-spatial-intent-evidence-receipt.json>"],
        ["--output-dir", join(dir, "spatial-intent-evidence-receipt-validation")]
      ]),
    allowedInThisPackage: false
  },
  {
    id: "create_numbered_spatial_target_confirmation_after_ready_validation",
    status: spatialValidationReady ? "ready_after_teacher_receipt" : "blocked_by_spatial_validation",
    command: commandLine("create-spatial-target-confirmation-kit.mjs", [
      ["--overlay-packet", "<teacher-exported-transparent-sketch-packet.json>"],
      ["--goal", goal],
      ["--software", selectedSoftware],
      ["--output-dir", join(dir, "spatial-target-confirmation")]
    ]),
    allowedInThisPackage: false
  },
  {
    id: "create_spatial_software_execution_route_bridge_after_number_confirmation",
    status: targetConfirmationReady ? "ready_after_number_confirmation" : "blocked_by_numbered_target_confirmation",
    command: commandLine("create-spatial-software-execution-route-bridge.mjs", [
      ["--goal", goal],
      ["--software", selectedSoftware],
      ["--overlay-packet", "<teacher-exported-transparent-sketch-packet.json>"],
      ["--target-confirmation", "<teacher-confirmed-spatial-target-confirmation-kit.json>"],
      ["--confirmation-receipt", "<teacher-confirmed-target-receipt.json>"],
      ["--output-dir", join(dir, "spatial-software-execution-route")]
    ]),
    allowedInThisPackage: false
  }
];
const packet = {
  ok: true,
  format: "transparent_ai_spatial_to_software_execution_gate_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: readyForDryRunRouteBridge ? "ready_for_review_only_dry_run_route_bridge" : "blocked_before_spatial_software_execution",
  readyForDryRunRouteBridge,
  firstBlocker: firstBlocker ? { id: firstBlocker.id, status: firstBlocker.status, blocker: firstBlocker.blocker } : null,
  goal,
  sourceEvidence: {
    refresh: refreshPath,
    formalEntrypoint: entrypointPath,
    physicalWorldSpatialGroundingPack: physicalWorldSpatialGroundingPath,
    spatialIntentEvidenceReceiptValidation: spatialValidationPath,
    transparentSketchDepthRehearsalReviewReceiptValidation: rehearsalValidationPath,
    transparentSketchDepthDemonstrationRehearsal: rehearsalPath,
    targetConfirmation: targetConfirmationPath,
    routeBridge: routeBridgePath,
    confirmedRollbackPoint,
    selectedSoftware
  },
  selectedSoftware,
  gates,
  nextCommands,
  paths: {
    package: gatePath,
    readme: readmePath,
    html: htmlPath
  },
  completionBoundary:
    "This package checks whether transparent sketch evidence can proceed toward software execution planning. It does not run target confirmation, route bridge, software execution, screenshots, UI events, memory, acceptance, packaging, or goal completion.",
  locks
};

writeFileSync(gatePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_to_software_execution_gate_package_result_v1",
      packageId,
      status: packet.status,
      readyForDryRunRouteBridge,
      firstBlocker: packet.firstBlocker,
      gatePath,
      readmePath,
      htmlPath,
      locks
    },
    null,
    2
  )
);
