import fs from "node:fs";
import path from "node:path";

type LiveHandoffCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_LIVE_HANDOFF_BASE_URL ?? "http://127.0.0.1:3000";
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const runtimeDir = path.join(artifactsDir, "runtime");
const receiptPath = path.join(artifactsDir, "live-product-handoff.json");

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function push(checks: LiveHandoffCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readLocalJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

async function readRemoteJson<T>(route: string) {
  const response = await fetch(new URL(route, baseUrl));
  const text = await response.text();
  let json: T | null = null;

  try {
    json = JSON.parse(text) as T;
  } catch {
    // The check evidence reports non-JSON responses below.
  }

  return { response, text, json };
}

function verificationRuntimeNames() {
  if (!fs.existsSync(runtimeDir)) {
    return [];
  }

  return fs
    .readdirSync(runtimeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^product-runtime-verify-\d+(?:-\d+)?$/.test(name) || /^verify-standalone(?:-\d+)?$/.test(name))
    .sort((left, right) => left.localeCompare(right));
}

function runtimeNames() {
  if (!fs.existsSync(runtimeDir)) {
    return [];
  }

  return fs
    .readdirSync(runtimeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function writeReceipt(status: "running" | "passed" | "failed", checks: LiveHandoffCheck[]) {
  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "live_product_handoff_receipt_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: `npm run verify:live-handoff -- --base-url ${baseUrl}`,
    baseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    runtimeDir: path.join("artifacts", "productization", "runtime"),
    runtimeNames: runtimeNames(),
    verificationRuntimeNames: verificationRuntimeNames(),
    passed,
    total: checks.length,
    checks,
    nextAction:
      status === "passed"
        ? "Hand off http://127.0.0.1:3000/handoff for manual review; do not claim release readiness until human acceptance, real model, and packaging gates pass."
        : "Fix failed live handoff checks, then rerun npm run verify:live-handoff."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receipt;
}

async function main() {
  writeReceipt("running", []);

  const checks: LiveHandoffCheck[] = [];
  const health = await readRemoteJson<{ responseMode?: string; status?: string; passed?: number; total?: number }>(
    "/api/health"
  );
  const readiness = await readRemoteJson<{
    responseMode?: string;
    status?: string;
    missingArtifacts?: string[];
    runtimeArtifactCleanup?: { status?: string; mode?: string; failedCount?: number; protectedRuntimeNames?: string[] };
    productTrialPacket?: { status?: string; includedFileCount?: number; accepted?: boolean; packagingGated?: boolean };
    handoffGate?: { status?: string; passed?: number; total?: number };
    manualAcceptance?: { humanAcceptanceStatus?: string; latestSaved?: boolean };
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
  }>("/api/product-readiness");
  const releaseReadiness = await readRemoteJson<{
    responseMode?: string;
    status?: string;
    latest?: { responseMode?: string; status?: string; releaseDecision?: string; blockers?: Array<{ name?: string }> };
    trialReadinessIsReleaseReadiness?: boolean;
  }>("/api/product-release-readiness");
  const ai = await readRemoteJson<{ responseMode?: string; activeProvider?: string; realModelReady?: boolean }>(
    "/api/ai-service-status"
  );

  const handoff = readLocalJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-handoff-readiness.json"
  );
  const doctor = readLocalJson<{ status?: string; baseUrl?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-runtime-doctor.json"
  );
  const runtimeCleanup = readLocalJson<{
    responseMode?: string;
    status?: string;
    mode?: string;
    failedCount?: number;
    protectedRuntimeNames?: string[];
  }>("artifacts/productization/runtime-artifact-cleanup.json");
  const packet = readLocalJson<{
    responseMode?: string;
    status?: string;
    includedFiles?: Array<{ destination?: string }>;
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("artifacts/productization/product-trial-packet/product-trial-manifest.json");

  const staleVerificationRuntimes = verificationRuntimeNames();
  const allRuntimeNames = runtimeNames();

  push(
    checks,
    "Live health endpoint is healthy",
    health.response.status === 200 &&
      health.json?.responseMode === "product_health_json_v1" &&
      health.json.status === "healthy",
    `status=${health.response.status}; health=${health.json?.status ?? "non_json"}; checks=${
      health.json?.passed ?? "?"
    }/${health.json?.total ?? "?"}`
  );

  push(
    checks,
    "Live readiness is ready for human acceptance",
    readiness.response.status === 200 &&
      readiness.json?.responseMode === "product_readiness_json_v1" &&
      readiness.json.status === "ready_for_human_acceptance" &&
      readiness.json.missingArtifacts?.length === 0 &&
      readiness.json.handoffGate?.status === "passed" &&
      readiness.json.manualAcceptance?.latestSaved === true &&
      readiness.json.packagingBoundary?.accepted === false &&
      readiness.json.packagingBoundary.packagingGated === true,
    `status=${readiness.response.status}; readiness=${readiness.json?.status ?? "non_json"}; missingArtifacts=${
      readiness.json?.missingArtifacts?.length ?? "?"
    }; handoff=${readiness.json?.handoffGate?.status ?? "?"}; humanAcceptance=${
      readiness.json?.manualAcceptance?.humanAcceptanceStatus ?? "?"
    }`
  );

  push(
    checks,
    "Release endpoint keeps release blocked",
    releaseReadiness.response.status === 200 &&
      releaseReadiness.json?.responseMode === "product_release_readiness_latest_json_v1" &&
      releaseReadiness.json.latest?.status === "blocked_not_release_ready" &&
      releaseReadiness.json.latest.releaseDecision === "do_not_release" &&
      releaseReadiness.json.trialReadinessIsReleaseReadiness === false,
    `status=${releaseReadiness.response.status}; gate=${
      releaseReadiness.json?.latest?.status ?? "non_json"
    }; decision=${releaseReadiness.json?.latest?.releaseDecision ?? "?"}; blockers=${
      releaseReadiness.json?.latest?.blockers?.length ?? "?"
    }`
  );

  push(
    checks,
    "AI provider remains mock and explicit",
    ai.response.status === 200 &&
      ai.json?.responseMode === "ai_service_runtime_status_json_v1" &&
      ai.json.activeProvider === "mock" &&
      ai.json.realModelReady === false,
    `status=${ai.response.status}; activeProvider=${ai.json?.activeProvider ?? "non_json"}; realModelReady=${
      ai.json?.realModelReady ?? "?"
    }`
  );

  push(
    checks,
    "Runtime directory contains only the handoff standalone runtime",
    allRuntimeNames.includes("standalone") && staleVerificationRuntimes.length === 0,
    `runtimeNames=${allRuntimeNames.join(",") || "none"}; verificationRuntimeNames=${
      staleVerificationRuntimes.join(",") || "none"
    }`
  );

  push(
    checks,
    "Runtime cleanup receipt is applied and protected",
    runtimeCleanup?.responseMode === "runtime_artifact_cleanup_receipt_json_v1" &&
      runtimeCleanup.status === "passed" &&
      runtimeCleanup.mode === "apply" &&
      runtimeCleanup.failedCount === 0 &&
      runtimeCleanup.protectedRuntimeNames?.includes("standalone") === true &&
      readiness.json?.runtimeArtifactCleanup?.status === "passed",
    `status=${runtimeCleanup?.status ?? "missing"}; mode=${runtimeCleanup?.mode ?? "missing"}; failed=${
      runtimeCleanup?.failedCount ?? "?"
    }; readinessStatus=${readiness.json?.runtimeArtifactCleanup?.status ?? "?"}`
  );

  push(
    checks,
    "Latest doctor receipt matches the live server",
    doctor?.status === "passed" &&
      doctor.baseUrl === baseUrl &&
      doctor.passed === doctor.total &&
      Number(doctor.total ?? 0) >= 4,
    `status=${doctor?.status ?? "missing"}; baseUrl=${doctor?.baseUrl ?? "missing"}; checks=${
      doctor?.passed ?? "?"
    }/${doctor?.total ?? "?"}`
  );

  push(
    checks,
    "Handoff receipt is green",
    handoff?.status === "passed" && handoff.passed === handoff.total && Number(handoff.total ?? 0) >= 22,
    `status=${handoff?.status ?? "missing"}; checks=${handoff?.passed ?? "?"}/${handoff?.total ?? "?"}`
  );

  push(
    checks,
    "Trial packet has current review-only evidence",
    packet?.responseMode === "product_trial_packet_manifest_json_v1" &&
      packet.status === "built" &&
      packet.packagingBoundary?.accepted === false &&
      packet.packagingBoundary.packagingGated === true &&
      packet.includedFiles?.some((file) => file.destination === "evidence/product-runtime-doctor.json") === true &&
      packet.includedFiles.some((file) => file.destination === "evidence/runtime-artifact-cleanup.json") &&
      packet.includedFiles.some((file) => file.destination === "evidence/product-handoff-readiness.json"),
    `status=${packet?.status ?? "missing"}; files=${packet?.includedFiles?.length ?? 0}; accepted=${
      packet?.packagingBoundary?.accepted ?? "?"
    }; packagingGated=${packet?.packagingBoundary?.packagingGated ?? "?"}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = writeReceipt(passed === checks.length ? "passed" : "failed", checks);
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nLive product handoff receipt written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
