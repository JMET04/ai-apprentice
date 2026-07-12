#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "original-goal-current-status-refresh")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-current-status-refresh"
  );
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function compactCompletionBlockerLanes(matrixPath, queuePath) {
  const matrix = matrixPath && existsSync(matrixPath) ? readJson(matrixPath) : {};
  const queue = queuePath && existsSync(queuePath) ? readJson(queuePath) : {};
  const matrixRows = Array.isArray(matrix.rows) ? matrix.rows : [];
  const queueItems = Array.isArray(queue.queueItems) ? queue.queueItems : [];
  const queueByLane = new Map(queueItems.map((item) => [item.lane, item]));

  return matrixRows.map((row, index) => {
    const queueItem = queueByLane.get(row.lane) || {};
    const commandRisk = queueItem.commandRisk || {};
    return {
      number: Number(queueItem.number || index + 1),
      lane: row.lane || "",
      status: queueItem.status || row.status || "",
      requirement: row.requirement || "",
      missingProof: row.missingProof || "",
      nextSafeAction: row.nextSafeAction || queueItem.nextSafeAction || "",
      missingInputs: Array.isArray(queueItem.missingInputs) ? queueItem.missingInputs : [],
      commandHasPlaceholders: Boolean(commandRisk.hasPlaceholders),
      commandReviewOnlySafeToCopy: commandRisk.reviewOnlySafeToCopy === true,
      highRiskMarkers: Array.isArray(commandRisk.matchedHighRiskMarkers)
        ? commandRisk.matchedHighRiskMarkers
        : [],
      blockedClaims: Array.isArray(row.blockedClaims) ? row.blockedClaims : [],
      evidenceLinks: Array.isArray(queueItem.evidenceLinks)
        ? queueItem.evidenceLinks.map((link) => ({
            kind: link.kind || "",
            exists: link.exists === true,
            basename: link.basename || ""
          }))
        : []
    };
  });
}

function fileMtimeMs(path) {
  if (!path || !existsSync(path)) return 0;
  try {
    return statSync(path).mtimeMs || 0;
  } catch {
    return 0;
  }
}

function isUsableDiscoveredEvidence(path) {
  if (!path || !String(path).toLowerCase().endsWith(".json")) return true;
  try {
    readJson(path);
    return true;
  } catch {
    return false;
  }
}

function firstUsableDiscoveredPath(matches) {
  for (const match of matches) {
    if (isUsableDiscoveredEvidence(match.path)) return match.path;
  }
  return "";
}

function compactEvidenceRunnerRequiresRetainedRollbackManifest() {
  const runnerPath = join(__dirname, "run-original-goal-low-token-compact-evidence-request.mjs");
  if (!existsSync(runnerPath)) return false;
  const text = readFileSync(runnerPath, "utf8");
  return (
    text.includes("function retainedRollbackPoint") &&
    text.includes("runner_requires_retained_rollback_point_manifest") &&
    text.includes('manifest.format === "transparent_ai_rollback_point_v1"') &&
    text.includes('manifest.status === "waiting_for_teacher_confirmation"') &&
    text.includes("manifest.deleteOnlyAfterTeacherConfirmation === true") &&
    text.includes("rollbackPointManifest: rollbackPointContract.manifestPath")
  );
}

function chooseNewestUsablePath(paths) {
  const candidates = [];
  for (const path of paths) {
    if (!path || !existsSync(path) || !isUsableDiscoveredEvidence(path)) continue;
    candidates.push({ path, mtimeMs: statSync(path).mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path || "";
}

function coverageFollowUpItemCount(plan) {
  return Math.max(
    0,
    Number(plan?.counts?.followUpItems || 0),
    Array.isArray(plan?.followUpItems) ? plan.followUpItems.length : 0
  );
}

function coverageBatchSelectedCount(batch) {
  return Math.max(
    0,
    Number(batch?.selectedItemCount || 0),
    Array.isArray(batch?.runResults) ? batch.runResults.length : 0
  );
}

function coverageEnrollmentFollowUpPreviewRefreshReason(planPath, planPacket, batchPath, batchPacket) {
  const planCount = coverageFollowUpItemCount(planPacket);
  if (!planPath || !planPacket || planCount <= 0) return "";
  if (!batchPath || !batchPacket) return "missing_coverage_enrollment_follow_up_batch_preview";
  if (batchPacket.format !== "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1") {
    return "coverage_enrollment_follow_up_batch_preview_wrong_format";
  }
  const batchSourcePlan = batchPacket.sourcePlanPath ? resolve(batchPacket.sourcePlanPath) : "";
  if (batchSourcePlan && batchSourcePlan !== resolve(planPath)) return "coverage_enrollment_follow_up_batch_preview_for_different_plan";
  if (coverageBatchSelectedCount(batchPacket) < planCount) return "coverage_enrollment_follow_up_batch_preview_does_not_cover_current_plan";
  if (fileMtimeMs(batchPath) < fileMtimeMs(planPath)) return "coverage_enrollment_follow_up_batch_preview_older_than_plan";
  return "";
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function collectNamedFiles(root, fileName, maxEntries, allowSmokeEvidence = true) {
  if (!root || !existsSync(root)) return [];
  const matches = [];
  const stack = [resolve(root)];
  let entriesVisited = 0;
  while (stack.length > 0 && entriesVisited < maxEntries) {
    const current = stack.pop();
    let stat;
    try {
      stat = statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const base = basename(current).toLowerCase();
      if (base === ".git" || base === "node_modules" || base === "rollback-points") continue;
      let entries = [];
      try {
        entries = readdirSync(current);
      } catch {
        continue;
      }
      for (const entry of entries) {
        entriesVisited += 1;
        if (entriesVisited > maxEntries) break;
        stack.push(join(current, entry));
      }
    } else if (basename(current) === fileName) {
      matches.push({ path: current, mtimeMs: stat.mtimeMs, smoke: current.toLowerCase().includes("-smoke") });
    }
  }
  const preferred = matches.filter((match) => !match.smoke);
  const candidates = allowSmokeEvidence ? (preferred.length > 0 ? preferred : matches) : preferred;
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates;
}

function findLatestNamedFile(root, fileName, preferredSubdirs = [], maxEntries = 100000, allowSmokeEvidence = true) {
  if (!root || !existsSync(root)) return "";
  const preferredMatches = [];
  for (const subdir of preferredSubdirs) {
    const preferredRoot = join(root, subdir);
    const matches = collectNamedFiles(preferredRoot, fileName, Math.max(1000, Math.floor(maxEntries / 4)), allowSmokeEvidence);
    preferredMatches.push(...matches);
  }
  if (preferredMatches.length > 0) {
    preferredMatches.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return firstUsableDiscoveredPath(preferredMatches);
  }
  return firstUsableDiscoveredPath(collectNamedFiles(root, fileName, maxEntries, allowSmokeEvidence));
}

function writeReadme(path, packet) {
  const directLinks = Array.isArray(packet.directReviewEntryPoints) ? packet.directReviewEntryPoints : [];
  const lines = [
    "# Original Goal Current Status Refresh",
    "",
    `Status: ${packet.status}`,
    `Completion decision: ${packet.completionDecision}`,
    "",
    "This package refreshes the current evidence for the original goal in one low-token handoff.",
    "",
    "Generated artifacts:",
    `- Current status dashboard: ${packet.paths.currentStatusDashboardHtml}`,
    `- Real-local non-CAD/SolidWorks candidates: ${packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksCandidates ?? ""}`,
    `- Real-local non-CAD/SolidWorks ledger rows: ${packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksLedgerRows ?? ""}`,
    `- Real-local non-CAD/SolidWorks scope claim: ${packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessScopeClaim || ""}`,
    `- Real-local bounded all-software sample, not complete: ${packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessBoundedNotComplete ?? false}`,
    `- Ordered next-action triage: ${packet.paths.nextActionTriageHtml}`,
    `- Teacher action shortlist JSON: ${packet.paths.teacherActionShortlist}`,
    `- Teacher action shortlist actions: ${packet.refreshedEvidence.teacherActionShortlistActions ?? ""}`,
    `- Teacher action shortlist first review entry: ${packet.refreshedEvidence.teacherActionShortlistFirstReviewEntry || ""}`,
    `- Teacher action shortlist router receipt template: ${packet.paths.teacherActionShortlistRouterReceiptTemplate || ""}`,
    `- Teacher action shortlist router receipt validation command: ${packet.paths.teacherActionShortlistRouterReceiptValidationCommandTemplate || ""}`,
    `- Teacher action shortlist router receipt status: ${packet.refreshedEvidence.teacherActionShortlistRouterReceiptStatus || ""}`,
    `- Original-goal next confirmation pack: ${packet.paths.originalGoalNextConfirmationPackHtml || packet.paths.originalGoalNextConfirmationPack || ""}`,
    `- Original-goal next confirmation receipt builder: ${packet.paths.originalGoalNextConfirmationPackReceiptBuilderHtml || packet.paths.originalGoalNextConfirmationPackReceiptBuilder || ""}`,
    `- Original-goal next confirmation items: ${packet.refreshedEvidence.originalGoalNextConfirmationPackItems ?? ""}`,
    `- Original-goal next confirmation sensitive manual rows: ${packet.refreshedEvidence.originalGoalNextConfirmationPackSensitiveManualRows ?? ""}`,
    `- Original-goal proof ledger: ${packet.paths.originalGoalProofLedgerHtml || packet.paths.originalGoalProofLedger || ""}`,
    `- Original-goal proof ledger missing proof count: ${packet.refreshedEvidence.originalGoalProofLedgerMissingProofCount ?? ""}`,
    `- Original-goal proof ledger completion allowed: ${packet.refreshedEvidence.originalGoalProofLedgerCompletionAllowed ?? false}`,
    `- Original-goal proof gap closure pack: ${packet.paths.originalGoalProofGapClosurePackHtml || packet.paths.originalGoalProofGapClosurePack || ""}`,
    `- Original-goal proof gap closure routes: ${packet.refreshedEvidence.originalGoalProofGapClosurePackRoutes ?? ""}`,
    `- Original-goal proof gap closure high-risk gated routes: ${packet.refreshedEvidence.originalGoalProofGapClosurePackHighRiskGatedRoutes ?? ""}`,
    `- Original-goal proof gap teacher review cockpit: ${packet.paths.originalGoalProofGapTeacherReviewCockpitHtml || packet.paths.originalGoalProofGapTeacherReviewCockpit || ""}`,
    `- Original-goal proof gap teacher queue: ${packet.paths.originalGoalProofGapTeacherQueueHtml || packet.paths.originalGoalProofGapTeacherQueue || ""}`,
    `- Original-goal proof gap teacher queue items: ${packet.refreshedEvidence.originalGoalProofGapTeacherQueueItems ?? ""}`,
    `- Original-goal proof gap evidence prefill: ${packet.paths.originalGoalProofGapEvidencePrefillHtml || packet.paths.originalGoalProofGapEvidencePrefill || ""}`,
    `- Original-goal proof gap evidence prefill rows with candidates: ${packet.refreshedEvidence.originalGoalProofGapEvidencePrefillRowsWithCandidateEvidence ?? ""}`,
    `- Original-goal proof gap teacher queue receipt builder: ${packet.paths.originalGoalProofGapTeacherQueueReceiptBuilderHtml || packet.paths.originalGoalProofGapTeacherQueueReceiptBuilder || ""}`,
    `- Original-goal proof gap teacher queue receipt template: ${packet.paths.originalGoalProofGapTeacherQueueReceiptTemplate || ""}`,
    `- Original-goal proof gap teacher queue receipt validation command: ${packet.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate || ""}`,
    `- Original-goal proof gap validation handoff queue command: ${packet.paths.originalGoalProofGapValidationHandoffQueueCommandTemplate || ""}`,
    `- Teacher action router: ${packet.paths.teacherActionRouterHtml}`,
    `- Teacher action router receipt builder: ${packet.paths.teacherActionRouterReceiptBuilderHtml}`,
    `- Teacher action router receipt template: ${packet.paths.teacherActionRouterReceiptTemplate}`,
    `- Remaining gates low-token packet: ${packet.paths.originalGoalRemainingGatesPacketHtml || packet.paths.originalGoalRemainingGatesPacket}`,
    `- Remaining gates receipt builder: ${packet.paths.originalGoalRemainingGatesReceiptBuilderHtml || packet.paths.originalGoalRemainingGatesReceiptBuilder}`,
    `- Remaining gates receipt template: ${packet.paths.originalGoalRemainingGatesReceiptTemplate}`,
    `- Remaining gates receipt validation command: ${packet.paths.originalGoalRemainingGatesReceiptValidationCommandTemplate}`,
    `- Original-goal review handoff item command builder: ${packet.paths.originalGoalReviewHandoffItemCommandBuilderHtml || packet.paths.originalGoalReviewHandoffItemCommandBuilder}`,
    `- Original-goal review handoff item command builder command: ${packet.paths.originalGoalReviewHandoffItemCommandBuilderCommandTemplate}`,
    `- Original-goal completion blocker matrix: ${packet.paths.originalGoalCompletionBlockerMatrixHtml || packet.paths.originalGoalCompletionBlockerMatrix || ""}`,
    `- Original-goal completion blocker matrix README: ${packet.paths.originalGoalCompletionBlockerMatrixReadme || ""}`,
    `- Original-goal objective fulfillment audit: ${packet.paths.originalGoalObjectiveFulfillmentAuditHtml || packet.paths.originalGoalObjectiveFulfillmentAudit || ""}`,
    `- Original-goal objective fulfillment next-step queue: ${packet.paths.originalGoalObjectiveFulfillmentNextStepQueueHtml || packet.paths.originalGoalObjectiveFulfillmentNextStepQueue || ""}`,
    `- Original-goal low-token monitor command bridge: ${packet.paths.originalGoalLowTokenMonitorCommandBridgeHtml || packet.paths.originalGoalLowTokenMonitorCommandBridge || ""}`,
    `- Original-goal low-token monitor bridge routes: ${packet.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeRoutes ?? ""}`,
    `- Original-goal low-token monitor evidence-aware route: ${packet.refreshedEvidence.originalGoalLowTokenMonitorEvidenceAwareRecommendedRoute || ""}`,
    `- Original-goal low-token monitor evidence-aware action: ${packet.refreshedEvidence.originalGoalLowTokenMonitorNextEvidenceAwareAction || ""}`,
    `- Original-goal low-token monitor coverage artifacts ready: ${packet.refreshedEvidence.originalGoalLowTokenMonitorCoverageArtifactsReady ?? false}`,
    `- Original-goal low-token monitor readiness package ready: ${packet.refreshedEvidence.originalGoalLowTokenMonitorReadinessPackageReady ?? false}`,
    `- Original-goal low-token monitor bridge receipt builder: ${packet.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml || packet.paths.originalGoalLowTokenMonitorBridgeReceiptBuilder || ""}`,
    `- Original-goal low-token monitor bridge receipt validation command: ${packet.paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate || ""}`,
    `- Original-goal low-token monitor selected-route command builder command: ${packet.paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate || ""}`,
    `- All-software unattended learning audit: ${packet.paths.allSoftwareUnattendedLearningAuditReadme || packet.paths.allSoftwareUnattendedLearningAudit || ""}`,
    `- All-software unattended learning audit status: ${packet.refreshedEvidence.allSoftwareUnattendedLearningAuditStatus || ""}`,
    `- All-software unattended learning audit remaining gaps: ${packet.refreshedEvidence.allSoftwareUnattendedLearningAuditRemainingGaps ?? ""}`,
    `- Recurring monitor teacher confirmation package: ${packet.paths.recurringMonitorTeacherConfirmationPackageHtml || packet.paths.recurringMonitorTeacherConfirmationPackageReadme || packet.paths.recurringMonitorTeacherConfirmationPackage || ""}`,
    `- Recurring monitor teacher confirmation rows: ${packet.refreshedEvidence.recurringMonitorTeacherConfirmationRows ?? ""}`,
    `- Recurring monitor teacher confirmation package status: ${packet.refreshedEvidence.recurringMonitorTeacherConfirmationPackageStatus || ""}`,
    `- Recurring monitor teacher confirmation receipt validation: ${packet.paths.recurringMonitorTeacherConfirmationReceiptValidationReadme || packet.paths.recurringMonitorTeacherConfirmationReceiptValidation || ""}`,
    `- Recurring monitor teacher confirmation receipt validation status: ${packet.refreshedEvidence.recurringMonitorTeacherConfirmationReceiptValidationStatus || ""}`,
    `- Recurring monitor teacher confirmation receipt missing rows: ${packet.refreshedEvidence.recurringMonitorTeacherConfirmationReceiptValidationMissingRows ?? ""}`,
    `- Unattended approval gaps have teacher confirmation entrypoint: ${packet.refreshedEvidence.unattendedApprovalGapsHaveTeacherConfirmationEntryPoint ?? false}`,
    `- Recurring monitor registration dry-run command: ${packet.paths.recurringMonitorRegistrationRunnerDryRunCommandTemplate || ""}`,
    `- Recurring monitor registration status verifier command: ${packet.paths.recurringMonitorRegistrationStatusVerifierCommandTemplate || ""}`,
    `- Low-token waiting rows needing log-source route: ${packet.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanRowsNeedingLogSourceRoute ?? ""}`,
    `- Low-token fallback route candidate rows: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackRows ?? ""}`,
    `- Low-token fallback candidate routes: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackCandidateRoutes ?? ""}`,
    `- Low-token route gaps covered by fallback review: ${packet.refreshedEvidence.originalGoalLowTokenRouteGapCoveredByFallbackReview ?? false}`,
    `- Original-goal completion blocker next-step queue: ${packet.paths.originalGoalCompletionBlockerNextStepQueueHtml || packet.paths.originalGoalCompletionBlockerNextStepQueue || ""}`,
    `- Original-goal completion blocker next-step queue README: ${packet.paths.originalGoalCompletionBlockerNextStepQueueReadme || ""}`,
    `- Original-goal completion blocker lane command builder: ${packet.paths.originalGoalCompletionBlockerLaneCommandBuilderHtml || packet.paths.originalGoalCompletionBlockerLaneCommandBuilder || ""}`,
    `- Original-goal completion blocker lane command builder README: ${packet.paths.originalGoalCompletionBlockerLaneCommandBuilderReadme || ""}`,
    `- Original-goal completion blocker lane request receipt builder command: ${packet.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate || ""}`,
    `- Original-goal completion blocker lane request receipt validation command: ${packet.paths.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate || ""}`,
    `- Original-goal completion blocker lane request runner command: ${packet.paths.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate || ""}`,
    `- Original-goal completion blocker lane run review receipt builder command: ${packet.paths.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate || ""}`,
    `- Original-goal completion blocker lane run review receipt validation command: ${packet.paths.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate || ""}`,
    `- Triggered visual check command builder: ${packet.paths.triggeredVisualCheckCommandBuilderHtml || packet.paths.triggeredVisualCheckCommandBuilder || ""}`,
    `- Triggered visual check command builder command: ${packet.paths.triggeredVisualCheckCommandBuilderCommandTemplate || ""}`,
    `- Teacher review cockpit: ${packet.paths.teacherReviewCockpitHtml}`,
    `- Teacher review cockpit receipt template: ${packet.paths.teacherReviewCockpitReceiptTemplate}`,
    `- Teacher review cockpit handoff queue command: ${packet.paths.teacherReviewCockpitHandoffQueueCommandTemplate}`,
    `- Original-goal review handoff item runner command: ${packet.paths.originalGoalReviewHandoffQueueItemRunnerCommandTemplate}`,
    `- Coverage rollout receipt builder: ${packet.paths.coverageRolloutReceiptBuilder}`,
    `- Coverage rollout receipt builder HTML: ${packet.paths.coverageRolloutReceiptBuilderHtml}`,
    `- Coverage rollout handoff queue command: ${packet.paths.coverageRolloutHandoffQueueCommandTemplate}`,
    `- Coverage rollout handoff item runner command: ${packet.paths.coverageRolloutHandoffQueueItemRunnerCommandTemplate}`,
    `- Coverage rollout handoff item run review receipt builder command: ${packet.paths.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate || ""}`,
    `- Coverage rollout handoff item run review receipt validation command: ${packet.paths.coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate || ""}`,
    `- Coverage enrollment follow-up handoff queue command: ${packet.paths.coverageEnrollmentFollowUpHandoffQueueCommandTemplate}`,
    `- Coverage enrollment follow-up handoff item command builder: ${packet.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilderHtml || packet.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilder || ""}`,
    `- Coverage enrollment follow-up handoff item command builder command: ${packet.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate || ""}`,
    `- Coverage enrollment follow-up handoff item runner command: ${packet.paths.coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandTemplate}`,
    `- Coverage enrollment follow-up handoff item run review receipt builder command: ${packet.paths.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate || ""}`,
    `- Coverage enrollment follow-up handoff item run review receipt validation command: ${packet.paths.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate || ""}`,
    `- Execution follow-up receipt builder: ${packet.paths.executionFollowUpReceiptBuilder}`,
    `- Execution follow-up receipt builder HTML: ${packet.paths.executionFollowUpReceiptBuilderHtml}`,
    `- Action logic source contract package: ${packet.paths.actionLogicSourceContractPackageHtml || packet.paths.actionLogicSourceContractPackage || ""}`,
    `- Action logic source contract receipt template: ${packet.paths.actionLogicSourceContractReceiptTemplate || ""}`,
    `- Execution gap review cockpit: ${packet.paths.executionGapReviewCockpitHtml || packet.paths.executionGapReviewCockpit || ""}`,
    `- Execution gap review cockpit receipt template: ${packet.paths.executionGapReviewCockpitReceiptTemplate || ""}`,
    `- Execution follow-up handoff queue command: ${packet.paths.executionFollowUpHandoffQueueCommandTemplate}`,
    `- Execution follow-up handoff item command builder: ${packet.paths.executionFollowUpHandoffItemCommandBuilderHtml || packet.paths.executionFollowUpHandoffItemCommandBuilder || ""}`,
    `- Execution follow-up handoff item command builder command: ${packet.paths.executionFollowUpHandoffItemCommandBuilderCommandTemplate || ""}`,
    `- Execution follow-up handoff item dry-run command: ${packet.paths.executionFollowUpHandoffQueueItemRunnerCommandTemplate}`,
    `- Execution handoff item receipt builder command: ${packet.paths.executionFollowUpHandoffItemReceiptBuilderCommandTemplate}`,
    `- Execution handoff item receipt validation command: ${packet.paths.executionFollowUpHandoffItemReceiptValidationCommandTemplate}`,
    `- Execution approval gate prep runner command: ${packet.paths.executionApprovalGatePrepRunnerCommandTemplate}`,
    `- Execution approved gate command builder: ${packet.paths.executionApprovedGateCommandBuilderHtml || packet.paths.executionApprovedGateCommandBuilder || ""}`,
    `- Execution approved gate command builder command: ${packet.paths.executionApprovedGateCommandBuilderCommandTemplate || ""}`,
    `- Execution approved gate runner command: ${packet.paths.executionApprovedGateRunnerCommandTemplate}`,
    `- Operational registration approved command builder: ${packet.paths.operationalRegistrationApprovedCommandBuilderHtml || packet.paths.operationalRegistrationApprovedCommandBuilder || ""}`,
    `- Operational registration approved command builder command: ${packet.paths.operationalRegistrationApprovedCommandBuilderCommandTemplate || ""}`,
    `- Operational registration approved runner command: ${packet.paths.operationalRegistrationApprovedRunnerCommandTemplate}`,
    `- Operational post-registration output witness command builder: ${packet.paths.operationalPostRegistrationOutputWitnessCommandBuilderHtml || packet.paths.operationalPostRegistrationOutputWitnessCommandBuilder || ""}`,
    `- Operational post-registration output witness command builder command: ${packet.paths.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate || ""}`,
    `- Operational post-registration output witness runner command: ${packet.paths.operationalPostRegistrationOutputWitnessRunnerCommandTemplate}`,
    `- Operational post-registration output witness receipt builder: ${packet.paths.operationalPostRegistrationOutputWitnessReceiptBuilderHtml || packet.paths.operationalPostRegistrationOutputWitnessReceiptBuilder || ""}`,
    `- Operational post-registration output witness receipt builder command: ${packet.paths.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate || ""}`,
    `- Operational post-registration output witness receipt validation command: ${packet.paths.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate || ""}`,
    `- Review entrypoint health audit: ${packet.paths.reviewEntrypointHealthAuditHtml}`,
    `- Retained rollback point: ${packet.paths.rollbackPointManifest}`,
    `- Original-goal low-token coverage evidence dossier: ${packet.paths.originalGoalLowTokenCoverageEvidenceDossierHtml || packet.paths.originalGoalLowTokenCoverageEvidenceDossier || ""}`,
    `- Original-goal low-token coverage evidence dossier status: ${packet.refreshedEvidence.originalGoalLowTokenCoverageEvidenceDossierStatus || ""}`,
    `- Original-goal low-token coverage dossier receipt builder: ${packet.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml || packet.paths.originalGoalLowTokenCoverageDossierReceiptBuilder || ""}`,
    `- Original-goal low-token coverage dossier receipt validation command: ${packet.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate || ""}`,
    `- Original-goal low-token coverage dossier receipt validation: ${packet.paths.originalGoalLowTokenCoverageDossierReceiptValidation || ""}; status: ${packet.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationStatus || ""}`,
    `- Original-goal low-token coverage completion gate command: ${packet.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate || ""}`,
    `- Original-goal low-token coverage completion gate: ${packet.paths.originalGoalLowTokenCoverageCompletionGate || ""}; status: ${packet.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateStatus || ""}; can claim original goal: ${packet.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateCanClaimOriginalGoalComplete ?? ""}`,
    `- Original-goal low-token coverage waiting row cockpit: ${packet.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml || packet.paths.originalGoalLowTokenCoverageWaitingRowCockpit || ""}`,
    `- Original-goal low-token coverage waiting row cockpit receipt template: ${packet.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate || ""}`,
    `- Original-goal low-token coverage waiting row cockpit receipt validation command: ${packet.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || ""}`,
    `- Original-goal low-token coverage waiting row cockpit safe text rendering: ${packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitUsesSafeTextRendering ?? false}`,
    `- Original-goal ready metadata-gate shortlist: ${packet.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml || packet.paths.originalGoalLowTokenReadyMetadataGateShortlist || ""}`,
    `- Original-goal ready metadata-gate draft receipt: ${packet.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt || ""}`,
    `- Original-goal ready metadata-gate draft receipt validation command: ${packet.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || ""}`,
    `- Original-goal ready metadata-gate draft is teacher confirmation: ${!(packet.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftIsNotTeacherConfirmation ?? true)}`,
    `- Original-goal metadata-gate preflight receipt draft command from passed waiting-row validation: ${packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || ""}`,
    `- Original-goal metadata-gate preflight receipt draft command ready: ${packet.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandReady ?? false}`,
    `- Original-goal low-token blocked waiting row evidence plan: ${packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml || packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan || ""}`,
    `- Original-goal low-token fallback route evidence pack: ${packet.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml || packet.paths.originalGoalLowTokenFallbackRouteEvidencePack || ""}`,
    `- Original-goal low-token fallback route evidence pack receipt builder: ${packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml || packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder || ""}`,
    `- Original-goal low-token fallback route evidence pack receipt validation command: ${packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate || ""}`,
    `- Original-goal low-token fallback route evidence pack receipt validation: ${packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidation || ""}; ready rows: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationReadyRows ?? ""}; invalid rows: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationInvalidRows ?? ""}`,
    `- Original-goal low-token fallback route manual review pack: ${packet.paths.originalGoalLowTokenFallbackRouteManualReviewPackHtml || packet.paths.originalGoalLowTokenFallbackRouteManualReviewPack || ""}; manual rows: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackManualRows ?? ""}`,
    `- Original-goal low-token fallback route manual review patch template: ${packet.paths.originalGoalLowTokenFallbackRouteManualReviewPatchTemplate || ""}`,
    `- Original-goal low-token fallback route manual review command: ${packet.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate || ""}`,
    `- Original-goal low-token fallback route manual review patch validation command: ${packet.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || ""}`,
    `- Original-goal low-token fallback route manual review patch validation: ${packet.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidation || ""}; ready rows: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationReadyRows ?? ""}; blocked rows: ${packet.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationBlockedRows ?? ""}`,
    `- Original-goal low-token fallback route evidence-plan receipt draft command: ${packet.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || ""}`,
    `- Original-goal low-token compact evidence teacher launchpad: ${packet.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml || packet.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad || ""}; rows: ${packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRows ?? ""}; status: ${packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadStatus || ""}; run requires rollback: ${packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRollback ?? false}; run requires retained rollback manifest contract: ${packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRetainedRollbackManifestContract ?? false}`,
    `- Original-goal low-token compact evidence learning review validation command: ${packet.paths.originalGoalLowTokenCompactEvidenceLearningReviewValidationCommandTemplate || ""}`,
    `- Original-goal low-token compact evidence learning review validation status: ${packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationStatus || ""}`,
    `- Original-goal low-token compact learning disabled rule draft command: ${packet.paths.originalGoalLowTokenCompactLearningDisabledRuleDraftCommandTemplate || ""}`,
    `- Original-goal low-token compact learning disabled rule draft status: ${packet.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftStatus || ""}`,
    `- Original-goal low-token blocked waiting row evidence plan receipt builder: ${packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml || packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder || ""}`,
    `- Original-goal low-token blocked waiting row evidence plan receipt validation command: ${packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate || ""}`,
    `- Original-goal low-token evidence return cockpit receipt builder command: ${packet.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || ""}`,
    `- Original-goal low-token evidence return cockpit receipt validation runner command: ${packet.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || ""}`,
    `- Original-goal final completion gate command: ${packet.paths.originalGoalFinalCompletionGateCommandTemplate || ""}`,
    `- Original-goal final completion Rule DSL delivery-gate audit evidence: ${packet.paths.ruleDslDeliveryGateAudit || ""}; status: ${packet.refreshedEvidence.ruleDslDeliveryGateAuditStatus || ""}`,
    `- Rule DSL delivery-gate audit review receipt builder: ${packet.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml || packet.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder || ""}`,
    `- Rule DSL delivery-gate audit review receipt template: ${packet.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate || ""}`,
    `- Rule DSL delivery-gate audit review receipt validation command: ${packet.paths.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate || ""}`,
    `- Rule DSL delivery-gate audit review receipt validation: ${packet.paths.ruleDslDeliveryGateAuditReviewReceiptValidation || ""}`,
    `- Original-goal low-token coverage waiting rows: ${packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRows ?? ""}`,
    `- Original-goal low-token coverage waiting row cockpit ready rows: ${packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReadyRows ?? ""}`,
    `- Original-goal ready metadata-gate shortlist ready rows: ${packet.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistReadyRows ?? ""}`,
    `- Original-goal ready metadata-gate draft rows still requiring teacher flags: ${packet.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftRowsStillRequireTeacherFlags ?? ""}`,
    `- Original-goal low-token coverage waiting row cockpit log-source route rows: ${packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithLogSourceLedgerRoute ?? ""}`,
    `- Original-goal low-token coverage/log-source scope mismatch likely: ${packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitScopeMismatchLikely ?? false}`,
    `- Original-goal low-token route gaps covered by fallback review: ${packet.refreshedEvidence.originalGoalLowTokenRouteGapCoveredByFallbackReview ?? false}`,
    `- Original-goal low-token metadata gate preflight: ${packet.paths.originalGoalLowTokenMetadataGatePreflightHtml || packet.paths.originalGoalLowTokenMetadataGatePreflight || ""}`,
    `- Original-goal low-token metadata gate preflight status: ${packet.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightStatus || ""}`,
    `- Original-goal low-token metadata gate preflight receipt builder: ${packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml || packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder || ""}`,
    `- Original-goal low-token metadata gate preflight receipt template: ${packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptTemplate || ""}`,
    `- Original-goal low-token metadata gate preflight receipt validation command: ${packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate || ""}`,
    `- Original-goal low-token metadata gate validation command runner: ${packet.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || ""}`,
    `- Low-token operation preflight policy: ${packet.paths.lowTokenOperationPreflightPolicyHtml}`,
    `- Low-token trigger budget plan: ${packet.paths.lowTokenTriggerBudgetPlanHtml}`,
    `- All-software log source discovery ledger: ${packet.paths.logSourceDiscoveryLedgerReadme || packet.paths.logSourceDiscoveryLedger || ""}`,
    `- All-software log source discovery status: ${packet.refreshedEvidence.logSourceDiscoveryStatus || ""}; missing source rows: ${packet.refreshedEvidence.logSourceDiscoveryMissingRows ?? ""}`,
    `- Original-goal capability matrix coverage audit: ${packet.paths.originalGoalCapabilityMatrixCoverageAuditHtml || packet.paths.originalGoalCapabilityMatrixCoverageAudit || ""}`,
    `- Original-goal capability matrix coverage status: ${packet.refreshedEvidence.originalGoalCapabilityMatrixCoverageStatus || ""}; covered capabilities: ${packet.refreshedEvidence.originalGoalCapabilityMatrixCoveredCapabilities ?? ""}/${packet.refreshedEvidence.originalGoalCapabilityMatrixTotalCapabilities ?? ""}; missing: ${(packet.refreshedEvidence.originalGoalCapabilityMatrixMissingCapabilityIds || []).join(", ")}`,
    `- Original-goal capability matrix coverage audit command: ${packet.paths.originalGoalCapabilityMatrixCoverageAuditCommandTemplate || ""}`,
    `- Knowledge-augmented low-token learning smoke command: ${packet.paths.knowledgeAugmentedLowTokenLearningSmokeCommandTemplate || ""}`,
    `- Knowledge corpus ingest command for real teacher-approved sources: ${packet.paths.knowledgeCorpusIngestCommandTemplate || ""}`,
    `- Knowledge-augmented low-token learning command for real compact events: ${packet.paths.knowledgeAugmentedLowTokenLearningCommandTemplate || ""}`,
    `- Knowledge-augmented low-token learning evidence status: ${packet.refreshedEvidence.knowledgeAugmentedLowTokenLearningStatus || ""}`,
    `- RAG teacher source intake queue: ${packet.paths.ragResearchIntakeQueueReadme || packet.paths.ragResearchIntakeQueue || ""}`,
    `- RAG teacher source intake receipt builder: ${packet.paths.ragResearchIntakeReceiptBuilderReadme || packet.paths.ragResearchIntakeReceiptBuilder || ""}`,
    `- RAG teacher source intake receipt template: ${packet.paths.ragResearchIntakeReceiptTemplate || ""}`,
    `- RAG teacher source intake receipt validation command: ${packet.paths.ragResearchIntakeReceiptValidationCommandTemplate || ""}`,
    `- RAG confirmed source registry command: ${packet.paths.ragConfirmedSourceRegistryCommandTemplate || ""}`,
    `- RAG confirmed local ingest runner command: ${packet.paths.ragConfirmedLocalIngestRunnerCommandTemplate || ""}`,
    `- Knowledge-augmented low-token packet from confirmed ingest command: ${packet.paths.knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate || ""}`,
    `- TLCL RAG evidence to high-reasoning repair chain audit command: ${packet.paths.tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate || ""}`,
    `- TLCL RAG evidence to high-reasoning repair chain audit status: ${packet.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditStatus || ""}`,
    `- Knowledge-augmented spatial execution bridge review packet: ${packet.paths.knowledgeAugmentedSpatialExecutionBridgeCommandReview || ""}`,
    `- Knowledge-augmented spatial execution bridge command: ${packet.paths.knowledgeAugmentedSpatialExecutionBridgeCommandTemplate || ""}`,
    `- Knowledge-augmented spatial execution bridge status: ${packet.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeStatus || ""}`,
    `- Knowledge-augmented spatial execution bridge missing inputs: ${(packet.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeMissingInputs || []).join(", ")}`,
    `- Real-local full-goal integrated cycle smoke: ${packet.paths.realLocalFullGoalIntegratedCycleSmokeSummary || ""}; status: ${packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokeStatus || ""}; checks: ${packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokePassedChecks ?? ""}/${packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokeTotalChecks ?? ""}`,
    `- Event-triggered low-token observation policy: ${packet.paths.eventTriggeredObservationPolicyHtml || packet.paths.eventTriggeredObservationPolicy || ""}`,
    `- Event-triggered low-token observation policy receipt builder: ${packet.paths.eventTriggeredObservationPolicyReceiptBuilderHtml || packet.paths.eventTriggeredObservationPolicyReceiptBuilder || ""}`,
    `- Event-triggered low-token observation policy receipt template: ${packet.paths.eventTriggeredObservationPolicyReceiptTemplate || ""}`,
    `- Event-triggered low-token observation policy receipt validation command: ${packet.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate || ""}`,
    `- Triggered visual check command builder: ${packet.paths.triggeredVisualCheckCommandBuilderHtml || packet.paths.triggeredVisualCheckCommandBuilder || ""}`,
    `- Triggered visual check command builder command: ${packet.paths.triggeredVisualCheckCommandBuilderCommandTemplate || ""}`,
    `- Triggered visual capture command: ${packet.paths.triggeredVisualCaptureCommandTemplate}`,
    `- Triggered visual learning handoff command: ${packet.paths.triggeredVisualLearningHandoffCommandTemplate}`,
    `- Triggered visual learning card review command: ${packet.paths.triggeredVisualLearningHandoffReviewCommandTemplate}`,
    `- Triggered visual learning card review receipt validation command: ${packet.paths.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate || ""}`,
    `- Triggered visual voice/text numbered-target workbench command: ${packet.paths.triggeredVisualVoiceControlWorkbenchCommandTemplate}`,
    `- Non-expert engineering voice/text control capability: ${packet.paths.nonExpertEngineeringVoiceControlCapabilityHtml}`,
    `- Spatial intent evidence request: ${packet.paths.spatialIntentEvidenceRequestHtml}`,
    `- Transparent sketch overlay packet validation command: ${packet.paths.transparentSketchOverlayPacketValidationCommandTemplate || ""}`,
    `- Transparent sketch overlay packet validation: ${packet.paths.transparentSketchOverlayPacketValidation || ""}; status: ${packet.refreshedEvidence.transparentSketchOverlayPacketValidationStatus || ""}`,
    `- Spatial intent formal evidence entrypoint command: ${packet.paths.spatialIntentFormalEvidenceEntrypointCommandTemplate || ""}`,
    `- Spatial intent formal evidence entrypoint: ${packet.paths.spatialIntentFormalEvidenceEntrypointHtml || packet.paths.spatialIntentFormalEvidenceEntrypoint || ""}`,
    `- Spatial intent formal evidence boundary: formalSpatialIntentEvidencePresent=${packet.refreshedEvidence.formalSpatialIntentEvidencePresent ?? false}; entrypointReadyButNotTeacherEvidence=${packet.refreshedEvidence.formalSpatialIntentEvidenceEntrypointReadyButNotTeacherEvidence ?? false}`,
    `- Spatial intent evidence receipt builder: ${packet.paths.spatialIntentEvidenceReceiptBuilderHtml}`,
    `- Spatial intent evidence receipt template: ${packet.paths.spatialIntentEvidenceReceiptTemplate}`,
    `- Transparent sketch 2D perspective 3D implementation audit: ${packet.paths.sketchDemonstrationImplementationAudit || ""}`,
    `- Transparent sketch 2D perspective 3D implementation audit status: ${packet.refreshedEvidence.sketchDemonstrationImplementationAuditStatus || packet.discoveredEvidence.sketchDemonstrationImplementationAuditStatus || ""}`,
    `- Transparent sketch 2D perspective 3D implementation summary: ${JSON.stringify(packet.refreshedEvidence.sketchDemonstrationImplementationAuditSummary || packet.discoveredEvidence.sketchDemonstrationImplementationAuditSummary || {})}`,
    `- Transparent sketch depth rehearsal: ${packet.paths.transparentSketchDepthDemonstrationRehearsalHtml || packet.paths.transparentSketchDepthDemonstrationRehearsal}`,
    `- Transparent sketch depth rehearsal command: ${packet.paths.transparentSketchDepthDemonstrationRehearsalCommandTemplate}`,
    `- Transparent sketch depth rehearsal review receipt builder: ${packet.paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml || packet.paths.transparentSketchDepthRehearsalReviewReceiptBuilder || ""}`,
    `- Transparent sketch depth rehearsal review receipt template: ${packet.paths.transparentSketchDepthRehearsalReviewReceiptTemplate || ""}`,
    `- Transparent sketch depth rehearsal review receipt validation command: ${packet.paths.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || ""}`,
    `- Transparent sketch depth rehearsal review receipt validation: ${packet.paths.transparentSketchDepthRehearsalReviewReceiptValidation || ""}; status: ${packet.refreshedEvidence.transparentSketchDepthRehearsalReviewReceiptValidationStatus || ""}`,
    `- Spatial-to-software execution gate package: ${packet.paths.spatialToSoftwareExecutionGatePackageHtml || packet.paths.spatialToSoftwareExecutionGatePackage || ""}`,
    `- Spatial-to-software execution gate status: ${packet.refreshedEvidence.spatialToSoftwareExecutionGatePackageStatus || ""}; ready for dry-run route bridge: ${packet.refreshedEvidence.spatialToSoftwareExecutionGateReadyForDryRunRouteBridge ?? false}`,
    `- Spatial-to-software execution gate first blocker: ${JSON.stringify(packet.refreshedEvidence.spatialToSoftwareExecutionGateFirstBlocker || null)}`,
    `- Spatial-to-software first blocker handoff: ${packet.paths.spatialToSoftwareFirstBlockerHandoffHtml || packet.paths.spatialToSoftwareFirstBlockerHandoff || ""}`,
    `- Spatial-to-software first blocker first action: ${JSON.stringify(packet.refreshedEvidence.spatialToSoftwareFirstBlockerFirstTeacherAction || null)}`,
    `- Spatial-to-software first blocker next gate: ${packet.refreshedEvidence.spatialToSoftwareFirstBlockerNextGate || ""}; completion lane: ${packet.refreshedEvidence.spatialToSoftwareFirstBlockerCompletionBlockerLane || ""}`,
    `- Spatial route execution approval handoff: ${packet.refreshedEvidence.spatialRouteToExecutionApprovalHandoffFormat || ""}; next gate: ${packet.refreshedEvidence.spatialRouteToExecutionApprovalNextGate || ""}; ready=${packet.refreshedEvidence.spatialRouteToExecutionApprovalReadyForApprovalPrep ?? false}`,
    `- Spatial route approval safety locks: doesNotCreateGate=${packet.refreshedEvidence.spatialRouteBridgeDoesNotCreateApprovalGate ?? false}; doesNotRunRunner=${packet.refreshedEvidence.spatialRouteBridgeDoesNotRunApprovedGateRunner ?? false}`,
    `- Spatial route pilot-selection receipt gate: required before approval-prep reuse=${packet.refreshedEvidence.spatialRoutePilotSelectionRequiredBeforeApprovalPrepReuse ?? false}; commandReady=${packet.refreshedEvidence.spatialRoutePilotSelectionReceiptCommandReady ?? false}; validationReady=${packet.refreshedEvidence.spatialRoutePilotSelectionReceiptValidationCommandReady ?? false}`,
    `- Transparent sketch logic contract rule draft command: ${packet.paths.transparentSketchLogicContractRuleDraftCommandTemplate || ""}`,
    `- Transparent sketch logic contract rule draft: ${packet.paths.transparentSketchLogicContractRuleDraft || ""}; status: ${packet.refreshedEvidence.transparentSketchLogicContractRuleDraftStatus || ""}`,
    `- Teacher method execution-learning contract command: ${packet.paths.teacherMethodExecutionLearningContractCommandTemplate || ""}`,
    `- Teacher method execution-learning contract: ${packet.paths.teacherMethodExecutionLearningContract || ""}; status: ${packet.refreshedEvidence.teacherMethodExecutionLearningContractStatus || ""}`,
    `- Teacher method execution-learning contract receipt builder: ${packet.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml || packet.paths.teacherMethodExecutionLearningContractReceiptBuilder || ""}`,
    `- Teacher method execution-learning contract receipt template: ${packet.paths.teacherMethodExecutionLearningContractReceiptTemplate || ""}`,
    `- Teacher method execution-learning contract receipt validation command: ${packet.paths.teacherMethodExecutionLearningContractReceiptValidationCommandTemplate || ""}`,
    `- Teacher method execution-learning contract receipt gate ready: ${packet.refreshedEvidence.teacherMethodExecutionLearningContractReceiptBuilderReady ?? false}`,
    `- Teacher method reuse result proof builder: ${packet.paths.teacherMethodReuseResultProofBuilderHtml || packet.paths.teacherMethodReuseResultProofBuilder || ""}`,
    `- Teacher method reuse result proof template: ${packet.paths.teacherMethodReuseResultProofReceiptTemplate || ""}`,
    `- Teacher method reuse result proof validation command: ${packet.paths.teacherMethodReuseResultProofValidationCommandTemplate || ""}`,
    `- Teacher method reuse result proof gate ready: ${packet.refreshedEvidence.teacherMethodReuseResultProofBuilderReady ?? false}; ready for teacher receipt: ${packet.refreshedEvidence.teacherMethodReuseResultProofReadyForTeacherReceipt ?? false}`,
    `- Teacher method contract coverage: lowToken=${packet.refreshedEvidence.teacherMethodContractLowTokenMetadataFirst ?? false}; sketch=${packet.refreshedEvidence.teacherMethodContractTransparentOverlaySpatialIntent ?? false}; correction=${packet.refreshedEvidence.teacherMethodContractCorrectionBoundaryCounterexample ?? false}; modelTier=${packet.refreshedEvidence.teacherMethodContractHighToMediumModelTierPolicy ?? false}`,
    `- Post-activation witness receipt builder: ${packet.paths.operationalPostActivationWitnessReceiptBuilderHtml}`,
    `- Readiness audit: ${packet.paths.originalGoalReadinessAudit}`,
    `- Operational status console: ${packet.paths.operationalStatusConsole}`,
    `- Gap action board: ${packet.paths.gapActionBoard}`,
    `- Goal command center: ${packet.paths.goalCommandCenter}`,
    `- Original-goal integrated control flow: ${packet.paths.originalGoalIntegratedControlFlowHtml || packet.paths.originalGoalIntegratedControlFlow || ""}`,
    `- Original-goal integrated control flow command: ${packet.paths.originalGoalIntegratedControlFlowCommandTemplate || ""}`,
    "",
    "Next safe action:",
    packet.nextSafeAction,
    "",
    "Direct review entry points:",
    ...(directLinks.length
      ? directLinks.map((link) => `- ${link.label}: ${link.path || link.url || ""}`)
      : ["- No direct command-center entry points were generated in this refresh."]),
    "",
    "Next commands:",
    ...packet.nextCommands.map((row) => `- ${row.label}: ${row.command || "(not available in this refresh)"}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "This refresh does not register scheduled tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, or claim universal native execution."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeDashboard(path, packet) {
  const directLinks = Array.isArray(packet.directReviewEntryPoints) ? packet.directReviewEntryPoints : [];
  const lanes = packet.refreshedEvidence.statusLanes || [];
  const directCards = directLinks
    .map(
      (link) => `<a class="card" href="${htmlEscape(fileHref(link.path))}">
        <span class="label">${htmlEscape(link.label)}</span>
        <span class="id">${htmlEscape(link.id)}</span>
      </a>`
    )
    .join("\n");
  const commandCards = packet.nextCommands
    .map((row) => {
      const isPath = row.command && existsSync(row.command);
      const href = isPath ? fileHref(row.command) : "";
      const body = isPath
        ? `<a href="${htmlEscape(href)}">${htmlEscape(row.command)}</a>`
        : `<code>${htmlEscape(row.command || "(not available)")}</code>`;
      return `<article class="command"><h3>${htmlEscape(row.label)}</h3>${body}</article>`;
    })
    .join("\n");
  const laneRows = lanes
    .map(
      (lane) => `<tr>
        <td>${htmlEscape(lane.id)}</td>
        <td>${htmlEscape(lane.status)}</td>
        <td>${htmlEscape(lane.detail)}</td>
      </tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Current Status</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 26px 0 12px; font-size: 18px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 14px; letter-spacing: 0; }
    p { line-height: 1.55; }
    .summary, .command, table { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 32, 56, .06); }
    .summary { padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
    .card { display: flex; flex-direction: column; gap: 6px; min-height: 72px; padding: 14px; border: 1px solid #cdd8e7; border-radius: 8px; color: #14385f; background: #fff; text-decoration: none; }
    .card:hover { border-color: #1f5f99; box-shadow: 0 2px 8px rgba(31, 95, 153, .12); }
    .label { font-weight: 650; }
    .id, .muted { color: #627086; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    .command { padding: 14px; overflow-wrap: anywhere; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; }
    .locks { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Current Status</h1>
    <section class="summary">
      <p><strong>Status:</strong> ${htmlEscape(packet.status)}</p>
      <p><strong>Completion decision:</strong> ${htmlEscape(packet.completionDecision)}</p>
      <p><strong>Next safe action:</strong> ${htmlEscape(packet.nextSafeAction)}</p>
      <p><strong>Ordered triage:</strong> <a href="${htmlEscape(fileHref(packet.paths.nextActionTriageHtml))}">${htmlEscape(packet.paths.nextActionTriageHtml)}</a></p>
      <p><strong>Teacher action shortlist:</strong> ${htmlEscape(packet.refreshedEvidence.teacherActionShortlistStatus || "")}; actions: ${htmlEscape(packet.refreshedEvidence.teacherActionShortlistActions ?? "")}; first: ${htmlEscape(packet.refreshedEvidence.teacherActionShortlistFirstReviewEntry || "")}; <a href="${htmlEscape(fileHref(packet.paths.teacherActionShortlist || ""))}">${htmlEscape(packet.paths.teacherActionShortlist || "")}</a></p>
      <p><strong>Teacher action shortlist router receipt:</strong> ${htmlEscape(packet.refreshedEvidence.teacherActionShortlistRouterReceiptStatus || "")}; mapped: ${htmlEscape(packet.refreshedEvidence.teacherActionShortlistRouterReceiptMappedActions ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.teacherActionShortlistRouterReceiptTemplate || ""))}">${htmlEscape(packet.paths.teacherActionShortlistRouterReceiptTemplate || "")}</a>; <code>${htmlEscape(packet.paths.teacherActionShortlistRouterReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Original-goal next confirmation pack:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalNextConfirmationPackStatus || "")}; items: ${htmlEscape(packet.refreshedEvidence.originalGoalNextConfirmationPackItems ?? "")}; sensitive rows: ${htmlEscape(packet.refreshedEvidence.originalGoalNextConfirmationPackSensitiveManualRows ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalNextConfirmationPackHtml || packet.paths.originalGoalNextConfirmationPack || ""))}">${htmlEscape(packet.paths.originalGoalNextConfirmationPackHtml || packet.paths.originalGoalNextConfirmationPack || "")}</a></p>
      <p><strong>Original-goal next confirmation receipt builder:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderStatus || "")}; rows: ${htmlEscape(packet.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderRows ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalNextConfirmationPackReceiptBuilderHtml || packet.paths.originalGoalNextConfirmationPackReceiptBuilder || ""))}">${htmlEscape(packet.paths.originalGoalNextConfirmationPackReceiptBuilderHtml || packet.paths.originalGoalNextConfirmationPackReceiptBuilder || "")}</a></p>
      <p><strong>Original-goal proof ledger:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalProofLedgerStatus || "")}; missing proof: ${htmlEscape(packet.refreshedEvidence.originalGoalProofLedgerMissingProofCount ?? "")}; completion allowed: ${htmlEscape(packet.refreshedEvidence.originalGoalProofLedgerCompletionAllowed ?? false)}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofLedgerHtml || packet.paths.originalGoalProofLedger || ""))}">${htmlEscape(packet.paths.originalGoalProofLedgerHtml || packet.paths.originalGoalProofLedger || "")}</a></p>
      <p><strong>Original-goal proof gap closure pack:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapClosurePackStatus || "")}; routes: ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapClosurePackRoutes ?? "")}; high-risk gated: ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapClosurePackHighRiskGatedRoutes ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofGapClosurePackHtml || packet.paths.originalGoalProofGapClosurePack || ""))}">${htmlEscape(packet.paths.originalGoalProofGapClosurePackHtml || packet.paths.originalGoalProofGapClosurePack || "")}</a></p>
      <p><strong>Original-goal proof gap teacher review cockpit:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitStatus || "")}; rows: ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitRows ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofGapTeacherReviewCockpitHtml || packet.paths.originalGoalProofGapTeacherReviewCockpit || ""))}">${htmlEscape(packet.paths.originalGoalProofGapTeacherReviewCockpitHtml || packet.paths.originalGoalProofGapTeacherReviewCockpit || "")}</a></p>
      <p><strong>Original-goal proof gap teacher queue:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapTeacherQueueStatus || "")}; items: ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapTeacherQueueItems ?? "")}; high-risk gated: ${htmlEscape(packet.refreshedEvidence.originalGoalProofGapTeacherQueueHighRiskGatedItems ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofGapTeacherQueueHtml || packet.paths.originalGoalProofGapTeacherQueue || ""))}">${htmlEscape(packet.paths.originalGoalProofGapTeacherQueueHtml || packet.paths.originalGoalProofGapTeacherQueue || "")}</a>; evidence prefill: <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofGapEvidencePrefillHtml || packet.paths.originalGoalProofGapEvidencePrefill || ""))}">${htmlEscape(packet.paths.originalGoalProofGapEvidencePrefillHtml || packet.paths.originalGoalProofGapEvidencePrefill || "")}</a>; builder: <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofGapTeacherQueueReceiptBuilderHtml || packet.paths.originalGoalProofGapTeacherQueueReceiptBuilder || ""))}">${htmlEscape(packet.paths.originalGoalProofGapTeacherQueueReceiptBuilderHtml || packet.paths.originalGoalProofGapTeacherQueueReceiptBuilder || "")}</a>; receipt: <a href="${htmlEscape(fileHref(packet.paths.originalGoalProofGapTeacherQueueReceiptTemplate || ""))}">${htmlEscape(packet.paths.originalGoalProofGapTeacherQueueReceiptTemplate || "")}</a>; validation: <code>${htmlEscape(packet.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Teacher action router:</strong> <a href="${htmlEscape(fileHref(packet.paths.teacherActionRouterHtml))}">${htmlEscape(packet.paths.teacherActionRouterHtml)}</a></p>
      <p><strong>Teacher action router receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.teacherActionRouterReceiptBuilderHtml))}">${htmlEscape(packet.paths.teacherActionRouterReceiptBuilderHtml)}</a></p>
      <p><strong>Teacher action router receipt template:</strong> <a href="${htmlEscape(fileHref(packet.paths.teacherActionRouterReceiptTemplate))}">${htmlEscape(packet.paths.teacherActionRouterReceiptTemplate)}</a></p>
      <p><strong>Remaining gates low-token packet:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalRemainingGatesPacketHtml || packet.paths.originalGoalRemainingGatesPacket))}">${htmlEscape(packet.paths.originalGoalRemainingGatesPacketHtml || packet.paths.originalGoalRemainingGatesPacket || "")}</a></p>
      <p><strong>Remaining gates receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalRemainingGatesReceiptBuilderHtml || packet.paths.originalGoalRemainingGatesReceiptBuilder))}">${htmlEscape(packet.paths.originalGoalRemainingGatesReceiptBuilderHtml || packet.paths.originalGoalRemainingGatesReceiptBuilder || "")}</a></p>
      <p><strong>Remaining gates receipt template:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalRemainingGatesReceiptTemplate))}">${htmlEscape(packet.paths.originalGoalRemainingGatesReceiptTemplate || "")}</a></p>
      <p><strong>Remaining gates receipt validation command:</strong> <code>${htmlEscape(packet.paths.originalGoalRemainingGatesReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Original-goal handoff item command builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalReviewHandoffItemCommandBuilderHtml || packet.paths.originalGoalReviewHandoffItemCommandBuilder))}">${htmlEscape(packet.paths.originalGoalReviewHandoffItemCommandBuilderHtml || packet.paths.originalGoalReviewHandoffItemCommandBuilder || "")}</a></p>
      <p><strong>Original-goal handoff item command builder command:</strong> <code>${htmlEscape(packet.paths.originalGoalReviewHandoffItemCommandBuilderCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual check command builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.triggeredVisualCheckCommandBuilderHtml || packet.paths.triggeredVisualCheckCommandBuilder))}">${htmlEscape(packet.paths.triggeredVisualCheckCommandBuilderHtml || packet.paths.triggeredVisualCheckCommandBuilder || "")}</a></p>
      <p><strong>Triggered visual check command builder command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualCheckCommandBuilderCommandTemplate || "")}</code></p>
      <p><strong>Coverage rollout receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.coverageRolloutReceiptBuilderHtml || packet.paths.coverageRolloutReceiptBuilder))}">${htmlEscape(packet.paths.coverageRolloutReceiptBuilderHtml || packet.paths.coverageRolloutReceiptBuilder)}</a></p>
      <p><strong>Execution follow-up receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.executionFollowUpReceiptBuilderHtml || packet.paths.executionFollowUpReceiptBuilder))}">${htmlEscape(packet.paths.executionFollowUpReceiptBuilderHtml || packet.paths.executionFollowUpReceiptBuilder)}</a></p>
      <p><strong>Action logic source contract package:</strong> <a href="${htmlEscape(fileHref(packet.paths.actionLogicSourceContractPackageHtml || packet.paths.actionLogicSourceContractPackage))}">${htmlEscape(packet.paths.actionLogicSourceContractPackageHtml || packet.paths.actionLogicSourceContractPackage || "")}</a></p>
      <p><strong>Execution gap review cockpit:</strong> <a href="${htmlEscape(fileHref(packet.paths.executionGapReviewCockpitHtml || packet.paths.executionGapReviewCockpit))}">${htmlEscape(packet.paths.executionGapReviewCockpitHtml || packet.paths.executionGapReviewCockpit || "")}</a></p>
      <p><strong>Review entrypoint health:</strong> <a href="${htmlEscape(fileHref(packet.paths.reviewEntrypointHealthAuditHtml))}">${htmlEscape(packet.paths.reviewEntrypointHealthAuditHtml)}</a></p>
      <p><strong>Retained rollback point:</strong> <a href="${htmlEscape(fileHref(packet.paths.rollbackPointManifest))}">${htmlEscape(packet.paths.rollbackPointManifest)}</a></p>
      <p><strong>Low-token coverage evidence dossier:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenCoverageEvidenceDossierHtml || packet.paths.originalGoalLowTokenCoverageEvidenceDossier))}">${htmlEscape(packet.paths.originalGoalLowTokenCoverageEvidenceDossierHtml || packet.paths.originalGoalLowTokenCoverageEvidenceDossier || "")}</a></p>
      <p><strong>Low-token coverage dossier status:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageEvidenceDossierStatus || "")}; waiting rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRows ?? "")}</p>
      <p><strong>Low-token coverage dossier receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml || packet.paths.originalGoalLowTokenCoverageDossierReceiptBuilder))}">${htmlEscape(packet.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml || packet.paths.originalGoalLowTokenCoverageDossierReceiptBuilder || "")}</a></p>
      <p><strong>Low-token coverage dossier receipt validation command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Low-token coverage dossier receipt validation:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenCoverageDossierReceiptValidation || ""))}">${htmlEscape(packet.paths.originalGoalLowTokenCoverageDossierReceiptValidation || "")}</a>; status: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationStatus || "")}</p>
      <p><strong>Low-token coverage completion gate command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate || "")}</code></p>
      <p><strong>Low-token coverage completion gate:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenCoverageCompletionGate || ""))}">${htmlEscape(packet.paths.originalGoalLowTokenCoverageCompletionGate || "")}</a>; status: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateStatus || "")}; can claim original goal: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateCanClaimOriginalGoalComplete ?? "")}</p>
      <p><strong>Low-token coverage waiting row cockpit:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml || packet.paths.originalGoalLowTokenCoverageWaitingRowCockpit))}">${htmlEscape(packet.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml || packet.paths.originalGoalLowTokenCoverageWaitingRowCockpit || "")}</a></p>
      <p><strong>Low-token coverage waiting row cockpit ready rows:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReadyRows ?? "")}; blocked rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitBlockedRows ?? "")}</p>
      <p><strong>Low-token coverage waiting row cockpit route bridge:</strong> log-source route rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithLogSourceLedgerRoute ?? "")}; inherited proof fallback rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithInheritedProofFallbackRoute ?? "")}; safe text rendering: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitUsesSafeTextRendering ?? false)}</p>
      <p><strong>Low-token coverage/log-source scope diagnostic:</strong> likely mismatch: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitScopeMismatchLikely ?? false)}; rows without current log-source ledger match: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithoutCurrentLogSourceLedgerMatch ?? "")}</p>
      <p><strong>Low-token coverage waiting row cockpit receipt validation command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Ready metadata-gate shortlist:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml || packet.paths.originalGoalLowTokenReadyMetadataGateShortlist || ""))}">${htmlEscape(packet.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml || packet.paths.originalGoalLowTokenReadyMetadataGateShortlist || "")}</a>; ready rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistReadyRows ?? "")}; draft is not teacher confirmation: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftIsNotTeacherConfirmation ?? false)}</p>
      <p><strong>Ready metadata-gate draft receipt:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt || ""))}">${htmlEscape(packet.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt || "")}</a>; validation: <code>${htmlEscape(packet.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || "")}</code></p>
      <p><strong>Metadata-gate preflight receipt draft from passed waiting-row validation:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || "")}</code>; ready: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandReady ?? false)}</p>
      <p><strong>Low-token blocked waiting row evidence plan:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml || packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan))}">${htmlEscape(packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml || packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan || "")}</a></p>
      <p><strong>Low-token fallback route evidence pack:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml || packet.paths.originalGoalLowTokenFallbackRouteEvidencePack))}">${htmlEscape(packet.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml || packet.paths.originalGoalLowTokenFallbackRouteEvidencePack || "")}</a></p>
      <p><strong>Low-token fallback route receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml || packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder))}">${htmlEscape(packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml || packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder || "")}</a></p>
      <p><strong>Low-token fallback route receipt validation command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Low-token fallback route evidence-plan receipt draft command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || "")}</code></p>
      <p><strong>Low-token compact evidence teacher launchpad:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml || packet.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad || ""))}">${htmlEscape(packet.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml || packet.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad || "")}</a>; rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRows ?? "")}; status: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadStatus || "")}; run requires rollback: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRollback ?? false)}; run requires retained rollback manifest contract: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRetainedRollbackManifestContract ?? false)}</p>
      <p><strong>Low-token blocked waiting row evidence plan receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml || packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder))}">${htmlEscape(packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml || packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder || "")}</a></p>
      <p><strong>Low-token blocked waiting row evidence plan receipt validation command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Low-token evidence return cockpit receipt builder command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || "")}</code></p>
      <p><strong>Low-token evidence return cockpit receipt validation runner command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || "")}</code></p>
      <p><strong>Final completion gate command:</strong> <code>${htmlEscape(packet.paths.originalGoalFinalCompletionGateCommandTemplate || "")}</code></p>
      <p><strong>Final completion Rule DSL delivery-gate audit evidence:</strong> <a href="${htmlEscape(fileHref(packet.paths.ruleDslDeliveryGateAudit || ""))}">${htmlEscape(packet.paths.ruleDslDeliveryGateAudit || "")}</a>; status: ${htmlEscape(packet.refreshedEvidence.ruleDslDeliveryGateAuditStatus || "")}</p>
      <p><strong>Rule DSL delivery-gate audit review receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml || packet.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder || ""))}">${htmlEscape(packet.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml || packet.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder || "")}</a></p>
      <p><strong>Rule DSL delivery-gate audit review receipt template:</strong> <a href="${htmlEscape(fileHref(packet.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate || ""))}">${htmlEscape(packet.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate || "")}</a></p>
      <p><strong>Rule DSL delivery-gate audit review receipt validation command:</strong> <code>${htmlEscape(packet.paths.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Rule DSL delivery-gate audit review receipt validation:</strong> <a href="${htmlEscape(fileHref(packet.paths.ruleDslDeliveryGateAuditReviewReceiptValidation || ""))}">${htmlEscape(packet.paths.ruleDslDeliveryGateAuditReviewReceiptValidation || "")}</a></p>
      <p><strong>Low-token metadata gate preflight:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenMetadataGatePreflightHtml || packet.paths.originalGoalLowTokenMetadataGatePreflight))}">${htmlEscape(packet.paths.originalGoalLowTokenMetadataGatePreflightHtml || packet.paths.originalGoalLowTokenMetadataGatePreflight || "")}</a></p>
      <p><strong>Low-token metadata gate preflight status:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightStatus || "")}; ready rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReadyRows ?? "")}</p>
      <p><strong>Low-token metadata gate receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml || packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder))}">${htmlEscape(packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml || packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder || "")}</a></p>
      <p><strong>Low-token metadata gate receipt template:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptTemplate))}">${htmlEscape(packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptTemplate || "")}</a></p>
      <p><strong>Low-token metadata gate receipt validation command:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Low-token metadata gate validation command runner:</strong> <code>${htmlEscape(packet.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || "")}</code></p>
      <p><strong>Low-token operation preflight:</strong> <a href="${htmlEscape(fileHref(packet.paths.lowTokenOperationPreflightPolicyHtml))}">${htmlEscape(packet.paths.lowTokenOperationPreflightPolicyHtml)}</a></p>
      <p><strong>Low-token trigger budget plan:</strong> <a href="${htmlEscape(fileHref(packet.paths.lowTokenTriggerBudgetPlanHtml))}">${htmlEscape(packet.paths.lowTokenTriggerBudgetPlanHtml)}</a></p>
      <p><strong>All-software log source discovery:</strong> <a href="${htmlEscape(fileHref(packet.paths.logSourceDiscoveryLedgerReadme || packet.paths.logSourceDiscoveryLedger))}">${htmlEscape(packet.paths.logSourceDiscoveryLedgerReadme || packet.paths.logSourceDiscoveryLedger || "")}</a></p>
      <p><strong>Log-source discovery status:</strong> ${htmlEscape(packet.refreshedEvidence.logSourceDiscoveryStatus || "")}; rows: ${htmlEscape(packet.refreshedEvidence.logSourceDiscoveryLedgerRows ?? "")}; missing source rows: ${htmlEscape(packet.refreshedEvidence.logSourceDiscoveryMissingRows ?? "")}; complete: ${htmlEscape(packet.refreshedEvidence.allSoftwareLogSourceDiscoveryComplete ?? false)}</p>
      <p><strong>Low-token fallback route review:</strong> waiting rows needing route: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanRowsNeedingLogSourceRoute ?? "")}; fallback rows: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackRows ?? "")}; candidate routes: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackCandidateRoutes ?? "")}; route gaps covered by fallback review: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenRouteGapCoveredByFallbackReview ?? false)}</p>
      <p><strong>Original-goal capability matrix coverage:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalCapabilityMatrixCoverageStatus || "")}; covered ${htmlEscape(packet.refreshedEvidence.originalGoalCapabilityMatrixCoveredCapabilities ?? "")}/${htmlEscape(packet.refreshedEvidence.originalGoalCapabilityMatrixTotalCapabilities ?? "")}; missing: ${htmlEscape((packet.refreshedEvidence.originalGoalCapabilityMatrixMissingCapabilityIds || []).join(", "))}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalCapabilityMatrixCoverageAuditHtml || packet.paths.originalGoalCapabilityMatrixCoverageAudit || ""))}">audit page</a>; <code>${htmlEscape(packet.paths.originalGoalCapabilityMatrixCoverageAuditCommandTemplate || "")}</code></p>
      <p><strong>All-software unattended learning audit:</strong> ${htmlEscape(packet.refreshedEvidence.allSoftwareUnattendedLearningAuditStatus || "")}; gaps: ${htmlEscape(packet.refreshedEvidence.allSoftwareUnattendedLearningAuditRemainingGaps ?? "")}; complete: ${htmlEscape(packet.refreshedEvidence.unattendedAllAppMonitoringComplete ?? false)}; <a href="${htmlEscape(fileHref(packet.paths.allSoftwareUnattendedLearningAuditReadme || packet.paths.allSoftwareUnattendedLearningAudit || ""))}">audit</a></p>
      <p><strong>Original-goal low-token monitor bridge:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeStatus || "")}; routes: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeRoutes ?? "")}; recommended route: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorEvidenceAwareRecommendedRoute || "")}; coverage ready: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorCoverageArtifactsReady ?? false)}; readiness ready: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorReadinessPackageReady ?? false)}; completion allowed: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeCompletionAllowed ?? false)}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenMonitorCommandBridgeHtml || packet.paths.originalGoalLowTokenMonitorCommandBridge || ""))}">bridge</a></p>
      <p><strong>Original-goal low-token monitor next evidence-aware action:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorNextEvidenceAwareAction || "")}</p>
      <p><strong>Original-goal low-token monitor bridge receipt builder:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderStatus || "")}; routes: ${htmlEscape(packet.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderRoutes ?? "")}; <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml || packet.paths.originalGoalLowTokenMonitorBridgeReceiptBuilder || ""))}">teacher receipt builder</a>; receipt template: <a href="${htmlEscape(fileHref(packet.paths.originalGoalLowTokenMonitorBridgeReceiptTemplate || ""))}">template</a>; validation: <code>${htmlEscape(packet.paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate || "")}</code>; selected route builder: <code>${htmlEscape(packet.paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate || "")}</code></p>
      <p><strong>Recurring monitor teacher confirmation package:</strong> ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationPackageStatus || "")}; rows: ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationRows ?? "")}; rows needing teacher: ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationRowsNeedingReview ?? "")}; entrypoint ready: ${htmlEscape(packet.refreshedEvidence.unattendedApprovalGapsHaveTeacherConfirmationEntryPoint ?? false)}; <a href="${htmlEscape(fileHref(packet.paths.recurringMonitorTeacherConfirmationPackageHtml || packet.paths.recurringMonitorTeacherConfirmationPackageReadme || packet.paths.recurringMonitorTeacherConfirmationPackage || ""))}">review package</a>; <code>${htmlEscape(packet.paths.recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Recurring monitor teacher confirmation receipt validation:</strong> ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationReceiptValidationStatus || "")}; decision: ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationReceiptValidationDecision || "")}; missing rows: ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationReceiptValidationMissingRows ?? "")}; ready to rerun approval gate: ${htmlEscape(packet.refreshedEvidence.recurringMonitorTeacherConfirmationReceiptReadyToRerunApprovalGate ?? false)}; <a href="${htmlEscape(fileHref(packet.paths.recurringMonitorTeacherConfirmationReceiptValidationReadme || packet.paths.recurringMonitorTeacherConfirmationReceiptValidation || ""))}">validation</a></p>
      <p><strong>Recurring monitor post-confirmation chain:</strong> dry-run registration: <code>${htmlEscape(packet.paths.recurringMonitorRegistrationRunnerDryRunCommandTemplate || "")}</code><br>read-only status verifier: <code>${htmlEscape(packet.paths.recurringMonitorRegistrationStatusVerifierCommandTemplate || "")}</code></p>
      <p><strong>Knowledge-augmented low-token learning:</strong> ${htmlEscape(packet.refreshedEvidence.knowledgeAugmentedLowTokenLearningStatus || "")}; smoke: <code>${htmlEscape(packet.paths.knowledgeAugmentedLowTokenLearningSmokeCommandTemplate || "")}</code></p>
      <p><strong>Real knowledge corpus ingest command:</strong> <code>${htmlEscape(packet.paths.knowledgeCorpusIngestCommandTemplate || "")}</code></p>
      <p><strong>Real low-token RAG augmentation command:</strong> <code>${htmlEscape(packet.paths.knowledgeAugmentedLowTokenLearningCommandTemplate || "")}</code></p>
      <p><strong>RAG teacher source intake queue:</strong> <a href="${htmlEscape(fileHref(packet.paths.ragResearchIntakeQueueReadme || packet.paths.ragResearchIntakeQueue || ""))}">${htmlEscape(packet.paths.ragResearchIntakeQueueReadme || packet.paths.ragResearchIntakeQueue || "")}</a></p>
      <p><strong>RAG teacher source intake receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.ragResearchIntakeReceiptBuilderReadme || packet.paths.ragResearchIntakeReceiptBuilder || ""))}">${htmlEscape(packet.paths.ragResearchIntakeReceiptBuilderReadme || packet.paths.ragResearchIntakeReceiptBuilder || "")}</a></p>
      <p><strong>RAG teacher source validation:</strong> <code>${htmlEscape(packet.paths.ragResearchIntakeReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>RAG confirmed source registry/local ingest:</strong> <code>${htmlEscape(packet.paths.ragConfirmedSourceRegistryCommandTemplate || "")}</code><br><code>${htmlEscape(packet.paths.ragConfirmedLocalIngestRunnerCommandTemplate || "")}</code></p>
      <p><strong>Confirmed RAG ingest to knowledge-augmented low-token packet:</strong> <code>${htmlEscape(packet.paths.knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate || "")}</code></p>
      <p><strong>TLCL RAG evidence to high-reasoning repair chain audit:</strong> ${htmlEscape(packet.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditStatus || "")}; <code>${htmlEscape(packet.paths.tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate || "")}</code></p>
      <p><strong>Knowledge-augmented spatial execution bridge:</strong> ${htmlEscape(packet.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeStatus || "")}; missing inputs: ${htmlEscape((packet.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeMissingInputs || []).join(", "))}; <a href="${htmlEscape(fileHref(packet.paths.knowledgeAugmentedSpatialExecutionBridgeCommandReview || ""))}">review packet</a>; <code>${htmlEscape(packet.paths.knowledgeAugmentedSpatialExecutionBridgeCommandTemplate || "")}</code></p>
      <p><strong>Real-local full-goal integrated cycle:</strong> ${htmlEscape(packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokeStatus || "")}; checks ${htmlEscape(packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokePassedChecks ?? "")}/${htmlEscape(packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokeTotalChecks ?? "")}; software ${htmlEscape(packet.refreshedEvidence.realLocalFullGoalIntegratedCycleSmokeSoftware || "")}; <a href="${htmlEscape(fileHref(packet.paths.realLocalFullGoalIntegratedCycleSmokeSummary || ""))}">summary</a></p>
      <p><strong>Event-triggered low-token observation policy:</strong> <a href="${htmlEscape(fileHref(packet.paths.eventTriggeredObservationPolicyHtml || packet.paths.eventTriggeredObservationPolicy))}">${htmlEscape(packet.paths.eventTriggeredObservationPolicyHtml || packet.paths.eventTriggeredObservationPolicy || "")}</a></p>
      <p><strong>Event-triggered policy receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.eventTriggeredObservationPolicyReceiptBuilderHtml || packet.paths.eventTriggeredObservationPolicyReceiptBuilder))}">${htmlEscape(packet.paths.eventTriggeredObservationPolicyReceiptBuilderHtml || packet.paths.eventTriggeredObservationPolicyReceiptBuilder || "")}</a></p>
      <p><strong>Event-triggered policy receipt validation command:</strong> <code>${htmlEscape(packet.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual check command builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.triggeredVisualCheckCommandBuilderHtml || packet.paths.triggeredVisualCheckCommandBuilder))}">${htmlEscape(packet.paths.triggeredVisualCheckCommandBuilderHtml || packet.paths.triggeredVisualCheckCommandBuilder || "")}</a></p>
      <p><strong>Triggered visual check command builder command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualCheckCommandBuilderCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual capture command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualCaptureCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual learning handoff command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualLearningHandoffCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual learning card review command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualLearningHandoffReviewCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual learning card review receipt validation command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Triggered visual voice/text numbered-target workbench command:</strong> <code>${htmlEscape(packet.paths.triggeredVisualVoiceControlWorkbenchCommandTemplate || "")}</code></p>
      <p><strong>Transparent sketch implementation audit:</strong> <a href="${htmlEscape(fileHref(packet.paths.sketchDemonstrationImplementationAudit))}">${htmlEscape(packet.paths.sketchDemonstrationImplementationAudit || "")}</a></p>
      <p><strong>Transparent sketch implementation status:</strong> ${htmlEscape(packet.refreshedEvidence.sketchDemonstrationImplementationAuditStatus || packet.discoveredEvidence.sketchDemonstrationImplementationAuditStatus || "")}</p>
      <p><strong>Transparent sketch implementation boundary:</strong> 2D/perspective/3D evidence can be reviewed and routed through numbered confirmation; universal unattended native execution remains unproven.</p>
      <p><strong>Spatial intent formal evidence entrypoint:</strong> <a href="${htmlEscape(fileHref(packet.paths.spatialIntentFormalEvidenceEntrypointHtml || packet.paths.spatialIntentFormalEvidenceEntrypoint || ""))}">${htmlEscape(packet.paths.spatialIntentFormalEvidenceEntrypointHtml || packet.paths.spatialIntentFormalEvidenceEntrypoint || "")}</a></p>
      <p><strong>Spatial intent formal evidence entrypoint command:</strong> <code>${htmlEscape(packet.paths.spatialIntentFormalEvidenceEntrypointCommandTemplate || "")}</code></p>
      <p><strong>Spatial intent evidence truth boundary:</strong> formal evidence present=${htmlEscape(packet.refreshedEvidence.formalSpatialIntentEvidencePresent ?? false)}; entrypoint ready but not teacher evidence=${htmlEscape(packet.refreshedEvidence.formalSpatialIntentEvidenceEntrypointReadyButNotTeacherEvidence ?? false)}</p>
      <p><strong>Transparent sketch depth rehearsal:</strong> <a href="${htmlEscape(fileHref(packet.paths.transparentSketchDepthDemonstrationRehearsalHtml || packet.paths.transparentSketchDepthDemonstrationRehearsal))}">${htmlEscape(packet.paths.transparentSketchDepthDemonstrationRehearsalHtml || packet.paths.transparentSketchDepthDemonstrationRehearsal || "")}</a></p>
      <p><strong>Transparent sketch depth rehearsal command:</strong> <code>${htmlEscape(packet.paths.transparentSketchDepthDemonstrationRehearsalCommandTemplate || "")}</code></p>
      <p><strong>Transparent sketch depth rehearsal review receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml || packet.paths.transparentSketchDepthRehearsalReviewReceiptBuilder))}">${htmlEscape(packet.paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml || packet.paths.transparentSketchDepthRehearsalReviewReceiptBuilder || "")}</a></p>
      <p><strong>Transparent sketch depth rehearsal review receipt template:</strong> <a href="${htmlEscape(fileHref(packet.paths.transparentSketchDepthRehearsalReviewReceiptTemplate))}">${htmlEscape(packet.paths.transparentSketchDepthRehearsalReviewReceiptTemplate || "")}</a></p>
      <p><strong>Transparent sketch depth rehearsal review receipt validation command:</strong> <code>${htmlEscape(packet.paths.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || "")}</code></p>
      <p><strong>Transparent sketch depth rehearsal review receipt validation:</strong> <a href="${htmlEscape(fileHref(packet.paths.transparentSketchDepthRehearsalReviewReceiptValidation || ""))}">${htmlEscape(packet.paths.transparentSketchDepthRehearsalReviewReceiptValidation || "")}</a>; status: ${htmlEscape(packet.refreshedEvidence.transparentSketchDepthRehearsalReviewReceiptValidationStatus || "")}</p>
      <p><strong>Spatial-to-software execution gate package:</strong> <a href="${htmlEscape(fileHref(packet.paths.spatialToSoftwareExecutionGatePackageHtml || packet.paths.spatialToSoftwareExecutionGatePackage || ""))}">${htmlEscape(packet.paths.spatialToSoftwareExecutionGatePackageHtml || packet.paths.spatialToSoftwareExecutionGatePackage || "")}</a></p>
      <p><strong>Spatial-to-software execution gate status:</strong> ${htmlEscape(packet.refreshedEvidence.spatialToSoftwareExecutionGatePackageStatus || "")}; ready for dry-run route bridge=${htmlEscape(packet.refreshedEvidence.spatialToSoftwareExecutionGateReadyForDryRunRouteBridge ?? false)}; blocks execution=${htmlEscape(packet.refreshedEvidence.spatialToSoftwareExecutionGatePackageBlocksExecution ?? false)}</p>
      <p><strong>Spatial-to-software execution gate first blocker:</strong> <code>${htmlEscape(JSON.stringify(packet.refreshedEvidence.spatialToSoftwareExecutionGateFirstBlocker || null))}</code></p>
      <p><strong>Spatial-to-software first blocker handoff:</strong> <a href="${htmlEscape(fileHref(packet.paths.spatialToSoftwareFirstBlockerHandoffHtml || packet.paths.spatialToSoftwareFirstBlockerHandoff || ""))}">${htmlEscape(packet.paths.spatialToSoftwareFirstBlockerHandoffHtml || packet.paths.spatialToSoftwareFirstBlockerHandoff || "")}</a></p>
      <p><strong>Spatial-to-software first blocker first action:</strong> <code>${htmlEscape(JSON.stringify(packet.refreshedEvidence.spatialToSoftwareFirstBlockerFirstTeacherAction || null))}</code></p>
      <p><strong>Spatial-to-software first blocker next gate:</strong> ${htmlEscape(packet.refreshedEvidence.spatialToSoftwareFirstBlockerNextGate || "")}; completion lane=${htmlEscape(packet.refreshedEvidence.spatialToSoftwareFirstBlockerCompletionBlockerLane || "")}; return to blocker matrix=${htmlEscape(packet.refreshedEvidence.spatialToSoftwareFirstBlockerReturnToCompletionBlockerMatrixAfterNextGate ?? false)}</p>
      <p><strong>Spatial route execution approval handoff:</strong> ${htmlEscape(packet.refreshedEvidence.spatialRouteToExecutionApprovalHandoffFormat || "")}; status=${htmlEscape(packet.refreshedEvidence.spatialRouteToExecutionApprovalHandoffStatus || "")}; next gate=${htmlEscape(packet.refreshedEvidence.spatialRouteToExecutionApprovalNextGate || "")}; prerequisite=${htmlEscape(packet.refreshedEvidence.spatialRouteToExecutionApprovalPrerequisiteGate || "")}; ready=${htmlEscape(packet.refreshedEvidence.spatialRouteToExecutionApprovalReadyForApprovalPrep ?? false)}</p>
      <p><strong>Spatial route approval safety locks:</strong> does not create approval gate=${htmlEscape(packet.refreshedEvidence.spatialRouteBridgeDoesNotCreateApprovalGate ?? false)}; does not run approved runner=${htmlEscape(packet.refreshedEvidence.spatialRouteBridgeDoesNotRunApprovedGateRunner ?? false)}; final runner=${htmlEscape(packet.refreshedEvidence.spatialRouteToExecutionApprovalFinalRunnerGate || "")}</p>
      <p><strong>Spatial route pilot-selection receipt gate:</strong> required before approval-prep reuse=${htmlEscape(packet.refreshedEvidence.spatialRoutePilotSelectionRequiredBeforeApprovalPrepReuse ?? false)}; command ready=${htmlEscape(packet.refreshedEvidence.spatialRoutePilotSelectionReceiptCommandReady ?? false)}; validation ready=${htmlEscape(packet.refreshedEvidence.spatialRoutePilotSelectionReceiptValidationCommandReady ?? false)}; blocks direct reuse=${htmlEscape(packet.refreshedEvidence.spatialRouteApprovalPrepReuseBlockedUntilTeacherPilotSelectionReceipt ?? false)}</p>
      <p><strong>Transparent sketch logic contract rule draft command:</strong> <code>${htmlEscape(packet.paths.transparentSketchLogicContractRuleDraftCommandTemplate || "")}</code></p>
      <p><strong>Transparent sketch logic contract rule draft:</strong> <a href="${htmlEscape(fileHref(packet.paths.transparentSketchLogicContractRuleDraft || ""))}">${htmlEscape(packet.paths.transparentSketchLogicContractRuleDraft || "")}</a>; status: ${htmlEscape(packet.refreshedEvidence.transparentSketchLogicContractRuleDraftStatus || "")}</p>
      <p><strong>Teacher method execution-learning contract command:</strong> <code>${htmlEscape(packet.paths.teacherMethodExecutionLearningContractCommandTemplate || "")}</code></p>
      <p><strong>Teacher method execution-learning contract:</strong> <a href="${htmlEscape(fileHref(packet.paths.teacherMethodExecutionLearningContract || ""))}">${htmlEscape(packet.paths.teacherMethodExecutionLearningContract || "")}</a>; status: ${htmlEscape(packet.refreshedEvidence.teacherMethodExecutionLearningContractStatus || "")}</p>
      <p><strong>Teacher method contract receipt builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml || packet.paths.teacherMethodExecutionLearningContractReceiptBuilder || ""))}">${htmlEscape(packet.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml || packet.paths.teacherMethodExecutionLearningContractReceiptBuilder || "")}</a></p>
      <p><strong>Teacher method reuse result proof builder:</strong> <a href="${htmlEscape(fileHref(packet.paths.teacherMethodReuseResultProofBuilderHtml || packet.paths.teacherMethodReuseResultProofBuilder || ""))}">${htmlEscape(packet.paths.teacherMethodReuseResultProofBuilderHtml || packet.paths.teacherMethodReuseResultProofBuilder || "")}</a></p>
      <p><strong>Teacher method reuse result proof status:</strong> builder ready=${htmlEscape(packet.refreshedEvidence.teacherMethodReuseResultProofBuilderReady ?? false)}, ready for teacher receipt=${htmlEscape(packet.refreshedEvidence.teacherMethodReuseResultProofReadyForTeacherReceipt ?? false)}</p>
      <p><strong>Teacher method contract coverage:</strong> low-token metadata first=${htmlEscape(packet.refreshedEvidence.teacherMethodContractLowTokenMetadataFirst ?? false)}, transparent sketch spatial intent=${htmlEscape(packet.refreshedEvidence.teacherMethodContractTransparentOverlaySpatialIntent ?? false)}, correction repair=${htmlEscape(packet.refreshedEvidence.teacherMethodContractCorrectionBoundaryCounterexample ?? false)}, high/medium tier=${htmlEscape(packet.refreshedEvidence.teacherMethodContractHighToMediumModelTierPolicy ?? false)}</p>
      <p><strong>Real-local non-CAD/SolidWorks readiness scope:</strong> claim=${htmlEscape(packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessScopeClaim || "")}; non-CAD/SolidWorks candidates=${htmlEscape(packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksCandidates ?? 0)}; non-CAD/SolidWorks ledger rows=${htmlEscape(packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksLedgerRows ?? 0)}; bounded-not-complete=${htmlEscape(packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessBoundedNotComplete ?? false)}</p>
      <p><strong>Real-local all-software scope boundary:</strong> not CAD/SolidWorks only=${htmlEscape(packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNotCadSolidWorksOnly ?? false)}; CAD/SolidWorks candidates=${htmlEscape(packet.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessCadOrSolidWorksCandidates ?? 0)}; this remains a bounded local sample, not broad installed-software completion.</p>
      <p><strong>Original-goal integrated control flow:</strong> <a href="${htmlEscape(fileHref(packet.paths.originalGoalIntegratedControlFlowHtml || packet.paths.originalGoalIntegratedControlFlow))}">${htmlEscape(packet.paths.originalGoalIntegratedControlFlowHtml || packet.paths.originalGoalIntegratedControlFlow || "")}</a></p>
      <p><strong>Integrated control flow status:</strong> ${htmlEscape(packet.refreshedEvidence.originalGoalIntegratedControlFlowStatus || "")}; stages: ${htmlEscape(packet.refreshedEvidence.originalGoalIntegratedControlFlowStageCount ?? "")}; requirements: ${htmlEscape(packet.refreshedEvidence.originalGoalIntegratedControlFlowRequirementCount ?? "")}</p>
      <p class="locks">This dashboard does not register scheduled tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, accept technology, or claim universal native execution.</p>
    </section>
    <h2>Direct Review Entry Points</h2>
    <section class="grid">${directCards || "<p>No direct entry points were generated.</p>"}</section>
    <h2>Current Lanes</h2>
    <table>
      <thead><tr><th>Lane</th><th>Status</th><th>Detail</th></tr></thead>
      <tbody>${laneRows}</tbody>
    </table>
    <h2>Next Commands And Files</h2>
    <section class="grid">${commandCards}</section>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeCapabilityMatrixCoverageAuditHtml(path, audit) {
  const rows = (audit.capabilities || [])
    .map(
      (capability) => `<tr class="${capability.pass ? "ok" : "bad"}">
        <td>${htmlEscape(capability.id)}</td>
        <td>${capability.pass ? "covered" : "missing"}</td>
        <td>${htmlEscape(capability.description)}</td>
      </tr>`
    )
    .join("\n");
  const locks = Object.entries(audit.locks || {})
    .map(([key, value]) => `<li>${htmlEscape(key)}: ${htmlEscape(value)}</li>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Capability Matrix Coverage Audit</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    h2 { margin: 24px 0 10px; font-size: 18px; letter-spacing: 0; }
    p, li { line-height: 1.55; }
    .panel, table { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 32, 56, .06); }
    .panel { padding: 16px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    tr.bad { background: #fff0f0; }
    tr.ok { background: #fff; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Capability Matrix Coverage Audit</h1>
    <section class="panel">
      <p><strong>Status:</strong> ${audit.ok ? "covered_review_only_capability_matrix" : "missing_capability_matrix_coverage"}</p>
      <p><strong>Covered:</strong> ${(audit.coveredCapabilityIds || []).length}/${audit.capabilityCount || 0}</p>
      <p><strong>Missing:</strong> ${htmlEscape((audit.missingCapabilityIds || []).join(", ") || "none")}</p>
      <p class="lock">This page is for teacher review only. It does not execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim goal completion.</p>
    </section>
    <h2>Capability Rows</h2>
    <table>
      <thead><tr><th>Capability</th><th>Status</th><th>What It Covers</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Locks</h2>
    <section class="panel"><ul>${locks}</ul></section>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeNonExpertVoiceControlCapabilityHtml(path, capability) {
  const stepRows = capability.workflowSteps
    .map(
      (step) => `<tr>
        <td>${htmlEscape(step.order)}</td>
        <td>${htmlEscape(step.label)}</td>
        <td>${htmlEscape(step.trace)}</td>
        <td>${htmlEscape(step.status)}</td>
      </tr>`
    )
    .join("\n");
  const commandRows = capability.nextCommands
    .map(
      (row) => `<article class="command">
        <h3>${htmlEscape(row.label)}</h3>
        <code>${htmlEscape(row.command || "(not available)")}</code>
      </article>`
    )
    .join("\n");
  const blocked = capability.blockedActions.map((action) => `<li>${htmlEscape(action)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Non-Expert Engineering Voice Control Capability</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    h2 { margin: 24px 0 10px; font-size: 18px; letter-spacing: 0; }
    p, li { line-height: 1.55; }
    .panel, .command, table { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 32, 56, .06); }
    .panel { padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .command { padding: 14px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Non-Expert Engineering Voice Control Capability</h1>
    <section class="panel">
      <p><strong>Status:</strong> ${htmlEscape(capability.status)}</p>
      <p>${htmlEscape(capability.summary)}</p>
      <p class="lock">This capability does not execute target software. It waits for one teacher-confirmed number, dry-run evidence, target-window or route preflight, an explicit execute approval gate, and outcome verification.</p>
    </section>
    <h2>Workflow</h2>
    <table>
      <thead><tr><th>#</th><th>Step</th><th>Public Trace</th><th>Status</th></tr></thead>
      <tbody>${stepRows}</tbody>
    </table>
    <h2>Open Or Continue</h2>
    <section class="grid">${commandRows}</section>
    <h2>Blocked Actions</h2>
    <section class="panel"><ul>${blocked}</ul></section>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeSpatialIntentEvidenceRequestHtml(path, request) {
  const stepRows = request.teacherHandoffSteps
    .map(
      (step) => `<tr>
        <td>${htmlEscape(step.order)}</td>
        <td>${htmlEscape(step.action)}</td>
        <td>${htmlEscape(step.evidenceExpected)}</td>
        <td>${htmlEscape(step.stopCondition)}</td>
      </tr>`
    )
    .join("\n");
  const blocked = request.blockedActions.map((action) => `<li>${htmlEscape(action)}</li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial Intent Evidence Request</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    h2 { margin: 24px 0 10px; font-size: 18px; letter-spacing: 0; }
    p, li { line-height: 1.55; }
    .panel, table { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 32, 56, .06); }
    .panel { padding: 16px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Spatial Intent Evidence Request</h1>
    <section class="panel">
      <p><strong>Status:</strong> ${htmlEscape(request.status)}</p>
      <p>${htmlEscape(request.purpose)}</p>
      <p><strong>Overlay:</strong> <code>${htmlEscape(request.transparentSketchOverlayPath)}</code></p>
      <p><strong>Expected packet:</strong> <code>${htmlEscape(request.expectedPacketFormat)}</code></p>
      <p><strong>Next command template:</strong> <code>${htmlEscape(request.spatialTargetConfirmationCommandTemplate)}</code></p>
      <p class="lock">No spatial intent is accepted until a real teacher-exported packet replaces the placeholder. This request performs no screenshots, memory writes, packaging, or software execution.</p>
    </section>
    <h2>Teacher Handoff Steps</h2>
    <table>
      <thead><tr><th>#</th><th>Action</th><th>Expected Evidence</th><th>Stop If</th></tr></thead>
      <tbody>${stepRows}</tbody>
    </table>
    <h2>Blocked Actions</h2>
    <section class="panel"><ul>${blocked}</ul></section>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function pickEntryLinks(commandCenterPacket) {
  const wanted = new Set([
    "teacher_review_cockpit",
    "activation_receipt_builder",
    "coverage_rollout_receipt_builder",
    "execution_follow_up_receipt_builder",
    "control_channel_repair_receipt_builder",
    "execution_gap_review_cockpit",
    "transparent_sketch_overlay",
    "engineering_voice_control_workbench",
    "original_goal_gap_action_board",
    "current_operational_status"
  ]);
  return (commandCenterPacket?.entryLinks || [])
    .filter((link) => wanted.has(link.id))
    .map((link) => ({
      id: link.id,
      label: link.label,
      path: link.path || link.openPath || "",
      url: link.url || link.openUrl || ""
    }));
}

function entryPath(entryPoints, id) {
  return entryPoints.find((link) => link.id === id)?.path || "";
}

function firstStageOpenPath(commandCenterPacket, id) {
  return commandCenterPacket?.stages?.find((stage) => stage.id === id)?.openPath || "";
}

function firstNextCall(commandCenterPacket, key) {
  return commandCenterPacket?.nextCalls?.[key] || null;
}

function activationReceiptValidationCommand(commandCenterPacket, goal) {
  const nextCall = firstNextCall(commandCenterPacket, "activationReceiptValidation");
  if (nextCall?.command) return nextCall.command;
  const packetPath = commandCenterPacket?.paths?.activationReviewPacket || "";
  if (!packetPath) return "";
  return commandLine("validate-all-software-operational-activation-review-receipt.mjs", [
    ["--packet", packetPath],
    ["--receipt", "<teacher-filled-operational-activation-review-receipt.json>"],
    ["--goal", goal]
  ]);
}

function coverageRolloutReceiptValidationCommand(commandCenterPacket, goal) {
  const nextCall = firstNextCall(commandCenterPacket, "coverageRolloutReceiptValidation");
  if (nextCall?.command) return nextCall.command;
  const args = nextCall?.arguments || {};
  return commandLine("validate-all-software-coverage-rollout-receipt.mjs", [
    ["--plan", args.plan || "<transparent_ai_all_software_coverage_expansion_plan_v1 path>"],
    ["--receipt", args.receipt || "<teacher-filled-coverage-rollout-receipt.json>"],
    ["--goal", goal]
  ]);
}

function coverageRolloutHandoffQueueCommand(refreshDir) {
  return commandLine("create-all-software-coverage-rollout-handoff-queue.mjs", [
    ["--validation", "<coverage-rollout-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "coverage-rollout-handoff-queue")]
  ]);
}

function coverageRolloutHandoffQueueItemRunnerCommand(refreshDir) {
  return commandLine("run-all-software-coverage-rollout-handoff-queue-item.mjs", [
    ["--queue", "<coverage-rollout-handoff-queue.json>"],
    ["--item-number", "<teacher-reviewed-item-number>"],
    ["--run-reviewed-handoff", "true"],
    ["--allow-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-coverage-rollout-handoff-item-text>"],
    ["--rollback-point-created", "true"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(refreshDir, "coverage-rollout-handoff-item-run")]
  ]);
}

function coverageRolloutHandoffItemRunReviewReceiptBuilderCommand(refreshDir) {
  return commandLine("create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs", [
    ["--run", "<coverage-rollout-handoff-item-run.json>"],
    ["--run-receipt", "<coverage-rollout-handoff-item-run-receipt.json>"],
    ["--output-dir", join(refreshDir, "coverage-rollout-handoff-item-run-review-receipt-builder")]
  ]);
}

function coverageRolloutHandoffItemRunReviewReceiptValidationCommand(refreshDir) {
  return commandLine("validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs", [
    ["--builder", "<coverage-rollout-handoff-item-run-review-receipt-builder.json>"],
    ["--receipt", "<teacher-filled-coverage-rollout-handoff-item-run-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "coverage-rollout-handoff-item-run-review-receipt-validation")]
  ]);
}

function originalGoalLowTokenCoverageDossierReceiptBuilderCommand(refreshDir) {
  return commandLine("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs", [
    ["--dossier", "<original-goal-low-token-coverage-evidence-dossier.json>"],
    ["--output-dir", join(refreshDir, "low-token-coverage-dossier-receipt-builder")]
  ]);
}

function originalGoalLowTokenCoverageDossierReceiptValidationCommand(refreshDir) {
  return commandLine("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs", [
    ["--builder", "<original-goal-low-token-coverage-dossier-receipt-builder.json>"],
    ["--receipt", "<teacher-filled-low-token-coverage-dossier-receipt.json>"],
    ["--output-dir", join(refreshDir, "low-token-coverage-dossier-receipt-validation")]
  ]);
}

function originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommand(
  refreshDir,
  cockpitPath = "<original-goal-low-token-coverage-waiting-row-cockpit.json>"
) {
  return commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
    ["--cockpit", cockpitPath],
    ["--receipt", "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"],
    ["--output-dir", join(refreshDir, "low-token-coverage-waiting-row-cockpit-receipt-validation")]
  ]);
}

function originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommand(
  refreshDir,
  validationPath = "<ready-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.json>",
  cockpitPath = "<original-goal-low-token-coverage-waiting-row-cockpit.json>"
) {
  return commandLine("create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs", [
    ["--validation", validationPath],
    ["--cockpit", cockpitPath],
    ["--output-dir", join(refreshDir, "low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder")]
  ]);
}

function originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommand(
  refreshDir,
  builderPath = "<original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.json>"
) {
  return commandLine("run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs", [
    ["--builder", builderPath],
    ["--teacher-reviewed-draft", "<true-after-teacher-review>"],
    ["--rollback-retained", "<true-with-retained-rollback-point>"],
    ["--teacher-confirmation", "<teacher-reviewed-return-cockpit-receipt-draft-confirmation>"],
    ["--output-dir", join(refreshDir, "low-token-evidence-return-cockpit-receipt-validation-run")]
  ]);
}

function originalGoalLowTokenCoverageCompletionGateCommand(refreshDir, logSourceDiscoveryLedger = "<all-software-log-source-discovery-ledger.json>") {
  return commandLine("validate-original-goal-low-token-coverage-completion-gate.mjs", [
    ["--log-source-discovery-ledger", logSourceDiscoveryLedger],
    ["--dossier", "<original-goal-low-token-coverage-evidence-dossier.json>"],
    ["--dossier-validation", "<original-goal-low-token-coverage-dossier-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "low-token-coverage-completion-gate")]
  ]);
}

function originalGoalFinalCompletionGateCommand(
  refreshDir,
  completionBlockerMatrix = "<original-goal-completion-blocker-matrix.json>",
  ruleDslDeliveryGateAudit = "<rag-delivery-gate-audit-trail.json>",
  evidencePaths = {}
) {
  return commandLine("validate-original-goal-final-completion-gate.mjs", [
    ["--completion-blocker-matrix", completionBlockerMatrix],
    [
      "--low-token-coverage-gate",
      evidencePaths.lowTokenCoverageGate || "<original-goal-low-token-coverage-completion-gate.json>"
    ],
    [
      "--real-local-readiness-package",
      evidencePaths.realLocalReadinessPackage || "<real-local-all-software-low-token-readiness-package.json>"
    ],
    [
      "--teacher-method-contract-receipt-validation",
      evidencePaths.teacherMethodContractReceiptValidation ||
        "<teacher-method-execution-learning-contract-receipt-validation.json>"
    ],
    [
      "--teacher-method-reuse-result-proof-validation",
      evidencePaths.teacherMethodReuseResultProofValidation ||
        "<teacher-method-reuse-result-proof-validation.json>"
    ],
    ["--unattended-audit", evidencePaths.unattendedAudit || "<all-software-unattended-learning-audit.json>"],
    [
      "--sketch-implementation-audit",
      evidencePaths.sketchImplementationAudit || "<sketch-demonstration-implementation-audit.json>"
    ],
    [
      "--spatial-intent-receipt-validation",
      evidencePaths.spatialIntentReceiptValidation || "<spatial-intent-evidence-receipt-validation.json>"
    ],
    [
      "--execution-convergence-audit",
      evidencePaths.executionConvergenceAudit || "<all-software-execution-capability-convergence-audit.json>"
    ],
    ["--rule-dsl-delivery-gate-audit", ruleDslDeliveryGateAudit],
    ["--final-teacher-receipt-validation", "<original-goal-final-teacher-acceptance-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "final-completion-gate")]
  ]);
}

function originalGoalLowTokenMetadataGatePreflightReceiptBuilderCommand(refreshDir) {
  return commandLine("create-original-goal-low-token-metadata-gate-preflight-receipt-builder.mjs", [
    ["--preflight", "<original-goal-low-token-metadata-gate-preflight.json>"],
    ["--output-dir", join(refreshDir, "low-token-metadata-gate-preflight-receipt-builder")]
  ]);
}

function originalGoalLowTokenMetadataGatePreflightReceiptValidationCommand(refreshDir) {
  return commandLine("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs", [
    ["--preflight", "<original-goal-low-token-metadata-gate-preflight.json>"],
    ["--receipt", "<teacher-filled-low-token-metadata-gate-preflight-receipt.json>"],
    ["--output-dir", join(refreshDir, "low-token-metadata-gate-preflight-receipt-validation")]
  ]);
}

function originalGoalLowTokenMetadataGateValidationCommandRunnerCommand(refreshDir) {
  return commandLine("run-original-goal-low-token-metadata-gate-validation-command.mjs", [
    ["--validation", "<low-token-metadata-gate-preflight-receipt-validation.json>"],
    ["--run-reviewed-command", "true"],
    ["--allow-validation-command-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-low-token-metadata-gate-runner-text>"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(refreshDir, "low-token-metadata-gate-validation-command-run")]
  ]);
}

function originalGoalReviewHandoffQueueItemRunnerCommand(refreshDir) {
  return commandLine("run-original-goal-review-handoff-queue-item.mjs", [
    ["--queue", "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"],
    ["--item-number", "<teacher-reviewed-item-number>"],
    ["--receipt", "<teacher-filled-downstream-receipt-if-needed.json>"],
    ["--run-reviewed-handoff", "true"],
    ["--allow-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-original-goal-review-handoff-item-text>"],
    ["--rollback-point-created", "true"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(refreshDir, "original-goal-review-handoff-item-run")]
  ]);
}

function originalGoalCompletionBlockerLaneRequestRunnerCommand(refreshDir) {
  return commandLine("run-original-goal-completion-blocker-lane-request.mjs", [
    ["--request", "<teacher-downloaded-completion-blocker-lane-command-request.json>"],
    ["--run-reviewed-lane", "true"],
    ["--allow-safe-lane-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-completion-blocker-lane-text>"],
    ["--rollback-point-created", "true"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(refreshDir, "completion-blocker-lane-request-run")]
  ]);
}

function originalGoalCompletionBlockerLaneRequestReceiptBuilderCommand(refreshDir) {
  return commandLine("create-original-goal-completion-blocker-lane-request-receipt-builder.mjs", [
    ["--request", "<teacher-downloaded-completion-blocker-lane-command-request.json>"],
    ["--output-dir", join(refreshDir, "completion-blocker-lane-request-receipt-builder")]
  ]);
}

function originalGoalCompletionBlockerLaneRequestReceiptValidationCommand(refreshDir) {
  return commandLine("validate-original-goal-completion-blocker-lane-request-receipt.mjs", [
    ["--request", "<teacher-downloaded-completion-blocker-lane-command-request.json>"],
    ["--receipt", "<teacher-filled-completion-blocker-lane-request-receipt.json>"],
    ["--output-dir", join(refreshDir, "completion-blocker-lane-request-receipt-validation")]
  ]);
}

function originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommand(refreshDir) {
  return commandLine("create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs", [
    ["--run", "<completion-blocker-lane-request-run.json>"],
    ["--run-receipt", "<completion-blocker-lane-request-run-receipt.json>"],
    ["--output-dir", join(refreshDir, "completion-blocker-lane-run-review-receipt-builder")]
  ]);
}

function originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommand(refreshDir) {
  return commandLine("validate-original-goal-completion-blocker-lane-run-review-receipt.mjs", [
    ["--builder", "<completion-blocker-lane-run-review-receipt-builder.json>"],
    ["--receipt", "<teacher-filled-completion-blocker-lane-run-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "completion-blocker-lane-run-review-receipt-validation")]
  ]);
}

function originalGoalReviewHandoffItemCommandBuilderCommand(refreshDir) {
  return commandLine("create-original-goal-review-handoff-item-command-builder.mjs", [
    ["--queue", "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"],
    ["--output-dir", join(refreshDir, "original-goal-review-handoff-item-command-builder")]
  ]);
}

function triggeredVisualCheckCommandBuilderCommand(refreshDir, visualCheckQueuePath = "") {
  return commandLine("create-triggered-visual-check-command-builder.mjs", [
    ["--queue", visualCheckQueuePath || "<automatic-triggered-visual-check-queue.json>"],
    ["--output-dir", join(refreshDir, "triggered-visual-check-command-builder")]
  ]);
}

function coverageEnrollmentFollowUpReceiptValidationCommand(planPath, goal) {
  return commandLine("validate-all-software-coverage-enrollment-follow-up-receipt.mjs", [
    ["--plan", planPath || "<transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1 path>"],
    ["--receipt", "<teacher-filled-coverage-enrollment-follow-up-receipt.json>"],
    ["--goal", goal]
  ]);
}

function coverageEnrollmentFollowUpHandoffQueueCommand(refreshDir) {
  return commandLine("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs", [
    ["--validation", "<coverage-enrollment-follow-up-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "coverage-enrollment-follow-up-handoff-queue")]
  ]);
}

function coverageEnrollmentFollowUpHandoffItemCommandBuilderCommand(refreshDir) {
  return commandLine("create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs", [
    ["--queue", "<coverage-enrollment-follow-up-handoff-queue.json>"],
    ["--output-dir", join(refreshDir, "coverage-enrollment-follow-up-handoff-item-command-builder")]
  ]);
}

function coverageEnrollmentFollowUpHandoffQueueItemRunnerCommand(refreshDir) {
  return commandLine("run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs", [
    ["--queue", "<coverage-enrollment-follow-up-handoff-queue.json>"],
    ["--item-number", "<teacher-reviewed-item-number>"],
    ["--run-reviewed-handoff", "true"],
    ["--allow-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-coverage-enrollment-follow-up-item-text>"],
    ["--rollback-point-created", "true"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(refreshDir, "coverage-enrollment-follow-up-handoff-item-run")]
  ]);
}

function coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommand(refreshDir) {
  return commandLine("create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs", [
    ["--run", "<coverage-enrollment-follow-up-handoff-item-run.json>"],
    ["--run-receipt", "<coverage-enrollment-follow-up-handoff-item-run-receipt.json>"],
    ["--output-dir", join(refreshDir, "coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder")]
  ]);
}

function coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommand(refreshDir) {
  return commandLine("validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs", [
    ["--builder", "<coverage-enrollment-handoff-item-run-review-receipt-builder.json>"],
    ["--receipt", "<teacher-filled-coverage-enrollment-handoff-item-run-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "coverage-enrollment-follow-up-handoff-item-run-review-receipt-validation")]
  ]);
}

function executionFollowUpReceiptValidationCommand(commandCenterPacket, goal) {
  const nextCall = firstNextCall(commandCenterPacket, "executionFollowUpReceiptValidation");
  if (nextCall?.command) return nextCall.command;
  const args = nextCall?.arguments || {};
  return commandLine("validate-all-software-execution-follow-up-receipt.mjs", [
    ["--batch", args.batch || "<transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1 path>"],
    ["--receipt", args.receipt || "<teacher-filled-execution-follow-up-receipt.json>"],
    ["--goal", goal]
  ]);
}

function executionFollowUpHandoffQueueCommand(refreshDir) {
  return commandLine("create-all-software-execution-follow-up-handoff-queue.mjs", [
    ["--validation", "<execution-follow-up-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "execution-follow-up-handoff-queue")]
  ]);
}

function executionFollowUpHandoffItemCommandBuilderCommand(refreshDir) {
  return commandLine("create-all-software-execution-follow-up-handoff-item-command-builder.mjs", [
    ["--queue", "<execution-follow-up-handoff-queue.json>"],
    ["--output-dir", join(refreshDir, "execution-follow-up-handoff-item-command-builder")]
  ]);
}

function executionFollowUpHandoffQueueItemRunnerCommand(refreshDir) {
  return commandLine("run-all-software-execution-follow-up-handoff-queue-item.mjs", [
    ["--queue", "<execution-follow-up-handoff-queue.json>"],
    ["--row-id", "<teacher-reviewed-row-id>"],
    ["--output-dir", join(refreshDir, "execution-follow-up-handoff-item-run")]
  ]);
}

function executionFollowUpHandoffItemReceiptBuilderCommand(refreshDir) {
  return commandLine("create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs", [
    ["--run", "<execution-follow-up-handoff-item-run.json>"],
    ["--output-dir", join(refreshDir, "execution-handoff-item-receipt-builder")]
  ]);
}

function executionFollowUpHandoffItemReceiptValidationCommand(refreshDir) {
  return commandLine("validate-all-software-execution-follow-up-handoff-item-receipt.mjs", [
    ["--run", "<execution-follow-up-handoff-item-run.json>"],
    ["--receipt", "<teacher-filled-execution-handoff-item-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "execution-handoff-item-receipt-validation")]
  ]);
}

function executionApprovalGatePrepRunnerCommand(refreshDir) {
  return commandLine("run-all-software-execution-approval-gate-prep-runner.mjs", [
    ["--validation", "<execution-handoff-item-receipt-validation.json>"],
    ["--selector", "<real-local-execution-pilot-selector.json>"],
    ["--queue", "<execution-pilot-queue.json>"],
    ["--selected-pilot-id", "<teacher-reviewed-pilot-id>"],
    ["--adapter-id", "<teacher-reviewed-adapter-id>"],
    ["--reviewed-command", "<reviewed-existing-cli-command-manifest.json>"],
    ["--teacher-confirmation", "<teacher-confirmed-execution-pilot-text>"],
    ["--rollback-point-created", true],
    ["--output-dir", join(refreshDir, "execution-approval-gate-prep-runner")]
  ]);
}

function executionApprovedGateRunnerCommand(refreshDir) {
  return commandLine("run-all-software-execution-approved-gate-runner.mjs", [
    ["--gate", "<ready-real-local-execution-approval-gate.json>"],
    ["--execute-approved-gate", true],
    ["--teacher-confirmation", "<teacher-confirmed-approved-gate-runner-text>"],
    ["--rollback-point-created", true],
    ["--output-dir", join(refreshDir, "execution-approved-gate-runner")]
  ]);
}

function executionApprovedGateCommandBuilderCommand(refreshDir) {
  return commandLine("create-all-software-execution-approved-gate-command-builder.mjs", [
    ["--gate", "<ready-real-local-execution-approval-gate.json>"],
    ["--output-dir", join(refreshDir, "execution-approved-gate-command-builder")]
  ]);
}

function operationalRegistrationApprovedRunnerCommand(refreshDir) {
  return commandLine("run-all-software-operational-learning-registration-approved-runner.mjs", [
    ["--registration-execute-gate", "<ready-operational-registration-execute-gate.json>"],
    ["--execute-approved-registration", true],
    ["--allow-system-change", true],
    ["--teacher-confirmation", "<teacher-confirmed-approved-registration-runner-text>"],
    ["--rollback-point-created", true],
    ["--output-dir", join(refreshDir, "operational-registration-approved-runner")]
  ]);
}

function operationalRegistrationApprovedCommandBuilderCommand(refreshDir) {
  return commandLine("create-all-software-operational-registration-approved-command-builder.mjs", [
    ["--registration-execute-gate", "<ready-operational-registration-execute-gate.json>"],
    ["--output-dir", join(refreshDir, "operational-registration-approved-command-builder")]
  ]);
}

function recurringMonitorRegistrationRunnerDryRunCommand(refreshDir) {
  return commandLine("run-all-software-recurring-monitor-registration-runner.mjs", [
    ["--approval-gate", "<teacher-confirmed-recurring-monitor-approval-gate.json>"],
    ["--output-dir", join(refreshDir, "recurring-monitor-registration-runner-dry-run")]
  ]);
}

function recurringMonitorRegistrationStatusVerifierCommand(refreshDir) {
  return commandLine("verify-all-software-recurring-monitor-registration-status.mjs", [
    ["--registration-runner", "<teacher-reviewed-recurring-monitor-registration-runner.json>"],
    ["--output-dir", join(refreshDir, "recurring-monitor-registration-status-verification")]
  ]);
}

function operationalPostRegistrationOutputWitnessRunnerCommand(refreshDir) {
  return commandLine("run-all-software-operational-learning-post-registration-output-witness-runner.mjs", [
    ["--registration-status", "<registered-and-matching-recurring-monitor-status.json>"],
    ["--registration-approved-runner", "<registration-approved-runner.json>"],
    ["--dry-run-rehearsal", "<passed-operational-activation-dry-run-rehearsal.json>"],
    ["--registration-execute-gate", "<ready-operational-registration-execute-gate.json>"],
    ["--trigger-reviewed-output", true],
    ["--allow-runner-trigger", true],
    ["--teacher-confirmation", "<teacher-confirmed-post-registration-output-witness-text>"],
    ["--rollback-point-created", true],
    ["--output-dir", join(refreshDir, "operational-post-registration-output-witness-runner")]
  ]);
}

function operationalPostRegistrationOutputWitnessCommandBuilderCommand(refreshDir) {
  return commandLine("create-all-software-operational-post-registration-output-witness-command-builder.mjs", [
    ["--registration-status", "<registered-and-matching-recurring-monitor-status.json>"],
    ["--registration-approved-runner", "<registration-approved-runner.json>"],
    ["--dry-run-rehearsal", "<passed-operational-activation-dry-run-rehearsal.json>"],
    ["--registration-execute-gate", "<ready-operational-registration-execute-gate.json>"],
    ["--output-dir", join(refreshDir, "operational-post-registration-output-witness-command-builder")]
  ]);
}

function operationalPostRegistrationOutputWitnessReceiptBuilderCommand(refreshDir) {
  return commandLine("create-all-software-operational-post-registration-output-witness-receipt-builder.mjs", [
    ["--witness-runner", "<post-registration-output-witness-runner.json>"],
    ["--output-dir", join(refreshDir, "operational-post-registration-output-witness-receipt-builder")]
  ]);
}

function operationalPostRegistrationOutputWitnessReceiptValidationCommand(refreshDir) {
  return commandLine("validate-all-software-operational-post-registration-output-witness-receipt.mjs", [
    ["--builder", "<operational-post-registration-output-witness-receipt-builder.json>"],
    ["--receipt", "<teacher-filled-post-registration-output-witness-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "operational-post-registration-output-witness-receipt-validation")]
  ]);
}

function spatialIntentEvidenceReceiptValidationCommand(requestPath) {
  return commandLine("validate-spatial-intent-evidence-receipt.mjs", [
    ["--request", requestPath || "<transparent_ai_spatial_intent_evidence_request_v1 path>"],
    ["--receipt", "<teacher-filled-spatial-intent-evidence-receipt.json>"]
  ]);
}

function actionLogicSourceContractReceiptValidationCommand(packagePath) {
  return commandLine("validate-all-software-action-logic-source-contract-receipt.mjs", [
    ["--package", packagePath || "<action-logic-source-contract-package.json>"],
    ["--receipt", "<teacher-filled-action-logic-source-contract-receipt.json>"]
  ]);
}

function transparentSketchDepthRehearsalReviewReceiptBuilderCommand(rehearsalPath, refreshDir) {
  return commandLine("create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs", [
    ["--rehearsal", rehearsalPath || "<transparent-sketch-depth-demonstration-rehearsal.json>"],
    ["--output-dir", join(refreshDir, "transparent-sketch-depth-rehearsal-review-receipt-builder")]
  ]);
}

function transparentSketchDepthRehearsalReviewReceiptValidationCommand(builderPath, refreshDir) {
  return commandLine("validate-transparent-sketch-depth-rehearsal-review-receipt.mjs", [
    ["--builder", builderPath || "<transparent-sketch-depth-rehearsal-review-receipt-builder.json>"],
    ["--receipt", "<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "transparent-sketch-depth-rehearsal-review-receipt-validation")]
  ]);
}

function triagePriority(row) {
  const id = String(row.id || "");
  const lane = String(row.downstreamLane || row.lane || "");
  if (id.includes("operational_learning") || lane.includes("operational")) return 10;
  if (id.includes("spatial") || lane.includes("spatial")) return 15;
  if (id.includes("coverage") || lane.includes("coverage")) return 20;
  if (id.includes("action_logic_source")) return 25;
  if (id.includes("execution") || lane.includes("execution")) return 30;
  if (id.includes("activation") || lane.includes("activation")) return 40;
  return 90;
}

function triageRouteForRow(row, directLinks, commandCenterPacket, goal, actionLogicSourceContractPackagePath = "") {
  const id = String(row.id || "");
  const lane = String(row.downstreamLane || row.lane || "");
  const executionGapReviewCockpitPath = entryPath(directLinks, "execution_gap_review_cockpit");
  if (id.includes("operational_learning") || lane.includes("operational")) {
    return {
      reviewEntryId: "activation_receipt_builder",
      openPath: entryPath(directLinks, "activation_receipt_builder") || firstStageOpenPath(commandCenterPacket, "teacher_review_cockpit"),
      validationTool: firstNextCall(commandCenterPacket, "activationReceiptValidation")?.tool || "validate_all_software_operational_activation_review_receipt",
      validationCommand: activationReceiptValidationCommand(commandCenterPacket, goal),
      instruction:
        "Review the automatic low-token monitor confirmations first. Keep the rollback point retained and validate a teacher-filled activation receipt before any registration dry run."
    };
  }
  if (id.includes("activation") || lane.includes("activation")) {
    return {
      reviewEntryId: "activation_receipt_builder",
      openPath: entryPath(directLinks, "activation_receipt_builder") || firstStageOpenPath(commandCenterPacket, "teacher_review_cockpit"),
      validationTool: firstNextCall(commandCenterPacket, "activationReceiptValidation")?.tool || "validate_all_software_operational_activation_review_receipt",
      validationCommand: activationReceiptValidationCommand(commandCenterPacket, goal),
      instruction:
        "Resolve activation confirmation rows in the activation receipt builder, then validate the teacher-filled activation receipt before any registration dry run."
    };
  }
  if (id.includes("coverage") || lane.includes("coverage")) {
    return {
      reviewEntryId: "coverage_rollout_receipt_builder",
      openPath: entryPath(directLinks, "coverage_rollout_receipt_builder"),
      validationTool: firstNextCall(commandCenterPacket, "coverageRolloutReceiptValidation")?.tool || "validate_all_software_coverage_rollout_receipt",
      validationCommand: coverageRolloutReceiptValidationCommand(commandCenterPacket, goal),
      instruction:
        "Review the remaining all-software low-token coverage batches, generate a coverage rollout receipt, then validate it before running any coverage supervisor."
    };
  }
  if (id.includes("spatial") || lane.includes("spatial")) {
    return {
      reviewEntryId: "spatial_intent_evidence_request",
      openPath: entryPath(directLinks, "spatial_intent_evidence_request") || row.nextSafeCommand || "",
      validationTool: "validate_spatial_intent_evidence_receipt",
      validationCommand: spatialIntentEvidenceReceiptValidationCommand(row.evidencePath),
      instruction:
        "Open the spatial intent evidence request, collect a real teacher-exported transparent sketch packet, fill the spatial intent receipt, then validate it before creating numbered spatial target confirmation."
    };
  }
  if (id.includes("action_logic_source")) {
    return {
      reviewEntryId: executionGapReviewCockpitPath ? "execution_gap_review_cockpit" : "action_logic_source_contract_package",
      openPath: executionGapReviewCockpitPath || entryPath(directLinks, "action_logic_source_contract_package") || row.nextSafeCommand || "",
      validationTool: executionGapReviewCockpitPath
        ? "teacher_combined_execution_gap_review_then_validate_control_and_action_logic_receipts"
        : "validate_all_software_action_logic_source_contract_receipt",
      validationCommand: actionLogicSourceContractReceiptValidationCommand(actionLogicSourceContractPackagePath),
      instruction:
        "Open the execution gap review cockpit when available so the teacher confirms control route evidence and action logic together; then validate the action-logic receipt before medium-runtime reuse or any dry-run pilot."
    };
  }
  if (id.includes("execution") || lane.includes("execution")) {
    return {
      reviewEntryId: executionGapReviewCockpitPath ? "execution_gap_review_cockpit" : "execution_follow_up_receipt_builder",
      openPath: executionGapReviewCockpitPath || entryPath(directLinks, "execution_follow_up_receipt_builder"),
      validationTool: executionGapReviewCockpitPath
        ? "teacher_combined_execution_gap_review_then_validate_control_and_execution_receipts"
        : firstNextCall(commandCenterPacket, "executionFollowUpReceiptValidation")?.tool || "validate_all_software_execution_follow_up_receipt",
      validationCommand: executionFollowUpReceiptValidationCommand(commandCenterPacket, goal),
      instruction:
        "Open the execution gap review cockpit when available, confirm route evidence, action logic, exact targets, rollback, and verifier together, then validate the execution follow-up receipt before any dry-run runner is invoked."
    };
  }
  return {
    reviewEntryId: "teacher_review_cockpit",
    openPath: entryPath(directLinks, "teacher_review_cockpit"),
    validationTool: firstNextCall(commandCenterPacket, "teacherReviewCockpitReceiptValidation")?.tool || "validate_goal_teacher_review_cockpit_receipt",
    validationCommand: firstNextCall(commandCenterPacket, "teacherReviewCockpitReceiptValidation")?.command || "",
    instruction:
      "Use the teacher review cockpit to classify this gap, then validate the cockpit receipt before following any downstream command."
  };
}

function buildNextActionTriage({
  refreshId,
  goal,
  gapPacket,
  statusPacket,
  directLinks,
  commandCenterPacket,
  actionLogicSourceContractPackagePath,
  rollbackPoint,
  locks
}) {
  const actionRows = Array.isArray(gapPacket.actionRows) ? gapPacket.actionRows : [];
  const rows = actionRows
    .map((row, index) => {
      const route = triageRouteForRow(row, directLinks, commandCenterPacket, goal, actionLogicSourceContractPackagePath);
      return {
        order: index + 1,
        priority: triagePriority(row),
        id: row.id || `gap-row-${index + 1}`,
        lane: row.downstreamLane || row.lane || "unknown",
        label: row.label || row.nextAction || "Review current goal gap",
        currentStatus: row.currentStatus || "",
        evidencePath: row.evidencePath || "",
        nextSafeActionLabel: row.nextSafeActionLabel || row.nextAction || "Review before continuing",
        reviewEntryId: route.reviewEntryId,
        openPath: route.openPath,
        instruction: route.instruction,
        validationTool: route.validationTool,
        validationCommand: route.validationCommand || row.nextSafeCommand || "",
        rollbackPointManifestPath:
          route.reviewEntryId === "activation_receipt_builder" ? rollbackPoint?.manifestPath || "" : "",
        allowedTeacherDecisions: row.allowedTeacherDecisions || ["needs_teacher_review", "teacher_reviewed_continue", "blocked_needs_more_evidence"],
        blockedTeacherDecisions: row.blockedTeacherDecisions || ["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete"],
        locks: row.locks || locks
      };
    })
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .map((row, index) => ({ ...row, order: index + 1 }));

  return {
    ok: true,
    format: "transparent_ai_original_goal_next_action_triage_v1",
    refreshId,
    createdAt: new Date().toISOString(),
    goal,
    status: rows.length > 0 ? "waiting_for_teacher_reviewed_next_action" : "no_gap_rows_found_review_status_console",
    purpose:
      "Orders current original-goal blockers into teacher-reviewable next actions, with direct entry points and validation commands, without executing downstream actions.",
    counts: {
      rows: rows.length,
      directReviewEntryPoints: directLinks.length,
      statusLanes: Array.isArray(statusPacket.lanes) ? statusPacket.lanes.length : 0
    },
    recommendedFirstAction:
      rows[0]?.instruction ||
      "Review the operational status console, then refresh the current-status package after new evidence exists.",
    rollbackPoint: rollbackPoint
      ? {
          manifestPath: rollbackPoint.manifestPath,
          rollbackDir: rollbackPoint.rollbackDir,
          status: rollbackPoint.status,
          deleteOnlyAfterTeacherConfirmation: rollbackPoint.deleteOnlyAfterTeacherConfirmation === true
        }
      : null,
    rows,
    blockedActions: [
      "register_scheduled_task_from_triage",
      "launch_runner_from_triage",
      "execute_target_software_from_triage",
      "capture_screenshot_from_triage",
      "write_memory_from_triage",
      "claim_goal_complete_from_triage"
    ],
    locks
  };
}

function buildTeacherActionShortlist(triage, limit = 5) {
  const rows = Array.isArray(triage?.rows) ? triage.rows : [];
  const seen = new Set();
  const actions = [];
  for (const row of rows) {
    const key = row.reviewEntryId || row.id || `row-${row.order}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({
      order: actions.length + 1,
      sourceTriageOrder: row.order,
      id: row.id,
      lane: row.lane,
      label: row.label,
      reviewEntryId: row.reviewEntryId,
      openPath: row.openPath || "",
      validationTool: row.validationTool || "",
      validationCommand: row.validationCommand || "",
      instruction: row.instruction || "",
      allowedTeacherDecisions: row.allowedTeacherDecisions || [],
      blockedTeacherDecisions: row.blockedTeacherDecisions || [],
      locks: row.locks || triage?.locks || {}
    });
    if (actions.length >= limit) break;
  }
  return {
    ok: true,
    format: "transparent_ai_original_goal_teacher_action_shortlist_v1",
    status: actions.length > 0 ? "waiting_for_teacher_shortlist_review" : "no_teacher_action_rows_found",
    purpose:
      "Compresses the ordered blocker triage into a low-token, machine-readable first-action list for teacher review. It does not execute commands, register tasks, capture screenshots, write memory, enable rules, or claim completion.",
    sourceTriagePath: triage?.triagePath || "",
    counts: {
      actions: actions.length,
      sourceRows: rows.length,
      uniqueReviewEntryPoints: seen.size
    },
    recommendedFirstAction:
      actions[0]?.instruction ||
      triage?.recommendedFirstAction ||
      "Refresh current status after new teacher-reviewed evidence exists.",
    actions,
    blockedActions: [
      "execute_shortlist_command_automatically",
      "register_scheduled_task_from_shortlist",
      "launch_runner_from_shortlist",
      "capture_screenshot_from_shortlist",
      "write_memory_from_shortlist",
      "claim_goal_complete_from_shortlist"
    ],
    locks: triage?.locks || {}
  };
}

function normalizeForMatch(value) {
  return String(value || "").replace(/\\/g, "/").toLowerCase();
}

function findRouterRowForShortlistAction(action, routerRows) {
  const reviewEntryId = String(action.reviewEntryId || "");
  const openPath = normalizeForMatch(action.openPath);
  const lane = String(action.lane || "");
  const exact = routerRows.find(
    (row) =>
      String(row.reviewEntryId || "") === reviewEntryId &&
      normalizeForMatch(row.openPath) === openPath &&
      String(row.lane || "") === lane
  );
  if (exact) return exact;
  const reviewAndPath = routerRows.find(
    (row) => String(row.reviewEntryId || "") === reviewEntryId && normalizeForMatch(row.openPath) === openPath
  );
  if (reviewAndPath) return reviewAndPath;
  return routerRows.find((row) => String(row.reviewEntryId || "") === reviewEntryId) || null;
}

function buildTeacherActionShortlistRouterReceipt({ shortlist, router, receiptBuilder, templatePath, validationCommand, locks }) {
  const routerRows = Array.isArray(router?.routeRows) ? router.routeRows : [];
  const mappedActions = (shortlist.actions || []).map((action) => {
    const routerRow = findRouterRowForShortlistAction(action, routerRows);
    return {
      ...action,
      routerRowId: routerRow?.id || "",
      routerRowOrder: routerRow?.order || null,
      routerRowMatched: Boolean(routerRow),
      routerValidationCommand: routerRow?.validationCommand || action.validationCommand || ""
    };
  });
  const receiptTemplate = {
    format: "transparent_ai_original_goal_teacher_action_router_receipt_v1",
    routerId: router?.routerId || receiptBuilder?.routerId || "",
    builderId: `shortlist-${shortlist.format || "teacher-action-shortlist"}`,
    sourceShortlistFormat: shortlist.format || "",
    sourceShortlistStatus: shortlist.status || "",
    defaultDecision: "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "teacher_reviewed_opened",
      "ready_for_downstream_validation",
      "blocked_needs_more_evidence"
    ],
    rowDecisions: mappedActions
      .filter((action) => action.routerRowMatched)
      .map((action) => ({
        id: action.routerRowId,
        sourceShortlistActionId: action.id,
        sourceTriageOrder: action.sourceTriageOrder,
        routeKind: action.reviewEntryId || "",
        reviewEntryId: action.reviewEntryId || "",
        teacherDecision: "needs_teacher_review",
        evidenceReviewed: false,
        observedEvidencePath: "",
        teacherNote: ""
      })),
    blockedActions: [
      "accepted",
      "execute_now",
      "register_now",
      "run_execute_mode",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging"
    ],
    locks
  };
  const enrichedShortlist = {
    ...shortlist,
    actions: mappedActions,
    routerReceipt: {
      status:
        receiptTemplate.rowDecisions.length > 0 && receiptTemplate.rowDecisions.length === mappedActions.length
          ? "ready_for_teacher_to_fill_shortlist_router_receipt"
          : "waiting_for_router_row_mapping_review",
      receiptTemplatePath: templatePath,
      validationCommand,
      sourceRouterPath: receiptBuilder?.paths?.sourceRouter || "",
      sourceRouterReceiptBuilderPath: receiptBuilder?.paths?.builder || "",
      mappedActions: receiptTemplate.rowDecisions.length,
      unmappedActions: mappedActions.filter((action) => !action.routerRowMatched).length
    }
  };
  return { enrichedShortlist, receiptTemplate };
}

function writeTriageHtml(path, triage) {
  const rows = triage.rows
    .map(
      (row) => `<article class="row">
        <div class="order">${row.order}</div>
        <div>
          <h3>${htmlEscape(row.label)}</h3>
          <p>${htmlEscape(row.instruction)}</p>
          <p><strong>Status:</strong> ${htmlEscape(row.currentStatus || "needs review")}</p>
          <p><strong>Open:</strong> ${
            row.openPath ? `<a href="${htmlEscape(fileHref(row.openPath))}">${htmlEscape(row.reviewEntryId)}</a>` : "<span>missing linked entry</span>"
          }</p>
          ${
            row.rollbackPointManifestPath
              ? `<p><strong>Rollback evidence:</strong> <a href="${htmlEscape(fileHref(row.rollbackPointManifestPath))}">${htmlEscape(row.rollbackPointManifestPath)}</a></p>`
              : ""
          }
          <p><strong>Validate:</strong> <code>${htmlEscape(row.validationCommand || row.validationTool || "validation pending")}</code></p>
          <p class="locks">Blocked: ${htmlEscape((row.blockedTeacherDecisions || []).join(", "))}</p>
        </div>
      </article>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Next Action Triage</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; background: #f7faf8; }
    body { margin: 0; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 24px 0 12px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .summary, .row { background: #fff; border: 1px solid #d9e4dc; border-radius: 8px; }
    .summary { padding: 16px; }
    .row { display: grid; grid-template-columns: 44px 1fr; gap: 14px; padding: 14px; margin: 12px 0; }
    .order { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #1f4f46; color: white; font-weight: 700; }
    code { display: inline-block; max-width: 100%; overflow-wrap: anywhere; background: #edf3ef; border-radius: 5px; padding: 2px 5px; }
    a { color: #145f8f; }
    .locks { color: #5b6870; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Next Action Triage</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(triage.status)}</p>
    <p><strong>Recommended first action:</strong> ${htmlEscape(triage.recommendedFirstAction)}</p>
    ${
      triage.rollbackPoint?.manifestPath
        ? `<p><strong>Retained rollback point:</strong> <a href="${htmlEscape(fileHref(triage.rollbackPoint.manifestPath))}">${htmlEscape(triage.rollbackPoint.manifestPath)}</a></p>`
        : ""
    }
    <p class="locks">This page only orders existing review gates. It does not register tasks, launch runners, execute software, capture screenshots, write memory, or claim completion.</p>
  </section>
  <h2>Ordered Review Rows</h2>
  ${rows || "<p>No current gap rows were found.</p>"}
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const defaultGoal =
  "Make all software on this computer learn from low-token logs or fallback signals, adapt to each teacher, understand transparent 2D perspective 3D sketch intent, and execute only through teacher-confirmed supervised gates.";
const goal = argValue("--goal", argValue("--task", defaultGoal));
const software = argValue("--software", argValue("--app", "selected target software"));
const command = argValue("--command", argValue("--text-command", "Use voice or text to describe the engineering action, then confirm one numbered target."));
const teacherStyle = argValue("--teacher-style", argValue("--style", "voice, typed command, transparent sketch, low-token logs, correction-first"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-current-status-refreshes")));
const scanRoot = resolve(argValue("--scan-root", join(process.cwd(), ".transparent-apprentice")));
const includeCommandCenter = !hasFlag("--no-command-center");
const allowSmokeEvidence = hasFlag("--allow-smoke-evidence");
const latestRealLocalFullGoalIntegratedCycleSmokeSummary =
  findLatestNamedFile(
    process.cwd(),
    "real-local-full-goal-integrated-cycle-smoke-summary.json",
    ["artifacts\\real-local-full-goal-integrated-cycle-smoke"],
    20000,
    true
  ) || "";
const latestRealLocalFullGoalIntegratedCycleSmokePacket = latestRealLocalFullGoalIntegratedCycleSmokeSummary
  ? readJson(latestRealLocalFullGoalIntegratedCycleSmokeSummary)
  : {};
const latestPartialFallbackRouteEvidencePlanDraft =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-fallback-route-evidence-plan-receipt-draft.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-fallback-route-evidence-plan-partial-receipt-drafts"
    ],
    20000,
    false
  ) || "";
const latestPartialFallbackRouteEvidencePlanDraftReceipt =
  findLatestNamedFile(
    process.cwd(),
    "teacher-low-token-blocked-waiting-row-evidence-plan-receipt-draft.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-fallback-route-evidence-plan-partial-receipt-drafts"
    ],
    20000,
    false
  ) || "";
const latestPartialFallbackRouteEvidencePlanDraftValidation =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-fallback-route-evidence-plan-partial-receipt-draft-validations"
    ],
    20000,
    false
  ) || "";
const latestPartialFallbackRouteEvidencePlanDraftPacket = latestPartialFallbackRouteEvidencePlanDraft
  ? readJson(latestPartialFallbackRouteEvidencePlanDraft)
  : {};
const latestPartialFallbackRouteEvidencePlanDraftValidationPacket = latestPartialFallbackRouteEvidencePlanDraftValidation
  ? readJson(latestPartialFallbackRouteEvidencePlanDraftValidation)
  : {};
const latestLowTokenCompactEvidenceRequestPack =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-request-pack.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-compact-evidence-request-packs"
    ],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceRequestPackReceipt =
  findLatestNamedFile(
    process.cwd(),
    "teacher-low-token-compact-evidence-request-receipt-template.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-compact-evidence-request-packs"
    ],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceRequestPackPacket = latestLowTokenCompactEvidenceRequestPack
  ? readJson(latestLowTokenCompactEvidenceRequestPack)
  : {};
const latestLowTokenCompactEvidenceRequestReceiptBuilder =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-request-receipt-builder.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-compact-evidence-request-receipt-builders"
    ],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceRequestReceiptBuilderPacket = latestLowTokenCompactEvidenceRequestReceiptBuilder
  ? readJson(latestLowTokenCompactEvidenceRequestReceiptBuilder)
  : {};
const latestLowTokenCompactEvidenceTeacherLaunchpad =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-teacher-launchpad.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-compact-evidence-teacher-launchpads"
    ],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceTeacherLaunchpadPacket = latestLowTokenCompactEvidenceTeacherLaunchpad
  ? readJson(latestLowTokenCompactEvidenceTeacherLaunchpad)
  : {};
const latestLowTokenCompactEvidenceRequestValidation =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-request-receipt-validation.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-compact-evidence-request-receipt-validations"
    ],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceRequestValidationPacket = latestLowTokenCompactEvidenceRequestValidation
  ? readJson(latestLowTokenCompactEvidenceRequestValidation)
  : {};
const latestLowTokenFallbackRouteEvidencePackReceiptValidation =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-fallback-route-evidence-pack-receipt-validation.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\original-goal-low-token-fallback-route-evidence-pack-receipt-validations"
    ],
    20000,
    false
  ) || "";
const latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket =
  latestLowTokenFallbackRouteEvidencePackReceiptValidation
    ? readJson(latestLowTokenFallbackRouteEvidencePackReceiptValidation)
    : {};
const latestLowTokenFallbackRouteManualReviewPack =
  findLatestNamedFile(
    process.cwd(),
    "low-token-fallback-route-manual-review-pack.json",
    ["artifacts\\original-goal-current-status-refreshes", "artifacts\\low-token-fallback-route-manual-review-packs"],
    20000,
    false
  ) || "";
const latestLowTokenFallbackRouteManualReviewPackPacket = latestLowTokenFallbackRouteManualReviewPack
  ? readJson(latestLowTokenFallbackRouteManualReviewPack)
  : {};
const latestLowTokenFallbackRouteManualReviewPatchValidation =
  findLatestNamedFile(
    process.cwd(),
    "low-token-fallback-route-manual-review-patch-validation.json",
    [
      "artifacts\\original-goal-current-status-refreshes",
      "artifacts\\low-token-fallback-route-manual-review-patch-validations"
    ],
    20000,
    false
  ) || "";
const latestLowTokenFallbackRouteManualReviewPatchValidationPacket =
  latestLowTokenFallbackRouteManualReviewPatchValidation
    ? readJson(latestLowTokenFallbackRouteManualReviewPatchValidation)
    : {};
const latestLowTokenCompactEvidenceRun =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-run.json",
    ["artifacts\\original-goal-low-token-compact-evidence-runs"],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceRunPacket = latestLowTokenCompactEvidenceRun
  ? readJson(latestLowTokenCompactEvidenceRun)
  : {};
const latestLowTokenCompactEvidenceLearningHandoff =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-learning-handoff.json",
    ["artifacts\\original-goal-low-token-compact-evidence-learning-handoffs"],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceLearningHandoffPacket = latestLowTokenCompactEvidenceLearningHandoff
  ? readJson(latestLowTokenCompactEvidenceLearningHandoff)
  : {};
const latestLowTokenCompactEvidenceLearningReviewValidation =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-evidence-learning-review-receipt-validation.json",
    ["artifacts\\original-goal-low-token-compact-evidence-learning-review-receipt-validations"],
    20000,
    false
  ) || "";
const latestLowTokenCompactEvidenceLearningReviewValidationPacket = latestLowTokenCompactEvidenceLearningReviewValidation
  ? readJson(latestLowTokenCompactEvidenceLearningReviewValidation)
  : {};
const latestLowTokenCompactLearningDisabledRuleDraft =
  findLatestNamedFile(
    process.cwd(),
    "original-goal-low-token-compact-learning-disabled-rule-draft.json",
    ["artifacts\\original-goal-low-token-compact-learning-disabled-rule-drafts"],
    20000,
    false
  ) || "";
const latestLowTokenCompactLearningDisabledRuleDraftPacket = latestLowTokenCompactLearningDisabledRuleDraft
  ? readJson(latestLowTokenCompactLearningDisabledRuleDraft)
  : {};
const explicitOriginalGoalLowTokenCoverageDossierReceiptValidation = argValue(
  "--low-token-coverage-dossier-receipt-validation",
  argValue("--coverage-dossier-receipt-validation", "")
);
const discoveredOriginalGoalLowTokenCoverageDossierReceiptValidation = chooseNewestUsablePath([
  findLatestNamedFile(scanRoot, "original-goal-low-token-coverage-dossier-receipt-validation.json", [
    "original-goal-low-token-coverage-dossier-receipt-validations",
    "low-token-coverage-dossier-receipt-validation",
    "original-goal-current-status-refreshes",
    "original-goal-low-token-coverage-dossier-receipt-smoke"
  ], 100000, allowSmokeEvidence) || "",
  findLatestNamedFile(process.cwd(), "original-goal-low-token-coverage-dossier-receipt-validation.json", [
    "artifacts\\original-goal-low-token-coverage-dossier-receipt-validations"
  ], 20000, false) || ""
]);
const sourceOriginalGoalLowTokenCoverageDossierReceiptValidation =
  explicitOriginalGoalLowTokenCoverageDossierReceiptValidation ||
  discoveredOriginalGoalLowTokenCoverageDossierReceiptValidation;
const sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidation &&
  existsSync(sourceOriginalGoalLowTokenCoverageDossierReceiptValidation)
    ? readJson(sourceOriginalGoalLowTokenCoverageDossierReceiptValidation)
    : null;
const sourceOriginalGoalLowTokenCoverageCompletionGate =
  argValue("--low-token-coverage-completion-gate", argValue("--coverage-completion-gate", "")) ||
  findLatestNamedFile(scanRoot, "original-goal-low-token-coverage-completion-gate.json", [
    "original-goal-low-token-coverage-completion-gates",
    "low-token-coverage-completion-gate",
    "original-goal-current-status-refreshes",
    "original-goal-low-token-coverage-completion-gate-smoke"
  ], 100000, allowSmokeEvidence) ||
  findLatestNamedFile(process.cwd(), "original-goal-low-token-coverage-completion-gate.json", [
    "artifacts\\original-goal-low-token-coverage-completion-gates"
  ], 20000, false);
const sourceOriginalGoalLowTokenCoverageCompletionGatePacket =
  sourceOriginalGoalLowTokenCoverageCompletionGate && existsSync(sourceOriginalGoalLowTokenCoverageCompletionGate)
    ? readJson(sourceOriginalGoalLowTokenCoverageCompletionGate)
    : null;
const sourceExecutionFollowUpBatch =
  argValue("--execution-follow-up-batch", argValue("--execution-capability-follow-up-batch", "")) ||
  findLatestNamedFile(scanRoot, "all-software-execution-capability-matrix-follow-up-batch.json", [
    "current-original-goal-execution-follow-up-batches",
    "current-full-goal-command-center",
    "goal-command-centers",
    "all-software-execution-capability-supervisors"
  ]);
const sourceCoverageConvergence =
  argValue("--coverage-convergence", argValue("--coverage-convergence-audit", "")) ||
  findLatestNamedFile(scanRoot, "all-software-coverage-convergence-audit.json", [
    "all-software-coverage-convergence-audits",
    "real-local-all-software-coverage-convergence-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const explicitLogSourceDiscoveryLedger = argValue("--log-source-discovery-ledger", argValue("--source-discovery-ledger", ""));
let sourceLogSourceDiscoveryLedger =
  explicitLogSourceDiscoveryLedger ||
  findLatestNamedFile(scanRoot, "all-software-log-source-discovery-ledger.json", [
    "all-software-log-source-discovery-ledgers",
    "all-software-log-source-discovery-ledger-smoke"
  ], 100000, allowSmokeEvidence);
let sourceLogSourceDiscoveryLedgerPacket =
  sourceLogSourceDiscoveryLedger && existsSync(sourceLogSourceDiscoveryLedger)
    ? readJson(sourceLogSourceDiscoveryLedger)
    : null;
let sourceLogSourceDiscoveryLedgerReadme =
  sourceLogSourceDiscoveryLedger
    ? sourceLogSourceDiscoveryLedger.replace(
        /all-software-log-source-discovery-ledger\.json$/,
        "ALL_SOFTWARE_LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
      )
    : "";
const sourceCoverageRolloutReceiptBuilder =
  argValue("--coverage-rollout-receipt-builder", argValue("--coverage-receipt-builder", "")) ||
  findLatestNamedFile(scanRoot, "all-software-coverage-rollout-receipt-builder.json", [
    "all-software-coverage-rollout-receipt-builders",
    "goal-command-centers",
    "all-software-coverage-rollout-receipt-builder-smoke"
  ], 100000, allowSmokeEvidence);
const sourceCoverageEnrollmentFollowUpReceiptBuilder =
  argValue("--coverage-enrollment-follow-up-receipt-builder", argValue("--enrollment-follow-up-receipt-builder", "")) ||
  findLatestNamedFile(scanRoot, "all-software-coverage-enrollment-follow-up-receipt-builder.json", [
    "all-software-coverage-enrollment-follow-up-receipt-builders",
    "all-software-coverage-enrollment-follow-up-receipt-builder-smoke"
  ], 100000, allowSmokeEvidence);
const sourceCoverageEnrollmentFollowUpReceiptBuilderPacket =
  sourceCoverageEnrollmentFollowUpReceiptBuilder && existsSync(sourceCoverageEnrollmentFollowUpReceiptBuilder)
    ? readJson(sourceCoverageEnrollmentFollowUpReceiptBuilder)
    : null;
const sourceCoverageEnrollmentFollowUpReceiptBuilderHtml =
  sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.paths?.html ||
  (sourceCoverageEnrollmentFollowUpReceiptBuilder
    ? sourceCoverageEnrollmentFollowUpReceiptBuilder.replace(
        /all-software-coverage-enrollment-follow-up-receipt-builder\.json$/,
        "all-software-coverage-enrollment-follow-up-receipt-builder.html"
      )
    : "");
const sourceCoverageEnrollmentFollowUpReceiptTemplate =
  sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.paths?.receiptTemplate ||
  (sourceCoverageEnrollmentFollowUpReceiptBuilder
    ? sourceCoverageEnrollmentFollowUpReceiptBuilder.replace(
        /all-software-coverage-enrollment-follow-up-receipt-builder\.json$/,
        "teacher-coverage-enrollment-follow-up-receipt-template.json"
      )
    : "");
const explicitCoverageEnrollmentFollowUpPlan = argValue(
  "--coverage-enrollment-follow-up-plan",
  argValue("--enrollment-follow-up-plan", "")
);
const latestCoverageEnrollmentFollowUpPlan = findLatestNamedFile(scanRoot, "all-software-coverage-enrollment-follow-up-plan.json", [
    "all-software-coverage-enrollment-follow-up-plans",
    "all-software-coverage-enrollment-follow-up-plan-smoke"
  ], 100000, allowSmokeEvidence);
let sourceCoverageEnrollmentFollowUpPlan =
  explicitCoverageEnrollmentFollowUpPlan ||
  chooseNewestUsablePath([
    sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.paths?.sourceFollowUpPlan,
    latestCoverageEnrollmentFollowUpPlan
  ]);
let sourceCoverageEnrollmentFollowUpPlanPacket =
  sourceCoverageEnrollmentFollowUpPlan && existsSync(sourceCoverageEnrollmentFollowUpPlan)
    ? readJson(sourceCoverageEnrollmentFollowUpPlan)
    : null;
let sourceCoverageEnrollmentFollowUpPlanReadme =
  sourceCoverageEnrollmentFollowUpPlan
    ? sourceCoverageEnrollmentFollowUpPlan.replace(
        /all-software-coverage-enrollment-follow-up-plan\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md"
      )
    : "";
const explicitCoverageEnrollmentFollowUpBatch = argValue(
  "--coverage-enrollment-follow-up-batch",
  argValue("--enrollment-follow-up-batch", "")
);
let sourceCoverageEnrollmentFollowUpBatch =
  explicitCoverageEnrollmentFollowUpBatch ||
  sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.paths?.sourceDryRunBatch ||
  findLatestNamedFile(scanRoot, "all-software-coverage-enrollment-follow-up-batch-run.json", [
    "all-software-coverage-enrollment-follow-up-batches",
    "all-software-coverage-enrollment-follow-up-batch-smoke"
  ], 100000, allowSmokeEvidence);
let sourceCoverageEnrollmentFollowUpBatchPacket =
  sourceCoverageEnrollmentFollowUpBatch && existsSync(sourceCoverageEnrollmentFollowUpBatch)
    ? readJson(sourceCoverageEnrollmentFollowUpBatch)
    : null;
let sourceCoverageEnrollmentFollowUpBatchReadme =
  sourceCoverageEnrollmentFollowUpBatch
    ? sourceCoverageEnrollmentFollowUpBatch.replace(
        /all-software-coverage-enrollment-follow-up-batch-run\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_START_HERE.md"
      )
    : "";
let coverageEnrollmentFollowUpBatchAutoPreviewed = false;
let coverageEnrollmentFollowUpBatchPreviewRefreshReason = "";
const explicitCoverageEnrollmentLedger = argValue("--coverage-enrollment-ledger", argValue("--enrollment-ledger", ""));
let sourceCoverageEnrollmentLedger =
  explicitCoverageEnrollmentLedger ||
  sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.paths?.sourceLedger ||
  sourceCoverageEnrollmentFollowUpPlanPacket?.sourceLedgerPath ||
  findLatestNamedFile(scanRoot, "all-software-coverage-enrollment-ledger.json", [
    "all-software-coverage-enrollment-ledgers",
    "all-software-coverage-enrollment-ledger-smoke"
  ], 100000, allowSmokeEvidence);
let sourceCoverageEnrollmentLedgerPacket =
  sourceCoverageEnrollmentLedger && existsSync(sourceCoverageEnrollmentLedger)
    ? readJson(sourceCoverageEnrollmentLedger)
    : null;
let sourceCoverageEnrollmentLedgerReadme =
  sourceCoverageEnrollmentLedger
    ? sourceCoverageEnrollmentLedger.replace(
        /all-software-coverage-enrollment-ledger\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_LEDGER_START_HERE.md"
      )
    : "";
let generatedLogSourceAlignedCoverageEnrollmentLedger = null;
const sourceCoverageEnrollmentFollowUpReconciliation =
  argValue("--coverage-enrollment-follow-up-reconciliation", argValue("--enrollment-follow-up-reconciliation", "")) ||
  findLatestNamedFile(scanRoot, "all-software-coverage-enrollment-follow-up-reconciliation.json", [
    "all-software-coverage-enrollment-follow-up-reconciliations",
    "all-software-coverage-enrollment-follow-up-reconciliation-smoke"
  ], 100000, allowSmokeEvidence);
const sourceCoverageEnrollmentFollowUpReconciliationPacket =
  sourceCoverageEnrollmentFollowUpReconciliation && existsSync(sourceCoverageEnrollmentFollowUpReconciliation)
    ? readJson(sourceCoverageEnrollmentFollowUpReconciliation)
    : null;
const sourceCoverageEnrollmentFollowUpReconciliationReadme =
  sourceCoverageEnrollmentFollowUpReconciliation
    ? sourceCoverageEnrollmentFollowUpReconciliation.replace(
        /all-software-coverage-enrollment-follow-up-reconciliation\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECONCILIATION_START_HERE.md"
      )
    : "";
const sourceOperationalActivationGate =
  argValue("--operational-activation-gate", argValue("--activation-gate", "")) ||
  findLatestNamedFile(scanRoot, "all-software-operational-learning-activation-gate.json", [
    "all-software-operational-learning-activation-gates",
    "all-software-operational-learning-activation-gate-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceOperationalActivationGatePacket =
  sourceOperationalActivationGate && existsSync(sourceOperationalActivationGate)
    ? readJson(sourceOperationalActivationGate)
    : null;
const sourceOperationalActivationGateReadme =
  sourceOperationalActivationGatePacket?.paths?.readme ||
  (sourceOperationalActivationGate
    ? sourceOperationalActivationGate.replace(
        /all-software-operational-learning-activation-gate\.json$/,
        "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_GATE_START_HERE.md"
      )
    : "");
const sourceOperationalActivationDryRunRehearsal =
  argValue("--operational-activation-dry-run-rehearsal", argValue("--activation-dry-run-rehearsal", "")) ||
  findLatestNamedFile(scanRoot, "all-software-operational-learning-activation-dry-run-rehearsal.json", [
    "all-software-operational-learning-activation-dry-run-rehearsals",
    "all-software-operational-learning-activation-dry-run-rehearsal-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceOperationalActivationDryRunRehearsalPacket =
  sourceOperationalActivationDryRunRehearsal && existsSync(sourceOperationalActivationDryRunRehearsal)
    ? readJson(sourceOperationalActivationDryRunRehearsal)
    : null;
const sourceOperationalActivationDryRunRehearsalReadme =
  sourceOperationalActivationDryRunRehearsalPacket?.paths?.readme ||
  (sourceOperationalActivationDryRunRehearsal
    ? sourceOperationalActivationDryRunRehearsal.replace(
        /all-software-operational-learning-activation-dry-run-rehearsal\.json$/,
        "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_DRY_RUN_REHEARSAL_START_HERE.md"
      )
    : "");
const sourceOperationalRegistrationExecuteGate =
  argValue("--operational-registration-execute-gate", argValue("--registration-execute-gate", "")) ||
  findLatestNamedFile(scanRoot, "all-software-operational-learning-registration-execute-gate.json", [
    "all-software-operational-learning-registration-execute-gates",
    "all-software-operational-learning-registration-execute-gate-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceOperationalRegistrationExecuteGatePacket =
  sourceOperationalRegistrationExecuteGate && existsSync(sourceOperationalRegistrationExecuteGate)
    ? readJson(sourceOperationalRegistrationExecuteGate)
    : null;
const sourceOperationalRegistrationExecuteGateReadme =
  sourceOperationalRegistrationExecuteGatePacket?.paths?.readme ||
  (sourceOperationalRegistrationExecuteGate
    ? sourceOperationalRegistrationExecuteGate.replace(
        /all-software-operational-learning-registration-execute-gate\.json$/,
        "ALL_SOFTWARE_OPERATIONAL_LEARNING_REGISTRATION_EXECUTE_GATE_START_HERE.md"
      )
    : "");
const sourceAutomaticLowTokenLearningSchedule =
  argValue("--automatic-low-token-learning-schedule", argValue("--schedule", "")) ||
  findLatestNamedFile(scanRoot, "automatic-low-token-learning-schedule.json", [
    "automatic-low-token-learning-schedules",
    "real-local-automatic-low-token-learning-schedule-smoke",
    "real-local-all-software-unattended-learning-audit-smoke",
    "all-software-operational-learning-trials",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceRecurringMonitorApprovalGate =
  argValue("--recurring-monitor-approval-gate", argValue("--approval-gate", "")) ||
  findLatestNamedFile(scanRoot, "all-software-recurring-monitor-approval-gate.json", [
    "all-software-recurring-monitor-approval-gates",
    "real-local-all-software-recurring-monitor-approval-gate-smoke",
    "real-local-all-software-unattended-learning-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceRecurringMonitorRegistrationRunner =
  argValue("--recurring-monitor-registration-runner", argValue("--registration-runner", "")) ||
  findLatestNamedFile(scanRoot, "recurring-monitor-registration-runner.json", [
    "all-software-recurring-monitor-registration-runners",
    "real-local-all-software-recurring-monitor-registration-runner-smoke",
    "real-local-all-software-unattended-learning-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceRecurringMonitorRegistrationStatus =
  argValue("--recurring-monitor-registration-status", argValue("--registration-status", "")) ||
  findLatestNamedFile(scanRoot, "recurring-monitor-registration-status.json", [
    "all-software-recurring-monitor-registration-status",
    "real-local-all-software-recurring-monitor-registration-status-smoke",
    "real-local-all-software-unattended-learning-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceRecurringMonitorRunOutputAudit =
  argValue("--recurring-monitor-run-output-audit", argValue("--run-output-audit", "")) ||
  findLatestNamedFile(scanRoot, "recurring-monitor-run-output-audit.json", [
    "all-software-recurring-monitor-run-output-audits",
    "real-local-all-software-recurring-monitor-run-output-audit-smoke",
    "real-local-all-software-unattended-learning-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceRecurringMonitorTeacherReviewPacket =
  argValue("--recurring-monitor-teacher-review-packet", argValue("--teacher-review-packet", "")) ||
  findLatestNamedFile(scanRoot, "recurring-monitor-teacher-review-packet.json", [
    "all-software-recurring-monitor-teacher-review-packets",
    "real-local-all-software-recurring-monitor-teacher-review-packet-smoke",
    "real-local-all-software-unattended-learning-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceRecurringMonitorReviewDecisionReplayQueue =
  argValue("--recurring-monitor-review-decision-replay-queue", argValue("--review-decision-replay-queue", "")) ||
  findLatestNamedFile(scanRoot, "recurring-monitor-review-decision-replay-queue.json", [
    "all-software-recurring-monitor-review-decision-replay-queues",
    "real-local-all-software-unattended-learning-audit-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceOperationalPostActivationWitness =
  argValue("--operational-post-activation-witness", argValue("--post-activation-witness", "")) ||
  findLatestNamedFile(scanRoot, "all-software-operational-learning-post-activation-witness.json", [
    "all-software-operational-learning-post-activation-witnesses",
    "all-software-operational-learning-post-activation-witness-smoke",
    "goal-command-centers"
  ], 100000, allowSmokeEvidence);
const sourceOperationalPostActivationWitnessPacket =
  sourceOperationalPostActivationWitness && existsSync(sourceOperationalPostActivationWitness)
    ? readJson(sourceOperationalPostActivationWitness)
    : null;
const sourceOperationalPostActivationWitnessReadme =
  sourceOperationalPostActivationWitnessPacket?.paths?.readme ||
  (sourceOperationalPostActivationWitness
    ? sourceOperationalPostActivationWitness.replace(
        /all-software-operational-learning-post-activation-witness\.json$/,
        "ALL_SOFTWARE_OPERATIONAL_LEARNING_POST_ACTIVATION_WITNESS_START_HERE.md"
      )
    : "");
const sourceExecutionConvergence =
  argValue("--execution-convergence", argValue("--execution-convergence-audit", "")) ||
  chooseNewestUsablePath([
    findLatestNamedFile(scanRoot, "all-software-execution-capability-convergence-audit.json", [
      "original-goal-execution-convergence-audits",
      "all-software-execution-capability-convergence-audits",
      "real-local-all-software-execution-capability-convergence-audit-smoke",
      "goal-command-centers"
    ], 100000, allowSmokeEvidence),
    findLatestNamedFile(process.cwd(), "all-software-execution-capability-convergence-audit.json", [
      "artifacts\\all-software-execution-capability-convergence-audits"
    ], 100000, false)
  ]);
const sourceExecutionConvergencePacket =
  sourceExecutionConvergence && existsSync(sourceExecutionConvergence)
    ? readJson(sourceExecutionConvergence)
    : null;
const sourceRuleDslDeliveryGateAudit =
  argValue("--rule-dsl-delivery-gate-audit", argValue("--rule-dsl-audit", "")) ||
  findLatestNamedFile(scanRoot, "rag-delivery-gate-audit-trail.json", [
    "rag-delivery-gate-audit-trail",
    "rag-delivery-gate-audit-trail-smoke",
    "rag-primary-source-delivery-gate-audit-trail",
    "rag-primary-source-delivery-gate-audit-trail-smoke"
  ], 100000, allowSmokeEvidence);
const sourceRuleDslDeliveryGateAuditPacket =
  sourceRuleDslDeliveryGateAudit && existsSync(sourceRuleDslDeliveryGateAudit)
    ? readJson(sourceRuleDslDeliveryGateAudit)
    : null;
const sourceRuleDslDeliveryGateAuditReviewReceiptBuilder =
  argValue("--rule-dsl-audit-review-receipt-builder", argValue("--rag-audit-review-receipt-builder", "")) ||
  findLatestNamedFile(scanRoot, "rag-delivery-gate-audit-review-receipt-builder.json", [
    "rag-delivery-gate-audit-review-receipt-builder",
    "original-goal-current-status-refreshes",
    "rag-delivery-gate-audit-review-receipt-builder-smoke",
    "rag-primary-source-delivery-gate-audit-review-receipt",
    "rag-primary-source-delivery-gate-audit-review-receipt-smoke"
  ], 100000, allowSmokeEvidence);
const sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilder && existsSync(sourceRuleDslDeliveryGateAuditReviewReceiptBuilder)
    ? readJson(sourceRuleDslDeliveryGateAuditReviewReceiptBuilder)
    : null;
const sourceRuleDslDeliveryGateAuditReviewReceiptValidation =
  argValue("--rule-dsl-audit-review-receipt-validation", argValue("--rag-audit-review-receipt-validation", "")) ||
  findLatestNamedFile(scanRoot, "rag-delivery-gate-audit-review-receipt-validation.json", [
    "rag-audit-review-template-preflight-validation",
    "rag-delivery-gate-audit-review-receipt-validation",
    "original-goal-current-status-refreshes",
    "rag-delivery-gate-audit-review-receipt-validation-smoke",
    "rag-primary-source-delivery-gate-audit-review-receipt-validation",
    "rag-primary-source-delivery-gate-audit-review-receipt-validation-smoke"
  ], 100000, allowSmokeEvidence);
const sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidation &&
  existsSync(sourceRuleDslDeliveryGateAuditReviewReceiptValidation)
    ? readJson(sourceRuleDslDeliveryGateAuditReviewReceiptValidation)
    : null;
const sourceTransparentSketchDepthRehearsalReviewReceiptValidation =
  argValue("--transparent-sketch-depth-rehearsal-review-receipt-validation", "") ||
  findLatestNamedFile(scanRoot, "transparent-sketch-depth-rehearsal-review-receipt-validation.json", [
    "transparent-sketch-depth-rehearsal-review-receipt-validation",
    "transparent-sketch-depth-rehearsal-review-receipt-validations",
    "original-goal-current-status-refreshes",
    "transparent-sketch-depth-rehearsal-review-receipt-smoke"
  ], 100000, allowSmokeEvidence);
const sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket =
  sourceTransparentSketchDepthRehearsalReviewReceiptValidation &&
  existsSync(sourceTransparentSketchDepthRehearsalReviewReceiptValidation)
    ? readJson(sourceTransparentSketchDepthRehearsalReviewReceiptValidation)
    : null;
const sourceTransparentSketchLogicContractRuleDraft =
  argValue("--transparent-sketch-logic-contract-rule-draft", "") ||
  findLatestNamedFile(scanRoot, "transparent-sketch-logic-contract-rule-draft.json", [
    "transparent-sketch-logic-contract-rule-drafts",
    "transparent-sketch-logic-contract-rule-draft-smoke"
  ], 100000, allowSmokeEvidence);
const sourceTransparentSketchLogicContractRuleDraftPacket =
  sourceTransparentSketchLogicContractRuleDraft && existsSync(sourceTransparentSketchLogicContractRuleDraft)
    ? readJson(sourceTransparentSketchLogicContractRuleDraft)
    : null;
const sourceTeacherLearningMethodProfile =
  argValue("--teacher-learning-method-profile", argValue("--teacher-method-profile", "")) ||
  findLatestNamedFile(scanRoot, "teacher-learning-method-profile.json", [
    "teacher-method-profiles",
    "teacher-learning-method-profile-smoke"
  ], 100000, allowSmokeEvidence) ||
  findLatestNamedFile(process.cwd(), "teacher-learning-method-profile.json", [
    "artifacts\\teacher-method-profiles"
  ], 100000, false);
const sourceTeacherLearningMethodProfilePacket =
  sourceTeacherLearningMethodProfile && existsSync(sourceTeacherLearningMethodProfile)
    ? readJson(sourceTeacherLearningMethodProfile)
    : null;
const sourceTeacherMethodExecutionLearningContract =
  argValue("--teacher-method-execution-learning-contract", "") ||
  findLatestNamedFile(scanRoot, "teacher-method-execution-learning-contract.json", [
    "teacher-method-execution-learning-contracts",
    "teacher-method-execution-learning-contract-smoke",
    "original-goal-current-status-refreshes"
  ], 100000, allowSmokeEvidence) ||
  findLatestNamedFile(process.cwd(), "teacher-method-execution-learning-contract.json", [
    "artifacts\\teacher-method-execution-learning-contracts"
  ], 100000, false);
const sourceTeacherMethodExecutionLearningContractPacket =
  sourceTeacherMethodExecutionLearningContract && existsSync(sourceTeacherMethodExecutionLearningContract)
    ? readJson(sourceTeacherMethodExecutionLearningContract)
    : null;
const sourceTeacherMethodExecutionLearningContractReceiptValidation =
  argValue("--teacher-method-contract-receipt-validation", "") ||
  findLatestNamedFile(scanRoot, "teacher-method-execution-learning-contract-receipt-validation.json", [
    "teacher-method-execution-learning-contract-receipt-validations",
    "teacher-method-execution-learning-contract-receipt-validation",
    "original-goal-current-status-refreshes"
  ], 100000, allowSmokeEvidence) ||
  findLatestNamedFile(process.cwd(), "teacher-method-execution-learning-contract-receipt-validation.json", [
    "artifacts\\teacher-method-execution-learning-contract-receipt-validations",
    "artifacts\\original-goal-current-status-refreshes"
  ], 100000, false);
const sourceTeacherMethodExecutionLearningContractReceiptValidationPacket =
  sourceTeacherMethodExecutionLearningContractReceiptValidation &&
  existsSync(sourceTeacherMethodExecutionLearningContractReceiptValidation)
    ? readJson(sourceTeacherMethodExecutionLearningContractReceiptValidation)
    : null;
const sourceTeacherMethodReuseResultProofValidation =
  argValue("--teacher-method-reuse-result-proof-validation", "") ||
  findLatestNamedFile(scanRoot, "teacher-method-reuse-result-proof-validation.json", [
    "teacher-method-reuse-result-proof-validations",
    "teacher-method-reuse-result-proof-validation",
    "original-goal-current-status-refreshes"
  ], 100000, allowSmokeEvidence) ||
  findLatestNamedFile(process.cwd(), "teacher-method-reuse-result-proof-validation.json", [
    "artifacts\\teacher-method-reuse-result-proof-validations",
    "artifacts\\original-goal-current-status-refreshes"
  ], 100000, false);
const sourceTeacherMethodReuseResultProofValidationPacket =
  sourceTeacherMethodReuseResultProofValidation && existsSync(sourceTeacherMethodReuseResultProofValidation)
    ? readJson(sourceTeacherMethodReuseResultProofValidation)
    : null;
const explicitPreflightRunner = argValue("--preflight-runner", argValue("--runner", ""));
const explicitRealLocalReadinessPackage = argValue("--real-local-readiness-package", argValue("--readiness-package", ""));
const sourceRealLocalReadinessPackage =
  explicitRealLocalReadinessPackage ||
  chooseNewestUsablePath([
    findLatestNamedFile(
      scanRoot,
      "real-local-all-software-low-token-readiness-package.json",
      ["real-local-all-software-low-token-readiness-packages"],
      100000,
      allowSmokeEvidence
    ),
    findLatestNamedFile(
      process.cwd(),
      "real-local-all-software-low-token-readiness-package.json",
      ["artifacts\\real-local-all-software-low-token-readiness-packages"],
      100000,
      false
    )
  ]);
const sourceRealLocalReadinessPackagePacket =
  sourceRealLocalReadinessPackage && existsSync(sourceRealLocalReadinessPackage)
    ? readJson(sourceRealLocalReadinessPackage)
    : null;
const realLocalReadinessScopeEvidence = sourceRealLocalReadinessPackagePacket?.scopeEvidence || {};
const realLocalReadinessCounts = sourceRealLocalReadinessPackagePacket?.counts || {};
const realLocalReadinessNonCadSolidWorksCandidates = Number(
  realLocalReadinessCounts.nonCadSolidWorksCandidates ??
    realLocalReadinessScopeEvidence.nonCadSolidWorksCandidateRows ??
    0
);
const realLocalReadinessCadOrSolidWorksCandidates = Number(
  realLocalReadinessCounts.cadOrSolidWorksCandidates ??
    realLocalReadinessScopeEvidence.cadOrSolidWorksCandidateRows ??
    0
);
const realLocalReadinessNonCadSolidWorksLedgerRows = Number(
  realLocalReadinessCounts.nonCadSolidWorksLedgerRows ??
    realLocalReadinessScopeEvidence.nonCadSolidWorksLedgerRows ??
    0
);
const realLocalReadinessScopeClaim = realLocalReadinessScopeEvidence.scopeClaim || "";
const sourceCurrentGoalStartHere =
  argValue("--current-goal-start-here", "") ||
  findLatestNamedFile(process.cwd(), "current-goal-start-here.json", [
    "artifacts\\current-goal-start-here"
  ], 100000, false);
const sourceCurrentGoalStartHerePacket =
  sourceCurrentGoalStartHere && existsSync(sourceCurrentGoalStartHere)
    ? readJson(sourceCurrentGoalStartHere)
    : null;
const sourceCurrentGoalRealLocalTrialPackage =
  argValue("--current-goal-real-local-trial-package", "") ||
  findLatestNamedFile(process.cwd(), "current-goal-real-local-trial-package.json", [
    "artifacts\\current-goal-real-local-trial-packages"
  ], 100000, false);
const sourceCurrentGoalRealLocalTrialPackagePacket =
  sourceCurrentGoalRealLocalTrialPackage && existsSync(sourceCurrentGoalRealLocalTrialPackage)
    ? readJson(sourceCurrentGoalRealLocalTrialPackage)
    : null;
const sourceRealLocalReadinessReceipt = sourceRealLocalReadinessPackage
  ? sourceRealLocalReadinessPackage.replace(/real-local-all-software-low-token-readiness-package\.json$/, "real-local-all-software-low-token-readiness-receipt.json")
  : "";
const sourceRealLocalReadinessReadme = sourceRealLocalReadinessPackage
  ? sourceRealLocalReadinessPackage.replace(/real-local-all-software-low-token-readiness-package\.json$/, "REAL_LOCAL_ALL_SOFTWARE_LOW_TOKEN_READINESS_START_HERE.md")
  : "";
if (!explicitLogSourceDiscoveryLedger && sourceRealLocalReadinessPackagePacket?.paths?.logSourceDiscoveryLedger) {
  const readinessLedger = resolve(
    dirname(sourceRealLocalReadinessPackage),
    sourceRealLocalReadinessPackagePacket.paths.logSourceDiscoveryLedger
  );
  if (existsSync(readinessLedger)) {
    sourceLogSourceDiscoveryLedger = chooseNewestUsablePath([sourceLogSourceDiscoveryLedger, readinessLedger]);
    sourceLogSourceDiscoveryLedgerPacket = readJson(sourceLogSourceDiscoveryLedger);
    sourceLogSourceDiscoveryLedgerReadme =
      sourceRealLocalReadinessPackagePacket.paths.logSourceDiscoveryLedgerReadme &&
      sourceLogSourceDiscoveryLedger === readinessLedger &&
      existsSync(resolve(dirname(sourceRealLocalReadinessPackage), sourceRealLocalReadinessPackagePacket.paths.logSourceDiscoveryLedgerReadme))
        ? resolve(dirname(sourceRealLocalReadinessPackage), sourceRealLocalReadinessPackagePacket.paths.logSourceDiscoveryLedgerReadme)
        : sourceLogSourceDiscoveryLedger.replace(
            /all-software-log-source-discovery-ledger\.json$/,
            "ALL_SOFTWARE_LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
          );
  }
}
if (
  !explicitCoverageEnrollmentLedger &&
  sourceLogSourceDiscoveryLedger &&
  sourceLogSourceDiscoveryLedgerPacket?.sourceEvidence?.inventoryPath &&
  sourceLogSourceDiscoveryLedgerPacket?.sourceEvidence?.queuePath
) {
  const alignedCoverageEnrollmentLedger = runNodeScript("create-all-software-coverage-enrollment-ledger.mjs", [
    "--inventory",
    sourceLogSourceDiscoveryLedgerPacket.sourceEvidence.inventoryPath,
    "--queue",
    sourceLogSourceDiscoveryLedgerPacket.sourceEvidence.queuePath,
    "--log-source-discovery-ledger",
    sourceLogSourceDiscoveryLedger,
    "--max-rows",
    String(
      sourceLogSourceDiscoveryLedgerPacket.counts?.ledgerRows ||
        (Array.isArray(sourceLogSourceDiscoveryLedgerPacket.rows) ? sourceLogSourceDiscoveryLedgerPacket.rows.length : 120)
    ),
    "--goal",
    "Realign coverage enrollment ledger to the current log-source discovery ledger before teacher coverage receipts.",
    "--output-dir",
    join(outputRoot, "current-log-source-aligned-coverage-enrollment-ledger-preview")
  ]);
  if (alignedCoverageEnrollmentLedger?.ledgerPath && existsSync(alignedCoverageEnrollmentLedger.ledgerPath)) {
    generatedLogSourceAlignedCoverageEnrollmentLedger = alignedCoverageEnrollmentLedger;
    sourceCoverageEnrollmentLedger = alignedCoverageEnrollmentLedger.ledgerPath;
    sourceCoverageEnrollmentLedgerPacket = readJson(sourceCoverageEnrollmentLedger);
    sourceCoverageEnrollmentLedgerReadme =
      alignedCoverageEnrollmentLedger.teacherReadme ||
      sourceCoverageEnrollmentLedger.replace(
        /all-software-coverage-enrollment-ledger\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_LEDGER_START_HERE.md"
      );
  }
}
if (
  !explicitCoverageEnrollmentFollowUpPlan &&
  generatedLogSourceAlignedCoverageEnrollmentLedger?.ledgerPath &&
  existsSync(generatedLogSourceAlignedCoverageEnrollmentLedger.ledgerPath)
) {
  const alignedCoverageEnrollmentFollowUpPlan = runNodeScript(
    "create-all-software-coverage-enrollment-follow-up-plan.mjs",
    [
      "--ledger",
      generatedLogSourceAlignedCoverageEnrollmentLedger.ledgerPath,
      "--max-items",
      String(
        sourceCoverageEnrollmentLedgerPacket?.counts?.ledgerRows ||
          (Array.isArray(sourceCoverageEnrollmentLedgerPacket?.rows) ? sourceCoverageEnrollmentLedgerPacket.rows.length : 80)
      ),
      "--goal",
      "Plan metadata-only follow-up from the current log-source aligned coverage enrollment ledger.",
      "--output-dir",
      join(outputRoot, "current-log-source-aligned-coverage-follow-up-plan-preview")
    ]
  );
  if (alignedCoverageEnrollmentFollowUpPlan?.planPath && existsSync(alignedCoverageEnrollmentFollowUpPlan.planPath)) {
    sourceCoverageEnrollmentFollowUpPlan = alignedCoverageEnrollmentFollowUpPlan.planPath;
    sourceCoverageEnrollmentFollowUpPlanPacket = readJson(sourceCoverageEnrollmentFollowUpPlan);
    sourceCoverageEnrollmentFollowUpPlanReadme =
      alignedCoverageEnrollmentFollowUpPlan.teacherReadme ||
      sourceCoverageEnrollmentFollowUpPlan.replace(
        /all-software-coverage-enrollment-follow-up-plan\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md"
      );
  }
}
const sourcePreflightRunner =
  explicitPreflightRunner ||
  findLatestNamedFile(scanRoot, "automatic-low-token-learning-runner.json", [
    "automatic-low-token-learning-runs",
    "real-local-all-software-low-token-readiness-packages",
    "convergence-automatic-learning-packages",
    "optrial-smoke"
  ], 100000, allowSmokeEvidence);
const explicitPreflightLearningCycle = argValue("--preflight-learning-cycle", argValue("--learning-cycle", ""));
const sourcePreflightLearningCycle =
  explicitPreflightLearningCycle ||
  findLatestNamedFile(scanRoot, "all-software-low-token-learning-cycle.json", [
    "automatic-low-token-learning-runs",
    "all-software-low-token-learning-cycles",
    "real-local-all-software-low-token-readiness-packages",
    "goal-command-center-trials"
  ], 100000, allowSmokeEvidence);
const explicitPreflightVisualCheckQueue = argValue("--preflight-visual-check-queue", argValue("--visual-check-queue", ""));
let generatedPreflightVisualCheckQueue = "";
let sourcePreflightVisualCheckQueue =
  explicitPreflightVisualCheckQueue ||
  findLatestNamedFile(scanRoot, "automatic-triggered-visual-check-queue.json", [
    "automatic-triggered-visual-check-queues",
    "real-local-all-software-low-token-readiness-packages"
  ], 100000, allowSmokeEvidence);
const sourcePreflightSpatialIntent =
  argValue("--preflight-spatial-intent", argValue("--spatial-intent", "")) ||
  findLatestNamedFile(scanRoot, "transparent-sketch-spatial-intent.json", [
    "transparent-overlay-kits",
    "spatial-intent-interpreters",
    "spatial-target-confirmations"
  ], 100000, allowSmokeEvidence);
const sourceTransparentSketchOverlayPacketValidation =
  argValue("--transparent-sketch-overlay-packet-validation", argValue("--overlay-packet-validation", "")) ||
  findLatestNamedFile(scanRoot, "transparent-sketch-overlay-packet-validation.json", [
    "transparent-sketch-overlay-packet-validations",
    "original-goal-current-status-refreshes"
  ], 100000, allowSmokeEvidence) ||
  findLatestNamedFile(process.cwd(), "transparent-sketch-overlay-packet-validation.json", [
    "artifacts\\transparent-sketch-overlay-packet-validations",
    "artifacts\\original-goal-current-status-refreshes"
  ], 100000, false);
const sourceTransparentSketchOverlayPacketValidationPacket =
  sourceTransparentSketchOverlayPacketValidation && existsSync(sourceTransparentSketchOverlayPacketValidation)
    ? readJson(sourceTransparentSketchOverlayPacketValidation)
    : null;
const sourceSpatialIntentEvidenceReceiptValidation =
  argValue("--spatial-intent-evidence-receipt-validation", argValue("--spatial-intent-receipt-validation", "")) ||
  findLatestNamedFile(scanRoot, "spatial-intent-evidence-receipt-validation.json", [
    "spatial-intent-evidence-receipt-validations",
    "spatial-intent-evidence-receipt-validation",
    "original-goal-current-status-refreshes",
    "spatial-intent-evidence-receipt-validation-smoke"
  ], 100000, allowSmokeEvidence);
const sourceSpatialIntentEvidenceReceiptValidationPacket =
  sourceSpatialIntentEvidenceReceiptValidation && existsSync(sourceSpatialIntentEvidenceReceiptValidation)
    ? readJson(sourceSpatialIntentEvidenceReceiptValidation)
    : null;
const sourceTriggeredVisualTransparentOverlayHandoff =
  argValue("--triggered-visual-transparent-overlay-handoff", "") ||
  findLatestNamedFile(process.cwd(), "triggered-visual-transparent-overlay-handoff.json", [
    "artifacts\\current-goal-triggered-visual-transparent-overlay-handoffs",
    "artifacts\\original-goal-current-status-refreshes",
    ".transparent-apprentice\\triggered-visual-transparent-overlay-handoff-smoke"
  ], 100000, false);
const sourceTriggeredVisualTransparentOverlayHandoffPacket =
  sourceTriggeredVisualTransparentOverlayHandoff && existsSync(sourceTriggeredVisualTransparentOverlayHandoff)
    ? readJson(sourceTriggeredVisualTransparentOverlayHandoff)
    : null;
const sourceSpatialIntentFormalEvidenceEntrypoint =
  argValue("--spatial-intent-formal-evidence-entrypoint", "") ||
  findLatestNamedFile(process.cwd(), "spatial-intent-formal-evidence-entrypoint.json", [
    "artifacts\\current-goal-spatial-intent-formal-evidence-entrypoints",
    "artifacts\\original-goal-current-status-refreshes",
    ".transparent-apprentice\\spatial-intent-formal-evidence-entrypoint-smoke"
  ], 100000, false);
const sourceSpatialIntentFormalEvidenceEntrypointPacket =
  sourceSpatialIntentFormalEvidenceEntrypoint && existsSync(sourceSpatialIntentFormalEvidenceEntrypoint)
    ? readJson(sourceSpatialIntentFormalEvidenceEntrypoint)
    : null;
const sourceSpatialToSoftwareExecutionGatePackage =
  argValue("--spatial-to-software-execution-gate-package", "") ||
  findLatestNamedFile(process.cwd(), "spatial-to-software-execution-gate-package.json", [
    "artifacts\\current-goal-spatial-to-software-execution-gate-packages",
    "artifacts\\original-goal-current-status-refreshes",
    ".transparent-apprentice\\spatial-to-software-execution-gate-package-smoke"
  ], 100000, false);
const sourceSpatialToSoftwareExecutionGatePackagePacket =
  sourceSpatialToSoftwareExecutionGatePackage && existsSync(sourceSpatialToSoftwareExecutionGatePackage)
    ? readJson(sourceSpatialToSoftwareExecutionGatePackage)
    : null;
const spatialIntentEvidenceReceiptValidationReady =
  sourceSpatialIntentEvidenceReceiptValidationPacket?.format ===
    "transparent_ai_spatial_intent_evidence_receipt_validation_v1" &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.status ===
    "validated_with_ready_spatial_target_confirmation" &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.validationDecision ===
    "ready_for_reviewed_spatial_target_confirmation" &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.spatialEvidence?.ready === true &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.detailLogicReadyForAction === true &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.detailLogicValidationReadyForAction === true &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.locks?.validationDoesNotRunSpatialTargetConfirmation === true &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.locks?.targetSoftwareCommandsExecuted === false &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.locks?.softwareActionsExecuted === false &&
  sourceSpatialIntentEvidenceReceiptValidationPacket?.locks?.memoryWritten === false;
const sourcePreflightExecutionGate =
  argValue("--preflight-execution-gate", argValue("--execution-gate", "")) ||
  findLatestNamedFile(scanRoot, "engineering-voice-execution-approval-gate.json", [
    "engineering-voice-execution-approval-gates",
    "real-local-execution-approval-gates"
  ]);
const sourceKnowledgeAugmentedLowTokenLearning =
  argValue("--knowledge-augmented-learning", argValue("--knowledge-packet", "")) ||
  findLatestNamedFile(scanRoot, "knowledge-augmented-low-token-learning.json", [
    "knowledge-augmented-low-token-learning",
    "knowledge-bridge",
    "mcp-knowledge-augmented-low-token-learning"
  ], 100000, allowSmokeEvidence);
const sourceSpatialSoftwareExecutionRouteBridge =
  argValue("--spatial-route-bridge", argValue("--route-bridge", "")) ||
  findLatestNamedFile(scanRoot, "spatial-software-execution-route-bridge.json", [
    "spatial-software-execution-routes",
    "spatial-execution-route-smoke",
    "spatial-route"
  ], 100000, allowSmokeEvidence);
const sourceSpatialSoftwareExecutionRouteBridgePacket =
  sourceSpatialSoftwareExecutionRouteBridge && existsSync(sourceSpatialSoftwareExecutionRouteBridge)
    ? readJson(sourceSpatialSoftwareExecutionRouteBridge)
    : null;
const sourceSpatialRouteToExecutionApprovalHandoff =
  sourceSpatialSoftwareExecutionRouteBridgePacket?.nextExecutionGateHandoff || {};
const discoveredParametricDrawingLogicKit = findLatestNamedFile(
  scanRoot,
  "parametric-drawing-logic-learning-kit.json",
  ["parametric-drawing-logic-learning-kits"],
  100000,
  allowSmokeEvidence
);
const sourceSketchDemonstrationImplementationAudit =
  argValue("--sketch-implementation-audit", argValue("--spatial-implementation-audit", "")) ||
  chooseNewestUsablePath([
    findLatestNamedFile(
      scanRoot,
      "sketch-demonstration-implementation-audit.json",
      ["sketch-demonstration-implementation-audit"],
      100000,
      allowSmokeEvidence
    ),
    findLatestNamedFile(
      process.cwd(),
      "sketch-demonstration-implementation-audit.json",
      ["artifacts\\sketch-demonstration-implementation-audits"],
      100000,
      false
    )
  ]);
const sourceSketchDemonstrationImplementationAuditPacket =
  sourceSketchDemonstrationImplementationAudit && existsSync(sourceSketchDemonstrationImplementationAudit)
    ? readJson(sourceSketchDemonstrationImplementationAudit)
    : null;
const sketchDemonstrationImplementationAuditReady =
  sourceSketchDemonstrationImplementationAuditPacket?.status === "passed" ||
  sourceSketchDemonstrationImplementationAuditPacket?.status ===
    "sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review";

mkdirSync(outputRoot, { recursive: true });
const refreshId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const refreshDir = join(outputRoot, refreshId);
mkdirSync(refreshDir, { recursive: true });
const unattendedAuditArgs = [
  "--goal",
  goal,
  "--output-dir",
  join(refreshDir, "all-software-unattended-learning-audit")
];
if (sourceAutomaticLowTokenLearningSchedule) unattendedAuditArgs.push("--schedule", sourceAutomaticLowTokenLearningSchedule);
if (sourceRecurringMonitorApprovalGate) unattendedAuditArgs.push("--approval-gate", sourceRecurringMonitorApprovalGate);
if (sourceRecurringMonitorRegistrationRunner) unattendedAuditArgs.push("--registration-runner", sourceRecurringMonitorRegistrationRunner);
if (sourceRecurringMonitorRegistrationStatus) unattendedAuditArgs.push("--registration-status", sourceRecurringMonitorRegistrationStatus);
if (sourceRecurringMonitorRunOutputAudit) unattendedAuditArgs.push("--run-output-audit", sourceRecurringMonitorRunOutputAudit);
if (sourceRecurringMonitorTeacherReviewPacket) unattendedAuditArgs.push("--teacher-review-packet", sourceRecurringMonitorTeacherReviewPacket);
if (sourceRecurringMonitorReviewDecisionReplayQueue) {
  unattendedAuditArgs.push("--review-decision-replay-queue", sourceRecurringMonitorReviewDecisionReplayQueue);
}
const allSoftwareUnattendedLearningAudit = runNodeScript(
  "create-all-software-unattended-learning-audit.mjs",
  unattendedAuditArgs
);
const allSoftwareUnattendedLearningAuditPacket =
  allSoftwareUnattendedLearningAudit.auditPath && existsSync(allSoftwareUnattendedLearningAudit.auditPath)
    ? readJson(allSoftwareUnattendedLearningAudit.auditPath)
    : null;
const recurringMonitorTeacherConfirmationPackage =
  sourceAutomaticLowTokenLearningSchedule && sourceRecurringMonitorApprovalGate && allSoftwareUnattendedLearningAudit.auditPath
    ? runNodeScript("create-all-software-recurring-monitor-teacher-confirmation-package.mjs", [
        "--goal",
        goal,
        "--schedule",
        sourceAutomaticLowTokenLearningSchedule,
        "--approval-gate",
        sourceRecurringMonitorApprovalGate,
        "--unattended-audit",
        allSoftwareUnattendedLearningAudit.auditPath,
        "--output-dir",
        join(refreshDir, "recurring-monitor-teacher-confirmation-package")
      ])
    : {
        ok: false,
        status: "missing_inputs_for_recurring_monitor_teacher_confirmation_package",
        packagePath: "",
        readmePath: "",
        htmlPath: "",
        receiptTemplatePath: "",
        remainingBlockers: null,
        locks: {}
      };
const recurringMonitorTeacherConfirmationPacket =
  recurringMonitorTeacherConfirmationPackage.packagePath &&
  existsSync(recurringMonitorTeacherConfirmationPackage.packagePath)
    ? readJson(recurringMonitorTeacherConfirmationPackage.packagePath)
    : null;
const sourceRecurringMonitorTeacherConfirmationReceiptValidation =
  argValue(
    "--recurring-monitor-teacher-confirmation-receipt-validation",
    argValue("--teacher-confirmation-receipt-validation", "")
  ) ||
  chooseNewestUsablePath([
    findLatestNamedFile(
      refreshDir,
      "recurring-monitor-teacher-confirmation-receipt-validation.json",
      ["recurring-monitor-teacher-confirmation-receipt-validation"],
      100000,
      allowSmokeEvidence
    ),
    findLatestNamedFile(
      process.cwd(),
      "recurring-monitor-teacher-confirmation-receipt-validation.json",
      ["artifacts\\all-software-recurring-monitor-teacher-confirmation-receipt-validations"],
      100000,
      false
    )
  ]);
const sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket =
  sourceRecurringMonitorTeacherConfirmationReceiptValidation &&
  existsSync(sourceRecurringMonitorTeacherConfirmationReceiptValidation)
    ? readJson(sourceRecurringMonitorTeacherConfirmationReceiptValidation)
    : null;
const originalGoalCapabilityMatrixCoverageAuditCommandTemplate =
  "npm.cmd run smoke:plugin-original-goal-capability-matrix-coverage-audit";
const tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate =
  "npm.cmd run smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit";
const originalGoalCapabilityMatrixCoverageAudit = runNodeScript(
  "smoke/smoke-original-goal-capability-matrix-coverage-audit.mjs",
  []
);
const originalGoalCapabilityMatrixCoverageAuditPath = join(
  refreshDir,
  "original-goal-capability-matrix-coverage-audit.json"
);
const originalGoalCapabilityMatrixCoverageAuditHtmlPath = join(
  refreshDir,
  "original-goal-capability-matrix-coverage-audit.html"
);
writeFileSync(
  originalGoalCapabilityMatrixCoverageAuditPath,
  `${JSON.stringify(originalGoalCapabilityMatrixCoverageAudit, null, 2)}\n`,
  "utf8"
);
writeCapabilityMatrixCoverageAuditHtml(
  originalGoalCapabilityMatrixCoverageAuditHtmlPath,
  originalGoalCapabilityMatrixCoverageAudit
);

coverageEnrollmentFollowUpBatchPreviewRefreshReason =
  explicitCoverageEnrollmentFollowUpBatch
    ? ""
    : coverageEnrollmentFollowUpPreviewRefreshReason(
        sourceCoverageEnrollmentFollowUpPlan,
        sourceCoverageEnrollmentFollowUpPlanPacket,
        sourceCoverageEnrollmentFollowUpBatch,
        sourceCoverageEnrollmentFollowUpBatchPacket
      );
if (coverageEnrollmentFollowUpBatchPreviewRefreshReason) {
  const previewItemCount = Math.max(1, coverageFollowUpItemCount(sourceCoverageEnrollmentFollowUpPlanPacket));
  const preview = runNodeScript("run-all-software-coverage-enrollment-follow-up-batch.mjs", [
    "--goal",
    `${goal} coverage enrollment follow-up preview`,
    "--plan",
    sourceCoverageEnrollmentFollowUpPlan,
    "--max-items",
    String(previewItemCount),
    "--max-queue-items",
    "1",
    "--max-logs-per-item",
    "1",
    "--max-tail-lines",
    "16",
    "--max-tail-bytes",
    "1024",
    "--output-dir",
    join(refreshDir, "coverage-enrollment-follow-up-batch-preview")
  ]);
  sourceCoverageEnrollmentFollowUpBatch = preview.batchPath || sourceCoverageEnrollmentFollowUpBatch;
  sourceCoverageEnrollmentFollowUpBatchPacket =
    sourceCoverageEnrollmentFollowUpBatch && existsSync(sourceCoverageEnrollmentFollowUpBatch)
      ? readJson(sourceCoverageEnrollmentFollowUpBatch)
      : sourceCoverageEnrollmentFollowUpBatchPacket;
  sourceCoverageEnrollmentFollowUpBatchReadme = sourceCoverageEnrollmentFollowUpBatch
    ? sourceCoverageEnrollmentFollowUpBatch.replace(
        /all-software-coverage-enrollment-follow-up-batch-run\.json$/,
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_START_HERE.md"
      )
    : "";
  coverageEnrollmentFollowUpBatchAutoPreviewed = true;
}

const readiness = runNodeScript("create-original-goal-readiness-audit.mjs", [
  "--goal",
  goal,
  "--output-dir",
  join(refreshDir, "original-goal-readiness-audit")
]);
const readinessAudit = readJson(readiness.auditPath);

const statusConsole = runNodeScript("create-all-software-operational-status-console.mjs", [
  "--goal",
  goal,
  "--scan-root",
  scanRoot,
  "--original-goal-readiness-audit",
  readiness.auditPath,
  ...(sourceLogSourceDiscoveryLedger ? ["--log-source-discovery-ledger", sourceLogSourceDiscoveryLedger] : []),
  "--output-dir",
  join(refreshDir, "operational-status-console")
]);
const statusPacket = readJson(statusConsole.consolePath);

let gapBoard = null;
let gapPacket = null;
let operationalPostActivationWitnessReceiptBuilder = null;
let controlChannelRepairReceiptBuilder = null;
let actionLogicSourceContractPackage = null;
let actionLogicSourceShortlist = null;
let executionGapReviewCockpit = null;
let executionGapReviewCockpitShortlist = null;

let commandCenter = null;
let commandCenterPacket = null;
let commandCenterVoiceWorkbenchPacket = null;
if (includeCommandCenter) {
  const commandCenterArgs = [
    "--goal",
    goal,
    "--software",
    software,
    "--command",
    command,
    "--teacher-style",
    teacherStyle,
    "--operational-status-console",
    statusConsole.consolePath,
    "--original-goal-readiness-audit",
    readiness.auditPath,
    "--output-dir",
    join(refreshDir, "goal-command-center"),
    "--no-port-scan"
  ];
  if (sourceExecutionFollowUpBatch) {
    commandCenterArgs.push("--execution-follow-up-batch", sourceExecutionFollowUpBatch);
  }
  if (sourceCoverageConvergence) {
    commandCenterArgs.push("--coverage-convergence", sourceCoverageConvergence);
  }
  if (sourceExecutionConvergence) {
    commandCenterArgs.push("--execution-convergence", sourceExecutionConvergence);
  }
  if (sourceCoverageEnrollmentLedger) {
    commandCenterArgs.push("--coverage-enrollment-ledger", sourceCoverageEnrollmentLedger);
  }
  if (sourceCoverageEnrollmentFollowUpPlan) {
    commandCenterArgs.push("--coverage-enrollment-follow-up-plan", sourceCoverageEnrollmentFollowUpPlan);
  }
  if (sourceCoverageEnrollmentFollowUpBatch) {
    commandCenterArgs.push("--coverage-enrollment-follow-up-batch", sourceCoverageEnrollmentFollowUpBatch);
  }
  if (sourceCoverageEnrollmentFollowUpReceiptBuilder) {
    commandCenterArgs.push("--coverage-enrollment-follow-up-receipt-builder", sourceCoverageEnrollmentFollowUpReceiptBuilder);
  }
  if (existsSync(sourceCoverageEnrollmentFollowUpReceiptTemplate)) {
    commandCenterArgs.push("--coverage-enrollment-follow-up-receipt-template", sourceCoverageEnrollmentFollowUpReceiptTemplate);
  }
  if (sourceCoverageEnrollmentFollowUpReconciliation) {
    commandCenterArgs.push("--coverage-enrollment-follow-up-reconciliation", sourceCoverageEnrollmentFollowUpReconciliation);
  }
  commandCenter = runNodeScript("create-goal-command-center.mjs", commandCenterArgs);
  commandCenterPacket = readJson(commandCenter.centerPath);
  if (commandCenterPacket.paths?.voiceWorkbench && existsSync(commandCenterPacket.paths.voiceWorkbench)) {
    commandCenterVoiceWorkbenchPacket = readJson(commandCenterPacket.paths.voiceWorkbench);
  }
}

const sourcePreflightTargetConfirmation =
  argValue("--preflight-target-confirmation", argValue("--target-confirmation", "")) ||
  commandCenterVoiceWorkbenchPacket?.generated?.activeTargetConfirmation ||
  commandCenterPacket?.paths?.voiceWorkbenchVisualTargetConfirmation ||
  "";
const numberedTargetConfirmCommandTemplate =
  commandCenterVoiceWorkbenchPacket?.nextConfirmCall?.arguments?.confirmCommandTemplate ||
  commandCenterPacket?.reviewPacket?.confirmNumberedTarget?.arguments?.confirmCommandTemplate ||
  "";
const transparentSketchOverlayPath = commandCenterPacket?.paths?.transparentOverlay || "";
const teacherExportedOverlayPacketPlaceholder = "<teacher-exported-transparent-sketch-packet.json>";
const transparentSketchOverlayPacketValidationCommandTemplate = commandLine(
  "validate-transparent-sketch-overlay-packet.mjs",
  [
    ["--overlay-packet", teacherExportedOverlayPacketPlaceholder],
    ["--output-dir", join(refreshDir, "transparent-sketch-overlay-packet-validation")]
  ]
);
const spatialTargetConfirmationCommandTemplate = transparentSketchOverlayPath
  ? commandLine("create-spatial-target-confirmation-kit.mjs", [
      ["--overlay-packet", teacherExportedOverlayPacketPlaceholder],
      ["--goal", goal],
      ["--software", software],
      ["--command", command],
      ["--output-dir", join(refreshDir, "spatial-target-confirmation-from-teacher-sketch")],
      ["--create-action-kit", "true"]
    ])
  : "";
const spatialRouteExecutionApprovalPrepHandoffPlaceholder =
  "<transparent_ai_spatial_route_execution_approval_prep_handoff_v1 path>";
const realLocalExecutionPilotSelectorPlaceholder = "<transparent_ai_real_local_execution_pilot_selector_v1 path>";
const spatialRoutePilotSelectionReceiptCommandTemplate = commandLine(
  "create-spatial-route-pilot-selection-receipt.mjs",
  [
    ["--goal", goal],
    ["--prep-handoff", spatialRouteExecutionApprovalPrepHandoffPlaceholder],
    ["--selector", realLocalExecutionPilotSelectorPlaceholder],
    ["--output-dir", join(refreshDir, "spatial-route-pilot-selection-receipt")]
  ]
);
const spatialRoutePilotSelectionReceiptValidationCommandTemplate = commandLine(
  "create-spatial-route-pilot-selection-receipt.mjs",
  [
    ["--goal", goal],
    ["--prep-handoff", spatialRouteExecutionApprovalPrepHandoffPlaceholder],
    ["--selector", realLocalExecutionPilotSelectorPlaceholder],
    ["--receipt", "<teacher-filled-spatial-route-pilot-selection-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "spatial-route-pilot-selection-receipt-validation")]
  ]
);
const knowledgeCorpusIngestCommandTemplate = commandLine("knowledge\\ingest-local-corpus.mjs", [
  ["--source", "<teacher-approved-manuals-standards-docs-folder-or-file>"],
  ["--out-dir", join(refreshDir, "knowledge-local-corpus")],
  ["--source-id-prefix", "teacher.supplied"],
  ["--source-type", "teacher_approved_domain_source"],
  ["--domain", "original_goal_all_software_learning"]
]);
const knowledgeAugmentedLowTokenLearningCommandTemplate = commandLine(
  "knowledge\\augment-low-token-learning-with-retrieval.mjs",
  [
    ["--corpus-index", "<teacher-approved-corpus-index.json>"],
    ["--learning-cycle", sourcePreflightLearningCycle || "<all-software-low-token-learning-cycle.json>"],
    ["--out-dir", join(refreshDir, "knowledge-augmented-low-token-learning")],
    ["--top-k", "3"],
    ["--max-events", "6"]
  ]
);
const ragResearchIntakeQueue = runNodeScript("knowledge\\create-rag-research-intake-queue.mjs", [
  "--out-dir",
  join(refreshDir, "rag-research-intake-queue")
]);
const ragResearchIntakeQueuePacket =
  ragResearchIntakeQueue.queuePath && existsSync(ragResearchIntakeQueue.queuePath)
    ? readJson(ragResearchIntakeQueue.queuePath)
    : {};
const ragResearchIntakeReceiptBuilder = runNodeScript("knowledge\\create-rag-research-intake-receipt-builder.mjs", [
  "--queue",
  ragResearchIntakeQueue.queuePath,
  "--out-dir",
  join(refreshDir, "rag-research-intake-receipt-builder")
]);
const ragResearchIntakeReceiptValidationCommandTemplate = commandLine("knowledge\\validate-rag-research-intake-receipt.mjs", [
  ["--queue", ragResearchIntakeQueue.queuePath],
  ["--receipt", "<teacher-filled-rag-research-intake-receipt.json>"],
  ["--out-dir", join(refreshDir, "rag-research-intake-receipt-validation")]
]);
const ragConfirmedSourceRegistryCommandTemplate = commandLine("knowledge\\create-rag-confirmed-source-registry-package.mjs", [
  ["--validation", "<ready-rag-research-intake-or-primary-source-validation.json>"],
  ["--out-dir", join(refreshDir, "rag-confirmed-source-registry-package")]
]);
const ragConfirmedLocalIngestRunnerCommandTemplate = commandLine("knowledge\\run-rag-confirmed-local-ingest.mjs", [
  ["--registry", "<rag-confirmed-source-registry.json>"],
  ["--source-id", "<teacher-reviewed-source-id-or-all>"],
  ["--rollback-point", "<retained-rollback-point-dir>"],
  ["--teacher-reviewed", "true"],
  ["--out-dir", join(refreshDir, "rag-confirmed-local-ingest")]
]);
const knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate = commandLine(
  "knowledge\\create-knowledge-augmented-low-token-learning-from-confirmed-ingest.mjs",
  [
    ["--ingest-run", "<teacher-reviewed-rag-confirmed-local-ingest-run.json>"],
    ["--learning-cycle", sourcePreflightLearningCycle || "<all-software-low-token-learning-cycle.json>"],
    ["--rollback-point", "<retained-rollback-point-dir>"],
    ["--teacher-reviewed", "true"],
    ["--out-dir", join(refreshDir, "knowledge-augmented-low-token-learning-from-confirmed-ingest")],
    ["--top-k", "3"],
    ["--max-events", "6"]
  ]
);
const knowledgeAugmentedSpatialExecutionBridgeCommandTemplate = commandLine(
  "create-knowledge-augmented-spatial-execution-bridge.mjs",
  [
    ["--goal", `${goal} Ground the selected transparent sketch software route with retrieved low-token evidence before dry-run.`],
    ["--software", software],
    [
      "--knowledge-augmented-learning",
      sourceKnowledgeAugmentedLowTokenLearning || "<transparent_ai_knowledge_augmented_low_token_learning_v1 path>"
    ],
    [
      "--spatial-route-bridge",
      sourceSpatialSoftwareExecutionRouteBridge || "<transparent_ai_spatial_software_execution_route_bridge_v1 path>"
    ],
    ["--output-dir", join(refreshDir, "knowledge-augmented-spatial-execution-bridge")]
  ]
);
const knowledgeAugmentedSpatialExecutionBridgeMissingInputs = [
  sourceKnowledgeAugmentedLowTokenLearning ? "" : "teacher_reviewed_knowledge_augmented_low_token_learning_packet",
  sourceSpatialSoftwareExecutionRouteBridge ? "" : "teacher_reviewed_spatial_software_execution_route_bridge"
].filter(Boolean);
const knowledgeAugmentedSpatialExecutionBridgeCommandReviewPath = join(
  refreshDir,
  "knowledge-augmented-spatial-execution-bridge-command-review.json"
);
const knowledgeAugmentedSpatialExecutionBridgeCommandReview = {
  ok: true,
  format: "transparent_ai_knowledge_augmented_spatial_execution_bridge_command_review_v1",
  status:
    sourceKnowledgeAugmentedLowTokenLearning && sourceSpatialSoftwareExecutionRouteBridge
      ? "ready_for_teacher_reviewed_knowledge_spatial_bridge_command"
      : "waiting_for_knowledge_augmented_learning_and_spatial_route_bridge_inputs",
  adviserSuggestionExtract: {
    source: "teacher_shared_wechat_screenshots_2026_06_12",
    extractedDirection: [
      "research knowledge augmentation for the apprentice",
      "use RAG as an external knowledge-base retriever for the large model",
      "let ordinary users cultivate domain-specific intelligent agents at low cost",
      "study existing domestic work, including Zhejiang University team references, before over-building"
    ],
    addedToGoal: true
  },
  commandTemplate: knowledgeAugmentedSpatialExecutionBridgeCommandTemplate,
  smokeCommandTemplate: "npm.cmd run smoke:plugin-knowledge-augmented-spatial-execution-bridge",
  sourceEvidence: {
    knowledgeAugmentedLowTokenLearning: sourceKnowledgeAugmentedLowTokenLearning,
    spatialSoftwareExecutionRouteBridge: sourceSpatialSoftwareExecutionRouteBridge
  },
  realInputCommandTemplates: {
    ingestTeacherApprovedCorpus: knowledgeCorpusIngestCommandTemplate,
    augmentRealLowTokenLearningWithRetrieval: knowledgeAugmentedLowTokenLearningCommandTemplate
  },
  missingInputs: knowledgeAugmentedSpatialExecutionBridgeMissingInputs,
  evidenceBoundary: {
    smokeEvidenceAllowedInThisRefresh: allowSmokeEvidence,
    smokeEvidenceIsNeverFinalGoalProof: true,
    syntheticSmokeKnowledgePacketMayNotSatisfyOriginalGoal: true,
    teacherApprovedCorpusRequiredForGoalEvidence: true,
    realLowTokenLearningCycleRequiredForGoalEvidence: true
  },
  requiredBeforeExecution: [
    "teacher supplies or approves a real corpus index, not a smoke fixture",
    "knowledge augmentation runs on a real low-token learning cycle or teacher-reviewed compact event packet",
    "teacher reviews retrieved knowledge evidence",
    "teacher reviews the selected transparent sketch or software route",
    "bridge output passes smoke verification",
    "execution dry-run remains separate from acceptance"
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    fullLogRead: false,
    screenshotsCaptured: false,
    memoryWritten: false
  }
};
writeFileSync(
  knowledgeAugmentedSpatialExecutionBridgeCommandReviewPath,
  `${JSON.stringify(knowledgeAugmentedSpatialExecutionBridgeCommandReview, null, 2)}\n`,
  "utf8"
);
const transparentSketchDepthDemonstrationRehearsalCommandTemplate = commandLine(
  "create-transparent-sketch-depth-demonstration-rehearsal.mjs",
  [
    ["--goal", `${goal} Rehearse the transparent 2D perspective 3D sketch demonstration chain without executing software.`],
    ["--software", software],
    ["--command", command],
    ["--output-dir", join(refreshDir, "transparent-sketch-depth-demonstration-rehearsal")]
  ]
);
const transparentSketchDepthDemonstrationRehearsal = runNodeScript(
  "create-transparent-sketch-depth-demonstration-rehearsal.mjs",
  [
    "--goal",
    `${goal} Rehearse the transparent 2D perspective 3D sketch demonstration chain without executing software.`,
    "--software",
    software,
    "--command",
    command,
    "--output-dir",
    join(refreshDir, "transparent-sketch-depth-demonstration-rehearsal")
  ]
);
const transparentSketchDepthRehearsalReviewReceiptBuilderCommandTemplate =
  transparentSketchDepthRehearsalReviewReceiptBuilderCommand(
    transparentSketchDepthDemonstrationRehearsal?.rehearsalPath || "",
    refreshDir
  );
const transparentSketchDepthRehearsalReviewReceiptBuilder = runNodeScript(
  "create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs",
  [
    "--goal",
    `${goal} Review the transparent 2D perspective 3D sketch rehearsal with a teacher receipt before route review.`,
    "--rehearsal",
    transparentSketchDepthDemonstrationRehearsal?.rehearsalPath || "",
    "--output-dir",
    join(refreshDir, "transparent-sketch-depth-rehearsal-review-receipt-builder")
  ]
);
const transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate =
  transparentSketchDepthRehearsalReviewReceiptBuilder?.nextValidationCommand ||
  transparentSketchDepthRehearsalReviewReceiptValidationCommand(
    transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.builder || "",
    refreshDir
  );

if (!sourcePreflightVisualCheckQueue && (sourcePreflightRunner || sourcePreflightLearningCycle)) {
  const visualQueueArgs = [
    "--goal",
    `${goal} Review changed low-token evidence before spending screenshot tokens.`,
    "--software",
    software,
    "--output-dir",
    join(refreshDir, "automatic-triggered-visual-check-queue"),
    "--max-requests",
    "5",
    "--allow-metadata-visual-check"
  ];
  if (sourcePreflightRunner) visualQueueArgs.push("--runner", sourcePreflightRunner);
  if (sourcePreflightLearningCycle) visualQueueArgs.push("--learning-cycle", sourcePreflightLearningCycle);
  const generatedVisualQueue = runNodeScript("create-automatic-triggered-visual-check-queue.mjs", visualQueueArgs);
  generatedPreflightVisualCheckQueue = generatedVisualQueue.queuePath || "";
  sourcePreflightVisualCheckQueue = generatedPreflightVisualCheckQueue;
}

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  refreshDoesNotRegisterTask: true,
  refreshDoesNotLaunchRunner: true,
  refreshDoesNotExecuteWrapper: true,
  refreshDoesNotExecuteTargetSoftware: true,
  refreshDoesNotCaptureScreenshots: true,
  refreshDoesNotReadFullLogs: true,
  refreshDoesNotWriteMemory: true,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};

const rollbackPoint = runNodeScript("create-rollback-point.mjs", [
  "--label",
  `current status activation review ${refreshId}`,
  "--reason",
  "Retain a rollback point before any teacher-confirmed automatic low-token monitor registration review.",
  "--path",
  join("plugins", "transparent-ai-apprentice"),
  "--output-dir",
  join(refreshDir, "rollback-point")
]);

const transparentSketchLogicContractRuleDraftCommandTemplate = commandLine(
  "create-transparent-sketch-logic-contract-rule-draft.mjs",
  [
    [
      "--spatial-intent",
      transparentSketchDepthDemonstrationRehearsal?.spatialIntent ||
        "<teacher-reviewed-spatial-intent-interpretation.json>"
    ],
    ["--rollback-point", rollbackPoint.rollbackDir || "<retained-rollback-point-dir>"],
    ["--teacher-reviewed-spatial-intent", "true"],
    ["--output-dir", join(refreshDir, "transparent-sketch-logic-contract-rule-draft")]
  ]
);

const teacherMethodExecutionLearningContractCommandTemplate = commandLine(
  "create-teacher-method-execution-learning-contract.mjs",
  [
    ["--profile", sourceTeacherLearningMethodProfile || "<teacher-learning-method-profile.json>"],
    [
      "--low-token-learning-handoff",
      latestLowTokenCompactEvidenceLearningHandoff ||
        "<original-goal-low-token-compact-evidence-learning-handoff.json>"
    ],
    [
      "--transparent-sketch-rule-draft",
      sourceTransparentSketchLogicContractRuleDraft ||
        "<transparent-sketch-logic-contract-rule-draft.json>"
    ],
    ["--rollback-point", rollbackPoint.rollbackDir || "<retained-rollback-point-dir>"],
    ["--teacher-reviewed-method", "true"],
    ["--output-dir", join(refreshDir, "teacher-method-execution-learning-contract")]
  ]
);

const lowTokenPreflightArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--command",
  command,
  "--teacher-style",
  teacherStyle,
  "--rollback-point",
  rollbackPoint.manifestPath,
  "--output-dir",
  join(refreshDir, "low-token-operation-preflight-policy")
];
if (sourcePreflightRunner) lowTokenPreflightArgs.push("--runner", sourcePreflightRunner);
if (sourcePreflightLearningCycle) lowTokenPreflightArgs.push("--learning-cycle", sourcePreflightLearningCycle);
if (sourcePreflightVisualCheckQueue) lowTokenPreflightArgs.push("--visual-check-queue", sourcePreflightVisualCheckQueue);
if (sourcePreflightTargetConfirmation) lowTokenPreflightArgs.push("--target-confirmation", sourcePreflightTargetConfirmation);
if (sourcePreflightSpatialIntent) lowTokenPreflightArgs.push("--spatial-intent", sourcePreflightSpatialIntent);
if (sourcePreflightExecutionGate) lowTokenPreflightArgs.push("--execution-gate", sourcePreflightExecutionGate);
const lowTokenOperationPreflight = runNodeScript("create-low-token-operation-preflight-policy.mjs", lowTokenPreflightArgs);

const lowTokenTriggerBudgetPlanArgs = [
  "--goal",
  `${goal} Choose the lowest-token next review step before any screenshot-heavy follow-up.`,
  "--software",
  software,
  "--token-budget",
  "12",
  "--max-actions",
  "8",
  "--output-dir",
  join(refreshDir, "low-token-trigger-budget-plan")
];
if (sourcePreflightRunner) lowTokenTriggerBudgetPlanArgs.push("--runner", sourcePreflightRunner);
if (sourcePreflightLearningCycle) lowTokenTriggerBudgetPlanArgs.push("--learning-cycle", sourcePreflightLearningCycle);
if (sourcePreflightVisualCheckQueue) lowTokenTriggerBudgetPlanArgs.push("--visual-check-queue", sourcePreflightVisualCheckQueue);
if (lowTokenOperationPreflight.policyPath) lowTokenTriggerBudgetPlanArgs.push("--preflight-policy", lowTokenOperationPreflight.policyPath);
const lowTokenTriggerBudgetPlan = runNodeScript("create-low-token-trigger-budget-plan.mjs", lowTokenTriggerBudgetPlanArgs);
const lowTokenTriggerBudgetPlanCommandTemplate = commandLine("create-low-token-trigger-budget-plan.mjs", [
  ["--runner", sourcePreflightRunner || "<automatic-low-token-learning-runner.json>"],
  ["--learning-cycle", sourcePreflightLearningCycle || "<all-software-low-token-learning-cycle.json>"],
  ["--visual-check-queue", sourcePreflightVisualCheckQueue || "<automatic-triggered-visual-check-queue.json>"],
  ["--preflight-policy", lowTokenOperationPreflight.policyPath || "<low-token-operation-preflight-policy.json>"],
  ["--token-budget", "12"],
  ["--max-actions", "8"],
  ["--output-dir", join(refreshDir, "low-token-trigger-budget-plan")]
]);
const eventTriggeredObservationPolicy = runNodeScript("create-event-triggered-low-token-observation-policy.mjs", [
  "--budget-plan",
  lowTokenTriggerBudgetPlan.planPath,
  "--goal",
  `${goal} Use event-triggered metadata, compact tails, and one teacher-confirmed visual check instead of continuous recording.`,
  "--output-dir",
  join(refreshDir, "event-triggered-low-token-observation-policy")
]);
const eventTriggeredObservationPolicyCommandTemplate = commandLine("create-event-triggered-low-token-observation-policy.mjs", [
  ["--budget-plan", lowTokenTriggerBudgetPlan.planPath || "<low-token-trigger-budget-plan.json>"],
  ["--goal", `${goal} Use event-triggered metadata, compact tails, and one teacher-confirmed visual check instead of continuous recording.`],
  ["--output-dir", join(refreshDir, "event-triggered-low-token-observation-policy")]
]);
const eventTriggeredObservationPolicyReceiptBuilder = runNodeScript(
  "create-event-triggered-low-token-observation-policy-receipt-builder.mjs",
  [
    "--policy",
    eventTriggeredObservationPolicy.policyPath,
    "--goal",
    `${goal} Build a teacher-facing browser receipt page for event-triggered low-token policy review before any visual follow-up.`,
    "--output-dir",
    join(refreshDir, "event-triggered-low-token-observation-policy-receipt-builder")
  ]
);
const eventTriggeredObservationPolicyReceiptBuilderCommandTemplate = commandLine(
  "create-event-triggered-low-token-observation-policy-receipt-builder.mjs",
  [
    ["--policy", eventTriggeredObservationPolicy.policyPath || "<event-triggered-low-token-observation-policy.json>"],
    ["--goal", `${goal} Build a teacher-facing browser receipt page for event-triggered low-token policy review before any visual follow-up.`],
    ["--output-dir", join(refreshDir, "event-triggered-low-token-observation-policy-receipt-builder")]
  ]
);
const eventTriggeredObservationPolicyReceiptValidationCommandTemplate =
  eventTriggeredObservationPolicyReceiptBuilder.nextValidationCommand ||
  eventTriggeredObservationPolicy.receiptValidationCommandTemplate ||
  commandLine("validate-event-triggered-low-token-observation-policy-receipt.mjs", [
    ["--policy", eventTriggeredObservationPolicy.policyPath || "<event-triggered-low-token-observation-policy.json>"],
    ["--receipt", "<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>"],
    ["--output-dir", join(refreshDir, "event-triggered-low-token-observation-policy-receipt-validation")]
  ]);
const triggeredVisualCaptureCommandTemplate = commandLine("capture-triggered-visual-check.mjs", [
  ["--request", sourcePreflightVisualCheckQueue || "<automatic-triggered-visual-check-queue.json>"],
  ["--selected-request-id", "<teacher-reviewed-automatic-visual-check-id>"],
  ["--teacher-confirmed", "true"],
  ["--reviewed-source-image", "<teacher-reviewed-single-screenshot-path.png>"],
  ["--teacher-note", "<teacher-confirmed-one-bounded-visual-check-after-low-token-change>"],
  ["--output-dir", join(refreshDir, "triggered-visual-capture")]
]);
const triggeredVisualLearningHandoffCommandTemplate = commandLine("create-triggered-visual-evidence-learning-handoff.mjs", [
  ["--capture-receipt", "<triggered-visual-check-capture-receipt.json>"],
  ["--request", sourcePreflightVisualCheckQueue || "<automatic-triggered-visual-check-queue.json>"],
  ["--screenshot", "<teacher-reviewed-single-screenshot-path.png>"],
  ["--goal", "Teach from low-token changed evidence plus one teacher-confirmed visual check before memory or execution."],
  ["--output-dir", join(refreshDir, "triggered-visual-learning-handoff")]
]);
const triggeredVisualLearningHandoffReviewCommandTemplate = commandLine("run-triggered-visual-evidence-learning-handoff-review.mjs", [
  ["--handoff", "<triggered-visual-evidence-learning-handoff.json>"],
  ["--output-dir", join(refreshDir, "triggered-visual-learning-handoff-review")]
]);
const triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate = commandLine(
  "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs",
  [
    ["--review", "<triggered-visual-evidence-learning-handoff-review.json>"],
    ["--receipt", "<teacher-filled-triggered-visual-learning-review-receipt.json>"],
    ["--output-dir", join(refreshDir, "triggered-visual-learning-handoff-review-receipt-validation")]
  ]
);
const triggeredVisualVoiceControlWorkbenchCommandTemplate = commandLine("create-triggered-visual-evidence-voice-control-workbench.mjs", [
  ["--handoff", "<triggered-visual-evidence-learning-handoff.json>"],
  ["--software", software],
  ["--command", "<teacher voice transcript or typed command>"],
  ["--output-dir", join(refreshDir, "triggered-visual-voice-control-workbench")]
]);
const triggeredVisualCheckCommandBuilderArgs = [
  "--goal",
  `${goal} Build one teacher-confirmed visual-check command after low-token changed evidence.`,
  "--output-dir",
  join(refreshDir, "triggered-visual-check-command-builder")
];
if (sourcePreflightVisualCheckQueue) {
  triggeredVisualCheckCommandBuilderArgs.push("--queue", sourcePreflightVisualCheckQueue);
}
const triggeredVisualCheckCommandBuilder = runNodeScript(
  "create-triggered-visual-check-command-builder.mjs",
  triggeredVisualCheckCommandBuilderArgs
);
const triggeredVisualCheckCommandBuilderCommandTemplate = triggeredVisualCheckCommandBuilderCommand(
  refreshDir,
  sourcePreflightVisualCheckQueue
);

const refreshPath = join(refreshDir, "original-goal-current-status-refresh.json");
const readmePath = join(refreshDir, "ORIGINAL_GOAL_CURRENT_STATUS_REFRESH_START_HERE.md");
const dashboardPath = join(refreshDir, "original-goal-current-status-dashboard.html");
const spatialIntentFormalEvidenceEntrypointCommandTemplate = commandLine(
  "create-spatial-intent-formal-evidence-entrypoint.mjs",
  [
    ["--refresh", refreshPath],
    ["--output-dir", join(refreshDir, "spatial-intent-formal-evidence-entrypoint")]
  ]
);
const nextActionTriagePath = join(refreshDir, "original-goal-next-action-triage.json");
const nextActionTriageHtmlPath = join(refreshDir, "original-goal-next-action-triage.html");
const teacherActionShortlistPath = join(refreshDir, "original-goal-teacher-action-shortlist.json");
const teacherActionShortlistReceiptTemplatePath = join(
  refreshDir,
  "original-goal-teacher-action-shortlist-router-receipt-template.json"
);
const nonExpertVoiceControlCapabilityPath = join(refreshDir, "non-expert-engineering-voice-control-capability.json");
const nonExpertVoiceControlCapabilityHtmlPath = join(refreshDir, "non-expert-engineering-voice-control-capability.html");
const spatialIntentEvidenceRequestPath = join(refreshDir, "spatial-intent-evidence-request.json");
const spatialIntentEvidenceRequestHtmlPath = join(refreshDir, "spatial-intent-evidence-request.html");
const spatialIntentEvidenceReceiptTemplatePath = join(refreshDir, "spatial-intent-evidence-receipt-template.json");
let spatialIntentEvidenceReceiptBuilder = null;
let parametricDrawingLogicKitPath = discoveredParametricDrawingLogicKit;
let parametricDrawingLogicKit = parametricDrawingLogicKitPath ? readJson(parametricDrawingLogicKitPath) : null;
if (!parametricDrawingLogicKitPath) {
  const generatedParametricKit = runNodeScript("create-parametric-drawing-logic-learning-kit.mjs", [
    "--goal",
    `${goal} Learn rigorous universal detail logic for drawings, models, sketches, diagrams, and software outputs before generating anything that only looks similar.`,
    "--software",
    software,
    "--output-dir",
    join(refreshDir, "parametric-drawing-logic-learning-kit")
  ]);
  parametricDrawingLogicKitPath = generatedParametricKit.kitPath || "";
  parametricDrawingLogicKit = parametricDrawingLogicKitPath ? readJson(parametricDrawingLogicKitPath) : null;
}
const parametricDrawingLogicKitHtmlPath =
  parametricDrawingLogicKit?.paths?.html ||
  parametricDrawingLogicKitPath.replace(/parametric-drawing-logic-learning-kit\.json$/, "parametric-drawing-logic-learning-kit.html");
const parametricDrawingLogicKitReadmePath = parametricDrawingLogicKit?.paths?.readme || "";
const parametricDrawingLogicReceiptTemplatePath = parametricDrawingLogicKit?.paths?.receiptTemplate || "";
const parametricDrawingLogicReceiptValidationCommandTemplate = parametricDrawingLogicKitPath
  ? commandLine("validate-parametric-drawing-logic-receipt.mjs", [
      ["--kit", parametricDrawingLogicKitPath],
      ["--receipt", "<teacher-filled-parametric-drawing-logic-receipt.json>"],
      ["--output-dir", join(refreshDir, "parametric-drawing-logic-receipt-validation")]
    ])
  : "";
const parametricDrawingLogicRulePackageCommandTemplate = parametricDrawingLogicKitPath
  ? commandLine("compile-parametric-drawing-logic-rule-package.mjs", [
      ["--kit", parametricDrawingLogicKitPath],
      ["--validation", "<teacher-reviewed-parametric-drawing-logic-receipt-validation.json>"],
      ["--output-dir", join(refreshDir, "universal-detail-logic-rule-package")]
    ])
  : "";
const universalDetailLogicApplicationDryRunCommandTemplate = commandLine(
  "apply-universal-detail-logic-rule-package-dry-run.mjs",
  [
    ["--package", "<teacher-reviewed-universal-detail-logic-rule-package.json>"],
    ["--new-data", "<new-data.json>"],
    ["--output-dir", join(refreshDir, "universal-detail-logic-application-dry-run")]
  ]
);
const universalDetailLogicExistingToolPreviewCommandTemplate = commandLine(
  "create-universal-detail-logic-existing-tool-preview-package.mjs",
  [
    ["--dry-run", "<reviewed-universal-detail-logic-application-dry-run.json>"],
    ["--output-dir", join(refreshDir, "universal-detail-logic-existing-tool-preview")]
  ]
);
const statusLanes = Array.isArray(statusPacket.lanes) ? statusPacket.lanes : [];
const blockedLanes = statusLanes.filter((lane) => !["ready", "ready_for_teacher_operational_review", "provided"].includes(String(lane.status || "")));
const nonExpertVoiceControlCapability = {
  ok: true,
  format: "transparent_ai_non_expert_engineering_voice_control_capability_v1",
  refreshId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status: commandCenterVoiceWorkbenchPacket
    ? "ready_for_teacher_reviewed_non_expert_voice_or_text_control"
    : "waiting_for_engineering_voice_control_workbench_generation",
  summary:
    "A non-expert user can speak or type an engineering software instruction, review the apprentice's interpreted operation, inspect numbered possible targets, confirm exactly one number or correct the target, and only then hand off to dry-run-first supervised execution gates.",
  existingCapabilitiesReused: [
    "browser Web Speech API or typed command input",
    "create_engineering_voice_control_workbench",
    "create_engineering_command_confirmation_kit",
    "confirm_engineering_command_target",
    "transparent sketch overlay to numbered spatial target bridge",
    "create_supervised_software_action_kit",
    "create_existing_software_execution_adapter",
    "engineering_voice_execution_approval_gate",
    "verify_supervised_action_outcome",
    "post_action_evidence_checkpoint"
  ],
  entryPoints: {
    workbench: commandCenterPacket?.paths?.voiceWorkbench || "",
    workbenchHtml: commandCenterPacket?.paths?.voiceWorkbenchHtml || commandCenterVoiceWorkbenchPacket?.htmlPath || "",
    commandInput: commandCenterPacket?.paths?.voiceWorkbenchCommandInput || "",
    numberedTargetConfirmationPacket: sourcePreflightTargetConfirmation,
    transparentSketchOverlay: transparentSketchOverlayPath,
    lowTokenOperationPreflightPolicy: lowTokenOperationPreflight.htmlPath || lowTokenOperationPreflight.policyPath || "",
    capabilityJson: nonExpertVoiceControlCapabilityPath,
    capabilityHtml: nonExpertVoiceControlCapabilityHtmlPath
  },
  workflowSteps: [
    {
      order: 1,
      label: "voice_or_text_instruction",
      trace: "Capture one short voice transcript or typed engineering instruction; continuous recording stays off.",
      status: "ready"
    },
    {
      order: 2,
      label: "interpret_operation",
      trace: "Restate the understood engineering operation and expose confidence instead of acting immediately.",
      status: "ready"
    },
    {
      order: 3,
      label: "mark_numbered_possible_targets",
      trace: "Mark possible screen, model, control, or sketch targets with visible numbers for teacher review.",
      status: sourcePreflightTargetConfirmation ? "ready_with_packet" : "waiting_for_target_confirmation_packet"
    },
    {
      order: 4,
      label: "teacher_confirms_one_number",
      trace: "Wait for exactly one confirmed number or a correction; unselected candidates cannot enter the action bridge.",
      status: "teacher_confirmation_required"
    },
    {
      order: 5,
      label: "compile_confirmed_target_only",
      trace: "Compile only the selected target into a confirmed overlay packet and dry-run-first action route.",
      status: "blocked_until_number_confirmed"
    },
    {
      order: 6,
      label: "execute_only_after_supervised_gate",
      trace: "Execution still requires dry-run receipt, target-window or route preflight, explicit execute approval, outcome verification, and rollback evidence.",
      status: "blocked_until_supervised_execute_approval"
    }
  ],
  nextCommands: [
    {
      label: "Open the non-expert voice/text workbench",
      command: commandCenterPacket?.paths?.voiceWorkbenchHtml || commandCenterPacket?.paths?.voiceWorkbench || ""
    },
    {
      label: "Review the numbered target confirmation packet",
      command: sourcePreflightTargetConfirmation
    },
    {
      label: "After teacher confirms exactly one number, replace __SELECTED_NUMBER__ and create a single-target confirmation",
      command: numberedTargetConfirmCommandTemplate
    },
    {
      label: "If position or 3D depth is ambiguous, open the transparent sketch overlay",
      command: transparentSketchOverlayPath
    },
    {
      label: "Check low-token operation preflight before any visual capture or execution gate",
      command: lowTokenOperationPreflight.htmlPath || lowTokenOperationPreflight.policyPath || ""
    }
  ],
  teacherPromptTemplate:
    "Say or type what you want the engineering software to do. I will restate my understanding, mark likely locations with numbers, wait for you to confirm one number or correct me, then prepare only a dry-run-first supervised route.",
  nonExpertUserValue:
    "The user does not need to know where the tool lives in the engineering software; the apprentice proposes numbered choices and waits for confirmation before preparing any software action.",
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    canExecuteNow: false,
    continuousRecording: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    teacherMustConfirmExactlyOneNumber: true,
    dryRunRequiredBeforeExecute: true,
    targetWindowOrRoutePreflightRequired: true,
    outcomeVerificationRequired: true
  },
  blockedActions: [
    "execute_from_voice_or_text_without_numbered_target_confirmation",
    "execute_without_dry_run_receipt",
    "execute_without_target_window_or_route_preflight",
    "continuous_recording_for_convenience",
    "capture_screenshot_without_low_token_trigger_or_teacher_review",
    "write_memory_or_enable_rule_without_teacher_approval",
    "claim_universal_native_engineering_control_complete"
  ]
};
const spatialIntentEvidenceRequest = {
  ok: true,
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  refreshId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status: spatialIntentEvidenceReceiptValidationReady
    ? "formal_spatial_intent_evidence_validated_prepare_numbered_confirmation"
    : sourcePreflightSpatialIntent
      ? "raw_spatial_intent_packet_found_waiting_for_formal_receipt_validation"
      : "waiting_for_teacher_exported_overlay_packet",
  purpose:
    "Requests real teacher spatial-intent evidence for 2D, perspective, and 3D/depth sketch demonstrations before any numbered spatial target confirmation or software action route is prepared.",
  transparentSketchOverlayPath,
  teacherExportedOverlayPacketPlaceholder,
  expectedPacketFormat: "transparent_ai_sketch_overlay_packet_v1",
  spatialTargetConfirmationCommandTemplate,
  teacherHandoffSteps: [
    {
      order: 1,
      action: "Open the transparent sketch overlay over the target software or reviewed visual evidence.",
      evidenceExpected: "Teacher can see the software context behind the transparent mask.",
      stopCondition: "Stop if the target context is not visible or the overlay is not aligned."
    },
    {
      order: 2,
      action: "Draw the intended 2D position, perspective relationship, or 3D/depth hint on the overlay.",
      evidenceExpected: "Strokes, anchors, labels, or z/depth hints express the teacher's intended target and relation.",
      stopCondition: "Stop if the sketch is only decorative or does not identify an actionable target."
    },
    {
      order: 3,
      action: "Export the real teacher packet from the overlay.",
      evidenceExpected: "A JSON packet with format transparent_ai_sketch_overlay_packet_v1.",
      stopCondition: "Stop if only the placeholder path exists or the exported packet is missing."
    },
    {
      order: 4,
      action: "Replace the placeholder path in the spatial target confirmation command with the exported packet path.",
      evidenceExpected: "The command points to the teacher-exported packet, not a sample or generated placeholder.",
      stopCondition: "Stop if the command still contains <teacher-exported-transparent-sketch-packet.json>."
    },
    {
      order: 5,
      action: "Run the spatial target confirmation builder to produce numbered targets for teacher confirmation.",
      evidenceExpected: "Numbered spatial target confirmation packet waiting for exactly one teacher-confirmed number.",
      stopCondition: "Stop before any software execution, memory write, rule enablement, or packaging unlock."
    }
  ],
  verifierCommandTemplate: spatialTargetConfirmationCommandTemplate,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    rawSpatialIntentPacketPresent: Boolean(sourcePreflightSpatialIntent),
    formalSpatialIntentEvidencePresent: spatialIntentEvidenceReceiptValidationReady,
    formalSpatialIntentEvidenceValidationRequired: !spatialIntentEvidenceReceiptValidationReady,
    doesNotInterpretWithoutTeacherPacket: true,
    doesNotCreateFakeOverlayPacket: true,
    doesNotUseSamplePacketAsTeacherEvidence: true,
    doesNotExecuteSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    teacherMustConfirmNumberedSpatialTarget: true
  },
  blockedActions: [
    "fabricate_spatial_intent_without_teacher_exported_packet",
    "treat_placeholder_as_teacher_evidence",
    "confirm_spatial_target_without_teacher_number",
    "execute_software_from_spatial_evidence_request",
    "write_memory_from_spatial_evidence_request",
    "enable_rule_from_spatial_evidence_request",
    "unlock_packaging_from_spatial_evidence_request"
  ]
};
const spatialIntentEvidenceReceiptValidationCommandTemplate = commandLine("validate-spatial-intent-evidence-receipt.mjs", [
  ["--request", spatialIntentEvidenceRequestPath],
  ["--receipt", "<teacher-filled-spatial-intent-evidence-receipt.json>"],
  ["--output-dir", join(refreshDir, "spatial-intent-evidence-receipt-validation")]
]);
const spatialIntentEvidenceReceiptTemplate = {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  status: "needs_teacher_exported_overlay_packet",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_prepare_spatial_confirmation",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "enable_memory",
    "claim_complete",
    "unlock_packaging",
    "native_universal_execution"
  ],
  evidenceReviewed: false,
  teacherExportedOverlayPacketPath: teacherExportedOverlayPacketPlaceholder,
  teacherNote: "",
  nextValidationCommandTemplate: spatialIntentEvidenceReceiptValidationCommandTemplate,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    receiptTemplateDoesNotValidateReceipt: true,
    receiptTemplateDoesNotInterpretSketch: true,
    receiptTemplateDoesNotExecuteSoftware: true,
    memoryWritten: false
  }
};

writeFileSync(spatialIntentEvidenceRequestPath, `${JSON.stringify(spatialIntentEvidenceRequest, null, 2)}\n`, "utf8");
spatialIntentEvidenceReceiptBuilder = runNodeScript("create-spatial-intent-evidence-receipt-builder.mjs", [
  "--goal",
  goal,
  "--request",
  spatialIntentEvidenceRequestPath,
  "--output-dir",
  join(refreshDir, "spatial-intent-evidence-receipt-builder")
]);

if (sourceOperationalPostActivationWitness) {
  operationalPostActivationWitnessReceiptBuilder = runNodeScript(
    "create-all-software-operational-post-activation-witness-receipt-builder.mjs",
    [
      "--goal",
      goal,
      "--witness",
      sourceOperationalPostActivationWitness,
      "--output-dir",
      join(refreshDir, "post-activation-witness-receipt-builder")
    ]
  );
}
const operationalPostActivationWitnessReceiptValidationCommandTemplate =
  operationalPostActivationWitnessReceiptBuilder?.builderPath
    ? commandLine("validate-all-software-operational-post-activation-witness-receipt.mjs", [
        ["--goal", goal],
        ["--builder", operationalPostActivationWitnessReceiptBuilder.builderPath],
        ["--receipt", "<teacher-filled-post-activation-witness-evidence-receipt.json>"],
        ["--output-dir", join(refreshDir, "post-activation-witness-receipt-validation")]
      ])
    : "";

gapBoard = runNodeScript("create-original-goal-gap-action-board.mjs", [
  "--goal",
  goal,
  "--status-console",
  statusConsole.consolePath,
  ...(sourceCoverageConvergence ? ["--coverage-convergence", sourceCoverageConvergence] : []),
  ...(sourceCoverageRolloutReceiptBuilder ? ["--coverage-rollout-receipt-builder", sourceCoverageRolloutReceiptBuilder] : []),
  ...(sourceExecutionConvergence ? ["--execution-convergence", sourceExecutionConvergence] : []),
  ...(sourceExecutionFollowUpBatch ? ["--execution-follow-up-batch", sourceExecutionFollowUpBatch] : []),
  ...(spatialIntentEvidenceRequestPath ? ["--spatial-intent-evidence-request", spatialIntentEvidenceRequestPath] : []),
  "--output-dir",
  join(refreshDir, "gap-action-board")
]);
gapPacket = readJson(gapBoard.boardPath);

if (sourceExecutionFollowUpBatch) {
  controlChannelRepairReceiptBuilder = runNodeScript("create-all-software-control-channel-repair-receipt-builder.mjs", [
    "--goal",
    "Review control-channel evidence together with action logic before execution follow-up.",
    "--follow-up-batch",
    sourceExecutionFollowUpBatch,
    "--output-dir",
    join(refreshDir, "control-channel-repair-receipt-builder")
  ]);
  actionLogicSourceContractPackage = runNodeScript("create-all-software-action-logic-source-contract-package.mjs", [
    "--goal",
    "Create teacher-review-only action logic source contracts before execution dry-run or medium-runtime reuse.",
    "--batch",
    sourceExecutionFollowUpBatch,
    "--output-dir",
    join(refreshDir, "action-logic-source-contract-package")
  ]);
  if (actionLogicSourceContractPackage?.packagePath) {
    actionLogicSourceShortlist = runNodeScript("create-all-software-action-logic-source-shortlist.mjs", [
      "--goal",
      "Select the first teacher-review action logic source contract before execution dry-run or medium-runtime reuse.",
      "--package",
      actionLogicSourceContractPackage.packagePath,
      "--output-dir",
      join(refreshDir, "action-logic-source-shortlist")
    ]);
  }
  if (controlChannelRepairReceiptBuilder?.builderPath && actionLogicSourceContractPackage?.packagePath) {
    executionGapReviewCockpit = runNodeScript("create-all-software-execution-gap-review-cockpit.mjs", [
      "--goal",
      "Review control-channel evidence and action logic contracts together before any execution follow-up.",
      "--control-channel-builder",
      controlChannelRepairReceiptBuilder.builderPath,
      "--action-logic-package",
      actionLogicSourceContractPackage.packagePath,
      "--output-dir",
      join(refreshDir, "execution-gap-review-cockpit")
    ]);
    if (executionGapReviewCockpit?.paths?.cockpit) {
      executionGapReviewCockpitShortlist = runNodeScript("create-all-software-execution-gap-review-cockpit-shortlist.mjs", [
        "--goal",
        "Select one combined execution-gap cockpit row for low-token teacher review before downstream validation.",
        "--cockpit",
        executionGapReviewCockpit.paths.cockpit,
        "--output-dir",
        join(refreshDir, "execution-gap-review-cockpit-shortlist")
      ]);
    }
  }
}

const directReviewEntryPoints = [
  ...pickEntryLinks(commandCenterPacket),
  ...(sourceCurrentGoalStartHerePacket?.paths?.html || sourceCurrentGoalStartHere
    ? [
        {
          id: "current_goal_start_here",
          label: "Current goal start here",
          path:
            sourceCurrentGoalStartHerePacket?.paths?.html ||
            sourceCurrentGoalStartHerePacket?.paths?.readme ||
            sourceCurrentGoalStartHere ||
            "",
          url: ""
        }
      ]
    : []),
  ...(sourceCurrentGoalRealLocalTrialPackagePacket?.paths?.html || sourceCurrentGoalRealLocalTrialPackage
    ? [
        {
          id: "current_goal_real_local_trial_package",
          label: "Current goal real-local trial package",
          path:
            sourceCurrentGoalRealLocalTrialPackagePacket?.paths?.html ||
            sourceCurrentGoalRealLocalTrialPackagePacket?.paths?.readme ||
            sourceCurrentGoalRealLocalTrialPackage ||
            "",
          url: ""
        }
      ]
    : []),
  {
    id: "rag_teacher_source_intake_queue",
    label: "RAG teacher source intake queue",
    path: ragResearchIntakeQueue.readmePath || ragResearchIntakeQueue.queuePath || "",
    url: ""
  },
  {
    id: "rag_teacher_source_intake_receipt_builder",
    label: "RAG teacher source intake receipt builder",
    path: ragResearchIntakeReceiptBuilder.readmePath || ragResearchIntakeReceiptBuilder.builderPath || "",
    url: ""
  },
  {
    id: "rag_teacher_source_intake_receipt_template",
    label: "RAG teacher source intake receipt template",
    path: ragResearchIntakeReceiptBuilder.templatePath || "",
    url: ""
  },
  ...(executionGapReviewCockpit?.paths?.html || executionGapReviewCockpit?.paths?.cockpit
    ? [
        {
          id: "execution_gap_review_cockpit",
          label: "Execution gap review cockpit",
          path: executionGapReviewCockpit.paths.html || executionGapReviewCockpit.paths.cockpit || "",
          url: ""
        },
        {
          id: "execution_gap_review_cockpit_receipt_template",
          label: "Execution gap review cockpit receipt template",
          path: executionGapReviewCockpit.paths.receiptTemplate || "",
          url: ""
        }
      ]
    : []),
  ...(executionGapReviewCockpitShortlist?.htmlPath || executionGapReviewCockpitShortlist?.shortlistPath
    ? [
        {
          id: "execution_gap_review_cockpit_shortlist",
          label: "Execution gap review cockpit one-row shortlist",
          path: executionGapReviewCockpitShortlist.htmlPath || executionGapReviewCockpitShortlist.shortlistPath || "",
          url: ""
        },
        {
          id: "execution_gap_review_cockpit_shortlist_receipt_template",
          label: "Execution gap review cockpit one-row receipt template",
          path: executionGapReviewCockpitShortlist.receiptTemplatePath || "",
          url: ""
        }
      ]
    : []),
  ...(controlChannelRepairReceiptBuilder?.htmlPath || controlChannelRepairReceiptBuilder?.builderPath
    ? [
        {
          id: "control_channel_repair_receipt_builder",
          label: "Control-channel repair receipt builder",
          path: controlChannelRepairReceiptBuilder.htmlPath || controlChannelRepairReceiptBuilder.builderPath || "",
          url: ""
        },
        {
          id: "control_channel_repair_receipt_template",
          label: "Control-channel repair receipt template",
          path: controlChannelRepairReceiptBuilder.receiptTemplatePath || "",
          url: ""
        }
      ]
    : []),
  ...(actionLogicSourceContractPackage?.htmlPath || actionLogicSourceContractPackage?.packagePath
    ? [
        {
          id: "action_logic_source_contract_package",
          label: "Action logic source contract package",
          path: actionLogicSourceContractPackage.htmlPath || actionLogicSourceContractPackage.packagePath || "",
          url: ""
        },
        {
          id: "action_logic_source_contract_receipt_template",
          label: "Action logic source contract receipt template",
          path: actionLogicSourceContractPackage.receiptTemplatePath || "",
          url: ""
        }
      ]
    : []),
  ...(actionLogicSourceShortlist?.htmlPath || actionLogicSourceShortlist?.shortlistPath
    ? [
        {
          id: "action_logic_source_shortlist",
          label: "Action logic source shortlist",
          path: actionLogicSourceShortlist.htmlPath || actionLogicSourceShortlist.shortlistPath || "",
          url: ""
        },
        {
          id: "action_logic_source_shortlist_receipt_template",
          label: "Action logic source shortlist receipt template",
          path: actionLogicSourceShortlist.receiptTemplatePath || "",
          url: ""
        }
      ]
    : []),
  {
    id: "non_expert_engineering_voice_control_capability",
    label: "Non-expert engineering voice/text control capability",
    path: nonExpertVoiceControlCapabilityHtmlPath,
    url: ""
  },
  ...(sourcePreflightTargetConfirmation
    ? [
        {
          id: "voice_text_numbered_target_confirmation_packet",
          label: "Voice/text numbered target confirmation packet",
          path: sourcePreflightTargetConfirmation,
          url: ""
        }
      ]
    : []),
  {
    id: "knowledge_augmented_spatial_execution_bridge_command",
    label: "Knowledge-augmented low-token evidence to transparent sketch execution bridge command",
    path: knowledgeAugmentedSpatialExecutionBridgeCommandReviewPath,
    url: ""
  },
  {
    id: "original_goal_capability_matrix_coverage_audit",
    label: "Original goal capability matrix coverage audit",
    path: originalGoalCapabilityMatrixCoverageAuditHtmlPath,
    url: ""
  },
  ...(transparentSketchOverlayPath
    ? [
        {
          id: "transparent_sketch_export_to_spatial_target_bridge",
          label: "Teacher-exported transparent sketch packet to spatial target bridge",
          path: transparentSketchOverlayPath,
          url: ""
        },
        {
          id: "transparent_sketch_overlay_packet_validation_command_template",
          label: "Validate teacher-exported transparent sketch overlay packet",
          path: transparentSketchOverlayPacketValidationCommandTemplate,
          url: ""
        },
        {
          id: "transparent_sketch_overlay_packet_validation",
          label: "Transparent sketch overlay packet validation",
          path:
            sourceTransparentSketchOverlayPacketValidationPacket?.paths?.html ||
            sourceTransparentSketchOverlayPacketValidation ||
            "",
          url: ""
        },
        {
          id: "spatial_intent_evidence_request",
          label: "Spatial intent evidence request for teacher-exported sketch packet",
          path: spatialIntentEvidenceRequestHtmlPath,
          url: ""
        },
        {
          id: "spatial_intent_evidence_receipt_builder",
          label: "Spatial intent evidence receipt builder",
          path: spatialIntentEvidenceReceiptBuilder?.htmlPath || "",
          url: ""
        },
        {
          id: "spatial_intent_evidence_receipt_template",
          label: "Spatial intent evidence receipt template",
          path: spatialIntentEvidenceReceiptTemplatePath,
          url: ""
        }
      ]
    : []),
  ...(sourceSpatialIntentFormalEvidenceEntrypoint
    ? [
        {
          id: "spatial_intent_formal_evidence_entrypoint",
          label: "Spatial intent formal evidence entrypoint, not teacher evidence",
          path:
            sourceSpatialIntentFormalEvidenceEntrypoint.replace(
              /spatial-intent-formal-evidence-entrypoint\.json$/,
              "spatial-intent-formal-evidence-entrypoint.html"
            ) || sourceSpatialIntentFormalEvidenceEntrypoint,
          url: ""
        }
      ]
    : []),
  ...(sourceSketchDemonstrationImplementationAudit
    ? [
        {
          id: "transparent_sketch_2d_perspective_3d_implementation_audit",
          label: "Transparent sketch 2D perspective 3D implementation audit",
          path: sourceSketchDemonstrationImplementationAudit,
          url: ""
        }
      ]
    : []),
  {
    id: "transparent_sketch_depth_demonstration_rehearsal",
    label: "Transparent sketch 2D / perspective / 3D depth demonstration rehearsal",
    path:
      transparentSketchDepthDemonstrationRehearsal?.htmlPath ||
      transparentSketchDepthDemonstrationRehearsal?.rehearsalPath ||
      "",
    url: ""
  },
  {
    id: "transparent_sketch_depth_rehearsal_review_receipt_builder",
    label: "Transparent sketch depth rehearsal review receipt builder",
    path:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.html ||
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.builder ||
      "",
    url: ""
  },
  ...(sourceTransparentSketchDepthRehearsalReviewReceiptValidation
    ? [
        {
          id: "transparent_sketch_depth_rehearsal_review_receipt_validation",
          label: "Transparent sketch depth rehearsal review receipt validation",
          path: sourceTransparentSketchDepthRehearsalReviewReceiptValidation,
          url: ""
        }
      ]
    : []),
  {
    id: "transparent_sketch_logic_contract_rule_draft_command_template",
    label: "Transparent sketch logic contract rule draft command template",
    path: transparentSketchLogicContractRuleDraftCommandTemplate || "",
    url: ""
  },
  ...(sourceTransparentSketchLogicContractRuleDraft
    ? [
        {
          id: "transparent_sketch_logic_contract_rule_draft",
          label: "Transparent sketch logic contract rule draft",
          path: sourceTransparentSketchLogicContractRuleDraft,
          url: ""
        }
      ]
    : []),
  {
    id: "teacher_method_execution_learning_contract_command_template",
    label: "Teacher method execution-learning contract command template",
    path: teacherMethodExecutionLearningContractCommandTemplate || "",
    url: ""
  },
  ...(sourceTeacherMethodExecutionLearningContract
    ? [
        {
          id: "teacher_method_execution_learning_contract",
          label: "Teacher method execution-learning contract",
          path: sourceTeacherMethodExecutionLearningContract,
          url: ""
        }
      ]
    : []),
  ...(parametricDrawingLogicKitPath
    ? [
        {
          id: "parametric_feature_data_logic_learning_kit",
          label: "Universal detail logic learning kit",
          path: parametricDrawingLogicKitHtmlPath || parametricDrawingLogicKitPath,
          url: ""
        },
        ...(parametricDrawingLogicReceiptTemplatePath
          ? [
              {
                id: "parametric_feature_data_logic_teacher_receipt_template",
                label: "Universal detail logic teacher receipt template",
                path: parametricDrawingLogicReceiptTemplatePath,
                url: ""
              }
            ]
          : []),
        ...(parametricDrawingLogicRulePackageCommandTemplate
          ? [
              {
                id: "parametric_feature_data_logic_receipt_validation_command",
                label: "Validate teacher-filled universal detail logic receipt",
                path: parametricDrawingLogicReceiptValidationCommandTemplate,
                url: ""
              },
              {
                id: "parametric_feature_data_logic_rule_package_command",
                label: "Compile reviewed universal detail logic into disabled rule package",
                path: parametricDrawingLogicRulePackageCommandTemplate,
                url: ""
              },
              {
                id: "universal_detail_logic_application_dry_run_command",
                label: "Apply reviewed universal detail logic rule package to new data in dry-run",
                path: universalDetailLogicApplicationDryRunCommandTemplate,
                url: ""
              },
              {
                id: "universal_detail_logic_existing_tool_preview_command",
                label: "Create existing-tool preview from reviewed universal detail logic dry-run",
                path: universalDetailLogicExistingToolPreviewCommandTemplate,
                url: ""
              }
            ]
          : [])
      ]
    : []),
  ...(sourceRealLocalReadinessPackage
    ? [
        {
          id: "real_local_all_software_low_token_readiness_package",
          label: "Real-local all-software low-token readiness package",
          path: existsSync(sourceRealLocalReadinessReadme) ? sourceRealLocalReadinessReadme : sourceRealLocalReadinessPackage,
          url: ""
        },
        ...(existsSync(sourceRealLocalReadinessReceipt)
          ? [
              {
                id: "real_local_all_software_low_token_readiness_receipt",
                label: "Real-local all-software low-token readiness receipt",
                path: sourceRealLocalReadinessReceipt,
                url: ""
              }
            ]
          : [])
        ]
      : []),
  ...(sourceOperationalActivationGate
    ? [
        {
          id: "operational_activation_gate",
          label: "All-software operational activation gate",
          path: existsSync(sourceOperationalActivationGateReadme)
            ? sourceOperationalActivationGateReadme
            : sourceOperationalActivationGate,
          url: ""
        }
      ]
    : []),
  ...(sourceOperationalActivationDryRunRehearsal
    ? [
        {
          id: "operational_activation_dry_run_rehearsal",
          label: "All-software operational activation dry-run rehearsal",
          path: existsSync(sourceOperationalActivationDryRunRehearsalReadme)
            ? sourceOperationalActivationDryRunRehearsalReadme
            : sourceOperationalActivationDryRunRehearsal,
          url: ""
        }
      ]
    : []),
  ...(sourceOperationalRegistrationExecuteGate
    ? [
        {
          id: "operational_registration_execute_gate",
          label: "All-software operational registration execute gate",
          path: existsSync(sourceOperationalRegistrationExecuteGateReadme)
            ? sourceOperationalRegistrationExecuteGateReadme
            : sourceOperationalRegistrationExecuteGate,
          url: ""
        }
      ]
    : []),
  ...(sourceOperationalPostActivationWitness
    ? [
        {
          id: "operational_post_activation_witness",
          label: "All-software operational post-activation witness",
          path: existsSync(sourceOperationalPostActivationWitnessReadme)
            ? sourceOperationalPostActivationWitnessReadme
            : sourceOperationalPostActivationWitness,
          url: ""
        },
        {
          id: "operational_post_activation_witness_receipt_builder",
          label: "Operational post-activation witness receipt builder",
          path: operationalPostActivationWitnessReceiptBuilder?.htmlPath || "",
          url: ""
        }
      ]
    : []),
  ...(sourceLogSourceDiscoveryLedger
    ? [
        {
          id: "all_software_log_source_discovery_ledger",
          label: "All-software log source discovery ledger",
          path: existsSync(sourceLogSourceDiscoveryLedgerReadme)
            ? sourceLogSourceDiscoveryLedgerReadme
            : sourceLogSourceDiscoveryLedger,
          url: ""
        }
      ]
    : []),
  ...(sourceCoverageEnrollmentLedger
    ? [
        {
          id: "coverage_enrollment_ledger",
          label: "All-software coverage enrollment ledger",
          path: existsSync(sourceCoverageEnrollmentLedgerReadme)
            ? sourceCoverageEnrollmentLedgerReadme
            : sourceCoverageEnrollmentLedger,
          url: ""
        }
      ]
    : []),
  ...(sourceCoverageEnrollmentFollowUpPlan
    ? [
        {
          id: "coverage_enrollment_follow_up_plan",
          label: "All-software coverage enrollment follow-up plan",
          path: existsSync(sourceCoverageEnrollmentFollowUpPlanReadme)
            ? sourceCoverageEnrollmentFollowUpPlanReadme
            : sourceCoverageEnrollmentFollowUpPlan,
          url: ""
        }
      ]
    : []),
  ...(sourceCoverageEnrollmentFollowUpBatch
    ? [
        {
          id: "coverage_enrollment_follow_up_batch",
          label: "All-software coverage enrollment follow-up dry-run batch",
          path: existsSync(sourceCoverageEnrollmentFollowUpBatchReadme)
            ? sourceCoverageEnrollmentFollowUpBatchReadme
            : sourceCoverageEnrollmentFollowUpBatch,
          url: ""
        }
      ]
    : []),
  ...(sourceCoverageEnrollmentFollowUpReconciliation
    ? [
        {
          id: "coverage_enrollment_follow_up_reconciliation",
          label: "All-software coverage enrollment follow-up reconciliation",
          path: existsSync(sourceCoverageEnrollmentFollowUpReconciliationReadme)
            ? sourceCoverageEnrollmentFollowUpReconciliationReadme
            : sourceCoverageEnrollmentFollowUpReconciliation,
          url: ""
        }
      ]
    : []),
  ...(sourceCoverageEnrollmentFollowUpReceiptBuilder
    ? [
        {
          id: "coverage_enrollment_follow_up_receipt_builder",
          label: "All-software coverage enrollment follow-up receipt builder",
          path: existsSync(sourceCoverageEnrollmentFollowUpReceiptBuilderHtml)
            ? sourceCoverageEnrollmentFollowUpReceiptBuilderHtml
            : sourceCoverageEnrollmentFollowUpReceiptBuilder,
          url: ""
        },
        ...(existsSync(sourceCoverageEnrollmentFollowUpReceiptTemplate)
          ? [
              {
                id: "coverage_enrollment_follow_up_receipt_template",
                label: "All-software coverage enrollment follow-up receipt template",
                path: sourceCoverageEnrollmentFollowUpReceiptTemplate,
                url: ""
              }
            ]
          : [])
      ]
    : []),
  {
    id: "low_token_operation_preflight_policy",
    label: "Low-token operation preflight policy",
    path: lowTokenOperationPreflight.htmlPath || lowTokenOperationPreflight.policyPath || "",
    url: ""
  },
  {
    id: "low_token_trigger_budget_plan",
    label: "Low-token trigger budget plan before screenshots",
    path: lowTokenTriggerBudgetPlan.htmlPath || lowTokenTriggerBudgetPlan.planPath || "",
    url: ""
  },
  {
    id: "event_triggered_low_token_observation_policy",
    label: "Event-triggered low-token observation policy",
    path: eventTriggeredObservationPolicy.htmlPath || eventTriggeredObservationPolicy.policyPath || "",
    url: ""
  },
  {
    id: "event_triggered_low_token_observation_policy_receipt_builder",
    label: "Event-triggered low-token policy receipt builder",
    path: eventTriggeredObservationPolicyReceiptBuilder.htmlPath || eventTriggeredObservationPolicyReceiptBuilder.builderPath || "",
    url: ""
  },
  {
    id: "event_triggered_low_token_observation_policy_receipt_validation",
    label: "Validate teacher-filled event-triggered low-token policy receipt",
    path: eventTriggeredObservationPolicyReceiptValidationCommandTemplate,
    url: ""
  },
  {
    id: "triggered_visual_check_command_builder",
    label: "Triggered visual check command builder",
    path: triggeredVisualCheckCommandBuilder.htmlPath || triggeredVisualCheckCommandBuilder.builderPath || "",
    url: ""
  }
];
const nextActionTriage = buildNextActionTriage({
  refreshId,
  goal,
  gapPacket,
  statusPacket,
  directLinks: directReviewEntryPoints,
  commandCenterPacket,
  actionLogicSourceContractPackagePath: actionLogicSourceContractPackage?.packagePath || "",
  rollbackPoint,
  locks
});
nextActionTriage.triagePath = nextActionTriagePath;
let teacherActionShortlist = buildTeacherActionShortlist(nextActionTriage);
writeFileSync(nextActionTriagePath, `${JSON.stringify(nextActionTriage, null, 2)}\n`, "utf8");
writeFileSync(teacherActionShortlistPath, `${JSON.stringify(teacherActionShortlist, null, 2)}\n`, "utf8");
const teacherActionRouter = runNodeScript("create-original-goal-teacher-action-router.mjs", [
  "--goal",
  goal,
  "--gap-board",
  gapBoard.boardPath,
  "--triage",
  nextActionTriagePath,
  "--budget-plan",
  lowTokenTriggerBudgetPlan.planPath || "",
  "--output-dir",
  join(refreshDir, "teacher-action-router")
]);
const teacherActionRouterPacket =
  teacherActionRouter.routerPath && existsSync(teacherActionRouter.routerPath)
    ? readJson(teacherActionRouter.routerPath)
    : {};
const teacherActionRouterReceiptBuilder = runNodeScript("create-original-goal-teacher-action-router-receipt-builder.mjs", [
  "--goal",
  goal,
  "--router",
  teacherActionRouter.routerPath || "",
  "--output-dir",
  join(refreshDir, "teacher-action-router-receipt-builder")
]);
const teacherActionRouterReceiptBuilderPacket =
  teacherActionRouterReceiptBuilder.builderPath && existsSync(teacherActionRouterReceiptBuilder.builderPath)
    ? readJson(teacherActionRouterReceiptBuilder.builderPath)
    : {};
const teacherActionShortlistRouterReceipt = buildTeacherActionShortlistRouterReceipt({
  shortlist: teacherActionShortlist,
  router: teacherActionRouterPacket,
  receiptBuilder: teacherActionRouterReceiptBuilderPacket,
  templatePath: teacherActionShortlistReceiptTemplatePath,
  validationCommand:
    teacherActionRouterReceiptBuilder.nextValidationCommand ||
    teacherActionRouterReceiptBuilderPacket.nextValidationCommand ||
    commandLine("validate-original-goal-teacher-action-router-receipt.mjs", [
      ["--router", teacherActionRouter.routerPath || "<original-goal-teacher-action-router.json>"],
      ["--receipt", "<teacher-filled-action-router-receipt.json>"]
    ]),
  locks
});
teacherActionShortlist = teacherActionShortlistRouterReceipt.enrichedShortlist;
writeFileSync(teacherActionShortlistPath, `${JSON.stringify(teacherActionShortlist, null, 2)}\n`, "utf8");
writeFileSync(
  teacherActionShortlistReceiptTemplatePath,
  `${JSON.stringify(teacherActionShortlistRouterReceipt.receiptTemplate, null, 2)}\n`,
  "utf8"
);
directReviewEntryPoints.push({
  id: "original_goal_teacher_action_router",
  label: "Original goal teacher action router",
  path: teacherActionRouter.htmlPath || teacherActionRouter.routerPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_teacher_action_router_receipt_builder",
  label: "Original goal teacher action router receipt builder",
  path: teacherActionRouterReceiptBuilder.htmlPath || teacherActionRouterReceiptBuilder.builderPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_teacher_action_router_receipt_template",
  label: "Original goal teacher action router receipt template",
  path: teacherActionRouterReceiptBuilder.receiptTemplatePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_teacher_action_shortlist_router_receipt_template",
  label: "Original goal teacher action shortlist router receipt template",
  path: teacherActionShortlistReceiptTemplatePath,
  url: ""
});
let reviewEntrypointHealthAudit = {
  auditPath: "",
  htmlPath: "",
  readmePath: "",
  status: "not_run_yet",
  checked: 0,
  failedRequired: 0
};
const nextSafeAction =
  nextActionTriage.rows?.length > 0
    ? `Open ${basename(teacherActionRouter.htmlPath || nextActionTriageHtmlPath)} and follow the shortest teacher-action route before any downstream action.`
    : statusPacket.nextSafeActions?.[0]?.command || "Review the refreshed readiness audit and status console.";

const coverageRolloutReceiptBuilderPath =
  commandCenterPacket?.paths?.coverageRolloutReceiptBuilder || sourceCoverageRolloutReceiptBuilder;
const coverageRolloutReceiptBuilderPacket =
  coverageRolloutReceiptBuilderPath && existsSync(coverageRolloutReceiptBuilderPath)
    ? readJson(coverageRolloutReceiptBuilderPath)
    : null;
const coverageRolloutReceiptBuilderHtmlPath =
  commandCenterPacket?.paths?.coverageRolloutReceiptBuilderHtml ||
  coverageRolloutReceiptBuilderPacket?.paths?.html ||
  "";
const coverageRolloutReceiptBuilderReadmePath =
  commandCenterPacket?.paths?.coverageRolloutReceiptBuilderReadme ||
  coverageRolloutReceiptBuilderPacket?.paths?.readme ||
  "";
const executionFollowUpReceiptBuilderPath = commandCenterPacket?.paths?.executionFollowUpReceiptBuilder || "";
const executionFollowUpReceiptBuilderHtmlPath = commandCenterPacket?.paths?.executionFollowUpReceiptBuilderHtml || "";
const executionFollowUpReceiptBuilderReadmePath = commandCenterPacket?.paths?.executionFollowUpReceiptBuilderReadme || "";
const actionLogicSourceContractPackagePath = actionLogicSourceContractPackage?.packagePath || "";
const actionLogicSourceContractPackageHtmlPath = actionLogicSourceContractPackage?.htmlPath || "";
const actionLogicSourceContractPackageReadmePath = actionLogicSourceContractPackage?.readmePath || "";
const actionLogicSourceContractReceiptTemplatePath = actionLogicSourceContractPackage?.receiptTemplatePath || "";
const actionLogicSourceShortlistPath = actionLogicSourceShortlist?.shortlistPath || "";
const actionLogicSourceShortlistHtmlPath = actionLogicSourceShortlist?.htmlPath || "";
const actionLogicSourceShortlistReadmePath = actionLogicSourceShortlist?.readmePath || "";
const actionLogicSourceShortlistReceiptTemplatePath = actionLogicSourceShortlist?.receiptTemplatePath || "";
const controlChannelRepairReceiptBuilderPath = controlChannelRepairReceiptBuilder?.builderPath || "";
const controlChannelRepairReceiptBuilderHtmlPath = controlChannelRepairReceiptBuilder?.htmlPath || "";
const controlChannelRepairReceiptBuilderReadmePath = controlChannelRepairReceiptBuilder?.readmePath || "";
const controlChannelRepairReceiptTemplatePath = controlChannelRepairReceiptBuilder?.receiptTemplatePath || "";
const executionGapReviewCockpitPath = executionGapReviewCockpit?.paths?.cockpit || "";
const executionGapReviewCockpitHtmlPath = executionGapReviewCockpit?.paths?.html || "";
const executionGapReviewCockpitReadmePath = executionGapReviewCockpit?.paths?.readme || "";
const executionGapReviewCockpitReceiptTemplatePath = executionGapReviewCockpit?.paths?.receiptTemplate || "";
const executionGapReviewCockpitShortlistPath = executionGapReviewCockpitShortlist?.shortlistPath || "";
const executionGapReviewCockpitShortlistHtmlPath = executionGapReviewCockpitShortlist?.htmlPath || "";
const executionGapReviewCockpitShortlistReadmePath = executionGapReviewCockpitShortlist?.readmePath || "";
const executionGapReviewCockpitShortlistReceiptTemplatePath =
  executionGapReviewCockpitShortlist?.receiptTemplatePath || "";
const logSourceDiscoveryLedgerRows =
  sourceLogSourceDiscoveryLedgerPacket?.counts?.ledgerRows ||
  (Array.isArray(sourceLogSourceDiscoveryLedgerPacket?.rows) ? sourceLogSourceDiscoveryLedgerPacket.rows.length : 0);
const logSourceDiscoveryMissingRows =
  sourceLogSourceDiscoveryLedgerPacket?.counts?.needsTeacherLogSourceOrExclusion || 0;
const logSourceDiscoveryCandidateRootsNeedBoundedScan =
  sourceLogSourceDiscoveryLedgerPacket?.counts?.candidateRootsNeedBoundedScan || 0;
const allRowsHaveLogSourceRoute = sourceLogSourceDiscoveryLedgerPacket?.allRowsHaveSourceRoute === true;
const allSoftwareLogSourceDiscoveryComplete =
  Boolean(sourceLogSourceDiscoveryLedgerPacket) &&
  allRowsHaveLogSourceRoute &&
  logSourceDiscoveryMissingRows === 0 &&
  logSourceDiscoveryCandidateRootsNeedBoundedScan === 0;

const refresh = {
  ok: true,
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  refreshId,
  createdAt: new Date().toISOString(),
  goal,
  status: "created_review_only_current_status_refresh",
  completionDecision: readinessAudit.completionDecision || "not_complete_full_objective_because_current_refresh_is_not_a_completion_proof",
  summary:
    "One refreshed handoff for the original goal: current readiness audit, operational status console, gap action board, and optional command center are regenerated from current worktree evidence.",
  paths: {
    refresh: refreshPath,
    readme: readmePath,
    currentStatusDashboardHtml: dashboardPath,
    originalGoalReadinessAudit: readiness.auditPath,
    originalGoalReadinessReadme: readiness.readmePath,
    operationalStatusConsole: statusConsole.consolePath,
    operationalStatusReadme: statusConsole.readmePath,
    gapActionBoard: gapBoard.boardPath,
    gapActionBoardHtml: gapBoard.htmlPath,
    gapActionBoardReadme: gapBoard.readmePath,
    currentGoalStartHere: sourceCurrentGoalStartHere,
    currentGoalStartHereHtml: sourceCurrentGoalStartHerePacket?.paths?.html || "",
    currentGoalStartHereReadme: sourceCurrentGoalStartHerePacket?.paths?.readme || "",
    currentGoalRealLocalTrialPackage: sourceCurrentGoalRealLocalTrialPackage,
    currentGoalRealLocalTrialPackageHtml:
      sourceCurrentGoalRealLocalTrialPackagePacket?.paths?.html || "",
    currentGoalRealLocalTrialPackageReadme:
      sourceCurrentGoalRealLocalTrialPackagePacket?.paths?.readme || "",
    teacherReviewCockpit: commandCenterPacket?.paths?.teacherReviewCockpit || "",
    teacherReviewCockpitHtml: commandCenterPacket?.paths?.teacherReviewCockpitHtml || "",
    teacherReviewCockpitReadme: commandCenterPacket?.paths?.teacherReviewCockpitReadme || "",
    teacherReviewCockpitReceiptTemplate: commandCenterPacket?.paths?.teacherReviewCockpitReceiptTemplate || "",
    teacherReviewCockpitReceiptValidationCommandTemplate:
      firstNextCall(commandCenterPacket, "teacherReviewCockpitReceiptValidation")?.command ||
      commandLine("validate-goal-teacher-review-cockpit-receipt.mjs", [
        ["--cockpit", commandCenterPacket?.paths?.teacherReviewCockpit || "<goal-teacher-review-cockpit.json>"],
        ["--receipt", "<teacher-filled-goal-teacher-review-cockpit-receipt.json>"]
      ]),
    teacherReviewCockpitHandoffQueueCommandTemplate: commandLine("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
      ["--validation", "<goal-teacher-review-cockpit-receipt-validation.json>"],
      ["--output-dir", join(refreshDir, "teacher-review-cockpit-handoff-queue")]
    ]),
    nextActionTriage: nextActionTriagePath,
    nextActionTriageHtml: nextActionTriageHtmlPath,
    teacherActionShortlist: teacherActionShortlistPath,
    teacherActionShortlistRouterReceiptTemplate: teacherActionShortlistReceiptTemplatePath,
    teacherActionShortlistRouterReceiptValidationCommandTemplate:
      teacherActionShortlist.routerReceipt?.validationCommand || "",
    teacherActionRouter: teacherActionRouter.routerPath || "",
    teacherActionRouterHtml: teacherActionRouter.htmlPath || "",
    teacherActionRouterReadme: teacherActionRouter.readmePath || "",
    teacherActionRouterReceiptBuilder: teacherActionRouterReceiptBuilder.builderPath || "",
    teacherActionRouterReceiptBuilderHtml: teacherActionRouterReceiptBuilder.htmlPath || "",
    teacherActionRouterReceiptBuilderReadme: teacherActionRouterReceiptBuilder.readmePath || "",
    teacherActionRouterReceiptTemplate: teacherActionRouterReceiptBuilder.receiptTemplatePath || "",
    teacherActionRouterReceiptValidationCommandTemplate:
      teacherActionRouterReceiptBuilder.nextValidationCommand ||
      commandLine("validate-original-goal-teacher-action-router-receipt.mjs", [
        ["--router", teacherActionRouter.routerPath || ""],
        ["--receipt", "<teacher-filled-action-router-receipt.json>"]
      ]),
    teacherActionRouterHandoffQueueCommandTemplate: commandLine("create-original-goal-teacher-action-router-handoff-queue.mjs", [
      ["--validation", "<teacher-action-router-receipt-validation.json>"],
      ["--output-dir", join(refreshDir, "teacher-action-router-handoff-queue")]
    ]),
    controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderPath,
    controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderHtmlPath,
    controlChannelRepairReceiptBuilderReadme: controlChannelRepairReceiptBuilderReadmePath,
    controlChannelRepairReceiptTemplate: controlChannelRepairReceiptTemplatePath,
    executionGapReviewCockpit: executionGapReviewCockpitPath,
    executionGapReviewCockpitHtml: executionGapReviewCockpitHtmlPath,
    executionGapReviewCockpitReadme: executionGapReviewCockpitReadmePath,
    executionGapReviewCockpitReceiptTemplate: executionGapReviewCockpitReceiptTemplatePath,
    executionGapReviewCockpitShortlist: executionGapReviewCockpitShortlistPath,
    executionGapReviewCockpitShortlistHtml: executionGapReviewCockpitShortlistHtmlPath,
    executionGapReviewCockpitShortlistReadme: executionGapReviewCockpitShortlistReadmePath,
    executionGapReviewCockpitShortlistReceiptTemplate: executionGapReviewCockpitShortlistReceiptTemplatePath,
    executionGapReviewCockpitReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-execution-gap-review-cockpit-receipt.mjs",
      [
        ["--cockpit", executionGapReviewCockpitPath || "<all-software-execution-gap-review-cockpit.json>"],
        ["--receipt", "<teacher-filled-execution-gap-review-cockpit-receipt.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-receipt-validation")]
      ]
    ),
    executionGapReviewCockpitHandoffQueueCommandTemplate: commandLine(
      "create-all-software-execution-gap-review-cockpit-handoff-queue.mjs",
      [
        ["--validation", "<all-software-execution-gap-review-cockpit-receipt-validation.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-queue")]
      ]
    ),
    executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate: commandLine(
      "run-original-goal-review-handoff-queue-item.mjs",
      [
        ["--queue", "<all-software-execution-gap-review-cockpit-handoff-queue.json>"],
        ["--item-number", "<teacher-reviewed-item-number>"],
        ["--run-reviewed-handoff", "true"],
        ["--allow-runner", "true"],
        ["--teacher-confirmation", "<teacher-confirmed-execution-gap-handoff-item-text>"],
        ["--rollback-point-created", "true"],
        ["--rollback-point", "<retained-rollback-point-path-or-label>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-item-run")]
      ]
    ),
    executionGapReviewDownstreamValidationSummaryCommandTemplate: commandLine(
      "create-all-software-execution-gap-downstream-validation-summary.mjs",
      [
        ["--control-item-run", "<control-channel-handoff-item-run.json>"],
        ["--action-logic-item-run", "<action-logic-handoff-item-run.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-downstream-validation-summary")]
      ]
    ),
    executionGapReviewMatrixReconciliationPackageCommandTemplate: commandLine(
      "create-all-software-execution-gap-matrix-reconciliation-package.mjs",
      [
        ["--downstream-summary", "<all-software-execution-gap-downstream-validation-summary.json>"],
        ["--matrix", "<current-all-software-execution-capability-matrix.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-package")]
      ]
    ),
    executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate: commandLine(
      "create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs",
      [
        ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-builder")]
      ]
    ),
    executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs",
      [
        ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
        ["--receipt", "<teacher-filled-execution-gap-matrix-reconciliation-receipt.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-validation")]
      ]
    ),
    executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate: commandLine(
      "run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs",
      [
        ["--validation", "<all-software-execution-gap-matrix-reconciliation-receipt-validation.json>"],
        ["--run-reviewed-matrix-generation", "true"],
        ["--allow-runner", "true"],
        ["--teacher-confirmation", "<teacher-confirmed-execution-gap-matrix-reconciliation-runner-text>"],
        ["--rollback-point-created", "true"],
        ["--rollback-point", "<retained-rollback-point-path-or-label>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-reviewed-runner")]
      ]
    ),
    executionConvergence: sourceExecutionConvergence,
    knowledgeAugmentedLowTokenLearningSmokeCommandTemplate: "npm.cmd run smoke:plugin-knowledge-augmented-low-token-learning",
    knowledgeCorpusIngestCommandTemplate,
    knowledgeAugmentedLowTokenLearningCommandTemplate,
    ragResearchIntakeQueue: ragResearchIntakeQueue.queuePath || "",
    ragResearchIntakeQueueReadme: ragResearchIntakeQueue.readmePath || "",
    ragResearchIntakeCorpusIndex: ragResearchIntakeQueue.indexPath || "",
    ragResearchIntakeReceiptBuilder: ragResearchIntakeReceiptBuilder.builderPath || "",
    ragResearchIntakeReceiptBuilderReadme: ragResearchIntakeReceiptBuilder.readmePath || "",
    ragResearchIntakeReceiptTemplate: ragResearchIntakeReceiptBuilder.templatePath || "",
    ragResearchIntakeReceiptValidationCommandTemplate,
    ragConfirmedSourceRegistryCommandTemplate,
    ragConfirmedLocalIngestRunnerCommandTemplate,
    knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate,
    tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate,
    spatialSoftwareExecutionRouteBridge: sourceSpatialSoftwareExecutionRouteBridge,
    originalGoalCapabilityMatrixCoverageAudit: originalGoalCapabilityMatrixCoverageAuditPath,
    originalGoalCapabilityMatrixCoverageAuditHtml: originalGoalCapabilityMatrixCoverageAuditHtmlPath,
    originalGoalCapabilityMatrixCoverageAuditCommandTemplate,
    knowledgeAugmentedSpatialExecutionBridgeSmokeCommandTemplate:
      "npm.cmd run smoke:plugin-knowledge-augmented-spatial-execution-bridge",
    knowledgeAugmentedSpatialExecutionBridgeCommandReview: knowledgeAugmentedSpatialExecutionBridgeCommandReviewPath,
    knowledgeAugmentedSpatialExecutionBridgeCommandTemplate,
    realLocalFullGoalIntegratedCycleSmokeCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\smoke-real-local-full-goal-integrated-cycle.mjs --output-dir artifacts\\real-local-full-goal-integrated-cycle-smoke",
    realLocalFullGoalIntegratedCycleSmokeSummary:
      latestRealLocalFullGoalIntegratedCycleSmokeSummary,
    originalGoalReviewHandoffQueueItemRunnerCommandTemplate: originalGoalReviewHandoffQueueItemRunnerCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptBuilderCommandTemplate:
      originalGoalLowTokenCoverageDossierReceiptBuilderCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate:
      originalGoalLowTokenCoverageDossierReceiptValidationCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptValidation:
      sourceOriginalGoalLowTokenCoverageDossierReceiptValidation || "",
    originalGoalLowTokenCoverageDossierReceiptValidationReadme:
      sourceOriginalGoalLowTokenCoverageDossierReceiptValidation
        ? sourceOriginalGoalLowTokenCoverageDossierReceiptValidation.replace(
            /original-goal-low-token-coverage-dossier-receipt-validation\.json$/,
            "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_DOSSIER_RECEIPT_VALIDATION_START_HERE.md"
          )
        : "",
    originalGoalLowTokenCoverageCompletionGateCommandTemplate:
      originalGoalLowTokenCoverageCompletionGateCommand(refreshDir),
    originalGoalLowTokenCoverageCompletionGate: sourceOriginalGoalLowTokenCoverageCompletionGate || "",
    originalGoalLowTokenCoverageCompletionGateReadme:
      sourceOriginalGoalLowTokenCoverageCompletionGate
        ? sourceOriginalGoalLowTokenCoverageCompletionGate.replace(
            /original-goal-low-token-coverage-completion-gate\.json$/,
            "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_COMPLETION_GATE_START_HERE.md"
          )
        : "",
    originalGoalFinalCompletionGateCommandTemplate:
      originalGoalFinalCompletionGateCommand(
        refreshDir,
        "<original-goal-completion-blocker-matrix.json>",
        sourceRuleDslDeliveryGateAudit || "<rag-delivery-gate-audit-trail.json>"
      ),
    ruleDslDeliveryGateAudit: sourceRuleDslDeliveryGateAudit,
    ruleDslDeliveryGateAuditReviewReceiptBuilder: sourceRuleDslDeliveryGateAuditReviewReceiptBuilder,
    ruleDslDeliveryGateAuditReviewReceiptBuilderHtml:
      sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath || "",
    ruleDslDeliveryGateAuditReviewReceiptTemplate:
      sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath || "",
    ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate:
      sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand || "",
    ruleDslDeliveryGateAuditReviewReceiptValidation:
      sourceRuleDslDeliveryGateAuditReviewReceiptValidation,
    reviewEntrypointHealthAudit: reviewEntrypointHealthAudit.auditPath || "",
    reviewEntrypointHealthAuditHtml: reviewEntrypointHealthAudit.htmlPath || "",
    reviewEntrypointHealthAuditReadme: reviewEntrypointHealthAudit.readmePath || "",
    nonExpertEngineeringVoiceControlCapability: nonExpertVoiceControlCapabilityPath,
    nonExpertEngineeringVoiceControlCapabilityHtml: nonExpertVoiceControlCapabilityHtmlPath,
    transparentSketchOverlayPacketValidationCommandTemplate,
    transparentSketchOverlayPacketValidation: sourceTransparentSketchOverlayPacketValidation,
    transparentSketchOverlayPacketValidationHtml:
      sourceTransparentSketchOverlayPacketValidationPacket?.paths?.html || "",
    transparentSketchOverlayPacketValidationReadme:
      sourceTransparentSketchOverlayPacketValidationPacket?.paths?.readme || "",
    transparentSketchOverlayPacketValidationStatus:
      sourceTransparentSketchOverlayPacketValidationPacket?.status || "",
    spatialIntentEvidenceRequest: spatialIntentEvidenceRequestPath,
    spatialIntentEvidenceRequestHtml: spatialIntentEvidenceRequestHtmlPath,
    spatialIntentEvidenceReceiptBuilder: spatialIntentEvidenceReceiptBuilder?.builderPath || "",
    spatialIntentEvidenceReceiptBuilderHtml: spatialIntentEvidenceReceiptBuilder?.htmlPath || "",
    spatialIntentEvidenceReceiptBuilderReadme: spatialIntentEvidenceReceiptBuilder?.readmePath || "",
    spatialIntentEvidenceReceiptTemplate: spatialIntentEvidenceReceiptTemplatePath,
    spatialIntentEvidenceReceiptValidationCommandTemplate,
    spatialIntentEvidenceReceiptValidation: sourceSpatialIntentEvidenceReceiptValidation,
    spatialIntentEvidenceReceiptValidationStatus:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.status || "",
    spatialIntentEvidenceReceiptValidationDecision:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationDecision || "",
    spatialIntentEvidenceReceiptValidationNextReviewCommand:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.nextReviewCommand?.commandLine || "",
    triggeredVisualTransparentOverlayHandoff: sourceTriggeredVisualTransparentOverlayHandoff || "",
    triggeredVisualTransparentOverlayHandoffHtml: sourceTriggeredVisualTransparentOverlayHandoff
      ? sourceTriggeredVisualTransparentOverlayHandoff.replace(
          /triggered-visual-transparent-overlay-handoff\.json$/,
          "triggered-visual-transparent-overlay-handoff.html"
        )
      : "",
    spatialIntentFormalEvidenceEntrypoint: sourceSpatialIntentFormalEvidenceEntrypoint || "",
    spatialIntentFormalEvidenceEntrypointHtml: sourceSpatialIntentFormalEvidenceEntrypoint
      ? sourceSpatialIntentFormalEvidenceEntrypoint.replace(
          /spatial-intent-formal-evidence-entrypoint\.json$/,
          "spatial-intent-formal-evidence-entrypoint.html"
        )
      : "",
    spatialIntentFormalEvidenceEntrypointCommandTemplate,
    spatialRoutePilotSelectionReceiptCommandTemplate,
    spatialRoutePilotSelectionReceiptValidationCommandTemplate,
    spatialToSoftwareExecutionGatePackage: sourceSpatialToSoftwareExecutionGatePackage || "",
    spatialToSoftwareExecutionGatePackageHtml: sourceSpatialToSoftwareExecutionGatePackage
      ? sourceSpatialToSoftwareExecutionGatePackage.replace(
          /spatial-to-software-execution-gate-package\.json$/,
          "spatial-to-software-execution-gate-package.html"
        )
      : "",
    sketchDemonstrationImplementationAudit: sourceSketchDemonstrationImplementationAudit,
    transparentSketchDepthDemonstrationRehearsal: transparentSketchDepthDemonstrationRehearsal?.rehearsalPath || "",
    transparentSketchDepthDemonstrationRehearsalHtml: transparentSketchDepthDemonstrationRehearsal?.htmlPath || "",
    transparentSketchDepthDemonstrationRehearsalReadme: transparentSketchDepthDemonstrationRehearsal?.readmePath || "",
    transparentSketchDepthRehearsalReviewReceiptBuilderCommandTemplate,
    transparentSketchDepthRehearsalReviewReceiptBuilder:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.builder || "",
    transparentSketchDepthRehearsalReviewReceiptBuilderHtml:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.html || "",
    transparentSketchDepthRehearsalReviewReceiptBuilderReadme:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.readme || "",
    transparentSketchDepthRehearsalReviewReceiptTemplate:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.receiptTemplate || "",
    transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate,
    transparentSketchDepthRehearsalReviewReceiptValidation:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidation,
    parametricDrawingLogicLearningKit: parametricDrawingLogicKitPath,
    parametricDrawingLogicLearningKitHtml: parametricDrawingLogicKitHtmlPath,
    parametricDrawingLogicLearningKitReadme: parametricDrawingLogicKitReadmePath,
    parametricDrawingLogicTeacherReceiptTemplate: parametricDrawingLogicReceiptTemplatePath,
    parametricDrawingLogicReceiptValidationCommandTemplate,
    parametricDrawingLogicRulePackageCommandTemplate,
    universalDetailLogicApplicationDryRunCommandTemplate,
    universalDetailLogicExistingToolPreviewCommandTemplate,
    logSourceDiscoveryLedger: sourceLogSourceDiscoveryLedger,
    logSourceDiscoveryLedgerReadme: existsSync(sourceLogSourceDiscoveryLedgerReadme) ? sourceLogSourceDiscoveryLedgerReadme : "",
    logSourceDiscoveryLedgerCommandTemplate: commandLine("create-all-software-log-source-discovery-ledger.mjs", [
      ["--inventory", "<software-observer-inventory.json>"],
      ["--queue", "<software-observer-queue.json>"],
      ["--output-dir", join(refreshDir, "log-source-discovery-ledger")]
    ]),
    coverageRolloutReceiptBuilder: coverageRolloutReceiptBuilderPath,
    coverageRolloutReceiptBuilderHtml: coverageRolloutReceiptBuilderHtmlPath,
    coverageRolloutReceiptBuilderReadme: coverageRolloutReceiptBuilderReadmePath,
    coverageRolloutReceiptBuilderDiscoveredBeforeRefresh: sourceCoverageRolloutReceiptBuilder,
    coverageEnrollmentFollowUpReceiptBuilder: sourceCoverageEnrollmentFollowUpReceiptBuilder,
    coverageEnrollmentFollowUpReceiptBuilderHtml: existsSync(sourceCoverageEnrollmentFollowUpReceiptBuilderHtml)
      ? sourceCoverageEnrollmentFollowUpReceiptBuilderHtml
      : "",
    coverageEnrollmentFollowUpReceiptTemplate: existsSync(sourceCoverageEnrollmentFollowUpReceiptTemplate)
      ? sourceCoverageEnrollmentFollowUpReceiptTemplate
      : "",
    originalGoalReviewHandoffQueueItemRunnerCommandTemplate: originalGoalReviewHandoffQueueItemRunnerCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptBuilderCommandTemplate:
      originalGoalLowTokenCoverageDossierReceiptBuilderCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate:
      originalGoalLowTokenCoverageDossierReceiptValidationCommand(refreshDir),
    originalGoalLowTokenCoverageCompletionGateCommandTemplate:
      originalGoalLowTokenCoverageCompletionGateCommand(refreshDir),
    coverageRolloutHandoffQueueCommandTemplate: coverageRolloutHandoffQueueCommand(refreshDir),
    coverageRolloutHandoffQueueItemRunnerCommandTemplate: coverageRolloutHandoffQueueItemRunnerCommand(refreshDir),
    coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate:
      coverageRolloutHandoffItemRunReviewReceiptBuilderCommand(refreshDir),
    coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate:
      coverageRolloutHandoffItemRunReviewReceiptValidationCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffQueueCommandTemplate: coverageEnrollmentFollowUpHandoffQueueCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate:
      coverageEnrollmentFollowUpHandoffItemCommandBuilderCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandTemplate:
      coverageEnrollmentFollowUpHandoffQueueItemRunnerCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate:
      coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate:
      coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate:
      coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate:
      coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommand(refreshDir),
    executionFollowUpReceiptBuilder: executionFollowUpReceiptBuilderPath,
    executionFollowUpReceiptBuilderHtml: executionFollowUpReceiptBuilderHtmlPath,
    executionFollowUpReceiptBuilderReadme: executionFollowUpReceiptBuilderReadmePath,
    actionLogicSourceContractPackage: actionLogicSourceContractPackagePath,
    actionLogicSourceContractPackageHtml: actionLogicSourceContractPackageHtmlPath,
    actionLogicSourceContractPackageReadme: actionLogicSourceContractPackageReadmePath,
    actionLogicSourceContractReceiptTemplate: actionLogicSourceContractReceiptTemplatePath,
    actionLogicSourceShortlist: actionLogicSourceShortlistPath,
    actionLogicSourceShortlistHtml: actionLogicSourceShortlistHtmlPath,
    actionLogicSourceShortlistReadme: actionLogicSourceShortlistReadmePath,
    actionLogicSourceShortlistReceiptTemplate: actionLogicSourceShortlistReceiptTemplatePath,
    controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderPath,
    controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderHtmlPath,
    controlChannelRepairReceiptBuilderReadme: controlChannelRepairReceiptBuilderReadmePath,
    controlChannelRepairReceiptTemplate: controlChannelRepairReceiptTemplatePath,
    executionGapReviewCockpit: executionGapReviewCockpitPath,
    executionGapReviewCockpitHtml: executionGapReviewCockpitHtmlPath,
    executionGapReviewCockpitReadme: executionGapReviewCockpitReadmePath,
    executionGapReviewCockpitReceiptTemplate: executionGapReviewCockpitReceiptTemplatePath,
    executionGapReviewCockpitReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-execution-gap-review-cockpit-receipt.mjs",
      [
        ["--cockpit", executionGapReviewCockpitPath || "<all-software-execution-gap-review-cockpit.json>"],
        ["--receipt", "<teacher-filled-execution-gap-review-cockpit-receipt.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-receipt-validation")]
      ]
    ),
    executionGapReviewCockpitHandoffQueueCommandTemplate: commandLine(
      "create-all-software-execution-gap-review-cockpit-handoff-queue.mjs",
      [
        ["--validation", "<all-software-execution-gap-review-cockpit-receipt-validation.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-queue")]
      ]
    ),
    executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate: commandLine(
      "run-original-goal-review-handoff-queue-item.mjs",
      [
        ["--queue", "<all-software-execution-gap-review-cockpit-handoff-queue.json>"],
        ["--item-number", "<teacher-reviewed-item-number>"],
        ["--run-reviewed-handoff", "true"],
        ["--allow-runner", "true"],
        ["--teacher-confirmation", "<teacher-confirmed-execution-gap-handoff-item-text>"],
        ["--rollback-point-created", "true"],
        ["--rollback-point", "<retained-rollback-point-path-or-label>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-item-run")]
      ]
    ),
    executionGapReviewDownstreamValidationSummaryCommandTemplate: commandLine(
      "create-all-software-execution-gap-downstream-validation-summary.mjs",
      [
        ["--control-item-run", "<control-channel-handoff-item-run.json>"],
        ["--action-logic-item-run", "<action-logic-handoff-item-run.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-downstream-validation-summary")]
      ]
    ),
    executionGapReviewMatrixReconciliationPackageCommandTemplate: commandLine(
      "create-all-software-execution-gap-matrix-reconciliation-package.mjs",
      [
        ["--downstream-summary", "<all-software-execution-gap-downstream-validation-summary.json>"],
        ["--matrix", "<current-all-software-execution-capability-matrix.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-package")]
      ]
    ),
    executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate: commandLine(
      "create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs",
      [
        ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-builder")]
      ]
    ),
    executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs",
      [
        ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
        ["--receipt", "<teacher-filled-execution-gap-matrix-reconciliation-receipt.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-validation")]
      ]
    ),
    executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate: commandLine(
      "run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs",
      [
        ["--validation", "<all-software-execution-gap-matrix-reconciliation-receipt-validation.json>"],
        ["--run-reviewed-matrix-generation", "true"],
        ["--allow-runner", "true"],
        ["--teacher-confirmation", "<teacher-confirmed-execution-gap-matrix-reconciliation-runner-text>"],
        ["--rollback-point-created", "true"],
        ["--rollback-point", "<retained-rollback-point-path-or-label>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-reviewed-runner")]
      ]
    ),
    executionFollowUpHandoffQueueCommandTemplate: executionFollowUpHandoffQueueCommand(refreshDir),
    executionFollowUpHandoffItemCommandBuilderCommandTemplate:
      executionFollowUpHandoffItemCommandBuilderCommand(refreshDir),
    executionFollowUpHandoffQueueItemRunnerCommandTemplate: executionFollowUpHandoffQueueItemRunnerCommand(refreshDir),
    executionFollowUpHandoffItemReceiptBuilderCommandTemplate: executionFollowUpHandoffItemReceiptBuilderCommand(refreshDir),
    executionFollowUpHandoffItemReceiptValidationCommandTemplate: executionFollowUpHandoffItemReceiptValidationCommand(refreshDir),
    executionApprovalGatePrepRunnerCommandTemplate: executionApprovalGatePrepRunnerCommand(refreshDir),
    executionApprovedGateCommandBuilderCommandTemplate: executionApprovedGateCommandBuilderCommand(refreshDir),
    executionApprovedGateRunnerCommandTemplate: executionApprovedGateRunnerCommand(refreshDir),
    operationalRegistrationApprovedCommandBuilderCommandTemplate:
      operationalRegistrationApprovedCommandBuilderCommand(refreshDir),
    operationalRegistrationApprovedRunnerCommandTemplate: operationalRegistrationApprovedRunnerCommand(refreshDir),
    operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate:
      operationalPostRegistrationOutputWitnessCommandBuilderCommand(refreshDir),
    operationalPostRegistrationOutputWitnessRunnerCommandTemplate: operationalPostRegistrationOutputWitnessRunnerCommand(refreshDir),
    operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate:
      operationalPostRegistrationOutputWitnessReceiptBuilderCommand(refreshDir),
    operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate:
      operationalPostRegistrationOutputWitnessReceiptValidationCommand(refreshDir),
    allSoftwareUnattendedLearningAudit: allSoftwareUnattendedLearningAudit.auditPath || "",
    allSoftwareUnattendedLearningAuditReadme: allSoftwareUnattendedLearningAudit.readmePath || "",
    allSoftwareUnattendedLearningAuditReceipt: allSoftwareUnattendedLearningAudit.receiptPath || "",
    allSoftwareUnattendedLearningAuditCommandTemplate: commandLine("create-all-software-unattended-learning-audit.mjs", [
      ["--schedule", sourceAutomaticLowTokenLearningSchedule || "<automatic-low-token-learning-schedule.json>"],
      ["--approval-gate", sourceRecurringMonitorApprovalGate || "<all-software-recurring-monitor-approval-gate.json>"],
      ["--registration-runner", sourceRecurringMonitorRegistrationRunner || "<recurring-monitor-registration-runner.json>"],
      ["--registration-status", sourceRecurringMonitorRegistrationStatus || "<recurring-monitor-registration-status.json>"],
      ["--run-output-audit", sourceRecurringMonitorRunOutputAudit || "<recurring-monitor-run-output-audit.json>"],
      ["--teacher-review-packet", sourceRecurringMonitorTeacherReviewPacket || "<recurring-monitor-teacher-review-packet.json>"],
      [
        "--review-decision-replay-queue",
        sourceRecurringMonitorReviewDecisionReplayQueue || "<recurring-monitor-review-decision-replay-queue.json>"
      ],
      ["--output-dir", join(refreshDir, "all-software-unattended-learning-audit")]
    ]),
    recurringMonitorTeacherConfirmationPackage: recurringMonitorTeacherConfirmationPackage.packagePath || "",
    recurringMonitorTeacherConfirmationPackageReadme: recurringMonitorTeacherConfirmationPackage.readmePath || "",
    recurringMonitorTeacherConfirmationPackageHtml: recurringMonitorTeacherConfirmationPackage.htmlPath || "",
    recurringMonitorTeacherConfirmationReceiptTemplate:
      recurringMonitorTeacherConfirmationPackage.receiptTemplatePath || "",
    recurringMonitorTeacherConfirmationPackageCommandTemplate: commandLine(
      "create-all-software-recurring-monitor-teacher-confirmation-package.mjs",
      [
        ["--goal", goal],
        ["--schedule", sourceAutomaticLowTokenLearningSchedule || "<automatic-low-token-learning-schedule.json>"],
        ["--approval-gate", sourceRecurringMonitorApprovalGate || "<all-software-recurring-monitor-approval-gate.json>"],
        ["--unattended-audit", allSoftwareUnattendedLearningAudit.auditPath || "<all-software-unattended-learning-audit.json>"],
        ["--output-dir", join(refreshDir, "recurring-monitor-teacher-confirmation-package")]
      ]
    ),
    recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-recurring-monitor-teacher-confirmation-receipt.mjs",
      [
        ["--confirmation-package", recurringMonitorTeacherConfirmationPackage.packagePath || "<recurring-monitor-teacher-confirmation-package.json>"],
        ["--receipt", "<teacher-filled-recurring-monitor-teacher-confirmation-receipt.json>"],
        ["--output-dir", join(refreshDir, "recurring-monitor-teacher-confirmation-receipt-validation")]
      ]
    ),
    recurringMonitorTeacherConfirmationReceiptValidation: sourceRecurringMonitorTeacherConfirmationReceiptValidation,
    recurringMonitorTeacherConfirmationReceiptValidationReadme: sourceRecurringMonitorTeacherConfirmationReceiptValidation
      ? sourceRecurringMonitorTeacherConfirmationReceiptValidation.replace(
          "recurring-monitor-teacher-confirmation-receipt-validation.json",
          "RECURRING_MONITOR_TEACHER_CONFIRMATION_RECEIPT_VALIDATION_START_HERE.md"
        )
      : "",
    recurringMonitorRegistrationRunnerDryRunCommandTemplate: recurringMonitorRegistrationRunnerDryRunCommand(refreshDir),
    recurringMonitorRegistrationStatusVerifierCommandTemplate: recurringMonitorRegistrationStatusVerifierCommand(refreshDir),
    coverageEnrollmentLedger: sourceCoverageEnrollmentLedger,
    coverageEnrollmentLedgerReadme: existsSync(sourceCoverageEnrollmentLedgerReadme) ? sourceCoverageEnrollmentLedgerReadme : "",
    coverageEnrollmentLedgerRealignPreview:
      generatedLogSourceAlignedCoverageEnrollmentLedger?.ledgerPath || "",
    coverageEnrollmentLedgerRealignPreviewReadme:
      generatedLogSourceAlignedCoverageEnrollmentLedger?.teacherReadme || "",
    coverageEnrollmentFollowUpPlan: sourceCoverageEnrollmentFollowUpPlan,
    coverageEnrollmentFollowUpPlanReadme: existsSync(sourceCoverageEnrollmentFollowUpPlanReadme)
      ? sourceCoverageEnrollmentFollowUpPlanReadme
      : "",
    coverageEnrollmentFollowUpBatch: sourceCoverageEnrollmentFollowUpBatch,
    coverageEnrollmentFollowUpBatchReadme: existsSync(sourceCoverageEnrollmentFollowUpBatchReadme)
      ? sourceCoverageEnrollmentFollowUpBatchReadme
      : "",
    coverageEnrollmentFollowUpBatchAutoPreviewed,
    coverageEnrollmentFollowUpBatchPreviewRefreshReason,
    coverageEnrollmentFollowUpReconciliation: sourceCoverageEnrollmentFollowUpReconciliation,
    coverageEnrollmentFollowUpReconciliationReadme: existsSync(sourceCoverageEnrollmentFollowUpReconciliationReadme)
      ? sourceCoverageEnrollmentFollowUpReconciliationReadme
      : "",
    realLocalAllSoftwareLowTokenReadinessPackage: sourceRealLocalReadinessPackage,
    realLocalAllSoftwareLowTokenReadinessReadme: existsSync(sourceRealLocalReadinessReadme) ? sourceRealLocalReadinessReadme : "",
    realLocalAllSoftwareLowTokenReadinessReceipt: existsSync(sourceRealLocalReadinessReceipt) ? sourceRealLocalReadinessReceipt : "",
    operationalActivationGate: sourceOperationalActivationGate,
    operationalActivationGateReadme: existsSync(sourceOperationalActivationGateReadme) ? sourceOperationalActivationGateReadme : "",
    operationalActivationDryRunRehearsal: sourceOperationalActivationDryRunRehearsal,
    operationalActivationDryRunRehearsalReadme: existsSync(sourceOperationalActivationDryRunRehearsalReadme)
      ? sourceOperationalActivationDryRunRehearsalReadme
      : "",
    operationalRegistrationExecuteGate: sourceOperationalRegistrationExecuteGate,
    operationalRegistrationExecuteGateReadme: existsSync(sourceOperationalRegistrationExecuteGateReadme)
      ? sourceOperationalRegistrationExecuteGateReadme
      : "",
    operationalPostActivationWitness: sourceOperationalPostActivationWitness,
    operationalPostActivationWitnessReadme: existsSync(sourceOperationalPostActivationWitnessReadme)
      ? sourceOperationalPostActivationWitnessReadme
      : "",
    operationalPostActivationWitnessReceiptBuilder:
      operationalPostActivationWitnessReceiptBuilder?.builderPath || "",
    operationalPostActivationWitnessReceiptBuilderHtml:
      operationalPostActivationWitnessReceiptBuilder?.htmlPath || "",
    operationalPostActivationWitnessReceiptBuilderReadme:
      operationalPostActivationWitnessReceiptBuilder?.readmePath || "",
    operationalPostActivationWitnessReceiptTemplate:
      operationalPostActivationWitnessReceiptBuilder?.receiptTemplatePath || "",
    operationalPostActivationWitnessReceiptValidationCommandTemplate,
    rollbackPointManifest: rollbackPoint.manifestPath,
    rollbackPointDir: rollbackPoint.rollbackDir,
    lowTokenOperationPreflightPolicy: lowTokenOperationPreflight.policyPath || "",
    lowTokenOperationPreflightPolicyHtml: lowTokenOperationPreflight.htmlPath || "",
    lowTokenOperationPreflightPolicyReadme: lowTokenOperationPreflight.readmePath || "",
    lowTokenTriggerBudgetPlan: lowTokenTriggerBudgetPlan.planPath || "",
    lowTokenTriggerBudgetPlanHtml: lowTokenTriggerBudgetPlan.htmlPath || "",
    lowTokenTriggerBudgetPlanReadme: lowTokenTriggerBudgetPlan.readmePath || "",
    lowTokenTriggerBudgetPlanCommandTemplate,
    eventTriggeredObservationPolicy: eventTriggeredObservationPolicy.policyPath || "",
    eventTriggeredObservationPolicyHtml: eventTriggeredObservationPolicy.htmlPath || "",
    eventTriggeredObservationPolicyReadme: eventTriggeredObservationPolicy.readmePath || "",
    eventTriggeredObservationPolicyReceiptBuilder: eventTriggeredObservationPolicyReceiptBuilder.builderPath || "",
    eventTriggeredObservationPolicyReceiptBuilderHtml: eventTriggeredObservationPolicyReceiptBuilder.htmlPath || "",
    eventTriggeredObservationPolicyReceiptBuilderReadme: eventTriggeredObservationPolicyReceiptBuilder.readmePath || "",
    eventTriggeredObservationPolicyReceiptTemplate:
      eventTriggeredObservationPolicyReceiptBuilder.receiptTemplatePath || eventTriggeredObservationPolicy.receiptTemplatePath || "",
    eventTriggeredObservationPolicyReceiptBuilderCommandTemplate,
    eventTriggeredObservationPolicyCommandTemplate,
    eventTriggeredObservationPolicyReceiptValidationCommandTemplate,
    triggeredVisualCheckCommandBuilder: triggeredVisualCheckCommandBuilder.builderPath || "",
    triggeredVisualCheckCommandBuilderHtml: triggeredVisualCheckCommandBuilder.htmlPath || "",
    triggeredVisualCheckCommandBuilderReadme: triggeredVisualCheckCommandBuilder.readmePath || "",
    triggeredVisualCheckCommandBuilderCommandTemplate,
    triggeredVisualCaptureCommandTemplate,
    triggeredVisualLearningHandoffCommandTemplate,
    triggeredVisualLearningHandoffReviewCommandTemplate,
    triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate,
    triggeredVisualVoiceControlWorkbenchCommandTemplate,
    transparentSketchDepthDemonstrationRehearsalCommandTemplate,
    goalCommandCenter: commandCenter?.centerPath || "",
    goalCommandCenterHtml: commandCenter?.htmlPath || "",
    goalCommandCenterReadme: commandCenter?.readmePath || ""
  },
  refreshedEvidence: {
    readinessStatus: readinessAudit.status || "",
    readinessCompletionDecision: readinessAudit.completionDecision || "",
    statusConsoleStatus: statusPacket.status || "",
    statusConsoleCompletionDecision: statusPacket.completionBoundary?.status || statusPacket.completionBoundary?.goalComplete || "",
    statusLaneCount: statusLanes.length,
    blockedOrWaitingLaneCount: blockedLanes.length,
    statusLanes: statusLanes.map((lane) => ({
      id: lane.id || "",
      status: lane.status || "",
      detail: lane.detail || ""
    })),
    gapActionRows: gapPacket.actionRows?.length || 0,
    currentGoalStartHereStatus: sourceCurrentGoalStartHerePacket?.status || "",
    currentGoalStartHereEntryLinks:
      Array.isArray(sourceCurrentGoalStartHerePacket?.entryLinks)
        ? sourceCurrentGoalStartHerePacket.entryLinks.length
        : 0,
    currentGoalStartHereGoalComplete: sourceCurrentGoalStartHerePacket?.goalComplete === true,
    currentGoalRealLocalTrialPackageStatus:
      sourceCurrentGoalRealLocalTrialPackagePacket?.status || "",
    currentGoalRealLocalTrialPackageChecksPassed:
      sourceCurrentGoalRealLocalTrialPackagePacket?.checkSummary?.passed ?? 0,
    currentGoalRealLocalTrialPackageChecksTotal:
      sourceCurrentGoalRealLocalTrialPackagePacket?.checkSummary?.total ?? 0,
    currentGoalRealLocalTrialPackageSampleSoftware:
      sourceCurrentGoalRealLocalTrialPackagePacket?.realLocalSoftware?.software || "",
    currentGoalRealLocalTrialPackageGoalComplete:
      sourceCurrentGoalRealLocalTrialPackagePacket?.goalComplete === true,
    nextActionTriageRows: nextActionTriage.rows?.length || 0,
    teacherActionShortlistStatus: teacherActionShortlist.status || "",
    teacherActionShortlistActions: teacherActionShortlist.actions?.length || 0,
    teacherActionShortlistFirstReviewEntry: teacherActionShortlist.actions?.[0]?.reviewEntryId || "",
    teacherActionShortlistReviewOnly:
      teacherActionShortlist.blockedActions?.includes("execute_shortlist_command_automatically") &&
      teacherActionShortlist.blockedActions?.includes("register_scheduled_task_from_shortlist") &&
      teacherActionShortlist.locks?.goalComplete === false,
    teacherActionShortlistRouterReceiptStatus: teacherActionShortlist.routerReceipt?.status || "",
    teacherActionShortlistRouterReceiptMappedActions: teacherActionShortlist.routerReceipt?.mappedActions || 0,
    teacherActionShortlistRouterReceiptUnmappedActions: teacherActionShortlist.routerReceipt?.unmappedActions || 0,
    teacherActionShortlistRouterReceiptReady:
      teacherActionShortlist.routerReceipt?.status === "ready_for_teacher_to_fill_shortlist_router_receipt" &&
      existsSync(teacherActionShortlistReceiptTemplatePath) &&
      Boolean(teacherActionShortlist.routerReceipt?.validationCommand) &&
      teacherActionShortlist.locks?.goalComplete === false,
    teacherActionRouterStatus: teacherActionRouter.status || "",
    teacherActionRouterRouteRowCount: teacherActionRouter.routeRowCount || 0,
    teacherActionRouterReceiptBuilderStatus: teacherActionRouterReceiptBuilder.status || "",
    teacherActionRouterReceiptBuilderRowCount: teacherActionRouterReceiptBuilder.reviewRows || 0,
    teacherActionRouterReceiptBuilderReviewOnly:
      teacherActionRouterReceiptBuilder?.locks?.reviewOnly === true &&
      teacherActionRouterReceiptBuilder?.locks?.builderDoesNotRunCommands === true &&
      teacherActionRouterReceiptBuilder?.locks?.goalComplete === false,
    reviewEntrypointHealthAuditStatus: reviewEntrypointHealthAudit.status || "",
    reviewEntrypointHealthAuditChecked: reviewEntrypointHealthAudit.checked || 0,
    reviewEntrypointHealthAuditFailedRequired: reviewEntrypointHealthAudit.failedRequired || 0,
    lowTokenOperationPreflightStatus: lowTokenOperationPreflight.status || "",
    lowTokenOperationPreflightBlockerCount: lowTokenOperationPreflight.blockerCount || 0,
    lowTokenTriggerBudgetPlanStatus: lowTokenTriggerBudgetPlan.status || "",
    lowTokenTriggerBudgetPlanSelectedActionCount: lowTokenTriggerBudgetPlan.selectedActionCount || 0,
    lowTokenTriggerBudgetPlanSelectedEstimatedTokenCost: lowTokenTriggerBudgetPlan.selectedEstimatedTokenCost || 0,
    knowledgeAugmentedLowTokenLearningStatus:
      "available_review_only_rag_evidence_layer_for_compact_low_token_events",
    knowledgeAugmentedLowTokenLearningSmokeCommandReady: true,
    knowledgeCorpusIngestCommandReady:
      knowledgeCorpusIngestCommandTemplate.includes("knowledge\\ingest-local-corpus.mjs") &&
      knowledgeCorpusIngestCommandTemplate.includes("<teacher-approved-manuals-standards-docs-folder-or-file>") &&
      knowledgeCorpusIngestCommandTemplate.includes("teacher_approved_domain_source"),
    knowledgeAugmentedLowTokenLearningCommandReady:
      knowledgeAugmentedLowTokenLearningCommandTemplate.includes(
        "knowledge\\augment-low-token-learning-with-retrieval.mjs"
      ) &&
      knowledgeAugmentedLowTokenLearningCommandTemplate.includes("--corpus-index") &&
      knowledgeAugmentedLowTokenLearningCommandTemplate.includes("--learning-cycle"),
    knowledgeAugmentedLowTokenLearningUsesRealLearningCyclePlaceholder:
      !sourcePreflightLearningCycle &&
      knowledgeAugmentedLowTokenLearningCommandTemplate.includes("<all-software-low-token-learning-cycle.json>"),
    knowledgeAugmentedLowTokenLearningHasRealLearningCycleInput: Boolean(sourcePreflightLearningCycle),
    knowledgeAugmentedLowTokenLearningRejectsSmokeAsFinalGoalEvidence: true,
    ragResearchIntakeQueueReady:
      ragResearchIntakeQueuePacket.format === "transparent_ai_rag_research_intake_queue_v1" &&
      Boolean(ragResearchIntakeQueue.queuePath) &&
      Boolean(ragResearchIntakeQueue.readmePath) &&
      Boolean(ragResearchIntakeQueue.indexPath),
    ragResearchIntakeReceiptBuilderReady:
      ragResearchIntakeReceiptBuilder.format === "transparent_ai_rag_research_intake_receipt_builder_v1" &&
      Boolean(ragResearchIntakeReceiptBuilder.builderPath) &&
      Boolean(ragResearchIntakeReceiptBuilder.templatePath),
    ragResearchIntakeReceiptValidationCommandReady:
      ragResearchIntakeReceiptValidationCommandTemplate.includes("knowledge\\validate-rag-research-intake-receipt.mjs") &&
      ragResearchIntakeReceiptValidationCommandTemplate.includes("<teacher-filled-rag-research-intake-receipt.json>"),
    ragConfirmedSourceRegistryCommandReady:
      ragConfirmedSourceRegistryCommandTemplate.includes("knowledge\\create-rag-confirmed-source-registry-package.mjs") &&
      ragConfirmedSourceRegistryCommandTemplate.includes("<ready-rag-research-intake-or-primary-source-validation.json>"),
    ragConfirmedLocalIngestRunnerCommandReady:
      ragConfirmedLocalIngestRunnerCommandTemplate.includes("knowledge\\run-rag-confirmed-local-ingest.mjs") &&
      ragConfirmedLocalIngestRunnerCommandTemplate.includes("--teacher-reviewed") &&
      ragConfirmedLocalIngestRunnerCommandTemplate.includes("<retained-rollback-point-dir>"),
    knowledgeAugmentedLowTokenFromConfirmedIngestCommandReady:
      knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes(
        "knowledge\\create-knowledge-augmented-low-token-learning-from-confirmed-ingest.mjs"
      ) &&
      knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes(
        "<teacher-reviewed-rag-confirmed-local-ingest-run.json>"
      ) &&
      knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes("--learning-cycle") &&
      knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes("--teacher-reviewed") &&
      knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes("<retained-rollback-point-dir>"),
    knowledgeAugmentedLowTokenFromConfirmedIngestRequiresTeacherReviewedRun: true,
    knowledgeAugmentedLowTokenFromConfirmedIngestKeepsExecutionLocked: true,
    ragTeacherSourceIntakeReviewOnly:
      ragResearchIntakeQueuePacket.locks?.reviewOnly === true &&
      ragResearchIntakeQueuePacket.locks?.softwareActionsExecuted === false &&
      ragResearchIntakeQueuePacket.locks?.memoryEnabled === false &&
      ragResearchIntakeQueuePacket.locks?.ruleEnabled === false &&
      ragResearchIntakeQueuePacket.locks?.packagingGated === true,
    ragTeacherSourceIntakeBlocksUnverifiedCitations:
      Array.isArray(ragResearchIntakeQueuePacket.forbiddenActions) &&
      ragResearchIntakeQueuePacket.forbiddenActions.includes("treat_unverified_leads_as_citations"),
    ragTeacherSourceCandidateCount: Array.isArray(ragResearchIntakeQueuePacket.sourceCandidates)
      ? ragResearchIntakeQueuePacket.sourceCandidates.length
      : ragResearchIntakeQueue.sourceCandidates || 0,
    knowledgeAugmentedLowTokenLearningRulesEnabled: 0,
    knowledgeAugmentedLowTokenLearningExecutesSoftware: false,
    knowledgeAugmentedLowTokenLearningReadsFullLogs: false,
    knowledgeAugmentedLowTokenLearningCapturesScreenshots: false,
    tlclRagEvidenceToHighReasoningRepairChainAuditStatus:
      "available_review_only_audit_for_rag_evidence_to_high_reasoning_repair_chain",
    tlclRagEvidenceToHighReasoningRepairChainAuditCommandReady:
      tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate.includes(
        "smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit"
      ),
    tlclRagEvidenceToHighReasoningRepairChainAuditReviewOnly: true,
    tlclRagEvidenceToHighReasoningRepairChainAuditExecutesSoftware: false,
    tlclRagEvidenceToHighReasoningRepairChainAuditUsesRagAsAuthority: false,
    tlclRagEvidenceToHighReasoningRepairChainAuditMediumRuntimeContinuationBlockedUntilReview: true,
    originalGoalCapabilityMatrixCoverageStatus: originalGoalCapabilityMatrixCoverageAudit.ok
      ? "covered_review_only_capability_matrix"
      : "missing_capability_matrix_coverage",
    originalGoalCapabilityMatrixTotalCapabilities: originalGoalCapabilityMatrixCoverageAudit.capabilityCount || 0,
    originalGoalCapabilityMatrixCoveredCapabilities:
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds?.length || 0,
    originalGoalCapabilityMatrixMissingCapabilityIds:
      originalGoalCapabilityMatrixCoverageAudit.missingCapabilityIds || [],
    originalGoalCapabilityMatrixCoverageAuditCommandReady:
      originalGoalCapabilityMatrixCoverageAuditCommandTemplate.includes("smoke:plugin-original-goal-capability-matrix-coverage-audit"),
    originalGoalCapabilityMatrixReviewOnly: originalGoalCapabilityMatrixCoverageAudit?.locks?.reviewOnly === true,
    originalGoalCapabilityMatrixExecutesSoftware:
      originalGoalCapabilityMatrixCoverageAudit?.locks?.softwareActionsExecuted === true,
    originalGoalCapabilityMatrixWritesMemory:
      originalGoalCapabilityMatrixCoverageAudit?.locks?.memoryWritten === true,
    originalGoalCapabilityMatrixUnlocksPackaging:
      originalGoalCapabilityMatrixCoverageAudit?.locks?.packagingUnlocked === true,
    knowledgeAugmentedSpatialExecutionBridgeStatus:
      sourceKnowledgeAugmentedLowTokenLearning && sourceSpatialSoftwareExecutionRouteBridge
        ? "ready_for_teacher_reviewed_knowledge_spatial_bridge_command"
        : "waiting_for_knowledge_augmented_learning_and_spatial_route_bridge_inputs",
    knowledgeAugmentedSpatialExecutionBridgeMissingInputs,
    knowledgeAugmentedSpatialExecutionBridgeRealInputCommandsReady:
      knowledgeCorpusIngestCommandTemplate.includes("knowledge\\ingest-local-corpus.mjs") &&
      knowledgeAugmentedLowTokenLearningCommandTemplate.includes(
        "knowledge\\augment-low-token-learning-with-retrieval.mjs"
      ) &&
      (knowledgeAugmentedSpatialExecutionBridgeCommandReview.missingInputs || []).join("|") ===
        knowledgeAugmentedSpatialExecutionBridgeMissingInputs.join("|"),
    knowledgeAugmentedSpatialExecutionBridgeRejectsSmokeAsFinalGoalEvidence:
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.evidenceBoundary?.smokeEvidenceIsNeverFinalGoalProof === true &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.evidenceBoundary
        ?.syntheticSmokeKnowledgePacketMayNotSatisfyOriginalGoal === true,
    knowledgeAugmentedSpatialExecutionBridgeSmokeCommandReady: true,
    knowledgeAugmentedSpatialExecutionBridgeCommandReady: true,
    knowledgeAugmentedSpatialExecutionBridgeHasKnowledgeInput: Boolean(sourceKnowledgeAugmentedLowTokenLearning),
    knowledgeAugmentedSpatialExecutionBridgeHasSpatialRouteInput: Boolean(sourceSpatialSoftwareExecutionRouteBridge),
    spatialRouteToExecutionApprovalHandoffFormat: sourceSpatialRouteToExecutionApprovalHandoff.format || "",
    spatialRouteToExecutionApprovalHandoffStatus: sourceSpatialRouteToExecutionApprovalHandoff.status || "",
    spatialRouteToExecutionApprovalObjectiveRequirementId:
      sourceSpatialRouteToExecutionApprovalHandoff.objectiveRequirementId || "",
    spatialRouteToExecutionApprovalCompletionBlockerLane:
      sourceSpatialRouteToExecutionApprovalHandoff.completionBlockerLane || "",
    spatialRouteToExecutionApprovalNextGate: sourceSpatialRouteToExecutionApprovalHandoff.nextGate || "",
    spatialRouteToExecutionApprovalPrerequisiteGate:
      sourceSpatialRouteToExecutionApprovalHandoff.prerequisiteGate || "",
    spatialRouteToExecutionApprovalCommandBuilder:
      sourceSpatialRouteToExecutionApprovalHandoff.nextGateAfterReadyGate ||
      sourceSpatialRouteToExecutionApprovalHandoff.commandBuilder ||
      "",
    spatialRouteToExecutionApprovalFinalRunnerGate:
      sourceSpatialRouteToExecutionApprovalHandoff.finalRunnerGate || "",
    spatialRouteToExecutionApprovalReadyForApprovalPrep:
      sourceSpatialRouteToExecutionApprovalHandoff.readyForExecutionApprovalGatePrep === true ||
      sourceSpatialRouteToExecutionApprovalHandoff.readyForApprovalPrep === true,
    spatialRouteToExecutionApprovalReturnToCompletionBlockerMatrix:
      sourceSpatialRouteToExecutionApprovalHandoff.returnToCompletionBlockerMatrixAfterNextGate === true,
    spatialRouteToExecutionApprovalRequiredEvidenceBeforeManualUse:
      sourceSpatialRouteToExecutionApprovalHandoff.requiredEvidenceBeforeManualUse || [],
    spatialRouteBridgeDoesNotCreateApprovalGate:
      sourceSpatialRouteToExecutionApprovalHandoff.locks?.routeBridgeDoesNotCreateApprovalGate === true,
    spatialRouteBridgeDoesNotRunApprovedGateRunner:
      sourceSpatialRouteToExecutionApprovalHandoff.locks?.routeBridgeDoesNotRunApprovedGateRunner === true,
    spatialRouteBridgeDoesNotInvokeAdapter:
      sourceSpatialRouteToExecutionApprovalHandoff.locks?.routeBridgeDoesNotInvokeAdapter === true,
    knowledgeAugmentedSpatialExecutionBridgeExecutesSoftware: false,
    knowledgeAugmentedSpatialExecutionBridgeReadsFullLogs: false,
    knowledgeAugmentedSpatialExecutionBridgeCapturesScreenshots: false,
    knowledgeAugmentedSpatialExecutionBridgeRulesEnabled: 0,
    knowledgeAugmentedSpatialExecutionBridgePackagingGated: true,
    realLocalFullGoalIntegratedCycleSmokeStatus:
      latestRealLocalFullGoalIntegratedCycleSmokePacket?.status || "",
    realLocalFullGoalIntegratedCycleSmokeSoftware:
      latestRealLocalFullGoalIntegratedCycleSmokePacket?.realLocalSoftware?.software || "",
    realLocalFullGoalIntegratedCycleSmokeDiscoveredCandidates:
      latestRealLocalFullGoalIntegratedCycleSmokePacket?.realLocalSoftware?.discoveredCandidateCount || 0,
    realLocalFullGoalIntegratedCycleSmokeTotalChecks:
      Array.isArray(latestRealLocalFullGoalIntegratedCycleSmokePacket?.checks)
        ? latestRealLocalFullGoalIntegratedCycleSmokePacket.checks.length
        : 0,
    realLocalFullGoalIntegratedCycleSmokePassedChecks:
      Array.isArray(latestRealLocalFullGoalIntegratedCycleSmokePacket?.checks)
        ? latestRealLocalFullGoalIntegratedCycleSmokePacket.checks.filter((check) => check.pass === true).length
        : 0,
    realLocalFullGoalIntegratedCycleSmokeReviewOnly:
      latestRealLocalFullGoalIntegratedCycleSmokePacket?.checks?.some((check) =>
        String(check.name || "").includes("keeps execution, screenshots, memory, acceptance, packaging")
      ) === true,
    realLocalFullGoalIntegratedCycleSmokeGoalStillNotComplete:
      latestRealLocalFullGoalIntegratedCycleSmokePacket?.status === "passed",
    eventTriggeredObservationPolicyStatus: eventTriggeredObservationPolicy.status || "",
    eventTriggeredObservationPolicyReady: Boolean(eventTriggeredObservationPolicy.policyPath),
    eventTriggeredObservationPolicyCompactRows: eventTriggeredObservationPolicy.compactRowsCount || 0,
    eventTriggeredObservationPolicyVisualRows: eventTriggeredObservationPolicy.visualRowsCount || 0,
    eventTriggeredObservationPolicyReceiptTemplateReady: Boolean(
      eventTriggeredObservationPolicyReceiptBuilder.receiptTemplatePath || eventTriggeredObservationPolicy.receiptTemplatePath
    ),
    eventTriggeredObservationPolicyReceiptBuilderReady: Boolean(eventTriggeredObservationPolicyReceiptBuilder.htmlPath),
    eventTriggeredObservationPolicyReceiptBuilderRows: eventTriggeredObservationPolicyReceiptBuilder.reviewRowCount || 0,
    eventTriggeredObservationPolicyReceiptValidationCommandReady:
      eventTriggeredObservationPolicyReceiptValidationCommandTemplate.includes(
        "validate-event-triggered-low-token-observation-policy-receipt.mjs"
      ) &&
      eventTriggeredObservationPolicyReceiptValidationCommandTemplate.includes(
        "<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>"
      ),
    triggeredVisualCaptureCommandReady:
      triggeredVisualCaptureCommandTemplate.includes("capture-triggered-visual-check.mjs") &&
      triggeredVisualCaptureCommandTemplate.includes("--selected-request-id"),
    triggeredVisualCheckCommandBuilderReady:
      Boolean(triggeredVisualCheckCommandBuilder.htmlPath) &&
      ["waiting_for_teacher_single_visual_check_command_generation", "waiting_for_teacher_visual_check_queue_path"].includes(
        triggeredVisualCheckCommandBuilder.status || ""
      ),
    triggeredVisualCheckCommandBuilderCommandReady:
      triggeredVisualCheckCommandBuilderCommandTemplate.includes("create-triggered-visual-check-command-builder.mjs") &&
      triggeredVisualCheckCommandBuilderCommandTemplate.includes("automatic-triggered-visual-check-queue.json"),
    triggeredVisualLearningHandoffCommandReady:
      triggeredVisualLearningHandoffCommandTemplate.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      triggeredVisualLearningHandoffCommandTemplate.includes("--capture-receipt") &&
      triggeredVisualLearningHandoffCommandTemplate.includes("--request"),
    triggeredVisualLearningHandoffReviewCommandReady:
      triggeredVisualLearningHandoffReviewCommandTemplate.includes("run-triggered-visual-evidence-learning-handoff-review.mjs") &&
      triggeredVisualLearningHandoffReviewCommandTemplate.includes("--handoff"),
    triggeredVisualLearningHandoffReviewReceiptValidationCommandReady:
      triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes(
        "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"
      ) &&
      triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes(
        "<teacher-filled-triggered-visual-learning-review-receipt.json>"
      ),
    triggeredVisualVoiceControlWorkbenchCommandReady:
      triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("create-triggered-visual-evidence-voice-control-workbench.mjs") &&
      triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("--handoff") &&
      triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("--command"),
    transparentSketchDepthDemonstrationRehearsalCommandReady:
      transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes(
        "create-transparent-sketch-depth-demonstration-rehearsal.mjs"
      ) &&
      transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes("--goal") &&
      transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes("--software"),
    transparentSketchDepthDemonstrationRehearsalReady:
      transparentSketchDepthDemonstrationRehearsal?.status ===
        "waiting_for_teacher_numbered_spatial_target_confirmation" &&
      transparentSketchDepthDemonstrationRehearsal?.reviewLocks?.rehearsalDoesNotExecuteSoftware === true &&
      transparentSketchDepthDemonstrationRehearsal?.reviewLocks?.rehearsalDoesNotCaptureScreenshots === true &&
      transparentSketchDepthDemonstrationRehearsal?.reviewLocks?.rehearsalDoesNotWriteMemory === true,
    transparentSketchDepthRehearsalReviewReceiptBuilderReady:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.format ===
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1" &&
      transparentSketchDepthRehearsalReviewReceiptBuilder?.locks?.builderDoesNotExecuteSoftware === true &&
      transparentSketchDepthRehearsalReviewReceiptBuilder?.locks?.goalComplete === false,
    transparentSketchDepthRehearsalReviewReceiptValidationCommandReady:
      String(transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || "").includes(
        "validate-transparent-sketch-depth-rehearsal-review-receipt.mjs"
      ) &&
      String(transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || "").includes(
        "<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>"
      ),
    transparentSketchDepthRehearsalReviewReceiptValidationStatus:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.status ||
      "missing_transparent_sketch_depth_rehearsal_review_receipt_validation",
    transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.format ===
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1" &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.validationDecision ===
        "needs_teacher_review" &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.locks?.validationDoesNotExecuteSoftware === true &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.locks?.goalComplete === false,
    transparentSketchDepthRehearsalReviewReceiptTeacherConfirmedReviewOnly:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.format ===
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1" &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.validationDecision ===
        "teacher_confirmed_depth_rehearsal_review_only" &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.readyForExecution === false &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.locks?.validationDoesNotExecuteSoftware === true &&
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.locks?.goalComplete === false,
    commandCenterCreated: Boolean(commandCenterPacket),
    commandCenterStageCount: commandCenterPacket?.stages?.length || 0,
    teacherReviewCockpitReady: Boolean(commandCenterPacket?.paths?.teacherReviewCockpit),
    teacherReviewCockpitHtmlReady: Boolean(commandCenterPacket?.paths?.teacherReviewCockpitHtml),
    teacherReviewCockpitReviewOnly:
      Boolean(commandCenterPacket?.paths?.teacherReviewCockpit) &&
      existsSync(commandCenterPacket.paths.teacherReviewCockpit) &&
      readJson(commandCenterPacket.paths.teacherReviewCockpit)?.locks?.reviewOnly === true,
    teacherReviewCockpitHandoffQueueCommandReady: true,
    originalGoalReviewHandoffQueueItemRunnerCommandReady: true,
    nonExpertEngineeringVoiceControlCapabilityReady: Boolean(commandCenterVoiceWorkbenchPacket),
    nonExpertVoiceTextInputReady: Boolean(commandCenterPacket?.paths?.voiceWorkbenchHtml || commandCenterPacket?.paths?.voiceWorkbench),
    nonExpertNumberedTargetConfirmationReady: Boolean(sourcePreflightTargetConfirmation),
    nonExpertExecutionStillRequiresTeacherConfirmedNumber: true,
    transparentSketchOverlayReady: Boolean(transparentSketchOverlayPath),
    transparentSketchOverlayPacketValidationCommandReady:
      transparentSketchOverlayPacketValidationCommandTemplate.includes(
        "validate-transparent-sketch-overlay-packet.mjs"
      ) &&
      transparentSketchOverlayPacketValidationCommandTemplate.includes(
        "<teacher-exported-transparent-sketch-packet.json>"
      ),
    transparentSketchOverlayPacketValidationReady:
      sourceTransparentSketchOverlayPacketValidationPacket?.format ===
        "transparent_ai_transparent_sketch_overlay_packet_validation_v1" &&
      sourceTransparentSketchOverlayPacketValidationPacket?.readyForSpatialIntentEvidenceReceipt === true &&
      sourceTransparentSketchOverlayPacketValidationPacket?.locks?.validationDoesNotExecuteTargetSoftware === true &&
      sourceTransparentSketchOverlayPacketValidationPacket?.locks?.goalComplete === false,
    transparentSketchOverlayPacketValidationStatus:
      sourceTransparentSketchOverlayPacketValidationPacket?.status || "",
    transparentSketchOverlayPacketValidationHas2D:
      sourceTransparentSketchOverlayPacketValidationPacket?.spatialEvidence?.has2DPositionEvidence === true,
    transparentSketchOverlayPacketValidationHasPerspective:
      sourceTransparentSketchOverlayPacketValidationPacket?.spatialEvidence?.hasPerspectiveEvidence === true,
    transparentSketchOverlayPacketValidationHas3DDepth:
      sourceTransparentSketchOverlayPacketValidationPacket?.spatialEvidence?.has3DDepthEvidence === true,
    transparentSketchOverlayPacketValidationDetailLogicReady:
      sourceTransparentSketchOverlayPacketValidationPacket?.detailLogic?.ready === true,
    spatialTargetBridgeReadyForTeacherExportedPacket: Boolean(spatialTargetConfirmationCommandTemplate),
    spatialIntentEvidenceRequestReady:
      Boolean(transparentSketchOverlayPath) && !spatialIntentEvidenceReceiptValidationReady,
    spatialIntentEvidenceReceiptValidationReady: spatialIntentEvidenceReceiptValidationReady,
    spatialIntentEvidenceReceiptValidationStatus:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.status || "",
    spatialIntentEvidenceReceiptValidationDecision:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationDecision || "",
    spatialIntentEvidenceReceiptValidationHas2D:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.spatialEvidence?.has2DPositionEvidence === true,
    spatialIntentEvidenceReceiptValidationHasPerspective:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.spatialEvidence?.hasPerspectiveEvidence === true,
    spatialIntentEvidenceReceiptValidationHas3DDepth:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.spatialEvidence?.has3DDepthEvidence === true,
    spatialIntentEvidenceReceiptValidationDetailLogicReady:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.detailLogicReadyForAction === true,
    spatialIntentEvidenceReceiptValidationDetailLogicReceiptReady:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationRow?.detailLogicValidationReadyForAction === true,
    spatialRoutePilotSelectionReceiptCommandReady:
      spatialRoutePilotSelectionReceiptCommandTemplate.includes("create-spatial-route-pilot-selection-receipt.mjs") &&
      spatialRoutePilotSelectionReceiptCommandTemplate.includes(spatialRouteExecutionApprovalPrepHandoffPlaceholder) &&
      spatialRoutePilotSelectionReceiptCommandTemplate.includes(realLocalExecutionPilotSelectorPlaceholder),
    spatialRoutePilotSelectionReceiptValidationCommandReady:
      spatialRoutePilotSelectionReceiptValidationCommandTemplate.includes(
        "create-spatial-route-pilot-selection-receipt.mjs"
      ) &&
      spatialRoutePilotSelectionReceiptValidationCommandTemplate.includes(
        "<teacher-filled-spatial-route-pilot-selection-review-receipt.json>"
      ),
    spatialRoutePilotSelectionRequiredBeforeApprovalPrepReuse: true,
    spatialRouteApprovalPrepReuseBlockedUntilTeacherPilotSelectionReceipt: true,
    triggeredVisualTransparentOverlayHandoffPresent: Boolean(sourceTriggeredVisualTransparentOverlayHandoff),
    triggeredVisualTransparentOverlayHandoffReviewOnly:
      sourceTriggeredVisualTransparentOverlayHandoffPacket?.locks?.reviewOnly === true &&
      sourceTriggeredVisualTransparentOverlayHandoffPacket?.locks?.softwareActionsExecuted === false,
    spatialIntentFormalEvidenceEntrypointPresent: Boolean(sourceSpatialIntentFormalEvidenceEntrypoint),
    spatialIntentFormalEvidenceEntrypointReadyForTeacherExportedOverlay:
      sourceSpatialIntentFormalEvidenceEntrypointPacket?.status === "ready_for_teacher_exported_overlay_packet" ||
      sourceSpatialIntentFormalEvidenceEntrypointPacket?.status === "waiting_for_teacher_exported_overlay_packet",
    spatialToSoftwareExecutionGatePackagePresent: Boolean(sourceSpatialToSoftwareExecutionGatePackage),
    spatialToSoftwareExecutionGatePackageBlocksExecution:
      sourceSpatialToSoftwareExecutionGatePackagePacket?.status === "blocked_before_spatial_software_execution" &&
      sourceSpatialToSoftwareExecutionGatePackagePacket?.locks?.softwareActionsExecuted === false,
    rawSpatialIntentPacketPresent: Boolean(sourcePreflightSpatialIntent),
    formalSpatialIntentEvidencePresent: spatialIntentEvidenceReceiptValidationReady,
    formalSpatialIntentEvidenceEntrypointReadyButNotTeacherEvidence:
      Boolean(sourceSpatialIntentFormalEvidenceEntrypoint) && !spatialIntentEvidenceReceiptValidationReady,
    sketchDemonstrationImplementationAuditReady,
    sketchDemonstrationImplementationAuditStatus:
      sourceSketchDemonstrationImplementationAuditPacket?.status || "",
    sketchDemonstrationImplementationAuditSummary:
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary || {},
    sketchDemonstrationImplementationAuditBoundary:
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary?.unattendedNativeUniversalExecutionProven === false
        ? "transparent_2d_perspective_3d_teacher_evidence_ready_but_unattended_native_universal_execution_unproven"
        : "sketch_demonstration_audit_missing_or_untrusted",
    transparentSketch2DPerspective3DImplemented:
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary?.transparentDrawingMaskImplemented === true &&
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary?.teacher2DSketchUnderstood === true &&
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary?.teacherPerspectiveSketchUnderstood === true &&
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary?.teacher3DDepthSketchUnderstood === true,
    transparentSketchImplementationAuditReviewOnly:
      sourceSketchDemonstrationImplementationAuditPacket?.locks?.reviewOnly === true &&
      sourceSketchDemonstrationImplementationAuditPacket?.locks?.packagingGated === true &&
      sourceSketchDemonstrationImplementationAuditPacket?.locks?.nativeUniversalExecution === false,
    transparentSketchLogicContractRuleDraftStatus:
      sourceTransparentSketchLogicContractRuleDraftPacket?.status || "",
    transparentSketchLogicContractRuleDraftDisabledRuleCount:
      sourceTransparentSketchLogicContractRuleDraftPacket?.disabledRuleCount || 0,
    transparentSketchLogicContractRuleDraftCommandReady:
      String(transparentSketchLogicContractRuleDraftCommandTemplate || "").includes(
        "create-transparent-sketch-logic-contract-rule-draft.mjs"
      ),
    transparentSketchLogicContractRuleDraftRulesStayDisabled:
      sourceTransparentSketchLogicContractRuleDraftPacket?.locks?.ruleEnabled === false &&
      sourceTransparentSketchLogicContractRuleDraftPacket?.locks?.activeRulePackageCompiled === false,
    transparentSketchLogicContractRuleDraftDoesNotExecuteSoftware:
      sourceTransparentSketchLogicContractRuleDraftPacket?.locks?.softwareActionsExecuted === false,
    teacherMethodExecutionLearningContractStatus:
      sourceTeacherMethodExecutionLearningContractPacket?.status || "",
    teacherMethodExecutionLearningContractCommandReady:
      String(teacherMethodExecutionLearningContractCommandTemplate || "").includes(
        "create-teacher-method-execution-learning-contract.mjs"
      ),
    teacherMethodExecutionLearningContractRouteCount:
      sourceTeacherMethodExecutionLearningContractPacket?.coverage?.routeContractCount || 0,
    teacherMethodContractLowTokenMetadataFirst:
      sourceTeacherMethodExecutionLearningContractPacket?.coverage?.lowTokenMetadataFirst === true,
    teacherMethodContractTransparentOverlaySpatialIntent:
      sourceTeacherMethodExecutionLearningContractPacket?.coverage?.transparentOverlaySpatialIntent === true,
    teacherMethodContractCorrectionBoundaryCounterexample:
      sourceTeacherMethodExecutionLearningContractPacket?.coverage?.correctionBoundaryCounterexample === true,
    teacherMethodContractHighToMediumModelTierPolicy:
      sourceTeacherMethodExecutionLearningContractPacket?.coverage?.highToMediumModelTierPolicy === true,
    teacherMethodContractEveryTeacherModeHasRoute:
      sourceTeacherMethodExecutionLearningContractPacket?.coverage?.everyTeacherModeHasRoute === true,
    teacherMethodContractReviewOnly:
      sourceTeacherMethodExecutionLearningContractPacket?.locks?.reviewOnly === true &&
      sourceTeacherMethodExecutionLearningContractPacket?.locks?.ruleEnabled === false,
    teacherMethodContractDoesNotExecuteSoftware:
      sourceTeacherMethodExecutionLearningContractPacket?.locks?.softwareActionsExecuted === false &&
      sourceTeacherMethodExecutionLearningContractPacket?.locks?.targetSoftwareCommandsExecuted === false,
    parametricFeatureDataLogicLearningReady: Boolean(parametricDrawingLogicKitPath),
    parametricFeatureDataLogicReviewOnly: parametricDrawingLogicKit?.locks?.reviewOnly === true,
    parametricFeatureDataLogicBlocksSurfaceSimilarityOnly:
      parametricDrawingLogicKit?.locks?.surfaceSimilarityOnlyAccepted === false &&
      Array.isArray(parametricDrawingLogicKit?.blockedActions) &&
      parametricDrawingLogicKit.blockedActions.includes("generate_visually_similar_output_without_feature_logic"),
    realLocalAllSoftwareLowTokenReadinessPackageReady: Boolean(sourceRealLocalReadinessPackage),
    realLocalAllSoftwareLowTokenReadinessReceiptReady: existsSync(sourceRealLocalReadinessReceipt),
    realLocalAllSoftwareLowTokenReadinessReviewOnly: sourceRealLocalReadinessPackage
      ? sourceRealLocalReadinessPackagePacket?.locks?.reviewOnly === true
      : false,
    realLocalAllSoftwareLowTokenReadinessScopeClaim: realLocalReadinessScopeClaim,
    realLocalAllSoftwareLowTokenReadinessCadOrSolidWorksCandidates: realLocalReadinessCadOrSolidWorksCandidates,
    realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksCandidates: realLocalReadinessNonCadSolidWorksCandidates,
    realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksLedgerRows: realLocalReadinessNonCadSolidWorksLedgerRows,
    realLocalAllSoftwareLowTokenReadinessNotCadSolidWorksOnly:
      realLocalReadinessScopeClaim === "real_local_bounded_all_software_not_cad_solidworks_only" &&
      realLocalReadinessNonCadSolidWorksCandidates > 0,
    realLocalAllSoftwareLowTokenReadinessBoundedNotComplete:
      realLocalReadinessScopeEvidence.boundedNotComplete === true,
    operationalActivationChainEvidenceCount: [
      sourceOperationalActivationGate,
      sourceOperationalActivationDryRunRehearsal,
      sourceOperationalRegistrationExecuteGate,
      sourceOperationalPostActivationWitness
    ].filter(Boolean).length,
    operationalActivationGateReady: Boolean(sourceOperationalActivationGate),
    operationalActivationGateStatus: sourceOperationalActivationGatePacket?.status || "",
    operationalActivationGateReviewOnly:
      sourceOperationalActivationGatePacket?.locks?.reviewOnly === true &&
      sourceOperationalActivationGatePacket?.locks?.scheduledTaskRegistered === false,
    operationalActivationDryRunRehearsalReady: Boolean(sourceOperationalActivationDryRunRehearsal),
    operationalActivationDryRunRehearsalStatus: sourceOperationalActivationDryRunRehearsalPacket?.status || "",
    operationalActivationDryRunRehearsalNoSystemChange:
      sourceOperationalActivationDryRunRehearsalPacket?.locks?.scheduledTaskRegistered === false &&
      sourceOperationalActivationDryRunRehearsalPacket?.locks?.wrapperExecuteFlagPassed === false,
    operationalRegistrationExecuteGateReady: Boolean(sourceOperationalRegistrationExecuteGate),
    operationalRegistrationExecuteGateStatus: sourceOperationalRegistrationExecuteGatePacket?.status || "",
    operationalRegistrationExecuteGatePreparedNotExecuted:
      sourceOperationalRegistrationExecuteGatePacket?.locks?.executeRequestPrepared === true &&
      sourceOperationalRegistrationExecuteGatePacket?.locks?.executeRequestExecuted === false,
    operationalPostActivationWitnessReady: Boolean(sourceOperationalPostActivationWitness),
    operationalPostActivationWitnessStatus: sourceOperationalPostActivationWitnessPacket?.status || "",
    operationalPostActivationWitnessRemainingGapCount:
      sourceOperationalPostActivationWitnessPacket?.remainingGaps?.length || 0,
    operationalPostActivationWitnessReceiptBuilderReady:
      operationalPostActivationWitnessReceiptBuilder?.format ===
      "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_result_v1",
    operationalPostActivationWitnessReceiptBuilderReviewOnly:
      operationalPostActivationWitnessReceiptBuilder?.locks?.reviewOnly === true &&
      operationalPostActivationWitnessReceiptBuilder?.locks?.builderDoesNotRegisterTask === true &&
      operationalPostActivationWitnessReceiptBuilder?.locks?.builderDoesNotRerunWitness === true,
    allSoftwareUnattendedLearningAuditReady:
      allSoftwareUnattendedLearningAuditPacket?.format === "transparent_ai_all_software_unattended_learning_audit_v1",
    allSoftwareUnattendedLearningAuditStatus: allSoftwareUnattendedLearningAuditPacket?.status || "",
    allSoftwareUnattendedLearningAuditRemainingGaps:
      Array.isArray(allSoftwareUnattendedLearningAuditPacket?.remainingGaps)
        ? allSoftwareUnattendedLearningAuditPacket.remainingGaps.length
        : null,
    unattendedAllAppMonitoringComplete:
      allSoftwareUnattendedLearningAuditPacket?.unattendedAllAppMonitoringComplete === true,
    allSoftwareUnattendedLearningAuditNoSystemChange:
      allSoftwareUnattendedLearningAuditPacket?.locks?.auditDoesNotChangeSystem === true &&
      allSoftwareUnattendedLearningAuditPacket?.locks?.scheduledTaskRegistered === false &&
      allSoftwareUnattendedLearningAuditPacket?.locks?.runnerLaunched === false &&
      allSoftwareUnattendedLearningAuditPacket?.locks?.softwareActionsExecuted === false &&
      allSoftwareUnattendedLearningAuditPacket?.locks?.nativeUniversalExecution === false,
    recurringMonitorTeacherConfirmationPackageReady:
      recurringMonitorTeacherConfirmationPacket?.format ===
      "transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_v1",
    recurringMonitorTeacherConfirmationPackageStatus:
      recurringMonitorTeacherConfirmationPacket?.status ||
      recurringMonitorTeacherConfirmationPackage.status ||
      "",
    recurringMonitorTeacherConfirmationRows:
      recurringMonitorTeacherConfirmationPacket?.confirmationRows?.length || 0,
    recurringMonitorTeacherConfirmationRowsNeedingReview:
      recurringMonitorTeacherConfirmationPacket?.confirmationRows?.filter((row) => row.status === "needs_teacher_review")
        .length || 0,
    recurringMonitorTeacherConfirmationValidationCommandReady:
      Boolean(recurringMonitorTeacherConfirmationPackage.packagePath),
    recurringMonitorTeacherConfirmationReceiptValidationReady:
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.format ===
      "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_validation_v1",
    recurringMonitorTeacherConfirmationReceiptValidationStatus:
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.status || "",
    recurringMonitorTeacherConfirmationReceiptValidationDecision:
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.validationDecision || "",
    recurringMonitorTeacherConfirmationReceiptValidationMissingRows:
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.missingConfirmationCount ?? null,
    recurringMonitorTeacherConfirmationReceiptReadyToRerunApprovalGate:
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.readyToRerunApprovalGate === true,
    recurringMonitorTeacherConfirmationReceiptValidationNoSystemChange:
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.locks?.scheduledTaskRegistered === false &&
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.locks?.runnerLaunched === false &&
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.locks?.softwareActionsExecuted === false &&
      sourceRecurringMonitorTeacherConfirmationReceiptValidationPacket?.locks?.nativeUniversalExecution === false,
    recurringMonitorTeacherConfirmationNoSystemChange:
      recurringMonitorTeacherConfirmationPacket?.locks?.scheduledTaskRegistered === false &&
      recurringMonitorTeacherConfirmationPacket?.locks?.runnerLaunched === false &&
      recurringMonitorTeacherConfirmationPacket?.locks?.softwareActionsExecuted === false &&
      recurringMonitorTeacherConfirmationPacket?.locks?.logContentsRead === false &&
      recurringMonitorTeacherConfirmationPacket?.locks?.screenshotsCaptured === false &&
      recurringMonitorTeacherConfirmationPacket?.locks?.longTermMemoryWritten === false,
    unattendedApprovalGapsHaveTeacherConfirmationEntryPoint:
      allSoftwareUnattendedLearningAuditPacket?.remainingGaps?.some((gap) => gap.kind === "approval_gate_not_ready") ===
        true && recurringMonitorTeacherConfirmationPacket?.confirmationRows?.some((row) => row.blocks === true) === true,
    recurringMonitorRegistrationDryRunCommandReady: true,
    recurringMonitorRegistrationStatusVerifierCommandReady: true,
    recurringMonitorPostConfirmationChainReviewOnly: true,
    coverageEnrollmentFollowUpReceiptBuilderReady: Boolean(sourceCoverageEnrollmentFollowUpReceiptBuilder),
    coverageEnrollmentFollowUpReceiptBuilderReviewOnly:
      sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.locks?.reviewOnly === true,
    coverageEnrollmentFollowUpReceiptBuilderDoesNotRunBatch:
      sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.locks?.builderDoesNotRunBatch === true,
    coverageRolloutHandoffQueueCommandReady: true,
    coverageRolloutHandoffQueueItemRunnerCommandReady: true,
    coverageRolloutHandoffItemRunReviewReceiptBuilderCommandReady: true,
    coverageRolloutHandoffItemRunReviewReceiptValidationCommandReady: true,
    coverageEnrollmentFollowUpHandoffQueueCommandReady: true,
    coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandReady: true,
    coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandReady: true,
    coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandReady: true,
    executionFollowUpHandoffQueueCommandReady: true,
    executionFollowUpHandoffQueueItemRunnerCommandReady: true,
    executionFollowUpHandoffItemReceiptBuilderCommandReady: true,
    executionFollowUpHandoffItemReceiptValidationCommandReady: true,
    actionLogicSourceContractPackage: actionLogicSourceContractPackagePath,
    actionLogicSourceContractPackageHtml: actionLogicSourceContractPackageHtmlPath,
    actionLogicSourceContractReceiptTemplate: actionLogicSourceContractReceiptTemplatePath,
    actionLogicSourceContractPackageStatus: actionLogicSourceContractPackage?.status || "",
    actionLogicSourceContractPackageRows: actionLogicSourceContractPackage?.rowCount || 0,
    actionLogicSourceContractPackageReviewOnly: actionLogicSourceContractPackage?.locks?.reviewOnly === true,
    actionLogicSourceContractPackageDoesNotExecuteSoftware:
      actionLogicSourceContractPackage?.locks?.targetSoftwareCommandsExecuted === false,
    actionLogicSourceShortlist: actionLogicSourceShortlistPath,
    actionLogicSourceShortlistHtml: actionLogicSourceShortlistHtmlPath,
    actionLogicSourceShortlistReceiptTemplate: actionLogicSourceShortlistReceiptTemplatePath,
    actionLogicSourceShortlistStatus: actionLogicSourceShortlist?.status || "",
    actionLogicSourceShortlistRecommendedRowId: actionLogicSourceShortlist?.recommendedRowId || "",
    actionLogicSourceShortlistRecommendedSoftware: actionLogicSourceShortlist?.recommendedSoftware || "",
    actionLogicSourceShortlistDefaultReadyPatchRows: actionLogicSourceShortlist?.defaultReadyPatchRows ?? null,
    actionLogicSourceShortlistReviewOnly: actionLogicSourceShortlist?.locks?.reviewOnly === true,
    actionLogicSourceShortlistKeepsExecutionLocked:
      actionLogicSourceShortlist?.locks?.targetSoftwareCommandsExecuted === false &&
      actionLogicSourceShortlist?.locks?.softwareActionsExecuted === false &&
      actionLogicSourceShortlist?.locks?.shortlistDoesNotInvokeRunner === true,
    actionLogicSourceShortlistKeepsRulesAndMemoryLocked:
      actionLogicSourceShortlist?.locks?.shortlistDoesNotEnableRules === true &&
      actionLogicSourceShortlist?.locks?.shortlistDoesNotWriteMemory === true,
    controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderPath,
    controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderHtmlPath,
    controlChannelRepairReceiptTemplate: controlChannelRepairReceiptTemplatePath,
    controlChannelRepairReceiptBuilderRows: controlChannelRepairReceiptBuilder?.rowCount || 0,
    controlChannelRepairReceiptBuilderReviewOnly: controlChannelRepairReceiptBuilder?.locks?.reviewOnly === true,
    executionGapReviewCockpit: executionGapReviewCockpitPath,
    executionGapReviewCockpitHtml: executionGapReviewCockpitHtmlPath,
    executionGapReviewCockpitReceiptTemplate: executionGapReviewCockpitReceiptTemplatePath,
    executionGapReviewCockpitRowsWithBothReviews: executionGapReviewCockpit?.counts?.rowsWithBothReviews || 0,
    executionGapReviewCockpitReviewOnly: executionGapReviewCockpit?.locks?.reviewOnly === true,
    executionGapReviewCockpitDoesNotExecuteSoftware:
      executionGapReviewCockpit?.locks?.targetSoftwareCommandsExecuted === false &&
      executionGapReviewCockpit?.locks?.softwareActionsExecuted === false,
    executionGapReviewCockpitReceiptValidationCommandReady: Boolean(executionGapReviewCockpitPath),
    executionGapReviewCockpitHandoffQueueCommandReady: true,
    executionGapReviewCockpitHandoffQueueItemRunnerCommandReady: true,
    executionGapReviewDownstreamValidationSummaryCommandReady: true,
    executionGapReviewMatrixReconciliationPackageCommandReady: true,
    executionGapReviewMatrixReconciliationReceiptBuilderCommandReady: true,
    executionGapReviewMatrixReconciliationReceiptValidationCommandReady: true,
    executionGapReviewMatrixReconciliationReviewedRunnerCommandReady: true,
    executionGapReviewCockpitShortlist: executionGapReviewCockpitShortlistPath,
    executionGapReviewCockpitShortlistHtml: executionGapReviewCockpitShortlistHtmlPath,
    executionGapReviewCockpitShortlistReceiptTemplate: executionGapReviewCockpitShortlistReceiptTemplatePath,
    executionGapReviewCockpitShortlistStatus: executionGapReviewCockpitShortlist?.status || "",
    executionGapReviewCockpitShortlistRecommendedRowId: executionGapReviewCockpitShortlist?.recommendedRowId || "",
    executionGapReviewCockpitShortlistRecommendedSourceRowId:
      executionGapReviewCockpitShortlist?.recommendedSourceRowId || "",
    executionGapReviewCockpitShortlistRecommendedSoftware: executionGapReviewCockpitShortlist?.recommendedSoftware || "",
    executionGapReviewCockpitShortlistDefaultReadyRows: executionGapReviewCockpitShortlist?.defaultReadyRows ?? null,
    executionGapReviewCockpitShortlistReviewOnly: executionGapReviewCockpitShortlist?.locks?.reviewOnly === true,
    executionGapReviewCockpitShortlistKeepsExecutionLocked:
      executionGapReviewCockpitShortlist?.locks?.targetSoftwareCommandsExecuted === false &&
      executionGapReviewCockpitShortlist?.locks?.softwareActionsExecuted === false,
    executionGapReviewCockpitShortlistKeepsRulesAndMemoryLocked:
      executionGapReviewCockpitShortlist?.locks?.shortlistDoesNotEnableRules === true &&
      executionGapReviewCockpitShortlist?.locks?.shortlistDoesNotWriteMemory === true,
    executionCapabilityConvergenceReady: Boolean(sourceExecutionConvergence),
    executionCapabilityConvergenceStatus: sourceExecutionConvergencePacket?.status || "",
    executionCapabilityConvergenceCounts: sourceExecutionConvergencePacket?.counts || {},
    executionCapabilityConvergenceRemainingGaps:
      sourceExecutionConvergencePacket?.remainingReviewGaps || [],
    executionCapabilityConvergenceReviewOnly:
      sourceExecutionConvergencePacket?.locks?.reviewOnly === true &&
      sourceExecutionConvergencePacket?.locks?.packagingGated === true,
    executionCapabilityConvergenceKeepsNativeExecutionLocked:
      sourceExecutionConvergencePacket?.locks?.nativeUniversalExecution === false &&
      sourceExecutionConvergencePacket?.locks?.targetSoftwareCommandsExecuted === false &&
      sourceExecutionConvergencePacket?.locks?.softwareActionsExecuted === false,
    executionApprovalGatePrepRunnerCommandReady: true,
    executionApprovedGateRunnerCommandReady: true,
    operationalRegistrationApprovedRunnerCommandReady: true,
    operationalPostRegistrationOutputWitnessCommandBuilderCommandReady: true,
    operationalPostRegistrationOutputWitnessRunnerCommandReady: true,
    operationalPostRegistrationOutputWitnessReceiptBuilderCommandReady: true,
    operationalPostRegistrationOutputWitnessReceiptValidationCommandReady: true,
    logSourceDiscoveryLedgerReady: Boolean(sourceLogSourceDiscoveryLedger),
    logSourceDiscoveryStatus: sourceLogSourceDiscoveryLedgerPacket?.status || "",
    logSourceDiscoveryLedgerRows,
    logSourceDiscoveryMissingRows,
    logSourceDiscoveryCandidateRootsNeedBoundedScan,
    logSourceDiscoveryNextReviewQueueCount:
      sourceLogSourceDiscoveryLedgerPacket?.nextReviewQueue?.length || 0,
    allRowsHaveLogSourceRoute,
    allSoftwareLogSourceDiscoveryComplete,
    logSourceDiscoveryReviewOnly:
      sourceLogSourceDiscoveryLedgerPacket?.locks?.reviewOnly === true &&
      sourceLogSourceDiscoveryLedgerPacket?.locks?.logContentsRead === false &&
      sourceLogSourceDiscoveryLedgerPacket?.locks?.screenshotsCaptured === false &&
      sourceLogSourceDiscoveryLedgerPacket?.locks?.softwareActionsExecuted === false,
    coverageEnrollmentEvidenceChainCount: [
      sourceCoverageEnrollmentLedger,
      sourceCoverageEnrollmentFollowUpPlan,
      sourceCoverageEnrollmentFollowUpBatch,
      sourceCoverageEnrollmentFollowUpReconciliation,
      sourceCoverageEnrollmentFollowUpReceiptBuilder
    ].filter(Boolean).length,
    coverageEnrollmentLedgerReady: Boolean(sourceCoverageEnrollmentLedger),
    coverageEnrollmentLedgerRowCount:
      sourceCoverageEnrollmentLedgerPacket?.counts?.rows ||
      sourceCoverageEnrollmentLedgerPacket?.counts?.sourceRows ||
      (Array.isArray(sourceCoverageEnrollmentLedgerPacket?.rows) ? sourceCoverageEnrollmentLedgerPacket.rows.length : 0),
    coverageEnrollmentLedgerNextReviewQueueCount:
      sourceCoverageEnrollmentLedgerPacket?.counts?.nextReviewQueue ||
      (Array.isArray(sourceCoverageEnrollmentLedgerPacket?.nextReviewQueue)
        ? sourceCoverageEnrollmentLedgerPacket.nextReviewQueue.length
        : 0),
    coverageEnrollmentLedgerRealignedFromCurrentLogSource:
      Boolean(generatedLogSourceAlignedCoverageEnrollmentLedger?.ledgerPath),
    coverageEnrollmentLedgerRowsWithLogSourceRoute:
      sourceCoverageEnrollmentLedgerPacket?.counts?.rowsWithLogSourceRoute || 0,
    coverageEnrollmentLedgerLogSourceDiscoveryRowsSeen:
      sourceCoverageEnrollmentLedgerPacket?.counts?.logSourceDiscoveryRowsSeen || 0,
    coverageEnrollmentLedgerReviewOnly: sourceCoverageEnrollmentLedgerPacket?.locks?.reviewOnly === true,
    coverageEnrollmentFollowUpPlanReady: Boolean(sourceCoverageEnrollmentFollowUpPlan),
    coverageEnrollmentFollowUpPlanItemCount:
      sourceCoverageEnrollmentFollowUpPlanPacket?.counts?.followUpItems ||
      (Array.isArray(sourceCoverageEnrollmentFollowUpPlanPacket?.followUpItems)
        ? sourceCoverageEnrollmentFollowUpPlanPacket.followUpItems.length
        : 0),
    coverageEnrollmentFollowUpPlanReviewOnly:
      sourceCoverageEnrollmentFollowUpPlanPacket?.locks?.reviewOnly === true &&
      sourceCoverageEnrollmentFollowUpPlanPacket?.locks?.softwareActionsExecuted === false,
    coverageEnrollmentFollowUpBatchReady: Boolean(sourceCoverageEnrollmentFollowUpBatch),
    coverageEnrollmentFollowUpBatchStatus:
      sourceCoverageEnrollmentFollowUpBatchPacket?.status ||
      (sourceCoverageEnrollmentFollowUpBatchPacket?.teacherReviewed === true
        ? "teacher_reviewed_batch_evidence_present"
        : sourceCoverageEnrollmentFollowUpBatch
          ? "dry_run_or_unreviewed_batch_evidence_present"
          : ""),
    coverageEnrollmentFollowUpBatchTeacherReviewed:
      sourceCoverageEnrollmentFollowUpBatchPacket?.teacherReviewed === true,
    coverageEnrollmentFollowUpBatchRanToolCount: sourceCoverageEnrollmentFollowUpBatchPacket?.ranToolCount || 0,
    coverageEnrollmentFollowUpBatchSelectedItemCount:
      coverageBatchSelectedCount(sourceCoverageEnrollmentFollowUpBatchPacket),
    coverageEnrollmentFollowUpBatchAutoPreviewed,
    coverageEnrollmentFollowUpBatchPreviewRefreshReason,
    coverageEnrollmentFollowUpBatchCoversCurrentPlan:
      coverageFollowUpItemCount(sourceCoverageEnrollmentFollowUpPlanPacket) > 0 &&
      coverageBatchSelectedCount(sourceCoverageEnrollmentFollowUpBatchPacket) >=
        coverageFollowUpItemCount(sourceCoverageEnrollmentFollowUpPlanPacket),
    coverageEnrollmentFollowUpBatchNoTargetSoftwareExecution:
      sourceCoverageEnrollmentFollowUpBatchPacket?.locks?.softwareActionsExecuted === false &&
      sourceCoverageEnrollmentFollowUpBatchPacket?.locks?.targetSoftwareCommandsExecuted === false,
    coverageEnrollmentFollowUpReconciliationReady: Boolean(sourceCoverageEnrollmentFollowUpReconciliation),
    coverageEnrollmentFollowUpReconciliationStatus:
      sourceCoverageEnrollmentFollowUpReconciliationPacket?.status || "",
    coverageEnrollmentFollowUpReconciliationReviewOnly:
      sourceCoverageEnrollmentFollowUpReconciliationPacket?.locks?.reviewOnly === true &&
      sourceCoverageEnrollmentFollowUpReconciliationPacket?.locks?.softwareActionsExecuted === false
  },
  discoveredEvidence: {
    teacherReviewCockpit: commandCenterPacket?.paths?.teacherReviewCockpit || "",
    teacherReviewCockpitHtml: commandCenterPacket?.paths?.teacherReviewCockpitHtml || "",
    teacherReviewCockpitReadme: commandCenterPacket?.paths?.teacherReviewCockpitReadme || "",
    teacherReviewCockpitReceiptTemplate: commandCenterPacket?.paths?.teacherReviewCockpitReceiptTemplate || "",
    teacherReviewCockpitReceiptValidationCommandTemplate:
      firstNextCall(commandCenterPacket, "teacherReviewCockpitReceiptValidation")?.command ||
      commandLine("validate-goal-teacher-review-cockpit-receipt.mjs", [
        ["--cockpit", commandCenterPacket?.paths?.teacherReviewCockpit || "<goal-teacher-review-cockpit.json>"],
        ["--receipt", "<teacher-filled-goal-teacher-review-cockpit-receipt.json>"]
      ]),
    teacherReviewCockpitHandoffQueueCommandTemplate: commandLine("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
      ["--validation", "<goal-teacher-review-cockpit-receipt-validation.json>"],
      ["--output-dir", join(refreshDir, "teacher-review-cockpit-handoff-queue")]
    ]),
    operationalPostRegistrationOutputWitnessRunnerCommandTemplate: operationalPostRegistrationOutputWitnessRunnerCommand(refreshDir),
    operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate:
      operationalPostRegistrationOutputWitnessCommandBuilderCommand(refreshDir),
    operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate:
      operationalPostRegistrationOutputWitnessReceiptBuilderCommand(refreshDir),
    operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate:
      operationalPostRegistrationOutputWitnessReceiptValidationCommand(refreshDir),
    realLocalAllSoftwareLowTokenReadinessPackage: sourceRealLocalReadinessPackage,
    realLocalAllSoftwareLowTokenReadinessReadme: existsSync(sourceRealLocalReadinessReadme) ? sourceRealLocalReadinessReadme : "",
    realLocalAllSoftwareLowTokenReadinessReceipt: existsSync(sourceRealLocalReadinessReceipt) ? sourceRealLocalReadinessReceipt : "",
    executionFollowUpBatch: sourceExecutionFollowUpBatch,
    executionFollowUpReceiptBuilder: executionFollowUpReceiptBuilderPath,
    executionFollowUpReceiptBuilderHtml: executionFollowUpReceiptBuilderHtmlPath,
    executionFollowUpReceiptBuilderReadme: executionFollowUpReceiptBuilderReadmePath,
    actionLogicSourceContractPackage: actionLogicSourceContractPackagePath,
    actionLogicSourceContractPackageHtml: actionLogicSourceContractPackageHtmlPath,
    actionLogicSourceContractPackageReadme: actionLogicSourceContractPackageReadmePath,
    actionLogicSourceContractReceiptTemplate: actionLogicSourceContractReceiptTemplatePath,
    actionLogicSourceContractPackageStatus: actionLogicSourceContractPackage?.status || "",
    actionLogicSourceContractPackageRows: actionLogicSourceContractPackage?.rowCount || 0,
    actionLogicSourceShortlist: actionLogicSourceShortlistPath,
    actionLogicSourceShortlistHtml: actionLogicSourceShortlistHtmlPath,
    actionLogicSourceShortlistReadme: actionLogicSourceShortlistReadmePath,
    actionLogicSourceShortlistReceiptTemplate: actionLogicSourceShortlistReceiptTemplatePath,
    actionLogicSourceShortlistStatus: actionLogicSourceShortlist?.status || "",
    actionLogicSourceShortlistRecommendedRowId: actionLogicSourceShortlist?.recommendedRowId || "",
    actionLogicSourceShortlistRecommendedSoftware: actionLogicSourceShortlist?.recommendedSoftware || "",
    actionLogicSourceShortlistReviewOnly: actionLogicSourceShortlist?.locks?.reviewOnly === true,
    controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderPath,
    controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderHtmlPath,
    controlChannelRepairReceiptBuilderReadme: controlChannelRepairReceiptBuilderReadmePath,
    controlChannelRepairReceiptTemplate: controlChannelRepairReceiptTemplatePath,
    controlChannelRepairReceiptBuilderRows: controlChannelRepairReceiptBuilder?.rowCount || 0,
    executionGapReviewCockpit: executionGapReviewCockpitPath,
    executionGapReviewCockpitHtml: executionGapReviewCockpitHtmlPath,
    executionGapReviewCockpitReadme: executionGapReviewCockpitReadmePath,
    executionGapReviewCockpitReceiptTemplate: executionGapReviewCockpitReceiptTemplatePath,
    executionGapReviewCockpitRowsWithBothReviews: executionGapReviewCockpit?.counts?.rowsWithBothReviews || 0,
    executionGapReviewCockpitShortlist: executionGapReviewCockpitShortlistPath,
    executionGapReviewCockpitShortlistHtml: executionGapReviewCockpitShortlistHtmlPath,
    executionGapReviewCockpitShortlistReadme: executionGapReviewCockpitShortlistReadmePath,
    executionGapReviewCockpitShortlistReceiptTemplate: executionGapReviewCockpitShortlistReceiptTemplatePath,
    executionGapReviewCockpitShortlistStatus: executionGapReviewCockpitShortlist?.status || "",
    executionGapReviewCockpitShortlistRecommendedRowId: executionGapReviewCockpitShortlist?.recommendedRowId || "",
    executionGapReviewCockpitShortlistRecommendedSoftware: executionGapReviewCockpitShortlist?.recommendedSoftware || "",
    executionGapReviewCockpitReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-execution-gap-review-cockpit-receipt.mjs",
      [
        ["--cockpit", executionGapReviewCockpitPath || "<all-software-execution-gap-review-cockpit.json>"],
        ["--receipt", "<teacher-filled-execution-gap-review-cockpit-receipt.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-receipt-validation")]
      ]
    ),
    executionGapReviewCockpitHandoffQueueCommandTemplate: commandLine(
      "create-all-software-execution-gap-review-cockpit-handoff-queue.mjs",
      [
        ["--validation", "<all-software-execution-gap-review-cockpit-receipt-validation.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-queue")]
      ]
    ),
    executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate: commandLine(
      "run-original-goal-review-handoff-queue-item.mjs",
      [
        ["--queue", "<all-software-execution-gap-review-cockpit-handoff-queue.json>"],
        ["--item-number", "<teacher-reviewed-item-number>"],
        ["--run-reviewed-handoff", "true"],
        ["--allow-runner", "true"],
        ["--teacher-confirmation", "<teacher-confirmed-execution-gap-handoff-item-text>"],
        ["--rollback-point-created", "true"],
        ["--rollback-point", "<retained-rollback-point-path-or-label>"],
        ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-item-run")]
      ]
    ),
    executionGapReviewDownstreamValidationSummaryCommandTemplate: commandLine(
      "create-all-software-execution-gap-downstream-validation-summary.mjs",
      [
        ["--control-item-run", "<control-channel-handoff-item-run.json>"],
        ["--action-logic-item-run", "<action-logic-handoff-item-run.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-downstream-validation-summary")]
      ]
    ),
    executionGapReviewMatrixReconciliationPackageCommandTemplate: commandLine(
      "create-all-software-execution-gap-matrix-reconciliation-package.mjs",
      [
        ["--downstream-summary", "<all-software-execution-gap-downstream-validation-summary.json>"],
        ["--matrix", "<current-all-software-execution-capability-matrix.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-package")]
      ]
    ),
    executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate: commandLine(
      "create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs",
      [
        ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-builder")]
      ]
    ),
    executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate: commandLine(
      "validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs",
      [
        ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
        ["--receipt", "<teacher-filled-execution-gap-matrix-reconciliation-receipt.json>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-validation")]
      ]
    ),
    executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate: commandLine(
      "run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs",
      [
        ["--validation", "<all-software-execution-gap-matrix-reconciliation-receipt-validation.json>"],
        ["--run-reviewed-matrix-generation", "true"],
        ["--allow-runner", "true"],
        ["--teacher-confirmation", "<teacher-confirmed-execution-gap-matrix-reconciliation-runner-text>"],
        ["--rollback-point-created", "true"],
        ["--rollback-point", "<retained-rollback-point-path-or-label>"],
        ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-reviewed-runner")]
      ]
    ),
    coverageConvergence: sourceCoverageConvergence,
    logSourceDiscoveryLedger: sourceLogSourceDiscoveryLedger,
    logSourceDiscoveryLedgerReadme: existsSync(sourceLogSourceDiscoveryLedgerReadme) ? sourceLogSourceDiscoveryLedgerReadme : "",
    logSourceDiscoveryLedgerCounts: sourceLogSourceDiscoveryLedgerPacket?.counts || {},
    coverageRolloutReceiptBuilder: coverageRolloutReceiptBuilderPath,
    coverageRolloutReceiptBuilderHtml: coverageRolloutReceiptBuilderHtmlPath,
    coverageRolloutReceiptBuilderReadme: coverageRolloutReceiptBuilderReadmePath,
    coverageRolloutReceiptBuilderDiscoveredBeforeRefresh: sourceCoverageRolloutReceiptBuilder,
    coverageEnrollmentFollowUpReceiptBuilder: sourceCoverageEnrollmentFollowUpReceiptBuilder,
    coverageEnrollmentFollowUpReceiptBuilderHtml: existsSync(sourceCoverageEnrollmentFollowUpReceiptBuilderHtml)
      ? sourceCoverageEnrollmentFollowUpReceiptBuilderHtml
      : "",
    coverageEnrollmentFollowUpReceiptTemplate: existsSync(sourceCoverageEnrollmentFollowUpReceiptTemplate)
      ? sourceCoverageEnrollmentFollowUpReceiptTemplate
      : "",
    coverageRolloutHandoffQueueCommandTemplate: coverageRolloutHandoffQueueCommand(refreshDir),
    coverageRolloutHandoffQueueItemRunnerCommandTemplate: coverageRolloutHandoffQueueItemRunnerCommand(refreshDir),
    coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate:
      coverageRolloutHandoffItemRunReviewReceiptBuilderCommand(refreshDir),
    coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate:
      coverageRolloutHandoffItemRunReviewReceiptValidationCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffQueueCommandTemplate: coverageEnrollmentFollowUpHandoffQueueCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate:
      coverageEnrollmentFollowUpHandoffItemCommandBuilderCommand(refreshDir),
    coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandTemplate:
      coverageEnrollmentFollowUpHandoffQueueItemRunnerCommand(refreshDir),
    executionFollowUpHandoffQueueCommandTemplate: executionFollowUpHandoffQueueCommand(refreshDir),
    executionFollowUpHandoffItemCommandBuilderCommandTemplate:
      executionFollowUpHandoffItemCommandBuilderCommand(refreshDir),
    executionFollowUpHandoffQueueItemRunnerCommandTemplate: executionFollowUpHandoffQueueItemRunnerCommand(refreshDir),
    executionFollowUpHandoffItemReceiptBuilderCommandTemplate: executionFollowUpHandoffItemReceiptBuilderCommand(refreshDir),
    executionFollowUpHandoffItemReceiptValidationCommandTemplate: executionFollowUpHandoffItemReceiptValidationCommand(refreshDir),
    executionApprovalGatePrepRunnerCommandTemplate: executionApprovalGatePrepRunnerCommand(refreshDir),
    executionApprovedGateCommandBuilderCommandTemplate: executionApprovedGateCommandBuilderCommand(refreshDir),
    executionApprovedGateRunnerCommandTemplate: executionApprovedGateRunnerCommand(refreshDir),
    operationalRegistrationApprovedCommandBuilderCommandTemplate:
      operationalRegistrationApprovedCommandBuilderCommand(refreshDir),
    operationalRegistrationApprovedRunnerCommandTemplate: operationalRegistrationApprovedRunnerCommand(refreshDir),
    coverageEnrollmentFollowUpRowCount:
      sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.counts?.followUpRows ||
      sourceCoverageEnrollmentFollowUpReceiptBuilderPacket?.followUpRowCount ||
      0,
    coverageEnrollmentLedger: sourceCoverageEnrollmentLedger,
    coverageEnrollmentLedgerReadme: existsSync(sourceCoverageEnrollmentLedgerReadme) ? sourceCoverageEnrollmentLedgerReadme : "",
    coverageEnrollmentLedgerRealignPreview:
      generatedLogSourceAlignedCoverageEnrollmentLedger?.ledgerPath || "",
    coverageEnrollmentLedgerRealignPreviewReadme:
      generatedLogSourceAlignedCoverageEnrollmentLedger?.teacherReadme || "",
    coverageEnrollmentLedgerRowCount:
      sourceCoverageEnrollmentLedgerPacket?.counts?.rows ||
      sourceCoverageEnrollmentLedgerPacket?.counts?.sourceRows ||
      (Array.isArray(sourceCoverageEnrollmentLedgerPacket?.rows) ? sourceCoverageEnrollmentLedgerPacket.rows.length : 0),
    coverageEnrollmentLedgerNextReviewQueueCount:
      sourceCoverageEnrollmentLedgerPacket?.counts?.nextReviewQueue ||
      (Array.isArray(sourceCoverageEnrollmentLedgerPacket?.nextReviewQueue)
        ? sourceCoverageEnrollmentLedgerPacket.nextReviewQueue.length
        : 0),
    coverageEnrollmentFollowUpPlan: sourceCoverageEnrollmentFollowUpPlan,
    coverageEnrollmentFollowUpPlanReadme: existsSync(sourceCoverageEnrollmentFollowUpPlanReadme)
      ? sourceCoverageEnrollmentFollowUpPlanReadme
      : "",
    coverageEnrollmentFollowUpPlanItemCount:
      sourceCoverageEnrollmentFollowUpPlanPacket?.counts?.followUpItems ||
      (Array.isArray(sourceCoverageEnrollmentFollowUpPlanPacket?.followUpItems)
        ? sourceCoverageEnrollmentFollowUpPlanPacket.followUpItems.length
        : 0),
    coverageEnrollmentFollowUpBatch: sourceCoverageEnrollmentFollowUpBatch,
    coverageEnrollmentFollowUpBatchReadme: existsSync(sourceCoverageEnrollmentFollowUpBatchReadme)
      ? sourceCoverageEnrollmentFollowUpBatchReadme
      : "",
    coverageEnrollmentFollowUpBatchTeacherReviewed:
      sourceCoverageEnrollmentFollowUpBatchPacket?.teacherReviewed === true,
    coverageEnrollmentFollowUpBatchRanToolCount: sourceCoverageEnrollmentFollowUpBatchPacket?.ranToolCount || 0,
    coverageEnrollmentFollowUpBatchSelectedItemCount:
      coverageBatchSelectedCount(sourceCoverageEnrollmentFollowUpBatchPacket),
    coverageEnrollmentFollowUpBatchAutoPreviewed,
    coverageEnrollmentFollowUpBatchPreviewRefreshReason,
    coverageEnrollmentFollowUpBatchCoversCurrentPlan:
      coverageFollowUpItemCount(sourceCoverageEnrollmentFollowUpPlanPacket) > 0 &&
      coverageBatchSelectedCount(sourceCoverageEnrollmentFollowUpBatchPacket) >=
        coverageFollowUpItemCount(sourceCoverageEnrollmentFollowUpPlanPacket),
    coverageEnrollmentFollowUpReconciliation: sourceCoverageEnrollmentFollowUpReconciliation,
    coverageEnrollmentFollowUpReconciliationReadme: existsSync(sourceCoverageEnrollmentFollowUpReconciliationReadme)
      ? sourceCoverageEnrollmentFollowUpReconciliationReadme
      : "",
    coverageEnrollmentFollowUpReconciliationStatus:
      sourceCoverageEnrollmentFollowUpReconciliationPacket?.status || "",
    operationalActivationGate: sourceOperationalActivationGate,
    operationalActivationGateStatus: sourceOperationalActivationGatePacket?.status || "",
    operationalActivationDryRunRehearsal: sourceOperationalActivationDryRunRehearsal,
    operationalActivationDryRunRehearsalStatus: sourceOperationalActivationDryRunRehearsalPacket?.status || "",
    operationalRegistrationExecuteGate: sourceOperationalRegistrationExecuteGate,
    operationalRegistrationExecuteGateStatus: sourceOperationalRegistrationExecuteGatePacket?.status || "",
    operationalPostActivationWitness: sourceOperationalPostActivationWitness,
    operationalPostActivationWitnessReceiptBuilder:
      operationalPostActivationWitnessReceiptBuilder?.builderPath || "",
    operationalPostActivationWitnessReceiptBuilderHtml:
      operationalPostActivationWitnessReceiptBuilder?.htmlPath || "",
    operationalPostActivationWitnessReceiptValidationCommandTemplate,
    operationalPostActivationWitnessStatus: sourceOperationalPostActivationWitnessPacket?.status || "",
    operationalPostActivationWitnessRemainingGaps:
      sourceOperationalPostActivationWitnessPacket?.remainingGaps || [],
    automaticLowTokenLearningSchedule: sourceAutomaticLowTokenLearningSchedule,
    recurringMonitorApprovalGate: sourceRecurringMonitorApprovalGate,
    recurringMonitorRegistrationRunner: sourceRecurringMonitorRegistrationRunner,
    recurringMonitorRegistrationStatus: sourceRecurringMonitorRegistrationStatus,
    recurringMonitorRunOutputAudit: sourceRecurringMonitorRunOutputAudit,
    recurringMonitorTeacherReviewPacket: sourceRecurringMonitorTeacherReviewPacket,
    recurringMonitorReviewDecisionReplayQueue: sourceRecurringMonitorReviewDecisionReplayQueue,
    allSoftwareUnattendedLearningAudit: allSoftwareUnattendedLearningAudit.auditPath || "",
    allSoftwareUnattendedLearningAuditReadme: allSoftwareUnattendedLearningAudit.readmePath || "",
    allSoftwareUnattendedLearningAuditReceipt: allSoftwareUnattendedLearningAudit.receiptPath || "",
    recurringMonitorTeacherConfirmationPackage: recurringMonitorTeacherConfirmationPackage.packagePath || "",
    recurringMonitorTeacherConfirmationPackageReadme: recurringMonitorTeacherConfirmationPackage.readmePath || "",
    recurringMonitorTeacherConfirmationPackageHtml: recurringMonitorTeacherConfirmationPackage.htmlPath || "",
    recurringMonitorTeacherConfirmationReceiptTemplate:
      recurringMonitorTeacherConfirmationPackage.receiptTemplatePath || "",
    executionConvergence: sourceExecutionConvergence,
    lowTokenPreflightRunner: sourcePreflightRunner,
    lowTokenPreflightLearningCycle: sourcePreflightLearningCycle,
    lowTokenPreflightVisualCheckQueue: sourcePreflightVisualCheckQueue,
    lowTokenPreflightVisualCheckQueueGenerated: generatedPreflightVisualCheckQueue,
    lowTokenPreflightTargetConfirmation: sourcePreflightTargetConfirmation,
    knowledgeAugmentedLowTokenLearning: sourceKnowledgeAugmentedLowTokenLearning,
    knowledgeCorpusIngestCommandTemplate,
    knowledgeAugmentedLowTokenLearningCommandTemplate,
    ragResearchIntakeQueue: ragResearchIntakeQueue.queuePath || "",
    ragResearchIntakeQueueReadme: ragResearchIntakeQueue.readmePath || "",
    ragResearchIntakeCorpusIndex: ragResearchIntakeQueue.indexPath || "",
    ragResearchIntakeReceiptBuilder: ragResearchIntakeReceiptBuilder.builderPath || "",
    ragResearchIntakeReceiptBuilderReadme: ragResearchIntakeReceiptBuilder.readmePath || "",
    ragResearchIntakeReceiptTemplate: ragResearchIntakeReceiptBuilder.templatePath || "",
    ragResearchIntakeReceiptValidationCommandTemplate,
    ragConfirmedSourceRegistryCommandTemplate,
    ragConfirmedLocalIngestRunnerCommandTemplate,
    knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate,
    tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate,
    spatialSoftwareExecutionRouteBridge: sourceSpatialSoftwareExecutionRouteBridge,
    knowledgeAugmentedSpatialExecutionBridgeCommandReview: knowledgeAugmentedSpatialExecutionBridgeCommandReviewPath,
    realLocalFullGoalIntegratedCycleSmokeSummary:
      latestRealLocalFullGoalIntegratedCycleSmokeSummary,
    realLocalFullGoalIntegratedCycleSmoke:
      latestRealLocalFullGoalIntegratedCycleSmokePacket?.realLocalSoftware || {},
    knowledgeAugmentedSpatialExecutionBridgeCommandTemplate,
    knowledgeAugmentedSpatialExecutionBridgeMissingInputs,
    lowTokenTriggerBudgetPlan: lowTokenTriggerBudgetPlan.planPath || "",
    lowTokenTriggerBudgetPlanHtml: lowTokenTriggerBudgetPlan.htmlPath || "",
    lowTokenTriggerBudgetPlanReadme: lowTokenTriggerBudgetPlan.readmePath || "",
    lowTokenTriggerBudgetPlanStatus: lowTokenTriggerBudgetPlan.status || "",
    lowTokenTriggerBudgetPlanSelectedActionCount: lowTokenTriggerBudgetPlan.selectedActionCount || 0,
    lowTokenTriggerBudgetPlanCommandTemplate,
    triggeredVisualCheckCommandBuilder: triggeredVisualCheckCommandBuilder.builderPath || "",
    triggeredVisualCheckCommandBuilderHtml: triggeredVisualCheckCommandBuilder.htmlPath || "",
    triggeredVisualCheckCommandBuilderReadme: triggeredVisualCheckCommandBuilder.readmePath || "",
    triggeredVisualCheckCommandBuilderStatus: triggeredVisualCheckCommandBuilder.status || "",
    triggeredVisualCheckCommandBuilderRequestKind: triggeredVisualCheckCommandBuilder.requestKind || "",
    triggeredVisualCheckCommandBuilderRequestCount: triggeredVisualCheckCommandBuilder.requestCount || 0,
    triggeredVisualCheckCommandBuilderCommandTemplate,
    triggeredVisualCaptureCommandTemplate,
    triggeredVisualLearningHandoffCommandTemplate,
    triggeredVisualLearningHandoffReviewCommandTemplate,
    triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate,
    triggeredVisualVoiceControlWorkbenchCommandTemplate,
    teacherActionRouter: teacherActionRouter.routerPath || "",
    teacherActionRouterHtml: teacherActionRouter.htmlPath || "",
    teacherActionRouterReadme: teacherActionRouter.readmePath || "",
    teacherActionRouterStatus: teacherActionRouter.status || "",
    teacherActionRouterRouteRowCount: teacherActionRouter.routeRowCount || 0,
    teacherActionRouterReceiptBuilder: teacherActionRouterReceiptBuilder.builderPath || "",
    teacherActionRouterReceiptBuilderHtml: teacherActionRouterReceiptBuilder.htmlPath || "",
    teacherActionRouterReceiptBuilderReadme: teacherActionRouterReceiptBuilder.readmePath || "",
    teacherActionRouterReceiptTemplate: teacherActionRouterReceiptBuilder.receiptTemplatePath || "",
    teacherActionRouterReceiptValidationCommandTemplate:
      teacherActionRouterReceiptBuilder.nextValidationCommand ||
      commandLine("validate-original-goal-teacher-action-router-receipt.mjs", [
        ["--router", teacherActionRouter.routerPath || ""],
        ["--receipt", "<teacher-filled-action-router-receipt.json>"]
      ]),
    teacherActionRouterHandoffQueueCommandTemplate: commandLine("create-original-goal-teacher-action-router-handoff-queue.mjs", [
      ["--validation", "<teacher-action-router-receipt-validation.json>"],
      ["--output-dir", join(refreshDir, "teacher-action-router-handoff-queue")]
    ]), 
    originalGoalReviewHandoffQueueItemRunnerCommandTemplate: originalGoalReviewHandoffQueueItemRunnerCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptBuilderCommandTemplate:
      originalGoalLowTokenCoverageDossierReceiptBuilderCommand(refreshDir),
    originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate:
      originalGoalLowTokenCoverageDossierReceiptValidationCommand(refreshDir),
    originalGoalLowTokenCoverageCompletionGateCommandTemplate:
      originalGoalLowTokenCoverageCompletionGateCommand(refreshDir),
    originalGoalFinalCompletionGateCommandTemplate:
      originalGoalFinalCompletionGateCommand(
        refreshDir,
        "<original-goal-completion-blocker-matrix.json>",
        sourceRuleDslDeliveryGateAudit || "<rag-delivery-gate-audit-trail.json>"
      ),
    ruleDslDeliveryGateAudit: sourceRuleDslDeliveryGateAudit,
    reviewEntrypointHealthAudit: reviewEntrypointHealthAudit.auditPath || "",
    reviewEntrypointHealthAuditHtml: reviewEntrypointHealthAudit.htmlPath || "",
    reviewEntrypointHealthAuditReadme: reviewEntrypointHealthAudit.readmePath || "",
    reviewEntrypointHealthAuditStatus: reviewEntrypointHealthAudit.status || "",
    reviewEntrypointHealthAuditChecked: reviewEntrypointHealthAudit.checked || 0,
    reviewEntrypointHealthAuditFailedRequired: reviewEntrypointHealthAudit.failedRequired || 0,
    controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderPath,
    controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderHtmlPath,
    controlChannelRepairReceiptBuilderReadme: controlChannelRepairReceiptBuilderReadmePath,
    controlChannelRepairReceiptTemplate: controlChannelRepairReceiptTemplatePath,
    executionGapReviewCockpit: executionGapReviewCockpitPath,
    executionGapReviewCockpitHtml: executionGapReviewCockpitHtmlPath,
    executionGapReviewCockpitReadme: executionGapReviewCockpitReadmePath,
    executionGapReviewCockpitReceiptTemplate: executionGapReviewCockpitReceiptTemplatePath,
    nonExpertEngineeringVoiceControlCapability: nonExpertVoiceControlCapabilityPath,
    nonExpertEngineeringVoiceControlCapabilityHtml: nonExpertVoiceControlCapabilityHtmlPath,
    nonExpertEngineeringVoiceControlWorkbench: commandCenterPacket?.paths?.voiceWorkbench || "",
    nonExpertEngineeringVoiceControlWorkbenchHtml: commandCenterPacket?.paths?.voiceWorkbenchHtml || "",
    nonExpertEngineeringVoiceControlPromptTemplate: nonExpertVoiceControlCapability.teacherPromptTemplate,
    transparentSketchOverlayPacketValidationCommandTemplate,
    transparentSketchOverlayPacketValidation: sourceTransparentSketchOverlayPacketValidation,
    transparentSketchOverlayPacketValidationHtml:
      sourceTransparentSketchOverlayPacketValidationPacket?.paths?.html || "",
    transparentSketchOverlayPacketValidationStatus:
      sourceTransparentSketchOverlayPacketValidationPacket?.status || "",
    transparentSketchOverlayPacketValidationCounts:
      sourceTransparentSketchOverlayPacketValidationPacket?.counts || {},
    spatialIntentEvidenceRequest: spatialIntentEvidenceRequestPath,
    spatialIntentEvidenceRequestHtml: spatialIntentEvidenceRequestHtmlPath,
    spatialIntentEvidenceReceiptTemplate: spatialIntentEvidenceReceiptTemplatePath,
    spatialIntentEvidenceReceiptValidationCommandTemplate,
    spatialIntentEvidenceReceiptValidation: sourceSpatialIntentEvidenceReceiptValidation,
    spatialIntentEvidenceReceiptValidationStatus:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.status || "",
    spatialIntentEvidenceReceiptValidationDecision:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.validationDecision || "",
    spatialIntentEvidenceReceiptValidationNextReviewCommand:
      sourceSpatialIntentEvidenceReceiptValidationPacket?.nextReviewCommand?.commandLine || "",
    sketchDemonstrationImplementationAudit: sourceSketchDemonstrationImplementationAudit,
    sketchDemonstrationImplementationAuditStatus: sourceSketchDemonstrationImplementationAuditPacket?.status || "",
    sketchDemonstrationImplementationAuditSummary:
      sourceSketchDemonstrationImplementationAuditPacket?.requirementSummary || {},
    parametricDrawingLogicLearningKit: parametricDrawingLogicKitPath,
    parametricDrawingLogicLearningKitHtml: parametricDrawingLogicKitHtmlPath,
    parametricDrawingLogicLearningKitDiscoveredBeforeRefresh: discoveredParametricDrawingLogicKit,
    parametricDrawingLogicOptimizedTeacherPrompt: parametricDrawingLogicKit?.optimizedTeacherPrompt || "",
    parametricDrawingLogicStatus: parametricDrawingLogicKit?.status || "",
    parametricDrawingLogicReceiptValidationCommandTemplate,
    parametricDrawingLogicRulePackageCommandTemplate,
    universalDetailLogicApplicationDryRunCommandTemplate,
    universalDetailLogicExistingToolPreviewCommandTemplate,
    numberedTargetConfirmCommandTemplate,
    transparentSketchOverlay: transparentSketchOverlayPath,
    teacherExportedOverlayPacketPlaceholder,
    spatialTargetConfirmationCommandTemplate,
    spatialRoutePilotSelectionReceiptCommandTemplate,
    spatialRoutePilotSelectionReceiptValidationCommandTemplate,
    transparentSketchDepthDemonstrationRehearsalCommandTemplate,
    transparentSketchDepthDemonstrationRehearsal: transparentSketchDepthDemonstrationRehearsal?.rehearsalPath || "",
    transparentSketchDepthDemonstrationRehearsalHtml: transparentSketchDepthDemonstrationRehearsal?.htmlPath || "",
    transparentSketchDepthDemonstrationRehearsalReadme: transparentSketchDepthDemonstrationRehearsal?.readmePath || "",
    transparentSketchDepthDemonstrationRehearsalStatus: transparentSketchDepthDemonstrationRehearsal?.status || "",
    transparentSketchDepthDemonstrationRehearsalChecksPassed:
      transparentSketchDepthDemonstrationRehearsal?.checksPassed || 0,
    transparentSketchDepthDemonstrationRehearsalChecksTotal:
      transparentSketchDepthDemonstrationRehearsal?.checksTotal || 0,
    transparentSketchDepthRehearsalReviewReceiptBuilderCommandTemplate,
    transparentSketchDepthRehearsalReviewReceiptBuilder:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.builder || "",
    transparentSketchDepthRehearsalReviewReceiptBuilderHtml:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.html || "",
    transparentSketchDepthRehearsalReviewReceiptBuilderReadme:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.readme || "",
    transparentSketchDepthRehearsalReviewReceiptTemplate:
      transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.receiptTemplate || "",
    transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate,
    transparentSketchDepthRehearsalReviewReceiptValidation:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidation,
    transparentSketchDepthRehearsalReviewReceiptValidationStatus:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.status || "",
    transparentSketchDepthRehearsalReviewReceiptValidationDecision:
      sourceTransparentSketchDepthRehearsalReviewReceiptValidationPacket?.validationDecision || "",
    transparentSketchLogicContractRuleDraftCommandTemplate,
    transparentSketchLogicContractRuleDraft: sourceTransparentSketchLogicContractRuleDraft || "",
    transparentSketchLogicContractRuleDraftCompiledPackage:
      sourceTransparentSketchLogicContractRuleDraftPacket?.compiledRulePackagePath || "",
    teacherLearningMethodProfile: sourceTeacherLearningMethodProfile || "",
    teacherMethodExecutionLearningContractCommandTemplate,
    teacherMethodExecutionLearningContract: sourceTeacherMethodExecutionLearningContract || "",
    teacherMethodExecutionLearningContractReadme:
      sourceTeacherMethodExecutionLearningContract
        ? sourceTeacherMethodExecutionLearningContract.replace(
            /teacher-method-execution-learning-contract\.json$/,
            "TEACHER_METHOD_EXECUTION_LEARNING_CONTRACT_START_HERE.md"
          )
        : "",
    lowTokenPreflightSpatialIntent: sourcePreflightSpatialIntent,
    lowTokenPreflightExecutionGate: sourcePreflightExecutionGate,
    smokeEvidenceAllowed: allowSmokeEvidence
  },
  directReviewEntryPoints,
  teacherActionShortlist,
  nextSafeAction,
  nextCommands: [
    {
      label: "Refresh this current-status package again",
      command: commandLine("create-original-goal-current-status-refresh.mjs", [["--goal", goal]])
    },
    {
      label: "Open ordered next-action triage for the remaining original-goal blockers",
      command: nextActionTriageHtmlPath
    },
    {
      label: "Run knowledge-augmented low-token learning smoke before treating RAG as goal evidence",
      command: "npm.cmd run smoke:plugin-knowledge-augmented-low-token-learning"
    },
    {
      label: "Run knowledge-augmented spatial execution bridge smoke before treating RAG plus sketch route as execution evidence",
      command: "npm.cmd run smoke:plugin-knowledge-augmented-spatial-execution-bridge"
    },
    {
      label:
        sourceKnowledgeAugmentedLowTokenLearning && sourceSpatialSoftwareExecutionRouteBridge
          ? "Create knowledge-augmented spatial execution bridge from discovered low-token and sketch-route evidence"
          : "Prepare knowledge-augmented spatial execution bridge after RAG packet and spatial route bridge exist",
      command: knowledgeAugmentedSpatialExecutionBridgeCommandTemplate
    },
    {
      label: sourceLogSourceDiscoveryLedger
        ? "Open all-software log source discovery ledger before broad coverage claims"
        : "Create all-software log source discovery ledger before broad coverage claims",
      command: sourceLogSourceDiscoveryLedger
        ? existsSync(sourceLogSourceDiscoveryLedgerReadme)
          ? sourceLogSourceDiscoveryLedgerReadme
          : sourceLogSourceDiscoveryLedger
        : commandLine("create-all-software-log-source-discovery-ledger.mjs", [
            ["--inventory", "<software-observer-inventory.json>"],
            ["--queue", "<software-observer-queue.json>"],
            ["--output-dir", join(refreshDir, "log-source-discovery-ledger")]
          ])
    },
    {
      label: "Open teacher action router for the shortest human confirmation path",
      command: teacherActionRouter.htmlPath || teacherActionRouter.routerPath || ""
    },
    {
      label: "Open teacher action router receipt builder after choosing a route row",
      command: teacherActionRouterReceiptBuilder.htmlPath || teacherActionRouterReceiptBuilder.builderPath || ""
    },
    {
      label: "Fill teacher action router receipt template before downstream validation",
      command: teacherActionRouterReceiptBuilder.receiptTemplatePath || ""
    },
    {
      label: "Fill low-token teacher action shortlist receipt template before downstream validation",
      command: teacherActionShortlistReceiptTemplatePath
    },
    {
      label: "Validate teacher-filled shortlist receipt through the existing teacher action router validator",
      command: teacherActionShortlist.routerReceipt?.validationCommand || ""
    },
    {
      label: "Validate teacher-filled teacher action router receipt before any routed handoff",
      command:
        teacherActionRouterReceiptBuilder.nextValidationCommand ||
        commandLine("validate-original-goal-teacher-action-router-receipt.mjs", [
          ["--router", teacherActionRouter.routerPath || ""],
          ["--receipt", "<teacher-filled-action-router-receipt.json>"]
        ])
    },
    {
      label: "Create a manual handoff queue from the validated teacher action router receipt",
      command: commandLine("create-original-goal-teacher-action-router-handoff-queue.mjs", [
        ["--validation", "<teacher-action-router-receipt-validation.json>"],
        ["--output-dir", join(refreshDir, "teacher-action-router-handoff-queue")]
      ])
    },
    {
      label: "Run one teacher-confirmed original-goal review handoff item through the whitelist-only single-item runner",
      command: originalGoalReviewHandoffQueueItemRunnerCommand(refreshDir)
    },
    {
      label: "Build a browser command page for one teacher-confirmed original-goal review handoff item",
      command: originalGoalReviewHandoffItemCommandBuilderCommand(refreshDir)
    },
    {
      label: "Open review entrypoint health audit before trying linked teacher pages",
      command: reviewEntrypointHealthAudit.htmlPath || reviewEntrypointHealthAudit.auditPath || ""
    },
    {
      label: "Open low-token operation preflight policy before any visual capture, activation, or execution",
      command: lowTokenOperationPreflight.htmlPath || lowTokenOperationPreflight.policyPath || ""
    },
    {
      label: "Open low-token trigger budget plan before any screenshot-heavy follow-up",
      command: lowTokenTriggerBudgetPlan.htmlPath || lowTokenTriggerBudgetPlan.planPath || ""
    },
    {
      label: "Regenerate low-token trigger budget plan from latest changed log/state evidence",
      command: lowTokenTriggerBudgetPlanCommandTemplate
    },
    {
      label: "Open event-triggered low-token observation policy before any screenshot or recording",
      command: eventTriggeredObservationPolicy.htmlPath || eventTriggeredObservationPolicy.policyPath || ""
    },
    {
      label: "Regenerate event-triggered low-token observation policy from the latest trigger budget plan",
      command: eventTriggeredObservationPolicyCommandTemplate
    },
    {
      label: "Open event-triggered low-token policy receipt builder before any visual follow-up",
      command: eventTriggeredObservationPolicyReceiptBuilder.htmlPath || eventTriggeredObservationPolicyReceiptBuilder.builderPath || ""
    },
    {
      label: "Regenerate event-triggered low-token policy receipt builder from the latest policy",
      command: eventTriggeredObservationPolicyReceiptBuilderCommandTemplate
    },
    {
      label: "Validate teacher-filled event-triggered low-token observation policy receipt before any visual follow-up",
      command: eventTriggeredObservationPolicyReceiptValidationCommandTemplate
    },
    {
      label: "Open triggered visual check command builder after low-token changed evidence",
      command: triggeredVisualCheckCommandBuilder.htmlPath || triggeredVisualCheckCommandBuilder.builderPath || ""
    },
    {
      label: "Regenerate triggered visual check command builder from the latest automatic visual queue",
      command: triggeredVisualCheckCommandBuilderCommandTemplate
    },
    {
      label: "Capture one teacher-confirmed visual check from the automatic low-token visual queue",
      command: triggeredVisualCaptureCommandTemplate
    },
    {
      label: "Create a learning handoff from the captured visual check before teaching",
      command: triggeredVisualLearningHandoffCommandTemplate
    },
    {
      label: "Turn the visual learning handoff into a teacher review learning card",
      command: triggeredVisualLearningHandoffReviewCommandTemplate
    },
    {
      label: "Validate teacher receipt for the triggered visual learning card review",
      command: triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate
    },
    {
      label: "Turn the visual handoff into a voice/text numbered-target workbench",
      command: triggeredVisualVoiceControlWorkbenchCommandTemplate
    },
    ...(sourceRealLocalReadinessPackage
      ? [
          {
            label: "Open real-local all-software low-token readiness package",
            command: existsSync(sourceRealLocalReadinessReadme) ? sourceRealLocalReadinessReadme : sourceRealLocalReadinessPackage
          },
          ...(existsSync(sourceRealLocalReadinessReceipt)
            ? [
                {
                  label: "Open real-local all-software low-token readiness receipt",
                  command: sourceRealLocalReadinessReceipt
                }
              ]
            : [])
        ]
      : []),
    {
      label: "Validate a teacher-filled gap board receipt before advancing rows",
      command: gapPacket.nextValidationCommand || commandLine("validate-original-goal-gap-action-board-receipt.mjs", [["--board", gapBoard.boardPath]])
    },
    {
      label: "Open the command center for the unified teacher review page",
      command: commandCenter?.htmlPath || ""
    },
    {
      label: "Open teacher review cockpit",
      command: entryPath(directReviewEntryPoints, "teacher_review_cockpit")
    },
    {
      label: "Validate teacher-filled teacher review cockpit receipt before downstream review",
      command:
        firstNextCall(commandCenterPacket, "teacherReviewCockpitReceiptValidation")?.command ||
        commandLine("validate-goal-teacher-review-cockpit-receipt.mjs", [
          ["--cockpit", commandCenterPacket?.paths?.teacherReviewCockpit || "<goal-teacher-review-cockpit.json>"],
          ["--receipt", "<teacher-filled-goal-teacher-review-cockpit-receipt.json>"]
        ])
    },
    {
      label: "Create a manual handoff queue from the validated teacher review cockpit receipt",
      command: commandLine("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
        ["--validation", "<goal-teacher-review-cockpit-receipt-validation.json>"],
        ["--output-dir", join(refreshDir, "teacher-review-cockpit-handoff-queue")]
      ])
    },
    {
      label: "Open activation receipt builder for automatic low-token monitor confirmations",
      command: entryPath(directReviewEntryPoints, "activation_receipt_builder")
    },
    {
      label: "Open operational activation gate evidence",
      command: entryPath(directReviewEntryPoints, "operational_activation_gate")
    },
    {
      label: "Open operational activation dry-run rehearsal evidence",
      command: entryPath(directReviewEntryPoints, "operational_activation_dry_run_rehearsal")
    },
    {
      label: "Open operational registration execute gate evidence",
      command: entryPath(directReviewEntryPoints, "operational_registration_execute_gate")
    },
    {
      label: "Open operational post-activation witness evidence",
      command: entryPath(directReviewEntryPoints, "operational_post_activation_witness")
    },
    {
      label: "Open post-activation witness receipt builder after teacher-executed registration",
      command: entryPath(directReviewEntryPoints, "operational_post_activation_witness_receipt_builder")
    },
    {
      label: "Validate teacher-filled post-activation witness receipt before rerunning witness",
      command: operationalPostActivationWitnessReceiptValidationCommandTemplate
    },
    {
      label: "Validate teacher-filled activation receipt before any registration dry run",
      command: activationReceiptValidationCommand(commandCenterPacket, goal)
    },
    {
      label: "Open coverage rollout receipt builder for all-software low-token coverage batches",
      command:
        entryPath(directReviewEntryPoints, "coverage_rollout_receipt_builder") ||
        (sourceCoverageRolloutReceiptBuilder && existsSync(sourceCoverageRolloutReceiptBuilder)
          ? readJson(sourceCoverageRolloutReceiptBuilder)?.paths?.html || ""
          : "")
    },
    {
      label: "Open coverage enrollment follow-up receipt builder for remaining low-token evidence gaps",
      command: entryPath(directReviewEntryPoints, "coverage_enrollment_follow_up_receipt_builder")
    },
    {
      label: "Open coverage enrollment follow-up receipt template",
      command: entryPath(directReviewEntryPoints, "coverage_enrollment_follow_up_receipt_template")
    },
    {
      label: "Open coverage enrollment ledger for per-software low-token enrollment status",
      command: entryPath(directReviewEntryPoints, "coverage_enrollment_ledger")
    },
    {
      label: "Open coverage enrollment follow-up plan before any batch action",
      command: entryPath(directReviewEntryPoints, "coverage_enrollment_follow_up_plan")
    },
    {
      label: "Open coverage enrollment follow-up dry-run batch evidence",
      command: entryPath(directReviewEntryPoints, "coverage_enrollment_follow_up_batch")
    },
    {
      label: "Open coverage enrollment follow-up reconciliation evidence",
      command: entryPath(directReviewEntryPoints, "coverage_enrollment_follow_up_reconciliation")
    },
    {
      label: "Review coverage enrollment receipt builder packet before any teacher-reviewed batch command",
      command: sourceCoverageEnrollmentFollowUpReceiptBuilder || ""
    },
    {
      label: "Validate teacher-filled coverage enrollment follow-up receipt before any reviewed batch",
      command: coverageEnrollmentFollowUpReceiptValidationCommand(sourceCoverageEnrollmentFollowUpPlan, goal)
    },
    {
      label: "Create a manual handoff queue from validated coverage enrollment follow-up receipt",
      command: coverageEnrollmentFollowUpHandoffQueueCommand(refreshDir)
    },
    {
      label: "Validate teacher-filled coverage rollout receipt before any rollout supervisor",
      command: coverageRolloutReceiptValidationCommand(commandCenterPacket, goal)
    },
    {
      label: "Create a manual handoff queue from validated coverage rollout receipt",
      command: coverageRolloutHandoffQueueCommand(refreshDir)
    },
    {
      label: "Run one teacher-confirmed coverage rollout handoff item through the structured single-item runner",
      command: coverageRolloutHandoffQueueItemRunnerCommand(refreshDir)
    },
    {
      label: "Create teacher run-review receipt builder after one coverage rollout handoff item run",
      command: coverageRolloutHandoffItemRunReviewReceiptBuilderCommand(refreshDir)
    },
    {
      label: "Validate teacher run-review receipt before coverage rollout convergence audit",
      command: coverageRolloutHandoffItemRunReviewReceiptValidationCommand(refreshDir)
    },
    {
      label: "Open execution follow-up receipt builder when a follow-up batch is present",
      command: commandCenterPacket?.paths?.executionFollowUpReceiptBuilderHtml || ""
    },
    {
      label: "Open execution gap review cockpit before execution dry-run or medium-runtime reuse",
      command: executionGapReviewCockpitHtmlPath || executionGapReviewCockpitPath || ""
    },
    {
      label: "Open action logic source contract package before execution dry-run or medium-runtime reuse",
      command: actionLogicSourceContractPackageHtmlPath || actionLogicSourceContractPackagePath || ""
    },
    {
      label: "Validate teacher-filled execution follow-up receipt before any dry-run runner",
      command: executionFollowUpReceiptValidationCommand(commandCenterPacket, goal)
    },
    {
      label: "Create a manual handoff queue from validated execution follow-up receipt",
      command: executionFollowUpHandoffQueueCommand(refreshDir)
    },
    {
      label: "Run one teacher-reviewed execution follow-up handoff item through the dry-run pilot runner",
      command: executionFollowUpHandoffQueueItemRunnerCommand(refreshDir)
    },
    {
      label: "Create teacher receipt builder for one dry-run execution handoff item result",
      command: executionFollowUpHandoffItemReceiptBuilderCommand(refreshDir)
    },
    {
      label: "Validate teacher-filled dry-run execution handoff item receipt before any approval gate",
      command: executionFollowUpHandoffItemReceiptValidationCommand(refreshDir)
    },
    {
      label: "Prepare execution approval gate from matched dry-run validation without executing software",
      command: executionApprovalGatePrepRunnerCommand(refreshDir)
    },
    {
      label: "Run one ready execution approval gate through the approved-gate runner",
      command: executionApprovedGateRunnerCommand(refreshDir)
    },
    {
      label: "Run one ready operational registration execute gate through the approved registration runner",
      command: operationalRegistrationApprovedRunnerCommand(refreshDir)
    },
    {
      label: "Trigger one post-registration reviewed low-token output witness and audit the result",
      command: operationalPostRegistrationOutputWitnessRunnerCommand(refreshDir)
    },
    {
      label: "Open transparent sketch overlay for 2D perspective 3D teacher demonstration",
      command: entryPath(directReviewEntryPoints, "transparent_sketch_overlay")
    },
    {
      label: "Validate teacher-exported transparent sketch overlay packet before spatial intent receipt",
      command: transparentSketchOverlayPacketValidationCommandTemplate
    },
    {
      label: "Open spatial intent evidence request before claiming 2D perspective 3D understanding",
      command: spatialIntentEvidenceRequestHtmlPath
    },
    {
      label: "Open transparent sketch 2D perspective 3D implementation audit",
      command: sourceSketchDemonstrationImplementationAudit
    },
    {
      label: "Create spatial intent formal evidence entrypoint as demo-only teacher export handoff",
      command: spatialIntentFormalEvidenceEntrypointCommandTemplate
    },
    {
      label: "Open universal detail logic learning kit before generating visually similar CAD, engineering, or software output",
      command: parametricDrawingLogicKitHtmlPath || parametricDrawingLogicKitPath
    },
    {
      label: "Open universal detail logic teacher receipt template",
      command: parametricDrawingLogicReceiptTemplatePath
    },
    {
      label: "Validate teacher-filled universal detail logic receipt before compiling a rule package",
      command: parametricDrawingLogicReceiptValidationCommandTemplate
    },
    {
      label: "Compile teacher-reviewed universal detail logic into a disabled rule package after receipt validation",
      command: parametricDrawingLogicRulePackageCommandTemplate
    },
    {
      label: "Apply reviewed universal detail logic rule package to new data in dry-run mode",
      command: universalDetailLogicApplicationDryRunCommandTemplate
    },
    {
      label: "Create existing-tool SVG and JSON preview from reviewed universal detail logic dry-run",
      command: universalDetailLogicExistingToolPreviewCommandTemplate
    },
    {
      label: "Open spatial intent evidence receipt builder after teacher exports the overlay packet",
      command: spatialIntentEvidenceReceiptBuilder?.htmlPath || ""
    },
    {
      label: "Fill spatial intent evidence receipt after teacher exports the overlay packet",
      command: spatialIntentEvidenceReceiptTemplatePath
    },
    {
      label: "Validate teacher-filled spatial intent receipt before spatial target confirmation",
      command: spatialIntentEvidenceReceiptValidationCommandTemplate
    },
    {
      label: "After teacher exports transparent sketch packet, replace the placeholder and create spatial target confirmation",
      command: spatialTargetConfirmationCommandTemplate
    },
    {
      label: "Create spatial route pilot-selection receipt before approval-prep reuse",
      command: spatialRoutePilotSelectionReceiptCommandTemplate
    },
    {
      label: "Validate teacher-filled spatial route pilot-selection receipt before approval-prep handoff",
      command: spatialRoutePilotSelectionReceiptValidationCommandTemplate
    },
    {
      label: "Create transparent sketch 2D perspective 3D depth demonstration rehearsal",
      command: transparentSketchDepthDemonstrationRehearsalCommandTemplate
    },
    {
      label: "Open transparent sketch depth rehearsal review receipt builder",
      command:
        transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.html ||
        transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.builder ||
        ""
    },
    {
      label: "Fill transparent sketch depth rehearsal review receipt template",
      command: transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.receiptTemplate || ""
    },
    {
      label: "Validate teacher-filled transparent sketch depth rehearsal review receipt",
      command: transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate
    },
    {
      label: "Open voice/text engineering control workbench",
      command: entryPath(directReviewEntryPoints, "engineering_voice_control_workbench")
    },
    {
      label: "Open non-expert engineering voice/text control capability summary",
      command: nonExpertVoiceControlCapabilityHtmlPath
    },
    {
      label: "Open numbered target confirmation packet for the voice/text command",
      command: sourcePreflightTargetConfirmation
    },
    {
      label: "After teacher chooses exactly one number, replace __SELECTED_NUMBER__ and run the confirmation bridge",
      command: numberedTargetConfirmCommandTemplate
    }
  ],
  blockedClaims: [
    "claim_original_goal_complete_from_current_status_refresh",
    "register_recurring_monitor_from_current_status_refresh",
    "launch_automatic_runner_from_current_status_refresh",
    "execute_target_software_from_current_status_refresh",
    "write_memory_from_current_status_refresh",
    "claim_universal_native_execution_from_current_status_refresh"
  ],
  locks
};

writeFileSync(nonExpertVoiceControlCapabilityPath, `${JSON.stringify(nonExpertVoiceControlCapability, null, 2)}\n`, "utf8");
writeNonExpertVoiceControlCapabilityHtml(nonExpertVoiceControlCapabilityHtmlPath, nonExpertVoiceControlCapability);
writeSpatialIntentEvidenceRequestHtml(spatialIntentEvidenceRequestHtmlPath, spatialIntentEvidenceRequest);
writeFileSync(spatialIntentEvidenceReceiptTemplatePath, `${JSON.stringify(spatialIntentEvidenceReceiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const spatialToSoftwareExecutionGatePackage = runNodeScript(
  "create-spatial-to-software-execution-gate-package.mjs",
  [
    "--refresh",
    refreshPath,
    "--spatial-validation",
    sourceSpatialIntentEvidenceReceiptValidation || "",
    "--depth-rehearsal-validation",
    sourceTransparentSketchDepthRehearsalReviewReceiptValidation || "",
    "--rehearsal",
    transparentSketchDepthDemonstrationRehearsal?.rehearsalPath || "",
    "--target-confirmation",
    sourcePreflightTargetConfirmation || "",
    "--route-bridge",
    sourceSpatialSoftwareExecutionRouteBridge || "",
    "--rollback-point",
    rollbackPoint.manifestPath,
    "--output-dir",
    join(refreshDir, "spatial-to-software-execution-gate-package")
  ]
);
refresh.paths.spatialToSoftwareExecutionGatePackage = spatialToSoftwareExecutionGatePackage.gatePath || "";
refresh.paths.spatialToSoftwareExecutionGatePackageHtml = spatialToSoftwareExecutionGatePackage.htmlPath || "";
refresh.paths.spatialToSoftwareExecutionGatePackageReadme = spatialToSoftwareExecutionGatePackage.readmePath || "";
refresh.refreshedEvidence.spatialToSoftwareExecutionGatePackagePresent = Boolean(
  refresh.paths.spatialToSoftwareExecutionGatePackage
);
refresh.refreshedEvidence.spatialToSoftwareExecutionGatePackageStatus =
  spatialToSoftwareExecutionGatePackage.status || "";
refresh.refreshedEvidence.spatialToSoftwareExecutionGateReadyForDryRunRouteBridge =
  spatialToSoftwareExecutionGatePackage.readyForDryRunRouteBridge === true;
refresh.refreshedEvidence.spatialToSoftwareExecutionGateFirstBlocker =
  spatialToSoftwareExecutionGatePackage.firstBlocker || null;
refresh.refreshedEvidence.spatialToSoftwareExecutionGatePackageBlocksExecution =
  spatialToSoftwareExecutionGatePackage.status === "blocked_before_spatial_software_execution" &&
  spatialToSoftwareExecutionGatePackage.locks?.softwareActionsExecuted === false &&
  spatialToSoftwareExecutionGatePackage.locks?.packageDoesNotExecuteSoftware === true;
directReviewEntryPoints.push({
  id: "spatial_to_software_execution_gate_package",
  label: "Spatial to software execution gate package",
  path: refresh.paths.spatialToSoftwareExecutionGatePackageHtml,
  url: ""
});
refresh.nextCommands.push({
  label: "Open spatial-to-software execution gate package",
  command: refresh.paths.spatialToSoftwareExecutionGatePackageHtml
});
const spatialToSoftwareFirstBlockerHandoff = runNodeScript(
  "create-spatial-to-software-first-blocker-handoff.mjs",
  [
    "--gate",
    refresh.paths.spatialToSoftwareExecutionGatePackage,
    "--output-dir",
    join(refreshDir, "spatial-to-software-first-blocker-handoff")
  ]
);
refresh.paths.spatialToSoftwareFirstBlockerHandoff = spatialToSoftwareFirstBlockerHandoff.handoffPath || "";
refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml = spatialToSoftwareFirstBlockerHandoff.htmlPath || "";
refresh.paths.spatialToSoftwareFirstBlockerHandoffReadme = spatialToSoftwareFirstBlockerHandoff.readmePath || "";
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerHandoffPresent = Boolean(
  refresh.paths.spatialToSoftwareFirstBlockerHandoff
);
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerHandoffStatus =
  spatialToSoftwareFirstBlockerHandoff.status || "";
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerFirstTeacherAction =
  spatialToSoftwareFirstBlockerHandoff.firstTeacherAction || null;
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerHandoffBlocksExecution =
  spatialToSoftwareFirstBlockerHandoff.locks?.handoffDoesNotExecuteSoftware === true &&
  spatialToSoftwareFirstBlockerHandoff.locks?.softwareActionsExecuted === false &&
  spatialToSoftwareFirstBlockerHandoff.locks?.goalComplete === false;
const spatialToSoftwareFirstBlockerNextGateHandoff = spatialToSoftwareFirstBlockerHandoff.nextGateHandoff || {};
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerNextGateHandoffFormat =
  spatialToSoftwareFirstBlockerNextGateHandoff.format || "";
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerObjectiveRequirementId =
  spatialToSoftwareFirstBlockerNextGateHandoff.objectiveRequirementId || "";
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerCompletionBlockerLane =
  spatialToSoftwareFirstBlockerNextGateHandoff.completionBlockerLane || "";
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerNextGate =
  spatialToSoftwareFirstBlockerNextGateHandoff.nextGate || "";
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerReturnToCompletionBlockerMatrixAfterNextGate =
  spatialToSoftwareFirstBlockerNextGateHandoff.returnToCompletionBlockerMatrixAfterNextGate === true;
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerRequiredEvidenceBeforeManualUse =
  spatialToSoftwareFirstBlockerNextGateHandoff.requiredEvidenceBeforeManualUse || [];
refresh.refreshedEvidence.spatialToSoftwareFirstBlockerNextGateHandoffBlocksExecution =
  spatialToSoftwareFirstBlockerNextGateHandoff.locks?.handoffDoesNotExecuteSoftware === true &&
  spatialToSoftwareFirstBlockerNextGateHandoff.locks?.softwareActionsExecuted === false &&
  spatialToSoftwareFirstBlockerNextGateHandoff.locks?.goalComplete === false;
const spatialFirstBlockerOverlayResolverMcpTool = "resolve_spatial_first_blocker_overlay_packet";
const spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker =
  spatialToSoftwareFirstBlockerHandoff.firstBlocker?.id === "teacher_exported_overlay_validation";
const spatialFirstBlockerOverlayResolverMcpToolCommandTemplate = [
  `MCP advanced tool: ${spatialFirstBlockerOverlayResolverMcpTool}`,
  `request=${refresh.paths.spatialIntentEvidenceRequest || "<spatial-intent-evidence-request.json>"}`,
  "overlayPacket=<teacher-exported-transparent-sketch-packet.json>",
  "reviewReceipt=<optional-teacher-reviewed-spatial-intent-receipt.json>",
  "detailLogicReceipt=<optional-teacher-reviewed-detail-logic-receipt.json>"
].join(" ");
refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverMcpTool =
  spatialFirstBlockerOverlayResolverMcpTool;
refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverAvailable = true;
refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverReviewOnly = true;
refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverExecutesSoftware = false;
refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker =
  spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker;
refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverCommandTemplate =
  spatialFirstBlockerOverlayResolverMcpToolCommandTemplate;
directReviewEntryPoints.push({
  id: "spatial_to_software_first_blocker_handoff",
  label: "Spatial to software first blocker handoff",
  path: refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml,
  url: ""
});
directReviewEntryPoints.push({
  id: "spatial_first_blocker_overlay_resolver_mcp_tool",
  label: "Spatial first blocker overlay resolver MCP tool",
  path: refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml,
  url: "",
  command: spatialFirstBlockerOverlayResolverMcpToolCommandTemplate,
  reviewOnly: true,
  executesSoftware: false,
  appliesToCurrentBlocker: spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker
});
refresh.nextCommands.push({
  label: "Open spatial-to-software first blocker handoff",
  command: refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml
});
refresh.nextCommands.push({
  label: "Resolve teacher-exported overlay first blocker with MCP tool",
  command: spatialFirstBlockerOverlayResolverMcpToolCommandTemplate
});
const currentGoalSpatialTeacherConsole = runNodeScript(
  "create-current-goal-spatial-teacher-console.mjs",
  [
    "--goal",
    `Shortest teacher path for transparent overlay export, 2D perspective 3D spatial evidence, and review-only execution gate preparation. ${goal}`,
    "--output-dir",
    join(refreshDir, "current-goal-spatial-teacher-console")
  ]
);
refresh.paths.currentGoalSpatialTeacherConsole = currentGoalSpatialTeacherConsole.consolePath || "";
refresh.paths.currentGoalSpatialTeacherConsoleHtml = currentGoalSpatialTeacherConsole.htmlPath || "";
refresh.paths.currentGoalSpatialTeacherConsoleReadme = currentGoalSpatialTeacherConsole.readmePath || "";
refresh.refreshedEvidence.currentGoalSpatialTeacherConsoleStatus =
  currentGoalSpatialTeacherConsole.status || "";
refresh.refreshedEvidence.currentGoalSpatialTeacherConsoleReady =
  currentGoalSpatialTeacherConsole.status ===
    "spatial_teacher_console_ready_for_teacher_receipts_not_execution" &&
  Boolean(currentGoalSpatialTeacherConsole.htmlPath);
refresh.refreshedEvidence.currentGoalSpatialTeacherConsoleCapabilityState =
  currentGoalSpatialTeacherConsole.capabilityState || {};
directReviewEntryPoints.push({
  id: "current_goal_spatial_teacher_console",
  label: "Current-goal spatial teacher console",
  path: refresh.paths.currentGoalSpatialTeacherConsoleHtml,
  url: ""
});
refresh.nextCommands.push({
  label: "Open current-goal spatial teacher console for transparent overlay first blocker",
  command: refresh.paths.currentGoalSpatialTeacherConsoleHtml
});
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const originalGoalLowTokenCoverageEvidenceDossier = runNodeScript(
  "create-original-goal-low-token-coverage-evidence-dossier.mjs",
  [
    "--goal",
    goal,
    "--status-refresh",
    refreshPath,
    "--output-dir",
    join(refreshDir, "low-token-coverage-evidence-dossier")
  ]
);
const originalGoalLowTokenCoverageDossierReceiptBuilder = runNodeScript(
  "create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--dossier",
    originalGoalLowTokenCoverageEvidenceDossier.dossierPath || "",
    "--output-dir",
    join(refreshDir, "low-token-coverage-dossier-receipt-builder")
  ]
);
const originalGoalLowTokenMetadataGatePreflight = runNodeScript(
  "create-original-goal-low-token-metadata-gate-preflight.mjs",
  [
    "--goal",
    goal,
    "--dossier",
    originalGoalLowTokenCoverageEvidenceDossier.dossierPath || "",
    "--output-dir",
    join(refreshDir, "low-token-metadata-gate-preflight")
  ]
);
const originalGoalLowTokenMetadataGatePreflightReceiptBuilder = runNodeScript(
  "create-original-goal-low-token-metadata-gate-preflight-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--preflight",
    originalGoalLowTokenMetadataGatePreflight.preflightPath || "",
    "--output-dir",
    join(refreshDir, "low-token-metadata-gate-preflight-receipt-builder")
  ]
);
const originalGoalLowTokenCoverageWaitingRowCockpit = runNodeScript(
  "create-original-goal-low-token-coverage-waiting-row-cockpit.mjs",
  [
    "--goal",
    goal,
    "--dossier",
    originalGoalLowTokenCoverageEvidenceDossier.dossierPath || "",
    "--metadata-gate-preflight",
    originalGoalLowTokenMetadataGatePreflight.preflightPath || "",
    "--log-source-ledger",
    sourceLogSourceDiscoveryLedger || "",
    "--output-dir",
    join(refreshDir, "low-token-coverage-waiting-row-cockpit")
  ]
);
const originalGoalLowTokenReadyMetadataGateShortlist = runNodeScript(
  "create-original-goal-low-token-ready-metadata-gate-shortlist.mjs",
  [
    "--goal",
    goal,
    "--cockpit",
    originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath || "",
    "--metadata-gate-receipt-template",
    originalGoalLowTokenMetadataGatePreflightReceiptBuilder.receiptTemplatePath || "",
    "--metadata-gate-validation-command",
    originalGoalLowTokenMetadataGatePreflightReceiptBuilder.nextValidationCommand ||
      originalGoalLowTokenMetadataGatePreflightReceiptValidationCommand(refreshDir),
    "--output-dir",
    join(refreshDir, "low-token-ready-metadata-gate-shortlist")
  ]
);
const originalGoalLowTokenBlockedWaitingRowEvidencePlan = runNodeScript(
  "create-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs",
  [
    "--goal",
    goal,
    "--cockpit",
    originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath || "",
    "--output-dir",
    join(refreshDir, "low-token-blocked-waiting-row-evidence-plan")
  ]
);
const originalGoalLowTokenFallbackRouteEvidencePack = runNodeScript(
  "create-original-goal-low-token-fallback-route-evidence-pack.mjs",
  [
    "--goal",
    goal,
    "--plan",
    originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath || "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>",
    "--output-dir",
    join(refreshDir, "low-token-fallback-route-evidence-pack")
  ]
);
const originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder = runNodeScript(
  "create-original-goal-low-token-fallback-route-evidence-pack-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--pack",
    originalGoalLowTokenFallbackRouteEvidencePack.packPath ||
      "<original-goal-low-token-fallback-route-evidence-pack.json>",
    "--output-dir",
    join(refreshDir, "low-token-fallback-route-evidence-pack-receipt-builder")
  ]
);
const originalGoalLowTokenFallbackRouteShortlist = runNodeScript(
  "create-original-goal-low-token-fallback-route-shortlist.mjs",
  [
    "--goal",
    goal,
    "--pack",
    originalGoalLowTokenFallbackRouteEvidencePack.packPath ||
      "<original-goal-low-token-fallback-route-evidence-pack.json>",
    "--output-dir",
    join(refreshDir, "low-token-fallback-route-shortlist")
  ]
);
const originalGoalLowTokenFallbackRouteShortlistBatchReview = runNodeScript(
  "create-original-goal-low-token-fallback-route-shortlist-batch-review.mjs",
  [
    "--goal",
    goal,
    "--shortlist",
    originalGoalLowTokenFallbackRouteShortlist.shortlistPath ||
      "<original-goal-low-token-fallback-route-shortlist.json>",
    "--output-dir",
    join(refreshDir, "low-token-fallback-route-shortlist-batch-review")
  ]
);
const originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder = runNodeScript(
  "create-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--plan",
    originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath || "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>",
    "--output-dir",
    join(refreshDir, "low-token-blocked-waiting-row-evidence-plan-receipt-builder")
  ]
);
refresh.paths.originalGoalLowTokenCoverageEvidenceDossier =
  originalGoalLowTokenCoverageEvidenceDossier.dossierPath || "";
refresh.paths.originalGoalLowTokenCoverageEvidenceDossierHtml =
  originalGoalLowTokenCoverageEvidenceDossier.htmlPath || "";
refresh.paths.originalGoalLowTokenCoverageEvidenceDossierReadme =
  originalGoalLowTokenCoverageEvidenceDossier.readmePath || "";
refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder =
  originalGoalLowTokenCoverageDossierReceiptBuilder.builderPath || "";
refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml =
  originalGoalLowTokenCoverageDossierReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderReadme =
  originalGoalLowTokenCoverageDossierReceiptBuilder.readmePath || "";
refresh.paths.originalGoalLowTokenCoverageDossierReceiptTemplate =
  originalGoalLowTokenCoverageDossierReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate =
  originalGoalLowTokenCoverageDossierReceiptBuilder.nextValidationCommand ||
  originalGoalLowTokenCoverageDossierReceiptValidationCommand(refreshDir);
refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidation =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidation || "";
refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationReadme =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidation
    ? sourceOriginalGoalLowTokenCoverageDossierReceiptValidation.replace(
        /original-goal-low-token-coverage-dossier-receipt-validation\.json$/,
        "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_DOSSIER_RECEIPT_VALIDATION_START_HERE.md"
      )
    : "";
refresh.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate =
  originalGoalLowTokenCoverageCompletionGateCommand(
    refreshDir,
    sourceLogSourceDiscoveryLedger || "<all-software-log-source-discovery-ledger.json>"
  );
refresh.paths.originalGoalLowTokenCoverageCompletionGate =
  sourceOriginalGoalLowTokenCoverageCompletionGate || "";
refresh.paths.originalGoalLowTokenCoverageCompletionGateReadme =
  sourceOriginalGoalLowTokenCoverageCompletionGate
    ? sourceOriginalGoalLowTokenCoverageCompletionGate.replace(
        /original-goal-low-token-coverage-completion-gate\.json$/,
        "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_COMPLETION_GATE_START_HERE.md"
      )
    : "";
refresh.paths.originalGoalLowTokenMetadataGatePreflight =
  originalGoalLowTokenMetadataGatePreflight.preflightPath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightHtml =
  originalGoalLowTokenMetadataGatePreflight.htmlPath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReadme =
  originalGoalLowTokenMetadataGatePreflight.readmePath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.builderPath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReadme =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.readmePath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptTemplate =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.nextValidationCommand ||
  originalGoalLowTokenMetadataGatePreflightReceiptValidationCommand(refreshDir);
refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate =
  originalGoalLowTokenMetadataGateValidationCommandRunnerCommand(refreshDir);
refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit =
  originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath || "";
refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml =
  originalGoalLowTokenCoverageWaitingRowCockpit.htmlPath || "";
refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReadme =
  originalGoalLowTokenCoverageWaitingRowCockpit.readmePath || "";
refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate =
  originalGoalLowTokenCoverageWaitingRowCockpit.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate =
  originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommand(
    refreshDir,
    originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"
  );
refresh.paths.originalGoalLowTokenReadyMetadataGateShortlist =
  originalGoalLowTokenReadyMetadataGateShortlist.shortlistPath || "";
refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml =
  originalGoalLowTokenReadyMetadataGateShortlist.htmlPath || "";
refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistReadme =
  originalGoalLowTokenReadyMetadataGateShortlist.readmePath || "";
refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt =
  originalGoalLowTokenReadyMetadataGateShortlist.draftReceiptPath || "";
refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate =
  originalGoalLowTokenReadyMetadataGateShortlist.nextSafeCommand?.draftCommandLine || "";
refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistReceiptValidationCommandTemplate =
  originalGoalLowTokenReadyMetadataGateShortlist.nextSafeCommand?.commandLine || "";
refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate =
  commandLine("create-original-goal-low-token-metadata-gate-preflight-receipt-draft.mjs", [
    ["--waiting-row-validation", "<passed-low-token-waiting-row-cockpit-receipt-validation.json>"],
    [
      "--preflight",
      originalGoalLowTokenMetadataGatePreflight.preflightPath ||
        "<original-goal-low-token-metadata-gate-preflight.json>"
    ],
    [
      "--receipt-template",
      originalGoalLowTokenMetadataGatePreflightReceiptBuilder.receiptTemplatePath ||
        "<teacher-low-token-metadata-gate-preflight-receipt-template.json>"
    ],
    ["--output-dir", join(refreshDir, "low-token-metadata-gate-preflight-receipt-draft")]
  ]);
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.htmlPath || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReadme =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.readmePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePack =
  originalGoalLowTokenFallbackRouteEvidencePack.packPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml =
  originalGoalLowTokenFallbackRouteEvidencePack.htmlPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReadme =
  originalGoalLowTokenFallbackRouteEvidencePack.readmePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.builderPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReadme =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.readmePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.nextValidationCommand || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlist =
  originalGoalLowTokenFallbackRouteShortlist.shortlistPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistHtml =
  originalGoalLowTokenFallbackRouteShortlist.htmlPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistReadme =
  originalGoalLowTokenFallbackRouteShortlist.readmePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistReceiptTemplate =
  originalGoalLowTokenFallbackRouteShortlist.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReview =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.reviewPackPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReviewHtml =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.htmlPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReviewReadme =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.readmePath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReviewDefaultReceipt =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.defaultReceiptPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReviewDraftReceipt =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.batchDraftReceiptPath || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReviewDefaultValidationCommandTemplate =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.defaultValidationCommand || "";
refresh.paths.originalGoalLowTokenFallbackRouteShortlistBatchReviewDraftValidationCommandTemplate =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.draftValidationCommand || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate =
  commandLine("create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs", [
    ["--validation", "<ready-low-token-fallback-route-evidence-pack-receipt-validation.json>"],
    [
      "--plan",
      originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath ||
        "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>"
    ],
    ["--output-dir", join(refreshDir, "low-token-fallback-route-evidence-plan-receipt-draft")]
  ]);
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraft =
  latestPartialFallbackRouteEvidencePlanDraft || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftReceipt =
  latestPartialFallbackRouteEvidencePlanDraftReceipt || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftValidation =
  latestPartialFallbackRouteEvidencePlanDraftValidation || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCommandTemplate =
  commandLine("create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs", [
    ["--validation", "<partial-low-token-fallback-route-evidence-pack-receipt-validation.json>"],
    [
      "--plan",
      originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath ||
        "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>"
    ],
    ["--allow-partial-ready", "true"],
    ["--output-dir", join(refreshDir, "low-token-fallback-route-evidence-plan-partial-receipt-draft")]
  ]);
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPack =
  latestLowTokenCompactEvidenceRequestPack || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackHtml =
  latestLowTokenCompactEvidenceRequestPackPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackReadme =
  latestLowTokenCompactEvidenceRequestPackPacket.paths?.readme || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackReceiptTemplate =
  latestLowTokenCompactEvidenceRequestPackReceipt || latestLowTokenCompactEvidenceRequestPackPacket.paths?.defaultReceipt || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackCommandTemplate =
  latestLowTokenCompactEvidenceRequestPackPacket.paths?.commandTemplate || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackValidationCommandTemplate =
  latestLowTokenCompactEvidenceRequestPackPacket.paths?.validationCommandTemplate || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackBuilderCommandTemplate =
  commandLine("create-original-goal-low-token-compact-evidence-request-pack.mjs", [
    [
      "--partial-draft",
      latestPartialFallbackRouteEvidencePlanDraft ||
        "<original-goal-low-token-fallback-route-evidence-plan-partial-receipt-draft.json>"
    ],
    ["--output-dir", join(refreshDir, "low-token-compact-evidence-request-pack")]
  ]);
refresh.paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilder =
  latestLowTokenCompactEvidenceRequestReceiptBuilder || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderHtml =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderReadme =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.paths?.readme || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestReceiptTemplate =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.paths?.receiptTemplate || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderCommandTemplate =
  commandLine("create-original-goal-low-token-compact-evidence-request-receipt-builder.mjs", [
    ["--request-pack", latestLowTokenCompactEvidenceRequestPack || "<original-goal-low-token-compact-evidence-request-pack.json>"],
    ["--output-dir", join(refreshDir, "low-token-compact-evidence-request-receipt-builder")]
  ]);
refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad =
  latestLowTokenCompactEvidenceTeacherLaunchpad || "";
refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadReadme =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.paths?.readme || "";
refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadValidationCommandTemplate =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.paths?.validationCommandTemplate || "";
refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunCommandTemplate =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.paths?.runCommandAfterValidationTemplate || "";
refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadCommandTemplate =
  commandLine("create-original-goal-low-token-compact-evidence-teacher-launchpad.mjs", [
    ["--status-refresh", refreshPath || "<original-goal-current-status-refresh.json>"],
    ["--output-dir", join(refreshDir, "low-token-compact-evidence-teacher-launchpad")]
  ]);
refresh.paths.originalGoalLowTokenCompactEvidenceRequestValidation =
  latestLowTokenCompactEvidenceRequestValidation || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRequestValidationHtml =
  latestLowTokenCompactEvidenceRequestValidationPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidation =
  latestLowTokenFallbackRouteEvidencePackReceiptValidation || "";
refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationHtml =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPack =
  latestLowTokenFallbackRouteManualReviewPack || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackHtml =
  latestLowTokenFallbackRouteManualReviewPackPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackReadme =
  latestLowTokenFallbackRouteManualReviewPackPacket.paths?.readme || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchTemplate =
  latestLowTokenFallbackRouteManualReviewPackPacket.paths?.patchTemplate || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate =
  commandLine("create-original-goal-low-token-fallback-route-manual-review-pack.mjs", [
    [
      "--validation",
      latestLowTokenFallbackRouteEvidencePackReceiptValidation ||
        "<low-token-fallback-route-evidence-pack-receipt-validation.json>"
    ],
    ["--pack", refresh.paths.originalGoalLowTokenFallbackRouteEvidencePack || "<low-token-fallback-route-evidence-pack.json>"],
    ["--output-dir", join(refreshDir, "low-token-fallback-route-manual-review-pack")]
  ]);
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidation =
  latestLowTokenFallbackRouteManualReviewPatchValidation || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationHtml =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationReadme =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.paths?.readme || "";
refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate =
  commandLine("validate-original-goal-low-token-fallback-route-manual-review-patch.mjs", [
    [
      "--pack",
      latestLowTokenFallbackRouteManualReviewPack ||
        "<low-token-fallback-route-manual-review-pack.json>"
    ],
    [
      "--patch",
      latestLowTokenFallbackRouteManualReviewPackPacket.paths?.patchTemplate ||
        "<teacher-filled-manual-route-review-patch.json>"
    ],
    ["--output-dir", join(refreshDir, "low-token-fallback-route-manual-review-patch-validation")]
  ]);
refresh.paths.originalGoalLowTokenCompactEvidenceRun =
  latestLowTokenCompactEvidenceRun || "";
refresh.paths.originalGoalLowTokenCompactEvidenceRunReceipt =
  latestLowTokenCompactEvidenceRunPacket.paths?.receipt || "";
refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoff =
  latestLowTokenCompactEvidenceLearningHandoff || "";
refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoffHtml =
  latestLowTokenCompactEvidenceLearningHandoffPacket.paths?.html || "";
refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoffReceiptTemplate =
  latestLowTokenCompactEvidenceLearningHandoffPacket.paths?.reviewReceiptTemplate || "";
refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoffCommandTemplate =
  commandLine("create-original-goal-low-token-compact-evidence-learning-handoff.mjs", [
    ["--run", latestLowTokenCompactEvidenceRun || "<original-goal-low-token-compact-evidence-run.json>"],
    ["--output-dir", join(refreshDir, "low-token-compact-evidence-learning-handoff")]
  ]);
refresh.paths.originalGoalLowTokenCompactEvidenceLearningReviewValidation =
  latestLowTokenCompactEvidenceLearningReviewValidation || "";
refresh.paths.originalGoalLowTokenCompactEvidenceLearningReviewValidationCommandTemplate =
  commandLine("validate-original-goal-low-token-compact-evidence-learning-review-receipt.mjs", [
    ["--handoff", latestLowTokenCompactEvidenceLearningHandoff || "<original-goal-low-token-compact-evidence-learning-handoff.json>"],
    [
      "--receipt",
      latestLowTokenCompactEvidenceLearningHandoffPacket.paths?.reviewReceiptTemplate ||
        "<teacher-filled-compact-evidence-learning-event-review-receipt.json>"
    ],
    ["--rollback-point", rollbackPoint.rollbackDir || "<retained-rollback-point-dir>"],
    ["--output-dir", join(refreshDir, "low-token-compact-evidence-learning-review-validation")]
  ]);
refresh.paths.originalGoalLowTokenCompactLearningDisabledRuleDraft =
  latestLowTokenCompactLearningDisabledRuleDraft || "";
refresh.paths.originalGoalLowTokenCompactLearningDisabledRuleDraftCompiledPackage =
  latestLowTokenCompactLearningDisabledRuleDraftPacket.compiledRulePackagePath || "";
refresh.paths.originalGoalLowTokenCompactLearningDisabledRuleDraftCommandTemplate =
  commandLine("create-original-goal-low-token-compact-learning-disabled-rule-draft.mjs", [
    [
      "--validation",
      latestLowTokenCompactEvidenceLearningReviewValidation ||
        "<ready-original-goal-low-token-compact-evidence-learning-review-receipt-validation.json>"
    ],
    ["--rollback-point", rollbackPoint.rollbackDir || "<retained-rollback-point-dir>"],
    ["--teacher-reviewed-learning-events", "true"],
    ["--output-dir", join(refreshDir, "low-token-compact-learning-disabled-rule-draft")]
  ]);
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.builderPath || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReadme =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.readmePath || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.nextValidationCommand || "";
refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate =
  originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommand(
    refreshDir,
    "<ready-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.json>",
    originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath ||
      "<original-goal-low-token-coverage-waiting-row-cockpit.json>"
  );
refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate =
  originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommand(
    refreshDir,
    "<original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.json>"
  );
refresh.discoveredEvidence.originalGoalLowTokenCoverageEvidenceDossier =
  originalGoalLowTokenCoverageEvidenceDossier.dossierPath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageEvidenceDossierHtml =
  originalGoalLowTokenCoverageEvidenceDossier.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageEvidenceDossierReadme =
  originalGoalLowTokenCoverageEvidenceDossier.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptBuilder =
  originalGoalLowTokenCoverageDossierReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptBuilderHtml =
  originalGoalLowTokenCoverageDossierReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptBuilderReadme =
  originalGoalLowTokenCoverageDossierReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptTemplate =
  originalGoalLowTokenCoverageDossierReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate =
  refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptValidation =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidation || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptValidationStatus =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.status || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageDossierReceiptValidationDecision =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.validationDecision || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageCompletionGateCommandTemplate =
  refresh.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageCompletionGate =
  sourceOriginalGoalLowTokenCoverageCompletionGate || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageCompletionGateStatus =
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.status || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageCompletionGateBlockers =
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.blockers || [];
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflight =
  originalGoalLowTokenMetadataGatePreflight.preflightPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightHtml =
  originalGoalLowTokenMetadataGatePreflight.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReadme =
  originalGoalLowTokenMetadataGatePreflight.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightCounts =
  originalGoalLowTokenMetadataGatePreflight.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilder =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReadme =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptTemplate =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate =
  refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate =
  refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilderCounts =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenCoverageWaitingRowCockpit =
  originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageWaitingRowCockpitHtml =
  originalGoalLowTokenCoverageWaitingRowCockpit.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReadme =
  originalGoalLowTokenCoverageWaitingRowCockpit.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate =
  originalGoalLowTokenCoverageWaitingRowCockpit.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate =
  refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageWaitingRowCockpitCounts =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenReadyMetadataGateShortlist =
  originalGoalLowTokenReadyMetadataGateShortlist.shortlistPath || "";
refresh.discoveredEvidence.originalGoalLowTokenReadyMetadataGateShortlistHtml =
  originalGoalLowTokenReadyMetadataGateShortlist.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenReadyMetadataGateShortlistReadme =
  originalGoalLowTokenReadyMetadataGateShortlist.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt =
  originalGoalLowTokenReadyMetadataGateShortlist.draftReceiptPath || "";
refresh.discoveredEvidence.originalGoalLowTokenReadyMetadataGateShortlistCounts =
  originalGoalLowTokenReadyMetadataGateShortlist.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate =
  refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate =
  refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlan =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReadme =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanCounts =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePack =
  originalGoalLowTokenFallbackRouteEvidencePack.packPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackHtml =
  originalGoalLowTokenFallbackRouteEvidencePack.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReadme =
  originalGoalLowTokenFallbackRouteEvidencePack.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackCounts =
  originalGoalLowTokenFallbackRouteEvidencePack.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReadme =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.nextValidationCommand || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlist =
  originalGoalLowTokenFallbackRouteShortlist.shortlistPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistHtml =
  originalGoalLowTokenFallbackRouteShortlist.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistReadme =
  originalGoalLowTokenFallbackRouteShortlist.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistReceiptTemplate =
  originalGoalLowTokenFallbackRouteShortlist.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistCounts =
  originalGoalLowTokenFallbackRouteShortlist.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReview =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.reviewPackPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewHtml =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewReadme =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDefaultReceipt =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.defaultReceiptPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDraftReceipt =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.batchDraftReceiptPath || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewCounts =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDefaultValidationCommandTemplate =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.defaultValidationCommand || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDraftValidationCommandTemplate =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.draftValidationCommand || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate =
  refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraft =
  latestPartialFallbackRouteEvidencePlanDraft || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftReceipt =
  latestPartialFallbackRouteEvidencePlanDraftReceipt || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftValidation =
  latestPartialFallbackRouteEvidencePlanDraftValidation || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCommandTemplate =
  refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCounts =
  latestPartialFallbackRouteEvidencePlanDraftPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftValidationCounts =
  latestPartialFallbackRouteEvidencePlanDraftValidationPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPack =
  latestLowTokenCompactEvidenceRequestPack || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackHtml =
  latestLowTokenCompactEvidenceRequestPackPacket.paths?.html || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackReadme =
  latestLowTokenCompactEvidenceRequestPackPacket.paths?.readme || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackReceiptTemplate =
  refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackReceiptTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackCommandTemplate =
  refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackValidationCommandTemplate =
  refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackValidationCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackBuilderCommandTemplate =
  refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackBuilderCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestPackCounts =
  latestLowTokenCompactEvidenceRequestPackPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestValidation =
  latestLowTokenCompactEvidenceRequestValidation || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestValidationHtml =
  latestLowTokenCompactEvidenceRequestValidationPacket.paths?.html || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRequestValidationCounts =
  latestLowTokenCompactEvidenceRequestValidationPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidation =
  latestLowTokenFallbackRouteEvidencePackReceiptValidation || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationHtml =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.paths?.html || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCounts =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPack =
  latestLowTokenFallbackRouteManualReviewPack || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPackHtml =
  latestLowTokenFallbackRouteManualReviewPackPacket.paths?.html || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPackReadme =
  latestLowTokenFallbackRouteManualReviewPackPacket.paths?.readme || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchTemplate =
  latestLowTokenFallbackRouteManualReviewPackPacket.paths?.patchTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate =
  refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPackCounts =
  latestLowTokenFallbackRouteManualReviewPackPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPackStatus =
  latestLowTokenFallbackRouteManualReviewPackPacket.status || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidation =
  latestLowTokenFallbackRouteManualReviewPatchValidation || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationHtml =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.paths?.html || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationReadme =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.paths?.readme || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate =
  refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCounts =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationStatus =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.status || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRun =
  latestLowTokenCompactEvidenceRun || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRunReceipt =
  latestLowTokenCompactEvidenceRunPacket.paths?.receipt || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceRunCounts =
  latestLowTokenCompactEvidenceRunPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceLearningHandoff =
  latestLowTokenCompactEvidenceLearningHandoff || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffHtml =
  latestLowTokenCompactEvidenceLearningHandoffPacket.paths?.html || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffReceiptTemplate =
  latestLowTokenCompactEvidenceLearningHandoffPacket.paths?.reviewReceiptTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffCommandTemplate =
  refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoffCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffCounts =
  latestLowTokenCompactEvidenceLearningHandoffPacket.counts || {};
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRows =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.rowCount || 0;
refresh.discoveredEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderCandidateRoutes =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.candidateRouteCount || 0;
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReadme =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.nextValidationCommand || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate =
  refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate =
  refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || "";
refresh.discoveredEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderRows =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.actionRowCount || 0;
refresh.discoveredEvidence.originalGoalLowTokenCoverageEvidenceDossierStatus =
  originalGoalLowTokenCoverageEvidenceDossier.status || "";
refresh.discoveredEvidence.originalGoalLowTokenCoverageEvidenceDossierCounts =
  originalGoalLowTokenCoverageEvidenceDossier.counts || {};
refresh.refreshedEvidence.originalGoalLowTokenCoverageEvidenceDossierReady =
  Boolean(originalGoalLowTokenCoverageEvidenceDossier.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptBuilderReady =
  Boolean(originalGoalLowTokenCoverageDossierReceiptBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationCommandReady =
  String(refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationReady =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.format ===
    "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1" &&
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.locks?.goalComplete === false &&
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.locks?.validationDoesNotReadLogs === true &&
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.locks?.validationDoesNotExecuteTargetSoftware === true &&
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.locks?.validationDoesNotWriteMemory === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationStatus =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationDecision =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.validationDecision || "";
refresh.refreshedEvidence.originalGoalLowTokenCoverageDossierReceiptValidationReadyFollowUpRows =
  sourceOriginalGoalLowTokenCoverageDossierReceiptValidationPacket?.readyFollowUpRowCount || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateCommandReady =
  String(refresh.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate || "").includes(
    "validate-original-goal-low-token-coverage-completion-gate.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateReady =
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.format ===
    "transparent_ai_original_goal_low_token_coverage_completion_gate_v1" &&
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.locks?.goalComplete === false &&
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.locks?.gateDoesNotReadLogs === true &&
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.locks?.gateDoesNotExecuteTargetSoftware === true &&
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.locks?.gateDoesNotWriteMemory === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateStatus =
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateCoverageReadyForFinalTeacherReview =
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.coverageEvidenceReadyForFinalTeacherReview === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateCanClaimOriginalGoalComplete =
  sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.canClaimOriginalGoalComplete === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageCompletionGateBlockerCount =
  Array.isArray(sourceOriginalGoalLowTokenCoverageCompletionGatePacket?.blockers)
    ? sourceOriginalGoalLowTokenCoverageCompletionGatePacket.blockers.length
    : 0;
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReady =
  Boolean(originalGoalLowTokenMetadataGatePreflight.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightStatus =
  originalGoalLowTokenMetadataGatePreflight.status || "";
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReadyRows =
  originalGoalLowTokenMetadataGatePreflight.counts?.readyMetadataGateRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightBlockedRows =
  originalGoalLowTokenMetadataGatePreflight.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReady =
  Boolean(originalGoalLowTokenMetadataGatePreflightReceiptBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandReady =
  String(refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandReady =
  String(refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || "").includes(
    "run-original-goal-low-token-metadata-gate-validation-command.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || "").includes(
    "--allow-validation-command-runner"
  ) &&
  String(refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || "").includes(
    "--rollback-point"
  );
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReadyRows =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.counts?.readyRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptBuilderBlockedRows =
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReady =
  Boolean(originalGoalLowTokenCoverageWaitingRowCockpit.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRows =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.totalRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReadyRows =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.readyForTeacherConfirmedMetadataGateRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitBlockedRows =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReviewOnly =
  originalGoalLowTokenCoverageWaitingRowCockpit.locks?.reviewOnly === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitUsesSafeTextRendering =
  originalGoalLowTokenCoverageWaitingRowCockpit.locks?.cockpitUsesSafeTextRendering === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitDoesNotReadLogs =
  originalGoalLowTokenCoverageWaitingRowCockpit.locks?.cockpitDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitDoesNotRunMetadataGate =
  originalGoalLowTokenCoverageWaitingRowCockpit.locks?.cockpitDoesNotRunMetadataGate === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithLogSourceLedgerRoute =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.rowsWithLogSourceLedgerRoute || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithInheritedProofFallbackRoute =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.rowsWithInheritedCoverageProofFallbackRoute || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithMetadataGatePreflight =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.rowsWithMetadataGatePreflight || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithCoverageContractReadyForMetadataGate =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.rowsWithCoverageContractReadyForMetadataGate || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithoutCurrentLogSourceLedgerMatch =
  originalGoalLowTokenCoverageWaitingRowCockpit.counts?.rowsWithoutCurrentLogSourceLedgerMatch || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitScopeMismatchLikely =
  originalGoalLowTokenCoverageWaitingRowCockpit.scopeDiagnostics?.likelyCoverageLedgerScopeMismatch === true;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitScopeDiagnostic =
  originalGoalLowTokenCoverageWaitingRowCockpit.scopeDiagnostics?.explanation || "";
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandReady =
  String(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || "").includes(
    "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"
  );
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistReady =
  Boolean(originalGoalLowTokenReadyMetadataGateShortlist.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistStatus =
  originalGoalLowTokenReadyMetadataGateShortlist.status || "";
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistReadyRows =
  originalGoalLowTokenReadyMetadataGateShortlist.counts?.readyRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistBlockedRows =
  originalGoalLowTokenReadyMetadataGateShortlist.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftRowsStillRequireTeacherFlags =
  originalGoalLowTokenReadyMetadataGateShortlist.counts?.draftRowsStillRequiringTeacherEvidenceFlags || 0;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistRowsThatWouldValidateWithoutTeacherEdits =
  originalGoalLowTokenReadyMetadataGateShortlist.counts?.rowsThatWouldValidateWithoutTeacherEdits || 0;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistReviewOnly =
  originalGoalLowTokenReadyMetadataGateShortlist.locks?.reviewOnly === true;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDoesNotRunMetadataGate =
  originalGoalLowTokenReadyMetadataGateShortlist.locks?.shortlistDoesNotRunMetadataGate === true;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDoesNotReadLogs =
  originalGoalLowTokenReadyMetadataGateShortlist.locks?.shortlistDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDoesNotExecuteTargetSoftware =
  originalGoalLowTokenReadyMetadataGateShortlist.locks?.shortlistDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftIsNotTeacherConfirmation =
  originalGoalLowTokenReadyMetadataGateShortlist.locks?.draftReceiptIsNotTeacherConfirmation === true;
refresh.refreshedEvidence.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandReady =
  String(refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || "").includes(
    "teacher-draft-low-token-waiting-row-cockpit-receipt.json"
  );
refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandReady =
  String(refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || "").includes(
    "create-original-goal-low-token-metadata-gate-preflight-receipt-draft.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || "").includes(
    "<passed-low-token-waiting-row-cockpit-receipt-validation.json>"
  ) &&
  String(refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || "").includes(
    "original-goal-low-token-metadata-gate-preflight"
  );
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReady =
  Boolean(originalGoalLowTokenBlockedWaitingRowEvidencePlan.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanRows =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanRowsNeedingLogSourceRoute =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.counts?.rowsNeedingLogSourceRoute || 0;
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanDoesNotReadLogs =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.locks?.planDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanDoesNotRunMetadataGate =
  originalGoalLowTokenBlockedWaitingRowEvidencePlan.locks?.planDoesNotRunMetadataGate === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReady =
  Boolean(originalGoalLowTokenFallbackRouteEvidencePack.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackRows =
  originalGoalLowTokenFallbackRouteEvidencePack.counts?.rows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackCandidateRoutes =
  originalGoalLowTokenFallbackRouteEvidencePack.counts?.candidateRoutes || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackRowsRequiringTeacherRouteSelection =
  originalGoalLowTokenFallbackRouteEvidencePack.counts?.rowsRequiringTeacherRouteSelection || 0;
refresh.refreshedEvidence.originalGoalLowTokenRouteGapCoveredByFallbackReview =
  (originalGoalLowTokenBlockedWaitingRowEvidencePlan.counts?.rowsNeedingLogSourceRoute || 0) > 0 &&
  (originalGoalLowTokenFallbackRouteEvidencePack.counts?.rowsRequiringTeacherRouteSelection || 0) >=
    (originalGoalLowTokenBlockedWaitingRowEvidencePlan.counts?.rowsNeedingLogSourceRoute || 0) &&
  (originalGoalLowTokenFallbackRouteEvidencePack.counts?.candidateRoutes || 0) > 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackDoesNotReadLogs =
  originalGoalLowTokenFallbackRouteEvidencePack.locks?.packDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackDoesNotCaptureScreenshots =
  originalGoalLowTokenFallbackRouteEvidencePack.locks?.packDoesNotCaptureScreenshots === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackDoesNotExecuteTargetSoftware =
  originalGoalLowTokenFallbackRouteEvidencePack.locks?.packDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackDoesNotClaimCoverage =
  originalGoalLowTokenFallbackRouteEvidencePack.locks?.packDoesNotClaimAllSoftwareCoverage === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReady =
  Boolean(originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplateReady =
  Boolean(originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.receiptTemplatePath);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandReady =
  String(originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.nextValidationCommand || "").includes(
    "validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs"
  ) &&
  String(originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.nextValidationCommand || "").includes(
    "<teacher-filled-low-token-fallback-route-evidence-pack-receipt.json>"
  );
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRows =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.rowCount || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderCandidateRoutes =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.candidateRouteCount || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderDoesNotReadLogs =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.locks?.builderDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderDoesNotExecuteTargetSoftware =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.locks?.builderDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRouteSelectionIsNotCoverage =
  originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.locks?.routeSelectionIsNotCoverage === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistReady =
  Boolean(originalGoalLowTokenFallbackRouteShortlist.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistRows =
  originalGoalLowTokenFallbackRouteShortlist.counts?.rows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistRecommendedRoutes =
  originalGoalLowTokenFallbackRouteShortlist.counts?.recommendedRoutes || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistDoesNotReadLogs =
  originalGoalLowTokenFallbackRouteShortlist.locks?.shortlistDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistDoesNotExecuteTargetSoftware =
  originalGoalLowTokenFallbackRouteShortlist.locks?.shortlistDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewReady =
  Boolean(originalGoalLowTokenFallbackRouteShortlistBatchReview.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewMetadataOnlyRows =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.counts?.metadataOnlyBatchRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewRowsStillNeedingOneByOneReview =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.counts?.rowsStillNeedingOneByOneReview || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDraftSelectedRows =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.counts?.draftSelectedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDoesNotReadLogs =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.locks?.batchReviewDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDoesNotExecuteTargetSoftware =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.locks?.batchReviewDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewRouteSelectionIsNotCoverage =
  originalGoalLowTokenFallbackRouteShortlistBatchReview.locks?.routeSelectionIsNotCoverage === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDefaultValidationCommandReady =
  String(originalGoalLowTokenFallbackRouteShortlistBatchReview.defaultValidationCommand || "").includes(
    "validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteShortlistBatchReviewDraftValidationCommandReady =
  String(originalGoalLowTokenFallbackRouteShortlistBatchReview.draftValidationCommand || "").includes(
    "validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandReady =
  String(refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || "").includes(
    "create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || "").includes(
    "<ready-low-token-fallback-route-evidence-pack-receipt-validation.json>"
  ) &&
  String(refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || "").includes(
    "original-goal-low-token-blocked-waiting-row-evidence-plan"
  );
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftReady =
  Boolean(latestPartialFallbackRouteEvidencePlanDraft);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCopiedRouteRows =
  latestPartialFallbackRouteEvidencePlanDraftPacket.counts?.copiedRouteRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCompactEvidenceStillNeeded =
  latestPartialFallbackRouteEvidencePlanDraftPacket.counts?.compactEvidenceStillNeeded || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftRowsStillNeedingTeacherReview =
  latestPartialFallbackRouteEvidencePlanDraftPacket.counts?.rowsStillNeedingTeacherReview || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftDoesNotReadLogs =
  latestPartialFallbackRouteEvidencePlanDraftPacket.locks?.draftDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftDoesNotExecuteTargetSoftware =
  latestPartialFallbackRouteEvidencePlanDraftPacket.locks?.draftDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftValidationStatus =
  latestPartialFallbackRouteEvidencePlanDraftValidationPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftValidationReadyRows =
  latestPartialFallbackRouteEvidencePlanDraftValidationPacket.counts?.readyRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftValidationInvalidRows =
  latestPartialFallbackRouteEvidencePlanDraftValidationPacket.counts?.invalidRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCommandReady =
  String(refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanPartialReceiptDraftCommandTemplate || "").includes(
    "--allow-partial-ready"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackReady =
  Boolean(latestLowTokenCompactEvidenceRequestPack);
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackEligibleRows =
  latestLowTokenCompactEvidenceRequestPackPacket.counts?.eligibleRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackBlockedRows =
  latestLowTokenCompactEvidenceRequestPackPacket.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackStatus =
  latestLowTokenCompactEvidenceRequestPackPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackDoesNotReadLogs =
  latestLowTokenCompactEvidenceRequestPackPacket.locks?.requestDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackDoesNotRunWatchCycle =
  latestLowTokenCompactEvidenceRequestPackPacket.locks?.requestDoesNotRunWatchCycle === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackDoesNotExecuteTargetSoftware =
  latestLowTokenCompactEvidenceRequestPackPacket.locks?.requestDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackCommandReady =
  String(latestLowTokenCompactEvidenceRequestPackPacket.commandTemplate || "").includes(
    "run-original-goal-low-token-compact-evidence-request.mjs"
  ) ||
  String(refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackCommandTemplate || "").includes(
    "run-original-goal-low-token-compact-evidence-request.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackValidationCommandReady =
  String(latestLowTokenCompactEvidenceRequestPackPacket.validationCommandTemplate || "").includes(
    "validate-original-goal-low-token-compact-evidence-request-receipt.mjs"
  ) ||
  String(refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-compact-evidence-request-receipt.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestPackBuilderCommandReady =
  String(refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackBuilderCommandTemplate || "").includes(
    "create-original-goal-low-token-compact-evidence-request-pack.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderReady =
  Boolean(latestLowTokenCompactEvidenceRequestReceiptBuilder);
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderStatus =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderRows =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.counts?.reviewRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderEligibleRows =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.counts?.eligibleRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderBlockedRows =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderDoesNotReadLogs =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.locks?.builderDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderDoesNotRunMetadataCollection =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.locks?.builderDoesNotRunMetadataCollection === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderDoesNotExecuteTargetSoftware =
  latestLowTokenCompactEvidenceRequestReceiptBuilderPacket.locks?.builderDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderCommandReady =
  String(refresh.paths.originalGoalLowTokenCompactEvidenceRequestReceiptBuilderCommandTemplate || "").includes(
    "create-original-goal-low-token-compact-evidence-request-receipt-builder.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadReady =
  Boolean(latestLowTokenCompactEvidenceTeacherLaunchpad);
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadStatus =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRows =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.counts?.reviewRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadEligibleRows =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.counts?.eligibleRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadBlockedRows =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadDoesNotReadLogs =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.locks?.launchpadDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadDoesNotRunMetadataCollection =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.locks?.launchpadDoesNotRunMetadataCollection === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadDoesNotExecuteTargetSoftware =
  latestLowTokenCompactEvidenceTeacherLaunchpadPacket.locks?.launchpadDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRollback =
  String(refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunCommandTemplate || "").includes(
    "rollback-point-created"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRetainedRollbackManifestContract =
  Boolean(latestLowTokenCompactEvidenceTeacherLaunchpadPacket.paths?.rollbackPointManifest) &&
  String(refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunCommandTemplate || "").includes(
    "--rollback-point"
  ) &&
  compactEvidenceRunnerRequiresRetainedRollbackManifest();
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadCommandReady =
  String(refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadCommandTemplate || "").includes(
    "create-original-goal-low-token-compact-evidence-teacher-launchpad.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestValidationStatus =
  latestLowTokenCompactEvidenceRequestValidationPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestValidationReadyRows =
  latestLowTokenCompactEvidenceRequestValidationPacket.counts?.readyRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestValidationInvalidRows =
  latestLowTokenCompactEvidenceRequestValidationPacket.counts?.invalidRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestValidationDoesNotReadLogs =
  latestLowTokenCompactEvidenceRequestValidationPacket.locks?.validationDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRequestValidationDoesNotExecuteTargetSoftware =
  latestLowTokenCompactEvidenceRequestValidationPacket.locks?.validationDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationReady =
  Boolean(latestLowTokenFallbackRouteEvidencePackReceiptValidation);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationReadyRows =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.counts?.readyRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationInvalidRows =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.counts?.invalidRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationDoesNotReadLogs =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.locks?.validationDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationDoesNotExecuteTargetSoftware =
  latestLowTokenFallbackRouteEvidencePackReceiptValidationPacket.locks?.validationDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackReady =
  Boolean(latestLowTokenFallbackRouteManualReviewPack);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackManualRows =
  latestLowTokenFallbackRouteManualReviewPackPacket.counts?.manualRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackRemoteControlRows =
  latestLowTokenFallbackRouteManualReviewPackPacket.counts?.remoteControlRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackChatRows =
  latestLowTokenFallbackRouteManualReviewPackPacket.counts?.chatRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackDoesNotReadLogs =
  latestLowTokenFallbackRouteManualReviewPackPacket.locks?.packDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackDoesNotExecuteTargetSoftware =
  latestLowTokenFallbackRouteManualReviewPackPacket.locks?.packDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchTemplateReady =
  Boolean(latestLowTokenFallbackRouteManualReviewPackPacket.paths?.patchTemplate);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPackCommandReady =
  String(refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate || "").includes(
    "create-original-goal-low-token-fallback-route-manual-review-pack.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate || "").includes(
    "fallback-route-evidence-pack-receipt-validation"
  );
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationReady =
  Boolean(latestLowTokenFallbackRouteManualReviewPatchValidation);
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationStatus =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationReadyRows =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.counts?.readyRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationBlockedRows =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.counts?.blockedRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationDoesNotReadLogs =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.locks?.validationDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationDoesNotExecuteTargetSoftware =
  latestLowTokenFallbackRouteManualReviewPatchValidationPacket.locks?.validationDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandReady =
  String(refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-fallback-route-manual-review-patch.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || "").includes(
    "--patch"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRunReady =
  latestLowTokenCompactEvidenceRunPacket.status === "metadata_only_evidence_collected_waiting_for_teacher_review";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRunEvidenceRows =
  latestLowTokenCompactEvidenceRunPacket.counts?.evidenceRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRunDoesNotReadLogs =
  latestLowTokenCompactEvidenceRunPacket.locks?.logContentsRead === false;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceRunDoesNotExecuteTargetSoftware =
  latestLowTokenCompactEvidenceRunPacket.locks?.targetSoftwareCommandsExecuted === false;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffReady =
  latestLowTokenCompactEvidenceLearningHandoffPacket.status === "waiting_for_teacher_learning_event_review";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffLearningEvents =
  latestLowTokenCompactEvidenceLearningHandoffPacket.counts?.compactLearningEvents || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffReviewRows =
  latestLowTokenCompactEvidenceLearningHandoffPacket.counts?.reviewRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffDoesNotReadLogs =
  latestLowTokenCompactEvidenceLearningHandoffPacket.locks?.handoffDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffDoesNotExecuteTargetSoftware =
  latestLowTokenCompactEvidenceLearningHandoffPacket.locks?.handoffDoesNotExecuteTargetSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningHandoffCommandReady =
  String(refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoffCommandTemplate || "").includes(
    "create-original-goal-low-token-compact-evidence-learning-handoff.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationStatus =
  latestLowTokenCompactEvidenceLearningReviewValidationPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationReadyRuleDraftRows =
  latestLowTokenCompactEvidenceLearningReviewValidationPacket.counts?.readyRuleDraftRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationHighReasoningRepairRows =
  latestLowTokenCompactEvidenceLearningReviewValidationPacket.counts?.highReasoningRepairRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationReadyForDisabledRuleDraft =
  latestLowTokenCompactEvidenceLearningReviewValidationPacket.readyForDisabledRuleDraft === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationDoesNotReadLogs =
  latestLowTokenCompactEvidenceLearningReviewValidationPacket.locks?.validationDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationDoesNotExecuteSoftware =
  latestLowTokenCompactEvidenceLearningReviewValidationPacket.locks?.validationDoesNotExecuteSoftware === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceLearningReviewValidationCommandReady =
  String(refresh.paths.originalGoalLowTokenCompactEvidenceLearningReviewValidationCommandTemplate || "").includes(
    "validate-original-goal-low-token-compact-evidence-learning-review-receipt.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftStatus =
  latestLowTokenCompactLearningDisabledRuleDraftPacket.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftDisabledRuleCount =
  latestLowTokenCompactLearningDisabledRuleDraftPacket.disabledRuleCount || 0;
refresh.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftCompiled =
  latestLowTokenCompactLearningDisabledRuleDraftPacket.locks?.disabledRulePackageCompiled === true;
refresh.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftRulesStayDisabled =
  latestLowTokenCompactLearningDisabledRuleDraftPacket.locks?.ruleEnabled === false &&
  latestLowTokenCompactLearningDisabledRuleDraftPacket.locks?.activeRulePackageCompiled === false;
refresh.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftDoesNotExecuteSoftware =
  latestLowTokenCompactLearningDisabledRuleDraftPacket.locks?.softwareActionsExecuted === false;
refresh.refreshedEvidence.originalGoalLowTokenCompactLearningDisabledRuleDraftCommandReady =
  String(refresh.paths.originalGoalLowTokenCompactLearningDisabledRuleDraftCommandTemplate || "").includes(
    "create-original-goal-low-token-compact-learning-disabled-rule-draft.mjs"
  );
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReady =
  Boolean(originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplateReady =
  Boolean(originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.receiptTemplatePath);
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandReady =
  String(originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.nextValidationCommand || "").includes(
    "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs"
  ) &&
  String(originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.nextValidationCommand || "").includes(
    "<teacher-filled-low-token-blocked-waiting-row-evidence-plan-receipt.json>"
  );
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderDoesNotReadLogs =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.locks?.builderDoesNotReadLogs === true;
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderDoesNotRunMetadataGate =
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.locks?.builderDoesNotRunMetadataGate === true;
refresh.refreshedEvidence.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandReady =
  String(refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || "").includes(
    "create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || "").includes(
    "<ready-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.json>"
  ) &&
  String(refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || "").includes(
    "original-goal-low-token-coverage-waiting-row-cockpit"
  );
refresh.refreshedEvidence.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandReady =
  String(refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || "").includes(
    "run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs"
  ) &&
  String(refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || "").includes(
    "<true-after-teacher-review>"
  ) &&
  String(refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || "").includes(
    "<true-with-retained-rollback-point>"
  );
refresh.refreshedEvidence.originalGoalLowTokenCoverageEvidenceDossierStatus =
  originalGoalLowTokenCoverageEvidenceDossier.status || "";
refresh.refreshedEvidence.originalGoalLowTokenCoverageLedgerRows =
  originalGoalLowTokenCoverageEvidenceDossier.counts?.ledgerRows || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageWaitingRows =
  originalGoalLowTokenCoverageEvidenceDossier.counts?.waitingForLowTokenEvidence || 0;
refresh.refreshedEvidence.originalGoalLowTokenCoverageNextReviewRows =
  originalGoalLowTokenCoverageEvidenceDossier.counts?.nextReviewRows || 0;
directReviewEntryPoints.push({
  id: "original_goal_low_token_coverage_evidence_dossier",
  label: "Original goal low-token coverage evidence dossier",
  path:
    originalGoalLowTokenCoverageEvidenceDossier.htmlPath ||
    originalGoalLowTokenCoverageEvidenceDossier.dossierPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_coverage_dossier_receipt_builder",
  label: "Original goal low-token coverage dossier receipt builder",
  path:
    originalGoalLowTokenCoverageDossierReceiptBuilder.htmlPath ||
    originalGoalLowTokenCoverageDossierReceiptBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_metadata_gate_preflight",
  label: "Original goal low-token metadata gate preflight",
  path:
    originalGoalLowTokenMetadataGatePreflight.htmlPath ||
    originalGoalLowTokenMetadataGatePreflight.preflightPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_metadata_gate_preflight_receipt_builder",
  label: "Original goal low-token metadata gate preflight receipt builder",
  path:
    originalGoalLowTokenMetadataGatePreflightReceiptBuilder.htmlPath ||
    originalGoalLowTokenMetadataGatePreflightReceiptBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_coverage_waiting_row_cockpit",
  label: "Original goal low-token coverage waiting row cockpit",
  path:
    originalGoalLowTokenCoverageWaitingRowCockpit.htmlPath ||
    originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_coverage_waiting_row_cockpit_receipt_template",
  label: "Original goal low-token coverage waiting row cockpit receipt template",
  path: originalGoalLowTokenCoverageWaitingRowCockpit.receiptTemplatePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_ready_metadata_gate_shortlist",
  label: "Original goal low-token ready metadata gate shortlist",
  path:
    originalGoalLowTokenReadyMetadataGateShortlist.htmlPath ||
    originalGoalLowTokenReadyMetadataGateShortlist.shortlistPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_ready_metadata_gate_shortlist_draft_receipt",
  label: "Original goal low-token ready metadata gate draft receipt",
  path: originalGoalLowTokenReadyMetadataGateShortlist.draftReceiptPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_metadata_gate_preflight_receipt_draft_command",
  label: "Original goal low-token metadata gate preflight receipt draft command",
  path: refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_blocked_waiting_row_evidence_plan",
  label: "Original goal low-token blocked waiting row evidence plan",
  path:
    originalGoalLowTokenBlockedWaitingRowEvidencePlan.htmlPath ||
    originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_evidence_plan_partial_receipt_draft",
  label: "Original goal low-token fallback route partial evidence-plan receipt draft",
  path: latestPartialFallbackRouteEvidencePlanDraft || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_evidence_plan_partial_receipt_draft_validation",
  label: "Original goal low-token fallback route partial evidence-plan receipt validation",
  path: latestPartialFallbackRouteEvidencePlanDraftValidation || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_request_pack",
  label: "Original goal low-token compact evidence request pack",
  path:
    latestLowTokenCompactEvidenceRequestPackPacket.paths?.html ||
    latestLowTokenCompactEvidenceRequestPack ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_teacher_launchpad",
  label: "Original goal low-token compact evidence teacher launchpad",
  path:
    latestLowTokenCompactEvidenceTeacherLaunchpadPacket.paths?.html ||
    latestLowTokenCompactEvidenceTeacherLaunchpad ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_request_receipt_template",
  label: "Original goal low-token compact evidence request receipt template",
  path: refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackReceiptTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_request_command_template",
  label: "Original goal low-token compact evidence request command template",
  path: refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_request_validation_command_template",
  label: "Original goal low-token compact evidence request validation command template",
  path: refresh.paths.originalGoalLowTokenCompactEvidenceRequestPackValidationCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_request_validation",
  label: "Original goal low-token compact evidence request validation",
  path:
    latestLowTokenCompactEvidenceRequestValidationPacket.paths?.html ||
    latestLowTokenCompactEvidenceRequestValidation ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_manual_review_pack",
  label: "Original goal low-token fallback route manual review pack",
  path:
    latestLowTokenFallbackRouteManualReviewPackPacket.paths?.html ||
    latestLowTokenFallbackRouteManualReviewPack ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_manual_review_patch_template",
  label: "Original goal low-token fallback route manual review patch template",
  path: refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_manual_review_command_template",
  label: "Original goal low-token fallback route manual review command template",
  path: refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_manual_review_patch_validation_command_template",
  label: "Original goal low-token fallback route manual review patch validation command template",
  path: refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_manual_review_patch_validation",
  label: "Original goal low-token fallback route manual review patch validation",
  path:
    latestLowTokenFallbackRouteManualReviewPatchValidationPacket.paths?.html ||
    latestLowTokenFallbackRouteManualReviewPatchValidation ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_run",
  label: "Original goal low-token compact evidence run",
  path: latestLowTokenCompactEvidenceRun || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_learning_handoff",
  label: "Original goal low-token compact evidence learning handoff",
  path:
    latestLowTokenCompactEvidenceLearningHandoffPacket.paths?.html ||
    latestLowTokenCompactEvidenceLearningHandoff ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_learning_handoff_receipt_template",
  label: "Original goal low-token compact evidence learning event review receipt template",
  path: refresh.paths.originalGoalLowTokenCompactEvidenceLearningHandoffReceiptTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_learning_review_validation_command_template",
  label: "Original goal low-token compact evidence learning review validation command template",
  path: refresh.paths.originalGoalLowTokenCompactEvidenceLearningReviewValidationCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_evidence_learning_review_validation",
  label: "Original goal low-token compact evidence learning review validation",
  path: refresh.paths.originalGoalLowTokenCompactEvidenceLearningReviewValidation || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_learning_disabled_rule_draft_command_template",
  label: "Original goal low-token compact learning disabled rule draft command template",
  path: refresh.paths.originalGoalLowTokenCompactLearningDisabledRuleDraftCommandTemplate || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_compact_learning_disabled_rule_draft",
  label: "Original goal low-token compact learning disabled rule draft",
  path: refresh.paths.originalGoalLowTokenCompactLearningDisabledRuleDraft || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_evidence_pack",
  label: "Original goal low-token fallback route evidence pack",
  path:
    originalGoalLowTokenFallbackRouteEvidencePack.htmlPath ||
    originalGoalLowTokenFallbackRouteEvidencePack.packPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_evidence_pack_receipt_builder",
  label: "Original goal low-token fallback route evidence pack receipt builder",
  path:
    originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.htmlPath ||
    originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_shortlist",
  label: "Original goal low-token fallback route shortlist",
  path:
    originalGoalLowTokenFallbackRouteShortlist.htmlPath ||
    originalGoalLowTokenFallbackRouteShortlist.shortlistPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_shortlist_batch_review",
  label: "Original goal low-token fallback route shortlist batch review",
  path:
    originalGoalLowTokenFallbackRouteShortlistBatchReview.htmlPath ||
    originalGoalLowTokenFallbackRouteShortlistBatchReview.reviewPackPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_shortlist_batch_review_draft_receipt",
  label: "Original goal low-token fallback route metadata-only batch draft receipt",
  path: originalGoalLowTokenFallbackRouteShortlistBatchReview.batchDraftReceiptPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_fallback_route_evidence_pack_receipt_template",
  label: "Original goal low-token fallback route evidence pack receipt template",
  path: originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.receiptTemplatePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_builder",
  label: "Original goal low-token blocked waiting row evidence plan receipt builder",
  path:
    originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.htmlPath ||
    originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_template",
  label: "Original goal low-token blocked waiting row evidence plan receipt template",
  path: originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.receiptTemplatePath || "",
  url: ""
});
refresh.nextCommands.splice(4, 0, {
  label: "Open RAG teacher source intake queue before building the knowledge corpus",
  command: ragResearchIntakeQueue.readmePath || ragResearchIntakeQueue.queuePath || ""
});
refresh.nextCommands.splice(5, 0, {
  label: "Open RAG teacher source intake receipt builder",
  command: ragResearchIntakeReceiptBuilder.readmePath || ragResearchIntakeReceiptBuilder.builderPath || ""
});
refresh.nextCommands.splice(6, 0, {
  label: "Validate teacher-filled RAG source intake receipt before any local corpus ingest",
  command: ragResearchIntakeReceiptValidationCommandTemplate
});
refresh.nextCommands.splice(7, 0, {
  label: "Create confirmed RAG source registry only from validated teacher source receipt",
  command: ragConfirmedSourceRegistryCommandTemplate
});
refresh.nextCommands.splice(8, 0, {
  label: "Inspect confirmed local RAG ingest runner template before any teacher-approved ingest",
  command: ragResearchIntakeReceiptBuilder.readmePath || ragResearchIntakeQueue.readmePath || ""
});
refresh.nextCommands.splice(2, 0, {
  label: "Open original-goal low-token coverage evidence dossier",
  command:
    originalGoalLowTokenCoverageEvidenceDossier.htmlPath ||
    originalGoalLowTokenCoverageEvidenceDossier.dossierPath ||
    ""
});
refresh.nextCommands.splice(3, 0, {
  label: "Generate teacher receipt for original-goal low-token coverage dossier",
  command:
    originalGoalLowTokenCoverageDossierReceiptBuilder.htmlPath ||
    originalGoalLowTokenCoverageDossierReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.splice(4, 0, {
  label: "Open original-goal low-token coverage waiting row cockpit",
  command:
    originalGoalLowTokenCoverageWaitingRowCockpit.htmlPath ||
    originalGoalLowTokenCoverageWaitingRowCockpit.cockpitPath ||
    ""
});
refresh.nextCommands.splice(5, 0, {
  label: "Open ready metadata-gate shortlist for low-token waiting rows",
  command:
    originalGoalLowTokenReadyMetadataGateShortlist.htmlPath ||
    originalGoalLowTokenReadyMetadataGateShortlist.shortlistPath ||
    ""
});
refresh.nextCommands.splice(6, 0, {
  label: "Edit ready metadata-gate draft receipt only after teacher review",
  command: originalGoalLowTokenReadyMetadataGateShortlist.draftReceiptPath || ""
});
refresh.nextCommands.splice(7, 0, {
  label: "Validate edited ready metadata-gate draft receipt",
  command: refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || ""
});
refresh.nextCommands.splice(8, 0, {
  label: "Build metadata-gate preflight receipt draft from passed waiting-row validation",
  command: refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate || ""
});
refresh.nextCommands.splice(9, 0, {
  label: "Fill original-goal low-token coverage waiting row cockpit receipt template",
  command: originalGoalLowTokenCoverageWaitingRowCockpit.receiptTemplatePath || ""
});
refresh.nextCommands.splice(10, 0, {
  label: "Validate teacher receipt for original-goal low-token coverage waiting row cockpit",
  command: refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || ""
});
refresh.nextCommands.splice(11, 0, {
  label: "Open original-goal low-token blocked waiting row evidence plan",
  command:
    originalGoalLowTokenBlockedWaitingRowEvidencePlan.htmlPath ||
    originalGoalLowTokenBlockedWaitingRowEvidencePlan.planPath ||
    ""
});
refresh.nextCommands.splice(12, 0, {
  label: "Review original-goal low-token fallback routes for blocked waiting rows",
  command:
    originalGoalLowTokenFallbackRouteEvidencePack.htmlPath ||
    originalGoalLowTokenFallbackRouteEvidencePack.packPath ||
    ""
});
refresh.nextCommands.splice(13, 0, {
  label: "Fill original-goal low-token fallback route receipt template after teacher route selection",
  command: originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.receiptTemplatePath || ""
});
refresh.nextCommands.splice(14, 0, {
  label: "Validate original-goal low-token fallback route receipt before evidence plan follow-up",
  command: refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate || ""
});
refresh.nextCommands.splice(15, 0, {
  label: "Open manual review pack for fallback route rows that still need teacher decisions",
  command:
    refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackHtml ||
    refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPack ||
    refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPackCommandTemplate ||
    ""
});
refresh.nextCommands.splice(16, 0, {
  label: "Validate teacher-filled low-token manual route review patch",
  command: refresh.paths.originalGoalLowTokenFallbackRouteManualReviewPatchValidationCommandTemplate || ""
});
refresh.nextCommands.splice(17, 0, {
  label: "Draft blocked waiting-row evidence-plan receipt from validated fallback routes",
  command: refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || ""
});
refresh.nextCommands.splice(18, 0, {
  label: "Generate teacher receipt for original-goal low-token blocked waiting row evidence plan",
  command:
    originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.htmlPath ||
    originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.splice(19, 0, {
  label: "Validate teacher receipt for original-goal low-token blocked waiting row evidence plan",
  command: refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate || ""
});
refresh.nextCommands.splice(20, 0, {
  label: "Build teacher-review cockpit receipt draft from validated blocked waiting row evidence",
  command: refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || ""
});
refresh.nextCommands.splice(21, 0, {
  label: "Run teacher-reviewed evidence return cockpit receipt validation",
  command: refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || ""
});
refresh.nextCommands.splice(22, 0, {
  label: "Open original-goal low-token metadata gate preflight",
  command:
    originalGoalLowTokenMetadataGatePreflight.htmlPath ||
    originalGoalLowTokenMetadataGatePreflight.preflightPath ||
    ""
});
refresh.nextCommands.splice(23, 0, {
  label: "Generate teacher receipt for original-goal low-token metadata gate preflight",
  command:
    originalGoalLowTokenMetadataGatePreflightReceiptBuilder.htmlPath ||
    originalGoalLowTokenMetadataGatePreflightReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.splice(24, 0, {
  label: "Validate teacher receipt for original-goal low-token metadata gate preflight",
  command: refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate || ""
});
refresh.nextCommands.splice(4, 0, {
  label: "Validate teacher receipt for original-goal low-token coverage dossier",
  command: refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate || ""
});
refresh.nextCommands.splice(5, 0, {
  label: "Open discovered original-goal low-token coverage dossier receipt validation",
  command:
    refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationReadme ||
    refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidation ||
    ""
});
refresh.nextCommands.splice(6, 0, {
  label: "Run original-goal low-token coverage completion gate after receipt validation",
  command: refresh.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate || ""
});
refresh.nextCommands.splice(7, 0, {
  label: "Open discovered original-goal low-token coverage completion gate",
  command:
    refresh.paths.originalGoalLowTokenCoverageCompletionGateReadme ||
    refresh.paths.originalGoalLowTokenCoverageCompletionGate ||
    ""
});
refresh.paths.teacherLearningMethodProfile = sourceTeacherLearningMethodProfile || "";
refresh.paths.teacherMethodExecutionLearningContractCommandTemplate =
  teacherMethodExecutionLearningContractCommandTemplate || "";
refresh.paths.teacherMethodExecutionLearningContract =
  sourceTeacherMethodExecutionLearningContract || "";
refresh.paths.teacherMethodExecutionLearningContractReadme =
  sourceTeacherMethodExecutionLearningContract
    ? sourceTeacherMethodExecutionLearningContract.replace(
        /teacher-method-execution-learning-contract\.json$/,
        "TEACHER_METHOD_EXECUTION_LEARNING_CONTRACT_START_HERE.md"
      )
    : "";
let teacherMethodExecutionLearningContractReceiptBuilder = null;
if (refresh.paths.teacherMethodExecutionLearningContract) {
  teacherMethodExecutionLearningContractReceiptBuilder = runNodeScript(
    "create-teacher-method-execution-learning-contract-receipt-builder.mjs",
    [
      "--goal",
      goal,
      "--contract",
      refresh.paths.teacherMethodExecutionLearningContract,
      "--output-dir",
      join(refreshDir, "teacher-method-execution-learning-contract-receipt-builder")
    ]
  );
}
refresh.paths.teacherMethodExecutionLearningContractReceiptBuilder =
  teacherMethodExecutionLearningContractReceiptBuilder?.builderPath || "";
refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml =
  teacherMethodExecutionLearningContractReceiptBuilder?.htmlPath || "";
refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderReadme =
  teacherMethodExecutionLearningContractReceiptBuilder?.readmePath || "";
refresh.paths.teacherMethodExecutionLearningContractReceiptTemplate =
  teacherMethodExecutionLearningContractReceiptBuilder?.receiptTemplatePath || "";
refresh.paths.teacherMethodExecutionLearningContractReceiptValidationCommandTemplate =
  teacherMethodExecutionLearningContractReceiptBuilder?.nextValidationCommand ||
  commandLine("validate-teacher-method-execution-learning-contract-receipt.mjs", [
    ["--contract", refresh.paths.teacherMethodExecutionLearningContract || "<teacher-method-execution-learning-contract.json>"],
    ["--receipt", "<teacher-filled-teacher-method-execution-learning-contract-receipt.json>"],
    ["--output-dir", join(refreshDir, "teacher-method-execution-learning-contract-receipt-validation")]
  ]);
refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptBuilderReady =
  Boolean(refresh.paths.teacherMethodExecutionLearningContractReceiptBuilder);
refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptValidationCommandReady =
  String(refresh.paths.teacherMethodExecutionLearningContractReceiptValidationCommandTemplate || "").includes(
    "validate-teacher-method-execution-learning-contract-receipt.mjs"
  );
refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptBuilderReviewOnly =
  teacherMethodExecutionLearningContractReceiptBuilder?.locks?.reviewOnly === true &&
  teacherMethodExecutionLearningContractReceiptBuilder?.locks?.builderDoesNotRunCommands === true &&
  teacherMethodExecutionLearningContractReceiptBuilder?.locks?.builderDoesNotExecuteTargetSoftware === true &&
  teacherMethodExecutionLearningContractReceiptBuilder?.locks?.builderDoesNotWriteMemory === true &&
  teacherMethodExecutionLearningContractReceiptBuilder?.locks?.goalComplete === false;
if (refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml) {
  directReviewEntryPoints.push({
    id: "teacher_method_execution_learning_contract_receipt_builder",
    label: "Teacher method execution-learning contract receipt builder",
    path: refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml,
    url: ""
  });
  refresh.nextCommands.push({
    label: "Open teacher method execution-learning contract receipt builder",
    command: refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml
  });
  refresh.nextCommands.push({
    label: "Validate teacher-filled teacher method execution-learning contract receipt",
    command: refresh.paths.teacherMethodExecutionLearningContractReceiptValidationCommandTemplate
  });
}
refresh.paths.teacherMethodExecutionLearningContractReceiptValidation =
  sourceTeacherMethodExecutionLearningContractReceiptValidation || "";
refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptValidationStatus =
  sourceTeacherMethodExecutionLearningContractReceiptValidationPacket?.status || "";
refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptReadyForReuseResultProof =
  sourceTeacherMethodExecutionLearningContractReceiptValidationPacket?.readyForReuseResultProof === true;
let teacherMethodReuseResultProofBuilder = null;
if (refresh.paths.teacherMethodExecutionLearningContract) {
  const reuseBuilderArgs = [
    "--goal",
    goal,
    "--contract",
    refresh.paths.teacherMethodExecutionLearningContract,
    "--output-dir",
    join(refreshDir, "teacher-method-reuse-result-proof-builder")
  ];
  if (refresh.paths.teacherMethodExecutionLearningContractReceiptValidation) {
    reuseBuilderArgs.splice(4, 0, "--contract-receipt-validation", refresh.paths.teacherMethodExecutionLearningContractReceiptValidation);
  }
  teacherMethodReuseResultProofBuilder = runNodeScript(
    "create-teacher-method-reuse-result-proof-builder.mjs",
    reuseBuilderArgs
  );
}
refresh.paths.teacherMethodReuseResultProofBuilder = teacherMethodReuseResultProofBuilder?.builderPath || "";
refresh.paths.teacherMethodReuseResultProofBuilderHtml = teacherMethodReuseResultProofBuilder?.htmlPath || "";
refresh.paths.teacherMethodReuseResultProofBuilderReadme = teacherMethodReuseResultProofBuilder?.readmePath || "";
refresh.paths.teacherMethodReuseResultProofReceiptTemplate = teacherMethodReuseResultProofBuilder?.receiptTemplatePath || "";
refresh.paths.teacherMethodReuseResultProofValidation = sourceTeacherMethodReuseResultProofValidation || "";
refresh.paths.teacherMethodReuseResultProofValidationCommandTemplate =
  teacherMethodReuseResultProofBuilder?.nextValidationCommand ||
  commandLine("validate-teacher-method-reuse-result-proof-receipt.mjs", [
    [
      "--contract-receipt-validation",
      refresh.paths.teacherMethodExecutionLearningContractReceiptValidation ||
        "<teacher-method-execution-learning-contract-receipt-validation.json>"
    ],
    ["--receipt", "<teacher-filled-teacher-method-reuse-result-proof-receipt.json>"],
    ["--contract", refresh.paths.teacherMethodExecutionLearningContract || "<teacher-method-execution-learning-contract.json>"],
    ["--output-dir", join(refreshDir, "teacher-method-reuse-result-proof-validation")]
  ]);
refresh.refreshedEvidence.teacherMethodReuseResultProofBuilderReady =
  Boolean(refresh.paths.teacherMethodReuseResultProofBuilder);
refresh.refreshedEvidence.teacherMethodReuseResultProofValidationCommandReady =
  String(refresh.paths.teacherMethodReuseResultProofValidationCommandTemplate || "").includes(
    "validate-teacher-method-reuse-result-proof-receipt.mjs"
  );
refresh.refreshedEvidence.teacherMethodReuseResultProofValidationStatus =
  sourceTeacherMethodReuseResultProofValidationPacket?.status || "";
refresh.refreshedEvidence.teacherMethodReuseResultProofReadyForMediumRuntimeReuseGate =
  sourceTeacherMethodReuseResultProofValidationPacket?.readyForMediumRuntimeReuseGate === true;
refresh.refreshedEvidence.teacherMethodReuseResultProofReadyForTeacherReceipt =
  teacherMethodReuseResultProofBuilder?.readyForTeacherReuseResultReceipt === true;
refresh.refreshedEvidence.teacherMethodReuseResultProofBuilderReviewOnly =
  teacherMethodReuseResultProofBuilder?.locks?.reviewOnly === true &&
  teacherMethodReuseResultProofBuilder?.locks?.builderDoesNotRunCommands === true &&
  teacherMethodReuseResultProofBuilder?.locks?.builderDoesNotExecuteTargetSoftware === true &&
  teacherMethodReuseResultProofBuilder?.locks?.builderDoesNotWriteMemory === true &&
  teacherMethodReuseResultProofBuilder?.locks?.goalComplete === false;
if (refresh.paths.teacherMethodReuseResultProofBuilderHtml) {
  directReviewEntryPoints.push({
    id: "teacher_method_reuse_result_proof_builder",
    label: "Teacher method reuse result proof builder",
    path: refresh.paths.teacherMethodReuseResultProofBuilderHtml,
    url: ""
  });
  refresh.nextCommands.push({
    label: "Open teacher method reuse result proof builder",
    command: refresh.paths.teacherMethodReuseResultProofBuilderHtml
  });
  refresh.nextCommands.push({
    label: "Validate teacher-filled teacher method reuse result proof receipt",
    command: refresh.paths.teacherMethodReuseResultProofValidationCommandTemplate
  });
}
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
writeFileSync(nextActionTriagePath, `${JSON.stringify(nextActionTriage, null, 2)}\n`, "utf8");
writeTriageHtml(nextActionTriageHtmlPath, nextActionTriage);
writeReadme(readmePath, refresh);
writeDashboard(dashboardPath, refresh);
reviewEntrypointHealthAudit = runNodeScript("audit-original-goal-review-entrypoint-health.mjs", [
  "--goal",
  goal,
  "--status-refresh",
  refreshPath,
  "--router",
  teacherActionRouter.routerPath || "",
  "--output-dir",
  join(refreshDir, "review-entrypoint-health-audit")
]);
refresh.paths.reviewEntrypointHealthAudit = reviewEntrypointHealthAudit.auditPath || "";
refresh.paths.reviewEntrypointHealthAuditHtml = reviewEntrypointHealthAudit.htmlPath || "";
refresh.paths.reviewEntrypointHealthAuditReadme = reviewEntrypointHealthAudit.readmePath || "";
refresh.discoveredEvidence.reviewEntrypointHealthAudit = reviewEntrypointHealthAudit.auditPath || "";
refresh.discoveredEvidence.reviewEntrypointHealthAuditHtml = reviewEntrypointHealthAudit.htmlPath || "";
refresh.discoveredEvidence.reviewEntrypointHealthAuditReadme = reviewEntrypointHealthAudit.readmePath || "";
refresh.discoveredEvidence.reviewEntrypointHealthAuditStatus = reviewEntrypointHealthAudit.status || "";
refresh.discoveredEvidence.reviewEntrypointHealthAuditChecked = reviewEntrypointHealthAudit.checked || 0;
refresh.discoveredEvidence.reviewEntrypointHealthAuditFailedRequired = reviewEntrypointHealthAudit.failedRequired || 0;
refresh.refreshedEvidence.reviewEntrypointHealthAuditStatus = reviewEntrypointHealthAudit.status || "";
refresh.refreshedEvidence.reviewEntrypointHealthAuditChecked = reviewEntrypointHealthAudit.checked || 0;
refresh.refreshedEvidence.reviewEntrypointHealthAuditFailedRequired = reviewEntrypointHealthAudit.failedRequired || 0;
const reviewEntrypointHealthCommand = refresh.nextCommands.find((row) =>
  row.label === "Open review entrypoint health audit before trying linked teacher pages"
);
if (reviewEntrypointHealthCommand) {
  reviewEntrypointHealthCommand.command = reviewEntrypointHealthAudit.htmlPath || reviewEntrypointHealthAudit.auditPath || "";
}
directReviewEntryPoints.push({
  id: "review_entrypoint_health_audit",
  label: "Review entrypoint health audit",
  path: reviewEntrypointHealthAudit.htmlPath || reviewEntrypointHealthAudit.auditPath || "",
  url: ""
});
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const originalGoalRemainingGatesPacket = runNodeScript("create-original-goal-remaining-gates-packet.mjs", [
  "--goal",
  goal,
  "--status-refresh",
  refreshPath,
  "--output-dir",
  join(refreshDir, "remaining-gates-packet")
]);
refresh.paths.originalGoalRemainingGatesPacket = originalGoalRemainingGatesPacket.packetPath || "";
refresh.paths.originalGoalRemainingGatesPacketHtml = originalGoalRemainingGatesPacket.htmlPath || "";
refresh.paths.originalGoalRemainingGatesPacketReadme = originalGoalRemainingGatesPacket.readmePath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesPacket = originalGoalRemainingGatesPacket.packetPath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesPacketHtml = originalGoalRemainingGatesPacket.htmlPath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesPacketReadme = originalGoalRemainingGatesPacket.readmePath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesPacketStatus = originalGoalRemainingGatesPacket.status || "";
refresh.discoveredEvidence.originalGoalRemainingGatesPacketGateGroups =
  originalGoalRemainingGatesPacket.counts?.gateGroups || 0;
refresh.discoveredEvidence.originalGoalRemainingGatesPacketLowTokenSelectedActions =
  originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions || 0;
refresh.refreshedEvidence.originalGoalRemainingGatesPacketReady =
  originalGoalRemainingGatesPacket.status === "waiting_for_teacher_remaining_gate_review" &&
  Boolean(originalGoalRemainingGatesPacket.htmlPath);
refresh.refreshedEvidence.originalGoalRemainingGatesPacketGateGroups =
  originalGoalRemainingGatesPacket.counts?.gateGroups || 0;
refresh.refreshedEvidence.originalGoalRemainingGatesPacketLowTokenSelectedActions =
  originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions || 0;
const originalGoalRemainingGatesReceiptBuilder = runNodeScript("create-original-goal-remaining-gates-receipt-builder.mjs", [
  "--goal",
  goal,
  "--packet",
  originalGoalRemainingGatesPacket.packetPath || refresh.paths.originalGoalRemainingGatesPacket,
  "--output-dir",
  join(refreshDir, "remaining-gates-receipt-builder")
]);
const originalGoalRemainingGatesReceiptValidationCommandTemplate = commandLine(
  "validate-original-goal-remaining-gates-receipt.mjs",
  [
    ["--packet", originalGoalRemainingGatesPacket.packetPath || "<original-goal-remaining-gates-packet.json>"],
    ["--receipt", "<teacher-filled-remaining-gates-receipt.json>"],
    ["--output-dir", join(refreshDir, "remaining-gates-receipt-validation")]
  ]
);
refresh.paths.originalGoalRemainingGatesReceiptBuilder = originalGoalRemainingGatesReceiptBuilder.builderPath || "";
refresh.paths.originalGoalRemainingGatesReceiptBuilderHtml = originalGoalRemainingGatesReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalRemainingGatesReceiptBuilderReadme = originalGoalRemainingGatesReceiptBuilder.readmePath || "";
refresh.paths.originalGoalRemainingGatesReceiptTemplate = originalGoalRemainingGatesReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalRemainingGatesReceiptValidationCommandTemplate =
  originalGoalRemainingGatesReceiptValidationCommandTemplate;
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptBuilder =
  originalGoalRemainingGatesReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptBuilderHtml =
  originalGoalRemainingGatesReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptBuilderReadme =
  originalGoalRemainingGatesReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptTemplate =
  originalGoalRemainingGatesReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptBuilderStatus =
  originalGoalRemainingGatesReceiptBuilder.status || "";
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptBuilderRows =
  originalGoalRemainingGatesReceiptBuilder.counts?.reviewRows || originalGoalRemainingGatesReceiptBuilder.reviewRows || 0;
refresh.discoveredEvidence.originalGoalRemainingGatesReceiptValidationCommandTemplate =
  originalGoalRemainingGatesReceiptValidationCommandTemplate;
refresh.refreshedEvidence.originalGoalRemainingGatesReceiptBuilderReady =
  originalGoalRemainingGatesReceiptBuilder.status === "waiting_for_teacher_remaining_gates_receipt" &&
  Boolean(originalGoalRemainingGatesReceiptBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalRemainingGatesReceiptBuilderRowCount =
  originalGoalRemainingGatesReceiptBuilder.counts?.reviewRows || originalGoalRemainingGatesReceiptBuilder.reviewRows || 0;
refresh.refreshedEvidence.originalGoalRemainingGatesReceiptValidationCommandReady =
  originalGoalRemainingGatesReceiptValidationCommandTemplate.includes("validate-original-goal-remaining-gates-receipt.mjs") &&
  originalGoalRemainingGatesReceiptValidationCommandTemplate.includes("<teacher-filled-remaining-gates-receipt.json>");
const originalGoalReviewHandoffItemCommandBuilder = runNodeScript(
  "create-original-goal-review-handoff-item-command-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "original-goal-review-handoff-item-command-builder")
  ]
);
const originalGoalReviewHandoffItemCommandBuilderCommandTemplate =
  originalGoalReviewHandoffItemCommandBuilderCommand(refreshDir);
refresh.paths.originalGoalReviewHandoffItemCommandBuilder = originalGoalReviewHandoffItemCommandBuilder.builderPath || "";
refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml = originalGoalReviewHandoffItemCommandBuilder.htmlPath || "";
refresh.paths.originalGoalReviewHandoffItemCommandBuilderReadme = originalGoalReviewHandoffItemCommandBuilder.readmePath || "";
refresh.paths.originalGoalReviewHandoffItemCommandBuilderCommandTemplate =
  originalGoalReviewHandoffItemCommandBuilderCommandTemplate;
refresh.discoveredEvidence.originalGoalReviewHandoffItemCommandBuilder =
  originalGoalReviewHandoffItemCommandBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalReviewHandoffItemCommandBuilderHtml =
  originalGoalReviewHandoffItemCommandBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalReviewHandoffItemCommandBuilderReadme =
  originalGoalReviewHandoffItemCommandBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalReviewHandoffItemCommandBuilderStatus =
  originalGoalReviewHandoffItemCommandBuilder.status || "";
refresh.discoveredEvidence.originalGoalReviewHandoffItemCommandBuilderCommandTemplate =
  originalGoalReviewHandoffItemCommandBuilderCommandTemplate;
refresh.refreshedEvidence.originalGoalReviewHandoffItemCommandBuilderReady =
  originalGoalReviewHandoffItemCommandBuilder.status === "waiting_for_teacher_handoff_queue_path" &&
  Boolean(originalGoalReviewHandoffItemCommandBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalReviewHandoffItemCommandBuilderCommandReady =
  originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
    "create-original-goal-review-handoff-item-command-builder.mjs"
  ) &&
  originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
    "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"
  );
const coverageEnrollmentFollowUpHandoffItemCommandBuilder = runNodeScript(
  "create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "coverage-enrollment-follow-up-handoff-item-command-builder")
  ]
);
const coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemCommandBuilderCommand(refreshDir);
const coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommand(refreshDir);
const coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommand(refreshDir);
refresh.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilder =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.builder || "";
refresh.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilderHtml =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.html || "";
refresh.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilderReadme =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.readme || "";
refresh.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate;
refresh.paths.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate;
refresh.paths.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate;
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilder =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.builder || "";
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilderHtml =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.html || "";
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilderReadme =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.readme || "";
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilderStatus =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.status || "";
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate;
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate;
refresh.discoveredEvidence.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate;
refresh.refreshedEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilderReady =
  coverageEnrollmentFollowUpHandoffItemCommandBuilder.status === "waiting_for_handoff_queue_path" &&
  Boolean(coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.html);
refresh.refreshedEvidence.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandReady =
  coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate.includes(
    "create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs"
  ) &&
  coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate.includes(
    "<coverage-enrollment-follow-up-handoff-queue.json>"
  );
refresh.refreshedEvidence.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandReady =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate.includes(
    "create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs"
  ) &&
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate.includes(
    "<coverage-enrollment-follow-up-handoff-item-run.json>"
  );
refresh.refreshedEvidence.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandReady =
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate.includes(
    "validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs"
  ) &&
  coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate.includes(
    "<teacher-filled-coverage-enrollment-handoff-item-run-review-receipt.json>"
  );
const executionFollowUpHandoffItemCommandBuilder = runNodeScript(
  "create-all-software-execution-follow-up-handoff-item-command-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "execution-follow-up-handoff-item-command-builder")
  ]
);
const executionFollowUpHandoffItemCommandBuilderCommandTemplate =
  executionFollowUpHandoffItemCommandBuilderCommand(refreshDir);
refresh.paths.executionFollowUpHandoffItemCommandBuilder =
  executionFollowUpHandoffItemCommandBuilder.paths?.builder || "";
refresh.paths.executionFollowUpHandoffItemCommandBuilderHtml =
  executionFollowUpHandoffItemCommandBuilder.paths?.html || "";
refresh.paths.executionFollowUpHandoffItemCommandBuilderReadme =
  executionFollowUpHandoffItemCommandBuilder.paths?.readme || "";
refresh.paths.executionFollowUpHandoffItemCommandBuilderCommandTemplate =
  executionFollowUpHandoffItemCommandBuilderCommandTemplate;
refresh.discoveredEvidence.executionFollowUpHandoffItemCommandBuilder =
  executionFollowUpHandoffItemCommandBuilder.paths?.builder || "";
refresh.discoveredEvidence.executionFollowUpHandoffItemCommandBuilderHtml =
  executionFollowUpHandoffItemCommandBuilder.paths?.html || "";
refresh.discoveredEvidence.executionFollowUpHandoffItemCommandBuilderReadme =
  executionFollowUpHandoffItemCommandBuilder.paths?.readme || "";
refresh.discoveredEvidence.executionFollowUpHandoffItemCommandBuilderStatus =
  executionFollowUpHandoffItemCommandBuilder.status || "";
refresh.discoveredEvidence.executionFollowUpHandoffItemCommandBuilderCommandTemplate =
  executionFollowUpHandoffItemCommandBuilderCommandTemplate;
refresh.refreshedEvidence.executionFollowUpHandoffItemCommandBuilderReady =
  executionFollowUpHandoffItemCommandBuilder.status === "waiting_for_handoff_queue_path" &&
  Boolean(executionFollowUpHandoffItemCommandBuilder.paths?.html);
refresh.refreshedEvidence.executionFollowUpHandoffItemCommandBuilderCommandReady =
  executionFollowUpHandoffItemCommandBuilderCommandTemplate.includes(
    "create-all-software-execution-follow-up-handoff-item-command-builder.mjs"
  ) &&
  executionFollowUpHandoffItemCommandBuilderCommandTemplate.includes("<execution-follow-up-handoff-queue.json>");
const executionApprovedGateCommandBuilder = runNodeScript(
  "create-all-software-execution-approved-gate-command-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "execution-approved-gate-command-builder")
  ]
);
const executionApprovedGateCommandBuilderCommandTemplate = executionApprovedGateCommandBuilderCommand(refreshDir);
refresh.paths.executionApprovedGateCommandBuilder = executionApprovedGateCommandBuilder.paths?.builder || "";
refresh.paths.executionApprovedGateCommandBuilderHtml = executionApprovedGateCommandBuilder.paths?.html || "";
refresh.paths.executionApprovedGateCommandBuilderReadme = executionApprovedGateCommandBuilder.paths?.readme || "";
refresh.paths.executionApprovedGateCommandBuilderCommandTemplate = executionApprovedGateCommandBuilderCommandTemplate;
refresh.discoveredEvidence.executionApprovedGateCommandBuilder = executionApprovedGateCommandBuilder.paths?.builder || "";
refresh.discoveredEvidence.executionApprovedGateCommandBuilderHtml = executionApprovedGateCommandBuilder.paths?.html || "";
refresh.discoveredEvidence.executionApprovedGateCommandBuilderReadme = executionApprovedGateCommandBuilder.paths?.readme || "";
refresh.discoveredEvidence.executionApprovedGateCommandBuilderStatus = executionApprovedGateCommandBuilder.status || "";
refresh.discoveredEvidence.executionApprovedGateCommandBuilderCommandTemplate =
  executionApprovedGateCommandBuilderCommandTemplate;
refresh.refreshedEvidence.executionApprovedGateCommandBuilderReady =
  executionApprovedGateCommandBuilder.status === "waiting_for_ready_gate_path" &&
  Boolean(executionApprovedGateCommandBuilder.paths?.html);
refresh.refreshedEvidence.executionApprovedGateCommandBuilderCommandReady =
  executionApprovedGateCommandBuilderCommandTemplate.includes(
    "create-all-software-execution-approved-gate-command-builder.mjs"
  ) &&
  executionApprovedGateCommandBuilderCommandTemplate.includes("<ready-real-local-execution-approval-gate.json>");
const operationalRegistrationApprovedCommandBuilder = runNodeScript(
  "create-all-software-operational-registration-approved-command-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "operational-registration-approved-command-builder")
  ]
);
const operationalRegistrationApprovedCommandBuilderCommandTemplate =
  operationalRegistrationApprovedCommandBuilderCommand(refreshDir);
refresh.paths.operationalRegistrationApprovedCommandBuilder =
  operationalRegistrationApprovedCommandBuilder.paths?.builder || "";
refresh.paths.operationalRegistrationApprovedCommandBuilderHtml =
  operationalRegistrationApprovedCommandBuilder.paths?.html || "";
refresh.paths.operationalRegistrationApprovedCommandBuilderReadme =
  operationalRegistrationApprovedCommandBuilder.paths?.readme || "";
refresh.paths.operationalRegistrationApprovedCommandBuilderCommandTemplate =
  operationalRegistrationApprovedCommandBuilderCommandTemplate;
refresh.discoveredEvidence.operationalRegistrationApprovedCommandBuilder =
  operationalRegistrationApprovedCommandBuilder.paths?.builder || "";
refresh.discoveredEvidence.operationalRegistrationApprovedCommandBuilderHtml =
  operationalRegistrationApprovedCommandBuilder.paths?.html || "";
refresh.discoveredEvidence.operationalRegistrationApprovedCommandBuilderReadme =
  operationalRegistrationApprovedCommandBuilder.paths?.readme || "";
refresh.discoveredEvidence.operationalRegistrationApprovedCommandBuilderStatus =
  operationalRegistrationApprovedCommandBuilder.status || "";
refresh.discoveredEvidence.operationalRegistrationApprovedCommandBuilderCommandTemplate =
  operationalRegistrationApprovedCommandBuilderCommandTemplate;
refresh.refreshedEvidence.operationalRegistrationApprovedCommandBuilderReady =
  operationalRegistrationApprovedCommandBuilder.status === "waiting_for_ready_registration_execute_gate_path" &&
  Boolean(operationalRegistrationApprovedCommandBuilder.paths?.html);
refresh.refreshedEvidence.operationalRegistrationApprovedCommandBuilderCommandReady =
  operationalRegistrationApprovedCommandBuilderCommandTemplate.includes(
    "create-all-software-operational-registration-approved-command-builder.mjs"
  ) &&
  operationalRegistrationApprovedCommandBuilderCommandTemplate.includes(
    "<ready-operational-registration-execute-gate.json>"
  );
const operationalPostRegistrationOutputWitnessCommandBuilder = runNodeScript(
  "create-all-software-operational-post-registration-output-witness-command-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "operational-post-registration-output-witness-command-builder")
  ]
);
const operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate =
  operationalPostRegistrationOutputWitnessCommandBuilderCommand(refreshDir);
refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilder =
  operationalPostRegistrationOutputWitnessCommandBuilder.paths?.builder || "";
refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderHtml =
  operationalPostRegistrationOutputWitnessCommandBuilder.paths?.html || "";
refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderReadme =
  operationalPostRegistrationOutputWitnessCommandBuilder.paths?.readme || "";
refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate =
  operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate;
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessCommandBuilder =
  operationalPostRegistrationOutputWitnessCommandBuilder.paths?.builder || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessCommandBuilderHtml =
  operationalPostRegistrationOutputWitnessCommandBuilder.paths?.html || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessCommandBuilderReadme =
  operationalPostRegistrationOutputWitnessCommandBuilder.paths?.readme || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessCommandBuilderStatus =
  operationalPostRegistrationOutputWitnessCommandBuilder.status || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate =
  operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate;
refresh.refreshedEvidence.operationalPostRegistrationOutputWitnessCommandBuilderReady =
  operationalPostRegistrationOutputWitnessCommandBuilder.status === "waiting_for_registered_matching_status_path" &&
  Boolean(operationalPostRegistrationOutputWitnessCommandBuilder.paths?.html);
refresh.refreshedEvidence.operationalPostRegistrationOutputWitnessCommandBuilderCommandReady =
  operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate.includes(
    "create-all-software-operational-post-registration-output-witness-command-builder.mjs"
  ) &&
  operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate.includes(
    "<registered-and-matching-recurring-monitor-status.json>"
  );
const operationalPostRegistrationOutputWitnessReceiptBuilder = runNodeScript(
  "create-all-software-operational-post-registration-output-witness-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--output-dir",
    join(refreshDir, "operational-post-registration-output-witness-receipt-builder")
  ]
);
const operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate =
  operationalPostRegistrationOutputWitnessReceiptBuilderCommand(refreshDir);
const operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate =
  operationalPostRegistrationOutputWitnessReceiptValidationCommand(refreshDir);
refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilder =
  operationalPostRegistrationOutputWitnessReceiptBuilder.builderPath || "";
refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderHtml =
  operationalPostRegistrationOutputWitnessReceiptBuilder.htmlPath || "";
refresh.paths.operationalPostRegistrationOutputWitnessReceiptTemplate =
  operationalPostRegistrationOutputWitnessReceiptBuilder.receiptTemplatePath || "";
refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderReadme =
  operationalPostRegistrationOutputWitnessReceiptBuilder.readmePath || "";
refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate =
  operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate;
refresh.paths.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate =
  operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate;
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptBuilder =
  operationalPostRegistrationOutputWitnessReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptBuilderHtml =
  operationalPostRegistrationOutputWitnessReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptTemplate =
  operationalPostRegistrationOutputWitnessReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptBuilderReadme =
  operationalPostRegistrationOutputWitnessReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptBuilderStatus =
  operationalPostRegistrationOutputWitnessReceiptBuilder.status || "";
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate =
  operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate;
refresh.discoveredEvidence.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate =
  operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate;
refresh.refreshedEvidence.operationalPostRegistrationOutputWitnessReceiptBuilderReady =
  operationalPostRegistrationOutputWitnessReceiptBuilder.status === "waiting_for_post_registration_output_witness_runner_path" &&
  Boolean(operationalPostRegistrationOutputWitnessReceiptBuilder.htmlPath);
refresh.refreshedEvidence.operationalPostRegistrationOutputWitnessReceiptBuilderCommandReady =
  operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate.includes(
    "create-all-software-operational-post-registration-output-witness-receipt-builder.mjs"
  ) &&
  operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate.includes(
    "<post-registration-output-witness-runner.json>"
  );
refresh.refreshedEvidence.operationalPostRegistrationOutputWitnessReceiptValidationCommandReady =
  operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate.includes(
    "validate-all-software-operational-post-registration-output-witness-receipt.mjs"
  ) &&
  operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate.includes(
    "<teacher-filled-post-registration-output-witness-review-receipt.json>"
  );
directReviewEntryPoints.push({
  id: "original_goal_remaining_gates_packet",
  label: "Original goal remaining gates low-token packet",
  path: originalGoalRemainingGatesPacket.htmlPath || originalGoalRemainingGatesPacket.packetPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_remaining_gates_receipt_builder",
  label: "Original goal remaining gates receipt builder",
  path: originalGoalRemainingGatesReceiptBuilder.htmlPath || originalGoalRemainingGatesReceiptBuilder.builderPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_remaining_gates_receipt_template",
  label: "Original goal remaining gates receipt template",
  path: originalGoalRemainingGatesReceiptBuilder.receiptTemplatePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_review_handoff_item_command_builder",
  label: "Original goal review handoff item command builder",
  path: originalGoalReviewHandoffItemCommandBuilder.htmlPath || originalGoalReviewHandoffItemCommandBuilder.builderPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "coverage_enrollment_follow_up_handoff_item_command_builder",
  label: "Coverage enrollment follow-up handoff item command builder",
  path:
    coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.html ||
    coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.builder ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "execution_follow_up_handoff_item_command_builder",
  label: "Execution follow-up handoff item command builder",
  path:
    executionFollowUpHandoffItemCommandBuilder.paths?.html ||
    executionFollowUpHandoffItemCommandBuilder.paths?.builder ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "execution_approved_gate_command_builder",
  label: "Execution approved gate command builder",
  path:
    executionApprovedGateCommandBuilder.paths?.html ||
    executionApprovedGateCommandBuilder.paths?.builder ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "operational_registration_approved_command_builder",
  label: "Operational registration approved command builder",
  path:
    operationalRegistrationApprovedCommandBuilder.paths?.html ||
    operationalRegistrationApprovedCommandBuilder.paths?.builder ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "operational_post_registration_output_witness_command_builder",
  label: "Operational post-registration output witness command builder",
  path:
    operationalPostRegistrationOutputWitnessCommandBuilder.paths?.html ||
    operationalPostRegistrationOutputWitnessCommandBuilder.paths?.builder ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "operational_post_registration_output_witness_receipt_builder",
  label: "Operational post-registration output witness receipt builder",
  path:
    operationalPostRegistrationOutputWitnessReceiptBuilder.htmlPath ||
    operationalPostRegistrationOutputWitnessReceiptBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "operational_post_registration_output_witness_receipt_template",
  label: "Operational post-registration output witness receipt template",
  path: operationalPostRegistrationOutputWitnessReceiptBuilder.receiptTemplatePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "all_software_unattended_learning_audit",
  label: "All-software unattended learning audit",
  path: allSoftwareUnattendedLearningAudit.readmePath || allSoftwareUnattendedLearningAudit.auditPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "all_software_unattended_learning_audit_receipt",
  label: "All-software unattended learning audit receipt",
  path: allSoftwareUnattendedLearningAudit.receiptPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "recurring_monitor_teacher_confirmation_package",
  label: "Recurring monitor teacher confirmation package",
  path:
    recurringMonitorTeacherConfirmationPackage.htmlPath ||
    recurringMonitorTeacherConfirmationPackage.readmePath ||
    recurringMonitorTeacherConfirmationPackage.packagePath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "recurring_monitor_teacher_confirmation_receipt_template",
  label: "Recurring monitor teacher confirmation receipt template",
  path: recurringMonitorTeacherConfirmationPackage.receiptTemplatePath || "",
  url: ""
});
refresh.nextCommands.push({
  label: "Validate teacher-filled remaining gates receipt into next review queue",
  command: originalGoalRemainingGatesReceiptValidationCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser command builder for one reviewed original-goal handoff item",
  command: originalGoalReviewHandoffItemCommandBuilder.htmlPath || originalGoalReviewHandoffItemCommandBuilder.builderPath || ""
});
refresh.nextCommands.push({
  label: "Regenerate original-goal handoff item command builder from a validated queue",
  command: originalGoalReviewHandoffItemCommandBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser command builder for one reviewed coverage enrollment follow-up item",
  command:
    coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.html ||
    coverageEnrollmentFollowUpHandoffItemCommandBuilder.paths?.builder ||
    ""
});
refresh.nextCommands.push({
  label: "Regenerate coverage enrollment follow-up item command builder from a validated handoff queue",
  command: coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Create teacher run-review receipt builder after one coverage enrollment follow-up handoff item run",
  command: coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Validate teacher run-review receipt before coverage enrollment follow-up reconciliation",
  command: coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser command builder for one reviewed execution dry-run handoff item",
  command:
    executionFollowUpHandoffItemCommandBuilder.paths?.html ||
    executionFollowUpHandoffItemCommandBuilder.paths?.builder ||
    ""
});
refresh.nextCommands.push({
  label: "Regenerate execution follow-up item command builder from a validated handoff queue",
  command: executionFollowUpHandoffItemCommandBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser command builder for one ready execution approval gate",
  command:
    executionApprovedGateCommandBuilder.paths?.html ||
    executionApprovedGateCommandBuilder.paths?.builder ||
    ""
});
refresh.nextCommands.push({
  label: "Regenerate execution approved gate command builder from a ready gate",
  command: executionApprovedGateCommandBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Open all-software unattended learning audit before any operational completion claim",
  command: allSoftwareUnattendedLearningAudit.readmePath || allSoftwareUnattendedLearningAudit.auditPath || ""
});
refresh.nextCommands.push({
  label: "Regenerate all-software unattended learning audit from current recurring monitor evidence",
  command: refresh.paths.allSoftwareUnattendedLearningAuditCommandTemplate
});
refresh.nextCommands.push({
  label: "Open recurring monitor teacher confirmation package before any scheduled task registration",
  command:
    recurringMonitorTeacherConfirmationPackage.htmlPath ||
    recurringMonitorTeacherConfirmationPackage.readmePath ||
    recurringMonitorTeacherConfirmationPackage.packagePath ||
    ""
});
refresh.nextCommands.push({
  label: "Validate teacher-filled recurring monitor confirmation receipt before rerunning approval gate",
  command: refresh.paths.recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate
});
refresh.nextCommands.push({
  label: "Dry-run recurring monitor registration runner after confirmed approval gate",
  command: refresh.paths.recurringMonitorRegistrationRunnerDryRunCommandTemplate
});
refresh.nextCommands.push({
  label: "Verify recurring monitor scheduled-task status after teacher-executed registration",
  command: refresh.paths.recurringMonitorRegistrationStatusVerifierCommandTemplate
});
refresh.nextCommands.push({
  label: "Regenerate recurring monitor teacher confirmation package from schedule, approval gate, and audit",
  command: refresh.paths.recurringMonitorTeacherConfirmationPackageCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser command builder for one ready operational registration execute gate",
  command:
    operationalRegistrationApprovedCommandBuilder.paths?.html ||
    operationalRegistrationApprovedCommandBuilder.paths?.builder ||
    ""
});
refresh.nextCommands.push({
  label: "Regenerate operational registration approved command builder from a ready registration gate",
  command: operationalRegistrationApprovedCommandBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser command builder for one matching post-registration output witness",
  command:
    operationalPostRegistrationOutputWitnessCommandBuilder.paths?.html ||
    operationalPostRegistrationOutputWitnessCommandBuilder.paths?.builder ||
    ""
});
refresh.nextCommands.push({
  label: "Regenerate operational post-registration output witness command builder from matching status",
  command: operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Open browser receipt builder for one post-registration output witness run",
  command:
    operationalPostRegistrationOutputWitnessReceiptBuilder.htmlPath ||
    operationalPostRegistrationOutputWitnessReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.push({
  label: "Regenerate post-registration output witness receipt builder from one runner result",
  command: operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate
});
refresh.nextCommands.push({
  label: "Validate teacher-filled post-registration output witness receipt",
  command: operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate
});
refresh.paths.ruleDslDeliveryGateAudit = sourceRuleDslDeliveryGateAudit;
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder = sourceRuleDslDeliveryGateAuditReviewReceiptBuilder;
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath || "";
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath || "";
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand || "";
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidation =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidation;
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidation =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidation;
refresh.discoveredEvidence.ruleDslDeliveryGateAudit = sourceRuleDslDeliveryGateAudit;
refresh.discoveredEvidence.ruleDslDeliveryGateAuditStatus = sourceRuleDslDeliveryGateAuditPacket?.status || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilder =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilder;
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptValidation =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidation;
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationStatus =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptValidation =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidation;
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationStatus =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status || "";
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReady =
  sourceRuleDslDeliveryGateAuditPacket?.format === "transparent_ai_rag_delivery_gate_audit_trail_v1" &&
  sourceRuleDslDeliveryGateAuditPacket?.status === "audit_trail_ready_for_teacher_review" &&
  sourceRuleDslDeliveryGateAuditPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditStatus =
  sourceRuleDslDeliveryGateAuditPacket?.status || "missing_rule_dsl_delivery_gate_audit_trail";
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilderReady =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.format ===
    "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.reviewOnly === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptTemplateReady =
  Boolean(sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath) &&
  existsSync(sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket.receiptTemplatePath);
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationCommandReady =
  Boolean(sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand);
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationStatus =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status ||
  "missing_rule_dsl_delivery_gate_audit_review_receipt_validation";
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationWaitingForTeacher =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.format ===
    "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status === "waiting_for_teacher_review" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.nextReview?.mayPrepareReviewOnlyFollowUpQueue === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.reviewOnly === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationReadyForFollowUpQueue =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.format ===
    "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status ===
    "ready_for_review_only_follow_up_queue" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.nextReview?.mayPrepareReviewOnlyFollowUpQueue === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.reviewOnly === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationStatus =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status ||
  "missing_rule_dsl_delivery_gate_audit_review_receipt_validation";
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationWaitingForTeacher =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.format ===
    "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status === "waiting_for_teacher_review" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.nextReview?.mayPrepareReviewOnlyFollowUpQueue === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.reviewOnly === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationReadyForFollowUpQueue =
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.format ===
    "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.status ===
    "ready_for_review_only_follow_up_queue" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.nextReview?.mayPrepareReviewOnlyFollowUpQueue === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.reviewOnly === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptValidationPacket?.locks?.packagingUnlocked === false;
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const originalGoalCompletionBlockerMatrix = runNodeScript(
  "create-original-goal-completion-blocker-matrix.mjs",
  [
    "--goal",
    goal,
    "--status-refresh",
    refreshPath,
    "--output-dir",
    join(refreshDir, "completion-blocker-matrix")
  ]
);
const originalGoalCompletionBlockerNextStepQueue = runNodeScript(
  "create-original-goal-completion-blocker-next-step-queue.mjs",
  [
    "--goal",
    goal,
    "--matrix",
    originalGoalCompletionBlockerMatrix.matrixPath || "",
    "--output-dir",
    join(refreshDir, "completion-blocker-next-step-queue")
  ]
);
const originalGoalCompletionBlockerLaneCommandBuilder = runNodeScript(
  "create-original-goal-completion-blocker-lane-command-builder.mjs",
  [
    "--goal",
    goal,
    "--queue",
    originalGoalCompletionBlockerNextStepQueue.queuePath || "",
    "--output-dir",
    join(refreshDir, "completion-blocker-lane-command-builder")
  ]
);
const originalGoalObjectiveFulfillmentAudit = runNodeScript(
  "create-original-goal-objective-fulfillment-audit.mjs",
  [
    "--refresh",
    refreshPath,
    "--output-dir",
    join(refreshDir, "objective-fulfillment-audit")
  ]
);
const originalGoalObjectiveFulfillmentNextStepQueue = runNodeScript(
  "create-original-goal-objective-fulfillment-next-step-queue.mjs",
  [
    "--audit",
    originalGoalObjectiveFulfillmentAudit.auditPath || "",
    "--output-dir",
    join(refreshDir, "objective-fulfillment-next-step-queue")
  ]
);
const originalGoalLowTokenMonitorCommandBridge = runNodeScript(
  "create-original-goal-low-token-monitor-command-bridge.mjs",
  [
    "--queue",
    originalGoalObjectiveFulfillmentNextStepQueue.queuePath || "",
    "--output-dir",
    join(refreshDir, "low-token-monitor-command-bridge")
  ]
);
const originalGoalLowTokenMonitorCommandBridgePacket =
  originalGoalLowTokenMonitorCommandBridge.bridgePath && existsSync(originalGoalLowTokenMonitorCommandBridge.bridgePath)
    ? readJson(originalGoalLowTokenMonitorCommandBridge.bridgePath)
    : null;
const originalGoalLowTokenMonitorBridgeReceiptBuilder =
  originalGoalLowTokenMonitorCommandBridge.bridgePath
    ? runNodeScript("create-original-goal-low-token-monitor-bridge-receipt-builder.mjs", [
        "--bridge",
        originalGoalLowTokenMonitorCommandBridge.bridgePath,
        "--output-dir",
        join(refreshDir, "low-token-monitor-bridge-receipt-builder")
      ])
    : {};
const originalGoalLowTokenMonitorBridgeReceiptBuilderPacket =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath &&
  existsSync(originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath)
    ? readJson(originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath)
    : null;
const originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate = commandLine(
  "validate-original-goal-low-token-monitor-bridge-receipt.mjs",
  [
    [
      "--bridge",
      originalGoalLowTokenMonitorCommandBridge.bridgePath ||
        "<original-goal-low-token-monitor-command-bridge.json>"
    ],
    ["--receipt", "<teacher-filled-low-token-monitor-bridge-receipt.json>"],
    ["--output-dir", join(refreshDir, "low-token-monitor-bridge-receipt-validation")]
  ]
);
const originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate = commandLine(
  "create-original-goal-low-token-monitor-selected-route-command-builder.mjs",
  [
    ["--validation", "<low-token-monitor-bridge-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "low-token-monitor-selected-route-command-builder")]
  ]
);
refresh.paths.originalGoalCompletionBlockerMatrix = originalGoalCompletionBlockerMatrix.matrixPath || "";
refresh.paths.originalGoalCompletionBlockerMatrixHtml = originalGoalCompletionBlockerMatrix.htmlPath || "";
refresh.paths.originalGoalCompletionBlockerMatrixReadme = originalGoalCompletionBlockerMatrix.readmePath || "";
refresh.paths.originalGoalCompletionBlockerNextStepQueue =
  originalGoalCompletionBlockerNextStepQueue.queuePath || "";
refresh.paths.originalGoalCompletionBlockerNextStepQueueHtml =
  originalGoalCompletionBlockerNextStepQueue.htmlPath || "";
refresh.paths.originalGoalCompletionBlockerNextStepQueueReadme =
  originalGoalCompletionBlockerNextStepQueue.readmePath || "";
refresh.paths.originalGoalCompletionBlockerLaneCommandBuilder =
  originalGoalCompletionBlockerLaneCommandBuilder.builderPath || "";
refresh.paths.originalGoalCompletionBlockerLaneCommandBuilderHtml =
  originalGoalCompletionBlockerLaneCommandBuilder.htmlPath || "";
refresh.paths.originalGoalCompletionBlockerLaneCommandBuilderReadme =
  originalGoalCompletionBlockerLaneCommandBuilder.readmePath || "";
refresh.paths.originalGoalObjectiveFulfillmentAudit =
  originalGoalObjectiveFulfillmentAudit.auditPath || "";
refresh.paths.originalGoalObjectiveFulfillmentAuditHtml =
  originalGoalObjectiveFulfillmentAudit.htmlPath || "";
refresh.paths.originalGoalObjectiveFulfillmentNextStepQueue =
  originalGoalObjectiveFulfillmentNextStepQueue.queuePath || "";
refresh.paths.originalGoalObjectiveFulfillmentNextStepQueueHtml =
  originalGoalObjectiveFulfillmentNextStepQueue.htmlPath || "";
refresh.paths.originalGoalObjectiveFulfillmentNextStepQueueReadme =
  originalGoalObjectiveFulfillmentNextStepQueue.readmePath || "";
refresh.paths.originalGoalLowTokenMonitorCommandBridge =
  originalGoalLowTokenMonitorCommandBridge.bridgePath || "";
refresh.paths.originalGoalLowTokenMonitorCommandBridgeHtml =
  originalGoalLowTokenMonitorCommandBridge.htmlPath || "";
refresh.paths.originalGoalLowTokenMonitorCommandBridgeReadme =
  originalGoalLowTokenMonitorCommandBridge.readmePath || "";
refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilder =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath || "";
refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderReadme =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.readmePath || "";
refresh.paths.originalGoalLowTokenMonitorBridgeReceiptTemplate =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate =
  originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate;
refresh.paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate =
  originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate;
refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate =
  originalGoalCompletionBlockerLaneRequestReceiptBuilderCommand(refreshDir);
refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate =
  originalGoalCompletionBlockerLaneRequestReceiptValidationCommand(refreshDir);
refresh.paths.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate =
  originalGoalCompletionBlockerLaneRequestRunnerCommand(refreshDir);
refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate =
  originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommand(refreshDir);
refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate =
  originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommand(refreshDir);
refresh.paths.ruleDslDeliveryGateAudit = sourceRuleDslDeliveryGateAudit;
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder = sourceRuleDslDeliveryGateAuditReviewReceiptBuilder;
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath || "";
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath || "";
refresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand || "";
refresh.paths.originalGoalFinalCompletionGateCommandTemplate =
  originalGoalFinalCompletionGateCommand(
    refreshDir,
    originalGoalCompletionBlockerMatrix.matrixPath || "<original-goal-completion-blocker-matrix.json>",
    sourceRuleDslDeliveryGateAudit || "<rag-delivery-gate-audit-trail.json>",
    {
      lowTokenCoverageGate:
        sourceOriginalGoalLowTokenCoverageCompletionGate || "<original-goal-low-token-coverage-completion-gate.json>",
      realLocalReadinessPackage:
        sourceRealLocalReadinessPackage || "<real-local-all-software-low-token-readiness-package.json>",
      teacherMethodContractReceiptValidation:
        sourceTeacherMethodExecutionLearningContractReceiptValidation ||
        "<teacher-method-execution-learning-contract-receipt-validation.json>",
      teacherMethodReuseResultProofValidation:
        sourceTeacherMethodReuseResultProofValidation || "<teacher-method-reuse-result-proof-validation.json>",
      unattendedAudit: allSoftwareUnattendedLearningAudit.auditPath || "<all-software-unattended-learning-audit.json>",
      sketchImplementationAudit:
        sourceSketchDemonstrationImplementationAudit || "<sketch-demonstration-implementation-audit.json>",
      spatialIntentReceiptValidation:
        sourceSpatialIntentEvidenceReceiptValidation || "<spatial-intent-evidence-receipt-validation.json>",
      executionConvergenceAudit:
        sourceExecutionConvergence || "<all-software-execution-capability-convergence-audit.json>"
    }
  );
refresh.discoveredEvidence.originalGoalCompletionBlockerMatrix =
  originalGoalCompletionBlockerMatrix.matrixPath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerMatrixHtml =
  originalGoalCompletionBlockerMatrix.htmlPath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerMatrixReadme =
  originalGoalCompletionBlockerMatrix.readmePath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerMatrixStatus =
  originalGoalCompletionBlockerMatrix.status || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerMatrixRows =
  originalGoalCompletionBlockerMatrix.rowCount || 0;
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueue =
  originalGoalCompletionBlockerNextStepQueue.queuePath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueueHtml =
  originalGoalCompletionBlockerNextStepQueue.htmlPath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueueReadme =
  originalGoalCompletionBlockerNextStepQueue.readmePath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueueStatus =
  originalGoalCompletionBlockerNextStepQueue.status || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueueDecision =
  originalGoalCompletionBlockerNextStepQueue.queueDecision || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueueItems =
  originalGoalCompletionBlockerNextStepQueue.queueItems || 0;
refresh.discoveredEvidence.originalGoalCompletionBlockerNextStepQueueGatedItems =
  originalGoalCompletionBlockerNextStepQueue.gatedItems || 0;
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilder =
  originalGoalCompletionBlockerLaneCommandBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderHtml =
  originalGoalCompletionBlockerLaneCommandBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderReadme =
  originalGoalCompletionBlockerLaneCommandBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentAudit =
  originalGoalObjectiveFulfillmentAudit.auditPath || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentAuditHtml =
  originalGoalObjectiveFulfillmentAudit.htmlPath || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentAuditStatus =
  originalGoalObjectiveFulfillmentAudit.status || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentAuditRequirementCount =
  originalGoalObjectiveFulfillmentAudit.requirementCount || 0;
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentNextStepQueue =
  originalGoalObjectiveFulfillmentNextStepQueue.queuePath || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentNextStepQueueHtml =
  originalGoalObjectiveFulfillmentNextStepQueue.htmlPath || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentNextStepQueueStatus =
  originalGoalObjectiveFulfillmentNextStepQueue.status || "";
refresh.discoveredEvidence.originalGoalObjectiveFulfillmentNextStepQueueItems =
  originalGoalObjectiveFulfillmentNextStepQueue.queueItems || 0;
refresh.discoveredEvidence.originalGoalLowTokenMonitorCommandBridge =
  originalGoalLowTokenMonitorCommandBridge.bridgePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorCommandBridgeHtml =
  originalGoalLowTokenMonitorCommandBridge.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorCommandBridgeReadme =
  originalGoalLowTokenMonitorCommandBridge.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorCommandBridgeStatus =
  originalGoalLowTokenMonitorCommandBridge.status || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorCommandBridgeRoutes =
  originalGoalLowTokenMonitorCommandBridge.routes || 0;
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilder =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.htmlPath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderReadme =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.readmePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptTemplate =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.receiptTemplatePath || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderStatus =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.status || "";
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderRoutes =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.routeCount || 0;
refresh.discoveredEvidence.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate =
  originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate;
refresh.discoveredEvidence.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate =
  originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate;
refresh.discoveredEvidence.ruleDslDeliveryGateAudit = sourceRuleDslDeliveryGateAudit;
refresh.discoveredEvidence.ruleDslDeliveryGateAuditStatus =
  sourceRuleDslDeliveryGateAuditPacket?.status || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilder =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilder;
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath || "";
refresh.discoveredEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand || "";
refresh.discoveredEvidence.originalGoalFinalCompletionGateCommandTemplate =
  refresh.paths.originalGoalFinalCompletionGateCommandTemplate || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderStatus =
  originalGoalCompletionBlockerLaneCommandBuilder.status || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderItems =
  originalGoalCompletionBlockerLaneCommandBuilder.queueItems || 0;
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderGatedItems =
  originalGoalCompletionBlockerLaneCommandBuilder.gatedItems || 0;
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderRequestPacketsDir =
  originalGoalCompletionBlockerLaneCommandBuilder.requestPacketsDir || "";
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPackets =
  originalGoalCompletionBlockerLaneCommandBuilder.offlineRequestPackets || 0;
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate =
  originalGoalCompletionBlockerLaneRequestReceiptBuilderCommand(refreshDir);
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate =
  originalGoalCompletionBlockerLaneRequestReceiptValidationCommand(refreshDir);
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate =
  originalGoalCompletionBlockerLaneRequestRunnerCommand(refreshDir);
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate =
  originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommand(refreshDir);
refresh.discoveredEvidence.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate =
  originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommand(refreshDir);
refresh.refreshedEvidence.originalGoalCompletionBlockerMatrixReady =
  originalGoalCompletionBlockerMatrix.status === "waiting_for_teacher_completion_blocker_review" &&
  Boolean(originalGoalCompletionBlockerMatrix.htmlPath);
refresh.refreshedEvidence.originalGoalCompletionBlockerMatrixRows =
  originalGoalCompletionBlockerMatrix.rowCount || 0;
refresh.refreshedEvidence.originalGoalCompletionBlockerNextStepQueueReady =
  originalGoalCompletionBlockerNextStepQueue.status === "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
  Boolean(originalGoalCompletionBlockerNextStepQueue.htmlPath);
refresh.refreshedEvidence.originalGoalCompletionBlockerNextStepQueueItems =
  originalGoalCompletionBlockerNextStepQueue.queueItems || 0;
refresh.refreshedEvidence.originalGoalCompletionBlockerNextStepQueueGatedItems =
  originalGoalCompletionBlockerNextStepQueue.gatedItems || 0;
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneCommandBuilderReady =
  originalGoalCompletionBlockerLaneCommandBuilder.status ===
    "waiting_for_teacher_single_completion_blocker_lane_command_generation" &&
  Boolean(originalGoalCompletionBlockerLaneCommandBuilder.htmlPath);
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneCommandBuilderItems =
  originalGoalCompletionBlockerLaneCommandBuilder.queueItems || 0;
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneCommandBuilderGatedItems =
  originalGoalCompletionBlockerLaneCommandBuilder.gatedItems || 0;
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPackets =
  originalGoalCompletionBlockerLaneCommandBuilder.offlineRequestPackets || 0;
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPacketsReady =
  Boolean(originalGoalCompletionBlockerLaneCommandBuilder.requestPacketsDir) &&
  (originalGoalCompletionBlockerLaneCommandBuilder.offlineRequestPackets || 0) >=
    (originalGoalCompletionBlockerLaneCommandBuilder.queueItems || 0);
refresh.refreshedEvidence.originalGoalObjectiveFulfillmentAuditReady =
  originalGoalObjectiveFulfillmentAudit.status === "objective_not_fulfilled_yet" &&
  Boolean(originalGoalObjectiveFulfillmentAudit.htmlPath);
refresh.refreshedEvidence.originalGoalObjectiveFulfillmentRequirementCount =
  originalGoalObjectiveFulfillmentAudit.requirementCount || 0;
refresh.refreshedEvidence.originalGoalObjectiveFulfillmentCompletionAllowed =
  originalGoalObjectiveFulfillmentAudit.completionAllowed === true;
refresh.refreshedEvidence.originalGoalObjectiveFulfillmentNextStepQueueReady =
  originalGoalObjectiveFulfillmentNextStepQueue.status === "objective_follow_up_queue_ready" &&
  Boolean(originalGoalObjectiveFulfillmentNextStepQueue.htmlPath);
refresh.refreshedEvidence.originalGoalObjectiveFulfillmentNextStepQueueItems =
  originalGoalObjectiveFulfillmentNextStepQueue.queueItems || 0;
refresh.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeReady =
  originalGoalLowTokenMonitorCommandBridge.status === "low_token_monitor_command_bridge_ready_for_teacher_review" &&
  Boolean(originalGoalLowTokenMonitorCommandBridge.htmlPath);
refresh.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeStatus =
  originalGoalLowTokenMonitorCommandBridge.status || "";
refresh.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeRoutes =
  originalGoalLowTokenMonitorCommandBridge.routes || 0;
refresh.refreshedEvidence.originalGoalLowTokenMonitorEvidenceAwareRecommendedRoute =
  originalGoalLowTokenMonitorCommandBridgePacket?.recommendedTeacherRouteId || "";
refresh.refreshedEvidence.originalGoalLowTokenMonitorNextEvidenceAwareAction =
  originalGoalLowTokenMonitorCommandBridgePacket?.nextEvidenceAwareAction || "";
refresh.refreshedEvidence.originalGoalLowTokenMonitorCoverageArtifactsReady =
  originalGoalLowTokenMonitorCommandBridgePacket?.evidenceContext?.coverageArtifactsReady === true;
refresh.refreshedEvidence.originalGoalLowTokenMonitorReadinessPackageReady =
  originalGoalLowTokenMonitorCommandBridgePacket?.evidenceContext?.readinessPackageReady === true;
refresh.refreshedEvidence.originalGoalLowTokenMonitorLogSourceMissingRows =
  originalGoalLowTokenMonitorCommandBridgePacket?.evidenceContext?.logSourceMissingRows ?? null;
refresh.refreshedEvidence.originalGoalLowTokenMonitorCoverageRouteStatus =
  (originalGoalLowTokenMonitorCommandBridgePacket?.recommendedRouteOrder || []).find(
    (route) => route.routeId === "existing_low_token_coverage_review"
  )?.routeStatus || "";
refresh.refreshedEvidence.originalGoalLowTokenMonitorTeacherConfirmationRouteStatus =
  (originalGoalLowTokenMonitorCommandBridgePacket?.recommendedRouteOrder || []).find(
    (route) => route.routeId === "existing_recurring_monitor_teacher_confirmation"
  )?.routeStatus || "";
refresh.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeCompletionAllowed =
  originalGoalLowTokenMonitorCommandBridge.completionAllowed === true;
refresh.refreshedEvidence.originalGoalLowTokenMonitorCommandBridgeNoSystemChange =
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotRunCommands === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotRegisterTask === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotLaunchRunner === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotReadLogs === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotReadFullLogs === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotCaptureScreenshots === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.bridgeDoesNotWriteMemory === true &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.softwareActionsExecuted === false &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.nativeUniversalExecution === false &&
  originalGoalLowTokenMonitorCommandBridgePacket?.locks?.goalComplete === false;
refresh.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderReady =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.status ===
    "waiting_for_teacher_low_token_monitor_bridge_receipt" &&
  Boolean(originalGoalLowTokenMonitorBridgeReceiptBuilder.htmlPath) &&
  Boolean(originalGoalLowTokenMonitorBridgeReceiptBuilder.receiptTemplatePath);
refresh.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderStatus =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.status || "";
refresh.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderRoutes =
  originalGoalLowTokenMonitorBridgeReceiptBuilder.routeCount || 0;
refresh.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptBuilderNoSystemChange =
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotRunCommands === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotRegisterTask === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotLaunchRunner === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotReadLogs === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotReadFullLogs === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotCaptureScreenshots === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.builderDoesNotWriteMemory === true &&
  originalGoalLowTokenMonitorBridgeReceiptBuilderPacket?.locks?.goalComplete === false;
refresh.refreshedEvidence.originalGoalLowTokenMonitorBridgeReceiptValidationCommandReady =
  originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate.includes(
    "validate-original-goal-low-token-monitor-bridge-receipt.mjs"
  ) &&
  originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate.includes(
    "<teacher-filled-low-token-monitor-bridge-receipt.json>"
  );
refresh.refreshedEvidence.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandReady =
  originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate.includes(
    "create-original-goal-low-token-monitor-selected-route-command-builder.mjs"
  ) &&
  originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate.includes(
    "<low-token-monitor-bridge-receipt-validation.json>"
  );
directReviewEntryPoints.push({
  id: "original_goal_objective_fulfillment_audit",
  label: "Original-goal objective fulfillment audit",
  path: originalGoalObjectiveFulfillmentAudit.htmlPath || originalGoalObjectiveFulfillmentAudit.auditPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_objective_fulfillment_next_step_queue",
  label: "Original-goal objective fulfillment next-step queue",
  path: originalGoalObjectiveFulfillmentNextStepQueue.htmlPath || originalGoalObjectiveFulfillmentNextStepQueue.queuePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_monitor_command_bridge",
  label: "Original-goal low-token monitor command bridge",
  path: originalGoalLowTokenMonitorCommandBridge.htmlPath || originalGoalLowTokenMonitorCommandBridge.bridgePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_low_token_monitor_bridge_receipt_builder",
  label: "Original-goal low-token monitor bridge receipt builder",
  path:
    originalGoalLowTokenMonitorBridgeReceiptBuilder.htmlPath ||
    originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath ||
    "",
  url: ""
});
refresh.nextCommands.push({
  label: "Open original-goal objective fulfillment audit before selecting the low-token monitor lane",
  command: originalGoalObjectiveFulfillmentAudit.htmlPath || originalGoalObjectiveFulfillmentAudit.auditPath || ""
});
refresh.nextCommands.push({
  label: "Open objective next-step queue and choose one unfinished requirement lane",
  command: originalGoalObjectiveFulfillmentNextStepQueue.htmlPath || originalGoalObjectiveFulfillmentNextStepQueue.queuePath || ""
});
refresh.nextCommands.push({
  label: "Open low-token monitor command bridge before any recurring monitor registration",
  command: originalGoalLowTokenMonitorCommandBridge.htmlPath || originalGoalLowTokenMonitorCommandBridge.bridgePath || ""
});
refresh.nextCommands.push({
  label: "Open low-token monitor bridge receipt builder so teacher can choose one low-token route",
  command:
    originalGoalLowTokenMonitorBridgeReceiptBuilder.htmlPath ||
    originalGoalLowTokenMonitorBridgeReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.push({
  label: "After teacher fills the low-token monitor bridge receipt, validate it before any route command builder",
  command: originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate
});
refresh.nextCommands.push({
  label: "After validation says routeReadyForLaterGate=true, build selected low-token route command package",
  command: originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate
});
refresh.refreshedEvidence.openCompletionBlockerLanes = compactCompletionBlockerLanes(
  originalGoalCompletionBlockerMatrix.matrixPath,
  originalGoalCompletionBlockerNextStepQueue.queuePath
);
refresh.refreshedEvidence.openCompletionBlockerLaneCount =
  refresh.refreshedEvidence.openCompletionBlockerLanes.length;
refresh.refreshedEvidence.openCompletionBlockerLanesWaitingForTeacher =
  refresh.refreshedEvidence.openCompletionBlockerLanes.every((lane) =>
    [
      "blocked_or_waiting_for_teacher_reviewed_evidence",
      "ready_for_review_only_manual_follow_up",
      "waiting_for_placeholder_replacement",
      "gated_until_teacher_receipt_and_rollback"
    ].includes(lane.status)
  );
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneRequestReceiptGateReady = true;
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneRequestRunnerCommandReady = true;
refresh.refreshedEvidence.originalGoalCompletionBlockerLaneRunReviewReceiptGateReady = true;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReady =
  sourceRuleDslDeliveryGateAuditPacket?.format === "transparent_ai_rag_delivery_gate_audit_trail_v1" &&
  sourceRuleDslDeliveryGateAuditPacket?.status === "audit_trail_ready_for_teacher_review" &&
  sourceRuleDslDeliveryGateAuditPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditStatus =
  sourceRuleDslDeliveryGateAuditPacket?.status || "missing_rule_dsl_delivery_gate_audit_trail";
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilderReady =
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.format ===
    "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1" &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.reviewOnly === true &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.ruleEnabled === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.softwareActionsExecuted === false &&
  sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.locks?.packagingUnlocked === false;
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptTemplateReady =
  Boolean(sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath) &&
  existsSync(sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket.receiptTemplatePath);
refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationCommandReady =
  Boolean(sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand);
refresh.refreshedEvidence.originalGoalFinalCompletionGateCommandReady =
  String(refresh.paths.originalGoalFinalCompletionGateCommandTemplate || "").includes(
    "validate-original-goal-final-completion-gate.mjs"
  ) &&
  String(refresh.paths.originalGoalFinalCompletionGateCommandTemplate || "").includes(
    "--rule-dsl-delivery-gate-audit"
  );
if (sourceRuleDslDeliveryGateAudit) {
  directReviewEntryPoints.push({
    id: "rule_dsl_delivery_gate_audit_trail",
    label: "Rule DSL delivery-gate audit trail",
    path: sourceRuleDslDeliveryGateAudit,
    url: ""
  });
}
if (sourceRuleDslDeliveryGateAuditReviewReceiptBuilder) {
  directReviewEntryPoints.push({
    id: "rule_dsl_delivery_gate_audit_review_receipt_builder",
    label: "Rule DSL delivery-gate audit review receipt builder",
    path:
      sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath ||
      sourceRuleDslDeliveryGateAuditReviewReceiptBuilder,
    url: ""
  });
}
if (sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath) {
  directReviewEntryPoints.push({
    id: "rule_dsl_delivery_gate_audit_review_receipt_template",
    label: "Rule DSL delivery-gate audit review receipt template",
    path: sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket.receiptTemplatePath,
    url: ""
  });
}
refresh.nextCommands.splice(12, 0, {
  label: sourceRuleDslDeliveryGateAuditReviewReceiptBuilder
    ? "Open Rule DSL delivery-gate audit review receipt workbench"
    : "Create Rule DSL delivery-gate audit review receipt builder from existing audit trail",
  command: sourceRuleDslDeliveryGateAuditReviewReceiptBuilder
    ? sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.reviewWorkbenchHtmlPath ||
      sourceRuleDslDeliveryGateAuditReviewReceiptBuilder
    : commandLine("knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs", [
        ["--audit-trail", sourceRuleDslDeliveryGateAudit || "<rag-delivery-gate-audit-trail.json>"],
        ["--out-dir", join(refreshDir, "rag-delivery-gate-audit-review-receipt-builder")]
      ])
});
if (sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.receiptTemplatePath) {
  refresh.nextCommands.splice(13, 0, {
    label: "Fill Rule DSL delivery-gate audit review receipt template",
    command: sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket.receiptTemplatePath
  });
}
if (sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket?.validationCommand) {
  refresh.nextCommands.splice(14, 0, {
    label: "Validate teacher-filled Rule DSL delivery-gate audit review receipt",
    command: sourceRuleDslDeliveryGateAuditReviewReceiptBuilderPacket.validationCommand
  });
}
directReviewEntryPoints.push({
  id: "original_goal_completion_blocker_matrix",
  label: "Original goal completion blocker matrix",
  path: originalGoalCompletionBlockerMatrix.htmlPath || originalGoalCompletionBlockerMatrix.matrixPath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_completion_blocker_next_step_queue",
  label: "Original goal completion blocker next-step queue",
  path: originalGoalCompletionBlockerNextStepQueue.htmlPath || originalGoalCompletionBlockerNextStepQueue.queuePath || "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_completion_blocker_lane_command_builder",
  label: "Original goal completion blocker lane command builder",
  path:
    originalGoalCompletionBlockerLaneCommandBuilder.htmlPath ||
    originalGoalCompletionBlockerLaneCommandBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.push({
  id: "original_goal_completion_blocker_offline_lane_request_packets",
  label: "Offline completion blocker lane request packets",
  path: originalGoalCompletionBlockerLaneCommandBuilder.requestPacketsDir || "",
  url: ""
});
refresh.nextCommands.splice(2, 0, {
  label: "Run final completion gate only after all evidence chains, including Rule DSL delivery-gate audit, are ready",
  command: refresh.paths.originalGoalFinalCompletionGateCommandTemplate || ""
});
refresh.nextCommands.splice(3, 0, {
  label: "Open original-goal completion blocker matrix before claiming progress or completion",
  command: originalGoalCompletionBlockerMatrix.htmlPath || originalGoalCompletionBlockerMatrix.matrixPath || ""
});
refresh.nextCommands.splice(4, 0, {
  label: "Open original-goal completion blocker next-step queue and choose one low-token lane",
  command: originalGoalCompletionBlockerNextStepQueue.htmlPath || originalGoalCompletionBlockerNextStepQueue.queuePath || ""
});
refresh.nextCommands.splice(5, 0, {
  label: "Open completion blocker lane command builder for one teacher-reviewed lane",
  command:
    originalGoalCompletionBlockerLaneCommandBuilder.htmlPath ||
    originalGoalCompletionBlockerLaneCommandBuilder.builderPath ||
    ""
});
refresh.nextCommands.splice(6, 0, {
  label: "Open offline completion blocker lane request packets if the browser generator is unavailable",
  command: originalGoalCompletionBlockerLaneCommandBuilder.requestPacketsDir || ""
});
refresh.nextCommands.splice(7, 0, {
  label: "Create a teacher receipt template for the downloaded completion blocker lane request",
  command: originalGoalCompletionBlockerLaneRequestReceiptBuilderCommand(refreshDir)
});
refresh.nextCommands.splice(8, 0, {
  label: "Validate the teacher-filled completion blocker lane request receipt before runner use",
  command: originalGoalCompletionBlockerLaneRequestReceiptValidationCommand(refreshDir)
});
refresh.nextCommands.splice(9, 0, {
  label: "Run one teacher-confirmed safe completion blocker lane request",
  command: originalGoalCompletionBlockerLaneRequestRunnerCommand(refreshDir)
});
refresh.nextCommands.splice(10, 0, {
  label: "Create a teacher review receipt for the completion blocker lane run result",
  command: originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommand(refreshDir)
});
refresh.nextCommands.splice(11, 0, {
  label: "Validate teacher review of the completion blocker lane run before refreshing status",
  command: originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommand(refreshDir)
});
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const originalGoalIntegratedControlFlowCommandTemplate = commandLine("create-original-goal-integrated-control-flow.mjs", [
  ["--goal", goal],
  ["--refresh", refreshPath],
  ["--output-dir", join(refreshDir, "original-goal-integrated-control-flow")]
]);
const originalGoalIntegratedControlFlow = runNodeScript("create-original-goal-integrated-control-flow.mjs", [
  "--goal",
  goal,
  "--refresh",
  refreshPath,
  "--output-dir",
  join(refreshDir, "original-goal-integrated-control-flow")
]);
refresh.paths.originalGoalIntegratedControlFlowCommandTemplate = originalGoalIntegratedControlFlowCommandTemplate;
refresh.paths.originalGoalIntegratedControlFlow = originalGoalIntegratedControlFlow.flowPath || "";
refresh.paths.originalGoalIntegratedControlFlowHtml = originalGoalIntegratedControlFlow.htmlPath || "";
refresh.paths.originalGoalIntegratedControlFlowReadme = originalGoalIntegratedControlFlow.readmePath || "";
refresh.refreshedEvidence.originalGoalIntegratedControlFlowStatus =
  originalGoalIntegratedControlFlow.status || "";
refresh.refreshedEvidence.originalGoalIntegratedControlFlowStageCount =
  originalGoalIntegratedControlFlow.stageCount || 0;
refresh.refreshedEvidence.originalGoalIntegratedControlFlowRequirementCount =
  originalGoalIntegratedControlFlow.requirementCount || 0;
refresh.refreshedEvidence.originalGoalIntegratedControlFlowReviewOnly =
  originalGoalIntegratedControlFlow?.locks?.reviewOnly === true &&
  originalGoalIntegratedControlFlow?.locks?.integratedFlowDoesNotExecuteSoftware === true &&
  originalGoalIntegratedControlFlow?.locks?.integratedFlowDoesNotCaptureScreenshots === true &&
  originalGoalIntegratedControlFlow?.locks?.integratedFlowDoesNotWriteMemory === true &&
  originalGoalIntegratedControlFlow?.locks?.goalComplete === false;
directReviewEntryPoints.unshift({
  id: "original_goal_integrated_control_flow",
  label: "Original goal integrated control flow",
  path: originalGoalIntegratedControlFlow.htmlPath || originalGoalIntegratedControlFlow.flowPath || "",
  url: ""
});
refresh.nextCommands.unshift({
  label: "Open original-goal integrated control flow before choosing the next lane",
  command: originalGoalIntegratedControlFlow.htmlPath || originalGoalIntegratedControlFlow.readmePath || ""
});
refresh.nextCommands.splice(1, 0, {
  label: "Regenerate original-goal integrated control flow from this status refresh",
  command: originalGoalIntegratedControlFlowCommandTemplate
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_capability_matrix_coverage",
  status: originalGoalCapabilityMatrixCoverageAudit.ok
    ? "covered_review_only"
    : "missing_capability_matrix_coverage",
  detail: `Covered ${originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds?.length || 0}/${
    originalGoalCapabilityMatrixCoverageAudit.capabilityCount || 0
  } user-requested capability lanes; missing: ${(originalGoalCapabilityMatrixCoverageAudit.missingCapabilityIds || []).join(", ") || "none"}.`
});
refresh.nextCommands.splice(2, 0, {
  label: "Open original-goal capability matrix coverage audit",
  command: originalGoalCapabilityMatrixCoverageAuditHtmlPath
});
refresh.nextCommands.splice(3, 0, {
  label: "Rerun original-goal capability matrix coverage audit",
  command: originalGoalCapabilityMatrixCoverageAuditCommandTemplate
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_tlcl_rag_evidence_to_high_reasoning_repair_chain_audit",
  status: "available_review_only",
  detail:
    "Static audit command is surfaced so RAG evidence remains non-authoritative input to the high-reasoning repair layer, with medium-runtime continuation blocked until deterministic validation and teacher review."
});
refresh.nextCommands.splice(4, 0, {
  label: "Run TLCL RAG evidence to high-reasoning repair chain audit before treating retrieved knowledge as repair evidence",
  command: tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate
});
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const originalGoalNextConfirmationPack = runNodeScript("create-original-goal-next-confirmation-pack.mjs", [
  "--goal",
  goal,
  "--status-refresh",
  refreshPath,
  "--output-dir",
  join(refreshDir, "original-goal-next-confirmation-pack")
]);
const originalGoalNextConfirmationPackPacket =
  originalGoalNextConfirmationPack.paths?.pack && existsSync(originalGoalNextConfirmationPack.paths.pack)
    ? readJson(originalGoalNextConfirmationPack.paths.pack)
    : null;
const originalGoalNextConfirmationPackReceiptBuilder = runNodeScript(
  "create-original-goal-next-confirmation-pack-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--pack",
    originalGoalNextConfirmationPack.paths?.pack || "",
    "--output-dir",
    join(refreshDir, "original-goal-next-confirmation-pack-receipt-builder")
  ]
);
const originalGoalNextConfirmationPackReceiptBuilderPacket =
  originalGoalNextConfirmationPackReceiptBuilder.builderPath &&
  existsSync(originalGoalNextConfirmationPackReceiptBuilder.builderPath)
    ? readJson(originalGoalNextConfirmationPackReceiptBuilder.builderPath)
    : null;
const originalGoalNextConfirmationManualItem = (originalGoalNextConfirmationPackPacket?.confirmationItems || []).find(
  (item) => item.itemId === "low-token-manual-sensitive-3-rows"
);
refresh.paths.originalGoalNextConfirmationPack = originalGoalNextConfirmationPack.paths?.pack || "";
refresh.paths.originalGoalNextConfirmationPackHtml = originalGoalNextConfirmationPack.paths?.html || "";
refresh.paths.originalGoalNextConfirmationPackReadme = originalGoalNextConfirmationPack.paths?.readme || "";
refresh.paths.originalGoalNextConfirmationPackReceiptTemplate =
  originalGoalNextConfirmationPack.paths?.receiptTemplate || "";
refresh.paths.originalGoalNextConfirmationPackReceiptBuilder =
  originalGoalNextConfirmationPackReceiptBuilder.builderPath || "";
refresh.paths.originalGoalNextConfirmationPackReceiptBuilderHtml =
  originalGoalNextConfirmationPackReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalNextConfirmationPackReceiptBuilderReadme =
  originalGoalNextConfirmationPackReceiptBuilder.readmePath || "";
refresh.paths.originalGoalNextConfirmationPackReceiptBuilderTemplate =
  originalGoalNextConfirmationPackReceiptBuilder.receiptTemplatePath || "";
refresh.paths.originalGoalNextConfirmationPackReceiptValidationCommandTemplate =
  originalGoalNextConfirmationPackReceiptBuilder.nextValidationCommand || "";
refresh.refreshedEvidence.originalGoalNextConfirmationPackStatus =
  originalGoalNextConfirmationPackPacket?.status || originalGoalNextConfirmationPack.status || "";
refresh.refreshedEvidence.originalGoalNextConfirmationPackItems =
  originalGoalNextConfirmationPackPacket?.confirmationItems?.length || 0;
refresh.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderStatus =
  originalGoalNextConfirmationPackReceiptBuilderPacket?.status ||
  originalGoalNextConfirmationPackReceiptBuilder.status ||
  "";
refresh.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderRows =
  originalGoalNextConfirmationPackReceiptBuilderPacket?.counts?.reviewRows ??
  originalGoalNextConfirmationPackReceiptBuilder.reviewRows ??
  0;
refresh.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderReviewOnly =
  originalGoalNextConfirmationPackReceiptBuilderPacket?.locks?.reviewOnly === true &&
  originalGoalNextConfirmationPackReceiptBuilderPacket?.locks?.builderDoesNotReadFullLogs === true &&
  originalGoalNextConfirmationPackReceiptBuilderPacket?.locks?.builderDoesNotExecuteTargetSoftware === true &&
  originalGoalNextConfirmationPackReceiptBuilderPacket?.locks?.builderDoesNotRegisterSchedule === true &&
  originalGoalNextConfirmationPackReceiptBuilderPacket?.locks?.builderDoesNotWriteMemory === true &&
  originalGoalNextConfirmationPackReceiptBuilderPacket?.locks?.goalComplete === false;
refresh.refreshedEvidence.originalGoalNextConfirmationPackSensitiveManualRows =
  originalGoalNextConfirmationManualItem?.currentEvidence?.manualRows?.length ?? 0;
refresh.refreshedEvidence.originalGoalNextConfirmationPackCompactMetadataRows =
  originalGoalNextConfirmationPackPacket?.counts?.compactMetadataRows ?? 0;
refresh.refreshedEvidence.originalGoalNextConfirmationPackReviewOnly =
  originalGoalNextConfirmationPackPacket?.locks?.reviewOnly === true &&
  originalGoalNextConfirmationPackPacket?.locks?.confirmationPackDoesNotReadFullLogs === true &&
  originalGoalNextConfirmationPackPacket?.locks?.confirmationPackDoesNotCaptureScreenshots === true &&
  originalGoalNextConfirmationPackPacket?.locks?.confirmationPackDoesNotExecuteTargetSoftware === true &&
  originalGoalNextConfirmationPackPacket?.locks?.confirmationPackDoesNotRegisterSchedule === true &&
  originalGoalNextConfirmationPackPacket?.locks?.confirmationPackDoesNotWriteMemory === true &&
  originalGoalNextConfirmationPackPacket?.locks?.goalComplete === false;
directReviewEntryPoints.unshift({
  id: "original_goal_next_confirmation_pack_receipt_builder",
  label: "Open original-goal next confirmation receipt builder after reviewing the pack",
  path:
    originalGoalNextConfirmationPackReceiptBuilder.htmlPath ||
    originalGoalNextConfirmationPackReceiptBuilder.readmePath ||
    originalGoalNextConfirmationPackReceiptBuilder.builderPath ||
    "",
  url: ""
});
directReviewEntryPoints.unshift({
  id: "original_goal_next_confirmation_pack",
  label: "Open original-goal next confirmation pack before choosing any runner, screenshot, or execution lane",
  path:
    originalGoalNextConfirmationPack.paths?.html ||
    originalGoalNextConfirmationPack.paths?.readme ||
    originalGoalNextConfirmationPack.paths?.pack ||
    "",
  url: ""
});
refresh.nextCommands.unshift({
  label: "Open original-goal next confirmation receipt builder after reviewing the pack",
  command:
    originalGoalNextConfirmationPackReceiptBuilder.htmlPath ||
    originalGoalNextConfirmationPackReceiptBuilder.readmePath ||
    originalGoalNextConfirmationPackReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.unshift({
  label: "Open original-goal next confirmation pack before choosing any runner, screenshot, or execution lane",
  command:
    originalGoalNextConfirmationPack.paths?.html ||
    originalGoalNextConfirmationPack.paths?.readme ||
    originalGoalNextConfirmationPack.paths?.pack ||
    ""
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_next_confirmation_pack",
  status: originalGoalNextConfirmationPackPacket ? "waiting_for_teacher_next_confirmation_review" : "missing",
  detail: `Next confirmation pack summarizes ${
    originalGoalNextConfirmationPackPacket?.confirmationItems?.length || 0
  } teacher decisions, including ${
    originalGoalNextConfirmationManualItem?.currentEvidence?.manualRows?.length ?? 0
  } sensitive low-token rows, while keeping logs, screenshots, execution, schedules, memory, rules, packaging, and completion locked.`
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_next_confirmation_pack_receipt_builder",
  status: originalGoalNextConfirmationPackReceiptBuilderPacket
    ? "waiting_for_teacher_next_confirmation_pack_receipt"
    : "missing",
  detail: `Browser receipt builder covers ${
    originalGoalNextConfirmationPackReceiptBuilderPacket?.counts?.reviewRows ?? 0
  } next-confirmation items and only generates receipt JSON in the browser; it does not validate, execute, read logs, capture screenshots, register schedules, write memory, or claim completion.`
});
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
const originalGoalProofLedger = runNodeScript("create-original-goal-proof-ledger.mjs", [
  "--goal",
  goal,
  "--status-refresh",
  refreshPath,
  "--objective-audit",
  refresh.paths.originalGoalObjectiveFulfillmentAudit || "",
  "--next-confirmation-pack",
  refresh.paths.originalGoalNextConfirmationPack || "",
  "--output-dir",
  join(refreshDir, "original-goal-proof-ledger")
]);
const originalGoalProofLedgerPacket =
  originalGoalProofLedger.ledgerPath && existsSync(originalGoalProofLedger.ledgerPath)
    ? readJson(originalGoalProofLedger.ledgerPath)
    : null;
refresh.paths.originalGoalProofLedger = originalGoalProofLedger.ledgerPath || "";
refresh.paths.originalGoalProofLedgerHtml = originalGoalProofLedger.htmlPath || "";
refresh.paths.originalGoalProofLedgerReadme = originalGoalProofLedger.readmePath || "";
refresh.refreshedEvidence.originalGoalProofLedgerStatus =
  originalGoalProofLedgerPacket?.status || originalGoalProofLedger.status || "";
refresh.refreshedEvidence.originalGoalProofLedgerRequirementCount =
  originalGoalProofLedgerPacket?.counts?.requirementCount ?? 0;
refresh.refreshedEvidence.originalGoalProofLedgerMissingProofCount =
  originalGoalProofLedgerPacket?.counts?.missingProofCount ?? 0;
refresh.refreshedEvidence.originalGoalProofLedgerNotProvenCount =
  originalGoalProofLedgerPacket?.counts?.notProvenCount ?? 0;
refresh.refreshedEvidence.originalGoalProofLedgerCompletionAllowed =
  originalGoalProofLedgerPacket?.completionAllowed === true;
refresh.refreshedEvidence.originalGoalProofLedgerReviewOnly =
  originalGoalProofLedgerPacket?.locks?.reviewOnly === true &&
  originalGoalProofLedgerPacket?.locks?.ledgerDoesNotReadLogs === true &&
  originalGoalProofLedgerPacket?.locks?.ledgerDoesNotCaptureScreenshots === true &&
  originalGoalProofLedgerPacket?.locks?.ledgerDoesNotExecuteTargetSoftware === true &&
  originalGoalProofLedgerPacket?.locks?.ledgerDoesNotRegisterSchedule === true &&
  originalGoalProofLedgerPacket?.locks?.ledgerDoesNotWriteMemory === true &&
  originalGoalProofLedgerPacket?.locks?.goalComplete === false;
directReviewEntryPoints.splice(1, 0, {
  id: "original_goal_proof_ledger",
  label: "Open original-goal proof ledger to compare current evidence with the original objective",
  path:
    originalGoalProofLedger.htmlPath ||
    originalGoalProofLedger.readmePath ||
    originalGoalProofLedger.ledgerPath ||
    "",
  url: ""
});
refresh.nextCommands.splice(1, 0, {
  label: "Open original-goal proof ledger to compare current evidence with the original objective",
  command:
    originalGoalProofLedger.htmlPath ||
    originalGoalProofLedger.readmePath ||
    originalGoalProofLedger.ledgerPath ||
    ""
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_proof_ledger",
  status: originalGoalProofLedgerPacket ? "objective_not_proven_complete" : "missing",
  detail: `Original goal proof ledger maps ${
    originalGoalProofLedgerPacket?.counts?.requirementCount || 0
  } requested requirements to current evidence and ${
    originalGoalProofLedgerPacket?.counts?.missingProofCount || 0
  } missing proof items without reading logs, screenshots, execution, schedules, memory, rules, packaging, or completion claims.`
});
const originalGoalProofGapClosurePack = runNodeScript("create-original-goal-proof-gap-closure-pack.mjs", [
  "--goal",
  goal,
  "--status-refresh",
  refreshPath,
  "--proof-ledger",
  refresh.paths.originalGoalProofLedger,
  "--output-dir",
  join(refreshDir, "original-goal-proof-gap-closure-pack")
]);
const originalGoalProofGapClosurePackPacket =
  originalGoalProofGapClosurePack.packPath && existsSync(originalGoalProofGapClosurePack.packPath)
    ? readJson(originalGoalProofGapClosurePack.packPath)
    : null;
refresh.paths.originalGoalProofGapClosurePack = originalGoalProofGapClosurePack.packPath || "";
refresh.paths.originalGoalProofGapClosurePackHtml = originalGoalProofGapClosurePack.htmlPath || "";
refresh.paths.originalGoalProofGapClosurePackReadme = originalGoalProofGapClosurePack.readmePath || "";
refresh.refreshedEvidence.originalGoalProofGapClosurePackStatus =
  originalGoalProofGapClosurePackPacket?.status || originalGoalProofGapClosurePack.status || "";
refresh.refreshedEvidence.originalGoalProofGapClosurePackRoutes =
  originalGoalProofGapClosurePackPacket?.counts?.closureRoutes ?? 0;
refresh.refreshedEvidence.originalGoalProofGapClosurePackHighRiskGatedRoutes =
  originalGoalProofGapClosurePackPacket?.counts?.highRiskGatedRoutes ?? 0;
refresh.refreshedEvidence.originalGoalProofGapClosurePackReviewOnly =
  originalGoalProofGapClosurePackPacket?.locks?.reviewOnly === true &&
  originalGoalProofGapClosurePackPacket?.locks?.packDoesNotRunCommands === true &&
  originalGoalProofGapClosurePackPacket?.locks?.packDoesNotRegisterTask === true &&
  originalGoalProofGapClosurePackPacket?.locks?.packDoesNotLaunchRunner === true &&
  originalGoalProofGapClosurePackPacket?.locks?.packDoesNotExecuteTargetSoftware === true &&
  originalGoalProofGapClosurePackPacket?.locks?.packDoesNotCaptureScreenshots === true &&
  originalGoalProofGapClosurePackPacket?.locks?.packDoesNotWriteMemory === true &&
  originalGoalProofGapClosurePackPacket?.locks?.goalComplete === false;
directReviewEntryPoints.splice(2, 0, {
  id: "original_goal_proof_gap_closure_pack",
  label: "Original goal proof gap closure pack",
  path:
    originalGoalProofGapClosurePack.htmlPath ||
    originalGoalProofGapClosurePack.readmePath ||
    originalGoalProofGapClosurePack.packPath ||
    "",
  url: ""
});
refresh.nextCommands.splice(2, 0, {
  label: "Open original-goal proof gap closure pack to map each missing proof item to the next teacher-reviewed route",
  command:
    originalGoalProofGapClosurePack.htmlPath ||
    originalGoalProofGapClosurePack.readmePath ||
    originalGoalProofGapClosurePack.packPath ||
    ""
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_proof_gap_closure_pack",
  status: originalGoalProofGapClosurePackPacket
    ? "waiting_for_teacher_to_close_proof_gaps"
    : "missing",
  detail: `Original goal proof gap closure pack maps ${
    originalGoalProofGapClosurePackPacket?.counts?.closureRoutes || 0
  } missing proof items to existing teacher-review routes, including ${
    originalGoalProofGapClosurePackPacket?.counts?.highRiskGatedRoutes || 0
  } high-risk routes that remain blocked until teacher confirmation and rollback.`
});
const originalGoalProofGapTeacherQueue = runNodeScript("create-original-goal-proof-gap-teacher-queue.mjs", [
  "--goal",
  goal,
  "--closure-pack",
  refresh.paths.originalGoalProofGapClosurePack,
  "--output-dir",
  join(refreshDir, "original-goal-proof-gap-teacher-queue")
]);
const originalGoalProofGapTeacherQueuePacket =
  originalGoalProofGapTeacherQueue.queuePath && existsSync(originalGoalProofGapTeacherQueue.queuePath)
    ? readJson(originalGoalProofGapTeacherQueue.queuePath)
    : null;
refresh.paths.originalGoalProofGapTeacherQueue = originalGoalProofGapTeacherQueue.queuePath || "";
refresh.paths.originalGoalProofGapTeacherQueueHtml = originalGoalProofGapTeacherQueue.htmlPath || "";
refresh.paths.originalGoalProofGapTeacherQueueReadme = originalGoalProofGapTeacherQueue.readmePath || "";
refresh.paths.originalGoalProofGapTeacherQueueReceiptTemplate =
  originalGoalProofGapTeacherQueue.receiptTemplatePath || "";
refresh.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate =
  originalGoalProofGapTeacherQueue.receiptValidationCommandTemplate ||
  originalGoalProofGapTeacherQueuePacket?.paths?.receiptValidationCommandTemplate ||
  "";
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueStatus =
  originalGoalProofGapTeacherQueuePacket?.status || originalGoalProofGapTeacherQueue.status || "";
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueItems =
  originalGoalProofGapTeacherQueuePacket?.counts?.queueItems ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueHighRiskGatedItems =
  originalGoalProofGapTeacherQueuePacket?.counts?.highRiskGatedItems ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptRows =
  originalGoalProofGapTeacherQueuePacket?.counts?.receiptRows ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptValidationCommandReady =
  Boolean(refresh.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate);
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReviewOnly =
  originalGoalProofGapTeacherQueuePacket?.locks?.reviewOnly === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.queueDoesNotRunCommands === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.queueDoesNotRegisterTask === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.queueDoesNotLaunchRunner === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.queueDoesNotExecuteTargetSoftware === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.queueDoesNotCaptureScreenshots === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.queueDoesNotWriteMemory === true &&
  originalGoalProofGapTeacherQueuePacket?.locks?.goalComplete === false;
const originalGoalProofGapEvidencePrefill = runNodeScript(
  "create-original-goal-proof-gap-evidence-prefill.mjs",
  [
    "--goal",
    goal,
    "--queue",
    refresh.paths.originalGoalProofGapTeacherQueue,
    "--refresh",
    refreshPath,
    "--output-dir",
    join(refreshDir, "original-goal-proof-gap-evidence-prefill")
  ]
);
const originalGoalProofGapEvidencePrefillPacket =
  originalGoalProofGapEvidencePrefill.prefillPath &&
  existsSync(originalGoalProofGapEvidencePrefill.prefillPath)
    ? readJson(originalGoalProofGapEvidencePrefill.prefillPath)
    : null;
refresh.paths.originalGoalProofGapEvidencePrefill =
  originalGoalProofGapEvidencePrefill.prefillPath || "";
refresh.paths.originalGoalProofGapEvidencePrefillHtml =
  originalGoalProofGapEvidencePrefill.htmlPath || "";
refresh.paths.originalGoalProofGapEvidencePrefillReadme =
  originalGoalProofGapEvidencePrefill.readmePath || "";
refresh.paths.originalGoalProofGapEvidencePrefillCandidateReceiptDraft =
  originalGoalProofGapEvidencePrefill.candidateReceiptDraftPath || "";
refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillStatus =
  originalGoalProofGapEvidencePrefillPacket?.status || "";
refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillRows =
  originalGoalProofGapEvidencePrefillPacket?.counts?.rows ?? 0;
refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillRowsWithCandidateEvidence =
  originalGoalProofGapEvidencePrefillPacket?.counts?.rowsWithCandidateEvidence ?? 0;
refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillRowsStillNeedTeacherConfirmation =
  originalGoalProofGapEvidencePrefillPacket?.counts?.rowsStillNeedTeacherConfirmation ?? 0;
refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillReviewOnly =
  originalGoalProofGapEvidencePrefillPacket?.locks?.reviewOnly === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotClaimEvidenceAccepted === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotValidateReceipt === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotRunCommands === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotRegisterTask === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotExecuteTargetSoftware === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotCaptureScreenshots === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.prefillDoesNotWriteMemory === true &&
  originalGoalProofGapEvidencePrefillPacket?.locks?.goalComplete === false;
const originalGoalProofGapTeacherQueueReceiptBuilder = runNodeScript(
  "create-original-goal-proof-gap-teacher-queue-receipt-builder.mjs",
  [
    "--goal",
    goal,
    "--queue",
    refresh.paths.originalGoalProofGapTeacherQueue,
    "--output-dir",
    join(refreshDir, "original-goal-proof-gap-teacher-queue-receipt-builder")
  ]
);
const originalGoalProofGapTeacherQueueReceiptBuilderPacket =
  originalGoalProofGapTeacherQueueReceiptBuilder.builderPath &&
  existsSync(originalGoalProofGapTeacherQueueReceiptBuilder.builderPath)
    ? readJson(originalGoalProofGapTeacherQueueReceiptBuilder.builderPath)
    : null;
refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilder =
  originalGoalProofGapTeacherQueueReceiptBuilder.builderPath || "";
refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilderHtml =
  originalGoalProofGapTeacherQueueReceiptBuilder.htmlPath || "";
refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilderReadme =
  originalGoalProofGapTeacherQueueReceiptBuilder.readmePath || "";
refresh.paths.originalGoalProofGapTeacherQueueReceiptTemplate =
  originalGoalProofGapTeacherQueueReceiptBuilder.receiptTemplatePath ||
  refresh.paths.originalGoalProofGapTeacherQueueReceiptTemplate ||
  "";
refresh.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate =
  originalGoalProofGapTeacherQueueReceiptBuilder.nextValidationCommand ||
  refresh.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate ||
  "";
refresh.paths.originalGoalProofGapValidationHandoffQueueCommandTemplate = commandLine(
  "create-original-goal-proof-gap-validation-handoff-queue.mjs",
  [
    ["--validation", "<original-goal-proof-gap-teacher-queue-receipt-validation.json>"],
    ["--output-dir", join(refreshDir, "original-goal-proof-gap-validation-handoff-queue")]
  ]
);
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptBuilderStatus =
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.status ||
  originalGoalProofGapTeacherQueueReceiptBuilder.status ||
  "";
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptBuilderRows =
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.counts?.reviewRows ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptBuilderReviewOnly =
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.reviewOnly === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotWriteReceipt === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotValidateReceipt === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotRunCommands === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotRegisterTask === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotExecuteTargetSoftware === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotCaptureScreenshots === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.builderDoesNotWriteMemory === true &&
  originalGoalProofGapTeacherQueueReceiptBuilderPacket?.locks?.goalComplete === false;
refresh.refreshedEvidence.originalGoalProofGapValidationHandoffQueueCommandReady =
  Boolean(refresh.paths.originalGoalProofGapValidationHandoffQueueCommandTemplate);
const originalGoalProofGapTeacherReviewCockpit = runNodeScript(
  "create-original-goal-proof-gap-teacher-review-cockpit.mjs",
  [
    "--goal",
    goal,
    "--queue",
    refresh.paths.originalGoalProofGapTeacherQueue,
    "--prefill",
    refresh.paths.originalGoalProofGapEvidencePrefill,
    "--receipt-builder",
    refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilder,
    "--output-dir",
    join(refreshDir, "original-goal-proof-gap-teacher-review-cockpit")
  ]
);
const originalGoalProofGapTeacherReviewCockpitPacket =
  originalGoalProofGapTeacherReviewCockpit.cockpitPath &&
  existsSync(originalGoalProofGapTeacherReviewCockpit.cockpitPath)
    ? readJson(originalGoalProofGapTeacherReviewCockpit.cockpitPath)
    : null;
refresh.paths.originalGoalProofGapTeacherReviewCockpit =
  originalGoalProofGapTeacherReviewCockpit.cockpitPath || "";
refresh.paths.originalGoalProofGapTeacherReviewCockpitHtml =
  originalGoalProofGapTeacherReviewCockpit.htmlPath || "";
refresh.paths.originalGoalProofGapTeacherReviewCockpitReadme =
  originalGoalProofGapTeacherReviewCockpit.readmePath || "";
refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitStatus =
  originalGoalProofGapTeacherReviewCockpitPacket?.status || "";
refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitRows =
  originalGoalProofGapTeacherReviewCockpitPacket?.counts?.rows ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitRowsWithCandidateEvidence =
  originalGoalProofGapTeacherReviewCockpitPacket?.counts?.rowsWithCandidateEvidence ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitRowsStillNeedTeacherConfirmation =
  originalGoalProofGapTeacherReviewCockpitPacket?.counts?.rowsStillNeedTeacherConfirmation ?? 0;
refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitReviewOnly =
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.reviewOnly === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotFillReceipt === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotValidateReceipt === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotRunCommands === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotRegisterTask === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotExecuteTargetSoftware === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotCaptureScreenshots === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.cockpitDoesNotWriteMemory === true &&
  originalGoalProofGapTeacherReviewCockpitPacket?.locks?.goalComplete === false;
directReviewEntryPoints.splice(3, 0, {
  id: "original_goal_proof_gap_teacher_review_cockpit",
  label: "Original goal proof gap teacher review cockpit",
  path:
    originalGoalProofGapTeacherReviewCockpit.htmlPath ||
    originalGoalProofGapTeacherReviewCockpit.readmePath ||
    originalGoalProofGapTeacherReviewCockpit.cockpitPath ||
    "",
  url: ""
});
directReviewEntryPoints.splice(4, 0, {
  id: "original_goal_proof_gap_teacher_queue",
  label: "Original goal proof gap teacher queue",
  path:
    originalGoalProofGapTeacherQueue.htmlPath ||
    originalGoalProofGapTeacherQueue.readmePath ||
    originalGoalProofGapTeacherQueue.queuePath ||
    "",
  url: ""
});
directReviewEntryPoints.splice(5, 0, {
  id: "original_goal_proof_gap_evidence_prefill",
  label: "Original goal proof gap evidence prefill",
  path:
    originalGoalProofGapEvidencePrefill.htmlPath ||
    originalGoalProofGapEvidencePrefill.readmePath ||
    originalGoalProofGapEvidencePrefill.prefillPath ||
    "",
  url: ""
});
directReviewEntryPoints.splice(6, 0, {
  id: "original_goal_proof_gap_teacher_queue_receipt_builder",
  label: "Original goal proof gap teacher queue receipt builder",
  path:
    originalGoalProofGapTeacherQueueReceiptBuilder.htmlPath ||
    originalGoalProofGapTeacherQueueReceiptBuilder.readmePath ||
    originalGoalProofGapTeacherQueueReceiptBuilder.builderPath ||
    "",
  url: ""
});
refresh.nextCommands.splice(3, 0, {
  label: "Open original-goal proof gap teacher review cockpit to review candidates, fill the receipt, and copy the validation command",
  command:
    originalGoalProofGapTeacherReviewCockpit.htmlPath ||
    originalGoalProofGapTeacherReviewCockpit.readmePath ||
    originalGoalProofGapTeacherReviewCockpit.cockpitPath ||
    ""
});
refresh.nextCommands.splice(4, 0, {
  label: "Open original-goal proof gap teacher queue to collect the next teacher evidence receipt",
  command:
    originalGoalProofGapTeacherQueue.htmlPath ||
    originalGoalProofGapTeacherQueue.readmePath ||
    originalGoalProofGapTeacherQueue.queuePath ||
    ""
});
refresh.nextCommands.splice(5, 0, {
  label: "Open original-goal proof gap evidence prefill to review candidate evidence paths before filling the receipt",
  command:
    originalGoalProofGapEvidencePrefill.htmlPath ||
    originalGoalProofGapEvidencePrefill.readmePath ||
    originalGoalProofGapEvidencePrefill.prefillPath ||
    ""
});
refresh.nextCommands.splice(6, 0, {
  label: "Open original-goal proof gap teacher queue receipt builder to generate teacher-filled receipt JSON",
  command:
    originalGoalProofGapTeacherQueueReceiptBuilder.htmlPath ||
    originalGoalProofGapTeacherQueueReceiptBuilder.readmePath ||
    originalGoalProofGapTeacherQueueReceiptBuilder.builderPath ||
    ""
});
refresh.nextCommands.splice(7, 0, {
  label: "After validating the teacher-filled proof gap receipt, create the review-only validation handoff queue",
  command: refresh.paths.originalGoalProofGapValidationHandoffQueueCommandTemplate
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_proof_gap_teacher_queue",
  status: originalGoalProofGapTeacherQueuePacket
    ? "waiting_for_teacher_evidence_queue_receipt"
    : "missing",
  detail: `Original goal proof gap teacher queue turns ${
    originalGoalProofGapTeacherQueuePacket?.counts?.queueItems || 0
  } proof-gap routes into numbered teacher questions and receipt rows; ${
    originalGoalProofGapTeacherQueuePacket?.counts?.highRiskGatedItems || 0
  } high-risk items remain blocked from automatic execution.`
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_proof_gap_evidence_prefill",
  status: originalGoalProofGapEvidencePrefillPacket
    ? "candidate_only_waiting_for_teacher_review"
    : "missing",
  detail: `Original goal proof gap evidence prefill attaches candidate evidence paths for ${
    originalGoalProofGapEvidencePrefillPacket?.counts?.rowsWithCandidateEvidence || 0
  } rows while all ${
    originalGoalProofGapEvidencePrefillPacket?.counts?.rowsStillNeedTeacherConfirmation || 0
  } rows still require teacher confirmation before any receipt validation or completion claim.`
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_proof_gap_teacher_review_cockpit",
  status: originalGoalProofGapTeacherReviewCockpitPacket
    ? "waiting_for_teacher_to_review_candidates_and_fill_receipt"
    : "missing",
  detail: `Original goal proof gap teacher review cockpit gives one start page for ${
    originalGoalProofGapTeacherReviewCockpitPacket?.counts?.rows || 0
  } proof-gap rows, candidate evidence, receipt generation, and validation command copy while all ${
    originalGoalProofGapTeacherReviewCockpitPacket?.counts?.rowsStillNeedTeacherConfirmation || 0
  } rows still require teacher confirmation.`
});
refresh.refreshedEvidence.statusLanes.push({
  id: "status_lane_original_goal_proof_gap_validation_handoff_queue",
  status: refresh.refreshedEvidence.originalGoalProofGapValidationHandoffQueueCommandReady
    ? "waiting_for_teacher_receipt_validation_result"
    : "missing",
  detail:
    "Original goal proof gap validation handoff queue command is ready for the teacher-filled receipt validation JSON; it only sorts ready, blocked, and waiting rows for manual follow-up and does not execute commands or claim completion."
});
writeFileSync(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`, "utf8");
writeFileSync(nextActionTriagePath, `${JSON.stringify(nextActionTriage, null, 2)}\n`, "utf8");
writeTriageHtml(nextActionTriageHtmlPath, nextActionTriage);
writeReadme(readmePath, refresh);
writeDashboard(dashboardPath, refresh);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_current_status_refresh_result_v1",
      refreshId,
      refreshPath,
      readmePath,
      dashboardPath,
      originalGoalReadinessAudit: readiness.auditPath,
      operationalStatusConsole: statusConsole.consolePath,
      gapActionBoard: gapBoard.boardPath,
      goalCommandCenter: commandCenter?.centerPath || "",
      originalGoalIntegratedControlFlow: refresh.paths.originalGoalIntegratedControlFlow || "",
      originalGoalIntegratedControlFlowHtml: refresh.paths.originalGoalIntegratedControlFlowHtml || "",
      originalGoalIntegratedControlFlowReadme: refresh.paths.originalGoalIntegratedControlFlowReadme || "",
      originalGoalIntegratedControlFlowStatus:
        refresh.refreshedEvidence.originalGoalIntegratedControlFlowStatus || "",
      originalGoalIntegratedControlFlowStageCount:
        refresh.refreshedEvidence.originalGoalIntegratedControlFlowStageCount || 0,
      originalGoalIntegratedControlFlowRequirementCount:
        refresh.refreshedEvidence.originalGoalIntegratedControlFlowRequirementCount || 0,
      teacherReviewCockpit: commandCenterPacket?.paths?.teacherReviewCockpit || "",
      teacherReviewCockpitHtml: commandCenterPacket?.paths?.teacherReviewCockpitHtml || "",
      teacherReviewCockpitReadme: commandCenterPacket?.paths?.teacherReviewCockpitReadme || "",
      teacherReviewCockpitReceiptTemplate: commandCenterPacket?.paths?.teacherReviewCockpitReceiptTemplate || "",
      teacherReviewCockpitReceiptValidationCommandTemplate:
        firstNextCall(commandCenterPacket, "teacherReviewCockpitReceiptValidation")?.command ||
        commandLine("validate-goal-teacher-review-cockpit-receipt.mjs", [
          ["--cockpit", commandCenterPacket?.paths?.teacherReviewCockpit || "<goal-teacher-review-cockpit.json>"],
          ["--receipt", "<teacher-filled-goal-teacher-review-cockpit-receipt.json>"]
        ]),
      logSourceDiscoveryLedger: sourceLogSourceDiscoveryLedger,
      logSourceDiscoveryLedgerReadme: existsSync(sourceLogSourceDiscoveryLedgerReadme) ? sourceLogSourceDiscoveryLedgerReadme : "",
      logSourceDiscoveryStatus: refresh.refreshedEvidence.logSourceDiscoveryStatus || "",
      logSourceDiscoveryMissingRows: refresh.refreshedEvidence.logSourceDiscoveryMissingRows || 0,
      teacherReviewCockpitHandoffQueueCommandTemplate: commandLine("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
        ["--validation", "<goal-teacher-review-cockpit-receipt-validation.json>"],
        ["--output-dir", join(refreshDir, "teacher-review-cockpit-handoff-queue")]
      ]),
      teacherActionRouter: teacherActionRouter.routerPath || "",
      teacherActionRouterHtml: teacherActionRouter.htmlPath || "",
      teacherActionRouterReceiptBuilder: teacherActionRouterReceiptBuilder.builderPath || "",
      teacherActionRouterReceiptBuilderHtml: teacherActionRouterReceiptBuilder.htmlPath || "",
      teacherActionRouterReceiptTemplate: teacherActionRouterReceiptBuilder.receiptTemplatePath || "",
      originalGoalRemainingGatesPacket: originalGoalRemainingGatesPacket.packetPath || "",
      originalGoalRemainingGatesPacketHtml: originalGoalRemainingGatesPacket.htmlPath || "",
      originalGoalRemainingGatesPacketReadme: originalGoalRemainingGatesPacket.readmePath || "",
      originalGoalRemainingGatesPacketStatus: originalGoalRemainingGatesPacket.status || "",
      originalGoalRemainingGatesReceiptBuilder: originalGoalRemainingGatesReceiptBuilder.builderPath || "",
      originalGoalRemainingGatesReceiptBuilderHtml: originalGoalRemainingGatesReceiptBuilder.htmlPath || "",
      originalGoalRemainingGatesReceiptBuilderReadme: originalGoalRemainingGatesReceiptBuilder.readmePath || "",
      originalGoalRemainingGatesReceiptTemplate: originalGoalRemainingGatesReceiptBuilder.receiptTemplatePath || "",
      originalGoalRemainingGatesReceiptBuilderStatus: originalGoalRemainingGatesReceiptBuilder.status || "",
      originalGoalRemainingGatesReceiptValidationCommandTemplate: originalGoalRemainingGatesReceiptValidationCommandTemplate,
      originalGoalReviewHandoffItemCommandBuilder:
        originalGoalReviewHandoffItemCommandBuilder.builderPath || "",
      originalGoalReviewHandoffItemCommandBuilderHtml:
        originalGoalReviewHandoffItemCommandBuilder.htmlPath || "",
      originalGoalReviewHandoffItemCommandBuilderReadme:
        originalGoalReviewHandoffItemCommandBuilder.readmePath || "",
      originalGoalReviewHandoffItemCommandBuilderStatus:
        originalGoalReviewHandoffItemCommandBuilder.status || "",
      originalGoalReviewHandoffItemCommandBuilderCommandTemplate:
        originalGoalReviewHandoffItemCommandBuilderCommandTemplate,
      originalGoalCompletionBlockerMatrix:
        originalGoalCompletionBlockerMatrix.matrixPath || "",
      originalGoalCompletionBlockerMatrixHtml:
        originalGoalCompletionBlockerMatrix.htmlPath || "",
      originalGoalCompletionBlockerMatrixReadme:
        originalGoalCompletionBlockerMatrix.readmePath || "",
      originalGoalCompletionBlockerMatrixStatus:
        originalGoalCompletionBlockerMatrix.status || "",
      originalGoalCompletionBlockerMatrixRows:
        originalGoalCompletionBlockerMatrix.rowCount || 0,
      originalGoalCompletionBlockerNextStepQueue:
        originalGoalCompletionBlockerNextStepQueue.queuePath || "",
      originalGoalCompletionBlockerNextStepQueueHtml:
        originalGoalCompletionBlockerNextStepQueue.htmlPath || "",
      originalGoalCompletionBlockerNextStepQueueReadme:
        originalGoalCompletionBlockerNextStepQueue.readmePath || "",
      originalGoalCompletionBlockerNextStepQueueStatus:
        originalGoalCompletionBlockerNextStepQueue.status || "",
      originalGoalCompletionBlockerNextStepQueueDecision:
        originalGoalCompletionBlockerNextStepQueue.queueDecision || "",
      originalGoalCompletionBlockerNextStepQueueItems:
        originalGoalCompletionBlockerNextStepQueue.queueItems || 0,
      originalGoalCompletionBlockerNextStepQueueGatedItems:
        originalGoalCompletionBlockerNextStepQueue.gatedItems || 0,
      originalGoalCompletionBlockerLaneCommandBuilder:
        originalGoalCompletionBlockerLaneCommandBuilder.builderPath || "",
      originalGoalCompletionBlockerLaneCommandBuilderHtml:
        originalGoalCompletionBlockerLaneCommandBuilder.htmlPath || "",
      originalGoalCompletionBlockerLaneCommandBuilderReadme:
        originalGoalCompletionBlockerLaneCommandBuilder.readmePath || "",
      originalGoalCompletionBlockerLaneCommandBuilderStatus:
        originalGoalCompletionBlockerLaneCommandBuilder.status || "",
      originalGoalCompletionBlockerLaneCommandBuilderItems:
        originalGoalCompletionBlockerLaneCommandBuilder.queueItems || 0,
      originalGoalCompletionBlockerLaneCommandBuilderGatedItems:
        originalGoalCompletionBlockerLaneCommandBuilder.gatedItems || 0,
      originalGoalCompletionBlockerLaneCommandBuilderRequestPacketsDir:
        originalGoalCompletionBlockerLaneCommandBuilder.requestPacketsDir || "",
      originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPackets:
        originalGoalCompletionBlockerLaneCommandBuilder.offlineRequestPackets || 0,
      openCompletionBlockerLaneCount:
        refresh.refreshedEvidence.openCompletionBlockerLaneCount || 0,
      openCompletionBlockerLanesWaitingForTeacher:
        refresh.refreshedEvidence.openCompletionBlockerLanesWaitingForTeacher === true,
      openCompletionBlockerLaneNumbers:
        refresh.refreshedEvidence.openCompletionBlockerLanes?.map((lane) => ({
          number: lane.number,
          lane: lane.lane,
          status: lane.status,
          missingInputs: lane.missingInputs,
          commandHasPlaceholders: lane.commandHasPlaceholders,
          commandReviewOnlySafeToCopy: lane.commandReviewOnlySafeToCopy
        })) || [],
      originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate:
        originalGoalCompletionBlockerLaneRequestReceiptBuilderCommand(refreshDir),
      originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate:
        originalGoalCompletionBlockerLaneRequestReceiptValidationCommand(refreshDir),
      originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate:
        originalGoalCompletionBlockerLaneRequestRunnerCommand(refreshDir),
      originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate:
        originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommand(refreshDir),
      originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate:
        originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommand(refreshDir),
      originalGoalReviewHandoffQueueItemRunnerCommandTemplate: originalGoalReviewHandoffQueueItemRunnerCommand(refreshDir),
      originalGoalLowTokenCoverageDossierReceiptBuilderCommandTemplate:
        originalGoalLowTokenCoverageDossierReceiptBuilderCommand(refreshDir),
      originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate:
        originalGoalLowTokenCoverageDossierReceiptValidationCommand(refreshDir),
      reviewEntrypointHealthAudit: reviewEntrypointHealthAudit.auditPath || "",
      reviewEntrypointHealthAuditHtml: reviewEntrypointHealthAudit.htmlPath || "",
      originalGoalLowTokenCoverageEvidenceDossier:
        originalGoalLowTokenCoverageEvidenceDossier.dossierPath || "",
      originalGoalLowTokenCoverageEvidenceDossierHtml:
        originalGoalLowTokenCoverageEvidenceDossier.htmlPath || "",
      originalGoalLowTokenCoverageEvidenceDossierReadme:
        originalGoalLowTokenCoverageEvidenceDossier.readmePath || "",
      originalGoalLowTokenCoverageEvidenceDossierStatus:
        originalGoalLowTokenCoverageEvidenceDossier.status || "",
      originalGoalLowTokenCoverageEvidenceDossierCounts:
        originalGoalLowTokenCoverageEvidenceDossier.counts || {},
      originalGoalLowTokenMetadataGatePreflight:
        originalGoalLowTokenMetadataGatePreflight.preflightPath || "",
      originalGoalLowTokenMetadataGatePreflightHtml:
        originalGoalLowTokenMetadataGatePreflight.htmlPath || "",
      originalGoalLowTokenMetadataGatePreflightReadme:
        originalGoalLowTokenMetadataGatePreflight.readmePath || "",
      originalGoalLowTokenMetadataGatePreflightStatus:
        originalGoalLowTokenMetadataGatePreflight.status || "",
      originalGoalLowTokenMetadataGatePreflightCounts:
        originalGoalLowTokenMetadataGatePreflight.counts || {},
      originalGoalLowTokenMetadataGatePreflightReceiptBuilder:
        originalGoalLowTokenMetadataGatePreflightReceiptBuilder.builderPath || "",
      originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml:
        originalGoalLowTokenMetadataGatePreflightReceiptBuilder.htmlPath || "",
      originalGoalLowTokenMetadataGatePreflightReceiptBuilderReadme:
        originalGoalLowTokenMetadataGatePreflightReceiptBuilder.readmePath || "",
      originalGoalLowTokenMetadataGatePreflightReceiptTemplate:
        originalGoalLowTokenMetadataGatePreflightReceiptBuilder.receiptTemplatePath || "",
      originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate || "",
      originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate:
        refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate || "",
      originalGoalLowTokenMetadataGatePreflightReceiptBuilderCounts:
        originalGoalLowTokenMetadataGatePreflightReceiptBuilder.counts || {},
      originalGoalLowTokenCoverageDossierReceiptBuilder:
        originalGoalLowTokenCoverageDossierReceiptBuilder.builderPath || "",
      originalGoalLowTokenCoverageDossierReceiptBuilderHtml:
        originalGoalLowTokenCoverageDossierReceiptBuilder.htmlPath || "",
      originalGoalLowTokenCoverageDossierReceiptBuilderReadme:
        originalGoalLowTokenCoverageDossierReceiptBuilder.readmePath || "",
      originalGoalLowTokenCoverageDossierReceiptTemplate:
        originalGoalLowTokenCoverageDossierReceiptBuilder.receiptTemplatePath || "",
      originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate || "",
      originalGoalLowTokenCoverageWaitingRowCockpit:
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit || "",
      originalGoalLowTokenCoverageWaitingRowCockpitHtml:
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml || "",
      originalGoalLowTokenCoverageWaitingRowCockpitReadme:
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReadme || "",
      originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate:
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate || "",
      originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || "",
      originalGoalLowTokenReadyMetadataGateShortlist:
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlist || "",
      originalGoalLowTokenReadyMetadataGateShortlistHtml:
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml || "",
      originalGoalLowTokenReadyMetadataGateShortlistReadme:
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistReadme || "",
      originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt:
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt || "",
      originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate || "",
      originalGoalLowTokenReadyMetadataGateShortlistReceiptValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistReceiptValidationCommandTemplate || "",
      originalGoalLowTokenReadyMetadataGateShortlistCounts:
        originalGoalLowTokenReadyMetadataGateShortlist.counts || {},
      originalGoalLowTokenBlockedWaitingRowEvidencePlan:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReadme:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReadme || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanCounts:
        originalGoalLowTokenBlockedWaitingRowEvidencePlan.counts || {},
      originalGoalLowTokenFallbackRouteEvidencePack:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePack || "",
      originalGoalLowTokenFallbackRouteEvidencePackHtml:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml || "",
      originalGoalLowTokenFallbackRouteEvidencePackReadme:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReadme || "",
      originalGoalLowTokenFallbackRouteEvidencePackCounts:
        originalGoalLowTokenFallbackRouteEvidencePack.counts || {},
      originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder || "",
      originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml || "",
      originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReadme:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReadme || "",
      originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate || "",
      originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate || "",
      originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate:
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate || "",
      originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRows:
        originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.rowCount || 0,
      originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderCandidateRoutes:
        originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder.candidateRouteCount || 0,
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReadme:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReadme || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate || "",
      originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate:
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate || "",
      originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate:
        refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate || "",
      originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderRows:
        originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.actionRowCount || 0,
      originalGoalLowTokenCoverageCompletionGateCommandTemplate:
        refresh.paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate || "",
      originalGoalFinalCompletionGateCommandTemplate:
        refresh.paths.originalGoalFinalCompletionGateCommandTemplate || "",
      ruleDslDeliveryGateAudit: refresh.paths.ruleDslDeliveryGateAudit || "",
      ruleDslDeliveryGateAuditStatus: refresh.refreshedEvidence.ruleDslDeliveryGateAuditStatus || "",
      ruleDslDeliveryGateAuditReady: refresh.refreshedEvidence.ruleDslDeliveryGateAuditReady || false,
      ruleDslDeliveryGateAuditReviewReceiptBuilder:
        refresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder || "",
      ruleDslDeliveryGateAuditReviewReceiptBuilderHtml:
        refresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml || "",
      ruleDslDeliveryGateAuditReviewReceiptTemplate:
        refresh.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate || "",
      ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate:
        refresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate || "",
      ruleDslDeliveryGateAuditReviewReceiptValidation:
        refresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidation || "",
      ruleDslDeliveryGateAuditReviewReceiptValidationStatus:
        refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationStatus || "",
      ruleDslDeliveryGateAuditReviewReceiptValidationWaitingForTeacher:
        refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationWaitingForTeacher || false,
      ruleDslDeliveryGateAuditReviewReceiptValidationReadyForFollowUpQueue:
        refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptValidationReadyForFollowUpQueue || false,
      ruleDslDeliveryGateAuditReviewReceiptBuilderReady:
        refresh.refreshedEvidence.ruleDslDeliveryGateAuditReviewReceiptBuilderReady || false,
      originalGoalFinalCompletionGateCommandReady:
        refresh.refreshedEvidence.originalGoalFinalCompletionGateCommandReady || false,
      lowTokenOperationPreflightPolicy: lowTokenOperationPreflight.policyPath || "",
      lowTokenOperationPreflightPolicyHtml: lowTokenOperationPreflight.htmlPath || "",
      lowTokenTriggerBudgetPlan: lowTokenTriggerBudgetPlan.planPath || "",
      lowTokenTriggerBudgetPlanHtml: lowTokenTriggerBudgetPlan.htmlPath || "",
      eventTriggeredObservationPolicy: eventTriggeredObservationPolicy.policyPath || "",
      eventTriggeredObservationPolicyHtml: eventTriggeredObservationPolicy.htmlPath || "",
      eventTriggeredObservationPolicyReceiptBuilder: eventTriggeredObservationPolicyReceiptBuilder.builderPath || "",
      eventTriggeredObservationPolicyReceiptBuilderHtml: eventTriggeredObservationPolicyReceiptBuilder.htmlPath || "",
      eventTriggeredObservationPolicyReceiptBuilderReadme: eventTriggeredObservationPolicyReceiptBuilder.readmePath || "",
      eventTriggeredObservationPolicyReceiptTemplate:
        eventTriggeredObservationPolicyReceiptBuilder.receiptTemplatePath || eventTriggeredObservationPolicy.receiptTemplatePath || "",
      eventTriggeredObservationPolicyReceiptBuilderCommandTemplate,
      eventTriggeredObservationPolicyCommandTemplate,
      eventTriggeredObservationPolicyReceiptValidationCommandTemplate,
      triggeredVisualCheckCommandBuilder: triggeredVisualCheckCommandBuilder.builderPath || "",
      triggeredVisualCheckCommandBuilderHtml: triggeredVisualCheckCommandBuilder.htmlPath || "",
      triggeredVisualCheckCommandBuilderReadme: triggeredVisualCheckCommandBuilder.readmePath || "",
      triggeredVisualCheckCommandBuilderStatus: triggeredVisualCheckCommandBuilder.status || "",
      triggeredVisualCheckCommandBuilderCommandTemplate,
      triggeredVisualCaptureCommandTemplate,
      triggeredVisualLearningHandoffCommandTemplate,
      triggeredVisualLearningHandoffReviewCommandTemplate,
      triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate,
      triggeredVisualVoiceControlWorkbenchCommandTemplate,
      transparentSketchDepthDemonstrationRehearsalCommandTemplate,
      sketchDemonstrationImplementationAudit: sourceSketchDemonstrationImplementationAudit,
      sketchDemonstrationImplementationAuditStatus:
        refresh.refreshedEvidence.sketchDemonstrationImplementationAuditStatus,
      sketchDemonstrationImplementationAuditSummary:
        refresh.refreshedEvidence.sketchDemonstrationImplementationAuditSummary,
      transparentSketch2DPerspective3DImplemented:
        refresh.refreshedEvidence.transparentSketch2DPerspective3DImplemented,
      transparentSketch2DPerspective3DBoundary:
        refresh.refreshedEvidence.sketchDemonstrationImplementationAuditBoundary,
      rawSpatialIntentPacketPresent:
        refresh.refreshedEvidence.rawSpatialIntentPacketPresent || false,
      formalSpatialIntentEvidencePresent:
        refresh.refreshedEvidence.formalSpatialIntentEvidencePresent || false,
      spatialIntentEvidenceReceiptValidation:
        refresh.paths.spatialIntentEvidenceReceiptValidation || "",
      spatialIntentEvidenceReceiptValidationStatus:
        refresh.refreshedEvidence.spatialIntentEvidenceReceiptValidationStatus || "",
      spatialIntentEvidenceReceiptValidationDecision:
        refresh.refreshedEvidence.spatialIntentEvidenceReceiptValidationDecision || "",
      spatialIntentEvidenceReceiptValidationReady:
        refresh.refreshedEvidence.spatialIntentEvidenceReceiptValidationReady || false,
      spatialIntentEvidenceReceiptValidationNextReviewCommand:
        refresh.paths.spatialIntentEvidenceReceiptValidationNextReviewCommand || "",
      triggeredVisualTransparentOverlayHandoff: sourceTriggeredVisualTransparentOverlayHandoff || "",
      triggeredVisualTransparentOverlayHandoffHtml: sourceTriggeredVisualTransparentOverlayHandoff
        ? sourceTriggeredVisualTransparentOverlayHandoff.replace(
            /triggered-visual-transparent-overlay-handoff\.json$/,
            "triggered-visual-transparent-overlay-handoff.html"
          )
        : "",
      spatialIntentFormalEvidenceEntrypoint: sourceSpatialIntentFormalEvidenceEntrypoint || "",
      spatialIntentFormalEvidenceEntrypointHtml: sourceSpatialIntentFormalEvidenceEntrypoint
        ? sourceSpatialIntentFormalEvidenceEntrypoint.replace(
            /spatial-intent-formal-evidence-entrypoint\.json$/,
            "spatial-intent-formal-evidence-entrypoint.html"
          )
        : "",
      spatialIntentFormalEvidenceEntrypointCommandTemplate,
      spatialToSoftwareExecutionGatePackage:
        refresh.paths.spatialToSoftwareExecutionGatePackage || sourceSpatialToSoftwareExecutionGatePackage || "",
      spatialToSoftwareExecutionGatePackageHtml:
        refresh.paths.spatialToSoftwareExecutionGatePackageHtml ||
        (sourceSpatialToSoftwareExecutionGatePackage
        ? sourceSpatialToSoftwareExecutionGatePackage.replace(
            /spatial-to-software-execution-gate-package\.json$/,
            "spatial-to-software-execution-gate-package.html"
          )
        : ""),
      spatialToSoftwareExecutionGatePackageStatus:
        refresh.refreshedEvidence.spatialToSoftwareExecutionGatePackageStatus || "",
      spatialToSoftwareExecutionGateReadyForDryRunRouteBridge:
        refresh.refreshedEvidence.spatialToSoftwareExecutionGateReadyForDryRunRouteBridge || false,
      spatialToSoftwareExecutionGateFirstBlocker:
        refresh.refreshedEvidence.spatialToSoftwareExecutionGateFirstBlocker || null,
      spatialToSoftwareFirstBlockerHandoff:
        refresh.paths.spatialToSoftwareFirstBlockerHandoff || "",
      spatialToSoftwareFirstBlockerHandoffHtml:
        refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml || "",
      spatialToSoftwareFirstBlockerHandoffStatus:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerHandoffStatus || "",
      spatialToSoftwareFirstBlockerFirstTeacherAction:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerFirstTeacherAction || null,
      spatialToSoftwareFirstBlockerNextGateHandoffFormat:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerNextGateHandoffFormat || "",
      spatialToSoftwareFirstBlockerObjectiveRequirementId:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerObjectiveRequirementId || "",
      spatialToSoftwareFirstBlockerCompletionBlockerLane:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerCompletionBlockerLane || "",
      spatialToSoftwareFirstBlockerNextGate:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerNextGate || "",
      spatialToSoftwareFirstBlockerReturnToCompletionBlockerMatrixAfterNextGate:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerReturnToCompletionBlockerMatrixAfterNextGate || false,
      spatialToSoftwareFirstBlockerNextGateHandoffBlocksExecution:
        refresh.refreshedEvidence.spatialToSoftwareFirstBlockerNextGateHandoffBlocksExecution || false,
      currentGoalSpatialTeacherConsole:
        refresh.paths.currentGoalSpatialTeacherConsole || "",
      currentGoalSpatialTeacherConsoleHtml:
        refresh.paths.currentGoalSpatialTeacherConsoleHtml || "",
      currentGoalSpatialTeacherConsoleReadme:
        refresh.paths.currentGoalSpatialTeacherConsoleReadme || "",
      currentGoalSpatialTeacherConsoleStatus:
        refresh.refreshedEvidence.currentGoalSpatialTeacherConsoleStatus || "",
      currentGoalSpatialTeacherConsoleReady:
        refresh.refreshedEvidence.currentGoalSpatialTeacherConsoleReady || false,
      currentGoalSpatialTeacherConsoleCapabilityState:
        refresh.refreshedEvidence.currentGoalSpatialTeacherConsoleCapabilityState || {},
      spatialRouteToExecutionApprovalHandoffFormat:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalHandoffFormat || "",
      spatialRouteToExecutionApprovalHandoffStatus:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalHandoffStatus || "",
      spatialRouteToExecutionApprovalObjectiveRequirementId:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalObjectiveRequirementId || "",
      spatialRouteToExecutionApprovalCompletionBlockerLane:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalCompletionBlockerLane || "",
      spatialRouteToExecutionApprovalNextGate:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalNextGate || "",
      spatialRouteToExecutionApprovalPrerequisiteGate:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalPrerequisiteGate || "",
      spatialRouteToExecutionApprovalCommandBuilder:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalCommandBuilder || "",
      spatialRouteToExecutionApprovalFinalRunnerGate:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalFinalRunnerGate || "",
      spatialRouteToExecutionApprovalReadyForApprovalPrep:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalReadyForApprovalPrep || false,
      spatialRoutePilotSelectionReceiptCommandTemplate:
        refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate || "",
      spatialRoutePilotSelectionReceiptValidationCommandTemplate:
        refresh.paths.spatialRoutePilotSelectionReceiptValidationCommandTemplate || "",
      spatialRoutePilotSelectionReceiptCommandReady:
        refresh.refreshedEvidence.spatialRoutePilotSelectionReceiptCommandReady || false,
      spatialRoutePilotSelectionReceiptValidationCommandReady:
        refresh.refreshedEvidence.spatialRoutePilotSelectionReceiptValidationCommandReady || false,
      spatialRoutePilotSelectionRequiredBeforeApprovalPrepReuse:
        refresh.refreshedEvidence.spatialRoutePilotSelectionRequiredBeforeApprovalPrepReuse || false,
      spatialRouteApprovalPrepReuseBlockedUntilTeacherPilotSelectionReceipt:
        refresh.refreshedEvidence.spatialRouteApprovalPrepReuseBlockedUntilTeacherPilotSelectionReceipt || false,
      spatialRouteToExecutionApprovalReturnToCompletionBlockerMatrix:
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalReturnToCompletionBlockerMatrix || false,
      spatialRouteBridgeDoesNotCreateApprovalGate:
        refresh.refreshedEvidence.spatialRouteBridgeDoesNotCreateApprovalGate || false,
      spatialRouteBridgeDoesNotRunApprovedGateRunner:
        refresh.refreshedEvidence.spatialRouteBridgeDoesNotRunApprovedGateRunner || false,
      spatialRouteBridgeDoesNotInvokeAdapter:
        refresh.refreshedEvidence.spatialRouteBridgeDoesNotInvokeAdapter || false,
      spatialFirstBlockerOverlayResolverMcpTool:
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverMcpTool || "",
      spatialFirstBlockerOverlayResolverAvailable:
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverAvailable || false,
      spatialFirstBlockerOverlayResolverReviewOnly:
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverReviewOnly || false,
      spatialFirstBlockerOverlayResolverExecutesSoftware:
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverExecutesSoftware || false,
      spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker:
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker || false,
      spatialFirstBlockerOverlayResolverCommandTemplate:
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverCommandTemplate || "",
      transparentSketchDepthDemonstrationRehearsal: transparentSketchDepthDemonstrationRehearsal?.rehearsalPath || "",
      transparentSketchDepthDemonstrationRehearsalHtml: transparentSketchDepthDemonstrationRehearsal?.htmlPath || "",
      transparentSketchDepthDemonstrationRehearsalReadme: transparentSketchDepthDemonstrationRehearsal?.readmePath || "",
      transparentSketchDepthDemonstrationRehearsalStatus: transparentSketchDepthDemonstrationRehearsal?.status || "",
      transparentSketchDepthRehearsalReviewReceiptBuilder:
        transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.builder || "",
      transparentSketchDepthRehearsalReviewReceiptBuilderHtml:
        transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.html || "",
      transparentSketchDepthRehearsalReviewReceiptTemplate:
        transparentSketchDepthRehearsalReviewReceiptBuilder?.paths?.receiptTemplate || "",
      transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate,
      transparentSketchDepthRehearsalReviewReceiptValidation:
        sourceTransparentSketchDepthRehearsalReviewReceiptValidation,
      transparentSketchDepthRehearsalReviewReceiptValidationStatus:
        refresh.refreshedEvidence.transparentSketchDepthRehearsalReviewReceiptValidationStatus || "",
      transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher:
        refresh.refreshedEvidence.transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher || false,
      transparentSketchDepthRehearsalReviewReceiptTeacherConfirmedReviewOnly:
        refresh.refreshedEvidence.transparentSketchDepthRehearsalReviewReceiptTeacherConfirmedReviewOnly || false,
      transparentSketchLogicContractRuleDraftCommandTemplate,
      transparentSketchLogicContractRuleDraft: sourceTransparentSketchLogicContractRuleDraft || "",
      transparentSketchLogicContractRuleDraftCompiledPackage:
        sourceTransparentSketchLogicContractRuleDraftPacket?.compiledRulePackagePath || "",
      transparentSketchLogicContractRuleDraftStatus:
        refresh.refreshedEvidence.transparentSketchLogicContractRuleDraftStatus || "",
      transparentSketchLogicContractRuleDraftDisabledRuleCount:
        refresh.refreshedEvidence.transparentSketchLogicContractRuleDraftDisabledRuleCount || 0,
      transparentSketchLogicContractRuleDraftCommandReady:
        refresh.refreshedEvidence.transparentSketchLogicContractRuleDraftCommandReady || false,
      teacherLearningMethodProfile: sourceTeacherLearningMethodProfile || "",
      teacherMethodExecutionLearningContractCommandTemplate,
      teacherMethodExecutionLearningContract: sourceTeacherMethodExecutionLearningContract || "",
      teacherMethodExecutionLearningContractStatus:
        refresh.refreshedEvidence.teacherMethodExecutionLearningContractStatus || "",
      teacherMethodExecutionLearningContractReceiptBuilder:
        refresh.paths.teacherMethodExecutionLearningContractReceiptBuilder || "",
      teacherMethodExecutionLearningContractReceiptBuilderHtml:
        refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml || "",
      teacherMethodExecutionLearningContractReceiptTemplate:
        refresh.paths.teacherMethodExecutionLearningContractReceiptTemplate || "",
      teacherMethodExecutionLearningContractReceiptValidationCommandTemplate:
        refresh.paths.teacherMethodExecutionLearningContractReceiptValidationCommandTemplate || "",
      teacherMethodExecutionLearningContractReceiptBuilderReady:
        refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptBuilderReady || false,
      teacherMethodExecutionLearningContractReceiptValidationCommandReady:
        refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptValidationCommandReady || false,
      teacherMethodExecutionLearningContractReceiptValidation:
        refresh.paths.teacherMethodExecutionLearningContractReceiptValidation || "",
      teacherMethodExecutionLearningContractReceiptValidationStatus:
        refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptValidationStatus || "",
      teacherMethodExecutionLearningContractReceiptReadyForReuseResultProof:
        refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptReadyForReuseResultProof || false,
      teacherMethodReuseResultProofBuilder:
        refresh.paths.teacherMethodReuseResultProofBuilder || "",
      teacherMethodReuseResultProofBuilderHtml:
        refresh.paths.teacherMethodReuseResultProofBuilderHtml || "",
      teacherMethodReuseResultProofReceiptTemplate:
        refresh.paths.teacherMethodReuseResultProofReceiptTemplate || "",
      teacherMethodReuseResultProofValidationCommandTemplate:
        refresh.paths.teacherMethodReuseResultProofValidationCommandTemplate || "",
      teacherMethodReuseResultProofBuilderReady:
        refresh.refreshedEvidence.teacherMethodReuseResultProofBuilderReady || false,
      teacherMethodReuseResultProofValidationCommandReady:
        refresh.refreshedEvidence.teacherMethodReuseResultProofValidationCommandReady || false,
      teacherMethodReuseResultProofReadyForTeacherReceipt:
        refresh.refreshedEvidence.teacherMethodReuseResultProofReadyForTeacherReceipt || false,
      teacherMethodExecutionLearningContractRouteCount:
        refresh.refreshedEvidence.teacherMethodExecutionLearningContractRouteCount || 0,
      teacherMethodContractLowTokenMetadataFirst:
        refresh.refreshedEvidence.teacherMethodContractLowTokenMetadataFirst || false,
      teacherMethodContractTransparentOverlaySpatialIntent:
        refresh.refreshedEvidence.teacherMethodContractTransparentOverlaySpatialIntent || false,
      teacherMethodContractCorrectionBoundaryCounterexample:
        refresh.refreshedEvidence.teacherMethodContractCorrectionBoundaryCounterexample || false,
      teacherMethodContractHighToMediumModelTierPolicy:
        refresh.refreshedEvidence.teacherMethodContractHighToMediumModelTierPolicy || false,
      coverageRolloutReceiptBuilder: coverageRolloutReceiptBuilderPath,
      coverageRolloutReceiptBuilderHtml: coverageRolloutReceiptBuilderHtmlPath,
      coverageRolloutReceiptBuilderReadme: coverageRolloutReceiptBuilderReadmePath,
      coverageRolloutReceiptBuilderDiscoveredBeforeRefresh: sourceCoverageRolloutReceiptBuilder,
      executionFollowUpReceiptBuilder: executionFollowUpReceiptBuilderPath,
      executionFollowUpReceiptBuilderHtml: executionFollowUpReceiptBuilderHtmlPath,
      executionFollowUpReceiptBuilderReadme: executionFollowUpReceiptBuilderReadmePath,
      actionLogicSourceContractPackage: actionLogicSourceContractPackagePath,
      actionLogicSourceContractPackageHtml: actionLogicSourceContractPackageHtmlPath,
      actionLogicSourceContractPackageReadme: actionLogicSourceContractPackageReadmePath,
      actionLogicSourceContractReceiptTemplate: actionLogicSourceContractReceiptTemplatePath,
      actionLogicSourceShortlist: actionLogicSourceShortlistPath,
      actionLogicSourceShortlistHtml: actionLogicSourceShortlistHtmlPath,
      actionLogicSourceShortlistReadme: actionLogicSourceShortlistReadmePath,
      actionLogicSourceShortlistReceiptTemplate: actionLogicSourceShortlistReceiptTemplatePath,
      controlChannelRepairReceiptBuilder: controlChannelRepairReceiptBuilderPath,
      controlChannelRepairReceiptBuilderHtml: controlChannelRepairReceiptBuilderHtmlPath,
      controlChannelRepairReceiptBuilderReadme: controlChannelRepairReceiptBuilderReadmePath,
      controlChannelRepairReceiptTemplate: controlChannelRepairReceiptTemplatePath,
      executionGapReviewCockpit: executionGapReviewCockpitPath,
      executionGapReviewCockpitHtml: executionGapReviewCockpitHtmlPath,
      executionGapReviewCockpitReadme: executionGapReviewCockpitReadmePath,
      executionGapReviewCockpitReceiptTemplate: executionGapReviewCockpitReceiptTemplatePath,
      executionGapReviewCockpitShortlist: executionGapReviewCockpitShortlistPath,
      executionGapReviewCockpitShortlistHtml: executionGapReviewCockpitShortlistHtmlPath,
      executionGapReviewCockpitShortlistReadme: executionGapReviewCockpitShortlistReadmePath,
      executionGapReviewCockpitShortlistReceiptTemplate: executionGapReviewCockpitShortlistReceiptTemplatePath,
      executionGapReviewCockpitReceiptValidationCommandTemplate: commandLine(
        "validate-all-software-execution-gap-review-cockpit-receipt.mjs",
        [
          ["--cockpit", executionGapReviewCockpitPath || "<all-software-execution-gap-review-cockpit.json>"],
          ["--receipt", "<teacher-filled-execution-gap-review-cockpit-receipt.json>"],
          ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-receipt-validation")]
        ]
      ),
      executionGapReviewCockpitHandoffQueueCommandTemplate: commandLine(
        "create-all-software-execution-gap-review-cockpit-handoff-queue.mjs",
        [
          ["--validation", "<all-software-execution-gap-review-cockpit-receipt-validation.json>"],
          ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-queue")]
        ]
      ),
      executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate: commandLine(
        "run-original-goal-review-handoff-queue-item.mjs",
        [
          ["--queue", "<all-software-execution-gap-review-cockpit-handoff-queue.json>"],
          ["--item-number", "<teacher-reviewed-item-number>"],
          ["--run-reviewed-handoff", "true"],
          ["--allow-runner", "true"],
          ["--teacher-confirmation", "<teacher-confirmed-execution-gap-handoff-item-text>"],
          ["--rollback-point-created", "true"],
          ["--rollback-point", "<retained-rollback-point-path-or-label>"],
          ["--output-dir", join(refreshDir, "execution-gap-review-cockpit-handoff-item-run")]
        ]
      ),
      executionGapReviewDownstreamValidationSummaryCommandTemplate: commandLine(
        "create-all-software-execution-gap-downstream-validation-summary.mjs",
        [
          ["--control-item-run", "<control-channel-handoff-item-run.json>"],
          ["--action-logic-item-run", "<action-logic-handoff-item-run.json>"],
          ["--output-dir", join(refreshDir, "execution-gap-downstream-validation-summary")]
        ]
      ),
      executionGapReviewMatrixReconciliationPackageCommandTemplate: commandLine(
        "create-all-software-execution-gap-matrix-reconciliation-package.mjs",
        [
          ["--downstream-summary", "<all-software-execution-gap-downstream-validation-summary.json>"],
          ["--matrix", "<current-all-software-execution-capability-matrix.json>"],
          ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-package")]
        ]
      ),
      executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate: commandLine(
        "create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs",
        [
          ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
          ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-builder")]
        ]
      ),
      executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate: commandLine(
        "validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs",
        [
          ["--package", "<all-software-execution-gap-matrix-reconciliation-package.json>"],
          ["--receipt", "<teacher-filled-execution-gap-matrix-reconciliation-receipt.json>"],
          ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-receipt-validation")]
        ]
      ),
      executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate: commandLine(
        "run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs",
        [
          ["--validation", "<all-software-execution-gap-matrix-reconciliation-receipt-validation.json>"],
          ["--run-reviewed-matrix-generation", "true"],
          ["--allow-runner", "true"],
          ["--teacher-confirmation", "<teacher-confirmed-execution-gap-matrix-reconciliation-runner-text>"],
          ["--rollback-point-created", "true"],
          ["--rollback-point", "<retained-rollback-point-path-or-label>"],
          ["--output-dir", join(refreshDir, "execution-gap-matrix-reconciliation-reviewed-runner")]
        ]
      ),
      coverageRolloutHandoffQueueCommandTemplate: coverageRolloutHandoffQueueCommand(refreshDir),
      coverageRolloutHandoffQueueItemRunnerCommandTemplate: coverageRolloutHandoffQueueItemRunnerCommand(refreshDir),
      coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate:
        coverageRolloutHandoffItemRunReviewReceiptBuilderCommand(refreshDir),
      coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate:
        coverageRolloutHandoffItemRunReviewReceiptValidationCommand(refreshDir),
      coverageEnrollmentFollowUpHandoffQueueCommandTemplate: coverageEnrollmentFollowUpHandoffQueueCommand(refreshDir),
      coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate:
        coverageEnrollmentFollowUpHandoffItemCommandBuilderCommand(refreshDir),
      coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandTemplate:
        coverageEnrollmentFollowUpHandoffQueueItemRunnerCommand(refreshDir),
      executionFollowUpHandoffQueueCommandTemplate: executionFollowUpHandoffQueueCommand(refreshDir),
      executionFollowUpHandoffItemCommandBuilderCommandTemplate:
        executionFollowUpHandoffItemCommandBuilderCommand(refreshDir),
      executionFollowUpHandoffQueueItemRunnerCommandTemplate: executionFollowUpHandoffQueueItemRunnerCommand(refreshDir),
      executionFollowUpHandoffItemReceiptBuilderCommandTemplate: executionFollowUpHandoffItemReceiptBuilderCommand(refreshDir),
      executionFollowUpHandoffItemReceiptValidationCommandTemplate: executionFollowUpHandoffItemReceiptValidationCommand(refreshDir),
      executionApprovalGatePrepRunnerCommandTemplate: executionApprovalGatePrepRunnerCommand(refreshDir),
      executionApprovedGateCommandBuilder: executionApprovedGateCommandBuilder.paths?.builder || "",
      executionApprovedGateCommandBuilderHtml: executionApprovedGateCommandBuilder.paths?.html || "",
      executionApprovedGateCommandBuilderReadme: executionApprovedGateCommandBuilder.paths?.readme || "",
      executionApprovedGateCommandBuilderCommandTemplate: executionApprovedGateCommandBuilderCommand(refreshDir),
      executionApprovedGateRunnerCommandTemplate: executionApprovedGateRunnerCommand(refreshDir),
      operationalRegistrationApprovedCommandBuilder:
        operationalRegistrationApprovedCommandBuilder.paths?.builder || "",
      operationalRegistrationApprovedCommandBuilderHtml:
        operationalRegistrationApprovedCommandBuilder.paths?.html || "",
      operationalRegistrationApprovedCommandBuilderReadme:
        operationalRegistrationApprovedCommandBuilder.paths?.readme || "",
      operationalRegistrationApprovedCommandBuilderCommandTemplate:
        operationalRegistrationApprovedCommandBuilderCommand(refreshDir),
      operationalRegistrationApprovedRunnerCommandTemplate: operationalRegistrationApprovedRunnerCommand(refreshDir),
      operationalPostRegistrationOutputWitnessCommandBuilder:
        operationalPostRegistrationOutputWitnessCommandBuilder.paths?.builder || "",
      operationalPostRegistrationOutputWitnessCommandBuilderHtml:
        operationalPostRegistrationOutputWitnessCommandBuilder.paths?.html || "",
      operationalPostRegistrationOutputWitnessCommandBuilderReadme:
        operationalPostRegistrationOutputWitnessCommandBuilder.paths?.readme || "",
      operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate:
        operationalPostRegistrationOutputWitnessCommandBuilderCommand(refreshDir),
      operationalPostRegistrationOutputWitnessReceiptBuilder:
        operationalPostRegistrationOutputWitnessReceiptBuilder.builderPath || "",
      operationalPostRegistrationOutputWitnessReceiptBuilderHtml:
        operationalPostRegistrationOutputWitnessReceiptBuilder.htmlPath || "",
      operationalPostRegistrationOutputWitnessReceiptTemplate:
        operationalPostRegistrationOutputWitnessReceiptBuilder.receiptTemplatePath || "",
      operationalPostRegistrationOutputWitnessReceiptBuilderReadme:
        operationalPostRegistrationOutputWitnessReceiptBuilder.readmePath || "",
      operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate:
        operationalPostRegistrationOutputWitnessReceiptBuilderCommand(refreshDir),
      operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate:
        operationalPostRegistrationOutputWitnessReceiptValidationCommand(refreshDir),
      operationalPostRegistrationOutputWitnessRunnerCommandTemplate: operationalPostRegistrationOutputWitnessRunnerCommand(refreshDir),
      parametricDrawingLogicLearningKit: parametricDrawingLogicKitPath,
      parametricDrawingLogicLearningKitHtml: parametricDrawingLogicKitHtmlPath,
      completionDecision: refresh.completionDecision,
      nextSafeAction,
      locks
    },
    null,
    2
  )
);


