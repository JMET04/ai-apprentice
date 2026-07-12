import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FeedbackReceipt = {
  tester?: { name?: string; date?: string };
  betaDecision?: string;
};

type SessionReceipt = {
  facilitator?: { name?: string; date?: string };
  tester?: { name?: string; date?: string };
  sessionEvidence?: { feedbackReceiptPath?: string };
  sessionDecision?: string;
};

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
const defaultInboxDir = path.join(artifactsDir, "public-beta-feedback-inbox");
const defaultSessionInboxDir = path.join(artifactsDir, "public-beta-session-receipts");
const defaultOutputPath = path.join(artifactsDir, "public-beta-return-intake.json");
const defaultCollectionPath = path.join(artifactsDir, "public-beta-feedback-collection.json");
const defaultFollowUpPlanPath = path.join(artifactsDir, "public-beta-follow-up-plan.json");
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
  const receipt = readJson<FeedbackReceipt>(receiptPath);
  const tester = safeName(receipt?.tester?.name ?? "tester");
  const date = safeName(receipt?.tester?.date ?? new Date().toISOString().slice(0, 10));
  const decision = safeName(receipt?.betaDecision ?? "feedback");
  let destination = path.join(inboxDir, `${date}-${tester}-${decision}.json`);
  let suffix = 2;

  while (fs.existsSync(destination)) {
    destination = path.join(inboxDir, `${date}-${tester}-${decision}-${suffix}.json`);
    suffix += 1;
  }

  return destination;
}

function sessionDestinationFor(receiptPath: string, inboxDir: string) {
  const receipt = readJson<SessionReceipt>(receiptPath);
  const facilitator = safeName(receipt?.facilitator?.name ?? "facilitator");
  const tester = safeName(receipt?.tester?.name ?? "tester");
  const date = safeName(receipt?.facilitator?.date ?? receipt?.tester?.date ?? new Date().toISOString().slice(0, 10));
  const decision = safeName(receipt?.sessionDecision ?? "session");
  let destination = path.join(inboxDir, `${date}-${facilitator}-${tester}-${decision}.json`);
  let suffix = 2;

  while (fs.existsSync(destination)) {
    destination = path.join(inboxDir, `${date}-${facilitator}-${tester}-${decision}-${suffix}.json`);
    suffix += 1;
  }

  return destination;
}

