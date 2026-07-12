import fs from "node:fs";
import path from "node:path";

type PreflightCheck = {
  name: string;
  pass: boolean;
  evidence: string;
  nextAction?: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "human-acceptance-session-preflight.json");
const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_HUMAN_ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3000";

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function push(checks: PreflightCheck[], name: string, pass: boolean, evidence: string, nextAction?: string) {
  checks.push({ name, pass, evidence, ...(nextAction ? { nextAction } : {}) });
}

async function fetchText(pathname: string, init?: RequestInit) {
  const response = await fetch(new URL(pathname, baseUrl), init);
  return {
    response,
    text: await response.text()
  };
}

async function fetchJson<T>(pathname: string, init?: RequestInit) {
  const { response, text } = await fetchText(pathname, init);
  let json: T | null = null;

  try {
    json = JSON.parse(text) as T;
  } catch {
    json = null;
  }

  return { response, json, text };
}

async function main() {
  const checks: PreflightCheck[] = [];

  const health = await fetchJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("/api/health");
  push(
    checks,
    "Live product health is green",
    health.response.status === 200 &&
      health.json?.responseMode === "product_health_json_v1" &&
      health.json.status === "healthy" &&
      health.json.passed === health.json.total,
    `status=${health.response.status}; health=${health.json?.status ?? "missing"}; checks=${health.json?.passed ?? "?"}/${
      health.json?.total ?? "?"
    }`,
    "Start the product with npm run start:product -- --hostname 127.0.0.1 --port 3000."
  );

  const manualPage = await fetchText("/manual-test");
  const manualPageReadable =
    manualPage.text.includes("Manual Review Status") &&
    manualPage.text.includes("Manual test entry") &&
    manualPage.text.includes("Saves human_review evidence") &&
    manualPage.text.includes("automated_browser_smoke") &&
    manualPage.text.includes("Start beta session") &&
    !/娴犲孩|娑撯偓|閻喐|閹恒儲|鐠囦焦/.test(manualPage.text);
  push(
    checks,
    "Manual acceptance workbench is reachable and readable",
    manualPage.response.status === 200 && manualPageReadable,
    `status=${manualPage.response.status}; marker=${manualPageReadable}; bytes=${manualPage.text.length}`,
    "Fix /manual-test before asking a human reviewer to run the acceptance pass."
  );

  const latestManual = await fetchJson<{
    responseMode?: string;
    status?: string;
    latest?: {
      evidenceKind?: string;
      humanReviewed?: boolean;
      automationGenerated?: boolean;
      classificationReason?: string;
      reviewOnly?: boolean;
      accepted?: boolean;
      packagingGated?: boolean;
    };
  }>("/api/manual-acceptance-reports");
  const latestStatusAllowed =
    latestManual.response.status === 404 ||
    (latestManual.response.status === 200 &&
      latestManual.json?.responseMode === "manual_acceptance_latest_receipt_json_v1" &&
      latestManual.json.status === "saved" &&
      latestManual.json.latest?.reviewOnly === true &&
      latestManual.json.latest.accepted === false &&
      latestManual.json.latest.packagingGated === true);
  push(
    checks,
    "Manual acceptance latest evidence is classified and locked",
    latestStatusAllowed,
    `status=${latestManual.response.status}; latest=${
      latestManual.json?.latest?.evidenceKind ?? latestManual.json?.status ?? "not_saved_yet"
    }; humanReviewed=${latestManual.json?.latest?.humanReviewed ?? "missing"}; accepted=${
      latestManual.json?.latest?.accepted ?? "missing"
    }`,
    "Use /manual-test to save real human_review evidence after the reviewer completes the checklist."
  );

  const rejectedSaveProbe = await fetchJson<{ error?: string }>("/api/manual-acceptance-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  push(
    checks,
    "Manual acceptance API rejects incomplete saves without creating human evidence",
    rejectedSaveProbe.response.status === 400 && rejectedSaveProbe.json?.error === "Missing report.",
    `status=${rejectedSaveProbe.response.status}; error=${rejectedSaveProbe.json?.error ?? "missing"}`,
    "Keep incomplete reports out of the acceptance history."
  );

  const readiness = await fetchJson<{
    responseMode?: string;
    status?: string;
    manualAcceptance?: {
      saveEndpoint?: string;
      humanAcceptanceStatus?: string;
      latestEvidenceKind?: string;
      latestHumanReviewed?: boolean;
      reviewOnly?: boolean;
      accepted?: boolean;
      packagingGated?: boolean;
    };
  }>("/api/product-readiness");
  push(
    checks,
    "Product readiness exposes the human acceptance state",
    readiness.response.status === 200 &&
      readiness.json?.responseMode === "product_readiness_json_v1" &&
      readiness.json.manualAcceptance?.saveEndpoint === "/api/manual-acceptance-reports" &&
      ["needs_real_human_review", "human_review_saved"].includes(
        readiness.json.manualAcceptance.humanAcceptanceStatus ?? ""
      ) &&
      readiness.json.manualAcceptance.reviewOnly === true &&
      readiness.json.manualAcceptance.accepted === false &&
      readiness.json.manualAcceptance.packagingGated === true,
    `status=${readiness.response.status}; readiness=${readiness.json?.status ?? "missing"}; humanAcceptance=${
      readiness.json?.manualAcceptance?.humanAcceptanceStatus ?? "missing"
    }; latest=${readiness.json?.manualAcceptance?.latestEvidenceKind ?? "missing"}`,
    "Run npm run verify:human-acceptance after a real reviewer saves the manual-test evidence."
  );

  const humanGate = await fetchJson<{
    responseMode?: string;
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    releaseBoundary?: { reviewOnly?: boolean; accepted?: boolean; packagingGated?: boolean };
  }>("/api/product-readiness");
  const gateStatus = humanGate.json && "humanAcceptanceGate" in humanGate.json
    ? (humanGate.json as { humanAcceptanceGate?: { status?: string; latestEvidenceKind?: string; latestHumanReviewed?: boolean } })
        .humanAcceptanceGate
    : null;
  push(
    checks,
    "Human acceptance gate remains explicit before the real pass",
    humanGate.response.status === 200 &&
      ["blocked_needs_human_review", "passed"].includes(gateStatus?.status ?? "") &&
      (gateStatus?.status === "passed"
        ? gateStatus.latestEvidenceKind === "human_review" && gateStatus.latestHumanReviewed === true
        : gateStatus?.status === "blocked_needs_human_review"),
    `status=${gateStatus?.status ?? "missing"}; evidenceKind=${gateStatus?.latestEvidenceKind ?? "missing"}; humanReviewed=${
      gateStatus?.latestHumanReviewed ?? "missing"
    }`,
    "Do not claim acceptance until the gate reports passed from real human_review evidence."
  );

  const release = await fetchJson<{
    responseMode?: string;
    latest?: {
      status?: string;
      releaseDecision?: string;
      blockers?: Array<{ name?: string }>;
      boundary?: { accepted?: boolean; packagingGated?: boolean };
    };
  }>("/api/product-release-readiness");
  const latestRelease = release.json?.latest;
  push(
    checks,
    "Release gate stays blocked for missing real acceptance",
    release.response.status === 200 &&
      release.json?.responseMode === "product_release_readiness_latest_json_v1" &&
      latestRelease?.releaseDecision === "do_not_release" &&
      latestRelease.boundary?.accepted === false &&
      latestRelease.boundary.packagingGated === true &&
      (latestRelease.status === "passed" ||
        latestRelease.blockers?.some((blocker) => blocker.name === "Real human acceptance is complete") === true),
    `status=${latestRelease?.status ?? "missing"}; decision=${latestRelease?.releaseDecision ?? "missing"}; blockers=${
      latestRelease?.blockers?.length ?? "?"
    }`,
    "Keep release blocked until real human acceptance, real model acceptance, and packaging approval are explicit."
  );

  const ai = await fetchJson<{
    responseMode?: string;
    activeProvider?: string;
    realModelReady?: boolean;
    safetyBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("/api/ai-service-status");
  push(
    checks,
    "AI provider boundary is explicit for the human reviewer",
    ai.response.status === 200 &&
      ai.json?.responseMode === "ai_service_runtime_status_json_v1" &&
      ai.json.activeProvider === "mock" &&
      ai.json.realModelReady === false &&
      ai.json.safetyBoundary?.accepted === false &&
      ai.json.safetyBoundary.packagingGated === true,
    `status=${ai.response.status}; provider=${ai.json?.activeProvider ?? "missing"}; realModelReady=${
      ai.json?.realModelReady ?? "missing"
    }`,
    "Tell the reviewer this is a mock-model beta unless a real-model trial is separately accepted."
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "human_acceptance_session_preflight_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: `npm run preflight:human-acceptance -- --base-url ${baseUrl}`,
    baseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canStartHumanAcceptance: passed === checks.length,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Ask a real reviewer to run /manual-test, save human_review evidence, then run npm run verify:human-acceptance."
        : "Fix failed preflight checks before asking a human reviewer to run /manual-test."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nHuman acceptance session preflight written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
