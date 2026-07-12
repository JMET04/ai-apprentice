import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const indexJsonPath = path.join(artifactsDir, "product-delivery-index.json");
const indexMarkdownPath = path.join(artifactsDir, "product-delivery-index.md");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileBytes(relativePath: string) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (typeof passed === "number" && typeof total === "number") return `${status ?? "missing"} ${passed}/${total}`;
  return status ?? "missing";
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}


function formatBootstrapStep(step: {
  id?: string;
  command?: string;
  evidence?: string;
  stopCondition?: string;
  platformCommands?: Record<string, string>;
}) {
  const platformCommands = step.platformCommands
    ? Object.entries(step.platformCommands)
        .map(([platform, command]) => `${platform}: ` + "`" + command + "`")
        .join(", ")
    : "none";
  return `\`${step.id ?? "unknown"}\` - command: \`${step.command ?? "missing"}\`; platform commands: ${platformCommands}; evidence: \`${step.evidence ?? "missing"}\`; stop: ${step.stopCondition ?? "none"}`;
}
function formatAllowedAction(action: {
  id?: string;
  title?: string;
  command?: string;
  evidencePath?: string;
  testerRunbookPath?: string;
  sessionPlanPath?: string;
  sessionReceiptTemplatePath?: string;
  redactionChecklistPath?: string;
  runtimeRollbackEvidencePath?: string;
  postIntakeCommand?: string;
  postIntakeRefresh?: string;
  stopCondition?: string;
}) {
  const runbook = action.testerRunbookPath ? `; tester-runbook: \`${action.testerRunbookPath}\`` : "";
  const sessionPlan = action.sessionPlanPath ? `; session-plan: \`${action.sessionPlanPath}\`` : "";
  const sessionReceipt = action.sessionReceiptTemplatePath ? `; session-receipt-template: \`${action.sessionReceiptTemplatePath}\`` : "";
  const redaction = action.redactionChecklistPath ? `; redaction-checklist: \`${action.redactionChecklistPath}\`` : "";
  const runtimeRollback = action.runtimeRollbackEvidencePath ? "; runtime-rollback-evidence: `" + action.runtimeRollbackEvidencePath + "`" : "";
  const postIntake = action.postIntakeCommand ? `; post-intake: \`${action.postIntakeCommand}\`` : "";
  const refresh = action.postIntakeRefresh ? `; refresh: ${action.postIntakeRefresh}` : "";
  const stop = action.stopCondition ? `; stop: ${action.stopCondition}` : "";
  return `\`${action.id ?? "unknown"}\` - ${action.title ?? "Untitled"}; command: \`${action.command ?? "missing"}\`; evidence: \`${action.evidencePath ?? "missing"}\`${runbook}${sessionPlan}${sessionReceipt}${redaction}${runtimeRollback}${postIntake}${refresh}${stop}`;
}

