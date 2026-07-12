import fs from "node:fs";
import path from "node:path";
import { visualLearningAcceptanceGate } from "../src/lib/teacher-acceptance";
import { getAIServiceRuntimeStatus } from "../src/server/ai/service";

type ReleaseCheck = {
  name: string;
  pass: boolean;
  requiredForRelease: boolean;
  evidence: string;
  blocker?: string;
};

const allowBlocked = process.argv.includes("--allow-blocked");
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "product-release-readiness.json");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function push(checks: ReleaseCheck[], check: ReleaseCheck) {
  checks.push(check);
}

function main() {
  const productVerification = readJson<{
    status?: string;
    productionServerMode?: string;
    productionServerRuntimePath?: string | null;
    steps?: Array<{ label?: string; status?: string }>;
  }>("artifacts/productization/product-verification-receipt.json");
  const runtimeVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-runtime-verification.json"
  );
  const productUiApiSmoke = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/product-ui-api-smoke.json");
  const handoff = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-handoff-readiness.json"
  );
  const classification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/manual-acceptance-classification-verification.json"
  );
  const humanGate = readJson<{
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-gate.json");
  const packet = readJson<{
    status?: string;
    source?: string;
    includedFiles?: Array<{ destination?: string }>;
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("artifacts/productization/product-trial-packet/product-trial-manifest.json");
  const liveHandoff = readJson<{
    status?: string;
    releaseDecision?: string;
    runtimeNames?: string[];
    verificationRuntimeNames?: string[];
    passed?: number;
    total?: number;
  }>("artifacts/productization/live-product-handoff.json");

  const ai = getAIServiceRuntimeStatus();
  const checks: ReleaseCheck[] = [];
  const productSteps = productVerification?.steps ?? [];
  const productStepsPassed = productSteps.length > 0 && productSteps.every((step) => step.status === "passed");

  push(checks, {
    name: "Product verification is fully green",
    pass:
      productVerification?.status === "passed" &&
      productStepsPassed &&
      productVerification.productionServerMode === "standalone_copy" &&
      productVerification.productionServerRuntimePath?.includes("artifacts/productization/runtime/verify-standalone-") === true &&
      productVerification.productionServerRuntimePath.endsWith("/server.js"),
    requiredForRelease: true,
    evidence: `status=${productVerification?.status ?? "missing"}; steps=${
      productSteps.filter((step) => step.status === "passed").length
    }/${productSteps.length}; mode=${productVerification?.productionServerMode ?? "missing"}`,
    blocker: "Run npm run verify:product successfully."
  });

  push(checks, {
    name: "Public product runtime is verified",
    pass:
      runtimeVerification?.status === "passed" &&
      runtimeVerification.passed === runtimeVerification.total &&
      Number(runtimeVerification.total ?? 0) > 0,
    requiredForRelease: true,
    evidence: `status=${runtimeVerification?.status ?? "missing"}; checks=${runtimeVerification?.passed ?? "?"}/${
      runtimeVerification?.total ?? "?"
    }`,
    blocker: "Run npm run verify:product-runtime successfully."
  });

  push(checks, {
    name: "Product UI/API smoke is green",
    pass:
      productUiApiSmoke?.responseMode === "product_ui_api_smoke_receipt_json_v1" &&
      productUiApiSmoke.status === "passed" &&
      productUiApiSmoke.passed === productUiApiSmoke.total &&
      Number(productUiApiSmoke.total ?? 0) > 0 &&
      productUiApiSmoke.releaseDecision === "do_not_release" &&
      productUiApiSmoke.reviewOnly === true &&
      productUiApiSmoke.accepted === false &&
      productUiApiSmoke.packagingGated === true,
    requiredForRelease: true,
    evidence: `status=${productUiApiSmoke?.status ?? "missing"}; checks=${productUiApiSmoke?.passed ?? "?"}/${
      productUiApiSmoke?.total ?? "?"
    }; releaseDecision=${productUiApiSmoke?.releaseDecision ?? "missing"}`,
    blocker: "Run npm run smoke:product -- --base-url http://127.0.0.1:3000 successfully."
  });

  push(checks, {
    name: "Handoff gate is green",
    pass: handoff?.status === "passed" && handoff.passed === handoff.total && Number(handoff.total ?? 0) >= 18,
    requiredForRelease: true,
    evidence: `status=${handoff?.status ?? "missing"}; checks=${handoff?.passed ?? "?"}/${handoff?.total ?? "?"}`,
    blocker: "Run npm run verify:handoff successfully."
  });

  push(checks, {
    name: "Live product handoff is green",
    pass:
      liveHandoff?.status === "passed" &&
      liveHandoff.releaseDecision === "do_not_release" &&
      liveHandoff.runtimeNames?.includes("standalone") === true &&
      liveHandoff.verificationRuntimeNames?.length === 0 &&
      liveHandoff.passed === liveHandoff.total &&
      Number(liveHandoff.total ?? 0) >= 9,
    requiredForRelease: true,
    evidence: `status=${liveHandoff?.status ?? "missing"}; runtimeNames=${
      liveHandoff?.runtimeNames?.join(",") ?? "missing"
    }; verificationRuntimeNames=${liveHandoff?.verificationRuntimeNames?.join(",") ?? "missing"}; checks=${
      liveHandoff?.passed ?? "?"
    }/${liveHandoff?.total ?? "?"}`,
    blocker: "Run npm run verify:live-handoff successfully."
  });

  push(checks, {
    name: "Manual acceptance classification resists bypass",
    pass:
      classification?.status === "passed" &&
      classification.passed === classification.total &&
      Number(classification.total ?? 0) >= 6,
    requiredForRelease: true,
    evidence: `status=${classification?.status ?? "missing"}; checks=${classification?.passed ?? "?"}/${
      classification?.total ?? "?"
    }`,
    blocker: "Run npm run verify:manual-acceptance-classification successfully."
  });

  push(checks, {
    name: "Real human acceptance is complete",
    pass:
      humanGate?.status === "passed" &&
      humanGate.latestEvidenceKind === "human_review" &&
      humanGate.latestHumanReviewed === true,
    requiredForRelease: true,
    evidence: `status=${humanGate?.status ?? "missing"}; evidenceKind=${
      humanGate?.latestEvidenceKind ?? "missing"
    }; humanReviewed=${humanGate?.latestHumanReviewed ?? "missing"}`,
    blocker: "Run a real /manual-test pass and then npm run verify:human-acceptance."
  });

  push(checks, {
    name: "Real model adapter is ready",
    pass: ai.activeProvider !== "mock" && ai.realModelReady === true,
    requiredForRelease: true,
    evidence: `activeProvider=${ai.activeProvider}; requestedProvider=${ai.requestedProvider}; realModelReady=${ai.realModelReady}; status=${ai.status}`,
    blocker: "Configure, verify, and separately accept the real-model adapter; mock AI remains the default beta runtime."
  });

  push(checks, {
    name: "Packaging and release lock is intentionally still closed",
    pass: Boolean(visualLearningAcceptanceGate.accepted) === true && Boolean(visualLearningAcceptanceGate.packagingGated) === false,
    requiredForRelease: true,
    evidence: `accepted=${visualLearningAcceptanceGate.accepted}; packagingGated=${visualLearningAcceptanceGate.packagingGated}; status=${visualLearningAcceptanceGate.status}`,
    blocker: "Packaging must remain locked until human acceptance and release approval explicitly unlock it."
  });

  push(checks, {
    name: "Trial packet exists for review handoff",
    pass:
      packet?.status === "built" &&
      packet.includedFiles?.some((file) => file.destination === "evidence/product-verification-receipt.json") === true &&
      packet.includedFiles.some((file) => file.destination === "evidence/human-acceptance-gate.json") &&
      packet.includedFiles.some((file) => file.destination === "evidence/live-product-handoff.json") &&
      packet.packagingBoundary?.accepted === false &&
      packet.packagingBoundary.packagingGated === true,
    requiredForRelease: false,
    evidence: `status=${packet?.status ?? "missing"}; source=${packet?.source ?? "missing"}; files=${
      packet?.includedFiles?.length ?? 0
    }`,
    blocker: "Run npm run package:product-trial."
  });

  const requiredChecks = checks.filter((check) => check.requiredForRelease);
  const failedRequired = requiredChecks.filter((check) => !check.pass);
  const passed = checks.filter((check) => check.pass).length;
  const status = failedRequired.length === 0 ? "passed" : "blocked_not_release_ready";
  const receipt = {
    responseMode: "product_release_readiness_gate_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: allowBlocked
      ? "npm run verify:product-release-readiness -- --allow-blocked"
      : "npm run verify:product-release-readiness",
    allowBlocked,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: status === "passed" ? "release_candidate" : "do_not_release",
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    requiredPassed: requiredChecks.length - failedRequired.length,
    requiredTotal: requiredChecks.length,
    blockers: failedRequired.map((check) => ({
      name: check.name,
      evidence: check.evidence,
      nextAction: check.blocker
    })),
    checks,
    boundary: {
      trialReadyCanBeTrueWhileReleaseBlocked: true,
      accepted: visualLearningAcceptanceGate.accepted,
      packagingGated: visualLearningAcceptanceGate.packagingGated,
      canRelease: false,
      canActivateRealModel: false,
      activeProvider: ai.activeProvider,
      realModelReady: ai.realModelReady
    }
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProduct release readiness receipt written to ${receiptPath}`);

  if (status !== "passed" && !allowBlocked) {
    process.exitCode = 1;
  }
}

main();

export {};
