import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RealModelTrialReceipt = {
  reviewer?: { name?: string; date?: string };
  modelTrialDecision?: string;
};

type IntakeStatus = "rejected" | "recorded_needs_follow_up" | "recorded_blocked" | "recorded_ready_for_separate_acceptance_review";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultInboxDir = path.join(artifactsDir, "real-model-trial-receipt-inbox");
const defaultOutputPath = path.join(artifactsDir, "real-model-trial-return-intake.json");
const npmExecPath = process.env.npm_execpath;

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

function safeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function destinationFor(receiptPath: string, inboxDir: string) {
  const receipt = readJson<RealModelTrialReceipt>(receiptPath);
  const reviewer = safeName(receipt?.reviewer?.name ?? "reviewer");
  const date = safeName(receipt?.reviewer?.date ?? new Date().toISOString().slice(0, 10));
  const decision = safeName(receipt?.modelTrialDecision ?? "real-model-trial");
  let destination = path.join(inboxDir, `${date}-${reviewer}-${decision}.json`);
  let suffix = 2;

  while (fs.existsSync(destination)) {
    destination = path.join(inboxDir, `${date}-${reviewer}-${decision}-${suffix}.json`);
    suffix += 1;
  }

  return destination;
}

export function intakeRealModelTrialReturn(args: { receiptPath: string; inboxDir?: string; outputPath?: string }) {
  const receiptPath = path.resolve(process.cwd(), args.receiptPath);
  const inboxDir = args.inboxDir ?? defaultInboxDir;
  const outputPath = args.outputPath ?? defaultOutputPath;
  const validationOutputPath = outputPath.replace(/\.json$/i, ".receipt-validation.json");
  const steps = [];

  const validation = runNpmScript("verify:real-model-trial-receipt", [
    "--",
    "--receipt",
    receiptPath,
    "--out",
    validationOutputPath
  ]);
  steps.push({
    label: "Validate submitted real-model trial receipt",
    ...validation
  });

  let copiedReceiptPath: string | null = null;
  let releaseRefresh: ReturnType<typeof runNpmScript> | null = null;
  let operatorBriefRefresh: ReturnType<typeof runNpmScript> | null = null;
  let blockerBoardRefresh: ReturnType<typeof runNpmScript> | null = null;

  if (validation.status === "passed") {
    fs.mkdirSync(inboxDir, { recursive: true });
    copiedReceiptPath = destinationFor(receiptPath, inboxDir);
    fs.copyFileSync(receiptPath, copiedReceiptPath);
    steps.push({
      label: "Copy valid real-model trial receipt into the review-only inbox",
      command: `copy ${rel(receiptPath)} ${rel(copiedReceiptPath)}`,
      status: "passed",
      exitCode: 0,
      outputTail: ""
    });

    releaseRefresh = runNpmScript("verify:product-release-readiness", ["--", "--allow-blocked"]);
    steps.push({
      label: "Refresh release readiness after real-model trial return intake",
      ...releaseRefresh
    });

    operatorBriefRefresh = runNpmScript("build:product-operator-brief");
    steps.push({
      label: "Refresh product operator brief after real-model trial return intake",
      ...operatorBriefRefresh
    });

    blockerBoardRefresh = runNpmScript("build:product-release-blocker-board");
    steps.push({
      label: "Refresh release blocker board after real-model trial return intake",
      ...blockerBoardRefresh
    });
  }

  const submittedReceipt = readJson<RealModelTrialReceipt>(receiptPath);
  const releaseReadiness = readArtifact<{
    status?: string;
    releaseDecision?: string;
    blockers?: unknown[];
  }>("artifacts/productization/product-release-readiness.json");
  const validationReceipt = readJson<{
    status?: string;
    mode?: string;
    passed?: number;
    total?: number;
  }>(validationOutputPath);
  const passed = steps.filter((step) => step.status === "passed").length;
  const status: IntakeStatus =
    validation.status !== "passed"
      ? "rejected"
      : submittedReceipt?.modelTrialDecision === "ready_for_separate_acceptance_review"
        ? "recorded_ready_for_separate_acceptance_review"
        : submittedReceipt?.modelTrialDecision === "blocked"
          ? "recorded_blocked"
          : "recorded_needs_follow_up";

  const intake = {
    responseMode: "real_model_trial_return_intake_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: `npm run intake:real-model-trial-return -- --receipt ${rel(receiptPath)}`,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    sourceReceiptPath: rel(receiptPath),
    copiedReceiptPath: copiedReceiptPath ? rel(copiedReceiptPath) : null,
    inboxDir: rel(inboxDir),
    passed,
    total: steps.length,
    steps,
    submittedDecision: submittedReceipt?.modelTrialDecision ?? "missing",
    receiptValidation: {
      status: validationReceipt?.status ?? "not_refreshed",
      mode: validationReceipt?.mode ?? "missing",
      passed: validationReceipt?.passed ?? 0,
      total: validationReceipt?.total ?? 0
    },
    releaseReadiness: {
      status: releaseReadiness?.status ?? "not_refreshed",
      releaseDecision: releaseReadiness?.releaseDecision ?? "do_not_release",
      blockerCount: releaseReadiness?.blockers?.length ?? 0
    },
    nextAction:
      status === "recorded_ready_for_separate_acceptance_review"
        ? "Real-model trial evidence is archived for separate acceptance review. Do not activate the provider or release until a separate approval process changes the locks."
        : status === "recorded_blocked"
          ? "Stop real-model rollout and resolve the submitted blocker before another provider trial."
          : status === "recorded_needs_follow_up"
            ? "Use the archived real-model trial receipt for follow-up planning; release remains locked."
            : "Fix or discard the submitted real-model trial receipt; it was not copied into the inbox.",
    locks: {
      mustNotCommitSecrets: true,
      mustNotSaveAcceptanceFromReceipt: true,
      mustNotActivateRealModel: true,
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
    throw new Error("Usage: npm run intake:real-model-trial-return -- --receipt <filled-real-model-trial-receipt.json>");
  }

  const intake = intakeRealModelTrialReturn({
    receiptPath,
    inboxDir: getArg("--inbox") ?? defaultInboxDir,
    outputPath: getArg("--out") ?? defaultOutputPath
  });

  console.log(JSON.stringify(intake, null, 2));
  console.log(`\nReal-model trial return intake written to ${getArg("--out") ?? defaultOutputPath}`);

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
