import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const indexPath = path.join(artifactsDir, "product-delivery-index.json");
const markdownPath = path.join(artifactsDir, "product-delivery-index.md");
const receiptPath = path.join(artifactsDir, "product-delivery-index-verification.json");

type Check = { name: string; pass: boolean; evidence: string };

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readJson<T>(relativePathOrFullPath: string): T | null {
  const fullPath = path.isAbsolute(relativePathOrFullPath) ? relativePathOrFullPath : path.join(rootDir, relativePathOrFullPath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(fullPath: string) {
  try {
    return fs.readFileSync(fullPath, "utf8");
  } catch {
    return "";
  }
}

function fileExistsWithSize(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function fileSize(relativePath: string) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
}

function main() {
  const index = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    productScope?: string;
    allSoftwareObjective?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    commandContract?: {
      source?: string;
      requiredScripts?: Array<{ name?: string; command?: string; present?: boolean }>;
    };
    finalArchive?: { path?: string; bytes?: number; actualBytes?: number; sha256?: string; manifestArchivePath?: string; verificationArchivePath?: string; manifestSha256?: string; verificationSha256?: string; manifestGeneratedAt?: string; verificationGeneratedAt?: string; evidenceConsistent?: boolean; mismatchReasons?: string[]; uploadReady?: boolean; verification?: string; excludesSecrets?: boolean; excludesDependencies?: boolean; excludesLocalDatabase?: boolean; excludesBuildCache?: boolean };
    sourceControlBoundary?: { localGitStatus?: string; localGitEvidence?: string; archiveIsSourceOfTruth?: boolean; excludedFromArchive?: string; requiredHandoffEvidence?: string[]; nextRepositoryAction?: string };
    newRepositoryBootstrap?: { packageManager?: string; packageManagerVersion?: string; runtimePrerequisites?: { node?: string; npm?: string; ciNodeVersion?: string; lockfileVersion?: string }; lockfile?: string; environmentTemplate?: string; firstRunCommands?: Array<{ id?: string; command?: string; packageScript?: string; evidence?: string; stopCondition?: string; platformCommands?: Record<string, string> }>; healthCheck?: { command?: string; packageScript?: string; endpoint?: string; expectedResponseMode?: string; expectedStatus?: string }; finalGate?: { command?: string; packageScript?: string; stopCondition?: string } };
    evidence?: {
      localProductizationCi?: string;
      publicBeta?: string;
      publicBetaSessionPlan?: string;
      publicBetaSessionReceipt?: string;
      newRepositoryBootstrap?: string;
      productTrial?: string;
      productizationFreshness?: string;
      publicBetaReturnIntake?: string;
      humanAcceptanceReturnIntake?: string;
      realModelTrialReturnIntake?: string;
      realModelTrialCredentialRedaction?: string;
      productReleaseApprovalReturnIntake?: string;
      humanAcceptanceReviewerInvite?: string;
      productizationLaunchChecklist?: string;
      firstRealTesterLaunch?: string;
      firstRealTesterDispatchPacket?: string;
      firstRealTesterSendBundle?: string;
      firstRealTesterContactReadiness?: string;
      firstRealTesterSendExecutionBrief?: string;
      firstRealTesterSendReceiptTemplate?: string;
      firstRealTesterFinalGoNoGo?: string;
      firstRealTesterReturnWorkbench?: string;
      firstRealTesterReturnGate?: string;
      takeoverMatrix?: string;
      statusSummary?: string;
      releaseReadiness?: string;
    };
    primaryEntrypoints?: { humanAcceptanceReviewerInvite?: string; productizationLaunchChecklist?: string; firstRealTesterLaunch?: string; firstRealTesterDispatchPacket?: string; firstRealTesterSendBundle?: string; firstRealTesterSendExternalFolder?: string; firstRealTesterContactReadiness?: string; firstRealTesterSendExecutionBrief?: string; firstRealTesterSendReceiptTemplate?: string; firstRealTesterFinalGoNoGo?: string; firstRealTesterReturnWorkbench?: string; firstRealTesterReturnGate?: string; publicBetaSessionPlan?: string; publicBetaSessionReceiptTemplate?: string; realModelTrialKit?: string };
    firstReadOrder?: string[];
    allowedNextActions?: Array<{
      id?: string;
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
    }>;
    blockedActions?: Array<{ id?: string; blocked?: boolean }>;
    releaseBlockers?: Array<{ name?: string }>;
  }>(indexPath);
  const markdown = readText(markdownPath);
  const sourceManifest = readJson<{ status?: string; generatedAt?: string; archivePath?: string; archiveBytes?: number; archiveSha256?: string }>(
    "artifacts/github-source-package/github-source-package-manifest.json"
  );
  const sourceVerification = readJson<{ status?: string; generatedAt?: string; archivePath?: string; archiveSha256?: string; uploadReady?: boolean; passed?: number; total?: number }>(
    "artifacts/github-source-package/github-source-package-verification.json"
  );
  const packageJson = readJson<{ scripts?: Record<string, string>; engines?: { node?: string; npm?: string }; packageManager?: string }>(`package.json`);
  const publicBetaReturnIntake = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-return-intake-verification.json"
  );
  const humanAcceptanceReturnIntake = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-return-intake-verification.json"
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
  const expectedPublicBetaReturnIntake =
    publicBetaReturnIntake?.status === "passed" && typeof publicBetaReturnIntake.passed === "number" && typeof publicBetaReturnIntake.total === "number"
      ? `passed ${publicBetaReturnIntake.passed}/${publicBetaReturnIntake.total}`
      : "missing";
  const expectedHumanAcceptanceReturnIntake =
    humanAcceptanceReturnIntake?.status === "passed" && typeof humanAcceptanceReturnIntake.passed === "number" && typeof humanAcceptanceReturnIntake.total === "number"
      ? `passed ${humanAcceptanceReturnIntake.passed}/${humanAcceptanceReturnIntake.total}`
      : "missing";
  const requiredDeliveryScripts = [
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
  const commandContractRows = index?.commandContract?.requiredScripts ?? [];
  const commandContractByName = new Map(commandContractRows.map((script) => [script.name, script]));
  const commandToScriptName = (command?: string) => command?.match(/^npm run ([^ ]+)/)?.[1] ?? null;
  const actionScriptNames = (index?.allowedNextActions ?? [])
    .flatMap((action) => [commandToScriptName(action.command), commandToScriptName(action.postIntakeCommand)])
    .filter((name): name is string => typeof name === `string` && name.length > 0);
  const manifestTime = Date.parse(sourceManifest?.generatedAt ?? "");
  const verificationTime = Date.parse(sourceVerification?.generatedAt ?? "");
  const actualArchiveBytes = fileSize(sourceManifest?.archivePath ?? "missing");
  const sourcePackageEvidenceConsistent =
    sourceManifest?.status === "built" &&
    sourceVerification?.status === "passed" &&
    sourceVerification.uploadReady === true &&
    sourceManifest.archivePath === sourceVerification.archivePath &&
    sourceManifest.archiveSha256 === sourceVerification.archiveSha256 &&
    typeof sourceManifest.archiveBytes === "number" &&
    sourceManifest.archiveBytes === actualArchiveBytes &&
    Number.isFinite(manifestTime) &&
    Number.isFinite(verificationTime) &&
    verificationTime >= manifestTime;

  const missingRequiredScripts = requiredDeliveryScripts.filter((name) => {
    const row = commandContractByName.get(name);
    return row?.present !== true || row.command !== packageJson?.scripts?.[name];
  });
  const missingActionScripts = actionScriptNames.filter((name) => typeof packageJson?.scripts?.[name] !== `string`);
  const checks: Check[] = [];

  push(
    checks,
    "Delivery index exists and points at the verified source archive",
    index?.responseMode === "product_delivery_index_json_v1" &&
      index.status === "ready_for_handoff" &&
      sourcePackageEvidenceConsistent &&
      index.finalArchive?.path === sourceManifest?.archivePath &&
      index.finalArchive?.path === sourceVerification?.archivePath &&
      index.finalArchive?.manifestArchivePath === sourceManifest.archivePath &&
      index.finalArchive?.verificationArchivePath === sourceVerification.archivePath &&
      index.finalArchive?.uploadReady === true &&
      index.finalArchive?.evidenceConsistent === true &&
      (index.finalArchive?.mismatchReasons?.length ?? 0) === 0 &&
      /^[a-f0-9]{64}$/.test(index.finalArchive?.sha256 ?? "") &&
      index.finalArchive.sha256 === sourceManifest.archiveSha256 &&
      index.finalArchive.sha256 === sourceVerification.archiveSha256 &&
      index.finalArchive.bytes === sourceManifest.archiveBytes &&
      index.finalArchive.actualBytes === actualArchiveBytes &&
      fileExistsWithSize(index.finalArchive?.path ?? "", 1_000_000),
    `status=${index?.status ?? "missing"}; archive=${index?.finalArchive?.path ?? "missing"}; sha256=${index?.finalArchive?.sha256 ?? "missing"}; manifest=${sourceManifest?.status ?? "missing"} ${sourceManifest?.archivePath ?? "missing"} ${sourceManifest?.archiveSha256 ?? "missing"}; verification=${sourceVerification?.status ?? "missing"} ${sourceVerification?.passed ?? "?"}/${sourceVerification?.total ?? "?"}; consistent=${index?.finalArchive?.evidenceConsistent ?? "missing"}; issues=${index?.finalArchive?.mismatchReasons?.join(",") || "none"}`
  );

  push(
    checks,
    `Delivery index declares source-control handoff boundary`,
    index?.sourceControlBoundary?.localGitStatus === `not_required_for_handoff` &&
      index.sourceControlBoundary.archiveIsSourceOfTruth === true &&
      index.sourceControlBoundary.excludedFromArchive === `.git` &&
      index.sourceControlBoundary.localGitEvidence?.includes(`not a valid repository`) === true &&
      index.sourceControlBoundary.nextRepositoryAction?.includes(`new GitHub repository root`) === true &&
      index.sourceControlBoundary.requiredHandoffEvidence?.includes(`artifacts/github-source-package/github-source-package-manifest.json`) === true &&
      index.sourceControlBoundary.requiredHandoffEvidence?.includes(`artifacts/github-source-package/github-source-package-verification.json`) === true &&
      index.sourceControlBoundary.requiredHandoffEvidence?.includes(newRepositoryBootstrapReceiptPath) === true &&
      index.sourceControlBoundary.requiredHandoffEvidence?.includes(`artifacts/productization/product-delivery-index-verification.json`) === true &&
      markdown.includes(`## Source Control Boundary`) &&
      markdown.includes(`Archive is source of truth`) &&
      markdown.includes(`not_required_for_handoff`) &&
      markdown.includes(`new GitHub repository root`),
    `localGit=${index?.sourceControlBoundary?.localGitStatus ?? `missing`}; archiveSource=${index?.sourceControlBoundary?.archiveIsSourceOfTruth ?? `missing`}; excluded=${index?.sourceControlBoundary?.excludedFromArchive ?? `missing`}; evidence=${index?.sourceControlBoundary?.requiredHandoffEvidence?.length ?? 0}`
  );
  const bootstrapCommands = index?.newRepositoryBootstrap?.firstRunCommands ?? [];
  const bootstrapById = new Map(bootstrapCommands.map((step) => [step.id, step]));
  const bootstrapScripts = [
    bootstrapById.get(`verify_source_bootstrap`)?.packageScript,
    bootstrapById.get(`typecheck`)?.packageScript,
    bootstrapById.get(`unit_tests`)?.packageScript,
    bootstrapById.get(`product_readiness`)?.packageScript,
    index?.newRepositoryBootstrap?.healthCheck?.packageScript,
    index?.newRepositoryBootstrap?.finalGate?.packageScript
  ].filter((name): name is string => typeof name === `string` && name.length > 0);

  push(
    checks,
    `Delivery index declares new-repository bootstrap commands`,
    index?.newRepositoryBootstrap?.packageManager === `npm` &&
      index.newRepositoryBootstrap.packageManagerVersion === packageJson?.packageManager &&
      index.newRepositoryBootstrap.packageManagerVersion === `npm@11.12.1` &&
      index.newRepositoryBootstrap.runtimePrerequisites?.node === packageJson?.engines?.node &&
      index.newRepositoryBootstrap.runtimePrerequisites?.node === `>=22 <25` &&
      index.newRepositoryBootstrap.runtimePrerequisites?.npm === packageJson?.engines?.npm &&
      index.newRepositoryBootstrap.runtimePrerequisites?.npm === `>=10` &&
      index.newRepositoryBootstrap.runtimePrerequisites?.ciNodeVersion === `22` &&
      index.newRepositoryBootstrap.runtimePrerequisites?.lockfileVersion === `3` &&
      index.newRepositoryBootstrap.lockfile === `package-lock.json` &&
      index.newRepositoryBootstrap.environmentTemplate === `.env.example` &&
      bootstrapById.get(`verify_source_bootstrap`)?.command === `npm run verify:new-repo-bootstrap` &&
      bootstrapById.get(`verify_source_bootstrap`)?.packageScript === `verify:new-repo-bootstrap` &&
      bootstrapById.get(`verify_source_bootstrap`)?.evidence === `GITHUB_UPLOAD_README.md` &&
      bootstrapById.get(`verify_source_bootstrap`)?.stopCondition?.includes(`Stop before npm install`) === true &&
      bootstrapById.get(`install_dependencies`)?.command === `npm install` &&
      bootstrapById.get(`install_dependencies`)?.evidence === `package-lock.json` &&
      bootstrapById.get(`create_environment_file`)?.command === `node -e "require('node:fs').copyFileSync('.env.example','.env')"` &&
      bootstrapById.get(`create_environment_file`)?.platformCommands?.windowsPowerShell === `Copy-Item .env.example .env` &&
      bootstrapById.get(`create_environment_file`)?.platformCommands?.bash === `cp .env.example .env` &&
      bootstrapById.get(`create_environment_file`)?.evidence === `.env.example` &&
      bootstrapById.get(`typecheck`)?.command === `npm run typecheck` &&
      bootstrapById.get(`unit_tests`)?.command === `npm run test` &&
      bootstrapById.get(`product_readiness`)?.command === `npm run verify:product -- --port 3110` &&
      index.newRepositoryBootstrap.healthCheck?.command === `npm run start:product -- --hostname 127.0.0.1 --port 3000` &&
      index.newRepositoryBootstrap.healthCheck?.endpoint === `http://127.0.0.1:3000/api/health` &&
      index.newRepositoryBootstrap.healthCheck?.expectedResponseMode === `product_health_json_v1` &&
      index.newRepositoryBootstrap.healthCheck?.expectedStatus === `healthy` &&
      index.newRepositoryBootstrap.finalGate?.command === `npm run ci:productization` &&
      index.newRepositoryBootstrap.finalGate?.stopCondition?.includes(`staged source package takeover-entry scan`) === true &&
      index.newRepositoryBootstrap.finalGate?.stopCondition?.includes(`final source-package verification`) === true &&
      bootstrapScripts.every((name) => typeof packageJson?.scripts?.[name] === `string`) &&
      markdown.includes(`## New Repository Bootstrap`) &&
      markdown.includes(`npm@11.12.1`) &&
      markdown.includes(`>=22 <25`) &&
      markdown.includes(`CI Node`) &&
      markdown.includes(`npm install`) &&
      markdown.includes(`node -e "require('node:fs').copyFileSync('.env.example','.env')"`) &&
      markdown.includes(`Copy-Item .env.example .env`) &&
      markdown.includes(`cp .env.example .env`) &&
      markdown.includes(`npm run verify:product -- --port 3110`) &&
      markdown.includes(`http://127.0.0.1:3000/api/health`) &&
      markdown.includes(`product_health_json_v1`) &&
      markdown.includes(`npm run ci:productization`) &&
      markdown.includes(`staged source package takeover-entry scan`) &&
      markdown.includes(`final source-package verification`),
    `packageManager=${index?.newRepositoryBootstrap?.packageManager ?? `missing`}; packageManagerVersion=${index?.newRepositoryBootstrap?.packageManagerVersion ?? `missing`}; node=${index?.newRepositoryBootstrap?.runtimePrerequisites?.node ?? `missing`}; npm=${index?.newRepositoryBootstrap?.runtimePrerequisites?.npm ?? `missing`}; commands=${bootstrapCommands.length}; envNode=${bootstrapById.get(`create_environment_file`)?.command ?? `missing`}; envPs=${bootstrapById.get(`create_environment_file`)?.platformCommands?.windowsPowerShell ?? `missing`}; envBash=${bootstrapById.get(`create_environment_file`)?.platformCommands?.bash ?? `missing`}; scripts=${bootstrapScripts.join(`,`) || `none`}; health=${index?.newRepositoryBootstrap?.healthCheck?.expectedStatus ?? `missing`}`
  );
  push(
    checks,
    `Delivery index command contract matches package scripts`,
    index?.commandContract?.source === `package.json#scripts` &&
      requiredDeliveryScripts.every((name) => commandContractByName.get(name)?.present === true) &&
      requiredDeliveryScripts.every((name) => commandContractByName.get(name)?.command === packageJson?.scripts?.[name]) &&
      missingRequiredScripts.length === 0 &&
      missingActionScripts.length === 0 &&
      markdown.includes(`## Command Contract`) &&
      requiredDeliveryScripts.every((name) => markdown.includes(`\`${name}\` - present: \`true\``)),
    `source=${index?.commandContract?.source ?? `missing`}; required=${requiredDeliveryScripts.length}; missingRequired=${missingRequiredScripts.join(`,`) || `none`}; missingAction=${missingActionScripts.join(`,`) || `none`}`
  );
  push(
    checks,
    "Delivery index preserves release and packaging locks",
    index?.productScope === "bounded_core_teaching_loop" &&
      index.releaseDecision === "do_not_release" &&
      index.allSoftwareObjective === "paused" &&
      index.reviewOnly === true &&
      index.accepted === false &&
      index.packagingGated === true &&
      index.canRelease === false &&
      index.canActivateRealModel === false &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`"),
    `scope=${index?.productScope ?? "missing"}; release=${index?.releaseDecision ?? "missing"}; allSoftware=${index?.allSoftwareObjective ?? "missing"}; accepted=${index?.accepted ?? "missing"}; packagingGated=${index?.packagingGated ?? "missing"}; canRelease=${index?.canRelease ?? "missing"}; canActivateRealModel=${index?.canActivateRealModel ?? "missing"}`
  );

  const evidence = index?.evidence;

  push(
    checks,
    "Delivery index summarizes current green handoff evidence",
    /^passed ([1-9][0-9]*)\/\1$/.test(evidence?.localProductizationCi ?? "") &&
      /^passed \d+\/\d+$/.test(evidence?.publicBeta ?? "") &&
      evidence?.publicBetaSessionPlan?.includes("ready=true") === true &&
      evidence?.publicBetaSessionPlan.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      /passed ([1-9][0-9]*)\/\1/.test(evidence?.publicBetaSessionPlan) &&
      evidence?.publicBetaSessionReceipt?.includes("template=template_ready 9/9") === true &&
      evidence?.publicBetaSessionReceipt.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      newRepositoryBootstrapReceipt?.responseMode === "new_repository_bootstrap_verification_json_v1" &&
      newRepositoryBootstrapReceipt.status === "passed" &&
      newRepositoryBootstrapReceipt.passed === newRepositoryBootstrapReceipt.total &&
      Number(newRepositoryBootstrapReceipt.total ?? 0) >= 9 &&
      newRepositoryBootstrapReceipt.releaseDecision === "do_not_release" &&
      newRepositoryBootstrapReceipt.allSoftwareObjective === "paused" &&
      newRepositoryBootstrapReceipt.accepted === false &&
      newRepositoryBootstrapReceipt.packagingGated === true &&
      newRepositoryBootstrapReceipt.canRelease === false &&
      newRepositoryBootstrapReceipt.canActivateRealModel === false &&
      evidence?.newRepositoryBootstrap === `passed ${newRepositoryBootstrapReceipt.passed}/${newRepositoryBootstrapReceipt.total}; path=${newRepositoryBootstrapReceiptPath}` &&
      markdown.includes("New repository bootstrap receipt") &&
      markdown.includes(newRepositoryBootstrapReceiptPath) &&
      /^passed ([1-9][0-9]*)\/\1$/.test(evidence?.productTrial ?? "") &&
      /^passed \d+\/\d+$/.test(evidence?.productizationFreshness ?? "") &&
      expectedPublicBetaReturnIntake !== "missing" &&
      evidence?.publicBetaReturnIntake === expectedPublicBetaReturnIntake &&
      expectedHumanAcceptanceReturnIntake !== "missing" &&
      evidence?.humanAcceptanceReturnIntake === expectedHumanAcceptanceReturnIntake &&
      evidence?.realModelTrialReturnIntake?.includes("passed 4/4") === true &&
      evidence?.productReleaseApprovalReturnIntake?.includes("passed 6/6") === true &&
      evidence?.humanAcceptanceReviewerInvite?.includes("ready_to_invite_reviewer") === true &&
      evidence?.humanAcceptanceReviewerInvite.includes("verifier=passed 7/7") &&
      evidence?.productizationLaunchChecklist?.includes("ready_for_controlled_launch") === true &&
      evidence?.productizationLaunchChecklist.includes("verifier=passed 7/7") &&
      evidence?.firstRealTesterLaunch?.includes("ready_to_invite_one_bounded_real_tester_or_reviewer") === true &&
      evidence?.firstRealTesterLaunch.includes("ready=true") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence?.firstRealTesterLaunch ?? "") &&
      evidence?.firstRealTesterDispatchPacket?.includes("ready_to_send_one_lane") === true &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence?.firstRealTesterDispatchPacket ?? "") &&
      evidence?.firstRealTesterSendBundle?.includes("ready_to_send_chosen_lane") === true &&
      evidence.firstRealTesterSendBundle.includes("lane=public_beta_tester_session") &&
      evidence.firstRealTesterSendBundle.includes("verifier=passed 9/9") &&
      evidence.firstRealTesterSendBundle.includes("fingerprint=sha256-bound") &&
      evidence?.firstRealTesterContactReadiness?.includes("contactAllowed=true") === true &&
      evidence.firstRealTesterContactReadiness.includes("decision=may_contact_exactly_one_person") &&
      evidence.firstRealTesterContactReadiness.includes("lane=public_beta_tester_session") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence.firstRealTesterContactReadiness) &&
      evidence?.firstRealTesterSendExecutionBrief?.includes("ready_for_manual_send_execution") === true &&
      evidence.firstRealTesterSendExecutionBrief.includes("manualSendAllowed=true") &&
      evidence.firstRealTesterSendExecutionBrief.includes("actualSendPerformed=false") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence.firstRealTesterSendExecutionBrief) &&
      evidence?.firstRealTesterSendReceiptTemplate?.includes("template_ready") === true &&
      evidence.firstRealTesterSendReceiptTemplate.includes("decision=not_sent_yet") &&
      evidence.firstRealTesterSendReceiptTemplate.includes("sourceSent=false") &&
      evidence.firstRealTesterSendReceiptTemplate.includes("lane=public_beta_tester_session") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence.firstRealTesterSendReceiptTemplate) &&
      evidence?.firstRealTesterFinalGoNoGo?.includes("ready_for_one_manual_send") === true &&
      evidence.firstRealTesterFinalGoNoGo.includes("manualSendAllowed=true") &&
      evidence.firstRealTesterFinalGoNoGo.includes("actualSendPerformed=false") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence.firstRealTesterFinalGoNoGo) &&
      evidence?.firstRealTesterReturnWorkbench?.includes("ready_to_process_exactly_one_first_return") === true &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence?.firstRealTesterReturnWorkbench ?? "") &&
      evidence.firstRealTesterReturnWorkbench.includes("sendReceiptHandoff=required") &&
      evidence.firstRealTesterReturnWorkbench.includes("fingerprint=sha256-bound") &&
      evidence.firstRealTesterReturnWorkbench.includes("first-real-tester-send-receipt-validation.json") &&
      evidence?.firstRealTesterReturnGate?.includes("waiting_for_first_return") === true &&
      evidence?.firstRealTesterReturnGate.includes("canInvite=false") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(evidence?.firstRealTesterReturnGate ?? "") &&
      evidence?.takeoverMatrix === "ready_for_takeover" &&
      evidence?.statusSummary === "ready_for_bounded_beta_not_release" &&
      evidence?.releaseReadiness === "blocked_not_release_ready",
    `ci=${evidence?.localProductizationCi ?? "missing"}; beta=${evidence?.publicBeta ?? "missing"}; sessionPlan=${evidence?.publicBetaSessionPlan ?? "missing"}; sessionReceipt=${evidence?.publicBetaSessionReceipt ?? "missing"}; bootstrap=${evidence?.newRepositoryBootstrap ?? "missing"}; trial=${evidence?.productTrial ?? "missing"}; freshness=${evidence?.productizationFreshness ?? "missing"}; betaReturn=${evidence?.publicBetaReturnIntake ?? "missing"}; humanReturn=${evidence?.humanAcceptanceReturnIntake ?? "missing"}; realModelReturn=${evidence?.realModelTrialReturnIntake ?? "missing"}; releaseApprovalReturn=${evidence?.productReleaseApprovalReturnIntake ?? "missing"}; humanInvite=${evidence?.humanAcceptanceReviewerInvite ?? "missing"}; launch=${evidence?.productizationLaunchChecklist ?? "missing"}; firstReal=${evidence?.firstRealTesterLaunch ?? "missing"}; dispatch=${evidence?.firstRealTesterDispatchPacket ?? "missing"}; sendBundle=${evidence?.firstRealTesterSendBundle ?? "missing"}; contact=${evidence?.firstRealTesterContactReadiness ?? "missing"}; sendExecution=${evidence?.firstRealTesterSendExecutionBrief ?? "missing"}; sendReceipt=${evidence?.firstRealTesterSendReceiptTemplate ?? "missing"}; finalGoNoGo=${evidence?.firstRealTesterFinalGoNoGo ?? "missing"}; workbench=${evidence?.firstRealTesterReturnWorkbench ?? "missing"}; returnGate=${evidence?.firstRealTesterReturnGate ?? "missing"}`
  );

  push(
    checks,
    "Delivery index surfaces current return-intake verifier status",
    expectedPublicBetaReturnIntake !== "missing" &&
      evidence?.publicBetaReturnIntake === expectedPublicBetaReturnIntake &&
      expectedHumanAcceptanceReturnIntake !== "missing" &&
      evidence?.humanAcceptanceReturnIntake === expectedHumanAcceptanceReturnIntake &&
      evidence?.realModelTrialReturnIntake === "passed 4/4" &&
      evidence?.productReleaseApprovalReturnIntake === "passed 6/6" &&
      markdown.includes("Public beta return intake") &&
      markdown.includes("Productization launch checklist") &&
      markdown.includes("First real tester launch") &&
      markdown.includes("Human acceptance return intake") &&
      markdown.includes("Real-model trial return intake") &&
      markdown.includes("Product release approval return intake") &&
      markdown.includes(expectedPublicBetaReturnIntake) &&
      markdown.includes(expectedHumanAcceptanceReturnIntake) &&
      markdown.includes("passed 4/4") &&
      markdown.includes("passed 6/6"),
    `betaReturn=${evidence?.publicBetaReturnIntake ?? "missing"}; humanReturn=${evidence?.humanAcceptanceReturnIntake ?? "missing"}; realModelReturn=${evidence?.realModelTrialReturnIntake ?? "missing"}; releaseApprovalReturn=${evidence?.productReleaseApprovalReturnIntake ?? "missing"}`
  );

  const firstReadSection = markdown.split("## First Read Order")[1]?.split("\n## ")[0] ?? "";

  push(
    checks,
    "Delivery index keeps takeover matrix as the first human entrypoint",
    index?.firstReadOrder?.[0] === "artifacts/productization/product-takeover-decision-matrix.md" &&
      index.firstReadOrder?.[1] === "artifacts/productization/productization-launch-checklist.md" &&
      index.firstReadOrder?.[2] === "artifacts/productization/first-real-tester-launch.md" &&
      index.firstReadOrder?.[3] === "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md" &&
      index.firstReadOrder?.[4] === "artifacts/productization/first-real-tester-send-bundle.md" &&
      index.firstReadOrder?.[5] === "artifacts/productization/first-real-tester-contact-readiness.md" &&
      index.firstReadOrder?.[6] === "artifacts/productization/first-real-tester-send-execution-brief.md" &&
      index.firstReadOrder?.[7] === "artifacts/productization/first-real-tester-send-receipt-template.md" &&
      index.firstReadOrder?.[8] === "artifacts/productization/first-real-tester-final-go-no-go.md" &&
      index.firstReadOrder?.[9] === "artifacts/productization/first-real-tester-return-workbench.md" &&
      index.firstReadOrder?.[10] === "artifacts/productization/first-real-tester-return-gate.md" &&
      index.firstReadOrder?.[11] === "artifacts/productization/product-status-summary.md" &&
      firstReadSection.indexOf("product-takeover-decision-matrix.md") >= 0 &&
      firstReadSection.indexOf("productization-launch-checklist.md") > firstReadSection.indexOf("product-takeover-decision-matrix.md") &&
      firstReadSection.indexOf("first-real-tester-launch.md") > firstReadSection.indexOf("productization-launch-checklist.md") &&
      firstReadSection.indexOf("first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") > firstReadSection.indexOf("first-real-tester-launch.md") &&
      firstReadSection.indexOf("first-real-tester-send-bundle.md") > firstReadSection.indexOf("first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      firstReadSection.indexOf("first-real-tester-contact-readiness.md") > firstReadSection.indexOf("first-real-tester-send-bundle.md") &&
      firstReadSection.indexOf("first-real-tester-send-execution-brief.md") > firstReadSection.indexOf("first-real-tester-contact-readiness.md") &&
      firstReadSection.indexOf("first-real-tester-send-receipt-template.md") > firstReadSection.indexOf("first-real-tester-send-execution-brief.md") &&
      firstReadSection.indexOf("first-real-tester-final-go-no-go.md") > firstReadSection.indexOf("first-real-tester-send-receipt-template.md") &&
      firstReadSection.indexOf("first-real-tester-return-workbench.md") > firstReadSection.indexOf("first-real-tester-final-go-no-go.md") &&
      firstReadSection.indexOf("first-real-tester-return-gate.md") > firstReadSection.indexOf("first-real-tester-return-workbench.md") &&
      firstReadSection.indexOf("product-status-summary.md") > firstReadSection.indexOf("first-real-tester-return-gate.md"),
    `firstRead=${index?.firstReadOrder?.join(" > ") ?? "missing"}`
  );

  const allowed = new Set((index?.allowedNextActions ?? []).map((action) => action.id));
  const betaInviteAction = (index?.allowedNextActions ?? []).find((action) => action.id === "invite_one_bounded_beta_tester");
  const returnedHumanAction = (index?.allowedNextActions ?? []).find(
    (action) => action.id === "process_returned_human_acceptance_receipt"
  );
  const returnedBetaAction = (index?.allowedNextActions ?? []).find(
    (action) => action.id === "process_returned_public_beta_feedback"
  );
  const returnedRealModelAction = (index?.allowedNextActions ?? []).find(
    (action) => action.id === "process_returned_real_model_trial_receipt"
  );
  const returnedReleaseApprovalAction = (index?.allowedNextActions ?? []).find(
    (action) => action.id === "process_returned_release_approval_receipt"
  );
  push(
    checks,
    "Delivery index exposes first-layer human acceptance and beta session entrypoints",
    index?.primaryEntrypoints?.humanAcceptanceReviewerInvite === "artifacts/productization/human-acceptance-reviewer-invite.md" &&
      index.primaryEntrypoints.firstRealTesterLaunch === "artifacts/productization/first-real-tester-launch.md" &&
      index.primaryEntrypoints.firstRealTesterDispatchPacket === "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md" &&
      index.primaryEntrypoints.firstRealTesterSendBundle === "artifacts/productization/first-real-tester-send-bundle.md" &&
      index.primaryEntrypoints.firstRealTesterSendExternalFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      index.primaryEntrypoints.firstRealTesterContactReadiness === "artifacts/productization/first-real-tester-contact-readiness.md" &&
      index.primaryEntrypoints.firstRealTesterSendExecutionBrief === "artifacts/productization/first-real-tester-send-execution-brief.md" &&
      index.primaryEntrypoints.firstRealTesterSendReceiptTemplate === "artifacts/productization/first-real-tester-send-receipt-template.md" &&
      index.primaryEntrypoints.firstRealTesterFinalGoNoGo === "artifacts/productization/first-real-tester-final-go-no-go.md" &&
      index.primaryEntrypoints.firstRealTesterReturnWorkbench === "artifacts/productization/first-real-tester-return-workbench.md" &&
      index.primaryEntrypoints.firstRealTesterReturnGate === "artifacts/productization/first-real-tester-return-gate.md" &&
      index.primaryEntrypoints.publicBetaSessionPlan === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
      index.primaryEntrypoints.publicBetaSessionReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
      fileExistsWithSize("artifacts/productization/human-acceptance-reviewer-invite.md", 1000) &&
      fileExistsWithSize("artifacts/productization/productization-launch-checklist.md", 1000) &&
      fileExistsWithSize("artifacts/productization/first-real-tester-launch.md", 1000) &&
      fileExistsWithSize("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md", 1000) &&
      fileExistsWithSize("artifacts/productization/first-real-tester-send-bundle.md", 1000) &&
      fileExistsWithSize("artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON/PUBLIC_BETA_SESSION_PLAN.md", 1000) &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-send-bundle.md")).includes("sha256") &&
      fileExistsWithSize("artifacts/productization/first-real-tester-contact-readiness.md", 1000) &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-contact-readiness.md")).includes("Contact allowed: `true`") &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-contact-readiness.md")).includes("first-real-tester-send-receipt-validation.json") &&
      fileExistsWithSize("artifacts/productization/first-real-tester-send-execution-brief.md", 1000) &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-send-execution-brief.md")).includes("Manual send allowed: `true`") &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-send-execution-brief.md")).includes("Actual send performed: `false`") &&
      fileExistsWithSize("artifacts/productization/first-real-tester-send-receipt-template.md", 1000) &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-send-receipt-template.md")).includes("expected sha256") &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-send-receipt-template.md")).includes("failedChecks") &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-send-receipt-template.md")).includes("remediationActions") &&
      fileExistsWithSize("artifacts/productization/first-real-tester-final-go-no-go.md", 1000) &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-final-go-no-go.md")).includes("Manual send allowed: `true`") &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-final-go-no-go.md")).includes("first-real-tester-send-receipt-validation.json") &&
      fileExistsWithSize("artifacts/productization/first-real-tester-return-workbench.md", 1000) &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-return-workbench.md")).includes("Send Receipt Handoff") &&
      readText(path.join(rootDir, "artifacts", "productization", "first-real-tester-return-workbench.md")).includes("first-real-tester-send-receipt-validation.json") &&
      fileExistsWithSize("artifacts/productization/first-real-tester-return-gate.md", 1000) &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md", 1000) &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json", 1000) &&
      markdown.includes("Human acceptance reviewer invite") &&
      markdown.includes("human-acceptance-reviewer-invite.md") &&
      markdown.includes("Productization launch checklist") &&
      markdown.includes("productization-launch-checklist.md") &&
      markdown.includes("First real tester launch") &&
      markdown.includes("first-real-tester-launch.md") &&
      markdown.includes("first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      markdown.includes("first-real-tester-send-bundle.md") &&
      markdown.includes("first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON") &&
      markdown.includes("fingerprint=sha256-bound") &&
      markdown.includes("first-real-tester-contact-readiness.md") &&
      markdown.includes("contactAllowed=true") &&
      markdown.includes("first-real-tester-send-execution-brief.md") &&
      markdown.includes("manualSendAllowed=true") &&
      markdown.includes("actualSendPerformed=false") &&
      markdown.includes("first-real-tester-send-receipt-template.md") &&
      markdown.includes("remediationActions") &&
      markdown.includes("first-real-tester-final-go-no-go.md") &&
      markdown.includes("ready_for_one_manual_send") &&
      markdown.includes("first-real-tester-return-workbench.md") &&
      markdown.includes("sendReceiptHandoff=required") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("first-real-tester-return-gate.md") &&
      markdown.includes("Public beta session plan") &&
      markdown.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      markdown.includes("Public beta session receipt template") &&
      markdown.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json"),
    `humanInvite=${index?.primaryEntrypoints?.humanAcceptanceReviewerInvite ?? "missing"}; launch=${index?.primaryEntrypoints?.productizationLaunchChecklist ?? "missing"}; firstReal=${index?.primaryEntrypoints?.firstRealTesterLaunch ?? "missing"}; dispatch=${index?.primaryEntrypoints?.firstRealTesterDispatchPacket ?? "missing"}; sendBundle=${index?.primaryEntrypoints?.firstRealTesterSendBundle ?? "missing"}; sendFolder=${index?.primaryEntrypoints?.firstRealTesterSendExternalFolder ?? "missing"}; contact=${index?.primaryEntrypoints?.firstRealTesterContactReadiness ?? "missing"}; sendExecution=${index?.primaryEntrypoints?.firstRealTesterSendExecutionBrief ?? "missing"}; sendReceipt=${index?.primaryEntrypoints?.firstRealTesterSendReceiptTemplate ?? "missing"}; finalGoNoGo=${index?.primaryEntrypoints?.firstRealTesterFinalGoNoGo ?? "missing"}; workbench=${index?.primaryEntrypoints?.firstRealTesterReturnWorkbench ?? "missing"}; returnGate=${index?.primaryEntrypoints?.firstRealTesterReturnGate ?? "missing"}; sessionPlan=${index?.primaryEntrypoints?.publicBetaSessionPlan ?? "missing"}; sessionReceipt=${index?.primaryEntrypoints?.publicBetaSessionReceiptTemplate ?? "missing"}`
  );

  const planRealModelAction = (index?.allowedNextActions ?? []).find(
    (action) => action.id === "plan_real_model_trial_without_activation"
  );

  push(
    checks,
    "Delivery index exposes real-model redaction handoff",
    evidence?.realModelTrialCredentialRedaction?.includes("kit=ready_for_real_model_trial_planning") === true &&
      evidence?.realModelTrialCredentialRedaction.includes(
        "redaction=redacted_environment_summary,artifact_secret_scan_before_return,trial_log_minimization,rollback_to_mock_after_trial"
      ) &&
      evidence?.realModelTrialCredentialRedaction.includes("evidence=completed_credential_redaction_checklist") &&
      index?.primaryEntrypoints?.realModelTrialKit === "artifacts/productization/real-model-trial-kit.md" &&
      fileExistsWithSize("artifacts/productization/real-model-trial-kit.md", 1000) &&
      planRealModelAction?.redactionChecklistPath ===
        "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist" &&
      planRealModelAction.stopCondition?.includes("credential redaction checklist") === true &&
      planRealModelAction.stopCondition.includes("rollback_to_mock_after_trial") &&
      markdown.includes("Real-model credential redaction") &&
      markdown.includes("Real-model trial kit") &&
      markdown.includes("redaction-checklist: `artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist`"),
    `redaction=${evidence?.realModelTrialCredentialRedaction ?? "missing"}; kit=${index?.primaryEntrypoints?.realModelTrialKit ?? "missing"}; action=${planRealModelAction?.redactionChecklistPath ?? "missing"}`
  );

  push(
    checks,
    "Delivery index exposes the allowed next productization actions",
    allowed.has("invite_one_bounded_beta_tester") &&
      allowed.has("run_real_human_acceptance_review") &&
      allowed.has("process_returned_human_acceptance_receipt") &&
      allowed.has("process_returned_public_beta_feedback") &&
      allowed.has("plan_real_model_trial_without_activation") &&
      allowed.has("process_returned_real_model_trial_receipt") &&
      allowed.has("process_returned_release_approval_receipt") &&
      betaInviteAction?.testerRunbookPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
      betaInviteAction.sessionPlanPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
      betaInviteAction.sessionReceiptTemplatePath ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
      returnedBetaAction?.command ===
        "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      returnedBetaAction.evidencePath === "artifacts/productization/public-beta-follow-up-plan.json" &&
      returnedBetaAction.stopCondition?.includes("more testers") === true &&
      returnedBetaAction.stopCondition.includes("tester.name/tester.date") &&
      returnedBetaAction.stopCondition.includes("sessionEvidence.feedbackReceiptPath") &&
      returnedBetaAction.stopCondition.includes("first-real-tester-send-receipt-validation.json") &&
      returnedHumanAction?.command === "npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      returnedHumanAction.postIntakeCommand === "npm run verify:human-acceptance-return-intake" &&
      returnedHumanAction.postIntakeRefresh?.includes("postIntakeRefresh.commandSequence") === true &&
      returnedHumanAction.stopCondition?.includes("first-real-tester-send-receipt-validation.json") === true &&
      returnedRealModelAction?.command ===
        "npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json" &&
      returnedRealModelAction.postIntakeCommand === "npm run verify:real-model-trial-return-intake" &&
      returnedReleaseApprovalAction?.command ===
        "npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json" &&
      returnedReleaseApprovalAction.postIntakeCommand === "npm run verify:product-release-approval-return-intake" &&
      returnedReleaseApprovalAction.runtimeRollbackEvidencePath === 'prerequisiteEvidence.aiServiceStatusPath' &&
      returnedReleaseApprovalAction.stopCondition?.includes('prerequisiteEvidence.aiServiceStatusPath') === true &&
      returnedReleaseApprovalAction.stopCondition.includes('activeProvider=mock') &&
      returnedReleaseApprovalAction.stopCondition.includes('manualProviderAcceptance=false') &&
      markdown.includes("process_returned_public_beta_feedback") &&
      markdown.includes("--session-receipt path/to/filled-public-beta-session-receipt.json") &&
      markdown.includes("--send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      markdown.includes("sessionEvidence.feedbackReceiptPath") &&
      markdown.includes("process_returned_human_acceptance_receipt") &&
      markdown.includes("process_returned_real_model_trial_receipt") &&
      markdown.includes("process_returned_release_approval_receipt") &&
      markdown.includes("postIntakeRefresh.commandSequence") &&
      markdown.includes("session-plan: `artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md`") &&
      markdown.includes("refresh: missing") === false &&
      markdown.includes("post-intake: `npm run verify:real-model-trial-return-intake`") &&
      markdown.includes("post-intake: `npm run verify:product-release-approval-return-intake`") &&
      markdown.includes('runtime-rollback-evidence: `prerequisiteEvidence.aiServiceStatusPath`') &&
      markdown.includes('activeProvider=mock') &&
      markdown.includes('manualProviderAcceptance=false'),
    `allowed=${Array.from(allowed).join(",") || "none"}`
  );

  const blocked = new Set((index?.blockedActions ?? []).filter((action) => action.blocked === true).map((action) => action.id));
  push(
    checks,
    "Delivery index exposes blocked release-only transitions",
    blocked.has("release_product") &&
      blocked.has("unlock_packaging") &&
      blocked.has("activate_real_model") &&
      blocked.has("resume_all_software_scope"),
    `blocked=${Array.from(blocked).join(",") || "none"}`
  );

  const blockerNames = (index?.releaseBlockers ?? []).map((blocker) => blocker.name ?? "");
  push(
    checks,
    "Delivery index carries the known release blockers",
    blockerNames.some((name) => name.includes("Real human acceptance")) &&
      blockerNames.some((name) => name.includes("Real model")) &&
      blockerNames.some((name) => name.includes("Packaging")),
    `blockers=${blockerNames.join(",") || "none"}`
  );

  push(
    checks,
    "Delivery index Markdown is readable and explicit",
    markdown.includes("# Product Delivery Index") &&
      markdown.includes("Final Archive") &&
      markdown.includes("SHA-256") &&
      markdown.includes("Manifest/verification/archive consistent") &&
      markdown.includes(index?.finalArchive?.sha256 ?? "missing-sha") &&
      markdown.includes(`Source Control Boundary`) &&
      markdown.includes(`Archive is source of truth`) &&
      markdown.includes(`not_required_for_handoff`) &&
      markdown.includes(`new GitHub repository root`) &&
      markdown.includes(`New Repository Bootstrap`) &&
      markdown.includes(`npm@11.12.1`) &&
      markdown.includes(`>=22 <25`) &&
      markdown.includes(`npm run ci:productization`) &&
      markdown.includes(`product_health_json_v1`) &&
      markdown.includes("do_not_release") &&
      markdown.includes("Allowed Next Actions") &&
      markdown.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      markdown.includes("sessionEvidence.feedbackReceiptPath") &&
      markdown.includes("Public beta return intake") &&
      markdown.includes("Productization launch checklist") &&
      markdown.includes("Human acceptance return intake") &&
      markdown.includes("Real-model trial return intake") &&
      markdown.includes("Product release approval return intake") &&
      markdown.includes("sendReceiptHandoff=required") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("Blocked Actions") &&
      markdown.includes("Release Blockers") &&
      markdown.length > 1000,
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_delivery_index_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-delivery-index",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use product-delivery-index.md as the outer handoff pointer to the verified archive and first-read takeover flow."
        : "Rebuild the source package, rebuild the delivery index, then rerun npm run verify:product-delivery-index."
  };

  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProduct delivery index verification written to ${receiptPath}`);

  if (receipt.status !== "passed") process.exitCode = 1;
}

main();
