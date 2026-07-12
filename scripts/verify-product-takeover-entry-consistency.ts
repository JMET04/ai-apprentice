import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type TextTarget = {
  label: string;
  relativePath: string;
  required: boolean;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "product-takeover-entry-consistency.json");

const stalePatterns = [
  /product status entrypoint/i,
  /status entrypoint/i,
  /one-page product status entrypoint/i,
  /one-page status entrypoint/i,
  /product-status-summary\.md\s+first/i,
  /PRODUCT_STATUS_SUMMARY\.md\s+first/i,
  /Open\s+[^\n]*product-status-summary\.md[^\n]*first/i,
  /Use\s+[^\n]*product-status-summary\.md[^\n]*first/i,
  /Before a teammate takes over, run [`"]?npm run build:product-status-summary/i
];

const positiveTargets: TextTarget[] = [
  { label: "README", relativePath: "README.md", required: true },
  { label: "Productization focus", relativePath: "PRODUCTIZATION_FOCUS.md", required: true },
  { label: "Product handoff", relativePath: "PRODUCT_HANDOFF.md", required: true },
  { label: "GitHub source package builder", relativePath: "scripts/build-github-source-package.ts", required: true },
  {
    label: "Trial packet focus doc",
    relativePath: "artifacts/productization/product-trial-packet/docs/PRODUCTIZATION_FOCUS.md",
    required: false
  },
  {
    label: "Trial packet handoff doc",
    relativePath: "artifacts/productization/product-trial-packet/docs/PRODUCT_HANDOFF.md",
    required: false
  },
  {
    label: "Trial packet README",
    relativePath: "artifacts/productization/product-trial-packet/docs/README.md",
    required: false
  },
  {
    label: "Public beta focus doc",
    relativePath: "artifacts/productization/public-beta-packet/docs/PRODUCTIZATION_FOCUS.md",
    required: false
  },
  {
    label: "Public beta handoff doc",
    relativePath: "artifacts/productization/public-beta-packet/docs/PRODUCT_HANDOFF.md",
    required: false
  },
  {
    label: "Public beta README",
    relativePath: "artifacts/productization/public-beta-packet/docs/README.md",
    required: false
  },
  {
    label: "GitHub upload README staging copy",
    relativePath: "artifacts/github-source-package/transparent-ai-apprentice-mcp/GITHUB_UPLOAD_README.md",
    required: false
  },
  {
    label: "GitHub staged focus doc",
    relativePath: "artifacts/github-source-package/transparent-ai-apprentice-mcp/PRODUCTIZATION_FOCUS.md",
    required: false
  },
  {
    label: "GitHub staged handoff doc",
    relativePath: "artifacts/github-source-package/transparent-ai-apprentice-mcp/PRODUCT_HANDOFF.md",
    required: false
  },
  {
    label: "GitHub staged README",
    relativePath: "artifacts/github-source-package/transparent-ai-apprentice-mcp/README.md",
    required: false
  }
];

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readText(relativePath: string): string {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf8");
}

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function modifiedAtMs(relativePath: string): number {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return 0;
  return fs.statSync(fullPath).mtimeMs;
}

function freshnessReferencePath(target: TextTarget): string {
  if (target.relativePath.endsWith("/README.md")) return "README.md";
  if (target.relativePath.endsWith("/PRODUCT_HANDOFF.md")) return "PRODUCT_HANDOFF.md";
  if (target.relativePath.endsWith("/PRODUCTIZATION_FOCUS.md")) return "PRODUCTIZATION_FOCUS.md";
  if (target.relativePath.endsWith("/GITHUB_UPLOAD_README.md")) return "scripts/build-github-source-package.ts";

  const requiredTargets = positiveTargets.filter((candidate) => candidate.required);
  return requiredTargets.reduce((newest, candidate) =>
    modifiedAtMs(candidate.relativePath) > modifiedAtMs(newest.relativePath) ? candidate : newest
  ).relativePath;
}

function isCurrentOptionalTarget(target: TextTarget): boolean {
  if (!fileExists(target.relativePath)) return false;
  const referencePath = freshnessReferencePath(target);
  return modifiedAtMs(target.relativePath) + 1000 >= modifiedAtMs(referencePath);
}

function currentTargets(): { targets: TextTarget[]; skippedStaleOptionalTargets: string[] } {
  const targets = positiveTargets.filter((target) => target.required || isCurrentOptionalTarget(target));
  const skippedStaleOptionalTargets = positiveTargets
    .filter((target) => !target.required && fileExists(target.relativePath) && !isCurrentOptionalTarget(target))
    .map((target) => `${target.relativePath}<${freshnessReferencePath(target)}`);

  return { targets, skippedStaleOptionalTargets };
}

function indexOfNeedle(text: string, needle: string): number {
  return text.indexOf(needle);
}

function firstExistingIndex(text: string, needles: string[]): number {
  return Math.min(...needles.map((needle) => indexOfNeedle(text, needle)).filter((value) => value >= 0));
}

function takeoverBeforeSummary(text: string): boolean {
  const takeoverIndex = firstExistingIndex(text, [
    "product-takeover-decision-matrix.md",
    "PRODUCT_TAKEOVER_DECISION_MATRIX.md"
  ]);
  const summaryIndex = firstExistingIndex(text, ["product-status-summary.md", "PRODUCT_STATUS_SUMMARY.md"]);

  return Number.isFinite(takeoverIndex) && Number.isFinite(summaryIndex) && takeoverIndex < summaryIndex;
}

function markdownSection(text: string, header: string): string {
  return text.split(header)[1]?.split("\n## ")[0] ?? "";
}

function launchChecklistBetweenTakeoverAndSummary(text: string): boolean {
  const takeoverIndex = firstExistingIndex(text, [
    "product-takeover-decision-matrix.md",
    "PRODUCT_TAKEOVER_DECISION_MATRIX.md"
  ]);
  const launchIndex = firstExistingIndex(text, [
    "productization-launch-checklist.md",
    "PRODUCTIZATION_LAUNCH_CHECKLIST.md"
  ]);
  const summaryIndex = firstExistingIndex(text, ["product-status-summary.md", "PRODUCT_STATUS_SUMMARY.md"]);

  return (
    Number.isFinite(takeoverIndex) &&
    Number.isFinite(launchIndex) &&
    Number.isFinite(summaryIndex) &&
    takeoverIndex < launchIndex &&
    launchIndex < summaryIndex
  );
}

function firstRealTesterLaunchBetweenLaunchAndSummary(text: string): boolean {
  const launchIndex = firstExistingIndex(text, [
    "productization-launch-checklist.md",
    "PRODUCTIZATION_LAUNCH_CHECKLIST.md"
  ]);
  const firstRealIndex = firstExistingIndex(text, [
    "first-real-tester-launch.md",
    "FIRST_REAL_TESTER_LAUNCH.md"
  ]);
  const summaryIndex = firstExistingIndex(text, ["product-status-summary.md", "PRODUCT_STATUS_SUMMARY.md"]);

  return (
    Number.isFinite(launchIndex) &&
    Number.isFinite(firstRealIndex) &&
    Number.isFinite(summaryIndex) &&
    launchIndex < firstRealIndex &&
    firstRealIndex < summaryIndex
  );
}

function firstRealTesterReturnWorkbenchBetweenLaunchAndGate(text: string): boolean {
  const firstRealIndex = firstExistingIndex(text, [
    "first-real-tester-launch.md",
    "artifacts/productization/first-real-tester-launch.md"
  ]);
  const workbenchIndex = firstExistingIndex(text, [
    "first-real-tester-return-workbench.md",
    "artifacts/productization/first-real-tester-return-workbench.md"
  ]);
  const returnGateIndex = firstExistingIndex(text, [
    "first-real-tester-return-gate.md",
    "artifacts/productization/first-real-tester-return-gate.md"
  ]);
  return Number.isFinite(firstRealIndex) && Number.isFinite(workbenchIndex) && Number.isFinite(returnGateIndex) && firstRealIndex < workbenchIndex && workbenchIndex < returnGateIndex;
}

function firstRealTesterDispatchBetweenLaunchAndWorkbench(text: string): boolean {
  const firstRealIndex = firstExistingIndex(text, [
    "first-real-tester-launch.md",
    "artifacts/productization/first-real-tester-launch.md"
  ]);
  const dispatchIndex = firstExistingIndex(text, [
    "first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
    "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md"
  ]);
  const workbenchIndex = firstExistingIndex(text, [
    "first-real-tester-return-workbench.md",
    "artifacts/productization/first-real-tester-return-workbench.md"
  ]);
  return Number.isFinite(firstRealIndex) && Number.isFinite(dispatchIndex) && Number.isFinite(workbenchIndex) && firstRealIndex < dispatchIndex && dispatchIndex < workbenchIndex;
}

function firstRealTesterSendBundleBetweenDispatchAndWorkbench(text: string): boolean {
  const dispatchIndex = firstExistingIndex(text, [
    "first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
    "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md"
  ]);
  const sendBundleIndex = firstExistingIndex(text, [
    "first-real-tester-send-bundle.md",
    "artifacts/productization/first-real-tester-send-bundle.md"
  ]);
  const workbenchIndex = firstExistingIndex(text, [
    "first-real-tester-return-workbench.md",
    "artifacts/productization/first-real-tester-return-workbench.md"
  ]);
  return Number.isFinite(dispatchIndex) && Number.isFinite(sendBundleIndex) && Number.isFinite(workbenchIndex) && dispatchIndex < sendBundleIndex && sendBundleIndex < workbenchIndex;
}

function firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(text: string): boolean {
  const sendBundleIndex = firstExistingIndex(text, [
    "first-real-tester-send-bundle.md",
    "artifacts/productization/first-real-tester-send-bundle.md"
  ]);
  const contactReadinessIndex = firstExistingIndex(text, [
    "first-real-tester-contact-readiness.md",
    "artifacts/productization/first-real-tester-contact-readiness.md"
  ]);
  const executionBriefIndex = firstExistingIndex(text, [
    "first-real-tester-send-execution-brief.md",
    "artifacts/productization/first-real-tester-send-execution-brief.md"
  ]);
  const receiptIndex = firstExistingIndex(text, [
    "first-real-tester-send-receipt-template.md",
    "artifacts/productization/first-real-tester-send-receipt-template.md"
  ]);
  const finalGoNoGoIndex = firstExistingIndex(text, [
    "first-real-tester-final-go-no-go.md",
    "artifacts/productization/first-real-tester-final-go-no-go.md"
  ]);
  const workbenchIndex = firstExistingIndex(text, [
    "first-real-tester-return-workbench.md",
    "artifacts/productization/first-real-tester-return-workbench.md"
  ]);
  return (
    Number.isFinite(sendBundleIndex) &&
    Number.isFinite(contactReadinessIndex) &&
    Number.isFinite(executionBriefIndex) &&
    Number.isFinite(receiptIndex) &&
    Number.isFinite(finalGoNoGoIndex) &&
    Number.isFinite(workbenchIndex) &&
    sendBundleIndex < contactReadinessIndex &&
    contactReadinessIndex < executionBriefIndex &&
    executionBriefIndex < receiptIndex &&
    receiptIndex < finalGoNoGoIndex &&
    finalGoNoGoIndex < workbenchIndex
  );
}
function firstRealTesterReturnGateBetweenLaunchAndSummary(text: string): boolean {
  const firstRealIndex = firstExistingIndex(text, [
    "first-real-tester-launch.md",
    "FIRST_REAL_TESTER_LAUNCH.md"
  ]);
  const returnGateIndex = firstExistingIndex(text, [
    "first-real-tester-return-gate.md",
    "FIRST_REAL_TESTER_RETURN_GATE.md"
  ]);
  const summaryIndex = firstExistingIndex(text, ["product-status-summary.md", "PRODUCT_STATUS_SUMMARY.md"]);

  return (
    Number.isFinite(firstRealIndex) &&
    Number.isFinite(returnGateIndex) &&
    Number.isFinite(summaryIndex) &&
    firstRealIndex < returnGateIndex &&
    returnGateIndex < summaryIndex
  );
}

function staleMatches(relativePath: string, text: string): string[] {
  return stalePatterns.filter((pattern) => pattern.test(text)).map((pattern) => `${relativePath}:${pattern.source}`);
}

function hasModernLocalCiContract(text: string): boolean {
  return (
    text.includes("npm run ci:productization") &&
    text.includes("selected host/port") &&
    text.includes("same base URL") &&
    text.includes("human-acceptance") &&
    text.includes("public-beta tester") &&
    text.includes("final GitHub source package") &&
    text.includes("product delivery index")
  );
}

function staleLocalCiContractMatches(targets: TextTarget[]): string[] {
  const patterns = [
    /npm run ci:productization[\s\S]{0,450}starts or reuses [`"]?http:\/\/127\.0\.0\.1:3000/i,
    /npm run ci:productization[\s\S]{0,450}refreshes the live human-acceptance preflight plus real-model trial-prep evidence/i,
    /npm run ci:productization[\s\S]{0,450}refreshes the live human-acceptance preflight before handoff packaging/i,
  ];

  return targets.flatMap((target) => {
    const text = readText(target.relativePath);
    return patterns.filter((pattern) => pattern.test(text)).map((pattern) => `${target.relativePath}:${pattern.source}`);
  });
}