function main() {
  const sourceManifest = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    archivePath?: string;
    archiveBytes?: number;
    archiveSha256?: string;
    packageBoundary?: {
      uploadReady?: boolean;
      includesSecrets?: boolean;
      includesDependencies?: boolean;
      includesLocalDatabase?: boolean;
      includesBuildCache?: boolean;
    };
  }>("artifacts/github-source-package/github-source-package-manifest.json");
  const sourceVerification = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    archivePath?: string;
    archiveSha256?: string;
    uploadReady?: boolean;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    passed?: number;
    total?: number;
  }>("artifacts/github-source-package/github-source-package-verification.json");
  const localCi = readJson<{
    status?: string;
    generatedAt?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/productization-ci-local-verification.json");
  const takeover = readJson<{
    status?: string;
    generatedAt?: string;
    firstReadOrder?: string[];
    allowedActions?: Array<{
      id?: string;
      title?: string;
      command?: string;
      evidencePath?: string;
      testerRunbookPath?: string;
      sessionPlanPath?: string;
      sessionReceiptTemplatePath?: string;
      redactionChecklistPath?: string;
      postIntakeCommand?: string;
      postIntakeRefresh?: string;
      stopCondition?: string;
    }>;
    blockedActions?: Array<{ id?: string; blocked?: boolean; evidence?: string; unblockRequires?: string }>;
  }>("artifacts/productization/product-takeover-decision-matrix.json");
  const summary = readJson<{
    status?: string;
    generatedAt?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    readiness?: Record<string, string>;
  }>("artifacts/productization/product-status-summary.json");
  const release = readJson<{
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
  }>("artifacts/productization/product-release-readiness.json");
  const publicBeta = readJson<{ status?: string; generatedAt?: string; betaCanStart?: boolean; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-readiness.json"
  );
  const publicBetaSessionPlanVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-session-plan-verification.json"
  );
  const productTrial = readJson<{ status?: string; generatedAt?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-trial-packet-verification.json"
  );
  const newRepositoryBootstrapReceiptPath =
    "artifacts/github-source-package/transparent-ai-apprentice-mcp/artifacts/productization/new-repository-bootstrap-verification.json";
  const newRepositoryBootstrapReceipt = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>(newRepositoryBootstrapReceiptPath);
  const freshness = readJson<{ status?: string; generatedAt?: string; passed?: number; total?: number }>(
    "artifacts/productization/productization-evidence-freshness.json"
  );
  const humanInvite = readJson<{ status?: string; canInviteHumanReviewer?: boolean }>(
    "artifacts/productization/human-acceptance-reviewer-invite.json"
  );
  const humanInviteVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-reviewer-invite-verification.json"
  );
  const launchChecklist = readJson<{ status?: string }>("artifacts/productization/productization-launch-checklist.json");
  const launchChecklistVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/productization-launch-checklist-verification.json"
  );
  const firstRealTesterLaunch = readJson<{ status?: string; readyToLaunch?: boolean }>(
    "artifacts/productization/first-real-tester-launch.json"
  );
  const firstRealTesterLaunchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-launch-verification.json"
  );
  const firstRealTesterDispatchPacket = readJson<{ status?: string }>(
    "artifacts/productization/first-real-tester-dispatch-packet.json"
  );
  const firstRealTesterDispatchPacketVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-dispatch-packet-verification.json"
  );
  const firstRealTesterSendBundle = readJson<{ status?: string; selectedLane?: { id?: string }; externalSendFolder?: string }>(
    "artifacts/productization/first-real-tester-send-bundle.json"
  );
  const firstRealTesterSendBundleVerification = readJson<{ status?: string; passed?: number; total?: number; selectedLane?: string; checks?: Array<{ name?: string; pass?: boolean }> }>(
    "artifacts/productization/first-real-tester-send-bundle-verification.json"
  );
  const firstRealTesterContactReadiness = readJson<{ status?: string; contactAllowed?: boolean; contactDecision?: string; selectedLane?: { id?: string }; failedRequiredChecks?: string[] }>(
    "artifacts/productization/first-real-tester-contact-readiness.json"
  );
  const firstRealTesterContactReadinessVerification = readJson<{ status?: string; passed?: number; total?: number; contactReadinessStatus?: string; contactAllowed?: boolean }>(
    "artifacts/productization/first-real-tester-contact-readiness-verification.json"
  );
  const firstRealTesterSendExecutionBrief = readJson<{ status?: string; manualSendAllowed?: boolean; actualSendPerformed?: boolean; failedRequiredChecks?: string[] }>(
    "artifacts/productization/first-real-tester-send-execution-brief.json"
  );
  const firstRealTesterSendExecutionBriefVerification = readJson<{ status?: string; passed?: number; total?: number; manualSendAllowed?: boolean; actualSendPerformed?: boolean }>(
    "artifacts/productization/first-real-tester-send-execution-brief-verification.json"
  );
  const firstRealTesterSendReceiptTemplate = readJson<{
    status?: string;
    defaultDecision?: string;
    selectedLane?: { id?: string };
    sourceBundle?: { actualSendPerformed?: boolean; externalSendFolder?: string };
  }>("artifacts/productization/first-real-tester-send-receipt.template.json");
  const firstRealTesterSendReceiptTemplateVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-send-receipt-template-verification.json"
  );
  const firstRealTesterFinalGoNoGo = readJson<{ status?: string; manualSendAllowed?: boolean; actualSendPerformed?: boolean; failedRequiredChecks?: string[] }>(
    "artifacts/productization/first-real-tester-final-go-no-go.json"
  );
  const firstRealTesterFinalGoNoGoVerification = readJson<{ status?: string; passed?: number; total?: number; manualSendAllowed?: boolean; actualSendPerformed?: boolean }>(
    "artifacts/productization/first-real-tester-final-go-no-go-verification.json"
  );
  const firstRealTesterSendBundleFingerprintGate =
    firstRealTesterSendBundleVerification?.checks?.some(
      (check) => check.name === "Declared send bundle fingerprints match disk files" && check.pass === true
    ) === true
      ? "sha256-bound"
      : "missing";
  const firstRealTesterReturnWorkbench = readJson<{
    status?: string;
    sendReceiptHandoff?: {
      requiredBeforeReturnIntake?: boolean;
      sendBundleFingerprintGate?: string;
      submittedSendReceiptValidation?: string;
      validationEvidencePath?: string;
    };
  }>("artifacts/productization/first-real-tester-return-workbench.json");
  const firstRealTesterReturnWorkbenchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-return-workbench-verification.json"
  );
  const firstRealTesterReturnWorkbenchSendReceiptHandoff =
    firstRealTesterReturnWorkbench?.sendReceiptHandoff?.requiredBeforeReturnIntake === true &&
    firstRealTesterReturnWorkbench.sendReceiptHandoff.sendBundleFingerprintGate === "sha256-bound" &&
    firstRealTesterReturnWorkbench.sendReceiptHandoff.validationEvidencePath ===
      "artifacts/productization/first-real-tester-send-receipt-validation.json"
      ? "required; fingerprint=sha256-bound; validation=first-real-tester-send-receipt-validation.json"
      : "missing";
  const firstRealTesterReturnGate = readJson<{ status?: string; returnState?: { canInviteAdditionalTesterOrReviewer?: boolean } }>(
    "artifacts/productization/first-real-tester-return-gate.json"
  );
  const firstRealTesterReturnGateVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-return-gate-verification.json"
  );
  const sessionReceiptValidation = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-session-receipt-validation.json"
  );
  const publicBetaReturnIntake = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-return-intake-verification.json"
  );
  const humanAcceptanceReturnIntake = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-return-intake-verification.json"
  );
  const realModelTrialReturnIntake = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/real-model-trial-return-intake-verification.json"
  );
  const realModelTrialKit = readJson<{
    status?: string;
    credentialRedactionChecklist?: Array<{ id?: string }>;
    evidenceToReturn?: string[];
  }>("artifacts/productization/real-model-trial-kit.json");
  const productReleaseApprovalReturnIntake = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-release-approval-return-intake-verification.json"
  );

  const packageJson = readJson<{ scripts?: Record<string, string>; engines?: { node?: string; npm?: string }; packageManager?: string }>(`package.json`);
  const deliveryCommandScriptNames = [
    `package:github-source`,
    `verify:github-source`,
    `verify:new-repo-bootstrap`,
    `build:product-delivery-index`,
    `verify:product-delivery-index`,
    `build:first-real-tester-launch`,
    `verify:first-real-tester-launch`,
    `build:first-real-tester-dispatch-packet`,
    `verify:first-real-tester-dispatch-packet`,
    `build:first-real-tester-send-bundle`,
    `verify:first-real-tester-send-bundle`,
    `build:first-real-tester-contact-readiness`,
    `verify:first-real-tester-contact-readiness`,
    `build:first-real-tester-send-execution-brief`,
    `verify:first-real-tester-send-execution-brief`,
    `build:first-real-tester-send-receipt-template`,
    `verify:first-real-tester-send-receipt-template`,
    `build:first-real-tester-final-go-no-go`,
    `verify:first-real-tester-final-go-no-go`,
    `build:first-real-tester-return-workbench`,
    `verify:first-real-tester-return-workbench`,
    `build:first-real-tester-return-gate`,
    `verify:first-real-tester-return-gate`,
    `verify:public-beta`,
    `verify:product-trial`,
    `verify:project-takeover-assessment`,
    `preflight:public-beta-tester`,
    `preflight:human-acceptance`,
    `intake:human-acceptance-return`,
    `verify:human-acceptance-return-intake`,
    `intake:public-beta-return`,
    `verify:real-model-adapter-contract`,
    `intake:real-model-trial-return`,
    `verify:real-model-trial-return-intake`,
    `intake:product-release-approval-return`,
    `verify:product-release-approval-return-intake`
  ];
  const deliveryCommandContract = {
    source: `package.json#scripts`,
    requiredScripts: deliveryCommandScriptNames.map((name) => ({
      name,
      command: packageJson?.scripts?.[name] ?? `missing`,
      present: typeof packageJson?.scripts?.[name] === `string` && packageJson.scripts[name].length > 0
    }))
  };

  const archivePath = sourceVerification?.archivePath ?? sourceManifest?.archivePath ?? "missing";
  const archiveSha256 = sourceVerification?.archiveSha256 ?? sourceManifest?.archiveSha256 ?? "missing";
  const archiveActualBytes = fileBytes(archivePath);
  const manifestTime = Date.parse(sourceManifest?.generatedAt ?? "");
  const verificationTime = Date.parse(sourceVerification?.generatedAt ?? "");
  const sourcePackageEvidenceIssues = [
    sourceManifest?.status === "built" ? null : "manifest_not_built",
    sourceVerification?.status === "passed" ? null : "verification_not_passed",
    sourceVerification?.uploadReady === true ? null : "verification_not_upload_ready",
    sourceManifest?.archivePath === sourceVerification?.archivePath ? null : "archive_path_mismatch",
    sourceManifest?.archiveSha256 === sourceVerification?.archiveSha256 ? null : "archive_sha256_mismatch",
    typeof sourceManifest?.archiveBytes === "number" && sourceManifest.archiveBytes === archiveActualBytes
      ? null
      : "archive_size_mismatch",
    Number.isFinite(manifestTime) && Number.isFinite(verificationTime) && verificationTime >= manifestTime
      ? null
      : "verification_older_than_manifest"
  ].filter((issue): issue is string => typeof issue === "string");
  const sourcePackageEvidenceConsistent = sourcePackageEvidenceIssues.length === 0;
  const firstReadOrder = takeover?.firstReadOrder ?? [
    "artifacts/productization/product-takeover-decision-matrix.md",
    "artifacts/productization/productization-launch-checklist.md",
    "artifacts/productization/first-real-tester-launch.md",
    "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
    "artifacts/productization/first-real-tester-send-bundle.md",
    "artifacts/productization/first-real-tester-contact-readiness.md",
    "artifacts/productization/first-real-tester-send-execution-brief.md",
    "artifacts/productization/first-real-tester-send-receipt-template.md",
    "artifacts/productization/first-real-tester-return-workbench.md",
    "artifacts/productization/first-real-tester-return-gate.md",
    "artifacts/productization/product-status-summary.md",
    "artifacts/productization/product-operator-brief.md"
  ];
  if (!firstReadOrder.includes("artifacts/productization/first-real-tester-contact-readiness.md")) {
    const sendBundleIndex = firstReadOrder.indexOf("artifacts/productization/first-real-tester-send-bundle.md");
    firstReadOrder.splice(
      sendBundleIndex >= 0 ? sendBundleIndex + 1 : 5,
      0,
      "artifacts/productization/first-real-tester-contact-readiness.md"
    );
  }
  if (!firstReadOrder.includes("artifacts/productization/first-real-tester-send-execution-brief.md")) {
    const contactIndex = firstReadOrder.indexOf("artifacts/productization/first-real-tester-contact-readiness.md");
    firstReadOrder.splice(
      contactIndex >= 0 ? contactIndex + 1 : 6,
      0,
      "artifacts/productization/first-real-tester-send-execution-brief.md"
    );
  }
  if (!firstReadOrder.includes("artifacts/productization/first-real-tester-final-go-no-go.md")) {
    const sendReceiptIndex = firstReadOrder.indexOf("artifacts/productization/first-real-tester-send-receipt-template.md");
    firstReadOrder.splice(
      sendReceiptIndex >= 0 ? sendReceiptIndex + 1 : 8,
      0,
      "artifacts/productization/first-real-tester-final-go-no-go.md"
    );
  }
  const releaseDecision = sourceVerification?.releaseDecision ?? summary?.releaseDecision ?? release?.releaseDecision ?? "do_not_release";
  const allSoftwareObjective = sourceVerification?.allSoftwareObjective ?? summary?.allSoftwareObjective ?? "paused";
  const realModelTrialRedactionIds = (realModelTrialKit?.credentialRedactionChecklist ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const realModelTrialRedactionEvidence = `kit=${realModelTrialKit?.status ?? "missing"}; redaction=${
    realModelTrialRedactionIds.join(",") || "missing"
  }; evidence=${
    realModelTrialKit?.evidenceToReturn?.some((item) => item.includes("Completed credential redaction checklist")) === true
      ? "completed_credential_redaction_checklist"
      : "missing"
  }`;
  const publicBetaSessionPlanVerifier = statusLine(
    publicBetaSessionPlanVerification?.status,
    publicBetaSessionPlanVerification?.passed,
    publicBetaSessionPlanVerification?.total
  );
  const publicBetaSessionPlanSummary = summary?.readiness?.publicBetaSessionPlan;
  const publicBetaSessionPlanEvidence =
    typeof publicBetaSessionPlanSummary === "string" && publicBetaSessionPlanSummary.length > 0
      ? publicBetaSessionPlanSummary.includes("verifier=")
        ? publicBetaSessionPlanSummary.replace(/verifier=[^;]+/, `verifier=${publicBetaSessionPlanVerifier}`)
        : `${publicBetaSessionPlanSummary}; verifier=${publicBetaSessionPlanVerifier}`
      : `ready=${publicBeta?.status === "passed"}; path=artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md; verifier=${publicBetaSessionPlanVerifier}`;
  const allowedNextActions = (takeover?.allowedActions ?? []).map((action) => {
    if (action.id === "invite_one_bounded_beta_tester") {
      return {
        ...action,
        sessionReceiptTemplatePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
      };
    }

    if (action.id === "plan_real_model_trial_without_activation") {
      const baseStopCondition = action.stopCondition ?? "Stop if real-model trial safety evidence is missing.";
      const redactionStopCondition =
        "Stop if the credential redaction checklist is incomplete, returned artifacts contain secrets, or rollback_to_mock_after_trial is not confirmed.";
      const stopCondition = baseStopCondition.includes("credential redaction checklist")
        ? baseStopCondition
        : `${baseStopCondition} ${redactionStopCondition}`;

      return {
        ...action,
        redactionChecklistPath: "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist",
        stopCondition
      };
    }

    if (action.id === "process_returned_public_beta_feedback") {
      const baseStopCondition = action.stopCondition ?? "Stop if public beta return evidence is missing.";
      const sendReceiptStopCondition =
        "Stop before return intake unless artifacts/productization/first-real-tester-send-receipt-validation.json exists and passed for the exact manually sent first-real tester bundle.";
      const stopCondition = baseStopCondition.includes("first-real-tester-send-receipt-validation.json")
        ? baseStopCondition
        : `${baseStopCondition} ${sendReceiptStopCondition}`;

      return {
        ...action,
        command:
          "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        stopCondition
      };
    }

    if (action.id === "process_returned_human_acceptance_receipt") {
      const baseStopCondition = action.stopCondition ?? "Stop if human acceptance return evidence is missing.";
      const sendReceiptStopCondition =
        "Stop before return intake unless artifacts/productization/first-real-tester-send-receipt-validation.json exists and passed for the exact manually sent first-real tester bundle.";
      const stopCondition = baseStopCondition.includes("first-real-tester-send-receipt-validation.json")
        ? baseStopCondition
        : `${baseStopCondition} ${sendReceiptStopCondition}`;

      return {
        ...action,
        command:
          "npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        stopCondition
      };
    }

    if (action.id === 'process_returned_release_approval_receipt') {
      const baseStopCondition = action.stopCondition ?? 'Stop if release approval prerequisite evidence is missing.';
      const runtimeRollbackStopCondition =
        'Stop if prerequisiteEvidence.aiServiceStatusPath is missing, does not point to post-trial GET /api/ai-service-status JSON, or does not prove activeProvider=mock, realModelReady=false, manualProviderAcceptance=false, accepted=false, and packagingGated=true.';
      const stopCondition = baseStopCondition.includes('prerequisiteEvidence.aiServiceStatusPath')
        ? baseStopCondition
        : `${baseStopCondition} ${runtimeRollbackStopCondition}`;

      return {
        ...action,
        runtimeRollbackEvidencePath: 'prerequisiteEvidence.aiServiceStatusPath',
        stopCondition
      };
    }

    return action;
  });

  const index = {
    responseMode: "product_delivery_index_json_v1",
    status: sourcePackageEvidenceConsistent ? "ready_for_handoff" : "blocked_needs_current_source_package_verification",
    generatedAt: new Date().toISOString(),
    command: "npm run build:product-delivery-index",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective,
    releaseDecision,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    commandContract: deliveryCommandContract,
    finalArchive: {
      path: archivePath,
      bytes: sourceManifest?.archiveBytes ?? archiveActualBytes,
      actualBytes: archiveActualBytes,
      sha256: archiveSha256,
      manifestArchivePath: sourceManifest?.archivePath ?? "missing",
      verificationArchivePath: sourceVerification?.archivePath ?? "missing",
      manifestSha256: sourceManifest?.archiveSha256 ?? "missing",
      verificationSha256: sourceVerification?.archiveSha256 ?? "missing",
      manifestGeneratedAt: sourceManifest?.generatedAt ?? "missing",
      verificationGeneratedAt: sourceVerification?.generatedAt ?? "missing",
      evidenceConsistent: sourcePackageEvidenceConsistent,
      mismatchReasons: sourcePackageEvidenceIssues,
      uploadReady: sourceVerification?.uploadReady === true,
      verification: statusLine(sourceVerification?.status, sourceVerification?.passed, sourceVerification?.total),
      excludesSecrets: sourceManifest?.packageBoundary?.includesSecrets === false,
      excludesDependencies: sourceManifest?.packageBoundary?.includesDependencies === false,
      excludesLocalDatabase: sourceManifest?.packageBoundary?.includesLocalDatabase === false,
      excludesBuildCache: sourceManifest?.packageBoundary?.includesBuildCache === false
    },
    sourceControlBoundary: {
      localGitStatus: "not_required_for_handoff",
      localGitEvidence: "This workspace root .git directory is not a valid repository; do not treat local git status as delivery evidence.",
      archiveIsSourceOfTruth: true,
      excludedFromArchive: ".git",
      requiredHandoffEvidence: [
        "artifacts/github-source-package/github-source-package-manifest.json",
        "artifacts/github-source-package/github-source-package-verification.json",
        newRepositoryBootstrapReceiptPath,
        "artifacts/productization/product-delivery-index-verification.json"
      ],
      nextRepositoryAction: "Extract the verified archive into a new GitHub repository root, then run the included GITHUB_UPLOAD_README checklist and Productization CI."
    },
    newRepositoryBootstrap: {
      packageManager: "npm",
      packageManagerVersion: packageJson?.packageManager ?? "missing",
      runtimePrerequisites: {
        node: packageJson?.engines?.node ?? "missing",
        npm: packageJson?.engines?.npm ?? "missing",
        ciNodeVersion: "22",
        lockfileVersion: "3"
      },
      lockfile: "package-lock.json",
      environmentTemplate: ".env.example",
      firstRunCommands: [
        {
          id: "verify_source_bootstrap",
          command: "npm run verify:new-repo-bootstrap",
          packageScript: "verify:new-repo-bootstrap",
          evidence: "GITHUB_UPLOAD_README.md",
          stopCondition: "Stop before npm install if the source-only bootstrap check fails, release locks are missing, or first-read handoff docs are out of order."
        },
        {
          id: "install_dependencies",
          command: "npm install",
          evidence: "package-lock.json",
          stopCondition: "Stop if npm install cannot reproduce dependencies from package-lock.json."
        },
        {
          id: "create_environment_file",
          command: "node -e \"require('node:fs').copyFileSync('.env.example','.env')\"",
          platformCommands: {
            windowsPowerShell: "Copy-Item .env.example .env",
            bash: "cp .env.example .env"
          },
          evidence: ".env.example",
          stopCondition: "Keep .env local; do not commit secrets or generated environment files."
        },
        { id: "typecheck", command: "npm run typecheck", packageScript: "typecheck", evidence: "tsconfig.json" },
        { id: "unit_tests", command: "npm run test", packageScript: "test", evidence: "vitest.config.ts" },
        { id: "product_readiness", command: "npm run verify:product -- --port 3110", packageScript: "verify:product", evidence: "artifacts/productization/product-verification-receipt.json" }
      ],
      healthCheck: {
        command: "npm run start:product -- --hostname 127.0.0.1 --port 3000",
        packageScript: "start:product",
        endpoint: "http://127.0.0.1:3000/api/health",
        expectedResponseMode: "product_health_json_v1",
        expectedStatus: "healthy"
      },
      finalGate: {
        command: "npm run ci:productization",
        packageScript: "ci:productization",
        stopCondition: "Stop if local Productization CI or GitHub Actions fails, if the staged source package takeover-entry scan is missing, or if final source-package verification fails before inviting a tester from the checkout."
      }
    },
    evidence: {
      localProductizationCi: statusLine(localCi?.status, localCi?.passed, localCi?.total),
      publicBeta: statusLine(publicBeta?.status, publicBeta?.passed, publicBeta?.total),
      publicBetaSessionPlan: publicBetaSessionPlanEvidence,
      publicBetaSessionReceipt: `template=${statusLine(sessionReceiptValidation?.status, sessionReceiptValidation?.passed, sessionReceiptValidation?.total)}; path=artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json`,
      newRepositoryBootstrap: `${statusLine(
        newRepositoryBootstrapReceipt?.status,
        newRepositoryBootstrapReceipt?.passed,
        newRepositoryBootstrapReceipt?.total
      )}; path=${newRepositoryBootstrapReceiptPath}`,
      productTrial: statusLine(productTrial?.status, productTrial?.passed, productTrial?.total),
      productizationFreshness: statusLine(freshness?.status, freshness?.passed, freshness?.total),
      publicBetaReturnIntake: statusLine(
        publicBetaReturnIntake?.status,
        publicBetaReturnIntake?.passed,
        publicBetaReturnIntake?.total
      ),
      humanAcceptanceReturnIntake: statusLine(
        humanAcceptanceReturnIntake?.status,
        humanAcceptanceReturnIntake?.passed,
        humanAcceptanceReturnIntake?.total
      ),
      realModelTrialReturnIntake: statusLine(
        realModelTrialReturnIntake?.status,
        realModelTrialReturnIntake?.passed,
        realModelTrialReturnIntake?.total
      ),
      realModelTrialCredentialRedaction: realModelTrialRedactionEvidence,
      productReleaseApprovalReturnIntake: statusLine(
        productReleaseApprovalReturnIntake?.status,
        productReleaseApprovalReturnIntake?.passed,
        productReleaseApprovalReturnIntake?.total
      ),
      humanAcceptanceReviewerInvite: `${humanInvite?.status ?? "missing"}; canInvite=${humanInvite?.canInviteHumanReviewer ?? false}; verifier=${statusLine(
        humanInviteVerification?.status,
        humanInviteVerification?.passed,
        humanInviteVerification?.total
      )}`,
      productizationLaunchChecklist: `${launchChecklist?.status ?? "missing"}; verifier=${statusLine(
        launchChecklistVerification?.status,
        launchChecklistVerification?.passed,
        launchChecklistVerification?.total
      )}`,
      firstRealTesterLaunch: `${firstRealTesterLaunch?.status ?? "missing"}; ready=${firstRealTesterLaunch?.readyToLaunch ?? false}; verifier=${statusLine(
        firstRealTesterLaunchVerification?.status,
        firstRealTesterLaunchVerification?.passed,
        firstRealTesterLaunchVerification?.total
      )}`,
      firstRealTesterDispatchPacket: `${firstRealTesterDispatchPacket?.status ?? "missing"}; verifier=${statusLine(
        firstRealTesterDispatchPacketVerification?.status,
        firstRealTesterDispatchPacketVerification?.passed,
        firstRealTesterDispatchPacketVerification?.total
      )}`,
      firstRealTesterSendBundle: `${firstRealTesterSendBundle?.status ?? "missing"}; lane=${
        firstRealTesterSendBundle?.selectedLane?.id ?? firstRealTesterSendBundleVerification?.selectedLane ?? "missing"
      }; verifier=${statusLine(
        firstRealTesterSendBundleVerification?.status,
        firstRealTesterSendBundleVerification?.passed,
        firstRealTesterSendBundleVerification?.total
      )}; fingerprint=${firstRealTesterSendBundleFingerprintGate}`,
      firstRealTesterContactReadiness: `${firstRealTesterContactReadiness?.status ?? "missing"}; contactAllowed=${
        firstRealTesterContactReadiness?.contactAllowed ?? "missing"
      }; decision=${firstRealTesterContactReadiness?.contactDecision ?? "missing"}; lane=${
        firstRealTesterContactReadiness?.selectedLane?.id ?? "missing"
      }; verifier=${statusLine(
        firstRealTesterContactReadinessVerification?.status,
        firstRealTesterContactReadinessVerification?.passed,
        firstRealTesterContactReadinessVerification?.total
      )}; failed=${firstRealTesterContactReadiness?.failedRequiredChecks?.join(",") || "none"}`,
      firstRealTesterSendExecutionBrief: `${firstRealTesterSendExecutionBrief?.status ?? "missing"}; manualSendAllowed=${
        firstRealTesterSendExecutionBrief?.manualSendAllowed ?? "missing"
      }; actualSendPerformed=${firstRealTesterSendExecutionBrief?.actualSendPerformed ?? "missing"}; verifier=${statusLine(
        firstRealTesterSendExecutionBriefVerification?.status,
        firstRealTesterSendExecutionBriefVerification?.passed,
        firstRealTesterSendExecutionBriefVerification?.total
      )}; failed=${firstRealTesterSendExecutionBrief?.failedRequiredChecks?.join(",") || "none"}`,
      firstRealTesterSendReceiptTemplate: `${firstRealTesterSendReceiptTemplate?.status ?? "missing"}; decision=${
        firstRealTesterSendReceiptTemplate?.defaultDecision ?? "missing"
      }; sourceSent=${firstRealTesterSendReceiptTemplate?.sourceBundle?.actualSendPerformed ?? "missing"}; lane=${
        firstRealTesterSendReceiptTemplate?.selectedLane?.id ?? "missing"
      }; verifier=${statusLine(
        firstRealTesterSendReceiptTemplateVerification?.status,
        firstRealTesterSendReceiptTemplateVerification?.passed,
        firstRealTesterSendReceiptTemplateVerification?.total
      )}`,
      firstRealTesterFinalGoNoGo: `${firstRealTesterFinalGoNoGo?.status ?? "missing"}; manualSendAllowed=${
        firstRealTesterFinalGoNoGo?.manualSendAllowed ?? "missing"
      }; actualSendPerformed=${firstRealTesterFinalGoNoGo?.actualSendPerformed ?? "missing"}; verifier=${statusLine(
        firstRealTesterFinalGoNoGoVerification?.status,
        firstRealTesterFinalGoNoGoVerification?.passed,
        firstRealTesterFinalGoNoGoVerification?.total
      )}; failed=${firstRealTesterFinalGoNoGo?.failedRequiredChecks?.join(",") || "none"}`,
      firstRealTesterReturnWorkbench: `${firstRealTesterReturnWorkbench?.status ?? "missing"}; verifier=${statusLine(
        firstRealTesterReturnWorkbenchVerification?.status,
        firstRealTesterReturnWorkbenchVerification?.passed,
        firstRealTesterReturnWorkbenchVerification?.total
      )}; sendReceiptHandoff=${firstRealTesterReturnWorkbenchSendReceiptHandoff}`,
      firstRealTesterReturnGate: `${firstRealTesterReturnGate?.status ?? "missing"}; canInvite=${
        firstRealTesterReturnGate?.returnState?.canInviteAdditionalTesterOrReviewer ?? false
      }; verifier=${statusLine(
        firstRealTesterReturnGateVerification?.status,
        firstRealTesterReturnGateVerification?.passed,
        firstRealTesterReturnGateVerification?.total
      )}`,
      takeoverMatrix: takeover?.status ?? "missing",
      statusSummary: summary?.status ?? "missing",
      releaseReadiness: release?.status ?? "missing"
    },
    firstReadOrder,
    primaryEntrypoints: {
      deliveryIndex: "artifacts/productization/product-delivery-index.md",
      sourceArchive: archivePath,
      sourceVerification: "artifacts/github-source-package/github-source-package-verification.json",
      uploadReadme: "artifacts/github-source-package/transparent-ai-apprentice-mcp/GITHUB_UPLOAD_README.md",
      takeoverMatrix: "artifacts/productization/product-takeover-decision-matrix.md",
      statusSummary: "artifacts/productization/product-status-summary.md",
      operatorBrief: "artifacts/productization/product-operator-brief.md",
      humanAcceptanceReviewerInvite: "artifacts/productization/human-acceptance-reviewer-invite.md",
      productizationLaunchChecklist: "artifacts/productization/productization-launch-checklist.md",
      firstRealTesterLaunch: "artifacts/productization/first-real-tester-launch.md",
      firstRealTesterDispatchPacket: "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
      firstRealTesterSendBundle: "artifacts/productization/first-real-tester-send-bundle.md",
      firstRealTesterSendExternalFolder: "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON",
      firstRealTesterContactReadiness: "artifacts/productization/first-real-tester-contact-readiness.md",
      firstRealTesterSendExecutionBrief: "artifacts/productization/first-real-tester-send-execution-brief.md",
      firstRealTesterSendReceiptTemplate: "artifacts/productization/first-real-tester-send-receipt-template.md",
      firstRealTesterFinalGoNoGo: "artifacts/productization/first-real-tester-final-go-no-go.md",
      firstRealTesterReturnWorkbench: "artifacts/productization/first-real-tester-return-workbench.md",
      firstRealTesterReturnGate: "artifacts/productization/first-real-tester-return-gate.md",
      publicBetaPacket: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      publicBetaSessionPlan: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      publicBetaSessionReceiptTemplate: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      realModelTrialKit: "artifacts/productization/real-model-trial-kit.md"
    },
    allowedNextActions,
    blockedActions: takeover?.blockedActions ?? [],
    releaseBlockers: release?.blockers ?? [],
    nextAction:
      "Hand off the verified source archive with this delivery index; start with the takeover matrix, then use first-real-tester-launch.md to run exactly one bounded beta or real human acceptance pass while release stays locked; use first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md to choose one lane, first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON as the only external send folder, rebuild first-real-tester-contact-readiness.md after the live preflight and contact nobody unless contactAllowed=true, open first-real-tester-send-execution-brief.md before the manual send, record the manual send with first-real-tester-send-receipt-template.md, open first-real-tester-final-go-no-go.md as the last operator check immediately before exactly one manual send, and validate the filled receipt with npm run verify:first-real-tester-send-receipt-template -- --receipt <path>; if validation fails, inspect failedChecks, follow remediationActions, and use nextAction before treating the send as recorded; then first-real-tester-return-workbench.md when the first return arrives."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(indexJsonPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const markdown = `# Product Delivery Index

Generated: ${index.generatedAt}

This is the outer delivery index for the current bounded product handoff. It points to the verified source archive and the first files a maintainer should open. It is not release approval.

## Final Archive

- Archive: \`${index.finalArchive.path}\`
- SHA-256: \`${index.finalArchive.sha256}\`
- Source verification: \`${index.finalArchive.verification}\`
- Upload ready: \`${index.finalArchive.uploadReady}\`
- Manifest/verification/archive consistent: \`${index.finalArchive.evidenceConsistent}\`
- Consistency issues: \`${index.finalArchive.mismatchReasons.join(", ") || "none"}\`
- Excludes secrets/dependencies/local DB/build cache: \`${index.finalArchive.excludesSecrets}/${index.finalArchive.excludesDependencies}/${index.finalArchive.excludesLocalDatabase}/${index.finalArchive.excludesBuildCache}\`

## Source Control Boundary

- Local git status: \`${index.sourceControlBoundary.localGitStatus}\`
- Local git evidence: ${index.sourceControlBoundary.localGitEvidence}
- Archive is source of truth: \`${index.sourceControlBoundary.archiveIsSourceOfTruth}\`
- Excluded from archive: \`${index.sourceControlBoundary.excludedFromArchive}\`
- Next repository action: ${index.sourceControlBoundary.nextRepositoryAction}
- Required handoff evidence: ${index.sourceControlBoundary.requiredHandoffEvidence.map((item) => `\`${item}\``).join(", ")}

## New Repository Bootstrap

- Package manager: \`${index.newRepositoryBootstrap.packageManager}\`
- Package manager version: \`${index.newRepositoryBootstrap.packageManagerVersion}\`
- Runtime prerequisites: Node \`${index.newRepositoryBootstrap.runtimePrerequisites.node}\`; npm \`${index.newRepositoryBootstrap.runtimePrerequisites.npm}\`; CI Node \`${index.newRepositoryBootstrap.runtimePrerequisites.ciNodeVersion}\`; lockfile v\`${index.newRepositoryBootstrap.runtimePrerequisites.lockfileVersion}\`
- Lockfile: \`${index.newRepositoryBootstrap.lockfile}\`
- Environment template: \`${index.newRepositoryBootstrap.environmentTemplate}\`
- First-run commands:

${markdownList(index.newRepositoryBootstrap.firstRunCommands.map(formatBootstrapStep))}

- Health check: \`${index.newRepositoryBootstrap.healthCheck.command}\` then \`${index.newRepositoryBootstrap.healthCheck.endpoint}\` should report \`${index.newRepositoryBootstrap.healthCheck.expectedResponseMode}\` and \`${index.newRepositoryBootstrap.healthCheck.expectedStatus}\`.
- Final gate: \`${index.newRepositoryBootstrap.finalGate.command}\`; stop: ${index.newRepositoryBootstrap.finalGate.stopCondition}

## Current Boundary

- Product scope: \`${index.productScope}\`
- Release decision: \`${index.releaseDecision}\`
- All-software objective: \`${index.allSoftwareObjective}\`
- Accepted: \`${index.accepted}\`
- Packaging gated: \`${index.packagingGated}\`
- Can release: \`${index.canRelease}\`
- Can activate real model: \`${index.canActivateRealModel}\`

## Command Contract

${markdownList(index.commandContract.requiredScripts.map((script) => `\`${script.name}\` - present: \`${script.present}\`; command: \`${script.command}\``))}