function normalizedReceiptField(value: string | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function normalizeReceiptPathForBinding(targetPath: string) {
  return path.normalize(path.resolve(targetPath)).toLowerCase();
}

function feedbackReceiptPathMatches(feedbackReceiptPath: string, sessionReceiptPath: string, referencedPath: string | undefined) {
  const value = (referencedPath ?? '').trim();
  if (value === '') {
    return { pass: false, evidence: 'sessionEvidence.feedbackReceiptPath=missing' };
  }

  const candidates = path.isAbsolute(value)
    ? [path.resolve(value)]
    : [path.resolve(process.cwd(), value), path.resolve(path.dirname(sessionReceiptPath), value)];
  const expected = normalizeReceiptPathForBinding(feedbackReceiptPath);
  const matched = candidates.some((candidate) => normalizeReceiptPathForBinding(candidate) === expected);

  return {
    pass: matched,
    evidence: `sessionEvidence.feedbackReceiptPath=${value}; matchedSubmittedFeedback=${matched}`
  };
}

function publicBetaReceiptsMatch(feedbackReceiptPath: string, sessionReceiptPath: string) {
  const feedbackReceipt = readJson<FeedbackReceipt>(feedbackReceiptPath);
  const sessionReceipt = readJson<SessionReceipt>(sessionReceiptPath);
  const feedbackTester = normalizedReceiptField(feedbackReceipt?.tester?.name);
  const sessionTester = normalizedReceiptField(sessionReceipt?.tester?.name);
  const feedbackDate = normalizedReceiptField(feedbackReceipt?.tester?.date);
  const sessionDate = normalizedReceiptField(sessionReceipt?.tester?.date);
  const pathMatch = feedbackReceiptPathMatches(
    feedbackReceiptPath,
    sessionReceiptPath,
    sessionReceipt?.sessionEvidence?.feedbackReceiptPath
  );
  const pass =
    feedbackTester !== '' &&
    feedbackTester === sessionTester &&
    feedbackDate !== '' &&
    feedbackDate === sessionDate &&
    pathMatch.pass;

  return {
    pass,
    evidence: `feedbackTester=${feedbackTester || 'missing'}; sessionTester=${sessionTester || 'missing'}; feedbackDate=${
      feedbackDate || 'missing'
    }; sessionDate=${sessionDate || 'missing'}; ${pathMatch.evidence}`
  };
}

export function intakePublicBetaReturn(args: {
  receiptPath: string;
  sessionReceiptPath?: string | null;
  inboxDir?: string;
  sessionInboxDir?: string;
  outputPath?: string;
  collectionPath?: string;
  followUpPlanPath?: string;
  sendReceiptValidationPath?: string | null;
}) {
  const receiptPath = path.resolve(process.cwd(), args.receiptPath);
  const sessionReceiptPath = args.sessionReceiptPath ? path.resolve(process.cwd(), args.sessionReceiptPath) : null;
  const inboxDir = args.inboxDir ?? defaultInboxDir;
  const sessionInboxDir = args.sessionInboxDir ?? defaultSessionInboxDir;
  const outputPath = args.outputPath ?? defaultOutputPath;
  const sessionReceiptValidationPath = outputPath.replace(/\.json$/i, "-session-receipt-validation.json");
  const collectionPath = args.collectionPath ?? defaultCollectionPath;
  const followUpPlanPath = args.followUpPlanPath ?? defaultFollowUpPlanPath;
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

  if (!sessionReceiptPath) {
    steps.push({
      label: "Require submitted whole-session receipt before return intake",
      command:
        "npm run intake:public-beta-return -- --receipt <submitted-feedback.json> --session-receipt <filled-public-beta-session-receipt.json>",
      status: "failed",
      exitCode: 1,
      outputTail:
        "Public beta return intake requires --session-receipt so feedback cannot enter the review queue without whole-session evidence."
    });
  }

  const validation = runNpmScript("verify:public-beta-feedback", ["--", "--receipt", receiptPath]);
  steps.push({
    label: "Validate submitted public beta feedback receipt",
    ...validation
  });

  let copiedSessionReceiptPath: string | null = null;
  let receiptsMatch = false;
  if (sessionReceiptPath) {
    const sessionValidation = runNpmScript("verify:public-beta-session-receipt", [
      "--",
      "--receipt",
      sessionReceiptPath,
      "--out",
      sessionReceiptValidationPath
    ]);
    steps.push({
      label: "Validate submitted whole-session receipt",
      ...sessionValidation
    });

    if (validation.status === "passed" && sessionValidation.status === "passed") {
      const match = publicBetaReceiptsMatch(receiptPath, sessionReceiptPath);
      receiptsMatch = match.pass;
      steps.push({
        label: "Bind feedback receipt to the same tester session and submitted feedback path",
        command: "compare feedback tester/date with whole-session tester/date",
        status: match.pass ? "passed" : "failed",
        exitCode: match.pass ? 0 : 1,
        outputTail: match.pass ? "" : match.evidence
      });
    }

    if (firstRealSendReceipt.passed && sessionValidation.status === "passed" && validation.status === "passed" && receiptsMatch) {
      fs.mkdirSync(sessionInboxDir, { recursive: true });
      copiedSessionReceiptPath = sessionDestinationFor(sessionReceiptPath, sessionInboxDir);
      fs.copyFileSync(sessionReceiptPath, copiedSessionReceiptPath);
      steps.push({
        label: "Copy valid whole-session receipt into the review-only session inbox",
        command: `copy ${rel(sessionReceiptPath)} ${rel(copiedSessionReceiptPath)}`,
        status: "passed",
        exitCode: 0,
        outputTail: ""
      });
    }
  }

  let copiedReceiptPath: string | null = null;
  const sessionReceiptReady = Boolean(sessionReceiptPath) && copiedSessionReceiptPath !== null;
  if (firstRealSendReceipt.passed && validation.status === "passed" && sessionReceiptReady) {
    fs.mkdirSync(inboxDir, { recursive: true });
    copiedReceiptPath = destinationFor(receiptPath, inboxDir);
    fs.copyFileSync(receiptPath, copiedReceiptPath);
    steps.push({
      label: "Copy valid feedback receipt into the review-only inbox",
      command: `copy ${rel(receiptPath)} ${rel(copiedReceiptPath)}`,
      status: "passed",
      exitCode: 0,
      outputTail: ""
    });

    const collectArgs = ["--", "--dir", inboxDir, "--out", collectionPath];
    const collection = runNpmScript("collect:public-beta-feedback", collectArgs);
    steps.push({
      label: "Collect public beta feedback inbox",
      ...collection
    });

    if (collection.status === "passed") {
      const planArgs = ["--", "--collection", collectionPath, "--out", followUpPlanPath];
      steps.push({
        label: "Plan public beta follow-up from returned feedback",
        ...runNpmScript("plan:public-beta-follow-up", planArgs)
      });
    }
  }

  const passed = steps.filter((step) => step.status === "passed").length;
  const status =
    !firstRealSendReceipt.passed || validation.status !== "passed" || passed !== steps.length ? "rejected" : "processed";
  const collection = readJson<{ status?: string; totalReceipts?: number; validReceipts?: number; invalidReceipts?: number }>(
    collectionPath
  );
  const followUpPlan = readJson<{ status?: string; canInviteNextTester?: boolean; actions?: unknown[] }>(followUpPlanPath);
  const intake = {
    responseMode: "public_beta_return_intake_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: sessionReceiptPath
      ? `npm run intake:public-beta-return -- --receipt ${rel(receiptPath)} --session-receipt ${rel(sessionReceiptPath)}`
      : `npm run intake:public-beta-return -- --receipt ${rel(receiptPath)} --session-receipt <missing>`,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    sourceReceiptPath: rel(receiptPath),
    sourceSessionReceiptPath: sessionReceiptPath ? rel(sessionReceiptPath) : null,
    sessionReceiptValidationPath: sessionReceiptPath ? rel(sessionReceiptValidationPath) : null,
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
    copiedSessionReceiptPath: copiedSessionReceiptPath ? rel(copiedSessionReceiptPath) : null,
    inboxDir: rel(inboxDir),
    sessionInboxDir: rel(sessionInboxDir),
    collectionPath: rel(collectionPath),
    followUpPlanPath: rel(followUpPlanPath),
    passed,
    total: steps.length,
    steps,
    collection: {
      status: collection?.status ?? "not_refreshed",
      totalReceipts: collection?.totalReceipts ?? 0,
      validReceipts: collection?.validReceipts ?? 0,
      invalidReceipts: collection?.invalidReceipts ?? 0
    },
    followUpPlan: {
      status: followUpPlan?.status ?? "not_refreshed",
      canInviteNextTester: followUpPlan?.canInviteNextTester ?? false,
      actionCount: followUpPlan?.actions?.length ?? 0
    },
    nextAction:
      status === "processed"
        ? "Review public-beta-follow-up-plan.json and the archived session receipt before inviting another tester; beta feedback remains review-only."
        : sessionReceiptPath
          ? firstRealSendReceipt.passed
            ? "Fix or discard the submitted receipt; it was not copied into the feedback inbox."
            : "Validate the filled first-real tester send receipt before processing returned beta feedback."
          : "Provide a filled whole-session receipt with --session-receipt before processing returned beta feedback.",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
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
    throw new Error(
      "Usage: npm run intake:public-beta-return -- --receipt <submitted-feedback.json> --session-receipt <filled-public-beta-session-receipt.json>"
    );
  }

  const intake = intakePublicBetaReturn({
    receiptPath,
    sessionReceiptPath: getArg("--session-receipt"),
    inboxDir: getArg("--inbox") ?? defaultInboxDir,
    sessionInboxDir: getArg("--session-inbox") ?? defaultSessionInboxDir,
    outputPath: getArg("--out") ?? defaultOutputPath,
    collectionPath: getArg("--collection-out") ?? defaultCollectionPath,
    followUpPlanPath: getArg("--plan-out") ?? defaultFollowUpPlanPath,
    sendReceiptValidationPath: getArg("--send-receipt-validation") ?? defaultFirstRealTesterSendReceiptValidationPath
  });

  console.log(JSON.stringify(intake, null, 2));
  console.log(`\nPublic beta return intake written to ${getArg("--out") ?? defaultOutputPath}`);

  if (intake.status !== "processed") {
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