function main() {
  const checks: VerificationCheck[] = [];
  const { targets, skippedStaleOptionalTargets } = currentTargets();
  const missingRequired = positiveTargets.filter((target) => target.required && !fileExists(target.relativePath));
  const allStaleMatches = targets.flatMap((target) => staleMatches(target.relativePath, readText(target.relativePath)));

  push(
    checks,
    "Required takeover-entry documents exist",
    missingRequired.length === 0,
    `missing=${missingRequired.map((target) => target.relativePath).join(",") || "none"}`
  );

  push(
    checks,
    "No document calls status summary the first entrypoint",
    allStaleMatches.length === 0,
    `matches=${allStaleMatches.slice(0, 12).join(" | ") || "none"}; scanned=${targets.length}`
  );

  const focusText = readText("PRODUCTIZATION_FOCUS.md");
  const handoffText = readText("PRODUCT_HANDOFF.md");
  const readmeText = readText("README.md");
  const githubBuilderText = readText("scripts/build-github-source-package.ts");

  const focusHasTakeoverFirst =
    focusText.includes("product-takeover-decision-matrix.md` first") &&
    focusText.includes("companion beta-ready/release-blocked status page");
  const handoffHasTakeoverFirst =
    handoffText.includes("product-takeover-decision-matrix.md` first") &&
    handoffText.includes("companion beta-ready/release-blocked page");
  const readmeHasTakeoverFirst =
    readmeText.includes("open `artifacts/productization/product-takeover-decision-matrix.md` before the status summary") &&
    readmeText.includes("one-page status companion");

  push(
    checks,
    "Root handoff docs explicitly put takeover matrix before status summary",
    focusHasTakeoverFirst && handoffHasTakeoverFirst && readmeHasTakeoverFirst,
    `focus=${focusHasTakeoverFirst}; handoff=${handoffHasTakeoverFirst}; readme=${readmeHasTakeoverFirst}`
  );

  const githubBuilderFirstFiles = markdownSection(githubBuilderText, "## First Files To Read");
  const githubBuilderHasTakeoverFirst =
    githubBuilderFirstFiles.includes("Open \\`artifacts/productization/product-takeover-decision-matrix.md\\` first") &&
    githubBuilderFirstFiles.includes("Open \\`artifacts/productization/productization-launch-checklist.md\\`") &&
    githubBuilderFirstFiles.includes("Open \\`artifacts/productization/first-real-tester-launch.md\\`") &&
    githubBuilderFirstFiles.includes("first-real-tester-contact-readiness.md") &&
    githubBuilderFirstFiles.includes("first-real-tester-send-execution-brief.md") &&
    githubBuilderFirstFiles.includes("Open \\`artifacts/productization/product-status-summary.md\\` for the current beta-ready") &&
    launchChecklistBetweenTakeoverAndSummary(githubBuilderFirstFiles) &&
    firstRealTesterLaunchBetweenLaunchAndSummary(githubBuilderFirstFiles) &&
    firstRealTesterDispatchBetweenLaunchAndWorkbench(githubBuilderFirstFiles) &&
    firstRealTesterSendBundleBetweenDispatchAndWorkbench(githubBuilderFirstFiles) &&
    firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(githubBuilderFirstFiles) &&
    firstRealTesterReturnWorkbenchBetweenLaunchAndGate(githubBuilderFirstFiles) &&
    firstRealTesterReturnGateBetweenLaunchAndSummary(githubBuilderFirstFiles) &&
    githubBuilderText.includes("companion product status page") &&
    githubBuilderText.includes("first-read takeover decision matrix") &&
    !githubBuilderText.includes("product status entrypoint");

  push(
    checks,
    "GitHub upload instructions explicitly put takeover matrix before launch checklist, first real tester launch, return gate, and status summary",
    githubBuilderHasTakeoverFirst,
    `takeoverLaunchSummary=${launchChecklistBetweenTakeoverAndSummary(githubBuilderFirstFiles)}; firstRealBetween=${firstRealTesterLaunchBetweenLaunchAndSummary(
      githubBuilderFirstFiles
    )}; dispatchBetween=${firstRealTesterDispatchBetweenLaunchAndWorkbench(
      githubBuilderFirstFiles
    )}; sendBundleBetween=${firstRealTesterSendBundleBetweenDispatchAndWorkbench(
      githubBuilderFirstFiles
    )}; sendReceiptBetween=${firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(
      githubBuilderFirstFiles
    )}; workbenchBetween=${firstRealTesterReturnWorkbenchBetweenLaunchAndGate(githubBuilderFirstFiles)}; returnGateBetween=${firstRealTesterReturnGateBetweenLaunchAndSummary(
      githubBuilderFirstFiles
    )}; companion=${githubBuilderText.includes(
      "companion product status page"
    )}`
  );

  const modernLocalCiDocs = [
    ["focus", focusText],
    ["handoff", handoffText],
    ["readme", readmeText],
    ["githubBuilder", githubBuilderText]
  ] as const;
  const missingModernLocalCiDocs = modernLocalCiDocs
    .filter(([, text]) => !hasModernLocalCiContract(text))
    .map(([label]) => label);
  const staleLocalCiMatches = staleLocalCiContractMatches(targets);

  push(
    checks,
    "Productization local CI docs describe selected-base-URL gates and both live preflights",
    missingModernLocalCiDocs.length === 0 && staleLocalCiMatches.length === 0,
    `missingModern=${missingModernLocalCiDocs.join(",") || "none"}; stale=${staleLocalCiMatches.slice(0, 12).join(" | ") || "none"}`
  );

  const takeoverMatrix = readJson<{
    responseMode?: string;
    status?: string;
    firstReadOrder?: string[];
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/product-takeover-decision-matrix.json");
  const takeoverMarkdown = readText("artifacts/productization/product-takeover-decision-matrix.md");

  push(
    checks,
    "Takeover matrix remains the machine-readable first-read source",
    takeoverMatrix?.responseMode === "product_takeover_decision_matrix_json_v1" &&
      takeoverMatrix.status === "ready_for_takeover" &&
      takeoverMatrix.firstReadOrder?.[0] === "artifacts/productization/product-takeover-decision-matrix.md" &&
      takeoverMatrix.firstReadOrder?.[1] === "artifacts/productization/productization-launch-checklist.md" &&
      takeoverMatrix.firstReadOrder?.[2] === "artifacts/productization/first-real-tester-launch.md" &&
      takeoverMatrix.firstReadOrder?.[3] === "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md" &&
      takeoverMatrix.firstReadOrder?.[4] === "artifacts/productization/first-real-tester-send-bundle.md" &&
      takeoverMatrix.firstReadOrder?.[5] === "artifacts/productization/first-real-tester-contact-readiness.md" &&
      takeoverMatrix.firstReadOrder?.[6] === "artifacts/productization/first-real-tester-send-execution-brief.md" &&
      takeoverMatrix.firstReadOrder?.[7] === "artifacts/productization/first-real-tester-send-receipt-template.md" &&
      takeoverMatrix.firstReadOrder?.[8] === "artifacts/productization/first-real-tester-final-go-no-go.md" &&
      takeoverMatrix.firstReadOrder?.[9] === "artifacts/productization/first-real-tester-return-workbench.md" &&
      takeoverMatrix.firstReadOrder?.[10] === "artifacts/productization/first-real-tester-return-gate.md" &&
      takeoverMatrix.firstReadOrder?.[11] === "artifacts/productization/product-status-summary.md" &&
      takeoverMatrix.releaseDecision === "do_not_release" &&
      takeoverMatrix.allSoftwareObjective === "paused" &&
      takeoverMatrix.accepted === false &&
      takeoverMatrix.packagingGated === true &&
      takeoverMatrix.canRelease === false,
    `firstRead=${takeoverMatrix?.firstReadOrder?.join(" > ") ?? "missing"}; release=${
      takeoverMatrix?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Takeover matrix Markdown is explicit about first page semantics",
    takeoverMarkdown.includes("This is the first page for a maintainer") &&
      takeoverMarkdown.includes("## First Read Order") &&
      takeoverMarkdown.includes("product-takeover-decision-matrix.md") &&
      takeoverMarkdown.includes("productization-launch-checklist.md") &&
      takeoverMarkdown.includes("first-real-tester-launch.md") &&
      takeoverMarkdown.includes("first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      takeoverMarkdown.includes("first-real-tester-send-bundle.md") &&
      takeoverMarkdown.includes("first-real-tester-contact-readiness.md") &&
      takeoverMarkdown.includes("first-real-tester-send-execution-brief.md") &&
      takeoverMarkdown.includes("first-real-tester-send-receipt-template.md") &&
      takeoverMarkdown.includes("first-real-tester-final-go-no-go.md") &&
      takeoverMarkdown.includes("first-real-tester-return-workbench.md") &&
      takeoverMarkdown.includes("first-real-tester-return-gate.md") &&
      takeoverMarkdown.includes("product-status-summary.md") &&
      launchChecklistBetweenTakeoverAndSummary(takeoverMarkdown) &&
      firstRealTesterLaunchBetweenLaunchAndSummary(takeoverMarkdown) &&
      firstRealTesterDispatchBetweenLaunchAndWorkbench(takeoverMarkdown) &&
      firstRealTesterSendBundleBetweenDispatchAndWorkbench(takeoverMarkdown) &&
      firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(takeoverMarkdown) &&
      firstRealTesterReturnWorkbenchBetweenLaunchAndGate(takeoverMarkdown) &&
      firstRealTesterReturnGateBetweenLaunchAndSummary(takeoverMarkdown),
    `takeoverLaunchSummary=${launchChecklistBetweenTakeoverAndSummary(takeoverMarkdown)}; firstRealBetween=${firstRealTesterLaunchBetweenLaunchAndSummary(
      takeoverMarkdown
    )}; dispatchBetween=${firstRealTesterDispatchBetweenLaunchAndWorkbench(
      takeoverMarkdown
    )}; sendBundleBetween=${firstRealTesterSendBundleBetweenDispatchAndWorkbench(
      takeoverMarkdown
    )}; sendReceiptBetween=${firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(
      takeoverMarkdown
    )}; workbenchBetween=${firstRealTesterReturnWorkbenchBetweenLaunchAndGate(takeoverMarkdown)}; returnGateBetween=${firstRealTesterReturnGateBetweenLaunchAndSummary(
      takeoverMarkdown
    )}; bytes=${takeoverMarkdown.length}`
  );

  const trialManifest = readJson<{ nextHumanSteps?: string[]; status?: string; releaseDecision?: string; allSoftwareObjective?: string }>(
    "artifacts/productization/product-trial-packet/product-trial-manifest.json"
  );
  const trialSteps = trialManifest?.nextHumanSteps ?? [];
  const trialTakeoverStep = trialSteps.findIndex((step) => step.includes("PRODUCT_TAKEOVER_DECISION_MATRIX.md first"));
  const trialSummaryStep = trialSteps.findIndex((step) => step.includes("PRODUCT_STATUS_SUMMARY.md"));

  push(
    checks,
    "Trial packet tells reviewers to open takeover matrix before status summary",
    trialManifest?.status === "built" &&
      trialManifest.releaseDecision === undefined &&
      trialManifest.allSoftwareObjective === "paused" &&
      trialTakeoverStep >= 0 &&
      trialSummaryStep > trialTakeoverStep,
    `status=${trialManifest?.status ?? "missing"}; takeoverStep=${trialTakeoverStep}; summaryStep=${trialSummaryStep}`
  );

  const betaManifest = readJson<{
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    betaCollectionTargets?: string[];
    entrypoints?: Record<string, string>;
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const betaTargets = betaManifest?.betaCollectionTargets ?? [];
  const betaTakeoverStep = betaTargets.findIndex((step) => step.includes("PRODUCT_TAKEOVER_DECISION_MATRIX.md first"));
  const betaLaunchStep = betaTargets.findIndex((step) => step.includes("PRODUCTIZATION_LAUNCH_CHECKLIST.md next"));
  const betaSummaryStep = betaTargets.findIndex(
    (step) => step.includes("PRODUCT_STATUS_SUMMARY.md after") || step.includes("PRODUCT_STATUS_SUMMARY.md next")
  );

  push(
    checks,
    "Public beta packet tells maintainers to open takeover matrix before status summary",
    betaManifest?.status === "ready_for_public_beta" &&
      betaManifest.releaseDecision === "do_not_release" &&
      betaManifest.allSoftwareObjective === "paused" &&
      betaManifest.entrypoints?.productTakeoverDecisionMatrix?.endsWith("PRODUCT_TAKEOVER_DECISION_MATRIX.md") === true &&
      betaManifest.entrypoints?.productizationLaunchChecklist?.endsWith("PRODUCTIZATION_LAUNCH_CHECKLIST.md") === true &&
      betaManifest.entrypoints?.productStatusSummary?.endsWith("PRODUCT_STATUS_SUMMARY.md") === true &&
      betaTakeoverStep >= 0 &&
      betaLaunchStep > betaTakeoverStep &&
      betaSummaryStep > betaLaunchStep,
    `status=${betaManifest?.status ?? "missing"}; takeoverStep=${betaTakeoverStep}; launchStep=${betaLaunchStep}; summaryStep=${betaSummaryStep}; entry=${
      betaManifest?.entrypoints?.productTakeoverDecisionMatrix ?? "missing"
    }`
  );

  const githubManifest = readJson<{
    status?: string;
    uploadChecklist?: string[];
    archivePath?: string;
    packageBoundary?: { uploadReady?: boolean; includesSecrets?: boolean; includesDependencies?: boolean; includesLocalDatabase?: boolean; includesBuildCache?: boolean };
  }>("artifacts/github-source-package/github-source-package-manifest.json");
  const uploadReadme = readText("artifacts/github-source-package/transparent-ai-apprentice-mcp/GITHUB_UPLOAD_README.md");
  const uploadReadmeFirstFiles = markdownSection(uploadReadme, "## First Files To Read");
  const checklist = githubManifest?.uploadChecklist ?? [];

  push(
    checks,
    "GitHub source package upload handoff preserves takeover-first order",
    githubManifest?.status === "built" &&
      githubManifest.packageBoundary?.uploadReady === true &&
      githubManifest.packageBoundary.includesSecrets === false &&
      githubManifest.packageBoundary.includesDependencies === false &&
      githubManifest.packageBoundary.includesLocalDatabase === false &&
      githubManifest.packageBoundary.includesBuildCache === false &&
      uploadReadme.includes("## First Files To Read") &&
      launchChecklistBetweenTakeoverAndSummary(uploadReadmeFirstFiles) &&
      firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(uploadReadmeFirstFiles) &&
      checklist.some((item) => item.includes("companion product status page")) &&
      checklist.some((item) => item.includes("first-read takeover decision matrix")),
    `status=${githubManifest?.status ?? "missing"}; uploadReady=${
      githubManifest?.packageBoundary?.uploadReady ?? "missing"
    }; takeoverLaunchSummary=${launchChecklistBetweenTakeoverAndSummary(uploadReadmeFirstFiles)}; sendReceiptBetween=${firstRealTesterSendReceiptBetweenSendBundleAndWorkbench(uploadReadmeFirstFiles)}; checklist=${checklist.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_takeover_entry_consistency_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-takeover-entry",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    checkedTargets: targets.map((target) => target.relativePath),
    skippedStaleOptionalTargets,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? skippedStaleOptionalTargets.length > 0
          ? "Root handoff docs are current. Rebuild stale generated packets or source-package staging copies, then verify takeover entry consistency again so packaged docs are scanned too."
          : "Keep product-takeover-decision-matrix.md as the first maintainer handoff page, productization-launch-checklist.md as the controlled-launch gate, first-real-tester-launch.md as the single-send first tester handoff, first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md as the lane decision packet, first-real-tester-send-bundle.md as the single-lane send bundle, first-real-tester-contact-readiness.md as the live contact gate, first-real-tester-send-execution-brief.md as the final manual-send brief, first-real-tester-send-receipt-template.md as the manual-send receipt template, first-real-tester-final-go-no-go.md as the final operator check immediately before exactly one manual send, first-real-tester-return-workbench.md as the first-return processing desk, first-real-tester-return-gate.md as the post-return widening gate, and status summary only as a companion status page."
        : "Fix stale entrypoint wording, rebuild affected packets, and verify takeover entry consistency again."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProduct takeover entry consistency verification written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
