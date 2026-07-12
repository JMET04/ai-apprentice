#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function loadOptional(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function newestDirectoryWithFile(root, fileName) {
  if (!existsSync(root)) return "";
  return (
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = join(root, entry.name);
        const file = join(dir, fileName);
        return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time)[0]?.file || ""
  );
}

function newestFileRecursive(root, fileName, maxDepth = 5) {
  if (!existsSync(root)) return "";
  const matches = [];
  const visit = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isFile() && entry.name === fileName) {
        try {
          matches.push({ file: path, time: statSync(path).mtimeMs });
        } catch {
          // Generated artifacts can disappear while a refresh is in progress.
        }
      } else if (entry.isDirectory()) {
        visit(path, depth + 1);
      }
    }
  };
  visit(root, 0);
  return matches.sort((a, b) => b.time - a.time)[0]?.file || "";
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
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

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(fileHref(path))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function commandById(packet, id) {
  return Array.isArray(packet?.nextCommands) ? packet.nextCommands.find((item) => item.id === id)?.command || "" : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    launchpadDoesNotReadLogs: true,
    launchpadDoesNotReadFullLogs: true,
    launchpadDoesNotCaptureScreenshots: true,
    launchpadDoesNotRecordScreen: true,
    launchpadDoesNotRegisterMonitor: true,
    launchpadDoesNotLaunchRunner: true,
    launchpadDoesNotExecuteTargetSoftware: true,
    launchpadDoesNotWriteMemory: true,
    launchpadDoesNotEnableRules: true,
    launchpadDoesNotDowngradeRuntime: true,
    launchpadDoesNotDeleteRollbackPoints: true,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function entry(id, label, path, description, group = "review") {
  return {
    id,
    label,
    path: path || "",
    exists: Boolean(path && existsSync(path)),
    description,
    group
  };
}

function safeAction(id, title, detail, commandOrPath, boundary) {
  return {
    id,
    title,
    detail,
    commandOrPath: commandOrPath || "",
    boundary
  };
}

function writeHtml(path, launchpad) {
  const entryCards = launchpad.entryLinks
    .map(
      (item) => `<article class="card">
        <h3>${htmlEscape(item.label)}</h3>
        <p>${htmlEscape(item.description)}</p>
        <p>${item.path ? link("Open", item.path) : "<span>Missing</span>"}</p>
      </article>`
    )
    .join("\n");
  const actionRows = launchpad.safeNextActions
    .map(
      (item, index) => `<article class="step">
        <h3>${index + 1}. ${htmlEscape(item.title)}</h3>
        <p>${htmlEscape(item.detail)}</p>
        ${item.commandOrPath && existsSync(item.commandOrPath) ? `<p>${link("Open file", item.commandOrPath)}</p>` : ""}
        ${item.commandOrPath && !existsSync(item.commandOrPath) ? `<pre>${htmlEscape(item.commandOrPath)}</pre>` : ""}
        <p class="boundary">${htmlEscape(item.boundary)}</p>
      </article>`
    )
    .join("\n");
  const blockedRows = launchpad.blockedActions.map((item) => `<li>${htmlEscape(item)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Start Here</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1180px; margin: 0 auto; }
    section, .card, .step { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    h1, h2, h3 { margin: 0 0 12px; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
    .boundary, .locked { color: #8a2f18; font-weight: 600; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; }
    dt { font-weight: 700; }
    @media (max-width: 760px) { .grid, dl { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Start Here</h1>
  <p class="status">${htmlEscape(launchpad.status)}</p>
  <section>
    <h2>What This Is</h2>
    <p>This fixed launchpad points to the latest teacher-facing review artifacts for all-software low-token learning, transparent overlay drawing, spatial perspective/depth review, teacher method adaptation, and trial receipt validation.</p>
    <p class="locked">It is review-only. It does not read logs, capture screenshots, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Status</h2>
    <dl>
      <dt>Goal complete</dt><dd>${htmlEscape(String(launchpad.statusSummary.goalComplete))}</dd>
      <dt>Requirements</dt><dd>${htmlEscape(launchpad.statusSummary.totalRequirements)}</dd>
      <dt>Implementation evidence</dt><dd>${htmlEscape(launchpad.statusSummary.implementationEvidenceReadyCount)}</dd>
      <dt>Completion proof</dt><dd>${htmlEscape(launchpad.statusSummary.completionProvenCount)}</dd>
      <dt>Teacher trial phases</dt><dd>${htmlEscape(launchpad.statusSummary.teacherTrialPhaseCount)}</dd>
      <dt>Transparent overlay</dt><dd>${htmlEscape(String(launchpad.statusSummary.transparentOverlayAvailable))}</dd>
      <dt>2D / perspective / 3D</dt><dd>${htmlEscape(
        `${launchpad.statusSummary.spatialHas2DPositionEvidence} / ${launchpad.statusSummary.spatialHasPerspectiveEvidence} / ${launchpad.statusSummary.spatialHas3DDepthEvidence}`
      )}</dd>
      <dt>Spatial execution boundary</dt><dd>${htmlEscape(launchpad.statusSummary.spatialExecutionBoundary)}</dd>
      <dt>Next proof gap</dt><dd>${htmlEscape(
        `${launchpad.statusSummary.nextProofGapPhase || "missing"} / ${launchpad.statusSummary.nextProofGapRouteId || "missing"}`
      )}</dd>
      <dt>Next candidate evidence</dt><dd>${htmlEscape(
        launchpad.statusSummary.nextProofGapCandidateEvidencePath || "missing"
      )}</dd>
    </dl>
  </section>
  <section>
    <h2>Open These First</h2>
    <div class="grid">${entryCards}</div>
  </section>
  <section>
    <h2>Safe Next Actions</h2>
    ${actionRows}
  </section>
  <section>
    <h2>Blocked Actions</h2>
    <ul>${blockedRows}</ul>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, launchpad) {
  const lines = [
    "# Current Goal Start Here",
    "",
    `Status: ${launchpad.status}`,
    "",
    "This is the stable entry point for the current goal. Open the HTML first, then use the teacher trial workbench and receipt builder.",
    "",
    "## Status",
    "",
    `- Goal complete: ${launchpad.statusSummary.goalComplete}`,
    `- Requirements: ${launchpad.statusSummary.totalRequirements}`,
    `- Implementation evidence ready: ${launchpad.statusSummary.implementationEvidenceReadyCount}`,
    `- Completion-proven requirements: ${launchpad.statusSummary.completionProvenCount}`,
    `- Teacher trial phases: ${launchpad.statusSummary.teacherTrialPhaseCount}`,
    `- Transparent overlay available: ${launchpad.statusSummary.transparentOverlayAvailable}`,
    `- 2D position evidence: ${launchpad.statusSummary.spatialHas2DPositionEvidence}`,
    `- Perspective evidence: ${launchpad.statusSummary.spatialHasPerspectiveEvidence}`,
    `- 3D depth evidence: ${launchpad.statusSummary.spatialHas3DDepthEvidence}`,
    `- Spatial execution boundary: ${launchpad.statusSummary.spatialExecutionBoundary}`,
    `- Proof gap teacher queue: ${launchpad.statusSummary.proofGapTeacherQueueStatus}`,
    `- Next proof gap: ${launchpad.statusSummary.nextProofGapPhase} / ${launchpad.statusSummary.nextProofGapRouteId}`,
    `- Next proof gap question: ${launchpad.statusSummary.nextProofGapQuestion}`,
    `- Proof gap evidence prefill: ${launchpad.statusSummary.proofGapEvidencePrefillStatus}`,
    `- Next proof gap focused receipt builder: ${launchpad.statusSummary.nextProofGapFocusedReceiptBuilderStatus}`,
    `- All-software inventory batch review builder: ${launchpad.statusSummary.allSoftwareObserverInventoryBatchReviewBuilderStatus}`,
    `- Next teacher confirmation cockpit: ${launchpad.statusSummary.nextTeacherConfirmationCockpitStatus}`,
    `- Next proof gap candidate evidence: ${launchpad.statusSummary.nextProofGapCandidateEvidencePath}`,
    `- Next proof gap candidate still needs teacher confirmations: ${launchpad.statusSummary.nextProofGapStillNeedsTeacherConfirmation}`,
    "",
    "## Primary links",
    "",
    ...launchpad.entryLinks.map((item) => `- ${item.label}: ${item.path || "missing"}`),
    "",
    "## Safe next actions",
    "",
    ...launchpad.safeNextActions.map((item, index) => `${index + 1}. ${item.title}: ${item.commandOrPath || item.detail}`),
    "",
    "## Locks",
    "",
    "- Review-only.",
    "- Does not read logs, capture screenshots, execute software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-start-here")));
mkdirSync(outputRoot, { recursive: true });

const integratedGatePath =
  argValue("--integrated-gate") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-integrated-evidence-gates"),
    "current-goal-integrated-evidence-gate.json"
  );
const teacherTrialPath =
  argValue("--teacher-trial-workbench") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-teacher-trial-workbenches"),
    "current-goal-teacher-trial-workbench.json"
  );
const teacherTrialPreflightPath =
  argValue("--teacher-trial-preflight") ||
  (existsSync(join(process.cwd(), "artifacts", "current-goal-teacher-trial-preflights", "current-goal-teacher-trial-preflight.json"))
    ? join(process.cwd(), "artifacts", "current-goal-teacher-trial-preflights", "current-goal-teacher-trial-preflight.json")
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-teacher-trial-preflights"),
        "current-goal-teacher-trial-preflight.json"
      ));
const teacherTrialIntakeRouterPath =
  argValue("--teacher-trial-intake-router") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-teacher-trial-intake-routers",
      "current-goal-teacher-trial-intake-router.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-teacher-trial-intake-routers",
        "current-goal-teacher-trial-intake-router.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-teacher-trial-intake-routers"),
        "current-goal-teacher-trial-intake-router.json"
      ));
const shortestTeacherEvidencePackPath =
  argValue("--shortest-teacher-evidence-pack") ||
  (existsSync(join(process.cwd(), "artifacts", "current-goal-shortest-teacher-evidence-packs", "current-goal-shortest-teacher-evidence-pack.json"))
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-shortest-teacher-evidence-packs",
        "current-goal-shortest-teacher-evidence-pack.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-shortest-teacher-evidence-packs"),
        "current-goal-shortest-teacher-evidence-pack.json"
      ));
const shortestTeacherEvidenceReceiptValidationPath =
  argValue("--shortest-teacher-evidence-receipt-validation") ||
  argValue("--shortest-evidence-receipt-validation") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-shortest-teacher-evidence-receipt-validations"),
    "shortest-teacher-evidence-receipt-validation.json"
  );
const realLocalTrialPackagePath =
  argValue("--real-local-trial-package") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-real-local-trial-packages"),
    "current-goal-real-local-trial-package.json"
  );
const finalReviewIndexPath =
  argValue("--final-review-index") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-final-review-indexes"),
    "current-goal-final-review-index.json"
  );
const finalConvergenceReadinessGatePath =
  argValue("--final-convergence-readiness-gate") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-final-convergence-readiness-gates"),
    "current-goal-final-convergence-readiness-gate.json"
  );
const finalTeacherAcceptanceReviewPackPath =
  argValue("--final-teacher-acceptance-review-pack") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-final-teacher-acceptance-review-packs"),
    "current-goal-final-teacher-acceptance-review-pack.json"
  );
const physicalWorldSpatialGroundingPackPath =
  argValue("--physical-world-spatial-grounding-pack") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "physical-world-spatial-grounding-packs"),
    "physical-world-spatial-grounding-pack.json"
  );
const proofGapTeacherQueuePath =
  argValue("--proof-gap-teacher-queue") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "original-goal-proof-gap-teacher-queues"),
    "original-goal-proof-gap-teacher-queue.json"
  ) ||
  newestFileRecursive(
    join(process.cwd(), "artifacts", "original-goal-current-status-refreshes"),
    "original-goal-proof-gap-teacher-queue.json",
    6
  );
const proofGapEvidencePrefillPath =
  argValue("--proof-gap-evidence-prefill") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "original-goal-proof-gap-evidence-prefills"),
    "original-goal-proof-gap-evidence-prefill.json"
  );
const proofGapTeacherQueueReceiptBuilderPath =
  argValue("--proof-gap-teacher-queue-receipt-builder") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "original-goal-proof-gap-teacher-queue-receipt-builders"),
    "original-goal-proof-gap-teacher-queue-receipt-builder.json"
  );
const proofGapNextFocusedReceiptBuilderPath =
  argValue("--proof-gap-next-focused-receipt-builder") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "original-goal-next-proof-gap-focused-receipt-builders"),
    "original-goal-next-proof-gap-focused-receipt-builder.json"
  );
const proofGapTeacherQueueReceiptValidationPath =
  argValue("--proof-gap-teacher-queue-receipt-validation") ||
  newestFileRecursive(
    join(process.cwd(), "artifacts", "original-goal-proof-gap-teacher-queues"),
    "original-goal-proof-gap-teacher-queue-receipt-validation.json",
    6
  );
const proofGapReceiptIntakeRouterPath =
  argValue("--proof-gap-receipt-intake-router") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "original-goal-proof-gap-receipt-intake-routers",
      "original-goal-proof-gap-receipt-intake-router.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "original-goal-proof-gap-receipt-intake-routers",
        "original-goal-proof-gap-receipt-intake-router.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "original-goal-proof-gap-receipt-intake-routers"),
        "original-goal-proof-gap-receipt-intake-router.json"
      ));
const allSoftwareObserverBootstrapPath =
  argValue("--all-software-observer-bootstrap") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-observer-bootstraps"),
    "all-software-observer-bootstrap.json"
  ) ||
  newestDirectoryWithFile(
    join(process.cwd(), ".transparent-apprentice", "all-software-observer-bootstrap"),
    "all-software-observer-bootstrap.json"
  );
const teachExecuteReviewedObservationPath =
  argValue("--teach-execute-reviewed-observation") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-teach-execute-reviewed-observations"),
    "teach-execute-reviewed-observation.json"
  ) ||
  newestDirectoryWithFile(
    join(process.cwd(), ".transparent-apprentice", "teach-execute-reviewed-observations"),
    "teach-execute-reviewed-observation.json"
  );
const allSoftwareObserverInventoryReviewBuilderPath =
  argValue("--all-software-observer-inventory-review-builder") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-all-software-observer-inventory-review-builders",
      "all-software-observer-inventory-review-builder.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-all-software-observer-inventory-review-builders",
        "all-software-observer-inventory-review-builder.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-all-software-observer-inventory-review-builders"),
        "all-software-observer-inventory-review-builder.json"
      ));
const allSoftwareObserverInventoryBatchReviewBuilderPath =
  argValue("--all-software-observer-inventory-batch-review-builder") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-all-software-observer-inventory-batch-review-builders",
      "all-software-observer-inventory-batch-review-builder.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-all-software-observer-inventory-batch-review-builders",
        "all-software-observer-inventory-batch-review-builder.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-all-software-observer-inventory-batch-review-builders"),
        "all-software-observer-inventory-batch-review-builder.json"
      ));
const nextTeacherConfirmationCockpitPath =
  argValue("--next-teacher-confirmation-cockpit") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-next-teacher-confirmation-cockpits",
      "current-goal-next-teacher-confirmation-cockpit.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-next-teacher-confirmation-cockpits",
        "current-goal-next-teacher-confirmation-cockpit.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-next-teacher-confirmation-cockpits"),
        "current-goal-next-teacher-confirmation-cockpit.json"
      ));
const nextTeacherConfirmationCockpitReceiptValidationPath =
  argValue("--next-teacher-confirmation-cockpit-receipt-validation") ||
  argValue("--next-teacher-confirmation-receipt-validation") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-next-teacher-confirmation-cockpit-receipt-validations",
      "current-goal-next-teacher-confirmation-cockpit-receipt-validation.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-next-teacher-confirmation-cockpit-receipt-validations",
        "current-goal-next-teacher-confirmation-cockpit-receipt-validation.json"
      )
    : newestDirectoryWithFile(
        join(
          process.cwd(),
          "artifacts",
          "current-goal-next-teacher-confirmation-cockpit-receipt-validations"
        ),
        "current-goal-next-teacher-confirmation-cockpit-receipt-validation.json"
      ));
const allSoftwareObserverReviewedQueueBridgePath =
  argValue("--all-software-observer-reviewed-queue-bridge") ||
  (existsSync(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-all-software-observer-reviewed-queues",
      "all-software-observer-reviewed-queue-bridge.json"
    )
  )
    ? join(
        process.cwd(),
        "artifacts",
        "current-goal-all-software-observer-reviewed-queues",
        "all-software-observer-reviewed-queue-bridge.json"
      )
    : newestDirectoryWithFile(
        join(process.cwd(), "artifacts", "current-goal-all-software-observer-reviewed-queues"),
        "all-software-observer-reviewed-queue-bridge.json"
      ));
const gate = loadOptional(integratedGatePath);
const teacherTrial = loadOptional(teacherTrialPath);
if (!gate) throw new Error("Missing integrated evidence gate. Run create-current-goal-integrated-evidence-gate.mjs first.");
if (!teacherTrial) throw new Error("Missing teacher trial workbench. Run create-current-goal-teacher-trial-workbench.mjs first.");
const teacherTrialPreflight = loadOptional(teacherTrialPreflightPath);
const teacherTrialIntakeRouter = loadOptional(teacherTrialIntakeRouterPath);
const shortestTeacherEvidencePack = loadOptional(shortestTeacherEvidencePackPath);
const shortestTeacherEvidenceReceiptValidation = loadOptional(shortestTeacherEvidenceReceiptValidationPath);
const realLocalTrialPackage = loadOptional(realLocalTrialPackagePath);
const finalReviewIndex = loadOptional(finalReviewIndexPath);
const finalConvergenceReadinessGate = loadOptional(finalConvergenceReadinessGatePath);
const finalTeacherAcceptanceReviewPack = loadOptional(finalTeacherAcceptanceReviewPackPath);
const physicalWorldSpatialGroundingPack = loadOptional(physicalWorldSpatialGroundingPackPath);
const proofGapTeacherQueue = loadOptional(proofGapTeacherQueuePath);
const nextProofGapSummary = proofGapTeacherQueue?.nextProofGapSummary || {};
const proofGapEvidencePrefill = loadOptional(proofGapEvidencePrefillPath);
const nextProofGapEvidencePrefillSummary = proofGapEvidencePrefill?.nextProofGapEvidencePrefillSummary || {};
const proofGapTeacherQueueReceiptBuilder = loadOptional(proofGapTeacherQueueReceiptBuilderPath);
const proofGapNextFocusedReceiptBuilder = loadOptional(proofGapNextFocusedReceiptBuilderPath);
const proofGapTeacherQueueReceiptValidation = loadOptional(proofGapTeacherQueueReceiptValidationPath);
const proofGapReceiptIntakeRouter = loadOptional(proofGapReceiptIntakeRouterPath);
const allSoftwareObserverBootstrap = loadOptional(allSoftwareObserverBootstrapPath);
const allSoftwareObserverBootstrapDir = allSoftwareObserverBootstrapPath ? dirname(allSoftwareObserverBootstrapPath) : "";
const allSoftwareObserverBootstrapReadmePath = allSoftwareObserverBootstrapDir
  ? join(allSoftwareObserverBootstrapDir, "ALL_SOFTWARE_OBSERVER_START_HERE.md")
  : "";
const allSoftwareObserverBootstrapReceiptPath = allSoftwareObserverBootstrapDir
  ? join(allSoftwareObserverBootstrapDir, "all-software-observer-bootstrap-receipt.json")
  : "";
const allSoftwareObserverInventoryProbeOutputPath = allSoftwareObserverBootstrapDir
  ? join(allSoftwareObserverBootstrapDir, "software-observer-inventory.json")
  : "";
const allSoftwareLogSourceDiscoveryLedgerPath =
  argValue("--all-software-log-source-discovery-ledger") ||
  argValue("--log-source-discovery-ledger") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-log-source-discovery-ledgers"),
    "all-software-log-source-discovery-ledger.json"
  );
const allSoftwareCoverageEnrollmentLedgerPath =
  argValue("--all-software-coverage-enrollment-ledger") ||
  argValue("--coverage-enrollment-ledger") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-ledgers"),
    "all-software-coverage-enrollment-ledger.json"
  );
const allSoftwareCoverageEnrollmentFollowUpPlanPath =
  argValue("--all-software-coverage-enrollment-follow-up-plan") ||
  argValue("--coverage-enrollment-follow-up-plan") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-plans"),
    "all-software-coverage-enrollment-follow-up-plan.json"
  );
const allSoftwareCoverageEnrollmentFollowUpReceiptBuilderPath =
  argValue("--all-software-coverage-enrollment-follow-up-receipt-builder") ||
  argValue("--coverage-enrollment-follow-up-receipt-builder") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-receipt-builders"),
    "all-software-coverage-enrollment-follow-up-receipt-builder.json"
  );
const allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderPath =
  argValue("--all-software-coverage-enrollment-follow-up-small-batch-receipt-builder") ||
  argValue("--coverage-enrollment-follow-up-small-batch-receipt-builder") ||
  newestDirectoryWithFile(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-all-software-coverage-enrollment-follow-up-small-batch-receipt-builders"
    ),
    "all-software-coverage-enrollment-follow-up-receipt-builder.json"
  );
const allSoftwareCoverageEnrollmentFollowUpBatchIndexPath =
  argValue("--all-software-coverage-enrollment-follow-up-batch-index") ||
  argValue("--all-software-batch-index") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-batch-indexes"),
    "all-software-coverage-enrollment-follow-up-batch-index.json"
  );
const allSoftwareCoverageEnrollmentFollowUpReceiptValidationPath =
  argValue("--all-software-coverage-enrollment-follow-up-receipt-validation") ||
  argValue("--coverage-enrollment-follow-up-receipt-validation") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-receipt-validations"),
    "all-software-coverage-enrollment-follow-up-receipt-validation.json"
  );
const allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationPath =
  argValue("--all-software-coverage-enrollment-follow-up-small-batch-receipt-validation") ||
  argValue("--coverage-enrollment-follow-up-small-batch-receipt-validation") ||
  newestDirectoryWithFile(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-all-software-coverage-enrollment-follow-up-small-batch-receipt-validations"
    ),
    "all-software-coverage-enrollment-follow-up-receipt-validation.json"
  );
const allSoftwareCoverageEnrollmentFollowUpHandoffQueuePath =
  argValue("--all-software-coverage-enrollment-follow-up-handoff-queue") ||
  argValue("--coverage-enrollment-follow-up-handoff-queue") ||
  newestDirectoryWithFile(
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-handoff-queues"),
    "all-software-coverage-enrollment-follow-up-handoff-queue.json"
  );
const allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueuePath =
  argValue("--all-software-coverage-enrollment-follow-up-small-batch-handoff-queue") ||
  argValue("--coverage-enrollment-follow-up-small-batch-handoff-queue") ||
  newestDirectoryWithFile(
    join(
      process.cwd(),
      "artifacts",
      "current-goal-all-software-coverage-enrollment-follow-up-small-batch-handoff-queues"
    ),
    "all-software-coverage-enrollment-follow-up-handoff-queue.json"
  );
const allSoftwareObserverInventoryProbeOutput = loadOptional(allSoftwareObserverInventoryProbeOutputPath);
const allSoftwareLogSourceDiscoveryLedger = loadOptional(allSoftwareLogSourceDiscoveryLedgerPath);
const allSoftwareCoverageEnrollmentLedger = loadOptional(allSoftwareCoverageEnrollmentLedgerPath);
const allSoftwareCoverageEnrollmentFollowUpPlan = loadOptional(allSoftwareCoverageEnrollmentFollowUpPlanPath);
const allSoftwareCoverageEnrollmentFollowUpReceiptBuilder = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpReceiptBuilderPath
);
const allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderPath
);
const allSoftwareCoverageEnrollmentFollowUpBatchIndex = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpBatchIndexPath
);
const allSoftwareCoverageEnrollmentFollowUpReceiptValidation = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpReceiptValidationPath
);
const allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationPath
);
const allSoftwareCoverageEnrollmentFollowUpHandoffQueue = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpHandoffQueuePath
);
const allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue = loadOptional(
  allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueuePath
);
const teachExecuteReviewedObservation = loadOptional(teachExecuteReviewedObservationPath);
const allSoftwareObserverInventoryReviewBuilder = loadOptional(allSoftwareObserverInventoryReviewBuilderPath);
const allSoftwareObserverInventoryBatchReviewBuilder = loadOptional(allSoftwareObserverInventoryBatchReviewBuilderPath);
const nextTeacherConfirmationCockpit = loadOptional(nextTeacherConfirmationCockpitPath);
const nextTeacherConfirmationCockpitReceiptValidation = loadOptional(
  nextTeacherConfirmationCockpitReceiptValidationPath
);
const allSoftwareObserverReviewedQueueBridge = loadOptional(allSoftwareObserverReviewedQueueBridgePath);
const teachExecuteReviewedObservationDir = teachExecuteReviewedObservationPath
  ? dirname(teachExecuteReviewedObservationPath)
  : "";
const teachExecuteReviewedObservationReadmePath = teachExecuteReviewedObservationDir
  ? join(teachExecuteReviewedObservationDir, "TEACH_EXECUTE_REVIEWED_OBSERVATION_START_HERE.md")
  : "";
const teachExecuteReviewedObservationReceiptPath = teachExecuteReviewedObservationDir
  ? join(teachExecuteReviewedObservationDir, "teach-execute-reviewed-observation-receipt.json")
  : "";
const proofGapReceiptValidationHasManualQueue =
  proofGapTeacherQueueReceiptValidation?.ok === true &&
  (proofGapTeacherQueueReceiptValidation?.counts?.readyRows || 0) > 0 &&
  (proofGapTeacherQueueReceiptValidation?.counts?.nextReviewQueue || 0) > 0;

const newestLowTokenPath = newestDirectoryWithFile(
  join(process.cwd(), "artifacts", "current-goal-all-software-low-token-learning-handoffs"),
  "current-goal-all-software-low-token-learning-handoff.json"
);
const newestSpatialPath = newestDirectoryWithFile(
  join(process.cwd(), "artifacts", "current-goal-teacher-spatial-drawing-handoffs"),
  "current-goal-teacher-spatial-drawing-handoff.json"
);
const newestMethodPath = newestDirectoryWithFile(
  join(process.cwd(), "artifacts", "current-goal-teacher-method-adaptation-handoffs"),
  "current-goal-teacher-method-adaptation-handoff.json"
);
const lowTokenPath = argValue("--low-token-handoff") || newestLowTokenPath || gate.paths?.lowTokenHandoff || "";
const spatialPath = argValue("--spatial-handoff") || newestSpatialPath || gate.paths?.teacherSpatialDrawingHandoff || "";
const methodPath = argValue("--teacher-method-handoff") || newestMethodPath || gate.paths?.teacherMethodAdaptationHandoff || "";
const lowToken = loadOptional(lowTokenPath);
const spatial = loadOptional(spatialPath);
const method = loadOptional(methodPath);
const spatialCapability = spatial?.spatialCapabilitySummary || {};
const spatialSampleValidation = spatialCapability.sampleValidation || {};
const spatialExecutionBoundary = spatialCapability.executionBoundary || {};

const launchpadPath = join(outputRoot, "current-goal-start-here.json");
const htmlPath = join(outputRoot, "current-goal-start-here.html");
const readmePath = join(outputRoot, "CURRENT_GOAL_START_HERE.md");
const createNextTeacherConfirmationCockpitCommand = commandText(
  "create-current-goal-next-teacher-confirmation-cockpit.mjs",
  [
    "--launchpad",
    launchpadPath,
    "--output-dir",
    join("artifacts", "current-goal-next-teacher-confirmation-cockpits")
  ]
);
const validateNextTeacherConfirmationCockpitReceiptCommand =
  nextTeacherConfirmationCockpit?.nextValidationCommand ||
  commandText("validate-current-goal-next-teacher-confirmation-cockpit-receipt.mjs", [
    "--cockpit",
    nextTeacherConfirmationCockpitPath || "<current-goal-next-teacher-confirmation-cockpit.json>",
    "--receipt",
    "<teacher-filled-current-goal-next-teacher-confirmation-cockpit-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-next-teacher-confirmation-cockpit-receipt-validations")
  ]);
const validateTrialReceiptCommand =
  teacherTrial.receiptValidationCommandTemplate ||
  commandText("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
    "--workbench",
    teacherTrialPath,
    "--receipt",
    "<teacher-filled-trial-workbench-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-teacher-trial-workbench-receipt-validations")
  ]);
const regeneratePreflightCommand = commandText("create-current-goal-teacher-trial-preflight.mjs", [
  "--launchpad",
  launchpadPath,
  "--receipt",
  "<teacher-filled-trial-workbench-receipt.json>",
  "--output-dir",
  join("artifacts", "current-goal-teacher-trial-preflights")
]);
const routeTeacherTrialReceiptCommand = commandText("create-current-goal-teacher-trial-intake-router.mjs", [
  "--launchpad",
  launchpadPath,
  "--receipt",
  "<teacher-filled-trial-workbench-receipt.json>",
  "--output-dir",
  join("artifacts", "current-goal-teacher-trial-intake-routers")
]);
const buildProofGapValidationHandoffCommand = proofGapReceiptValidationHasManualQueue
  ? commandText("create-original-goal-review-handoff-item-command-builder.mjs", [
      "--queue",
      proofGapTeacherQueueReceiptValidationPath,
      "--output-dir",
      join("artifacts", "original-goal-review-handoff-item-command-builders")
    ])
  : "";
const routeProofGapTeacherReceiptCommand = commandText("create-original-goal-proof-gap-receipt-intake-router.mjs", [
  "--queue",
  proofGapTeacherQueuePath || "<original-goal-proof-gap-teacher-queue.json>",
  "--receipt",
  "<teacher-filled-original-goal-proof-gap-teacher-queue-receipt.json>",
  "--output-dir",
  join("artifacts", "original-goal-proof-gap-receipt-intake-routers")
]);
const createNextProofGapFocusedReceiptBuilderCommand = commandText(
  "create-original-goal-next-proof-gap-focused-receipt-builder.mjs",
  [
    "--queue",
    proofGapTeacherQueuePath || "<original-goal-proof-gap-teacher-queue.json>",
    "--prefill",
    proofGapEvidencePrefillPath || "<original-goal-proof-gap-evidence-prefill.json>",
    "--route-id",
    nextProofGapSummary.routeId || "<next-proof-gap-route-id>",
    "--output-dir",
    join("artifacts", "original-goal-next-proof-gap-focused-receipt-builders")
  ]
);
const createAllSoftwareObserverBootstrapCommand = commandText("create-all-software-observer-bootstrap.mjs", [
  "--goal",
  "Bootstrap low-token learning from all software on this computer without continuous recording.",
  "--no-initialize-watch",
  "--output-dir",
  join("artifacts", "current-goal-all-software-observer-bootstraps")
]);
const createAllSoftwareLogSourceDiscoveryLedgerCommand = commandText("create-all-software-log-source-discovery-ledger.mjs", [
  "--inventory",
  allSoftwareObserverInventoryProbeOutputPath || "<software-observer-inventory.json>",
  "--max-rows",
  String(allSoftwareObserverInventoryProbeOutput?.softwareCandidates?.length || 188),
  "--output-dir",
  join("artifacts", "current-goal-all-software-log-source-discovery-ledgers")
]);
const createAllSoftwareCoverageEnrollmentLedgerCommand = commandText("create-all-software-coverage-enrollment-ledger.mjs", [
  "--inventory",
  allSoftwareObserverInventoryProbeOutputPath || "<software-observer-inventory.json>",
  "--log-source-discovery-ledger",
  allSoftwareLogSourceDiscoveryLedgerPath || "<all-software-log-source-discovery-ledger.json>",
  "--max-rows",
  String(allSoftwareObserverInventoryProbeOutput?.softwareCandidates?.length || 188),
  "--output-dir",
  join("artifacts", "current-goal-all-software-coverage-enrollment-ledgers")
]);
const createAllSoftwareCoverageEnrollmentFollowUpPlanCommand = commandText(
  "create-all-software-coverage-enrollment-follow-up-plan.mjs",
  [
    "--ledger",
    allSoftwareCoverageEnrollmentLedgerPath || "<all-software-coverage-enrollment-ledger.json>",
    "--max-items",
    String(allSoftwareCoverageEnrollmentLedger?.counts?.ledgerRows || allSoftwareObserverInventoryProbeOutput?.softwareCandidates?.length || 188),
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-plans")
  ]
);
const createAllSoftwareCoverageEnrollmentFollowUpReceiptBuilderCommand = commandText(
  "create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath || "<all-software-coverage-enrollment-follow-up-plan.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-receipt-builders")
  ]
);
const createAllSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderCommand = commandText(
  "create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath || "<all-software-coverage-enrollment-follow-up-plan.json>",
    "--max-rows",
    "12",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-small-batch-receipt-builders")
  ]
);
const createAllSoftwareCoverageEnrollmentFollowUpBatchIndexCommand = commandText(
  "create-all-software-coverage-enrollment-follow-up-batch-index.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath || "<all-software-coverage-enrollment-follow-up-plan.json>",
    "--batch-size",
    String(allSoftwareCoverageEnrollmentFollowUpBatchIndex?.batchSize || 12),
    "--known-generated-rows",
    String(
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.knownGeneratedRows ||
        ((allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.reviewBatchScope?.offsetRows || 0) +
          (allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.reviewBatchScope?.includedRows || 0)) ||
        0
    ),
    "--current-offset",
    String(allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.reviewBatchScope?.offsetRows || 0),
    "--latest-builder",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderPath || "<small-batch-receipt-builder.json>",
    "--latest-validation",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationPath || "<small-batch-receipt-validation.json>",
    "--latest-handoff-queue",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueuePath || "<small-batch-handoff-queue.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-batch-indexes")
  ]
);
const validateAllSoftwareCoverageEnrollmentFollowUpReceiptCommand = commandText(
  "validate-all-software-coverage-enrollment-follow-up-receipt.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath || "<all-software-coverage-enrollment-follow-up-plan.json>",
    "--receipt",
    "<teacher-filled-coverage-enrollment-follow-up-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-receipt-validations")
  ]
);
const validateAllSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptCommand = commandText(
  "validate-all-software-coverage-enrollment-follow-up-receipt.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath || "<all-software-coverage-enrollment-follow-up-plan.json>",
    "--receipt",
    "<teacher-filled-small-batch-coverage-enrollment-follow-up-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-small-batch-receipt-validations")
  ]
);
const createAllSoftwareCoverageEnrollmentFollowUpHandoffQueueCommand = commandText(
  "create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs",
  [
    "--validation",
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationPath ||
      "<all-software-coverage-enrollment-follow-up-receipt-validation.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-handoff-queues")
  ]
);
const createAllSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueCommand = commandText(
  "create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs",
  [
    "--validation",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationPath ||
      "<all-software-coverage-enrollment-follow-up-small-batch-receipt-validation.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-coverage-enrollment-follow-up-small-batch-handoff-queues")
  ]
);
const runAllSoftwareReadOnlyInventoryProbeCommand =
  allSoftwareObserverBootstrap?.nextCommands?.collectInventoryProbe || "";
const startTeachExecuteReviewedObservationCommand = commandText("start-teach-execute-reviewed-observation.mjs", [
  "--goal",
  "Run teacher-confirmed read-only all-software observation after excluding private software.",
  "--software",
  "all local software",
  "--teacher-confirmation",
  "<teacher-confirmed-read-only-observation-and-private-app-exclusion-text>",
  "--exclude",
  "<private-or-out-of-scope-software-name>",
  "--priority-software",
  "<teacher-priority-software-name>",
  "--max-processes",
  "80",
  "--max-installed",
  "160",
  "--max-log-files-per-candidate",
  "3",
  "--max-candidates",
  "24",
  "--max-files-per-candidate",
  "3",
  "--max-watch-items",
  "8",
  "--max-logs-per-item",
  "2",
  "--max-tail-lines",
  "40",
  "--max-tail-bytes",
  "32768",
  "--output-dir",
  join("artifacts", "current-goal-teach-execute-reviewed-observations")
]);
const createAllSoftwareInventoryReviewBuilderCommand = commandText(
  "create-all-software-observer-inventory-review-builder.mjs",
  [
    "--inventory",
    allSoftwareObserverInventoryProbeOutputPath || "<software-observer-inventory.json>",
    "--bootstrap",
    allSoftwareObserverBootstrapPath || "<all-software-observer-bootstrap.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-observer-inventory-review-builders")
  ]
);
const createAllSoftwareInventoryBatchReviewBuilderCommand = commandText(
  "create-all-software-observer-inventory-batch-review-builder.mjs",
  [
    "--inventory",
    allSoftwareObserverInventoryProbeOutputPath || "<software-observer-inventory.json>",
    "--batch-size",
    "12",
    "--output-dir",
    join("artifacts", "current-goal-all-software-observer-inventory-batch-review-builders")
  ]
);
const createAllSoftwareReviewedQueueFromReceiptCommand = commandText(
  "create-all-software-observer-reviewed-queue-from-receipt.mjs",
  [
    "--inventory",
    allSoftwareObserverInventoryProbeOutputPath || "<software-observer-inventory.json>",
    "--receipt",
    "<teacher-filled-all-software-observer-inventory-review-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-all-software-observer-reviewed-queues")
  ]
);
const createRealLocalTrialPackageCommand = commandText("create-current-goal-real-local-trial-package.mjs", [
  "--output-dir",
  join("artifacts", "current-goal-real-local-trial-packages")
]);
const createFinalTeacherAcceptanceReviewPackCommand = commandText(
  "create-current-goal-final-teacher-acceptance-review-pack.mjs",
  [
    "--final-convergence-readiness-gate",
    finalConvergenceReadinessGatePath || "<current-goal-final-convergence-readiness-gate.json>",
    "--output-dir",
    join("artifacts", "current-goal-final-teacher-acceptance-review-packs")
  ]
);
const validateFinalTeacherAcceptanceReceiptCommand = commandText(
  "validate-current-goal-final-teacher-acceptance-receipt.mjs",
  [
    "--final-convergence-readiness-gate",
    finalConvergenceReadinessGatePath || "<current-goal-final-convergence-readiness-gate.json>",
    "--receipt",
    "<teacher-filled-current-goal-final-acceptance-receipt.json>",
    "--output-dir",
    join("artifacts", "current-goal-final-teacher-acceptance-receipt-validations")
  ]
);
const createPhysicalWorldSpatialGroundingPackCommand = commandText(
  "create-physical-world-spatial-grounding-pack.mjs",
  [
    "--source-root",
    "D:\\AI对物理世界的理解\\UnityPhysicalWorldUnderstanding",
    "--output-dir",
    join("artifacts", "physical-world-spatial-grounding-packs")
  ]
);
const lowTokenRouteValidationCommand = lowToken?.teacherRouteSelectionActionPack?.routeReceiptValidationCommandTemplate || "";
const overlayPacketValidationCommand = commandById(spatial, "validate_teacher_exported_overlay_packet");
const overlayPacketRuleDraftBridgeCommand = commandText(
  "create-transparent-sketch-overlay-packet-rule-draft-bridge.mjs",
  [
    "--overlay-packet",
    "<teacher-exported-transparent-sketch-overlay-packet.json>",
    "--rollback-point",
    "<retained-rollback-point>",
    "--teacher-reviewed-overlay-packet",
    "--teacher-reviewed-spatial-intent",
    "--output-dir",
    join("artifacts", "transparent-sketch-overlay-packet-rule-draft-bridges")
  ]
);
const methodContractCommand = commandById(method, "create_teacher_method_execution_learning_contract_after_review");
const executionApprovalCommand = commandText("create-spatial-to-software-execution-gate-package.mjs", [
  "--refresh-root",
  join("artifacts", "original-goal-current-status-refreshes"),
  "--spatial-validation",
  "<teacher-reviewed-spatial-intent-receipt-validation.json>",
  "--rollback-point",
  "<retained-rollback-point>",
  "--software",
  "<teacher-selected-software>",
  "--physical-world-spatial-grounding-pack",
  physicalWorldSpatialGroundingPackPath || "<physical-world-spatial-grounding-pack.json>",
  "--output-dir",
  join("artifacts", "current-goal-spatial-to-software-execution-gate-packages")
]);
const createShortestTeacherEvidencePackCommand = commandText("create-current-goal-shortest-teacher-evidence-pack.mjs", [
  "--launchpad",
  launchpadPath,
  "--output-dir",
  join("artifacts", "current-goal-shortest-teacher-evidence-packs")
]);
const validateShortestTeacherEvidenceReceiptCommand = commandText(
  "validate-current-goal-shortest-teacher-evidence-receipt.mjs",
  [
    "--pack",
    shortestTeacherEvidencePackPath || "<current-goal-shortest-teacher-evidence-pack.json>",
    "--receipt",
    "<teacher-filled-shortest-evidence-receipt.json>",
    "--validate-derived-trial",
    "--output-dir",
    join("artifacts", "current-goal-shortest-teacher-evidence-receipt-validations")
  ]
);

const launchpad = {
  ok: true,
  format: "transparent_ai_current_goal_start_here_launchpad_v1",
  createdAt: new Date().toISOString(),
  status: "stable_start_here_ready_review_only_goal_not_complete",
  statusSummary: {
    integratedGateStatus: gate.status || "",
    teacherTrialWorkbenchStatus: teacherTrial.status || "",
    lowTokenStatus: lowToken?.status || "",
    allSoftwareObserverBootstrapMode: allSoftwareObserverBootstrap?.mode || "missing_or_not_generated_yet",
    allSoftwareObserverBootstrapQueueReady: Boolean(allSoftwareObserverBootstrap?.queue?.queuePath),
    allSoftwareObserverBootstrapWatchBaselineReady: Boolean(allSoftwareObserverBootstrap?.watchBaseline?.cyclePath),
    allSoftwareObserverBootstrapScreenshotPolicy:
      allSoftwareObserverBootstrap?.teacherReviewTemplate
        ? "only_after_log_event_file_delta_or_teacher_marker_is_ambiguous"
        : "missing_or_not_generated_yet",
    allSoftwareObserverBootstrapContinuousRecording:
      allSoftwareObserverBootstrap?.locks?.fullContinuousRecording === true,
    allSoftwareObserverBootstrapNativeUniversalExecution:
      allSoftwareObserverBootstrap?.locks?.nativeUniversalExecution === true,
    allSoftwareObserverInventoryProbeOutputReady: Boolean(allSoftwareObserverInventoryProbeOutput),
    allSoftwareObserverInventoryCandidateCount:
      Array.isArray(allSoftwareObserverInventoryProbeOutput?.softwareCandidates)
        ? allSoftwareObserverInventoryProbeOutput.softwareCandidates.length
        : null,
    allSoftwareObserverInventoryProbeSource:
      allSoftwareObserverInventoryProbeOutput?.source || "missing_or_not_generated_yet",
    allSoftwareLogSourceDiscoveryLedgerStatus:
      allSoftwareLogSourceDiscoveryLedger?.status || "missing_or_not_generated_yet",
    allSoftwareLogSourceDiscoveryLedgerRows:
      allSoftwareLogSourceDiscoveryLedger?.counts?.ledgerRows ?? null,
    allSoftwareLogSourceDiscoveryRowsWithSourceRoute:
      allSoftwareLogSourceDiscoveryLedger?.allRowsHaveSourceRoute === true
        ? allSoftwareLogSourceDiscoveryLedger?.counts?.ledgerRows ?? null
        : null,
    allSoftwareLogSourceDiscoveryNeedsTeacherRows:
      allSoftwareLogSourceDiscoveryLedger?.counts?.needsTeacherLogSourceOrExclusion ?? null,
    allSoftwareLogSourceDiscoveryLogContentsRead:
      allSoftwareLogSourceDiscoveryLedger?.locks?.logContentsRead === true ? true : false,
    allSoftwareCoverageEnrollmentRows:
      allSoftwareCoverageEnrollmentLedger?.counts?.ledgerRows ?? null,
    allSoftwareCoverageEnrollmentRowsWithLogSourceRoute:
      allSoftwareCoverageEnrollmentLedger?.counts?.rowsWithLogSourceRoute ?? null,
    allSoftwareCoverageEnrollmentWaitingForWatchEvidence:
      allSoftwareCoverageEnrollmentLedger?.counts?.enrolledWaitingForWatchEvidence ?? null,
    allSoftwareCoverageEnrollmentComplete:
      allSoftwareCoverageEnrollmentLedger?.allSoftwareCoverageComplete === true,
    allSoftwareCoverageEnrollmentFollowUpItems:
      allSoftwareCoverageEnrollmentFollowUpPlan?.counts?.followUpItems ?? null,
    allSoftwareCoverageEnrollmentFollowUpRouteCounts:
      allSoftwareCoverageEnrollmentFollowUpPlan?.routeCounts || {},
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderStatus:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderRows:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.counts?.followUpRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderHtmlReady:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.html
        ? existsSync(allSoftwareCoverageEnrollmentFollowUpReceiptBuilder.paths.html)
        : false,
    allSoftwareCoverageEnrollmentFollowUpReceiptTemplateReady:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.receiptTemplate
        ? existsSync(allSoftwareCoverageEnrollmentFollowUpReceiptBuilder.paths.receiptTemplate)
        : false,
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderGoalComplete:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.locks?.goalComplete === true,
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderLogContentsRead:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.locks?.logContentsRead === true,
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderScreenshotsCaptured:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.locks?.screenshotsCaptured === true,
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderSoftwareActionsExecuted:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.locks?.softwareActionsExecuted === true,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderStatus:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.counts?.followUpRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderTotalRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.counts?.totalFollowUpRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderOmittedRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.counts?.omittedFollowUpRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexStatus:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpBatchIndexTotalRows:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.totalFollowUpRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexBatchSize:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.batchSize ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexTotalBatches:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.totalBatches ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexKnownGeneratedRows:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.knownGeneratedRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexRemainingRows:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.remainingRowsAfterKnownBatches ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexNextOffset:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.nextRecommendedBatch?.offsetRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexNextRange:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.nextRecommendedBatch?.rowRange || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpBatchIndexHtmlReady:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.paths?.html
        ? existsSync(allSoftwareCoverageEnrollmentFollowUpBatchIndex.paths.html)
        : false,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexGoalComplete:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.locks?.goalComplete === true,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderHtmlReady:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.html
        ? existsSync(allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder.paths.html)
        : false,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptTemplateReady:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.receiptTemplate
        ? existsSync(allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder.paths.receiptTemplate)
        : false,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderGoalComplete:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.locks?.goalComplete === true,
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationStatus:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationDecision:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.validationDecision || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationReadyRows:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.readyRowCount ?? null,
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationWaitingRows:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.waitingRowCount ?? null,
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationForbiddenDecisionUsed:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.forbiddenDecisionUsed === true,
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationNextBatchCommands:
      Array.isArray(allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.nextBatchReviewCommands)
        ? allSoftwareCoverageEnrollmentFollowUpReceiptValidation.nextBatchReviewCommands.length
        : null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationStatus:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationDecision:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.validationDecision ||
      "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationReadyRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.readyRowCount ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationWaitingRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.waitingRowCount ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationOmittedRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.omittedRowCount ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationNextBatchCommands:
      Array.isArray(allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.nextBatchReviewCommands)
        ? allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation.nextBatchReviewCommands.length
        : null,
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueStatus:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueDecision:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.queueDecision || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueItems:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.counts?.queueItems ?? null,
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueReadyItems:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.counts?.readyItems ?? null,
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueUnsafeItems:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.counts?.unsafeItems ?? null,
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueBatchRunnerInvoked:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.locks?.batchRunnerInvoked === true,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueStatus:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.status || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueDecision:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.queueDecision || "missing_or_not_generated_yet",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueItems:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.counts?.queueItems ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueReadyItems:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.counts?.readyItems ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueOmittedRows:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.counts?.omittedFollowUpRows ?? null,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueBatchRunnerInvoked:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.locks?.batchRunnerInvoked === true,
    allSoftwareObserverInventoryReviewBuilderStatus:
      allSoftwareObserverInventoryReviewBuilder?.status || "missing_or_not_generated_yet",
    allSoftwareObserverInventoryReviewBuilderRows:
      allSoftwareObserverInventoryReviewBuilder?.counts?.reviewRows ?? null,
    allSoftwareObserverInventoryReviewBuilderRowsWithLogMetadata:
      allSoftwareObserverInventoryReviewBuilder?.counts?.rowsWithLogMetadata ?? null,
    allSoftwareObserverInventoryReviewBuilderHtmlReady:
      allSoftwareObserverInventoryReviewBuilder?.paths?.html
        ? existsSync(allSoftwareObserverInventoryReviewBuilder.paths.html)
        : false,
    allSoftwareObserverInventoryBatchReviewBuilderStatus:
      allSoftwareObserverInventoryBatchReviewBuilder?.status || "missing_or_not_generated_yet",
    allSoftwareObserverInventoryBatchReviewBuilderRows:
      allSoftwareObserverInventoryBatchReviewBuilder?.counts?.reviewRows ?? null,
    allSoftwareObserverInventoryBatchReviewBuilderRowsWithLogMetadata:
      allSoftwareObserverInventoryBatchReviewBuilder?.counts?.rowsWithLogMetadata ?? null,
    allSoftwareObserverInventoryBatchReviewBuilderHtmlReady:
      allSoftwareObserverInventoryBatchReviewBuilder?.paths?.html
        ? existsSync(allSoftwareObserverInventoryBatchReviewBuilder.paths.html)
        : false,
    nextTeacherConfirmationCockpitStatus:
      nextTeacherConfirmationCockpit?.status || "missing_or_not_generated_yet",
    nextTeacherConfirmationCockpitHtmlReady:
      nextTeacherConfirmationCockpit?.paths?.html
        ? existsSync(nextTeacherConfirmationCockpit.paths.html)
        : false,
    nextTeacherConfirmationCockpitCardCount:
      nextTeacherConfirmationCockpit?.counts?.reviewCards ?? null,
    nextTeacherConfirmationCockpitReceiptTemplateReady:
      nextTeacherConfirmationCockpit?.paths?.receiptTemplate
        ? existsSync(nextTeacherConfirmationCockpit.paths.receiptTemplate)
        : false,
    nextTeacherConfirmationCockpitReceiptValidationStatus:
      nextTeacherConfirmationCockpitReceiptValidation?.status || "missing_or_not_generated_yet",
    nextTeacherConfirmationCockpitReceiptValidationReadyRows:
      nextTeacherConfirmationCockpitReceiptValidation?.counts?.readyRows ?? null,
    nextTeacherConfirmationCockpitReceiptValidationNextSafeCommands:
      Array.isArray(nextTeacherConfirmationCockpitReceiptValidation?.nextSafeCommands)
        ? nextTeacherConfirmationCockpitReceiptValidation.nextSafeCommands.length
        : null,
    allSoftwareObserverReviewedQueueBridgeStatus:
      allSoftwareObserverReviewedQueueBridge?.status || "missing_or_not_generated_yet",
    allSoftwareObserverReviewedQueueBridgeApprovedRows:
      allSoftwareObserverReviewedQueueBridge?.counts?.approvedRows ?? null,
    allSoftwareObserverReviewedQueueBridgeExcludedRows:
      allSoftwareObserverReviewedQueueBridge?.counts?.excludedRows ?? null,
    allSoftwareObserverReviewedQueueBridgeQueuedCount:
      allSoftwareObserverReviewedQueueBridge?.counts?.queuedCount ?? null,
    allSoftwareObserverReviewedQueueBridgeDidCreateQueue:
      Boolean(allSoftwareObserverReviewedQueueBridge?.queuePath),
    allSoftwareObserverReviewedQueueBridgeReadLogContents:
      allSoftwareObserverReviewedQueueBridge?.locks?.bridgeDoesNotReadLogContents === true ? false : null,
    allSoftwareObserverReviewedQueueBridgeScreenshotsCaptured:
      allSoftwareObserverReviewedQueueBridge?.locks?.bridgeDoesNotCaptureScreenshots === true ? false : null,
    allSoftwareObserverReviewedQueueBridgeSoftwareActionsExecuted:
      allSoftwareObserverReviewedQueueBridge?.locks?.bridgeDoesNotExecuteTargetSoftware === true ? false : null,
    teachExecuteReviewedObservationStatus:
      teachExecuteReviewedObservation?.status || "missing_or_not_generated_yet",
    teachExecuteReviewedObservationDidRunReadOnlyProbe:
      teachExecuteReviewedObservation?.counts ? true : teachExecuteReviewedObservation?.didRunReadOnlyProbe === true,
    teachExecuteReviewedObservationDidCreateQueue:
      Boolean(teachExecuteReviewedObservation?.evidence?.queuePath),
    teachExecuteReviewedObservationDidInitializeWatchBaseline:
      Boolean(teachExecuteReviewedObservation?.evidence?.watchCyclePath),
    teachExecuteReviewedObservationRawCandidateCount:
      teachExecuteReviewedObservation?.counts?.rawCandidateCount ?? null,
    teachExecuteReviewedObservationReviewedCandidateCount:
      teachExecuteReviewedObservation?.counts?.reviewedCandidateCount ?? null,
    teachExecuteReviewedObservationExcludedCandidateCount:
      teachExecuteReviewedObservation?.counts?.excludedCandidateCount ?? null,
    teachExecuteReviewedObservationQueuedCount:
      teachExecuteReviewedObservation?.counts?.queuedCount ?? null,
    teachExecuteReviewedObservationScreenshotsCaptured:
      teachExecuteReviewedObservation?.lowTokenPolicy?.screenshotsCaptured === true ||
      teachExecuteReviewedObservation?.screenshotsCaptured === true,
    teachExecuteReviewedObservationSoftwareActionsExecuted:
      teachExecuteReviewedObservation?.locks?.softwareActionsExecuted === true,
    spatialStatus: spatial?.status || "",
    transparentOverlayAvailable: spatialCapability.transparentMaskAvailable === true,
    spatialBrowserOverlayAvailable: spatialCapability.browserOverlayAvailable === true,
    spatialWindowsTopMostOverlayAvailable: spatialCapability.windowsTopMostOverlayAvailable === true,
    spatialHas2DPositionEvidence: spatialSampleValidation.has2DPositionEvidence === true,
    spatialHasPerspectiveEvidence: spatialSampleValidation.hasPerspectiveEvidence === true,
    spatialHas3DDepthEvidence: spatialSampleValidation.has3DDepthEvidence === true,
    spatialHasDetailLogicContract: spatialSampleValidation.hasUniversalDetailLogicContract === true,
    spatialRequiresTeacherExportedPacket: spatialExecutionBoundary.requiresTeacherExportedPacket === true,
    spatialRequiresNumberedTargetConfirmation: spatialExecutionBoundary.requiresNumberedTargetConfirmation === true,
    spatialTargetSoftwareExecutedHere: spatialExecutionBoundary.targetSoftwareExecutedHere === true,
    spatialExecutionBoundary:
      spatialExecutionBoundary.targetSoftwareExecutedHere === true
        ? "unexpected_execution_claim"
        : "teacher_packet_spatial_receipt_depth_review_and_numbered_target_required_before_execution",
    teacherMethodStatus: method?.status || "",
    totalRequirements: gate.completionAudit?.totalRequirements ?? 0,
    implementationEvidenceReadyCount: gate.completionAudit?.implementationEvidenceReadyCount ?? 0,
    completionProvenCount: gate.completionAudit?.completionProvenCount ?? 0,
    teacherTrialPhaseCount: Array.isArray(teacherTrial.trialPhases) ? teacherTrial.trialPhases.length : 0,
    teacherTrialPreflightStatus: teacherTrialPreflight?.status || "missing_or_not_generated_yet",
    teacherTrialPreflightReadyForNextManualGate: teacherTrialPreflight?.readyForNextManualGate === true,
    teacherTrialPreflightBlockerCount: Array.isArray(teacherTrialPreflight?.blockers) ? teacherTrialPreflight.blockers.length : null,
    teacherTrialIntakeRouterStatus: teacherTrialIntakeRouter?.status || "missing_or_not_generated_yet",
    teacherTrialIntakeRouterReadyForNextManualCommand: teacherTrialIntakeRouter?.readyForNextManualCommand === true,
    teacherTrialIntakeRouterBlockerCount: Array.isArray(teacherTrialIntakeRouter?.blockers)
      ? teacherTrialIntakeRouter.blockers.length
      : null,
    shortestTeacherEvidencePackStatus: shortestTeacherEvidencePack?.status || "missing_or_not_generated_yet",
    shortestTeacherEvidenceStepCount: Array.isArray(shortestTeacherEvidencePack?.teacherSteps)
      ? shortestTeacherEvidencePack.teacherSteps.length
      : null,
    shortestTeacherEvidenceReceiptBuilderReady: Boolean(shortestTeacherEvidencePack?.paths?.receiptBuilderHtml),
    shortestTeacherEvidenceReceiptValidationStatus:
      shortestTeacherEvidenceReceiptValidation?.status || "missing_or_not_generated_yet",
    shortestTeacherEvidenceReceiptValidationReadyForTrial:
      shortestTeacherEvidenceReceiptValidation?.readyForTeacherTrialReceiptValidation === true,
    shortestTeacherEvidenceReceiptValidationReadyForNextManualCommand:
      shortestTeacherEvidenceReceiptValidation?.readyForNextManualCommand === true,
    shortestTeacherEvidenceReceiptValidationNextManualCommands:
      Array.isArray(shortestTeacherEvidenceReceiptValidation?.nextManualCommands)
        ? shortestTeacherEvidenceReceiptValidation.nextManualCommands.length
        : null,
    realLocalTrialPackageStatus: realLocalTrialPackage?.status || "missing_or_not_generated_yet",
    realLocalTrialPackageChecksPassed: realLocalTrialPackage?.checkSummary?.passed ?? null,
    realLocalTrialPackageChecksTotal: realLocalTrialPackage?.checkSummary?.total ?? null,
    realLocalTrialPackageSampleSoftware: realLocalTrialPackage?.realLocalSoftware?.software || "",
    finalReviewIndexStatus: finalReviewIndex?.status || "missing_or_not_generated_yet",
    finalReviewIndexReadyLanes: finalReviewIndex?.summary?.readyLanes ?? null,
    finalReviewIndexBlockedLanes: finalReviewIndex?.summary?.blockedLanes ?? null,
    finalConvergenceReadinessGateStatus: finalConvergenceReadinessGate?.status || "missing_or_not_generated_yet",
    finalConvergenceReviewEvidenceReadyLanes: finalConvergenceReadinessGate?.summary?.reviewEvidenceReadyLanes ?? null,
    finalConvergenceTotalLanes: finalConvergenceReadinessGate?.summary?.totalLanes ?? null,
    finalConvergenceCompletionReadyLanes: finalConvergenceReadinessGate?.summary?.completionReadyLanes ?? null,
    finalTeacherAcceptanceReviewPackStatus: finalTeacherAcceptanceReviewPack?.status || "missing_or_not_generated_yet",
    finalTeacherAcceptanceReviewPackReady:
      finalTeacherAcceptanceReviewPack?.readyForTeacherFinalAcceptanceReview === true,
    physicalWorldSpatialGroundingPackStatus: physicalWorldSpatialGroundingPack?.status || "missing_or_not_generated_yet",
    physicalWorldSpatialGroundingPresentRows: physicalWorldSpatialGroundingPack?.counts?.presentEvidenceRows ?? null,
    physicalWorldSpatialGroundingTotalRows: physicalWorldSpatialGroundingPack?.counts?.evidenceRows ?? null,
    proofGapTeacherQueueStatus: proofGapTeacherQueue?.status || "missing_or_not_generated_yet",
    proofGapTeacherQueueItems: proofGapTeacherQueue?.counts?.queueItems ?? null,
    nextProofGapStatus: nextProofGapSummary.status || "missing_or_not_generated_yet",
    nextProofGapPhase: nextProofGapSummary.phase || "",
    nextProofGapRequirementId: nextProofGapSummary.requirementId || "",
    nextProofGapRouteId: nextProofGapSummary.routeId || "",
    nextProofGapQuestion: nextProofGapSummary.teacherQuestion || "",
    nextProofGapReceiptValidationCommandReady: Boolean(nextProofGapSummary.receiptValidationCommandTemplate),
    proofGapEvidencePrefillStatus: proofGapEvidencePrefill?.status || "missing_or_not_generated_yet",
    proofGapEvidencePrefillRows: proofGapEvidencePrefill?.counts?.rows ?? null,
    proofGapEvidencePrefillRowsWithCandidateEvidence:
      proofGapEvidencePrefill?.counts?.rowsWithCandidateEvidence ?? null,
    proofGapTeacherQueueReceiptBuilderStatus:
      proofGapTeacherQueueReceiptBuilder?.status || "missing_or_not_generated_yet",
    proofGapTeacherQueueReceiptBuilderRows:
      proofGapTeacherQueueReceiptBuilder?.counts?.reviewRows ?? null,
    proofGapTeacherQueueReceiptBuilderRowsWithCandidatePrefill:
      proofGapTeacherQueueReceiptBuilder?.counts?.rowsWithCandidatePrefill ?? null,
    proofGapTeacherQueueReceiptBuilderHtmlReady:
      proofGapTeacherQueueReceiptBuilder?.paths?.html ? existsSync(proofGapTeacherQueueReceiptBuilder.paths.html) : false,
    nextProofGapFocusedReceiptBuilderStatus:
      proofGapNextFocusedReceiptBuilder?.status || "missing_or_not_generated_yet",
    nextProofGapFocusedReceiptBuilderHtmlReady:
      proofGapNextFocusedReceiptBuilder?.paths?.html ? existsSync(proofGapNextFocusedReceiptBuilder.paths.html) : false,
    nextProofGapFocusedReceiptBuilderRouteId:
      proofGapNextFocusedReceiptBuilder?.focusedRouteId || "",
    nextProofGapFocusedReceiptBuilderRequiresRollbackPoint:
      (proofGapNextFocusedReceiptBuilder?.counts?.rowsRequiringRetainedRollbackPoint || 0) > 0,
    proofGapTeacherQueueReceiptValidationStatus:
      proofGapTeacherQueueReceiptValidation?.status || "missing_or_not_generated_yet",
    proofGapTeacherQueueReceiptValidationReadyRows:
      proofGapTeacherQueueReceiptValidation?.counts?.readyRows ?? null,
    proofGapTeacherQueueReceiptValidationNextReviewQueue:
      proofGapTeacherQueueReceiptValidation?.counts?.nextReviewQueue ?? null,
    proofGapReceiptValidationHandoffBuilderReady: proofGapReceiptValidationHasManualQueue,
    proofGapReceiptIntakeRouterStatus:
      proofGapReceiptIntakeRouter?.status || "missing_or_not_generated_yet",
    proofGapReceiptIntakeRouterReadyForManualHandoffBuilder:
      proofGapReceiptIntakeRouter?.readyForManualHandoffBuilder === true,
    proofGapReceiptIntakeRouterBlockerCount:
      Array.isArray(proofGapReceiptIntakeRouter?.blockers) ? proofGapReceiptIntakeRouter.blockers.length : null,
    nextProofGapCandidateEvidencePath:
      nextProofGapEvidencePrefillSummary.candidateObservedEvidencePath || "",
    nextProofGapCandidateEvidenceExists:
      nextProofGapEvidencePrefillSummary.candidateEvidenceExists === true,
    nextProofGapStillNeedsTeacherConfirmation:
      Array.isArray(nextProofGapEvidencePrefillSummary.teacherStillMustConfirm)
        ? nextProofGapEvidencePrefillSummary.teacherStillMustConfirm.length
        : null,
    goalComplete: false
  },
  entryLinks: [
    entry(
      "next_teacher_confirmation_cockpit_html",
      "Next Teacher Confirmation Cockpit",
      nextTeacherConfirmationCockpit?.paths?.html || "",
      "One review-only page that orders the current next teacher confirmations: all-software batch review, focused proof-gap receipt, transparent overlay packet, shortest evidence route, and final acceptance review.",
      "review"
    ),
    entry(
      "next_teacher_confirmation_cockpit_receipt_template",
      "Next Teacher Confirmation Receipt Template",
      nextTeacherConfirmationCockpit?.paths?.receiptTemplate || "",
      "Teacher-filled receipt template for approving only reviewed cockpit rows before any downstream command is copied.",
      "review"
    ),
    entry(
      "all_software_observer_bootstrap_readme",
      "All Software Observer Bootstrap",
      allSoftwareObserverBootstrapReadmePath,
      "Low-token all-software learning start point: inventory first, teacher excludes private apps, then bounded watch cycles compare cheap deltas.",
      "low_token"
    ),
    entry(
      "all_software_observer_teacher_template",
      "All Software Observer Teacher Template",
      allSoftwareObserverBootstrap?.teacherReviewTemplate || "",
      "Teacher review template for excluding private apps, selecting priority software, and choosing teaching style before queue/watch steps.",
      "low_token"
    ),
    entry(
      "all_software_observer_bootstrap_receipt",
      "All Software Observer Bootstrap Receipt",
      allSoftwareObserverBootstrapReceiptPath,
      "Receipt proving the bootstrap stayed low-token and did not record screens, read full logs, execute software, or write memory.",
      "low_token"
    ),
    entry(
      "all_software_observer_inventory_probe_output",
      "All Software Observer Inventory Output",
      allSoftwareObserverInventoryProbeOutputPath,
      "Read-only local software inventory output; it contains process/app/log-source metadata for teacher review before any queue or monitor.",
      "low_token"
    ),
    entry(
      "all_software_log_source_discovery_ledger",
      "All Software Log Source Discovery Ledger",
      allSoftwareLogSourceDiscoveryLedgerPath,
      "Per-software ledger proving which bounded inventory rows have log-source routes or low-token fallback questions before any log content read.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_ledger",
      "All Software Coverage Enrollment Ledger",
      allSoftwareCoverageEnrollmentLedgerPath,
      "Per-software enrollment ledger showing which rows have source routes and which still need watch or learning-cycle evidence before coverage claims.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_plan",
      "All Software Coverage Enrollment Follow-Up Plan",
      allSoftwareCoverageEnrollmentFollowUpPlanPath,
      "Next low-token follow-up actions for rows that have source routes but still need watch evidence.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_receipt_builder_html",
      "All Software Coverage Enrollment Follow-Up Receipt Builder",
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.html || "",
      "Browser page where the teacher reviews the 188 follow-up rows and generates an explicit receipt before any watch item or batch is run.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_receipt_template",
      "All Software Coverage Enrollment Follow-Up Receipt Template",
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.receiptTemplate || "",
      "Teacher-fillable receipt template for coverage enrollment follow-up decisions; it cannot validate itself, run batches, read logs, or claim completion.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_batch_index_html",
      "All Software Coverage Enrollment Follow-Up Batch Index",
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.paths?.html || "",
      "Teacher-facing index for all 188 follow-up rows, split into review-only batches with the next recommended offset and no software execution.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_batch_index_readme",
      "All Software Coverage Enrollment Follow-Up Batch Index README",
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.paths?.readme || "",
      "Markdown summary of total batches, generated rows, remaining rows, and the next batch command boundary.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_small_batch_receipt_builder_html",
      "All Software Coverage Enrollment Follow-Up Small Batch Receipt Builder",
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.html || "",
      "Small teacher review page for the first follow-up rows so the teacher can unlock progress without reviewing all 188 rows at once.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_small_batch_receipt_template",
      "All Software Coverage Enrollment Follow-Up Small Batch Receipt Template",
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.receiptTemplate || "",
      "Teacher-fillable small-batch receipt; omitted rows remain waiting and cannot be treated as accepted.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_receipt_validation_readme",
      "All Software Coverage Enrollment Follow-Up Receipt Validation",
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.paths?.readme || "",
      "Validation result for the teacher-filled follow-up receipt; default templates remain waiting for teacher review and cannot prepare batches.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_handoff_queue_html",
      "All Software Coverage Enrollment Follow-Up Handoff Queue",
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.paths?.html || "",
      "Manual next-step queue created from receipt validation; it does not run batches, read logs, screenshot, execute software, write memory, or claim completion.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_small_batch_receipt_validation_readme",
      "All Software Coverage Enrollment Follow-Up Small Batch Validation",
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.paths?.readme || "",
      "Validation result for the small-batch teacher receipt; omitted rows remain waiting and cannot be treated as accepted.",
      "low_token"
    ),
    entry(
      "all_software_coverage_enrollment_follow_up_small_batch_handoff_queue_html",
      "All Software Coverage Enrollment Follow-Up Small Batch Handoff Queue",
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.paths?.html || "",
      "Manual next-step queue for the small batch only; it cannot run omitted rows or claim full all-software coverage.",
      "low_token"
    ),
    entry(
      "all_software_observer_inventory_review_builder_html",
      "All Software Inventory Review Builder",
      allSoftwareObserverInventoryReviewBuilder?.paths?.html || "",
      "Browser page where the teacher marks private exclusions, priority software, and teaching style, then downloads the receipt JSON for the reviewed-queue bridge.",
      "low_token"
    ),
    entry(
      "all_software_observer_inventory_batch_review_builder_html",
      "All Software Inventory Batch Review Builder",
      allSoftwareObserverInventoryBatchReviewBuilder?.paths?.html || "",
      "Small high-signal batch review page for approving the first reviewed low-token queue without reviewing every local software candidate at once.",
      "low_token"
    ),
    entry(
      "all_software_observer_inventory_review_receipt_template",
      "All Software Inventory Review Receipt Template",
      allSoftwareObserverInventoryReviewBuilder?.paths?.receiptTemplate || "",
      "Receipt template generated from the inventory review builder; it is not acceptance and cannot create queues by itself.",
      "low_token"
    ),
    entry(
      "all_software_observer_reviewed_queue_bridge_readme",
      "All Software Reviewed Queue Bridge",
      allSoftwareObserverReviewedQueueBridge?.readmePath || "",
      "Bridge output that validates a teacher-filled inventory receipt and creates a low-token observer queue only for approved rows.",
      "low_token"
    ),
    entry(
      "all_software_observer_reviewed_queue_bridge_json",
      "All Software Reviewed Queue Bridge JSON",
      allSoftwareObserverReviewedQueueBridgePath,
      "Machine-readable bridge status, validation path, reviewed inventory, queue path, locks, and next metadata-delta command.",
      "low_token"
    ),
    entry(
      "all_software_observer_reviewed_queue",
      "All Software Teacher-Reviewed Observer Queue",
      allSoftwareObserverReviewedQueueBridge?.queuePath || "",
      "Low-token observer queue built only from teacher-approved inventory rows after private/out-of-scope exclusions.",
      "low_token"
    ),
    entry(
      "teach_execute_reviewed_observation_readme",
      "Reviewed Observation Start Here",
      teachExecuteReviewedObservationReadmePath,
      "Teacher-confirmed reviewed observation packet: filtered inventory, reviewed queue, optional bounded watch baseline, and no execution.",
      "low_token"
    ),
    entry(
      "teach_execute_reviewed_observation_receipt",
      "Reviewed Observation Receipt",
      teachExecuteReviewedObservationReceiptPath,
      "Receipt showing whether read-only probe, queue, and watch baseline ran, with screenshots/execution/memory locked.",
      "low_token"
    ),
    entry(
      "teach_execute_reviewed_inventory",
      "Reviewed Software Inventory",
      teachExecuteReviewedObservation?.evidence?.reviewedInventoryPath || "",
      "Teacher-filtered inventory after private/out-of-scope exclusions and priority hints.",
      "low_token"
    ),
    entry(
      "teach_execute_reviewed_observer_queue",
      "Reviewed Observer Queue",
      teachExecuteReviewedObservation?.evidence?.queuePath || "",
      "Bounded metadata queue for teacher-approved software rows before any next watch cycle.",
      "low_token"
    ),
    entry(
      "proof_gap_teacher_queue_html",
      "Proof Gap Teacher Queue",
      proofGapTeacherQueue?.paths?.html || "",
      "Machine-readable teacher evidence queue showing the next missing proof, receipt template, verification command, and blocked transitions.",
      "proof_gap"
    ),
    entry(
      "proof_gap_teacher_queue_receipt_template",
      "Proof Gap Queue Receipt Template",
      proofGapTeacherQueue?.paths?.receiptTemplate || "",
      "Template for the teacher-filled evidence receipt that can close one proof gap without claiming completion.",
      "proof_gap"
    ),
    entry(
      "proof_gap_teacher_queue_receipt_builder_html",
      "Proof Gap Queue Receipt Builder",
      proofGapTeacherQueueReceiptBuilder?.paths?.html || "",
      "Browser receipt builder that shows candidate evidence and lets the teacher generate a reviewed receipt without executing anything.",
      "proof_gap"
    ),
    entry(
      "next_proof_gap_focused_receipt_builder_html",
      "Next Proof Gap Focused Receipt Builder",
      proofGapNextFocusedReceiptBuilder?.paths?.html || "",
      "One-row browser receipt builder for the current next proof gap, with candidate evidence, teacher confirmation text, and retained rollback point fields.",
      "proof_gap"
    ),
    entry(
      "proof_gap_evidence_prefill_html",
      "Proof Gap Evidence Prefill",
      proofGapEvidencePrefill?.paths?.html || "",
      "Candidate-only evidence prefill for each proof gap; it reduces teacher lookup work without accepting evidence.",
      "proof_gap"
    ),
    entry(
      "proof_gap_candidate_receipt_draft",
      "Proof Gap Candidate Receipt Draft",
      proofGapEvidencePrefill?.paths?.candidateReceiptDraft || "",
      "Candidate draft that keeps observed evidence blank until the teacher explicitly reviews and confirms it.",
      "proof_gap"
    ),
    entry(
      "proof_gap_receipt_intake_router_html",
      "Proof Gap Receipt Intake Router",
      proofGapReceiptIntakeRouter?.paths?.html || "",
      "One-step router for validating a teacher-filled proof gap receipt and generating the copy-only next handoff builder.",
      "proof_gap"
    ),
    entry(
      "shortest_teacher_evidence_pack_html",
      "Shortest Teacher Evidence Pack",
      shortestTeacherEvidencePack?.paths?.html || "",
      "The shortest teacher-facing route for collecting the real route, overlay, spatial, method, receipt, and final-review evidence.",
      "trial"
    ),
    entry(
      "shortest_teacher_evidence_pack_readme",
      "Shortest Teacher Evidence Start Here",
      shortestTeacherEvidencePack?.paths?.readme || "",
      "Markdown checklist for the minimum real teacher evidence path.",
      "trial"
    ),
    entry(
      "shortest_teacher_evidence_receipt_builder_html",
      "Shortest Evidence Receipt Builder",
      shortestTeacherEvidencePack?.paths?.receiptBuilderHtml || "",
      "Browser form for producing one unified teacher-filled receipt for the shortest evidence route.",
      "trial"
    ),
    entry(
      "shortest_teacher_evidence_receipt_validation",
      "Shortest Evidence Receipt Validation",
      shortestTeacherEvidenceReceiptValidationPath || "",
      "Machine-readable validation of the current unified shortest evidence receipt.",
      "trial"
    ),
    entry(
      "final_teacher_acceptance_review_pack_html",
      "Final Teacher Acceptance Review Pack",
      finalTeacherAcceptanceReviewPack?.paths?.html || "",
      "Final teacher-facing review pack for accepting or blocking the full current objective after reviewing all lanes.",
      "final_review"
    ),
    entry(
      "final_teacher_acceptance_review_pack_readme",
      "Final Teacher Acceptance Start Here",
      finalTeacherAcceptanceReviewPack?.paths?.readme || "",
      "Markdown start-here file for the final teacher acceptance review pack.",
      "final_review"
    ),
    entry(
      "final_review_index_html",
      "Final Review Index",
      finalReviewIndex?.paths?.html || "",
      "Single index of all current-goal final review evidence lanes and review packs.",
      "final_review"
    ),
    entry(
      "final_convergence_readiness_gate_html",
      "Final Convergence Readiness Gate",
      finalConvergenceReadinessGate?.paths?.html || "",
      "Review-only gate showing review evidence readiness without treating it as completion.",
      "final_review"
    ),
    entry(
      "real_local_trial_package_html",
      "Real Local Trial Package",
      realLocalTrialPackage?.paths?.html || "",
      "Bounded real-local review-only evidence tying teacher method, low-token observation, transparent 2D/perspective/3D sketch, numbered target confirmation, and execution gate.",
      "trial"
    ),
    entry(
      "teacher_trial_intake_router_html",
      "Teacher Trial Intake Router",
      teacherTrialIntakeRouter?.paths?.html || "",
      "One-step receipt intake that validates the teacher receipt, refreshes preflight, and returns only the next manual command.",
      "trial"
    ),
    entry(
      "teacher_trial_preflight_html",
      "Teacher Trial Preflight",
      teacherTrialPreflight?.paths?.html || "",
      "Checks whether real teacher trial evidence is ready before any next manual gate.",
      "trial"
    ),
    entry(
      "teacher_trial_workbench_html",
      "Teacher Trial Workbench",
      teacherTrial.paths?.html || "",
      "Main teacher-facing sequence for validating the current goal before any execution.",
      "trial"
    ),
    entry(
      "teacher_trial_receipt_builder_html",
      "Receipt Builder",
      teacherTrial.paths?.receiptBuilderHtml || "",
      "Browser form for producing a teacher-filled trial receipt JSON.",
      "trial"
    ),
    entry(
      "integrated_evidence_gate_html",
      "Integrated Evidence Gate",
      gate.paths?.html || "",
      "Requirement matrix that separates implementation evidence from real completion proof.",
      "audit"
    ),
    entry(
      "low_token_route_receipt_builder_html",
      "Low Token Route Receipt Builder",
      lowToken?.teacherRouteSelectionActionPack?.routeReceiptBuilderHtml || lowToken?.paths?.routeReceiptBuilderHtml || "",
      "Teacher selects one low-token route for the chosen software without registering a monitor.",
      "low_token"
    ),
    entry(
      "low_token_handoff_html",
      "All-Software Low Token Handoff",
      lowToken?.paths?.html || "",
      "Review-only handoff for metadata-first observation across local software.",
      "low_token"
    ),
    entry(
      "transparent_overlay_browser_html",
      "Transparent Overlay",
      spatial?.paths?.browserOverlay || "",
      "Browser transparent drawing mask for teacher sketches and exported overlay packets.",
      "spatial"
    ),
    entry(
      "transparent_overlay_powershell",
      "Top-Most Overlay Script",
      spatial?.paths?.powershellOverlay || "",
      "PowerShell top-most overlay option for drawing over desktop software.",
      "spatial"
    ),
    entry(
      "spatial_handoff_html",
      "Spatial Drawing Handoff",
      spatial?.paths?.html || "",
      "Review-only handoff for 2D position, perspective, angle, and 3D depth interpretation.",
      "spatial"
    ),
    entry(
      "physical_world_spatial_grounding_html",
      "Physical World Spatial Grounding",
      physicalWorldSpatialGroundingPack?.paths?.html || "",
      "Review-only bridge from the Unity physical-world understanding prototype into transparent overlay 2D/perspective/3D grounding evidence.",
      "spatial"
    ),
    entry(
      "physical_world_spatial_grounding_start_here",
      "Physical Grounding Start Here",
      physicalWorldSpatialGroundingPack?.paths?.startHere || "",
      "Markdown checklist for grounding teacher overlay marks in RGB-D, camera calibration, point cloud, panel pose, fold-angle, and sim-to-real boundary evidence.",
      "spatial"
    ),
    entry(
      "teacher_method_profile_readme",
      "Teacher Method Profile",
      method?.paths?.teacherLearningMethodReadme || "",
      "Teacher reviews or corrects the inferred learning method before a reusable contract.",
      "method"
    ),
    entry(
      "teacher_method_handoff_html",
      "Teacher Method Adaptation Handoff",
      method?.paths?.html || "",
      "Review-only handoff for adapting to each teacher's preferred teaching style.",
      "method"
    )
  ],
  safeNextActions: [
    safeAction(
      "build_next_teacher_confirmation_cockpit",
      "Build Next Teacher Confirmation Cockpit",
      "Create one review-only page that gathers the current next teacher confirmation surfaces and copyable next commands without executing them.",
      createNextTeacherConfirmationCockpitCommand,
      "Builder only; it must not validate receipts, create queues, read logs, capture screenshots, execute target software, write memory, delete rollback points, enable rules, or claim completion."
    ),
    safeAction(
      "open_next_teacher_confirmation_cockpit",
      "Open Next Teacher Confirmation Cockpit",
      "Use the cockpit as the single teacher-facing next-step page for the all-software batch, proof gap, transparent overlay, shortest evidence, and final review lanes.",
      nextTeacherConfirmationCockpit?.paths?.html || "",
      "Review only; it must not validate receipts, create queues, run commands, register monitors, execute target software, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "validate_next_teacher_confirmation_cockpit_receipt",
      "Validate Next Teacher Confirmation Receipt",
      "After the teacher fills the cockpit receipt, validate reviewed rows and return copy-only downstream commands while preserving all locks.",
      validateNextTeacherConfirmationCockpitReceiptCommand,
      "Validation only; it must not execute commands, create queues, read logs, capture screenshots, run target software, write memory, enable rules, delete rollback points, or claim completion."
    ),
    safeAction(
      "create_all_software_observer_bootstrap",
      "Create All Software Observer Bootstrap",
      "Generate the existing low-token observer start kit for this computer: read-only inventory probe, teacher exclusion template, and next queue/watch commands.",
      createAllSoftwareObserverBootstrapCommand,
      "Bootstrap only; it must not run the read-only probe, read full logs, capture screenshots, register monitors, execute target software, write memory, or claim completion."
    ),
    safeAction(
      "run_all_software_read_only_inventory_probe",
      "Run All Software Read-Only Inventory Probe",
      "Collect bounded metadata about running/installed software and candidate log roots before the teacher excludes private apps.",
      runAllSoftwareReadOnlyInventoryProbeCommand,
      "Read-only metadata probe only; it must not read full logs, tail logs, capture screenshots, register monitors, execute target software, write memory, or claim completion."
    ),
    safeAction(
      "build_all_software_log_source_discovery_ledger",
      "Build All Software Log Source Discovery Ledger",
      "Create a per-software low-token source map from the current inventory so every row has a log route, event/file/process fallback, or teacher question before any content read.",
      createAllSoftwareLogSourceDiscoveryLedgerCommand,
      "Ledger only; it must not read log contents, tail logs, capture screenshots, create queues, execute software, write memory, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_ledger",
      "Build All Software Coverage Enrollment Ledger",
      "Combine inventory and log-source routes into a per-software coverage enrollment ledger before claiming all-software learning coverage.",
      createAllSoftwareCoverageEnrollmentLedgerCommand,
      "Ledger only; it must not read log contents, capture screenshots, run watch cycles, execute software, write memory, register schedules, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_follow_up_plan",
      "Build All Software Coverage Enrollment Follow-Up Plan",
      "Turn rows waiting for watch evidence into the next low-token follow-up actions, preserving teacher review before any batch run.",
      createAllSoftwareCoverageEnrollmentFollowUpPlanCommand,
      "Plan only; it must not run follow-up items, read logs, capture screenshots, execute software, write memory, register schedules, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_follow_up_receipt_builder",
      "Build All Software Coverage Enrollment Follow-Up Receipt Builder",
      "Create the teacher-facing browser form for reviewing all follow-up rows before any low-token watch evidence is collected.",
      createAllSoftwareCoverageEnrollmentFollowUpReceiptBuilderCommand,
      "Builder only; it must not validate receipts, run batches, read logs, capture screenshots, execute software, write memory, register schedules, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_follow_up_small_batch_receipt_builder",
      "Build All Software Coverage Enrollment Follow-Up Small Batch Receipt Builder",
      "Create a 12-row teacher review form so the teacher can approve a first small follow-up batch while all omitted rows remain waiting.",
      createAllSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderCommand,
      "Builder only; it must not validate receipts, run batches, read logs, capture screenshots, execute software, write memory, register schedules, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_follow_up_batch_index",
      "Build All Software Coverage Batch Index",
      "Regenerate the review-only batch route map for all follow-up rows so the teacher can see generated, current, and next offsets before reviewing more software.",
      createAllSoftwareCoverageEnrollmentFollowUpBatchIndexCommand,
      "Index only; it must not validate receipts, run batches, read logs, capture screenshots, execute software, write memory, register schedules, or claim completion."
    ),
    safeAction(
      "open_all_software_coverage_enrollment_follow_up_small_batch_receipt_builder",
      "Open All Software Coverage Enrollment Follow-Up Small Batch Receipt Builder",
      "Use the smaller browser form to review a manageable first batch before validating the generated receipt.",
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.html || "",
      "Receipt building only; omitted rows remain waiting and this must not validate receipts, run batches, read logs, capture screenshots, execute software, write memory, or claim completion."
    ),
    safeAction(
      "open_all_software_coverage_enrollment_follow_up_receipt_builder",
      "Open All Software Coverage Enrollment Follow-Up Receipt Builder",
      "Use the browser form to mark each follow-up row as reviewed, excluded, blocked, or ready for the next teacher-confirmed metadata step.",
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.html || "",
      "Receipt building only; it must not validate receipts, run batches, read logs, capture screenshots, execute software, write memory, register schedules, or claim completion."
    ),
    safeAction(
      "validate_all_software_coverage_enrollment_follow_up_receipt",
      "Validate All Software Coverage Enrollment Follow-Up Receipt",
      "After the teacher fills the follow-up receipt, validate reviewed rows into the next gated handoff without running software or reading logs.",
      validateAllSoftwareCoverageEnrollmentFollowUpReceiptCommand,
      "Validation only; it must not run batches, read logs, capture screenshots, execute software, write memory, register schedules, delete rollback points, or claim completion."
    ),
    safeAction(
      "validate_all_software_coverage_enrollment_follow_up_small_batch_receipt",
      "Validate All Software Coverage Enrollment Follow-Up Small Batch Receipt",
      "After the teacher fills the small-batch receipt, validate only included rows and preserve omitted rows as still waiting for later review.",
      validateAllSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptCommand,
      "Validation only; omitted rows remain unaccepted and this must not run batches, read logs, capture screenshots, execute software, write memory, register schedules, delete rollback points, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_follow_up_handoff_queue",
      "Build All Software Coverage Enrollment Follow-Up Handoff Queue",
      "Turn a validated follow-up receipt into manual next-step entries; if no rows are teacher-reviewed, route back to teacher review instead of running anything.",
      createAllSoftwareCoverageEnrollmentFollowUpHandoffQueueCommand,
      "Queue building only; it must not run batches, read logs, capture screenshots, execute software, write memory, register schedules, delete rollback points, or claim completion."
    ),
    safeAction(
      "build_all_software_coverage_enrollment_follow_up_small_batch_handoff_queue",
      "Build All Software Coverage Enrollment Follow-Up Small Batch Handoff Queue",
      "Turn a validated small-batch follow-up receipt into manual next-step entries while keeping omitted rows waiting.",
      createAllSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueCommand,
      "Queue building only; it must not run batches, omitted rows, read logs, capture screenshots, execute software, write memory, register schedules, delete rollback points, or claim completion."
    ),
    safeAction(
      "open_all_software_coverage_enrollment_follow_up_small_batch_handoff_queue",
      "Open All Software Coverage Enrollment Follow-Up Small Batch Handoff Queue",
      "Review the small-batch manual next-step queue before any separate teacher-confirmed command is copied.",
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.paths?.html || "",
      "Review only; it must not run batches, omitted rows, read logs, capture screenshots, execute software, write memory, register schedules, delete rollback points, or claim completion."
    ),
    safeAction(
      "open_all_software_coverage_enrollment_follow_up_handoff_queue",
      "Open All Software Coverage Enrollment Follow-Up Handoff Queue",
      "Review the manual next-step queue created from receipt validation before any separate teacher-confirmed command is copied.",
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.paths?.html || "",
      "Review only; it must not run batches, read logs, capture screenshots, execute software, write memory, register schedules, delete rollback points, or claim completion."
    ),
    safeAction(
      "build_all_software_inventory_review_builder",
      "Build All Software Inventory Review Builder",
      "Create a browser review page from the current local inventory so the teacher can exclude private apps, prioritize software, and select teaching style.",
      createAllSoftwareInventoryReviewBuilderCommand,
      "Builder only; it must not read logs, tail logs, capture screenshots, create queues, initialize watch baselines, execute software, write memory, or claim completion."
    ),
    safeAction(
      "build_all_software_inventory_batch_review_builder",
      "Build All Software Inventory Batch Review Builder",
      "Create a small high-signal batch review page so the teacher can approve the first low-token reviewed queue without reviewing all local candidates at once.",
      createAllSoftwareInventoryBatchReviewBuilderCommand,
      "Builder only; it must not read logs, tail logs, capture screenshots, create queues, initialize watch baselines, execute software, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "open_all_software_inventory_batch_review_builder",
      "Open All Software Inventory Batch Review Builder",
      "Use the batch review page to approve, defer, or exclude only the first high-signal software candidates before creating a reviewed queue.",
      allSoftwareObserverInventoryBatchReviewBuilder?.paths?.html || "",
      "Receipt building only; it must not validate receipts, create queues, read logs, capture screenshots, execute software, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "build_all_software_reviewed_queue_from_receipt",
      "Build All Software Reviewed Queue From Receipt",
      "After the teacher fills the inventory review receipt, validate confirmations and create a low-token observer queue only for approved rows.",
      createAllSoftwareReviewedQueueFromReceiptCommand,
      "Bridge only; it must not run an inventory probe, read log contents, tail logs, capture screenshots, initialize watch baselines, execute target software, write memory, enable rules, delete rollback points, or claim completion."
    ),
    safeAction(
      "start_teacher_confirmed_reviewed_observation",
      "Start Teacher-Confirmed Reviewed Observation",
      "After the teacher reviews the inventory, excludes private apps, and chooses priority software, create the filtered queue and optional bounded watch baseline.",
      startTeachExecuteReviewedObservationCommand,
      "Requires explicit teacher confirmation; it must not execute target software, capture screenshots, register schedules, write memory, enable rules, delete rollback points, or claim completion."
    ),
    safeAction(
      "open_next_proof_gap_teacher_queue",
      "Open Next Proof Gap Teacher Queue",
      "Use the machine-readable next-proof summary to review the first missing evidence item before any runner or target software action.",
      proofGapTeacherQueue?.paths?.html || "",
      "Review only; the queue does not validate receipts, run commands, register monitors, execute software, write memory, or claim completion."
    ),
    safeAction(
      "open_proof_gap_teacher_queue_receipt_builder",
      "Open Proof Gap Receipt Builder",
      "Use the browser receipt builder to review candidate evidence, optionally copy a candidate path into the receipt, and keep teacher confirmation explicit.",
      proofGapTeacherQueueReceiptBuilder?.paths?.html || "",
      "Receipt building only; it must not validate the receipt, run commands, register monitors, execute software, write memory, or claim completion."
    ),
    safeAction(
      "build_next_proof_gap_focused_receipt_builder",
      "Build Next Proof Gap Focused Receipt Builder",
      "Create a one-row browser receipt builder for the current next proof gap so the teacher only confirms the active missing proof route.",
      createNextProofGapFocusedReceiptBuilderCommand,
      "Builder only; it must not validate receipts, run commands, register monitors, launch runners, execute target software, capture screenshots, read full logs, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "open_next_proof_gap_focused_receipt_builder",
      "Open Next Proof Gap Focused Receipt Builder",
      "Use the focused browser form to review candidate evidence, fill explicit teacher confirmation text, and retain a rollback point for exactly one proof gap row.",
      proofGapNextFocusedReceiptBuilder?.paths?.html || "",
      "Receipt building only; it must not validate the receipt, run commands, register monitors, execute software, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "validate_proof_gap_teacher_queue_receipt",
      "Validate Proof Gap Teacher Queue Receipt",
      "After a teacher fills the proof-gap receipt, validate it and keep any resulting runner or execution command behind its separate approval gate.",
      nextProofGapSummary.receiptValidationCommandTemplate || proofGapTeacherQueue?.paths?.receiptValidationCommandTemplate || "",
      "Validation only; it must not run the returned command or treat evidence as final acceptance."
    ),
    safeAction(
      "build_proof_gap_validation_handoff_builder",
      "Build Proof Gap Validation Handoff Builder",
      proofGapReceiptValidationHasManualQueue
        ? "After the teacher-filled proof gap receipt validates with ready rows, create a copy-only handoff page for exactly one reviewed next-review item."
        : "Waiting for a teacher-filled proof gap receipt to validate with ready rows; use Route Proof Gap Teacher Receipt first.",
      buildProofGapValidationHandoffCommand,
      "Builder only; it must not run the next-review command, register monitors, execute software, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "route_proof_gap_teacher_receipt",
      "Route Proof Gap Teacher Receipt",
      "After the teacher downloads a filled proof gap receipt, run one intake step that validates it and, if ready rows exist, creates the copy-only handoff builder.",
      routeProofGapTeacherReceiptCommand,
      "Router only; it must not run the handoff item, register monitors, execute software, write memory, delete rollback points, or claim completion."
    ),
    safeAction(
      "open_proof_gap_evidence_prefill",
      "Open Proof Gap Evidence Prefill",
      "Review candidate evidence paths for each proof gap before asking the teacher to fill the real receipt.",
      proofGapEvidencePrefill?.paths?.html || "",
      "Candidate evidence only; it does not validate, run commands, or accept proof."
    ),
    safeAction(
      "open_proof_gap_candidate_receipt_draft",
      "Open Proof Gap Candidate Receipt Draft",
      "Use this only as a helper while the teacher reviews evidence; observed evidence remains blank until teacher confirmation.",
      proofGapEvidencePrefill?.paths?.candidateReceiptDraft || "",
      "Draft only; it must not be treated as a teacher-filled receipt."
    ),
    safeAction(
      "open_shortest_teacher_evidence_pack",
      "Open Shortest Teacher Evidence Pack",
      "Start here when the teacher wants the shortest real-evidence collection path instead of browsing all review artifacts.",
      shortestTeacherEvidencePack?.paths?.html || "",
      "Review only; opening the pack does not validate receipts, execute software, or claim completion."
    ),
    safeAction(
      "create_shortest_teacher_evidence_pack",
      "Create Shortest Teacher Evidence Pack",
      "Regenerate the minimum teacher-facing evidence path from the latest Start Here launchpad.",
      createShortestTeacherEvidencePackCommand,
      "Creates review materials only; no logs, screenshots, monitor registration, software execution, memory write, rule enablement, rollback deletion, or completion claim."
    ),
    safeAction(
      "build_shortest_teacher_evidence_receipt",
      "Build Shortest Evidence Receipt",
      "Use the unified browser form to attach the route, overlay, spatial, method, rollback, and optional final evidence in one receipt.",
      shortestTeacherEvidencePack?.paths?.receiptBuilderHtml || "",
      "Creates a JSON receipt only."
    ),
    safeAction(
      "validate_shortest_teacher_evidence_receipt",
      "Validate Shortest Evidence Receipt",
      "Validate the unified receipt, validate the derived workbench receipt, and return the next manual approval command when evidence is complete.",
      validateShortestTeacherEvidenceReceiptCommand,
      "Validation produces next manual commands only; it does not run them."
    ),
    safeAction(
      "open_teacher_trial_preflight",
      "Open Teacher Trial Preflight",
      "Check which real teacher evidence is still missing before any route, contract, or execution-gate step.",
      teacherTrialPreflight?.paths?.html || "",
      "Review only; missing evidence blocks the next gate."
    ),
    safeAction(
      "open_teacher_trial_workbench",
      "Open Teacher Trial Workbench",
      "Review the eight-phase teacher path and decide which real trial evidence to collect first.",
      teacherTrial.paths?.html || "",
      "Review only; no software action is run."
    ),
    safeAction(
      "build_teacher_trial_receipt",
      "Open Receipt Builder",
      "Fill the selected software, low-token route, overlay packet path, method review, rollback point, and notes.",
      teacherTrial.paths?.receiptBuilderHtml || "",
      "Creates a JSON receipt only."
    ),
    safeAction(
      "validate_trial_receipt",
      "Validate Trial Receipt",
      "Run the validator after the teacher-filled receipt exists.",
      validateTrialReceiptCommand,
      "Validation routes the next manual command only; it does not execute it."
    ),
    safeAction(
      "regenerate_teacher_trial_preflight_after_receipt",
      "Regenerate Preflight After Receipt",
      "After the teacher-filled receipt exists, regenerate the preflight so it checks all referenced evidence paths.",
      regeneratePreflightCommand,
      "Regeneration checks file paths only; it does not execute the selected next command."
    ),
    safeAction(
      "route_teacher_trial_receipt",
      "Route Teacher Trial Receipt",
      "Use the one-step intake router after the teacher receipt exists; it validates the receipt, refreshes preflight, and returns only the next manual command.",
      routeTeacherTrialReceiptCommand,
      "Router output is review-only; it does not run the returned command."
    ),
    safeAction(
      "create_real_local_trial_package",
      "Create Real Local Trial Package",
      "Run a bounded review-only real-local sampled integration package for the full current objective.",
      createRealLocalTrialPackageCommand,
      "Creates evidence only; no monitor registration, screenshots, target software execution, memory write, rule enablement, rollback deletion, or completion claim."
    ),
    safeAction(
      "open_final_teacher_acceptance_review_pack",
      "Open Final Teacher Acceptance Review Pack",
      "Review every final evidence lane and use the browser form to generate a teacher-filled final acceptance receipt only after real teacher acceptance.",
      finalTeacherAcceptanceReviewPack?.paths?.html || "",
      "Review only; opening the pack does not validate or claim completion."
    ),
    safeAction(
      "create_final_teacher_acceptance_review_pack",
      "Regenerate Final Teacher Acceptance Review Pack",
      "Rebuild the final teacher acceptance review pack from the latest final convergence readiness gate.",
      createFinalTeacherAcceptanceReviewPackCommand,
      "Creates review materials only; it does not accept the goal or run the final gate."
    ),
    safeAction(
      "validate_final_teacher_acceptance_receipt",
      "Validate Final Teacher Acceptance Receipt",
      "After the teacher fills a current-goal final acceptance receipt, validate it into the strict final-completion-gate teacher acceptance contract.",
      validateFinalTeacherAcceptanceReceiptCommand,
      "Default or incomplete receipts stay blocked; validation does not execute software or claim completion."
    ),
    safeAction(
      "select_low_token_route",
      "Validate Low Token Route Selection",
      "If the teacher chooses the low-token route first, validate the route receipt before any monitor registration.",
      lowTokenRouteValidationCommand,
      "No log read, monitor registration, or memory write."
    ),
    safeAction(
      "open_transparent_overlay",
      "Open Transparent Overlay",
      "Let the teacher draw intent and export a packet for later validation.",
      spatial?.paths?.browserOverlay || "",
      "The sample packet is implementation proof only; a real teacher packet is still required."
    ),
    safeAction(
      "validate_teacher_overlay_packet",
      "Validate Teacher Overlay Packet",
      "Check 2D position, perspective relation, angle/direction, and 3D depth cues from the exported packet.",
      overlayPacketValidationCommand,
      "Does not capture screenshots or execute target software."
    ),
    safeAction(
      "bridge_teacher_overlay_packet_to_rule_draft",
      "Bridge Teacher Overlay Packet To Rule Draft",
      "After the teacher-reviewed packet validates, convert the 2D position, angle/direction, perspective, and 3D depth logic into draft_disabled Rule DSL cards.",
      overlayPacketRuleDraftBridgeCommand,
      "Requires a retained rollback point and explicit teacher-reviewed flags; it must not execute software, capture screenshots, write memory, enable rules, delete rollback points, or claim completion."
    ),
    safeAction(
      "create_physical_world_spatial_grounding_pack",
      "Create Physical World Spatial Grounding Pack",
      "Summarize the existing Unity physical-world understanding project into review-only evidence for transparent overlay 2D/perspective/3D teaching.",
      createPhysicalWorldSpatialGroundingPackCommand,
      "Evidence-only; does not run Unity, capture screenshots, execute software, enable rules, write memory, or claim real-world authority."
    ),
    safeAction(
      "open_physical_world_spatial_grounding",
      "Open Physical World Spatial Grounding",
      "Use RGB-D, camera calibration, point-cloud, panel-pose, fold-angle, and sim-to-real boundary evidence to review teacher sketch intent.",
      physicalWorldSpatialGroundingPack?.paths?.html || "",
      "Review only; this cannot replace teacher confirmation or final acceptance."
    ),
    safeAction(
      "review_teacher_method_profile",
      "Review Teacher Method Profile",
      "Teacher corrects the inferred teaching method before any reusable workflow or medium-runtime reuse.",
      method?.paths?.teacherLearningMethodReadme || "",
      "A generated profile is not teacher acceptance."
    ),
    safeAction(
      "prepare_method_contract_after_review",
      "Prepare Method Contract After Review",
      "Only after teacher review and retained rollback, create the review-only method contract.",
      methodContractCommand,
      "Rules remain review-only and disabled."
    ),
    safeAction(
      "prepare_execution_approval_gate",
      "Prepare Execution Approval Gate",
      "After validated teacher evidence exists, prepare a separate approval gate for one confirmed software action.",
      executionApprovalCommand,
      "This launchpad does not execute target software."
    )
  ],
  blockedActions: [
    "read_logs_from_launchpad",
    "read_full_logs_from_launchpad",
    "capture_screenshots_from_launchpad",
    "record_screen_from_launchpad",
    "register_monitor_from_launchpad",
    "launch_runner_from_launchpad",
    "execute_target_software_from_launchpad",
    "write_memory_from_launchpad",
    "enable_rules_from_launchpad",
    "downgrade_to_medium_runtime_from_launchpad",
    "delete_rollback_points_from_launchpad",
    "claim_goal_complete_from_launchpad"
  ],
  paths: {
    launchpad: launchpadPath,
    html: htmlPath,
    readme: readmePath,
    integratedGate: integratedGatePath,
    teacherTrialWorkbench: teacherTrialPath,
    teacherTrialPreflight: teacherTrialPreflightPath,
    teacherTrialIntakeRouter: teacherTrialIntakeRouterPath,
    shortestTeacherEvidencePack: shortestTeacherEvidencePackPath,
    shortestTeacherEvidenceReceiptValidation: shortestTeacherEvidenceReceiptValidationPath,
    realLocalTrialPackage: realLocalTrialPackagePath,
    finalReviewIndex: finalReviewIndexPath,
    finalConvergenceReadinessGate: finalConvergenceReadinessGatePath,
    finalTeacherAcceptanceReviewPack: finalTeacherAcceptanceReviewPackPath,
    physicalWorldSpatialGroundingPack: physicalWorldSpatialGroundingPackPath,
    proofGapTeacherQueue: proofGapTeacherQueuePath,
    proofGapEvidencePrefill: proofGapEvidencePrefillPath,
    proofGapTeacherQueueReceiptBuilder: proofGapTeacherQueueReceiptBuilderPath,
    proofGapNextFocusedReceiptBuilder: proofGapNextFocusedReceiptBuilderPath,
    proofGapNextFocusedReceiptBuilderHtml: proofGapNextFocusedReceiptBuilder?.paths?.html || "",
    proofGapTeacherQueueReceiptValidation: proofGapTeacherQueueReceiptValidationPath,
    proofGapReceiptIntakeRouter: proofGapReceiptIntakeRouterPath,
    allSoftwareObserverBootstrap: allSoftwareObserverBootstrapPath,
    allSoftwareObserverBootstrapReadme: allSoftwareObserverBootstrapReadmePath,
    allSoftwareObserverBootstrapReceipt: allSoftwareObserverBootstrapReceiptPath,
    allSoftwareObserverTeacherTemplate: allSoftwareObserverBootstrap?.teacherReviewTemplate || "",
    allSoftwareObserverInventoryProbeOutput: allSoftwareObserverInventoryProbeOutputPath,
    allSoftwareLogSourceDiscoveryLedger: allSoftwareLogSourceDiscoveryLedgerPath,
    allSoftwareLogSourceDiscoveryLedgerReadme: allSoftwareLogSourceDiscoveryLedgerPath
      ? join(dirname(allSoftwareLogSourceDiscoveryLedgerPath), "ALL_SOFTWARE_LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md")
      : "",
    allSoftwareCoverageEnrollmentLedger: allSoftwareCoverageEnrollmentLedgerPath,
    allSoftwareCoverageEnrollmentLedgerReadme: allSoftwareCoverageEnrollmentLedgerPath
      ? join(dirname(allSoftwareCoverageEnrollmentLedgerPath), "ALL_SOFTWARE_COVERAGE_ENROLLMENT_LEDGER_START_HERE.md")
      : "",
    allSoftwareCoverageEnrollmentFollowUpPlan: allSoftwareCoverageEnrollmentFollowUpPlanPath,
    allSoftwareCoverageEnrollmentFollowUpPlanReadme: allSoftwareCoverageEnrollmentFollowUpPlanPath
      ? join(dirname(allSoftwareCoverageEnrollmentFollowUpPlanPath), "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md")
      : "",
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilder: allSoftwareCoverageEnrollmentFollowUpReceiptBuilderPath,
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderHtml:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.html || "",
    allSoftwareCoverageEnrollmentFollowUpReceiptTemplate:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.receiptTemplate || "",
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilderReadme:
      allSoftwareCoverageEnrollmentFollowUpReceiptBuilder?.paths?.readme || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderPath,
    allSoftwareCoverageEnrollmentFollowUpBatchIndex: allSoftwareCoverageEnrollmentFollowUpBatchIndexPath,
    allSoftwareCoverageEnrollmentFollowUpBatchIndexHtml:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.paths?.html || "",
    allSoftwareCoverageEnrollmentFollowUpBatchIndexReadme:
      allSoftwareCoverageEnrollmentFollowUpBatchIndex?.paths?.readme || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderHtml:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.html || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptTemplate:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.receiptTemplate || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderReadme:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder?.paths?.readme || "",
    allSoftwareCoverageEnrollmentFollowUpReceiptValidation: allSoftwareCoverageEnrollmentFollowUpReceiptValidationPath,
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationReadme:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.paths?.readme || "",
    allSoftwareCoverageEnrollmentFollowUpReceiptValidationReceipt:
      allSoftwareCoverageEnrollmentFollowUpReceiptValidation?.paths?.receipt || "",
    allSoftwareCoverageEnrollmentFollowUpHandoffQueue: allSoftwareCoverageEnrollmentFollowUpHandoffQueuePath,
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueHtml:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.paths?.html || "",
    allSoftwareCoverageEnrollmentFollowUpHandoffQueueReadme:
      allSoftwareCoverageEnrollmentFollowUpHandoffQueue?.paths?.readme || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationPath,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationReadme:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.paths?.readme || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationReceipt:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation?.paths?.receipt || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueuePath,
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueHtml:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.paths?.html || "",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueReadme:
      allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue?.paths?.readme || "",
    allSoftwareObserverInventoryReviewBuilder: allSoftwareObserverInventoryReviewBuilderPath,
    allSoftwareObserverInventoryReviewBuilderHtml: allSoftwareObserverInventoryReviewBuilder?.paths?.html || "",
    allSoftwareObserverInventoryBatchReviewBuilder: allSoftwareObserverInventoryBatchReviewBuilderPath,
    allSoftwareObserverInventoryBatchReviewBuilderHtml:
      allSoftwareObserverInventoryBatchReviewBuilder?.paths?.html || "",
    nextTeacherConfirmationCockpit: nextTeacherConfirmationCockpitPath,
    nextTeacherConfirmationCockpitHtml:
      nextTeacherConfirmationCockpit?.paths?.html || "",
    nextTeacherConfirmationCockpitReceiptTemplate:
      nextTeacherConfirmationCockpit?.paths?.receiptTemplate || "",
    nextTeacherConfirmationCockpitReceiptValidation:
      nextTeacherConfirmationCockpitReceiptValidationPath,
    allSoftwareObserverInventoryReviewReceiptTemplate:
      allSoftwareObserverInventoryReviewBuilder?.paths?.receiptTemplate || "",
    allSoftwareObserverReviewedQueueBridge: allSoftwareObserverReviewedQueueBridgePath,
    allSoftwareObserverReviewedQueueBridgeReadme: allSoftwareObserverReviewedQueueBridge?.readmePath || "",
    allSoftwareObserverReviewedQueueBridgeValidation:
      allSoftwareObserverReviewedQueueBridge?.validationPath || "",
    allSoftwareObserverReviewedInventory:
      allSoftwareObserverReviewedQueueBridge?.reviewedInventoryPath || "",
    allSoftwareObserverReviewedQueue:
      allSoftwareObserverReviewedQueueBridge?.queuePath || "",
    teachExecuteReviewedObservation: teachExecuteReviewedObservationPath,
    teachExecuteReviewedObservationReadme: teachExecuteReviewedObservationReadmePath,
    teachExecuteReviewedObservationReceipt: teachExecuteReviewedObservationReceiptPath,
    teachExecuteReviewedInventory: teachExecuteReviewedObservation?.evidence?.reviewedInventoryPath || "",
    teachExecuteReviewedObserverQueue: teachExecuteReviewedObservation?.evidence?.queuePath || "",
    teachExecuteReviewedWatchCycle: teachExecuteReviewedObservation?.evidence?.watchCyclePath || "",
    lowTokenHandoff: lowTokenPath,
    teacherSpatialDrawingHandoff: spatialPath,
    teacherSpatialOverlayHtml: spatial?.paths?.overlayHtml || spatial?.paths?.browserOverlay || "",
    teacherSpatialOverlayPowershell: spatial?.paths?.overlayPowershell || spatial?.paths?.powershellOverlay || "",
    teacherSpatialSampleOverlayPacket: spatial?.paths?.sampleOverlayPacket || spatial?.paths?.samplePacket || "",
    teacherMethodAdaptationHandoff: methodPath
  },
  nextProofGapSummary,
  nextProofGapEvidencePrefillSummary,
  locks: locks(),
  goalComplete: false
};

writeFileSync(launchpadPath, `${JSON.stringify(launchpad, null, 2)}\n`, "utf8");
writeHtml(htmlPath, launchpad);
writeReadme(readmePath, launchpad);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_start_here_launchpad_result_v1",
      status: launchpad.status,
      launchpadPath,
      htmlPath,
      readmePath,
      entryLinkCount: launchpad.entryLinks.length,
      safeNextActionCount: launchpad.safeNextActions.length,
      statusSummary: launchpad.statusSummary,
      locks: launchpad.locks
    },
    null,
    2
  )
);
