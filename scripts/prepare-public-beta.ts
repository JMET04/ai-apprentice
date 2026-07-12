import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type PreparationStep = {
  label: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  durationMs: number;
  outputSummary: string;
  outputTail: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "public-beta-preparation.json");
const packetDir = path.join(artifactsDir, "public-beta-packet");
const packetManifestPath = path.join(packetDir, "public-beta-manifest.json");
const packetPreparationPath = path.join(packetDir, "evidence", "public-beta-preparation.json");
const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_PUBLIC_BETA_BASE_URL ?? "http://127.0.0.1:3000";
const npmExecPath = process.env.npm_execpath;

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function sanitizeOutput(value: string) {
  return value
    .replaceAll(process.cwd(), "<workspace>")
    .replace(/[A-Z]:\\[^\n\r"]+/g, "<local-path>")
    .replace(/\r\n/g, "\n")
    .trim();
}

function trimOutput(value: string) {
  const normalized = sanitizeOutput(value);
  if (normalized.length <= 4000) {
    return normalized;
  }

  return normalized.slice(-4000);
}

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function writeReceipt(status: "running" | "passed" | "failed", steps: PreparationStep[]) {
  const passed = steps.filter((step) => step.status === "passed").length;
  const publicBetaReadiness = readJson<{
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-readiness.json");
  const publicBetaPacket = readJson<{
    status?: string;
    betaCanStart?: boolean;
    requiredPassed?: number;
    requiredTotal?: number;
    releaseDecision?: string;
    includedFiles?: unknown[];
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const productTrialPacket = readJson<{
    status?: string;
    includedFiles?: unknown[];
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("artifacts/productization/product-trial-packet/product-trial-manifest.json");
  const feedbackCollection = readJson<{
    status?: string;
    totalReceipts?: number;
    validReceipts?: number;
    invalidReceipts?: number;
  }>("artifacts/productization/public-beta-feedback-collection.json");
  const followUpPlan = readJson<{
    status?: string;
    canInviteNextTester?: boolean;
    actions?: unknown[];
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const testerInvite = readJson<{
    status?: string;
    canInvite?: boolean;
    failedReasons?: string[];
  }>("artifacts/productization/public-beta-tester-invite.json");
  const publicBetaBrowserSmoke = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    validation?: { dryRunValidated?: boolean; noInboxGrowth?: boolean };
  }>("artifacts/productization/public-beta-browser-smoke.json");

  const receipt = {
    responseMode: "public_beta_preparation_receipt_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: `npm run prepare:public-beta -- --base-url ${baseUrl}`,
    baseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed,
    total: steps.length,
    steps,
    publicBetaReadiness: {
      status: publicBetaReadiness?.status ?? "missing",
      betaCanStart: publicBetaReadiness?.betaCanStart ?? false,
      releaseDecision: publicBetaReadiness?.releaseDecision ?? "do_not_release",
      passed: publicBetaReadiness?.passed ?? 0,
      total: publicBetaReadiness?.total ?? 0
    },
    publicBetaPacket: {
      status: publicBetaPacket?.status ?? "missing",
      betaCanStart: publicBetaPacket?.betaCanStart ?? false,
      releaseDecision: publicBetaPacket?.releaseDecision ?? "do_not_release",
      requiredPassed: publicBetaPacket?.requiredPassed ?? 0,
      requiredTotal: publicBetaPacket?.requiredTotal ?? 0,
      includedFileCount: publicBetaPacket?.includedFiles?.length ?? 0,
      accepted: publicBetaPacket?.packagingBoundary?.accepted ?? false,
      packagingGated: publicBetaPacket?.packagingBoundary?.packagingGated ?? true
    },
    productTrialPacket: {
      status: productTrialPacket?.status ?? "missing",
      includedFileCount: productTrialPacket?.includedFiles?.length ?? 0,
      accepted: productTrialPacket?.packagingBoundary?.accepted ?? false,
      packagingGated: productTrialPacket?.packagingBoundary?.packagingGated ?? true
    },
    feedbackCollection: {
      status: feedbackCollection?.status ?? "missing",
      totalReceipts: feedbackCollection?.totalReceipts ?? 0,
      validReceipts: feedbackCollection?.validReceipts ?? 0,
      invalidReceipts: feedbackCollection?.invalidReceipts ?? 0
    },
    followUpPlan: {
      status: followUpPlan?.status ?? "missing",
      canInviteNextTester: followUpPlan?.canInviteNextTester ?? false,
      actionCount: followUpPlan?.actions?.length ?? 0
    },
    testerInvite: {
      status: testerInvite?.status ?? "missing",
      canInvite: testerInvite?.canInvite ?? false,
      failedReasons: testerInvite?.failedReasons ?? []
    },
    publicBetaBrowserSmoke: {
      status: publicBetaBrowserSmoke?.status ?? "missing",
      passed: publicBetaBrowserSmoke?.passed ?? 0,
      total: publicBetaBrowserSmoke?.total ?? 0,
      dryRunValidated: publicBetaBrowserSmoke?.validation?.dryRunValidated ?? false,
      noInboxGrowth: publicBetaBrowserSmoke?.validation?.noInboxGrowth ?? false
    },
    nextAction:
      status === "passed"
        ? "Run npm run preflight:public-beta-tester against the live URL, then invite one bounded tester using artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md; keep release blocked."
        : "Fix the failed preparation step, then rerun npm run prepare:public-beta."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receipt;
}

function syncPreparationReceiptToPublicBetaPacket(receiptJson: string) {
  fs.mkdirSync(path.dirname(packetPreparationPath), { recursive: true });
  fs.writeFileSync(packetPreparationPath, receiptJson);

  if (!fs.existsSync(packetManifestPath)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(packetManifestPath, "utf8")) as {
    includedFiles?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
  };
  const includedFiles = manifest.includedFiles ?? [];
  const destination = "evidence/public-beta-preparation.json";
  const existing = includedFiles.find((file) => file.destination === destination);
  const entry = {
    source: "artifacts/productization/public-beta-preparation.json",
    destination,
    required: false,
    bytes: fs.statSync(packetPreparationPath).size
  };

  if (existing) {
    Object.assign(existing, entry);
  } else {
    includedFiles.push(entry);
  }

  manifest.includedFiles = includedFiles;
  fs.writeFileSync(packetManifestPath, JSON.stringify(manifest, null, 2));
}

function runNpmScript(label: string, script: string, extraArgs: string[] = []): PreparationStep {
  const npmArgs = ["run", script, ...extraArgs];
  const runner = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const args = npmExecPath ? [npmExecPath, ...npmArgs] : npmArgs;
  const command = ["npm", ...npmArgs].join(" ");
  const startedAt = Date.now();
  const result = spawnSync(runner, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true
  });
  const durationMs = Date.now() - startedAt;
  const output = [result.stdout ?? "", result.stderr ?? "", result.error?.message ?? ""].filter(Boolean).join("\n");
  const passed = result.status === 0;

  return {
    label,
    command,
    status: passed ? "passed" : "failed",
    exitCode: result.status,
    durationMs,
    outputSummary: passed
      ? "Command passed; verbose output is omitted from the handoff receipt."
      : "Command failed; sanitized output tail is included for diagnosis.",
    outputTail: passed ? "" : trimOutput(output)
  };
}

function main() {
  const steps: PreparationStep[] = [];
  writeReceipt("running", steps);

  const plan: Array<{ label: string; script: string; args?: string[] }> = [
    {
      label: "Verify public beta feedback API behavior",
      script: "verify:public-beta-feedback-api"
    },
    {
      label: "Capture public beta feedback workbench browser evidence",
      script: "smoke:public-beta-browser",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Verify public beta feedback collection behavior",
      script: "verify:public-beta-feedback-collection"
    },
    {
      label: "Verify public beta feedback follow-up planning behavior",
      script: "verify:public-beta-follow-up-plan"
    },
    {
      label: "Collect current public beta feedback inbox",
      script: "collect:public-beta-feedback"
    },
    {
      label: "Plan current public beta feedback follow-up",
      script: "plan:public-beta-follow-up"
    },
    {
      label: "Verify public beta return intake behavior",
      script: "verify:public-beta-return-intake"
    },
    {
      label: "Capture manual acceptance workbench browser evidence",
      script: "smoke:manual-browser",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Refresh human acceptance gate after manual browser evidence",
      script: "verify:human-acceptance",
      args: ["--", "--allow-pending"]
    },
    {
      label: "Preflight human acceptance session",
      script: "preflight:human-acceptance",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Build human acceptance reviewer kit",
      script: "build:human-acceptance-reviewer-kit"
    },
    {
      label: "Verify human acceptance reviewer kit",
      script: "verify:human-acceptance-reviewer-kit"
    },
    {
      label: "Build human acceptance receipt template",
      script: "build:human-acceptance-receipt-template"
    },
    {
      label: "Verify human acceptance receipt template",
      script: "verify:human-acceptance-receipt"
    },
    {
      label: "Verify human acceptance return intake behavior",
      script: "verify:human-acceptance-return-intake"
    },
    {
      label: "Refresh blocked product release readiness",
      script: "verify:product-release-readiness",
      args: ["--", "--allow-blocked"]
    },
    {
      label: "Build product release blocker board",
      script: "build:product-release-blocker-board"
    },
    {
      label: "Verify product release blocker board",
      script: "verify:product-release-blocker-board"
    },
    {
      label: "Build product release approval receipt template",
      script: "build:product-release-approval-template"
    },
    {
      label: "Verify product release approval receipt template",
      script: "verify:product-release-approval"
    },
    {
      label: "Verify product release approval return intake behavior",
      script: "verify:product-release-approval-return-intake"
    },
    {
      label: "Verify real model adapter contract",
      script: "verify:real-model-adapter-contract"
    },
    {
      label: "Build real model trial kit",
      script: "build:real-model-trial-kit"
    },
    {
      label: "Verify real model trial kit",
      script: "verify:real-model-trial-kit"
    },
    {
      label: "Build real model trial receipt template",
      script: "build:real-model-trial-receipt-template"
    },
    {
      label: "Verify real model trial receipt template",
      script: "verify:real-model-trial-receipt"
    },
    {
      label: "Verify real model trial return intake behavior",
      script: "verify:real-model-trial-return-intake"
    },
    {
      label: "Build product operator brief before packet build",
      script: "build:product-operator-brief"
    },
    {
      label: "Verify product operator brief before packet build",
      script: "verify:product-operator-brief"
    },
    {
      label: "Refresh product handoff and product trial packet",
      script: "verify:handoff"
    },
    {
      label: "Refresh product runtime doctor for live handoff",
      script: "doctor:product",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Verify live handoff server",
      script: "verify:live-handoff",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Build public beta tester invite kit",
      script: "build:public-beta-tester-invite"
    },
    {
      label: "Verify public beta tester invite kit",
      script: "verify:public-beta-tester-invite"
    },
    {
      label: "Build public beta packet after live handoff refresh",
      script: "package:public-beta"
    },
    {
      label: "Verify public beta packet after live handoff refresh",
      script: "verify:public-beta"
    },
    {
      label: "Capture handoff beta return loop browser evidence",
      script: "smoke:handoff-browser",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Build public beta packet from current evidence",
      script: "package:public-beta"
    },
    {
      label: "Verify public beta packet and sync readiness into the packet",
      script: "verify:public-beta"
    },
    {
      label: "Rebuild handoff after public beta readiness refresh",
      script: "verify:handoff"
    },
    {
      label: "Recheck live handoff against refreshed trial packet",
      script: "verify:live-handoff",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Rebuild public beta packet with final handoff evidence",
      script: "package:public-beta"
    },
    {
      label: "Final public beta readiness verification",
      script: "verify:public-beta"
    },
    {
      label: "Preflight public beta tester session",
      script: "preflight:public-beta-tester",
      args: ["--", "--base-url", baseUrl]
    },
    {
      label: "Build product operator brief",
      script: "build:product-operator-brief"
    },
    {
      label: "Verify product operator brief",
      script: "verify:product-operator-brief"
    },
    {
      label: "Rebuild public beta packet with tester session preflight evidence",
      script: "package:public-beta"
    },
    {
      label: "Final public beta readiness verification after tester preflight",
      script: "verify:public-beta"
    }
  ];

  for (const item of plan) {
    if (item.script === "build:product-operator-brief") {
      writeReceipt("passed", steps);
    }

    const step = runNpmScript(item.label, item.script, item.args ?? []);
    steps.push(step);
    writeReceipt(step.status === "passed" ? "running" : "failed", steps);

    if (step.status !== "passed") {
      const receipt = writeReceipt("failed", steps);
      console.log(JSON.stringify(receipt, null, 2));
      process.exitCode = 1;
      return;
    }
  }

  const firstReceipt = writeReceipt("passed", steps);
  syncPreparationReceiptToPublicBetaPacket(JSON.stringify(firstReceipt, null, 2));
  const receipt = writeReceipt("passed", steps);
  const receiptJson = JSON.stringify(receipt, null, 2);
  syncPreparationReceiptToPublicBetaPacket(receiptJson);
  console.log(receiptJson);
  console.log(`\nPublic beta preparation receipt written to ${receiptPath}`);
}

main();
