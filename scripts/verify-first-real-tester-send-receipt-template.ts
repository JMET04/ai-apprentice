import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

type SendReceipt = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  defaultDecision?: string;
  allowedDecisions?: string[];
  blockedDecisions?: string[];
  selectedLane?: { id?: string; preflightCommand?: string; preflightEvidencePath?: string };
  sourceBundle?: { manifestPath?: string; externalSendFolder?: string; returnIntakeFolder?: string; actualSendPerformed?: boolean };
  receiptFields?: {
    decision?: string;
    maintainerNameOrRole?: string;
    firstExternalPersonRole?: string;
    contactChannel?: string;
    sendTimestampIso?: string;
    preflight?: { commandRun?: boolean; baseUrl?: string; evidencePath?: string; resultStatus?: string };
    sentMaterials?: Array<{ id?: string; bundlePath?: string; sent?: boolean; expectedBytes?: number; expectedSha256?: string }>;
    retainedByMaintainer?: Array<{ id?: string; bundlePath?: string; retained?: boolean; expectedBytes?: number; expectedSha256?: string }>;
    negativeAssertions?: Record<string, boolean>;
    followUp?: { nextExpectedStep?: string; returnWorkbenchPath?: string; returnGatePath?: string };
  };
  validationFailureHandoff?: { failedChecksField?: string; remediationActionsField?: string; nextActionField?: string; rule?: string };
  validationRules?: Record<string, boolean>;
  blockedActions?: string[];
  failedReasons?: string[];
  nextAction?: string;
};

