import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type HumanAcceptanceReceipt = {
  reviewer?: { name?: string; date?: string };
  humanAcceptanceDecision?: string;
};

type IntakeStatus = "rejected" | "recorded_needs_gate_verification" | "processed_gate_verified";

type FirstRealTesterSendReceiptValidation = {
  responseMode?: string;
  status?: string;
  mode?: string;
  decision?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  passed?: number;
  total?: number;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultInboxDir = path.join(artifactsDir, "human-acceptance-receipt-inbox");
const defaultOutputPath = path.join(artifactsDir, "human-acceptance-return-intake.json");
const npmExecPath = process.env.npm_execpath;
const defaultFirstRealTesterSendReceiptValidationPath = path.join(
  artifactsDir,
  "first-real-tester-send-receipt-validation.json"
);

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return path.resolve(process.cwd(), value);
}

function rel(targetPath: string) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

function sanitizeOutput(value: string) {
  return value
    .replaceAll(process.cwd(), "<workspace>")
    .replace(/[A-Z]:\\[^\n\r"]+/g, "<local-path>")
    .replace(/\r\n/g, "\n")
    .trim();
}

function trimOutput(value: string) {
  const sanitized = sanitizeOutput(value);
  return sanitized.length > 2500 ? sanitized.slice(-2500) : sanitized;
}

function runNpmScript(script: string, args: string[] = []) {
  const npmArgs = ["run", script, ...args];
  const runner = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const runnerArgs = npmExecPath ? [npmExecPath, ...npmArgs] : npmArgs;
  const result = spawnSync(runner, runnerArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true
  });
  const output = [result.stdout ?? "", result.stderr ?? "", result.error?.message ?? ""].filter(Boolean).join("\n");

  return {
    command: ["npm", ...npmArgs].join(" "),
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    outputTail: result.status === 0 ? "" : trimOutput(output)
  };
}

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

function readArtifact<T>(relativePath: string): T | null {
  return readJson<T>(path.join(process.cwd(), relativePath));
}


function validateFirstRealTesterManualSendReceipt(validationPath: string) {
  const receipt = readJson<FirstRealTesterSendReceiptValidation>(validationPath);
  const exists = fs.existsSync(validationPath);
  const passed =
    exists &&
    receipt?.responseMode === "first_real_tester_send_receipt_template_verification_json_v1" &&
    receipt.status === "passed" &&
    receipt.mode === "submitted" &&
    receipt.decision === "sent_manually" &&
    receipt.releaseDecision === "do_not_release" &&
    receipt.accepted === false &&
    receipt.packagingGated === true &&
    receipt.canRelease === false &&
    receipt.canActivateRealModel === false &&
    typeof receipt.passed === "number" &&
    receipt.passed === receipt.total &&
    Number(receipt.total ?? 0) >= 9;

  return {
    path: validationPath,
    relativePath: rel(validationPath),
    passed,
    status: receipt?.status ?? (exists ? "unrecognized" : "missing"),
    mode: receipt?.mode ?? "missing",
    decision: receipt?.decision ?? "missing",
    evidence: exists
      ? `status=${receipt?.status ?? "missing"}; mode=${receipt?.mode ?? "missing"}; decision=${
          receipt?.decision ?? "missing"
        }; checks=${receipt?.passed ?? "?"}/${receipt?.total ?? "?"}`
      : `missing ${rel(validationPath)}`
  };
}

function safeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function destinationFor(receiptPath: string, inboxDir: string) {
  const receipt = readJson<HumanAcceptanceReceipt>(receiptPath);
  const reviewer = safeName(receipt?.reviewer?.name ?? "reviewer");
  const date = safeName(receipt?.reviewer?.date ?? new Date().toISOString().slice(0, 10));
  const decision = safeName(receipt?.humanAcceptanceDecision ?? "human-acceptance");
  let destination = path.join(inboxDir, `${date}-${reviewer}-${decision}.json`);
  let suffix = 2;

  while (fs.existsSync(destination)) {
    destination = path.join(inboxDir, `${date}-${reviewer}-${decision}-${suffix}.json`);
    suffix += 1;
  }

  return destination;
}

export function intakeHumanAcceptanceReturn(args: {
  receiptPath: string;
  inboxDir?: string;
  outputPath?: string;
  sendReceiptValidationPath?: string | null;
}) {
  const receiptPath = path.resolve(process.cwd(), args.receiptPath);
  const inboxDir = args.inboxDir ?? defaultInboxDir;
  const outputPath = args.outputPath ?? defaultOutputPath;
  const validationOutputPath = outputPath.replace(/\.json$/i, ".receipt-validation.json");
  const sendReceiptValidationPath = args.sendReceiptValidationPath
    ? path.resolve(process.cwd(), args.sendReceiptValidationPath)
    : defaultFirstRealTesterSendReceiptValidationPath;
  const firstRealSendReceipt = validateFirstRealTesterManualSendReceipt(sendReceiptValidationPath);
  const steps = [];

  steps.push({
    label: "Verify first-real tester manual send receipt before return intake",
    command: "npm run verify:first-real-tester-send-receipt-template -- --receipt <filled-send-receipt-path>",
    status: firstRealSendReceipt.passed ? "passed" : "failed",
    exitCode: firstRealSendReceipt.passed ? 0 : 1,
    outputTail: firstRealSendReceipt.passed ? "" : firstRealSendReceipt.evidence
  });

  const validation = runNpmScript("verify:human-acceptance-receipt", [
    "--",
    "--receipt",
    receiptPath,
    "--out",
    validationOutputPath
  ]);
  steps.push({
    label: "Validate submitted human acceptance receipt",
    ...validation
  });

  let copiedReceiptPath: string | null = null;
  let gateRefresh: ReturnType<typeof runNpmScript> | null = null;
  let releaseRefresh: ReturnType<typeof runNpmScript> | null = null;

  if (firstRealSendReceipt.passed && validation.status === "passed") {
    fs.mkdirSync(inboxDir, { recursive: true });
    copiedReceiptPath = destinationFor(receiptPath, inboxDir);
    fs.copyFileSync(receiptPath, copiedReceiptPath);
    steps.push({
      label: "Copy valid human acceptance receipt into the review-only inbox",
      command: `copy ${rel(receiptPath)} ${rel(copiedReceiptPath)}`,
      status: "passed",
      exitCode: 0,
      outputTail: ""
    });

    gateRefresh = runNpmScript("verify:human-acceptance", ["--", "--allow-pending"]);
    steps.push({
      label: "Refresh human acceptance gate from saved manual evidence",
      ...gateRefresh
    });

    releaseRefresh = runNpmScript("verify:product-release-readiness", ["--", "--allow-blocked"]);
    steps.push({
      label: "Refresh release readiness after human acceptance return intake",
      ...releaseRefresh
    });
  }

  const humanGate = readArtifact<{
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    latestAutomationGenerated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-gate.json");
  const releaseReadiness = readArtifact<{
    status?: string;
    releaseDecision?: string;
    blockers?: unknown[];
  }>("artifacts/productization/product-release-readiness.json");
  const passed = steps.filter((step) => step.status === "passed").length;
  const status: IntakeStatus =
    !firstRealSendReceipt.passed || validation.status !== "passed"
      ? "rejected"
      : humanGate?.status === "passed"
        ? "processed_gate_verified"
        : "recorded_needs_gate_verification";

  const intake = {
    responseMode: "human_acceptance_return_intake_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: `npm run intake:human-acceptance-return -- --receipt ${rel(receiptPath)}`,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    sourceReceiptPath: rel(receiptPath),
    firstRealTesterSendReceiptValidation: {
      requiredBeforeReturnIntake: true,
      path: firstRealSendReceipt.relativePath,
      status: firstRealSendReceipt.status,
      mode: firstRealSendReceipt.mode,
      decision: firstRealSendReceipt.decision,
      passed: firstRealSendReceipt.passed,
      evidence: firstRealSendReceipt.evidence
    },
    copiedReceiptPath: copiedReceiptPath ? rel(copiedReceiptPath) : null,
    inboxDir: rel(inboxDir),
    passed,
    total: steps.length,
    steps,
    humanAcceptanceGate: {
      status: humanGate?.status ?? "not_refreshed",
      latestEvidenceKind: humanGate?.latestEvidenceKind ?? "missing",
      latestHumanReviewed: humanGate?.latestHumanReviewed ?? false,
      latestAutomationGenerated: humanGate?.latestAutomationGenerated ?? true,
      passed: humanGate?.passed ?? 0,
      total: humanGate?.total ?? 0
    },
    releaseReadiness: {
      status: releaseReadiness?.status ?? "not_refreshed",
      releaseDecision: releaseReadiness?.releaseDecision ?? "do_not_release",
      blockerCount: releaseReadiness?.blockers?.length ?? 0
    },
    refreshedHandoffArtifacts: {
      releaseReadiness: releaseRefresh?.status ?? "not_run"
    },
    postIntakeRefresh: {
      requiredAfterReturnIntakeVerification: true,
      reason:
        "Run this sequence only after npm run verify:human-acceptance-return-intake passes, because reviewer invites and downstream blocker materials require the return-intake behavior receipt to be current.",
      commandSequence: [
        "npm run verify:human-acceptance-return-intake",
        "npm run build:human-acceptance-reviewer-kit",
        "npm run verify:human-acceptance-reviewer-kit",
        "npm run build:human-acceptance-receipt-template",
        "npm run verify:human-acceptance-receipt",
        "npm run build:human-acceptance-reviewer-invite",
        "npm run verify:human-acceptance-reviewer-invite",
        "npm run verify:real-model-adapter-contract",
        "npm run build:real-model-trial-kit",
        "npm run verify:real-model-trial-kit",
        "npm run build:real-model-trial-receipt-template",
        "npm run verify:real-model-trial-receipt",
        "npm run verify:real-model-trial-return-intake",
        "npm run build:product-release-blocker-board",
        "npm run verify:product-release-blocker-board",
        "npm run build:product-operator-brief",
        "npm run verify:product-operator-brief",
        "npm run build:product-status-summary",
        "npm run verify:product-status-summary",
        "npm run build:product-takeover-matrix",
        "npm run verify:product-takeover-matrix",
        "npm run verify:productization-evidence-freshness"
      ],
      blockedUntilVerificationPasses: [
        "Do not rebuild reviewer invites from a failed human-acceptance-return-intake verification receipt.",
        "Do not use a returned receipt as acceptance unless /manual-test saved human_review evidence and verify:human-acceptance passes.",
        "Do not unlock packaging, release, real model activation, or all-software scope from this sequence."
      ]
    },
    nextAction:
      status === "processed_gate_verified"
        ? "Human acceptance evidence is gate-verified. Run the post-intake refresh sequence before relying on takeover/status handoff files; release remains locked until real-model and release approval gates pass."
        : status === "recorded_needs_gate_verification"
          ? "The reviewer receipt was archived and the immediate gate/release handoff was refreshed, but human-acceptance-gate.json is still not passed. Verify that /manual-test saved real human_review evidence before treating this as accepted, then run the post-intake refresh sequence."
          : firstRealSendReceipt.passed
            ? "Fix or discard the submitted human acceptance receipt; it was not copied into the inbox."
            : "Validate the filled first-real tester send receipt before processing the returned human acceptance receipt.",
    locks: {
      mustNotSaveAcceptanceFromReceipt: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotAcceptRealModel: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(intake, null, 2));
  return intake;
}

function main() {
  const receiptPath = getArg("--receipt");
  if (!receiptPath) {
    throw new Error("Usage: npm run intake:human-acceptance-return -- --receipt <filled-human-acceptance-receipt.json>");
  }

  const intake = intakeHumanAcceptanceReturn({
    receiptPath,
    inboxDir: getArg("--inbox") ?? defaultInboxDir,
    outputPath: getArg("--out") ?? defaultOutputPath,
    sendReceiptValidationPath: getArg("--send-receipt-validation") ?? defaultFirstRealTesterSendReceiptValidationPath
  });

  console.log(JSON.stringify(intake, null, 2));
  console.log(`\nHuman acceptance return intake written to ${getArg("--out") ?? defaultOutputPath}`);

  if (intake.status === "rejected") {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

export {};
