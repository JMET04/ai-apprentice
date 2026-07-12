#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const rootArgIndex = args.indexOf("--root");
const targetRoot = path.resolve(rootArgIndex >= 0 && args[rootArgIndex + 1] ? args[rootArgIndex + 1] : process.cwd());
const jsonOnly = args.includes("--json-only");
const writeReceipt = args.includes("--write");

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(targetRoot, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(targetRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function exists(relativePath, minimumBytes = 1) {
  const fullPath = path.join(targetRoot, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function listFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(directory, fullPath).replaceAll("\\", "/");
      files.push(relative);
      if (entry.isDirectory()) walk(fullPath);
    }
  }

  walk(directory);
  return files;
}

function forbiddenPayload(files) {
  const forbiddenSegments = new Set([".git", ".next", "node_modules", "coverage", "dist"]);
  const forbiddenExact = new Set([
    ".env",
    "dev.db",
    "dev.db-journal",
    "prisma/dev.db",
    "prisma/dev.db-journal",
    "tsconfig.tsbuildinfo",
    "tsconfig.typecheck.tsbuildinfo"
  ]);
  const forbiddenNamePatterns = [/^\.next-dev-.*\.log$/, /^\.product-.*\.log$/, /^\.qa-.*\.png$/];

  return files.filter((file) => {
    const parts = file.split("/");
    const basename = parts.at(-1) ?? file;
    return (
      forbiddenExact.has(file) ||
      forbiddenExact.has(basename) ||
      parts.some((part) => forbiddenSegments.has(part)) ||
      forbiddenNamePatterns.some((pattern) => pattern.test(basename))
    );
  });
}

function push(checks, name, pass, evidence) {
  checks.push({ name, pass, evidence });
}

const checks = [];
const packageJson = readJson("package.json");
const uploadReadme = readText("GITHUB_UPLOAD_README.md");
const bootstrapStepIndex = uploadReadme.indexOf("npm run verify:new-repo-bootstrap");
const installStepIndex = uploadReadme.indexOf("npm install");
const readme = readText("README.md");
const workflow = readText(".github/workflows/productization-ci.yml");
const takeover = readJson("artifacts/productization/product-takeover-decision-matrix.json");
const statusSummary = readJson("artifacts/productization/product-status-summary.json");
const launchChecklist = readJson("artifacts/productization/productization-launch-checklist.json");
const firstRealTesterLaunch = readJson("artifacts/productization/first-real-tester-launch.json");
const firstRealTesterDispatchPacket = readJson("artifacts/productization/first-real-tester-dispatch-packet.json");
const firstRealTesterSendBundle = readJson("artifacts/productization/first-real-tester-send-bundle.json");
const firstRealTesterContactReadiness = readJson("artifacts/productization/first-real-tester-contact-readiness.json");
const firstRealTesterSendExecutionBrief = readJson("artifacts/productization/first-real-tester-send-execution-brief.json");
const firstRealTesterSendReceiptTemplate = readJson("artifacts/productization/first-real-tester-send-receipt.template.json");
const firstRealTesterFinalGoNoGo = readJson("artifacts/productization/first-real-tester-final-go-no-go.json");
const firstRealTesterReturnWorkbench = readJson("artifacts/productization/first-real-tester-return-workbench.json");
const firstRealTesterReturnGate = readJson("artifacts/productization/first-real-tester-return-gate.json");
const takeoverEntry = readJson("artifacts/productization/product-takeover-entry-consistency.json");
const publicBetaManifest = readJson("artifacts/productization/public-beta-packet/public-beta-manifest.json");
const publicBetaReadiness = readJson("artifacts/productization/public-beta-readiness.json");
const productTrialVerification = readJson("artifacts/productization/product-trial-packet-verification.json");
const files = listFiles(targetRoot);
const violations = forbiddenPayload(files);

const requiredScripts = [
  "verify:new-repo-bootstrap",
  "typecheck",
  "test",
  "verify:product",
  "start:product",
  "ci:productization",
  "ci:productization:gates",
  "verify:github-source",
  "build:product-delivery-index",
  "verify:product-delivery-index",
  "verify:product-takeover-entry",
  "build:first-real-tester-launch",
  "verify:first-real-tester-launch",
  "build:first-real-tester-dispatch-packet",
  "verify:first-real-tester-dispatch-packet",
  "build:first-real-tester-send-bundle",
  "verify:first-real-tester-send-bundle",
  "build:first-real-tester-contact-readiness",
  "verify:first-real-tester-contact-readiness",
  "build:first-real-tester-send-execution-brief",
  "verify:first-real-tester-send-execution-brief",
  "build:first-real-tester-send-receipt-template",
  "verify:first-real-tester-send-receipt-template",
  "build:first-real-tester-final-go-no-go",
  "verify:first-real-tester-final-go-no-go",
  "build:first-real-tester-return-workbench",
  "verify:first-real-tester-return-workbench",
  "build:first-real-tester-return-gate",
  "verify:first-real-tester-return-gate",
  "verify:public-beta",
  "verify:product-trial",
  "preflight:public-beta-tester",
  "preflight:human-acceptance"
];
const missingScripts = requiredScripts.filter((name) => typeof packageJson?.scripts?.[name] !== "string");

push(
  checks,
  "Package metadata supports a clean new-repository bootstrap",
  packageJson?.packageManager === "npm@11.12.1" &&
    packageJson?.engines?.node === ">=22 <25" &&
    packageJson?.engines?.npm === ">=10" &&
    missingScripts.length === 0 &&
    packageJson?.scripts?.["verify:new-repo-bootstrap"] === "node scripts/verify-new-repository-bootstrap.mjs",
  `packageManager=${packageJson?.packageManager ?? "missing"}; node=${packageJson?.engines?.node ?? "missing"}; npm=${packageJson?.engines?.npm ?? "missing"}; missingScripts=${missingScripts.join(",") || "none"}`
);

push(
  checks,
  "Preinstall files exist and local-only files stay out of the checkout",
  exists("package-lock.json", 1000) &&
    exists(".env.example", 100) &&
    !exists(".env") &&
    violations.length === 0,
  `lockfile=${exists("package-lock.json", 1000)}; envExample=${exists(".env.example", 100)}; env=${exists(".env")}; violations=${violations.slice(0, 5).join(",") || "none"}`
);

push(
  checks,
  "GitHub upload README gives a dependency-free preinstall bootstrap check",
  exists("GITHUB_UPLOAD_README.md", 1000) &&
    bootstrapStepIndex >= 0 &&
    installStepIndex >= 0 &&
    bootstrapStepIndex < installStepIndex &&
    (uploadReadme.includes("before npm install") || uploadReadme.includes("before `npm install`")) &&
    uploadReadme.includes("node -e ") &&
    uploadReadme.includes("Copy-Item .env.example .env") &&
    uploadReadme.includes("cp .env.example .env") &&
    uploadReadme.includes("npm run ci:productization"),
  `uploadReadme=${exists("GITHUB_UPLOAD_README.md", 1000)}; bootstrap=${bootstrapStepIndex >= 0}; beforeInstall=${bootstrapStepIndex >= 0 && installStepIndex >= 0 && bootstrapStepIndex < installStepIndex}; envNode=${uploadReadme.includes("node -e ")}; ci=${uploadReadme.includes("npm run ci:productization")}`
);

push(
  checks,
  "Maintainer first-read order keeps takeover before launch checklist, first real tester launch, return gate, and status summary",
  uploadReadme.includes("artifacts/productization/product-takeover-decision-matrix.md") &&
    uploadReadme.includes("artifacts/productization/productization-launch-checklist.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-launch.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-send-bundle.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-contact-readiness.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-send-execution-brief.md") &&
    uploadReadme.includes("manualSendAllowed=true") &&
    uploadReadme.includes("actualSendPerformed=false") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-send-receipt-template.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-final-go-no-go.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-return-workbench.md") &&
    uploadReadme.includes("artifacts/productization/first-real-tester-return-gate.md") &&
    uploadReadme.includes("artifacts/productization/product-status-summary.md") &&
    uploadReadme.indexOf("artifacts/productization/product-takeover-decision-matrix.md") <
      uploadReadme.indexOf("artifacts/productization/productization-launch-checklist.md") &&
    uploadReadme.indexOf("artifacts/productization/productization-launch-checklist.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-launch.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-launch.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-send-bundle.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-send-bundle.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-contact-readiness.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-contact-readiness.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-send-execution-brief.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-send-execution-brief.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-send-receipt-template.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-send-receipt-template.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-final-go-no-go.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-final-go-no-go.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-return-workbench.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-return-workbench.md") <
      uploadReadme.indexOf("artifacts/productization/first-real-tester-return-gate.md") &&
    uploadReadme.indexOf("artifacts/productization/first-real-tester-return-gate.md") <
      uploadReadme.indexOf("artifacts/productization/product-status-summary.md") &&
    readme.includes("post-package outer delivery index"),
  `takeover=${uploadReadme.includes("artifacts/productization/product-takeover-decision-matrix.md")}; launch=${uploadReadme.includes("artifacts/productization/productization-launch-checklist.md")}; firstReal=${uploadReadme.includes("artifacts/productization/first-real-tester-launch.md")}; dispatch=${uploadReadme.includes("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md")}; sendBundle=${uploadReadme.includes("artifacts/productization/first-real-tester-send-bundle.md")}; sendReceipt=${uploadReadme.includes("artifacts/productization/first-real-tester-send-receipt-template.md")}; finalGoNoGo=${uploadReadme.includes("artifacts/productization/first-real-tester-final-go-no-go.md")}; workbench=${uploadReadme.includes("artifacts/productization/first-real-tester-return-workbench.md")}; returnGate=${uploadReadme.includes("artifacts/productization/first-real-tester-return-gate.md")}; status=${uploadReadme.includes("artifacts/productization/product-status-summary.md")}; readmePostPackage=${readme.includes("post-package outer delivery index")}`
);

push(
  checks,
  "Productization CI workflow is present and waits for runtime health",
  exists(".github/workflows/productization-ci.yml", 500) &&
    workflow.includes("node-version: \"22\"") &&
    workflow.includes("npm run build") &&
    workflow.includes("start:product") &&
    workflow.includes("http://127.0.0.1:3000/api/health") &&
    workflow.includes("product_health_json_v1") &&
    workflow.includes("npm run ci:productization:gates") &&
    !workflow.includes("AI_PROVIDER"),
  `workflow=${exists(".github/workflows/productization-ci.yml", 500)}; node22=${workflow.includes("node-version: \"22\"")}; health=${workflow.includes("product_health_json_v1")}; gates=${workflow.includes("npm run ci:productization:gates")}`
);

push(
  checks,
  "Takeover and launch evidence are packaged and locked",
  takeover?.responseMode === "product_takeover_decision_matrix_json_v1" &&
    takeover.status === "ready_for_takeover" &&
    takeover.releaseDecision === "do_not_release" &&
    takeover.allSoftwareObjective === "paused" &&
    takeover.accepted === false &&
    takeover.packagingGated === true &&
    takeover.canRelease === false &&
    takeover.blockedActions?.some((action) => action.id === "release_product" && action.blocked === true) === true &&
    launchChecklist?.responseMode === "productization_launch_checklist_json_v1" &&
    launchChecklist.status === "ready_for_controlled_launch" &&
    launchChecklist.releaseDecision === "do_not_release" &&
    firstRealTesterLaunch?.responseMode === "first_real_tester_launch_json_v1" &&
    firstRealTesterLaunch.status === "ready_to_invite_one_bounded_real_tester_or_reviewer" &&
    firstRealTesterLaunch.readyToLaunch === true &&
    firstRealTesterLaunch.releaseDecision === "do_not_release" &&
    firstRealTesterLaunch.accepted === false &&
    firstRealTesterLaunch.packagingGated === true &&
    firstRealTesterLaunch.canRelease === false &&
    firstRealTesterLaunch.canActivateRealModel === false &&
    firstRealTesterDispatchPacket?.responseMode === "first_real_tester_dispatch_packet_json_v1" &&
    firstRealTesterDispatchPacket.status === "ready_to_send_one_lane" &&
    firstRealTesterDispatchPacket.releaseDecision === "do_not_release" &&
    firstRealTesterDispatchPacket.accepted === false &&
    firstRealTesterDispatchPacket.packagingGated === true &&
    firstRealTesterDispatchPacket.canRelease === false &&
    firstRealTesterDispatchPacket.canActivateRealModel === false &&
    firstRealTesterSendBundle?.responseMode === "first_real_tester_send_bundle_json_v1" &&
    firstRealTesterSendBundle.status === "ready_to_send_chosen_lane" &&
    firstRealTesterSendBundle.releaseDecision === "do_not_release" &&
    firstRealTesterSendBundle.accepted === false &&
    firstRealTesterSendBundle.packagingGated === true &&
    firstRealTesterSendBundle.canRelease === false &&
    firstRealTesterSendBundle.canActivateRealModel === false &&
    firstRealTesterSendBundle.actualSendPerformed === false &&
    firstRealTesterSendBundle.selectedLane?.id === "public_beta_tester_session" &&
    firstRealTesterContactReadiness?.responseMode === "first_real_tester_contact_readiness_json_v1" &&
    firstRealTesterContactReadiness.status === "ready_to_contact_first_external_person" &&
    firstRealTesterContactReadiness.contactAllowed === true &&
    firstRealTesterContactReadiness.contactDecision === "may_contact_exactly_one_person" &&
    firstRealTesterContactReadiness.selectedLane?.id === "public_beta_tester_session" &&
    firstRealTesterContactReadiness.releaseDecision === "do_not_release" &&
    firstRealTesterContactReadiness.accepted === false &&
    firstRealTesterContactReadiness.packagingGated === true &&
    firstRealTesterContactReadiness.canRelease === false &&
    firstRealTesterContactReadiness.canActivateRealModel === false &&
    firstRealTesterSendExecutionBrief?.responseMode === "first_real_tester_send_execution_brief_json_v1" &&
    firstRealTesterSendExecutionBrief.status === "ready_for_manual_send_execution" &&
    firstRealTesterSendExecutionBrief.manualSendAllowed === true &&
    firstRealTesterSendExecutionBrief.actualSendPerformed === false &&
    firstRealTesterSendExecutionBrief.releaseDecision === "do_not_release" &&
    firstRealTesterSendExecutionBrief.accepted === false &&
    firstRealTesterSendExecutionBrief.packagingGated === true &&
    firstRealTesterSendExecutionBrief.canRelease === false &&
    firstRealTesterSendExecutionBrief.canActivateRealModel === false &&
    firstRealTesterSendReceiptTemplate?.responseMode === "first_real_tester_send_receipt_template_json_v1" &&
    firstRealTesterSendReceiptTemplate.status === "template_ready" &&
    firstRealTesterSendReceiptTemplate.defaultDecision === "not_sent_yet" &&
    firstRealTesterSendReceiptTemplate.releaseDecision === "do_not_release" &&
    firstRealTesterSendReceiptTemplate.accepted === false &&
    firstRealTesterSendReceiptTemplate.packagingGated === true &&
    firstRealTesterSendReceiptTemplate.canRelease === false &&
    firstRealTesterSendReceiptTemplate.canActivateRealModel === false &&
    firstRealTesterSendReceiptTemplate.sourceBundle?.actualSendPerformed === false &&
    firstRealTesterFinalGoNoGo?.responseMode === "first_real_tester_final_go_no_go_json_v1" &&
    firstRealTesterFinalGoNoGo.status === "ready_for_one_manual_send" &&
    firstRealTesterFinalGoNoGo.releaseDecision === "do_not_release" &&
    firstRealTesterFinalGoNoGo.accepted === false &&
    firstRealTesterFinalGoNoGo.packagingGated === true &&
    firstRealTesterFinalGoNoGo.canRelease === false &&
    firstRealTesterFinalGoNoGo.canActivateRealModel === false &&
    firstRealTesterFinalGoNoGo.manualSendAllowed === true &&
    firstRealTesterFinalGoNoGo.actualSendPerformed === false &&
    firstRealTesterFinalGoNoGo.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
    firstRealTesterReturnWorkbench?.responseMode === "first_real_tester_return_workbench_json_v1" &&
    firstRealTesterReturnWorkbench.status === "ready_to_process_exactly_one_first_return" &&
    firstRealTesterReturnWorkbench.releaseDecision === "do_not_release" &&
    firstRealTesterReturnWorkbench.accepted === false &&
    firstRealTesterReturnWorkbench.packagingGated === true &&
    firstRealTesterReturnWorkbench.canRelease === false &&
    firstRealTesterReturnWorkbench.canActivateRealModel === false &&
    firstRealTesterReturnGate?.responseMode === "first_real_tester_return_gate_json_v1" &&
    firstRealTesterReturnGate.status === "waiting_for_first_return" &&
    firstRealTesterReturnGate.returnState?.canInviteAdditionalTesterOrReviewer === false &&
    firstRealTesterReturnGate.releaseDecision === "do_not_release" &&
    firstRealTesterReturnGate.accepted === false &&
    firstRealTesterReturnGate.packagingGated === true &&
    firstRealTesterReturnGate.canRelease === false &&
    firstRealTesterReturnGate.canActivateRealModel === false,
  `takeover=${takeover?.status ?? "missing"}; launch=${launchChecklist?.status ?? "missing"}; firstReal=${firstRealTesterLaunch?.status ?? "missing"}; dispatch=${firstRealTesterDispatchPacket?.status ?? "missing"}; sendBundle=${firstRealTesterSendBundle?.status ?? "missing"}; sendLane=${firstRealTesterSendBundle?.selectedLane?.id ?? "missing"}; sendExecution=${firstRealTesterSendExecutionBrief?.status ?? "missing"}; sendReceipt=${firstRealTesterSendReceiptTemplate?.status ?? "missing"}; sendDecision=${firstRealTesterSendReceiptTemplate?.defaultDecision ?? "missing"}; finalGoNoGo=${firstRealTesterFinalGoNoGo?.status ?? "missing"}; finalSend=${firstRealTesterFinalGoNoGo?.actualSendPerformed ?? "missing"}; workbench=${firstRealTesterReturnWorkbench?.status ?? "missing"}; returnGate=${firstRealTesterReturnGate?.status ?? "missing"}; release=${takeover?.releaseDecision ?? "missing"}; blockedRelease=${takeover?.blockedActions?.some((action) => action.id === "release_product" && action.blocked === true) ?? false}`
);

push(
  checks,
  "Status summary keeps beta ready but release and real model locked",
  statusSummary?.responseMode === "product_status_summary_json_v1" &&
    statusSummary.status === "ready_for_bounded_beta_not_release" &&
    statusSummary.betaCanStart === true &&
    statusSummary.releaseDecision === "do_not_release" &&
    statusSummary.allSoftwareObjective === "paused" &&
    statusSummary.accepted === false &&
    statusSummary.packagingGated === true &&
    statusSummary.canRelease === false &&
    statusSummary.canActivateRealModel === false,
  `status=${statusSummary?.status ?? "missing"}; beta=${statusSummary?.betaCanStart ?? "missing"}; release=${statusSummary?.releaseDecision ?? "missing"}; canRelease=${statusSummary?.canRelease ?? "missing"}; model=${statusSummary?.canActivateRealModel ?? "missing"}`
);

push(
  checks,
  "Public beta and product trial packets are current enough for bounded testing",
  publicBetaManifest?.responseMode === "public_beta_packet_manifest_json_v1" &&
    publicBetaManifest.status === "ready_for_public_beta" &&
    publicBetaManifest.betaCanStart === true &&
    publicBetaManifest.requiredPassed === publicBetaManifest.requiredTotal &&
    publicBetaManifest.releaseDecision === "do_not_release" &&
    publicBetaReadiness?.responseMode === "public_beta_readiness_receipt_json_v1" &&
    publicBetaReadiness.status === "passed" &&
    publicBetaReadiness.passed === publicBetaReadiness.total &&
    productTrialVerification?.responseMode === "product_trial_packet_verification_json_v1" &&
    productTrialVerification.status === "passed" &&
    productTrialVerification.passed === productTrialVerification.total,
  `beta=${publicBetaManifest?.status ?? "missing"}; betaChecks=${publicBetaReadiness?.passed ?? "?"}/${publicBetaReadiness?.total ?? "?"}; trial=${productTrialVerification?.passed ?? "?"}/${productTrialVerification?.total ?? "?"}`
);

push(
  checks,
  "Takeover-entry staged documentation scan is packaged with no stale skips",
  takeoverEntry?.responseMode === "product_takeover_entry_consistency_verification_json_v1" &&
    takeoverEntry.status === "passed" &&
    takeoverEntry.passed === takeoverEntry.total &&
    Number(takeoverEntry.checkedTargets?.length ?? 0) >= 13 &&
    Array.isArray(takeoverEntry.skippedStaleOptionalTargets) &&
    takeoverEntry.skippedStaleOptionalTargets.length === 0 &&
    takeoverEntry.releaseDecision === "do_not_release" &&
    takeoverEntry.allSoftwareObjective === "paused" &&
    takeoverEntry.accepted === false &&
    takeoverEntry.packagingGated === true,
  `status=${takeoverEntry?.status ?? "missing"}; checks=${takeoverEntry?.passed ?? "?"}/${takeoverEntry?.total ?? "?"}; targets=${takeoverEntry?.checkedTargets?.length ?? 0}; skipped=${takeoverEntry?.skippedStaleOptionalTargets?.length ?? "missing"}`
);

const passed = checks.filter((check) => check.pass).length;
const receipt = {
  responseMode: "new_repository_bootstrap_verification_json_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run verify:new-repo-bootstrap",
  rootPath: targetRoot,
  releaseDecision: "do_not_release",
  allSoftwareObjective: "paused",
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
      ? "Run npm install, create .env from .env.example, then continue the GITHUB_UPLOAD_README checklist while release stays locked."
      : "Fix the failed bootstrap checks before installing dependencies or inviting a tester from this checkout."
};

if (writeReceipt) {
  const receiptPath = path.join(targetRoot, "artifacts", "productization", "new-repository-bootstrap-verification.json");
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(receipt, null, 2));
if (!jsonOnly && writeReceipt) {
  console.log(`\nNew repository bootstrap verification written under ${targetRoot}`);
}
if (receipt.status !== "passed") process.exitCode = 1;
