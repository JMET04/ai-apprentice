import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const readinessPath = path.join(artifactsDir, "first-real-tester-contact-readiness.json");
const readinessMarkdownPath = path.join(artifactsDir, "first-real-tester-contact-readiness.md");

type Check = { name: string; pass: boolean; evidence: string; requiredForContact: boolean; nextAction?: string };

type SendBundle = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  actualSendPerformed?: boolean;
  requiresManualSend?: boolean;
  selectedLane?: { id?: string; preflightCommand?: string; preflightEvidencePath?: string };
  externalSendFolder?: string;
  returnIntakeFolder?: string;
  sendFiles?: Array<{ bundlePath?: string; sha256?: string; bytes?: number }>;
  failedReasons?: string[];
};

type SendReceiptTemplate = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  defaultDecision?: string;
  receiptFields?: { sentMaterials?: Array<{ bundlePath?: string; expectedSha256?: string; sent?: boolean }> };
  sourceBundle?: { externalSendFolder?: string; actualSendPerformed?: boolean };
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
};

type PreflightReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  baseUrl?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canInviteTester?: boolean;
  passed?: number;
  total?: number;
};

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileExists(relativePath: string, minBytes = 1) {
  const full = path.join(rootDir, relativePath);
  return fs.existsSync(full) && fs.statSync(full).size >= minBytes;
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isCurrentOrNewer(candidate: string | undefined, source: string | undefined) {
  const candidateMs = timestampMs(candidate);
  const sourceMs = timestampMs(source);
  return Number.isFinite(candidateMs) && Number.isFinite(sourceMs) && candidateMs >= sourceMs;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string, requiredForContact = true, nextAction?: string) {
  checks.push({ name, pass, evidence, requiredForContact, nextAction });
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function main() {
  const bundle = readJson<SendBundle>("artifacts/productization/first-real-tester-send-bundle.json");
  const sendReceiptTemplate = readJson<SendReceiptTemplate>("artifacts/productization/first-real-tester-send-receipt.template.json");
  const preflightPath = bundle?.selectedLane?.preflightEvidencePath ?? "artifacts/productization/public-beta-tester-session-preflight.json";
  const preflight = readJson<PreflightReceipt>(preflightPath);
  const checks: Check[] = [];

  push(
    checks,
    "First real tester send bundle is ready and unsent",
    bundle?.responseMode === "first_real_tester_send_bundle_json_v1" &&
      bundle.status === "ready_to_send_chosen_lane" &&
      bundle.productScope === "bounded_core_teaching_loop" &&
      bundle.allSoftwareObjective === "paused" &&
      bundle.releaseDecision === "do_not_release" &&
      bundle.accepted === false &&
      bundle.packagingGated === true &&
      bundle.canRelease === false &&
      bundle.canActivateRealModel === false &&
      bundle.actualSendPerformed === false &&
      bundle.requiresManualSend === true &&
      (bundle.failedReasons?.length ?? -1) === 0,
    `status=${bundle?.status ?? "missing"}; lane=${bundle?.selectedLane?.id ?? "missing"}; sent=${bundle?.actualSendPerformed ?? "missing"}; failed=${bundle?.failedReasons?.join(",") || "none"}`,
    true,
    "Run npm run build:first-real-tester-send-bundle and npm run verify:first-real-tester-send-bundle."
  );

  const sendFiles = bundle?.sendFiles ?? [];
  push(
    checks,
    "External send folder has only declared selected-lane materials",
    bundle?.externalSendFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      sendFiles.length >= 2 &&
      sendFiles.every((file) => typeof file.bundlePath === "string" && file.bundlePath.startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/")) &&
      sendFiles.every((file) => fileExists(`artifacts/productization/first-real-tester-send-bundle/${file.bundlePath}`, 100)) &&
      fileExists("artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON/README.md", 50) &&
      !sendFiles.some((file) => /release|real.?model/i.test(file.bundlePath ?? "")),
    `folder=${bundle?.externalSendFolder ?? "missing"}; files=${sendFiles.map((file) => file.bundlePath ?? "missing").join(",")}`,
    true,
    "Rebuild the send bundle and send only SEND_TO_FIRST_EXTERNAL_PERSON."
  );

  push(
    checks,
    "Send receipt template is ready and still not sent",
    sendReceiptTemplate?.responseMode === "first_real_tester_send_receipt_template_json_v1" &&
      sendReceiptTemplate.status === "template_ready" &&
      sendReceiptTemplate.defaultDecision === "not_sent_yet" &&
      sendReceiptTemplate.sourceBundle?.externalSendFolder === bundle?.externalSendFolder &&
      sendReceiptTemplate.sourceBundle?.actualSendPerformed === false &&
      sendReceiptTemplate.releaseDecision === "do_not_release" &&
      sendReceiptTemplate.accepted === false &&
      sendReceiptTemplate.packagingGated === true &&
      sendReceiptTemplate.canRelease === false &&
      sendReceiptTemplate.canActivateRealModel === false,
    `template=${sendReceiptTemplate?.status ?? "missing"}; decision=${sendReceiptTemplate?.defaultDecision ?? "missing"}; sourceSent=${sendReceiptTemplate?.sourceBundle?.actualSendPerformed ?? "missing"}`,
    true,
    "Run npm run build:first-real-tester-send-receipt-template and npm run verify:first-real-tester-send-receipt-template."
  );

  push(
    checks,
    "Latest selected-lane live preflight passed",
    preflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      preflight.status === "passed" &&
      preflight.canInviteTester === true &&
      preflight.releaseDecision === "do_not_release" &&
      preflight.accepted === false &&
      preflight.packagingGated === true &&
      preflight.passed === preflight.total &&
      Number(preflight.total ?? 0) >= 10,
    `status=${preflight?.status ?? "missing"}; checks=${preflight?.passed ?? "?"}/${preflight?.total ?? "?"}; evidence=${preflightPath}`,
    true,
    bundle?.selectedLane?.preflightCommand ?? "Run the selected lane live preflight."
  );

  push(
    checks,
    "Live preflight is newer than the current send bundle",
    isCurrentOrNewer(preflight?.generatedAt, bundle?.generatedAt),
    `preflight=${preflight?.generatedAt ?? "missing"}; sendBundle=${bundle?.generatedAt ?? "missing"}; rule=preflight.generatedAt >= sendBundle.generatedAt`,
    true,
    bundle?.selectedLane?.preflightCommand ?? "Rerun the selected lane preflight after rebuilding the send bundle."
  );

  push(
    checks,
    "Contact would not widen release, packaging, real-model, or all-software scope",
    bundle?.releaseDecision === "do_not_release" &&
      bundle.accepted === false &&
      bundle.packagingGated === true &&
      bundle.canRelease === false &&
      bundle.canActivateRealModel === false &&
      bundle.allSoftwareObjective === "paused" &&
      preflight?.releaseDecision === "do_not_release" &&
      preflight.accepted === false &&
      preflight.packagingGated === true,
    `bundleRelease=${bundle?.releaseDecision ?? "missing"}; bundleAccepted=${bundle?.accepted ?? "missing"}; bundlePackaging=${bundle?.packagingGated ?? "missing"}; preflightRelease=${preflight?.releaseDecision ?? "missing"}; allSoftware=${bundle?.allSoftwareObjective ?? "missing"}`,
    true,
    "Stop if any contact evidence changes releaseDecision, accepted, packagingGated, canRelease, canActivateRealModel, or allSoftwareObjective."
  );

  const failedRequired = checks.filter((check) => check.requiredForContact && !check.pass);
  const preflightFresh = checks.find((check) => check.name === "Live preflight is newer than the current send bundle")?.pass === true;
  const status =
    failedRequired.length === 0
      ? "ready_to_contact_first_external_person"
      : !preflightFresh
        ? "blocked_needs_live_preflight_refresh"
        : "blocked_before_contact";

  const readiness = {
    responseMode: "first_real_tester_contact_readiness_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-contact-readiness",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    selectedLane: {
      id: bundle?.selectedLane?.id ?? "missing",
      preflightCommand: bundle?.selectedLane?.preflightCommand ?? "missing",
      preflightEvidencePath: preflightPath
    },
    contactAllowed: status === "ready_to_contact_first_external_person",
    actualSendPerformed: false,
    contactDecision: status === "ready_to_contact_first_external_person" ? "may_contact_exactly_one_person" : "do_not_contact",
    sendBoundary: {
      externalSendFolder: bundle?.externalSendFolder ?? "missing",
      returnIntakeFolder: bundle?.returnIntakeFolder ?? "missing",
      sendReceiptTemplatePath: "artifacts/productization/first-real-tester-send-receipt-template.md",
      validationCommandAfterManualSend: "npm run verify:first-real-tester-send-receipt-template -- --receipt <path>",
      validationEvidencePath: "artifacts/productization/first-real-tester-send-receipt-validation.json"
    },
    checks,
    failedRequiredChecks: failedRequired.map((check) => check.name),
    blockedActions: [
      "contact_more_than_one_external_person",
      "contact_without_current_live_preflight",
      "send_return_intake_folder",
      "send_release_approval_materials_as_first_test",
      "send_real_model_activation_materials_as_first_test",
      "claim_acceptance_or_release_from_contact_readiness"
    ],
    nextAction:
      status === "ready_to_contact_first_external_person"
        ? "Contact exactly one external person with only SEND_TO_FIRST_EXTERNAL_PERSON, then fill and validate the manual-send receipt before waiting for the first return."
        : "Rerun the selected lane live preflight after the current send bundle is built, then rebuild this contact-readiness gate before contacting anyone."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");

  const markdown = `# First Real Tester Contact Readiness\n\nStatus: \`${readiness.status}\`\n\nContact allowed: \`${readiness.contactAllowed}\`\n\nSelected lane: \`${readiness.selectedLane.id}\`\n\nContact decision: \`${readiness.contactDecision}\`\n\n## Required Checks\n\n${markdownList(checks.map((check) => `\`${check.pass}\` - ${check.name}: ${check.evidence}`))}\n\n## Send Boundary\n\n- External send folder: \`${readiness.sendBoundary.externalSendFolder}\`\n- Return intake folder: \`${readiness.sendBoundary.returnIntakeFolder}\`\n- Send receipt template: \`${readiness.sendBoundary.sendReceiptTemplatePath}\`\n- Validate filled send receipt: \`${readiness.sendBoundary.validationCommandAfterManualSend}\`\n- Validation evidence: \`${readiness.sendBoundary.validationEvidencePath}\`\n\n## Blocked Actions\n\n${markdownList(readiness.blockedActions.map((action) => `\`${action}\``))}\n\n## Boundary\n\n- Release decision: \`${readiness.releaseDecision}\`\n- Accepted: \`${readiness.accepted}\`\n- Packaging gated: \`${readiness.packagingGated}\`\n- Can release: \`${readiness.canRelease}\`\n- Can activate real model: \`${readiness.canActivateRealModel}\`\n- All-software objective: \`${readiness.allSoftwareObjective}\`\n\n## Next Action\n\n${readiness.nextAction}\n`;
  fs.writeFileSync(readinessMarkdownPath, markdown, "utf8");

  console.log(JSON.stringify(readiness, null, 2));
  console.log(`\nFirst real tester contact readiness written to ${readinessPath}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
