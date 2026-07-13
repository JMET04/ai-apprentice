import fs from "node:fs";
import path from "node:path";

type Check = {
  name: string;
  pass: boolean;
  evidence: string;
};

type LocalCiReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  command?: string;
  baseUrl?: string;
  startedRuntime?: boolean;
  releaseDecision?: string;
  allSoftwareObjective?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
};

type PackageJson = {
  scripts?: Record<string, string>;
};

type FreshnessReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
};

type HumanAcceptancePreflight = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  baseUrl?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canStartHumanAcceptance?: boolean;
  passed?: number;
  total?: number;
};

type PublicBetaTesterPreflight = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  baseUrl?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canInviteTester?: boolean;
  passed?: number;
  total?: number;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "productization-ci-local.json");
const verificationPath = path.join(artifactsDir, "productization-ci-local-verification.json");
const freshnessPath = path.join(artifactsDir, "productization-evidence-freshness.json");
const packageJsonPath = path.join(rootDir, "package.json");
const runnerPath = path.join(rootDir, "scripts", "run-productization-ci.ts");
const workflowPath = path.join(rootDir, ".github", "workflows", "productization-ci.yml");

function readJson<T>(fullPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(fullPath: string) {
  try {
    return fs.readFileSync(fullPath, "utf8");
  } catch {
    return "";
  }
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function scriptHasProductizationGates(script: string | undefined) {
  const text = script ?? "";
  return (
    text.includes("npm run typecheck") &&
    text.includes("npm run test") &&
    text.includes("npm run verify:product-release-readiness -- --allow-blocked") &&
    text.includes("npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000") &&
    text.includes("npm run build:product-operator-brief") &&
    text.includes("npm run build:product-status-summary") &&
    text.includes("npm run verify:real-model-adapter-contract") &&
    text.includes("npm run build:real-model-trial-kit") &&
    text.includes("npm run verify:real-model-trial-kit") &&
    text.includes("npm run build:real-model-trial-receipt-template") &&
    text.includes("npm run verify:real-model-trial-receipt") &&
    text.includes("npm run verify:real-model-trial-return-intake") &&
    text.includes("npm run verify:productization-evidence-freshness") &&
    text.includes("npm run harden:productization-locks") &&
    text.includes("npm run audit:productization-lock-coverage") &&
    text.includes("npm run package:product-trial") &&
    text.includes("npm run verify:product-trial") &&
    text.includes("npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000") &&
    text.includes("npm run package:public-beta") &&
    text.includes("npm run verify:public-beta") &&
    text.includes("npm run build:first-real-tester-launch") &&
    text.includes("npm run verify:first-real-tester-launch") &&
    text.includes("npm run package:github-source") === false &&
    text.includes("npm run verify:github-source") === false &&
    text.includes("AI_PROVIDER") === false
  );
}

function main() {
  const packageJson = readJson<PackageJson>(packageJsonPath);
  const receipt = readJson<LocalCiReceipt>(receiptPath);
  const freshness = readJson<FreshnessReceipt>(freshnessPath);
  const humanPreflight = readJson<HumanAcceptancePreflight>(path.join(artifactsDir, "human-acceptance-session-preflight.json"));
  const publicBetaPreflight = readJson<PublicBetaTesterPreflight>(
    path.join(artifactsDir, "public-beta-tester-session-preflight.json")
  );
  const runnerText = readText(runnerPath);
  const workflowText = readText(workflowPath);
  const gatesScript = packageJson?.scripts?.["ci:productization:gates"];
  const checks: Check[] = [];

  push(
    checks,
    "Local productization CI scripts are self-contained and bounded",
    packageJson?.scripts?.["ci:productization"]?.endsWith("tsx scripts/run-productization-ci.ts") === true &&
      packageJson.scripts?.["verify:productization-ci-local"]?.endsWith(
        "tsx scripts/verify-productization-ci-local.ts"
      ) === true &&
      scriptHasProductizationGates(gatesScript),
    `ci=${packageJson?.scripts?.["ci:productization"] ?? "missing"}; verify=${
      packageJson?.scripts?.["verify:productization-ci-local"] ?? "missing"
    }; gates=${scriptHasProductizationGates(gatesScript)}`
  );

  push(
    checks,
    "Local productization runner checks product health before gates and finalizes handoff package",
    fs.existsSync(runnerPath) &&
      runnerText.includes("/api/health") &&
      runnerText.includes("product_health_json_v1") &&
      runnerText.includes("productizationGateCommands(baseUrl") &&
      runnerText.includes("runProductizationGates(baseUrl)") &&
      runnerText.includes("preflight:human-acceptance") &&
      runnerText.includes("preflight:public-beta-tester") &&
      runnerText.includes("--base-url") &&
      runnerText.includes("stopProcess(runtime)") &&
      runnerText.includes("Product runtime did not become healthy before productization gates") &&
      runnerText.includes("finalizeHandoffPackage") &&
      runnerText.includes("verify:productization-ci-local") &&
      runnerText.includes("stage GitHub source package after local CI receipt") &&
      runnerText.includes("verify takeover entry against staged GitHub source package") &&
      runnerText.includes("rebuild final GitHub source package after staged takeover entry scan") &&
      runnerText.includes("verify dependency-free new repository bootstrap from staged source") &&
      runnerText.includes("verify:product-takeover-entry") &&
      runnerText.includes("package:github-source") &&
      runnerText.includes("verify:github-source") &&
      runnerText.includes("verify:new-repo-bootstrap"),
    `runner=${fs.existsSync(runnerPath)}; health=${runnerText.includes("/api/health")}; dynamicGates=${runnerText.includes("runProductizationGates(baseUrl)")}; cleanup=${runnerText.includes("stopProcess(runtime)")}; finalPackage=${
      runnerText.includes("finalizeHandoffPackage") &&
      runnerText.includes("stage GitHub source package after local CI receipt") &&
      runnerText.includes("verify takeover entry against staged GitHub source package") &&
      runnerText.includes("rebuild final GitHub source package after staged takeover entry scan") &&
      runnerText.includes("verify:github-source") &&
      runnerText.includes("verify:new-repo-bootstrap")
    }`
  );

  push(
    checks,
    "GitHub workflow verifies reproducible core runtime and safety boundaries",
    workflowText.includes("name: Core Product CI") &&
      workflowText.includes("Invoke-RestMethod") &&
      workflowText.includes("http://127.0.0.1:3000/api/health") &&
      workflowText.includes("product_health_json_v1") &&
      workflowText.includes("npm run typecheck") &&
      workflowText.includes("npm test") &&
      workflowText.includes("npm run verify:manual-acceptance-classification") &&
      workflowText.includes("npm run verify:real-model-adapter-contract") &&
      workflowText.includes("Packaging boundary remains locked") &&
      !workflowText.includes("npm run ci:productization:gates") &&
      !workflowText.includes("run: npm run ci:productization\n"),
    `coreWorkflow=${workflowText.includes("name: Core Product CI")}; healthWait=${workflowText.includes(
      "Invoke-RestMethod"
    )}; classification=${workflowText.includes("npm run verify:manual-acceptance-classification")}; adapterLocks=${workflowText.includes(
      "npm run verify:real-model-adapter-contract"
    )}; productizationGates=${workflowText.includes("npm run ci:productization:gates")}`
  );

  const receiptChecks = receipt?.checks ?? [];
  const buildOrSkip = receiptChecks.some(
    (check) => check.pass === true && ["Product runtime build completed", "Product runtime build skipped by caller"].includes(check.name ?? "")
  );
  const healthCheck = receiptChecks.some(
    (check) => check.pass === true && ["Existing product runtime is healthy", "Started product runtime is healthy"].includes(check.name ?? "")
  );
  const gatesCompleted = receiptChecks.some(
    (check) =>
      check.pass === true &&
      check.name === "Productization gates completed" &&
      check.evidence?.includes("dynamic productization gates completed with baseUrl=") === true &&
      (receipt?.baseUrl ? check.evidence.includes(receipt.baseUrl) : false)
  );

  push(
    checks,
    "Local productization CI receipt is passed and complete",
    receipt?.responseMode === "productization_ci_local_receipt_json_v1" &&
      receipt.status === "passed" &&
      receipt.command === "npm run ci:productization" &&
      /^http:\/\//.test(receipt.baseUrl ?? "") &&
      receipt.passed === receipt.total &&
      Number(receipt.total ?? 0) >= 3 &&
      buildOrSkip &&
      healthCheck &&
      gatesCompleted,
    `status=${receipt?.status ?? "missing"}; checks=${receipt?.passed ?? "?"}/${receipt?.total ?? "?"}; buildOrSkip=${buildOrSkip}; health=${healthCheck}; gates=${gatesCompleted}`
  );

  const receiptMs = timestampMs(receipt?.generatedAt);
  const freshnessMs = timestampMs(freshness?.generatedAt);
  push(
    checks,
    "Local productization CI receipt is at least as fresh as productization evidence",
    Number.isFinite(receiptMs) &&
      Number.isFinite(freshnessMs) &&
      receiptMs >= freshnessMs &&
      freshness?.responseMode === "productization_evidence_freshness_json_v1" &&
      freshness.status === "passed",
    `ci=${receipt?.generatedAt ?? "missing"}; freshness=${freshness?.generatedAt ?? "missing"}; freshnessStatus=${
      freshness?.status ?? "missing"
    }`
  );

  const humanPreflightMs = timestampMs(humanPreflight?.generatedAt);
  push(
    checks,
    "Local productization CI refreshes live human acceptance preflight during the CI run",
    humanPreflight?.responseMode === "human_acceptance_session_preflight_json_v1" &&
      humanPreflight.status === "passed" &&
      humanPreflight.baseUrl === receipt?.baseUrl &&
      humanPreflight.canStartHumanAcceptance === true &&
      humanPreflight.releaseDecision === "do_not_release" &&
      humanPreflight.accepted === false &&
      humanPreflight.packagingGated === true &&
      humanPreflight.passed === humanPreflight.total &&
      Number.isFinite(humanPreflightMs) &&
      Number.isFinite(timestampMs(receipt?.startedAt)) &&
      humanPreflightMs >= timestampMs(receipt?.startedAt),
    `status=${humanPreflight?.status ?? "missing"}; checks=${humanPreflight?.passed ?? "?"}/${
      humanPreflight?.total ?? "?"
    }; preflight=${humanPreflight?.generatedAt ?? "missing"}; ciStarted=${receipt?.startedAt ?? "missing"}`
  );
  const publicBetaPreflightMs = timestampMs(publicBetaPreflight?.generatedAt);
  push(
    checks,
    "Local productization CI refreshes live public beta tester preflight against the same base URL",
    publicBetaPreflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      publicBetaPreflight.status === "passed" &&
      publicBetaPreflight.baseUrl === receipt?.baseUrl &&
      publicBetaPreflight.canInviteTester === true &&
      publicBetaPreflight.releaseDecision === "do_not_release" &&
      publicBetaPreflight.accepted === false &&
      publicBetaPreflight.packagingGated === true &&
      publicBetaPreflight.passed === publicBetaPreflight.total &&
      Number.isFinite(publicBetaPreflightMs) &&
      Number.isFinite(timestampMs(receipt?.startedAt)) &&
      publicBetaPreflightMs >= timestampMs(receipt?.startedAt),
    `status=${publicBetaPreflight?.status ?? "missing"}; checks=${publicBetaPreflight?.passed ?? "?"}/${
      publicBetaPreflight?.total ?? "?"
    }; preflight=${publicBetaPreflight?.generatedAt ?? "missing"}; baseUrl=${
      publicBetaPreflight?.baseUrl ?? "missing"
    }; ciBaseUrl=${receipt?.baseUrl ?? "missing"}`
  );

  push(
    checks,
    "Local productization CI preserves release locks",
    receipt?.releaseDecision === "do_not_release" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.accepted === false &&
      receipt.packagingGated === true,
    `release=${receipt?.releaseDecision ?? "missing"}; allSoftware=${receipt?.allSoftwareObjective ?? "missing"}; accepted=${
      receipt?.accepted ?? "missing"
    }; packagingGated=${receipt?.packagingGated ?? "missing"}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const report = {
    responseMode: "productization_ci_local_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:productization-ci-local",
    receiptPath: "artifacts/productization/productization-ci-local.json",
    releaseDecision: "do_not_release",
    allSoftwareObjective: "paused",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Local productization CI evidence is verified; npm run ci:productization now stages the GitHub source package, verifies takeover-entry consistency against staged docs, rebuilds the final source package with that receipt, runs the dependency-free new-repository bootstrap check, then verifies the delivery index."
        : "Run npm run ci:productization, then rerun npm run verify:productization-ci-local."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(verificationPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nLocal productization CI verification written to ${verificationPath}`);

  if (report.status !== "passed") process.exitCode = 1;
}

main();