type PreflightReceipt = {
  responseMode?: string;
  status?: string;
  canInviteTester?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  releaseDecision?: string;
  allSoftwareObjective?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const defaultReceiptPath = path.join(artifactsDir, "first-real-tester-send-receipt.template.json");
const markdownPath = path.join(artifactsDir, "first-real-tester-send-receipt-template.md");
const templateVerificationPath = path.join(artifactsDir, "first-real-tester-send-receipt-template-verification.json");
const submittedValidationPath = path.join(artifactsDir, "first-real-tester-send-receipt-validation.json");
const allowedDecisions = ["not_sent_yet", "preflight_ready", "sent_manually"];
function addRemediation(actions: string[], condition: boolean, action: string) {
  if (condition) actions.push(action);
}

function lockRemediationActions(receipt: SendReceipt | null) {
  const actions: string[] = [];
  addRemediation(actions, receipt?.allSoftwareObjective !== "paused", "Restore allSoftwareObjective=paused; all-software work stays explicitly out of scope.");
  addRemediation(actions, receipt?.releaseDecision !== "do_not_release", "Restore releaseDecision=do_not_release; a send receipt cannot approve release.");
  addRemediation(actions, receipt?.accepted !== false, "Restore accepted=false; manual send evidence is not teacher acceptance.");
  addRemediation(actions, receipt?.packagingGated !== true, "Restore packagingGated=true; this receipt cannot unlock packaging.");
  addRemediation(actions, receipt?.canRelease !== false, "Restore canRelease=false; release remains blocked until separate gates pass.");
  addRemediation(actions, receipt?.canActivateRealModel !== false, "Restore canActivateRealModel=false; this send receipt cannot activate a real model.");
  return actions;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseReceiptPath() {
  const receiptFlagIndex = process.argv.indexOf("--receipt");
  if (receiptFlagIndex >= 0) {
    const value = process.argv[receiptFlagIndex + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing value for --receipt.");
    return path.resolve(rootDir, value);
  }
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  return positional ? path.resolve(rootDir, positional) : defaultReceiptPath;
}

function parseOutputPath(isTemplate: boolean) {
  const outputFlagIndex = process.argv.indexOf("--out");
  if (outputFlagIndex >= 0) {
    const value = process.argv[outputFlagIndex + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing value for --out.");
    return path.resolve(rootDir, value);
  }
  return isTemplate ? templateVerificationPath : submittedValidationPath;
}

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

function readText(targetPath: string) {
  try {
    return fs.readFileSync(targetPath, "utf8");
  } catch {
    return "";
  }
}

function resolveEvidencePath(receiptPath: string, evidencePath?: string) {
  if (!hasText(evidencePath)) return null;
  if (path.isAbsolute(evidencePath)) return evidencePath;

  const workspaceRelative = path.resolve(rootDir, evidencePath);
  if (fs.existsSync(workspaceRelative)) return workspaceRelative;

  return path.resolve(path.dirname(receiptPath), evidencePath);
}

function fileExistsWithSize(relativePath: string, minBytes = 1) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minBytes;
}

function bundledFilePath(relativePath: string | undefined) {
  if (!hasText(relativePath)) return null;
  const normalized = relativePath.replaceAll("\\", "/");
  return normalized.startsWith("artifacts/")
    ? path.join(rootDir, normalized)
    : path.join(rootDir, "artifacts", "productization", "first-real-tester-send-bundle", normalized);
}

function bundledFileSize(relativePath: string | undefined) {
  const fullPath = bundledFilePath(relativePath);
  return fullPath && fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
}

function bundledFileSha256(relativePath: string | undefined) {
  const fullPath = bundledFilePath(relativePath);
  return fullPath && fs.existsSync(fullPath) ? crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex") : "missing";
}

function isoTimestampIsValid(value: unknown) {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function containsForbiddenClaim(value: unknown): boolean {
  if (typeof value === "string") {
    return /accepted\s*=\s*true|packagingGated\s*=\s*false|canRelease\s*=\s*true|canActivateRealModel\s*=\s*true|releaseDecision\s*=\s*(release_ready|release_candidate|released)|allSoftwareObjective\s*=\s*active/i.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsForbiddenClaim(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsForbiddenClaim(item));
  return false;
}

function allExpectedFilesMatch(items: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string }>) {
  return items.every(
    (item) =>
      Number(item.expectedBytes ?? 0) > 0 &&
      bundledFileSize(item.bundlePath) === item.expectedBytes &&
      /^[a-f0-9]{64}$/.test(item.expectedSha256 ?? "") &&
      bundledFileSha256(item.bundlePath) === item.expectedSha256
  );
}

function preflightEvidenceIsPassed(receiptPath: string, evidencePath?: string) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  const evidence = resolvedPath ? readJson<PreflightReceipt>(resolvedPath) : null;
  return {
    resolvedPath,
    evidence,
    passed:
      evidence?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      evidence.status === "passed" &&
      evidence.canInviteTester === true &&
      evidence.releaseDecision === "do_not_release" &&
      evidence.allSoftwareObjective === "paused" &&
      evidence.accepted === false &&
      evidence.packagingGated === true &&
      evidence.canRelease === false &&
      evidence.canActivateRealModel === false &&
      Number(evidence.passed ?? 0) === Number(evidence.total ?? -1) &&
      Number(evidence.total ?? 0) > 0
  };
}

function submittedReceiptRemediationActions(
  receipt: SendReceipt | null,
  decision: string | undefined,
  sentMaterials: NonNullable<NonNullable<SendReceipt["receiptFields"]>["sentMaterials"]>,
  retained: NonNullable<NonNullable<SendReceipt["receiptFields"]>["retainedByMaintainer"]>,
  negativeAssertions: Record<string, boolean>,
  preflightEvidence: ReturnType<typeof preflightEvidenceIsPassed>
) {
  if (!receipt) return ["Provide a readable JSON receipt copied from first-real-tester-send-receipt.template.json."];

  const actions = lockRemediationActions(receipt);
  const sentManually = decision === "sent_manually";
  const preflightReady = decision === "preflight_ready";
  const notSentYet = decision === "not_sent_yet";

  addRemediation(
    actions,
    !allowedDecisions.includes(decision ?? ""),
    "Set receiptFields.decision to one of not_sent_yet, preflight_ready, or sent_manually; never use accepted/release/packaging decisions."
  );

  if (sentManually) {
    addRemediation(actions, !hasText(receipt.receiptFields?.maintainerNameOrRole), "Set receiptFields.maintainerNameOrRole to the maintainer who manually sent the bundle.");
    addRemediation(actions, !hasText(receipt.receiptFields?.firstExternalPersonRole), "Set receiptFields.firstExternalPersonRole to the first external person's role, not their private identity unless necessary.");
    addRemediation(actions, !hasText(receipt.receiptFields?.contactChannel), "Set receiptFields.contactChannel to the channel used for the manual send.");
    addRemediation(actions, !isoTimestampIsValid(receipt.receiptFields?.sendTimestampIso), "Set receiptFields.sendTimestampIso to a valid ISO timestamp for the manual send event.");
  }

  if (sentManually || preflightReady) {
    addRemediation(actions, receipt.receiptFields?.preflight?.commandRun !== true, "Set receiptFields.preflight.commandRun=true after running the public beta tester preflight command.");
    addRemediation(actions, receipt.receiptFields?.preflight?.resultStatus !== "passed", "Set receiptFields.preflight.resultStatus=passed only after the preflight verifier passes.");
    addRemediation(
      actions,
      receipt.receiptFields?.preflight?.evidencePath !== "artifacts/productization/public-beta-tester-session-preflight.json",
      "Set receiptFields.preflight.evidencePath=artifacts/productization/public-beta-tester-session-preflight.json."
    );
    addRemediation(actions, !preflightEvidence.passed, "Run npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000 and keep the passed evidence JSON at the expected path.");
  }

  if (sentManually) {
    const unsentIds = sentMaterials.filter((file) => file.sent !== true).map((file) => file.id ?? file.bundlePath ?? "unknown");
    const unretainedIds = retained.filter((file) => file.retained !== true).map((file) => file.id ?? file.bundlePath ?? "unknown");
    const unconfirmedNegativeAssertions = Object.entries(negativeAssertions)
      .filter(([, value]) => value !== true)
      .map(([key]) => key);

    addRemediation(
      actions,
      unsentIds.length > 0,
      `Set receiptFields.sentMaterials[].sent=true for every file actually sent from SEND_TO_FIRST_EXTERNAL_PERSON; still false/missing: ${unsentIds.join(", ")}.`
    );
    addRemediation(
      actions,
      unretainedIds.length > 0,
      `Keep every receiptFields.retainedByMaintainer[].retained=true; still false/missing: ${unretainedIds.join(", ")}.`
    );
    addRemediation(
      actions,
      Object.keys(negativeAssertions).length < 8 || unconfirmedNegativeAssertions.length > 0,
      `Confirm every receiptFields.negativeAssertions entry is true after manual send; still false/missing: ${unconfirmedNegativeAssertions.join(", ") || "expected assertion set"}.`
    );
  }

  if (notSentYet) {
    const incorrectlySentIds = sentMaterials.filter((file) => file.sent !== false).map((file) => file.id ?? file.bundlePath ?? "unknown");
    addRemediation(actions, incorrectlySentIds.length > 0, `For not_sent_yet, keep every receiptFields.sentMaterials[].sent=false; currently not false: ${incorrectlySentIds.join(", ")}.`);
  }

  return Array.from(new Set(actions));
}
function main() {
  const receiptPath = parseReceiptPath();
  const isTemplate = path.resolve(receiptPath) === path.resolve(defaultReceiptPath);
  const outputPath = parseOutputPath(isTemplate);
  const receipt = readJson<SendReceipt>(receiptPath);
  const markdown = readText(markdownPath);
  const checks: Check[] = [];
  const sentMaterials = receipt?.receiptFields?.sentMaterials ?? [];
  const retained = receipt?.receiptFields?.retainedByMaintainer ?? [];
  const negativeAssertions = receipt?.receiptFields?.negativeAssertions ?? {};
  const decision = receipt?.receiptFields?.decision;
  const preflightEvidence = preflightEvidenceIsPassed(receiptPath, receipt?.receiptFields?.preflight?.evidencePath);

  push(checks, "Send receipt JSON exists", Boolean(receipt), `path=${path.relative(rootDir, receiptPath)}`);
  push(
    checks,
    "Send receipt mode is recognized",
    receipt?.responseMode === "first_real_tester_send_receipt_template_json_v1",
    `responseMode=${receipt?.responseMode ?? "missing"}`
  );
  push(
    checks,
    "Send receipt preserves productization locks",
    receipt?.productScope === "bounded_core_teaching_loop" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.releaseDecision === "do_not_release" &&
      receipt.reviewOnly === true &&
      receipt.accepted === false &&
      receipt.packagingGated === true &&
      receipt.canRelease === false &&
      receipt.canActivateRealModel === false,
    `scope=${receipt?.productScope ?? "missing"}; release=${receipt?.releaseDecision ?? "missing"}; accepted=${receipt?.accepted ?? "missing"}; packaging=${receipt?.packagingGated ?? "missing"}; canRelease=${receipt?.canRelease ?? "missing"}; canActivate=${receipt?.canActivateRealModel ?? "missing"}`
  );
  push(
    checks,
    "Send decision is constrained and cannot mean acceptance",
    Array.isArray(receipt?.allowedDecisions) &&
      allowedDecisions.every((value) => receipt.allowedDecisions?.includes(value)) &&
      allowedDecisions.includes(decision ?? "") &&
      !receipt.allowedDecisions.includes("accepted") &&
      receipt.blockedDecisions?.includes("accepted") === true &&
      receipt.blockedDecisions.includes("release_approved") &&
      receipt.blockedDecisions.includes("packaging_unlocked") &&
      receipt.blockedDecisions.includes("real_model_accepted") &&
      receipt.blockedActions?.includes("record_acceptance_from_send_receipt") === true &&
      !containsForbiddenClaim(receipt),
    `decision=${decision ?? "missing"}; allowed=${receipt?.allowedDecisions?.join(",") ?? "missing"}; blocked=${receipt?.blockedDecisions?.join(",") ?? "missing"}`
  );
  push(
    checks,
    "Send receipt is tied to the single public beta send bundle",
    receipt?.selectedLane?.id === "public_beta_tester_session" &&
      receipt.selectedLane.preflightCommand === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      receipt.selectedLane.preflightEvidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      receipt.sourceBundle?.manifestPath === "artifacts/productization/first-real-tester-send-bundle.json" &&
      receipt.sourceBundle.externalSendFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      receipt.sourceBundle.returnIntakeFolder === "artifacts/productization/first-real-tester-send-bundle/KEEP_FOR_RETURN_INTAKE" &&
      receipt.sourceBundle.actualSendPerformed === false,
    `lane=${receipt?.selectedLane?.id ?? "missing"}; send=${receipt?.sourceBundle?.externalSendFolder ?? "missing"}; sourceSent=${receipt?.sourceBundle?.actualSendPerformed ?? "missing"}`
  );
  push(
    checks,
    "Send and retained material lists match packaged bundle files",
    sentMaterials.length >= 3 &&
      sentMaterials.every((file) => file.bundlePath?.startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/") === true) &&
      retained.length >= 2 &&
      retained.every((file) => file.bundlePath?.startsWith("KEEP_FOR_RETURN_INTAKE/") === true) &&
      allExpectedFilesMatch(sentMaterials) &&
      allExpectedFilesMatch(retained) &&
      fileExistsWithSize("artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON/PUBLIC_BETA_SESSION_PLAN.md", 1000),
    `sent=${sentMaterials.map((file) => `${file.bundlePath}:${file.expectedBytes}/${bundledFileSize(file.bundlePath)}:${(file.expectedSha256 ?? "missing").slice(0, 12)}/${bundledFileSha256(file.bundlePath).slice(0, 12)}`).join(",")}; retained=${retained.length}`
  );
  push(
    checks,
    "Send receipt follow-up remains first-return only",
    receipt?.receiptFields?.followUp?.nextExpectedStep === "wait_for_first_return_then_use_return_workbench" &&
      receipt.receiptFields.followUp.returnWorkbenchPath === "artifacts/productization/first-real-tester-return-workbench.md" &&
      receipt.receiptFields.followUp.returnGatePath === "artifacts/productization/first-real-tester-return-gate.md",
    `next=${receipt?.receiptFields?.followUp?.nextExpectedStep ?? "missing"}; workbench=${receipt?.receiptFields?.followUp?.returnWorkbenchPath ?? "missing"}`
  );

  if (isTemplate) {
    push(
      checks,
      "Template exists and is default-not-sent",
      receipt?.status === "template_ready" &&
        receipt.defaultDecision === "not_sent_yet" &&
        decision === "not_sent_yet" &&
        receipt.receiptFields?.preflight?.commandRun === false &&
        receipt.receiptFields.preflight.resultStatus === "not_run_yet" &&
        sentMaterials.every((file) => file.sent === false) &&
        retained.every((file) => file.retained === true) &&
        Object.values(negativeAssertions).every((value) => value === false) &&
        (receipt.failedReasons?.length ?? -1) === 0,
      `status=${receipt?.status ?? "missing"}; decision=${decision ?? "missing"}; sourceSent=${receipt?.sourceBundle?.actualSendPerformed ?? "missing"}; failed=${receipt?.failedReasons?.join(",") || "none"}`
    );
    push(
      checks,
      "Template Markdown is readable and explicit",
      markdown.includes("# First Real Tester Send Receipt Template") &&
        markdown.includes("manual send event only") &&
        markdown.includes("Default decision: `not_sent_yet`") &&
        markdown.includes("Blocked Decisions") &&
        markdown.includes("expected sha256") &&
        markdown.includes("failedChecks") &&
        markdown.includes("remediationActions") &&
        receipt?.validationFailureHandoff?.failedChecksField === "failedChecks" &&
        receipt.validationFailureHandoff.remediationActionsField === "remediationActions" &&
        receipt.validationFailureHandoff.nextActionField === "nextAction" &&
        receipt.validationFailureHandoff.rule?.includes("before treating the manual send as recorded") === true &&
        markdown.includes("Accepted: `false`") &&
        markdown.includes("Can release: `false`") &&
        markdown.includes("Can activate real model: `false`") &&
        markdown.length > 1900,
      `bytes=${markdown.length}`
    );
  } else {
    const sentManually = decision === "sent_manually";
    const preflightReady = decision === "preflight_ready";
    const notSentYet = decision === "not_sent_yet";
    const everySentMaterialMarkedSent = sentMaterials.every((file) => file.sent === true);
    const everyRetainedMaterialRetained = retained.every((file) => file.retained === true);
    const everyNegativeAssertionTrue = Object.keys(negativeAssertions).length >= 8 && Object.values(negativeAssertions).every((value) => value === true);

    push(
      checks,
      "Submitted send receipt has maintainer, contact, and timestamp when sent",
      sentManually
        ? hasText(receipt?.receiptFields?.maintainerNameOrRole) &&
          hasText(receipt?.receiptFields?.firstExternalPersonRole) &&
          hasText(receipt?.receiptFields?.contactChannel) &&
          isoTimestampIsValid(receipt?.receiptFields?.sendTimestampIso)
        : hasText(receipt?.receiptFields?.maintainerNameOrRole) || preflightReady || notSentYet,
      `decision=${decision ?? "missing"}; maintainer=${receipt?.receiptFields?.maintainerNameOrRole ?? "missing"}; role=${receipt?.receiptFields?.firstExternalPersonRole ?? "missing"}; channel=${receipt?.receiptFields?.contactChannel ?? "missing"}; timestamp=${receipt?.receiptFields?.sendTimestampIso ?? "missing"}`
    );
    push(
      checks,
      "Submitted send receipt uses passed preflight before manual send",
      sentManually || preflightReady
        ? receipt?.receiptFields?.preflight?.commandRun === true &&
          receipt.receiptFields.preflight.resultStatus === "passed" &&
          receipt.receiptFields.preflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
          preflightEvidence.passed
        : receipt?.receiptFields?.preflight?.commandRun === false && receipt.receiptFields.preflight.resultStatus === "not_run_yet",
      `decision=${decision ?? "missing"}; commandRun=${receipt?.receiptFields?.preflight?.commandRun ?? "missing"}; result=${receipt?.receiptFields?.preflight?.resultStatus ?? "missing"}; evidence=${preflightEvidence.evidence?.status ?? "missing"} ${preflightEvidence.evidence?.passed ?? "?"}/${preflightEvidence.evidence?.total ?? "?"}`
    );
    push(
      checks,
      "Submitted sent-manually receipt confirms exact external send folder only",
      sentManually
        ? everySentMaterialMarkedSent && everyRetainedMaterialRetained && everyNegativeAssertionTrue
        : sentMaterials.every((file) => file.sent === false) && everyRetainedMaterialRetained,
      `decision=${decision ?? "missing"}; sent=${sentMaterials.map((file) => `${file.id}:${file.sent}`).join(",")}; retained=${retained.map((file) => `${file.id}:${file.retained}`).join(",")}; negativeAssertions=${JSON.stringify(negativeAssertions)}`
    );
    push(
      checks,
      "Submitted send receipt cannot invite another person or advance release",
      sentManually
        ? negativeAssertions.didNotInviteAdditionalTesterOrReviewer === true &&
          negativeAssertions.didNotClaimAcceptance === true &&
          negativeAssertions.didNotSendReleaseApprovalMaterials === true &&
          negativeAssertions.didNotSendRealModelTrialMaterials === true &&
          receipt?.accepted === false &&
          receipt.packagingGated === true &&
          receipt.canRelease === false &&
          receipt.canActivateRealModel === false
        : receipt?.accepted === false && receipt.packagingGated === true && receipt.canRelease === false && receipt.canActivateRealModel === false,
      `inviteMore=${negativeAssertions.didNotInviteAdditionalTesterOrReviewer ?? "missing"}; acceptance=${negativeAssertions.didNotClaimAcceptance ?? "missing"}; releaseMaterials=${negativeAssertions.didNotSendReleaseApprovalMaterials ?? "missing"}; realModelMaterials=${negativeAssertions.didNotSendRealModelTrialMaterials ?? "missing"}`
    );
  }

  const passed = checks.filter((check) => check.pass).length;
  const status = passed === checks.length ? (isTemplate ? "passed" : decision === "sent_manually" ? "sent_manually_verified" : "not_sent_verified") : "failed";
  const failedChecks = checks.filter((check) => !check.pass).map((check) => ({ name: check.name, evidence: check.evidence }));
  const remediationActions = isTemplate
    ? []
    : submittedReceiptRemediationActions(receipt, decision, sentMaterials, retained, negativeAssertions, preflightEvidence);
  const validation = {
    responseMode: isTemplate
      ? "first_real_tester_send_receipt_template_verification_json_v1"
      : "first_real_tester_send_receipt_validation_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: isTemplate
      ? "npm run verify:first-real-tester-send-receipt-template"
      : `npm run verify:first-real-tester-send-receipt-template -- --receipt ${path.relative(rootDir, receiptPath)}`,
    inputPath: path.relative(rootDir, receiptPath),
    mode: isTemplate ? "template" : "submitted_receipt",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    decision: decision ?? "missing",
    passed,
    total: checks.length,
    checks,
    failedChecks,
    remediationActions,
    nextAction:
      status === "passed"
        ? "Use a copy of first-real-tester-send-receipt.template.json only after preflight succeeds and exactly the external send folder is manually sent; validate the filled copy with -- --receipt <path>."
        : status === "sent_manually_verified"
          ? "Wait for the first return, then use first-real-tester-return-workbench.md. Do not invite another tester before the return gate allows it."
          : status === "not_sent_verified"
            ? "The receipt does not record a completed manual send yet. Run preflight immediately before contact and validate again after the manual send."
            : remediationActions.length > 0
              ? `Fix the first real tester send receipt before treating any manual send as recorded: ${remediationActions[0]}`
              : "Fix the first real tester send receipt before treating any manual send as recorded."
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(validation, null, 2));
  console.log(`\nFirst real tester send receipt ${isTemplate ? "template verification" : "validation"} written to ${outputPath}`);
  if (status === "failed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
