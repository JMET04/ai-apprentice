import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PreflightCheck = {
  name: string;
  pass: boolean;
  evidence: string;
  nextAction?: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "public-beta-tester-session-preflight.json");
const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_PUBLIC_BETA_BASE_URL ?? "http://127.0.0.1:3000";
const preflightStartedAt = new Date().toISOString();

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileExistsWithSize(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function readText(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function push(checks: PreflightCheck[], name: string, pass: boolean, evidence: string, nextAction?: string) {
  checks.push({ name, pass, evidence, nextAction });
}

function hasTesterLaunchGate(gate: {
  requiredImmediatelyBeforeContact?: boolean;
  command?: string;
  evidencePath?: string;
  stopIf?: string;
} | null | undefined) {
  return (
    gate?.requiredImmediatelyBeforeContact === true &&
    gate.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
    gate.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
    gate.stopIf?.includes("Do not contact a tester") === true
  );
}

function freshnessAllowsFirstRealBootstrap(receipt: {
  status?: string;
  releaseDecision?: string;
  allSoftwareObjective?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name?: string; pass?: boolean }>;
}) {
  if (
    receipt.releaseDecision !== "do_not_release" ||
    receipt.allSoftwareObjective !== "paused" ||
    receipt.accepted !== false ||
    receipt.packagingGated !== true ||
    receipt.canRelease !== false ||
    receipt.canActivateRealModel !== false
  ) {
    return false;
  }

  if (receipt.status === "passed" && receipt.passed === receipt.total) {
    return true;
  }

  const failedChecks = (receipt.checks ?? []).filter((check) => check.pass !== true).map((check) => check.name ?? "missing");
  const allowedBootstrapFailures = new Set([
    "First real tester handoff chain is refreshed through final go/no-go",
    "Current status remains bounded beta only, not release ready"
  ]);

  return (
    receipt.status === "failed" &&
    Number(receipt.total ?? 0) >= 16 &&
    failedChecks.length > 0 &&
    failedChecks.every((name) => allowedBootstrapFailures.has(name)) &&
    (receipt.passed ?? 0) + failedChecks.length === receipt.total
  );
}

function expectedFollowUpStatus(collectionStatus: string | undefined) {
  if (collectionStatus === "waiting_for_feedback" || collectionStatus === "ready_for_next_beta_tester") {
    return collectionStatus;
  }
  if (collectionStatus === "has_invalid_feedback") return "invalid_feedback";
  if (collectionStatus === "blocked_by_beta_feedback") return "blocked_by_beta_feedback";
  if (collectionStatus === "needs_fix_before_more_testers") return "needs_fix_before_more_testers";
  return "missing_collection";
}

function generatedAtIsCurrentOrNewer(candidate: string | undefined, source: string | undefined) {
  if (!candidate || !source) return false;
  const candidateTime = Date.parse(candidate);
  const sourceTime = Date.parse(source);
  return Number.isFinite(candidateTime) && Number.isFinite(sourceTime) && candidateTime >= sourceTime;
}

function hasKnownMojibake(text: string) {
  return /浠庢|涓€|浜у|浜哄|楠屶|楠屾|鐪熼|鐪熸|鎺ユ|杩愯|妫€|璇佹|鐘舶|鐘舵|鍏ㄨ|绋冲|鎵撳|瀛﹀|寰掓|瑙勫|绾犻|鍙戝|淇濆|瀹℃|鐢ㄦ|鏌ョ|鍒涘|娴嬭|鏈€|娑撯偓|鐎涳箑|閹|閺|閸|鐠|鐟|閻|娴|濡|瀹|锟|�/.test(
    text
  );
}

async function fetchText(route: string) {
  const response = await fetch(new URL(route, baseUrl));
  const text = await response.text();
  return { response, text };
}

async function fetchJson<T>(route: string) {
  const response = await fetch(new URL(route, baseUrl));
  const json = (await response.json()) as T;
  return { response, json };
}

function writeReceipt(checks: PreflightCheck[], statusOverride?: "running" | "passed" | "failed") {
  const passed = checks.filter((check) => check.pass).length;
  const status = statusOverride ?? (passed === checks.length ? "passed" : "failed");
  const receipt = {
    responseMode: "public_beta_tester_session_preflight_json_v1",
    status,
    startedAt: preflightStartedAt,
    generatedAt: new Date().toISOString(),
    command: `npm run preflight:public-beta-tester -- --base-url ${baseUrl}`,
    baseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    canInviteTester: status === "passed",
    passed,
    total: checks.length,
    checks,
    nextAction:
      status === "passed"
        ? "Send the public beta invite and packet to one bounded tester only after this preflight has checked the current feedback collection; keep release blocked."
        : "Fix failed preflight checks before contacting a beta tester."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receipt;
}

async function main() {
  const checks: PreflightCheck[] = [];
  writeReceipt(checks, "running");

  const publicBetaReadiness = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    passed?: number;
    total?: number;
    generatedAt?: string;
  }>("artifacts/productization/public-beta-readiness.json");
  const productizationEvidenceFreshness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    checks?: Array<{ name?: string; pass?: boolean }>;
    passed?: number;
    total?: number;
    generatedAt?: string;
  }>("artifacts/productization/productization-evidence-freshness.json");
  const testerInvite = readJson<{
    responseMode?: string;
    status?: string;
    canInvite?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    generatedAt?: string;
  }>("artifacts/productization/public-beta-tester-invite.json");
  const testerInviteVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    generatedAt?: string;
  }>("artifacts/productization/public-beta-tester-invite-verification.json");
  const feedbackCollection = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    totalReceipts?: number;
    validReceipts?: number;
    invalidReceipts?: number;
    testerLaunchGate?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      stopIf?: string;
    } | null;
  }>("artifacts/productization/public-beta-feedback-collection.json");
  const feedbackCollectionVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
    generatedAt?: string;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const followUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    sourceCollectionPath?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    testerLaunchGate?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      stopIf?: string;
    } | null;
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const returnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-return-intake-verification.json");
  const packetManifest = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const testerRunbookText = readText("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md");
  const testerInviteText = readText("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_INVITE.md");

  push(
    checks,
    "Public beta readiness is green",
    publicBetaReadiness?.responseMode === "public_beta_readiness_receipt_json_v1" &&
      publicBetaReadiness.status === "passed" &&
      publicBetaReadiness.betaCanStart === true &&
      publicBetaReadiness.releaseDecision === "do_not_release" &&
      publicBetaReadiness.passed === publicBetaReadiness.total &&
      Number(publicBetaReadiness.total ?? 0) >= 23,
    `status=${publicBetaReadiness?.status ?? "missing"}; betaCanStart=${
      publicBetaReadiness?.betaCanStart ?? "missing"
    }; checks=${publicBetaReadiness?.passed ?? "?"}/${publicBetaReadiness?.total ?? "?"}`,
    "Run npm run verify:public-beta."
  );

  const freshnessFailedChecks = (productizationEvidenceFreshness?.checks ?? [])
    .filter((check) => check.pass !== true)
    .map((check) => check.name ?? "missing");
  push(
    checks,
    "Productization evidence freshness is green or only waiting on first-real tester bootstrap",
    productizationEvidenceFreshness?.responseMode === "productization_evidence_freshness_json_v1" &&
      freshnessAllowsFirstRealBootstrap(productizationEvidenceFreshness),
    `status=${productizationEvidenceFreshness?.status ?? "missing"}; checks=${
      productizationEvidenceFreshness?.passed ?? "?"
    }/${productizationEvidenceFreshness?.total ?? "?"}; release=${
      productizationEvidenceFreshness?.releaseDecision ?? "missing"
    }; allowedBootstrapFailures=${freshnessFailedChecks.join(",") || "none"}`,
    "Run npm run verify:productization-evidence-freshness; before first real contact, only the first-real bootstrap checks may remain pending."
  );

  push(
    checks,
    "Tester invite is ready and locked",
    testerInvite?.responseMode === "public_beta_tester_invite_json_v1" &&
      testerInvite.status === "ready_to_invite" &&
      testerInvite.canInvite === true &&
      (testerInvite.failedReasons?.length ?? -1) === 0 &&
      testerInvite.releaseDecision === "do_not_release" &&
      testerInvite.accepted === false &&
      testerInvite.packagingGated === true &&
      testerInviteVerification?.responseMode === "public_beta_tester_invite_verification_json_v1" &&
      testerInviteVerification.status === "passed" &&
      testerInviteVerification.passed === testerInviteVerification.total &&
      testerInviteVerification.releaseDecision === "do_not_release",
    `invite=${testerInvite?.status ?? "missing"}; canInvite=${testerInvite?.canInvite ?? "missing"}; verification=${
      testerInviteVerification?.status ?? "missing"
    } ${testerInviteVerification?.passed ?? "?"}/${testerInviteVerification?.total ?? "?"}`,
    "Run npm run build:public-beta-tester-invite and npm run verify:public-beta-tester-invite."
  );

  const expectedPlanStatus = expectedFollowUpStatus(feedbackCollection?.status);
  push(
    checks,
    "Feedback collection allows tester intake and is verified",
    feedbackCollection?.responseMode === "public_beta_feedback_collection_json_v1" &&
      ["waiting_for_feedback", "ready_for_next_beta_tester"].includes(feedbackCollection.status ?? "") &&
      feedbackCollection.releaseDecision === "do_not_release" &&
      feedbackCollection.reviewOnly === true &&
      feedbackCollection.accepted === false &&
      feedbackCollection.packagingGated === true &&
      hasTesterLaunchGate(feedbackCollection.testerLaunchGate) &&
      feedbackCollectionVerification?.responseMode === "public_beta_feedback_collection_verification_json_v1" &&
      feedbackCollectionVerification.status === "passed" &&
      feedbackCollectionVerification.passed === feedbackCollectionVerification.total &&
      Number(feedbackCollectionVerification.total ?? 0) >= 7 &&
      feedbackCollectionVerification.releaseDecision === "do_not_release" &&
      feedbackCollectionVerification.accepted === false &&
      feedbackCollectionVerification.packagingGated === true,
    `collection=${feedbackCollection?.status ?? "missing"}; valid=${feedbackCollection?.validReceipts ?? "?"}; invalid=${
      feedbackCollection?.invalidReceipts ?? "?"
    }; verifier=${feedbackCollectionVerification?.status ?? "missing"} ${feedbackCollectionVerification?.passed ?? "?"}/${
      feedbackCollectionVerification?.total ?? "?"
    }`,
    "Run npm run collect:public-beta-feedback and npm run verify:public-beta-feedback-collection."
  );

  push(
    checks,
    "Follow-up plan matches the current feedback collection",
    followUpPlan?.responseMode === "public_beta_follow_up_plan_json_v1" &&
      followUpPlan.status === expectedPlanStatus &&
      ["waiting_for_feedback", "ready_for_next_beta_tester"].includes(followUpPlan.status ?? "") &&
      followUpPlan.canInviteNextTester === true &&
      followUpPlan.sourceCollectionPath === "artifacts/productization/public-beta-feedback-collection.json" &&
      generatedAtIsCurrentOrNewer(followUpPlan.generatedAt, feedbackCollection?.generatedAt) &&
      hasTesterLaunchGate(followUpPlan.testerLaunchGate) &&
      followUpPlan.releaseDecision === "do_not_release" &&
      followUpPlan.accepted === false &&
      followUpPlan.packagingGated === true,
    `plan=${followUpPlan?.status ?? "missing"}; expected=${expectedPlanStatus}; canInvite=${
      followUpPlan?.canInviteNextTester ?? "missing"
    }; collectionGenerated=${feedbackCollection?.generatedAt ?? "missing"}; planGenerated=${
      followUpPlan?.generatedAt ?? "missing"
    }`,
    "Run npm run plan:public-beta-follow-up after collecting current feedback."
  );

  push(
    checks,
    "Preflight run is newer than invite and beta planning evidence",
    generatedAtIsCurrentOrNewer(preflightStartedAt, productizationEvidenceFreshness?.generatedAt) &&
      generatedAtIsCurrentOrNewer(preflightStartedAt, testerInvite?.generatedAt) &&
      generatedAtIsCurrentOrNewer(preflightStartedAt, testerInviteVerification?.generatedAt) &&
      generatedAtIsCurrentOrNewer(preflightStartedAt, feedbackCollection?.generatedAt) &&
      generatedAtIsCurrentOrNewer(preflightStartedAt, feedbackCollectionVerification?.generatedAt) &&
      generatedAtIsCurrentOrNewer(preflightStartedAt, followUpPlan?.generatedAt),
    `started=${preflightStartedAt}; freshness=${productizationEvidenceFreshness?.generatedAt ?? "missing"}; invite=${
      testerInvite?.generatedAt ?? "missing"
    }; inviteVerification=${testerInviteVerification?.generatedAt ?? "missing"}; collection=${
      feedbackCollection?.generatedAt ?? "missing"
    }; collectionVerification=${feedbackCollectionVerification?.generatedAt ?? "missing"}; followUp=${
      followUpPlan?.generatedAt ?? "missing"
    }`,
    "Run npm run collect:public-beta-feedback, npm run verify:public-beta-feedback-collection, npm run plan:public-beta-follow-up, npm run build:public-beta-tester-invite, and npm run verify:public-beta-tester-invite before this preflight."
  );

  push(
    checks,
    "Returned tester feedback intake is verified",
    returnIntakeVerification?.responseMode === "public_beta_return_intake_verification_json_v1" &&
      returnIntakeVerification.status === "passed" &&
      returnIntakeVerification.passed === returnIntakeVerification.total &&
      Number(returnIntakeVerification.total ?? 0) >= 3 &&
      returnIntakeVerification.releaseDecision === "do_not_release" &&
      returnIntakeVerification.accepted === false &&
      returnIntakeVerification.packagingGated === true,
    `status=${returnIntakeVerification?.status ?? "missing"}; checks=${returnIntakeVerification?.passed ?? "?"}/${
      returnIntakeVerification?.total ?? "?"
    }`,
    "Run npm run verify:public-beta-return-intake."
  );

  push(
    checks,
    "Public beta packet files are present",
    packetManifest?.responseMode === "public_beta_packet_manifest_json_v1" &&
      packetManifest.status === "ready_for_public_beta" &&
      packetManifest.betaCanStart === true &&
      packetManifest.releaseDecision === "do_not_release" &&
      packetManifest.packagingBoundary?.accepted === false &&
      packetManifest.packagingBoundary.packagingGated === true &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md", 100) &&
      fileExistsWithSize(
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
        100
      ) &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_INVITE.md", 500) &&
      testerInviteText.includes("Send the tester") &&
      testerInviteText.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") &&
      testerInviteText.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer") &&
      !testerInviteText.includes("return both JSON receipts") &&
      testerRunbookText.includes("Facilitator-filled whole-session receipt JSON from `docs/PUBLIC_BETA_SESSION_RECEIPT.template.json`") &&
      testerRunbookText.includes("facilitator/maintainer fills the whole-session receipt") ,
    `packet=${packetManifest?.status ?? "missing"}; sessionReceiptFacilitator=${testerRunbookText.includes("Facilitator-filled whole-session receipt JSON from `docs/PUBLIC_BETA_SESSION_RECEIPT.template.json`") && testerRunbookText.includes("facilitator/maintainer fills the whole-session receipt")}; inviteRoleSplit=${testerInviteText.includes("Send the tester") && testerInviteText.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") && testerInviteText.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer") && !testerInviteText.includes("return both JSON receipts")}; start=${fileExistsWithSize(
      "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      100
    )}; invite=${fileExistsWithSize(
      "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_INVITE.md",
      500
    )}`,
    "Run npm run package:public-beta."
  );

  const health = await fetchJson<{ responseMode?: string; status?: string; passed?: number; total?: number }>("/api/health");
  push(
    checks,
    "Live product health is green",
    health.response.status === 200 &&
      health.json.responseMode === "product_health_json_v1" &&
      health.json.status === "healthy" &&
      health.json.passed === health.json.total,
    `status=${health.response.status}; health=${health.json.status}; checks=${health.json.passed}/${health.json.total}`,
    "Start the product with npm run start:product -- --hostname 127.0.0.1 --port 3000."
  );

  const readiness = await fetchJson<{
    responseMode?: string;
    status?: string;
    handoffGate?: { status?: string; passed?: number; total?: number };
    publicBetaReadiness?: { status?: string; betaCanStart?: boolean; passed?: number; total?: number };
    publicBetaTesterInvite?: { status?: string; canInvite?: boolean };
    publicBetaReturnIntakeVerification?: { status?: string; passed?: number; total?: number };
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("/api/product-readiness");
  push(
    checks,
    "Live readiness exposes beta invite state",
    readiness.response.status === 200 &&
      readiness.json.responseMode === "product_readiness_json_v1" &&
      readiness.json.status === "ready_for_human_acceptance" &&
      readiness.json.handoffGate?.status === "passed" &&
      readiness.json.handoffGate.passed === readiness.json.handoffGate.total &&
      readiness.json.publicBetaReadiness?.status === "passed" &&
      readiness.json.publicBetaReadiness.betaCanStart === true &&
      readiness.json.publicBetaTesterInvite?.status === "ready_to_invite" &&
      readiness.json.publicBetaTesterInvite.canInvite === true &&
      readiness.json.publicBetaReturnIntakeVerification?.status === "passed" &&
      readiness.json.packagingBoundary?.accepted === false &&
      readiness.json.packagingBoundary.packagingGated === true,
    `readiness=${readiness.json.status}; handoff=${readiness.json.handoffGate?.passed ?? "?"}/${
      readiness.json.handoffGate?.total ?? "?"
    }; beta=${readiness.json.publicBetaReadiness?.passed ?? "?"}/${readiness.json.publicBetaReadiness?.total ?? "?"}`,
    "Run npm run prepare:public-beta -- --base-url <url>."
  );

  const release = await fetchJson<{
    responseMode?: string;
    status?: string;
    latest?: {
      status?: string;
      releaseDecision?: string;
      blockers?: unknown[];
      boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
    };
  }>("/api/product-release-readiness");
  push(
    checks,
    "Live release gate remains blocked",
    release.response.status === 200 &&
      release.json.responseMode === "product_release_readiness_latest_json_v1" &&
      release.json.latest?.status === "blocked_not_release_ready" &&
      release.json.latest.releaseDecision === "do_not_release" &&
      release.json.latest.boundary?.accepted === false &&
      release.json.latest.boundary.packagingGated === true &&
      Number(release.json.latest.blockers?.length ?? 0) >= 3,
    `status=${release.json.latest?.status ?? "missing"}; decision=${
      release.json.latest?.releaseDecision ?? "missing"
    }; blockers=${release.json.latest?.blockers?.length ?? "?"}`,
    "Run npm run verify:product-release-readiness -- --allow-blocked."
  );

  const requiredPages = [
    { route: "/public-beta", marker: "Feedback Receipt Builder" },
    { route: "/handoff", marker: "Product handoff state" },
    { route: "/tasks/task-photo-travel-journal/run", marker: "Generate transparent run" },
    { route: "/manual-test", marker: "Manual test entry" }
  ];
  const pageResults = await Promise.all(
    requiredPages.map(async (page) => {
      const result = await fetchText(page.route);
      return {
        ...page,
        status: result.response.status,
        hasMarker: result.text.includes(page.marker),
        hasMojibake: hasKnownMojibake(result.text)
      };
    })
  );
  const badPages = pageResults.filter((page) => page.status !== 200 || !page.hasMarker || page.hasMojibake);
  push(
    checks,
    "Tester-facing pages are reachable and readable",
    badPages.length === 0,
    pageResults
      .map((page) => `${page.route}: status=${page.status}; marker=${page.hasMarker}; mojibake=${page.hasMojibake}`)
      .join(" | "),
    "Fix the running product pages before inviting a tester."
  );

  const receipt = writeReceipt(checks);
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nPublic beta tester session preflight written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
