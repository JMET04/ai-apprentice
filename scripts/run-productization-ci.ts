import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "productization-ci-local.json");
const demoDatabaseUrl = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

type Check = {
  name: string;
  pass: boolean;
  evidence: string;
};

type GateCommand = {
  label: string;
  args: string[];
};

type HealthPayload = {
  responseMode?: string;
  status?: string;
  passed?: number;
  total?: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const hostIndex = args.indexOf("--hostname");
  const timeoutIndex = args.indexOf("--ready-timeout-ms");

  return {
    host: hostIndex >= 0 ? (args[hostIndex + 1] ?? "127.0.0.1") : "127.0.0.1",
    port: portIndex >= 0 ? (args[portIndex + 1] ?? "3000") : "3000",
    readyTimeoutMs: timeoutIndex >= 0 ? Number(args[timeoutIndex + 1] ?? 60_000) : 60_000,
    skipBuild: args.includes("--skip-build")
  };
}

function commandForNpm(args: string[]) {
  if (process.platform !== "win32") return { command: npmCommand, args };
  return { command: "cmd.exe", args: ["/d", "/s", "/c", npmCommand, ...args] };
}

function runNpm(label: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const actual = commandForNpm(args);
    console.log(`\n[ci:productization] ${label}`);
    const child = spawn(actual.command, actual.args, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: demoDatabaseUrl, PRODUCT_ARTIFACTS_DIR: artifactsDir },
      shell: false,
      stdio: "inherit"
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}`));
    });
    child.once("error", reject);
  });
}


function productizationGateCommands(baseUrl: string): GateCommand[] {
  return [
    { label: "typecheck", args: ["run", "typecheck"] },
    { label: "unit tests", args: ["run", "test"] },
    { label: "collect public beta feedback", args: ["run", "collect:public-beta-feedback"] },
    { label: "verify public beta feedback collection", args: ["run", "verify:public-beta-feedback-collection"] },
    { label: "plan public beta follow-up", args: ["run", "plan:public-beta-follow-up"] },
    { label: "verify public beta follow-up plan", args: ["run", "verify:public-beta-follow-up-plan"] },
    { label: "verify human acceptance return intake", args: ["run", "verify:human-acceptance-return-intake"] },
    { label: "verify real-model trial return intake", args: ["run", "verify:real-model-trial-return-intake"] },
    { label: "verify product release readiness", args: ["run", "verify:product-release-readiness", "--", "--allow-blocked"] },
    {
      label: "preflight human acceptance",
      args: ["run", "preflight:human-acceptance", "--", "--base-url", baseUrl]
    },
    { label: "build human acceptance reviewer kit", args: ["run", "build:human-acceptance-reviewer-kit"] },
    { label: "verify human acceptance reviewer kit", args: ["run", "verify:human-acceptance-reviewer-kit"] },
    { label: "build human acceptance receipt template", args: ["run", "build:human-acceptance-receipt-template"] },
    { label: "verify human acceptance receipt", args: ["run", "verify:human-acceptance-receipt"] },
    { label: "build human acceptance reviewer invite", args: ["run", "build:human-acceptance-reviewer-invite"] },
    { label: "verify human acceptance reviewer invite", args: ["run", "verify:human-acceptance-reviewer-invite"] },
    { label: "build product release blocker board", args: ["run", "build:product-release-blocker-board"] },
    { label: "verify product release blocker board", args: ["run", "verify:product-release-blocker-board"] },
    { label: "verify real-model adapter contract", args: ["run", "verify:real-model-adapter-contract"] },
    { label: "build real-model trial kit", args: ["run", "build:real-model-trial-kit"] },
    { label: "verify real-model trial kit", args: ["run", "verify:real-model-trial-kit"] },
    { label: "build real-model trial receipt template", args: ["run", "build:real-model-trial-receipt-template"] },
    { label: "verify real-model trial receipt", args: ["run", "verify:real-model-trial-receipt"] },
    { label: "build product operator brief", args: ["run", "build:product-operator-brief"] },
    { label: "verify product operator brief", args: ["run", "verify:product-operator-brief"] },
    { label: "build product status summary", args: ["run", "build:product-status-summary"] },
    { label: "verify product status summary", args: ["run", "verify:product-status-summary"] },
    { label: "build product takeover matrix", args: ["run", "build:product-takeover-matrix"] },
    { label: "verify product takeover matrix", args: ["run", "verify:product-takeover-matrix"] },
    { label: "build productization launch checklist", args: ["run", "build:productization-launch-checklist"] },
    { label: "verify productization launch checklist", args: ["run", "verify:productization-launch-checklist"] },
    { label: "harden productization locks before beta packaging", args: ["run", "harden:productization-locks"] },
    { label: "audit productization lock coverage before beta packaging", args: ["run", "audit:productization-lock-coverage"] },
    { label: "build public beta tester invite", args: ["run", "build:public-beta-tester-invite"] },
    { label: "verify public beta tester invite", args: ["run", "verify:public-beta-tester-invite"] },
    { label: "build public beta session plan", args: ["run", "build:public-beta-session-plan"] },
    { label: "verify public beta session plan", args: ["run", "verify:public-beta-session-plan"] },
    { label: "build public beta session receipt template", args: ["run", "build:public-beta-session-receipt-template"] },
    { label: "verify public beta session receipt", args: ["run", "verify:public-beta-session-receipt"] },
    {
      label: "preflight public beta tester before first real bootstrap",
      args: ["run", "preflight:public-beta-tester", "--", "--base-url", baseUrl]
    },
    { label: "harden productization locks before first real tester chain", args: ["run", "harden:productization-locks"] },
    { label: "audit productization lock coverage before first real tester chain", args: ["run", "audit:productization-lock-coverage"] },
    { label: "build first real tester launch", args: ["run", "build:first-real-tester-launch"] },
    { label: "verify first real tester launch", args: ["run", "verify:first-real-tester-launch"] },
    { label: "build first real tester dispatch packet", args: ["run", "build:first-real-tester-dispatch-packet"] },
    { label: "verify first real tester dispatch packet", args: ["run", "verify:first-real-tester-dispatch-packet"] },
    { label: "build first real tester send bundle", args: ["run", "build:first-real-tester-send-bundle"] },
    { label: "verify first real tester send bundle", args: ["run", "verify:first-real-tester-send-bundle"] },
    { label: "build first real tester send receipt template", args: ["run", "build:first-real-tester-send-receipt-template"] },
    { label: "verify first real tester send receipt template", args: ["run", "verify:first-real-tester-send-receipt-template"] },
    {
      label: "preflight public beta tester before first real contact",
      args: ["run", "preflight:public-beta-tester", "--", "--base-url", baseUrl]
    },
    { label: "build first real tester contact readiness", args: ["run", "build:first-real-tester-contact-readiness"] },
    { label: "verify first real tester contact readiness", args: ["run", "verify:first-real-tester-contact-readiness"] },
    { label: "build first real tester send execution brief", args: ["run", "build:first-real-tester-send-execution-brief"] },
    { label: "verify first real tester send execution brief", args: ["run", "verify:first-real-tester-send-execution-brief"] },
    { label: "build first real tester return workbench", args: ["run", "build:first-real-tester-return-workbench"] },
    { label: "verify first real tester return workbench", args: ["run", "verify:first-real-tester-return-workbench"] },
    { label: "build first real tester return gate", args: ["run", "build:first-real-tester-return-gate"] },
    { label: "verify first real tester return gate", args: ["run", "verify:first-real-tester-return-gate"] },
    { label: "build first real tester final go no-go", args: ["run", "build:first-real-tester-final-go-no-go"] },
    { label: "verify first real tester final go no-go", args: ["run", "verify:first-real-tester-final-go-no-go"] },
    { label: "harden productization locks after first real tester chain", args: ["run", "harden:productization-locks"] },
    { label: "audit productization lock coverage after first real tester chain", args: ["run", "audit:productization-lock-coverage"] },
    { label: "verify productization evidence freshness", args: ["run", "verify:productization-evidence-freshness"] },
    {
      label: "preflight public beta tester after final freshness",
      args: ["run", "preflight:public-beta-tester", "--", "--base-url", baseUrl]
    },
    { label: "package product trial", args: ["run", "package:product-trial"] },
    { label: "verify product trial", args: ["run", "verify:product-trial"] },
    { label: "package public beta", args: ["run", "package:public-beta"] },
    { label: "verify public beta", args: ["run", "verify:public-beta"] },
    { label: "rebuild product takeover matrix after final packages", args: ["run", "build:product-takeover-matrix"] },
    { label: "verify product takeover matrix after final packages", args: ["run", "verify:product-takeover-matrix"] },
    { label: "rebuild productization launch checklist after final packages", args: ["run", "build:productization-launch-checklist"] },
    { label: "verify productization launch checklist after final packages", args: ["run", "verify:productization-launch-checklist"] },
    { label: "harden productization locks after final package launch checklist", args: ["run", "harden:productization-locks"] },
    { label: "audit productization lock coverage after final package launch checklist", args: ["run", "audit:productization-lock-coverage"] },
    { label: "rebuild first real tester launch after final packages", args: ["run", "build:first-real-tester-launch"] },
    { label: "verify first real tester launch after final packages", args: ["run", "verify:first-real-tester-launch"] },
    { label: "rebuild first real tester dispatch packet after final packages", args: ["run", "build:first-real-tester-dispatch-packet"] },
    { label: "verify first real tester dispatch packet after final packages", args: ["run", "verify:first-real-tester-dispatch-packet"] },
    { label: "rebuild first real tester send bundle after final packages", args: ["run", "build:first-real-tester-send-bundle"] },
    { label: "verify first real tester send bundle after final packages", args: ["run", "verify:first-real-tester-send-bundle"] },
    { label: "rebuild first real tester send receipt template after final packages", args: ["run", "build:first-real-tester-send-receipt-template"] },
    { label: "verify first real tester send receipt template after final packages", args: ["run", "verify:first-real-tester-send-receipt-template"] },
    {
      label: "preflight public beta tester before final package contact chain",
      args: ["run", "preflight:public-beta-tester", "--", "--base-url", baseUrl]
    },
    { label: "rebuild first real tester contact readiness after final packages", args: ["run", "build:first-real-tester-contact-readiness"] },
    { label: "verify first real tester contact readiness after final packages", args: ["run", "verify:first-real-tester-contact-readiness"] },
    { label: "rebuild first real tester send execution brief after final packages", args: ["run", "build:first-real-tester-send-execution-brief"] },
    { label: "verify first real tester send execution brief after final packages", args: ["run", "verify:first-real-tester-send-execution-brief"] },
    { label: "rebuild first real tester return workbench after final packages", args: ["run", "build:first-real-tester-return-workbench"] },
    { label: "verify first real tester return workbench after final packages", args: ["run", "verify:first-real-tester-return-workbench"] },
    { label: "rebuild first real tester return gate after final packages", args: ["run", "build:first-real-tester-return-gate"] },
    { label: "verify first real tester return gate after final packages", args: ["run", "verify:first-real-tester-return-gate"] },
    { label: "rebuild first real tester final go no-go after final packages", args: ["run", "build:first-real-tester-final-go-no-go"] },
    { label: "verify first real tester final go no-go after final packages", args: ["run", "verify:first-real-tester-final-go-no-go"] },
    { label: "harden productization locks after final first real chain", args: ["run", "harden:productization-locks"] },
    { label: "audit productization lock coverage after final first real chain", args: ["run", "audit:productization-lock-coverage"] },
    { label: "verify productization evidence freshness after final packages", args: ["run", "verify:productization-evidence-freshness"] },
    { label: "verify product takeover entry", args: ["run", "verify:product-takeover-entry"] }
  ];
}

async function runProductizationGates(baseUrl: string) {
  for (const gate of productizationGateCommands(baseUrl)) {
    await runNpm("productization gate: " + gate.label, gate.args);
  }
}

function startRuntime(host: string, port: string) {
  const actual = commandForNpm([
    "run",
    "start:product",
    "--",
    "--hostname",
    host,
    "--port",
    port,
    "--runtime-dir",
    path.join("artifacts", "productization", "runtime", "ci-productization")
  ]);
  const child = spawn(actual.command, actual.args, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: demoDatabaseUrl, PRODUCT_ARTIFACTS_DIR: artifactsDir },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(`[ci:productization:start] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[ci:productization:start] ${chunk}`));
  return child;
}

async function readHealth(baseUrl: string): Promise<{ ok: boolean; status: number; payload: HealthPayload | null; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const text = await response.text();
    let payload: HealthPayload | null = null;
    try {
      payload = JSON.parse(text) as HealthPayload;
    } catch {
      return { ok: false, status: response.status, payload: null, error: text.slice(0, 160) };
    }

    return {
      ok: response.status === 200 && payload.responseMode === "product_health_json_v1" && payload.status === "healthy",
      status: response.status,
      payload
    };
  } catch (error) {
    return { ok: false, status: 0, payload: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function waitForHealthy(baseUrl: string, child: ChildProcess | null, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let last: Awaited<ReturnType<typeof readHealth>> | null = null;

  while (Date.now() < deadline) {
    if (child?.exitCode !== null) {
      throw new Error(`Product runtime exited before becoming healthy with code ${child?.exitCode}`);
    }

    last = await readHealth(baseUrl);
    if (last.ok) return last;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const detail = last?.payload
    ? `status=${last.status}; health=${last.payload.status ?? "missing"}; checks=${last.payload.passed ?? "?"}/${last.payload.total ?? "?"}`
    : `status=${last?.status ?? "missing"}; error=${last?.error ?? "missing"}`;
  throw new Error(`Product runtime did not become healthy before productization gates: ${detail}`);
}

function stopProcess(child: ChildProcess | null) {
  return new Promise<void>((resolve) => {
    if (!child || child.exitCode !== null || child.killed) {
      resolve();
      return;
    }

    if (process.platform === "win32" && child.pid) {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: false, stdio: "ignore" });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
      return;
    }

    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => resolve(), 5_000).unref();
  });
}

function writeReceipt(checks: Check[], startedAt: string, startedRuntime: boolean, baseUrl: string, status: "passed" | "failed") {
  const passed = checks.filter((check) => check.pass).length;
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        responseMode: "productization_ci_local_receipt_json_v1",
        status,
        generatedAt: new Date().toISOString(),
        startedAt,
        finishedAt: new Date().toISOString(),
        command: "npm run ci:productization",
        baseUrl,
        startedRuntime,
        releaseDecision: "do_not_release",
        allSoftwareObjective: "paused",
        accepted: false,
        packagingGated: true,
        passed,
        total: checks.length,
        checks
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function finalizeHandoffPackage() {
  await runNpm("verify local productization CI receipt", ["run", "verify:productization-ci-local"]);
  await runNpm("refresh product trial packet after final freshness", ["run", "package:product-trial"]);
  await runNpm("verify refreshed product trial packet after final freshness", ["run", "verify:product-trial"]);
  await runNpm("refresh public beta packet after final freshness", ["run", "package:public-beta"]);
  await runNpm("verify refreshed public beta packet after final freshness", ["run", "verify:public-beta"]);
  await runNpm("stage GitHub source package after local CI receipt", ["run", "package:github-source"]);
  await runNpm("verify takeover entry against staged GitHub source package", ["run", "verify:product-takeover-entry"]);
  await runNpm("rebuild final GitHub source package after staged takeover entry scan", ["run", "package:github-source"]);
  await runNpm("verify final GitHub source package", ["run", "verify:github-source"]);
  await runNpm("verify dependency-free new repository bootstrap from staged source", ["run", "verify:new-repo-bootstrap", "--", "--root", "artifacts/github-source-package/transparent-ai-apprentice-mcp"]);
  await runNpm("build product delivery index", ["run", "build:product-delivery-index"]);
  await runNpm("verify product delivery index", ["run", "verify:product-delivery-index"]);
}
async function main() {
  const startedAt = new Date().toISOString();
  const args = parseArgs();
  const baseUrl = `http://${args.host}:${args.port}`;
  const checks: Check[] = [];
  let runtime: ChildProcess | null = null;
  let startedRuntime = false;

  try {
    if (!args.skipBuild) {
      await runNpm("build product runtime", ["run", "build"]);
      checks.push({ name: "Product runtime build completed", pass: true, evidence: "npm run build" });
    } else {
      checks.push({ name: "Product runtime build skipped by caller", pass: true, evidence: "--skip-build" });
    }

    const existingHealth = await readHealth(baseUrl);
    if (existingHealth.ok) {
      checks.push({
        name: "Existing product runtime is healthy",
        pass: true,
        evidence: `status=${existingHealth.status}; checks=${existingHealth.payload?.passed ?? "?"}/${existingHealth.payload?.total ?? "?"}`
      });
    } else {
      runtime = startRuntime(args.host, args.port);
      startedRuntime = true;
      const health = await waitForHealthy(baseUrl, runtime, args.readyTimeoutMs);
      checks.push({
        name: "Started product runtime is healthy",
        pass: true,
        evidence: `status=${health.status}; checks=${health.payload?.passed ?? "?"}/${health.payload?.total ?? "?"}`
      });
    }

    await runProductizationGates(baseUrl);
    checks.push({
      name: "Productization gates completed",
      pass: true,
      evidence: "dynamic productization gates completed with baseUrl=" + baseUrl
    });
    writeReceipt(checks, startedAt, startedRuntime, baseUrl, "passed");
    console.log(`\n[ci:productization] receipt=${receiptPath}`);
    await finalizeHandoffPackage();
  } catch (error) {
    checks.push({
      name: "Productization CI failed",
      pass: false,
      evidence: error instanceof Error ? error.message : String(error)
    });
    writeReceipt(checks, startedAt, startedRuntime, baseUrl, "failed");
    throw error;
  } finally {
    await stopProcess(runtime);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});