## Evidence Snapshot

| Evidence | Status |
| --- | --- |
| Local productization CI | \`${index.evidence.localProductizationCi}\` |
| Public beta | \`${index.evidence.publicBeta}\` |
| Public beta session plan | \`${index.evidence.publicBetaSessionPlan}\` |
| Public beta session receipt | \`${index.evidence.publicBetaSessionReceipt}\` |
| New repository bootstrap receipt | \`${index.evidence.newRepositoryBootstrap}\` |
| Product trial packet | \`${index.evidence.productTrial}\` |
| Evidence freshness | \`${index.evidence.productizationFreshness}\` |
| Public beta return intake | \`${index.evidence.publicBetaReturnIntake}\` |
| Human acceptance return intake | \`${index.evidence.humanAcceptanceReturnIntake}\` |
| Real-model trial return intake | \`${index.evidence.realModelTrialReturnIntake}\` |
| Real-model credential redaction | \`${index.evidence.realModelTrialCredentialRedaction}\` |
| Product release approval return intake | \`${index.evidence.productReleaseApprovalReturnIntake}\` |
| Human acceptance reviewer invite | \`${index.evidence.humanAcceptanceReviewerInvite}\` |
| Productization launch checklist | \`${index.evidence.productizationLaunchChecklist}\` |
| First real tester launch | \`${index.evidence.firstRealTesterLaunch}\` |
| First real tester dispatch packet | \`${index.evidence.firstRealTesterDispatchPacket}\` |
| First real tester send bundle | \`${index.evidence.firstRealTesterSendBundle}\` |
| First real tester contact readiness | \`${index.evidence.firstRealTesterContactReadiness}\` |
| First real tester send execution brief | \`${index.evidence.firstRealTesterSendExecutionBrief}\` |
| First real tester send receipt template | \`${index.evidence.firstRealTesterSendReceiptTemplate}\` |
| First real tester final go/no-go | \`${index.evidence.firstRealTesterFinalGoNoGo}\` |
| First real tester return workbench | \`${index.evidence.firstRealTesterReturnWorkbench}\` |
| First real tester return gate | \`${index.evidence.firstRealTesterReturnGate}\` |
| Takeover matrix | \`${index.evidence.takeoverMatrix}\` |
| Status summary | \`${index.evidence.statusSummary}\` |
| Release readiness | \`${index.evidence.releaseReadiness}\` |

## Primary Entrypoints

- Delivery index: \`${index.primaryEntrypoints.deliveryIndex}\`
- Source archive: \`${index.primaryEntrypoints.sourceArchive}\`
- Takeover matrix: \`${index.primaryEntrypoints.takeoverMatrix}\`
- Status summary: \`${index.primaryEntrypoints.statusSummary}\`
- Operator brief: \`${index.primaryEntrypoints.operatorBrief}\`
- Human acceptance reviewer invite: \`${index.primaryEntrypoints.humanAcceptanceReviewerInvite}\`
- Productization launch checklist: \`${index.primaryEntrypoints.productizationLaunchChecklist}\`
- First real tester launch: \`${index.primaryEntrypoints.firstRealTesterLaunch}\`
- First real tester dispatch packet: \`${index.primaryEntrypoints.firstRealTesterDispatchPacket}\`
- First real tester send bundle: \`${index.primaryEntrypoints.firstRealTesterSendBundle}\`
- First real tester send folder: \`${index.primaryEntrypoints.firstRealTesterSendExternalFolder}\`
- First real tester contact readiness: \`${index.primaryEntrypoints.firstRealTesterContactReadiness}\`
- First real tester send execution brief: \`${index.primaryEntrypoints.firstRealTesterSendExecutionBrief}\`
- First real tester send receipt template: \`${index.primaryEntrypoints.firstRealTesterSendReceiptTemplate}\`
- First real tester final go/no-go: \`${index.primaryEntrypoints.firstRealTesterFinalGoNoGo}\`
- First real tester return workbench: \`${index.primaryEntrypoints.firstRealTesterReturnWorkbench}\`
- First real tester return gate: \`${index.primaryEntrypoints.firstRealTesterReturnGate}\`
- Public beta packet: \`${index.primaryEntrypoints.publicBetaPacket}\`
- Public beta session plan: \`${index.primaryEntrypoints.publicBetaSessionPlan}\`
- Public beta session receipt template: \`${index.primaryEntrypoints.publicBetaSessionReceiptTemplate}\`
- Real-model trial kit: \`${index.primaryEntrypoints.realModelTrialKit}\`

## First Read Order

${markdownList(index.firstReadOrder.map((item) => `\`${item}\``))}

## Allowed Next Actions

${markdownList(index.allowedNextActions.map(formatAllowedAction))}

## Blocked Actions

${markdownList(index.blockedActions.map((action) => `\`${action.id ?? "unknown"}\` - blocked: \`${action.blocked === true}\`; evidence: ${action.evidence ?? "missing"}`))}

## Release Blockers

${markdownList(index.releaseBlockers.map((blocker) => `**${blocker.name ?? "Unnamed blocker"}** - ${blocker.evidence ?? "missing"}; next: ${blocker.nextAction ?? "missing"}`))}

## Next Step

${index.nextAction}
`;
  fs.writeFileSync(indexMarkdownPath, markdown, "utf8");
  console.log(JSON.stringify(index, null, 2));
  console.log(`\nProduct delivery index written to ${indexJsonPath}`);
  console.log(`Product delivery index Markdown written to ${indexMarkdownPath}`);
}

main();
