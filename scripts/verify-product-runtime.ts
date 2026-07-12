import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

type RuntimeCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type ReceiptStatus = "running" | "passed" | "failed";

const host = getArg("--hostname") ?? "127.0.0.1";
const requestedPort = Number(getArg("--port") ?? process.env.PRODUCT_RUNTIME_VERIFY_PORT ?? "3201");
const readyTimeoutMs = Number(process.env.PRODUCT_RUNTIME_READY_TIMEOUT_MS ?? "180000");
const skipBuild = process.argv.includes("--skip-build");
const npmCommand = "npm";
const nextBuildCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const nextBuildDir = path.join(process.cwd(), ".next");
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const runtimeArtifactsDir = path.join(artifactsDir, "runtime");
const receiptPath = path.join(artifactsDir, "product-runtime-verification.json");
const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");
const demoDatabaseUrl = `file:${path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")}`;

const runtimeOutput: string[] = [];

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findOpenPort(start: number) {
  for (let port = start; port < start + 20; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`No free local port found from ${start} to ${start + 19}.`);
}

function commandForNpm(args: string[]) {
  if (process.platform !== "win32") {
    return { command: npmCommand, args };
  }

  return { command: "cmd.exe", args: ["/d", "/s", "/c", npmCommand, ...args] };
}

function runtimeDirForPort(port: number) {
  return path.join(artifactsDir, "runtime", `product-runtime-verify-${port}-${process.pid}`);
}

function runCommand(label: string, args: string[], command = npmCommand) {
  return new Promise<void>((resolve, reject) => {
    console.log(`\n[verify:product-runtime] ${label}`);
    const actual = command === npmCommand ? commandForNpm(args) : { command, args };
    const child = spawn(actual.command, actual.args, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: demoDatabaseUrl, PRODUCT_ARTIFACTS_DIR: artifactsDir },
      shell: false,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code}.`));
    });
  });
}

function startRuntime(port: number) {
  const runtimeDir = runtimeDirForPort(port);
  const actual = commandForNpm([
    "run",
    "start:product",
    "--",
    "--hostname",
    host,
    "--port",
    String(port),
    "--runtime-dir",
    runtimeDir
  ]);
  const child = spawn(actual.command, actual.args, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: demoDatabaseUrl, PRODUCT_ARTIFACTS_DIR: artifactsDir },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk);
    runtimeOutput.push(text);
    process.stdout.write(`[start:product] ${text}`);
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    runtimeOutput.push(text);
    process.stderr.write(`[start:product] ${text}`);
  });

  return child;
}

function waitForHttp(url: string, child: ChildProcess, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise<void>((resolve, reject) => {
    async function poll() {
      if (child.exitCode !== null) {
        reject(new Error(`Product runtime exited before ${url} became ready. Exit code: ${child.exitCode}.`));
        return;
      }

      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until the runtime is ready or the timeout expires.
      }

      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url}.`));
        return;
      }

      setTimeout(poll, 1000);
    }

    void poll();
  });
}

async function readJson<T>(baseUrl: string, route: string) {
  const response = await fetch(new URL(route, baseUrl));
  const text = await response.text();
  let json: T | null = null;

  try {
    json = JSON.parse(text) as T;
  } catch {
    // The caller records the non-JSON response as failed evidence.
  }

  return { response, json };
}

function push(checks: RuntimeCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function cleanRuntimeArtifactsBeforeBuild() {
  const resolvedRuntimeDir = path.resolve(runtimeArtifactsDir);
  const resolvedArtifactsDir = path.resolve(artifactsDir);
  if (!resolvedRuntimeDir.startsWith(resolvedArtifactsDir + path.sep)) {
    throw new Error(`Refusing to clean runtime artifacts outside product artifacts: ${resolvedRuntimeDir}`);
  }

  try {
    for (const entry of fs.readdirSync(resolvedRuntimeDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("product-runtime-verify-")) {
        fs.rmSync(path.join(resolvedRuntimeDir, entry.name), { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.warn(
      `[verify:product-runtime] runtime artifact cleanup skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function cleanNextBuildBeforeBuild() {
  const resolvedNextDir = path.resolve(nextBuildDir);
  const resolvedRoot = path.resolve(process.cwd());
  if (!resolvedNextDir.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Refusing to clean Next build outside workspace: ${resolvedNextDir}`);
  }

  try {
    fs.rmSync(resolvedNextDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `[verify:product-runtime] .next cleanup skipped: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function assertStandaloneBuildAvailable() {
  if (!fs.existsSync(standaloneServer)) {
    throw new Error(
      `Standalone build is missing at ${standaloneServer}. Run npm run build first, or rerun npm run verify:product-runtime without --skip-build.`
    );
  }
}

async function waitForStandaloneBuild(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (fs.existsSync(standaloneServer)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assertStandaloneBuildAvailable();
}

function stopProcess(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.killed) {
      resolve();
      return;
    }

    if (process.platform === "win32" && child.pid) {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        shell: false,
        stdio: "ignore"
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
      return;
    }

    const timeout = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function writeReceipt(args: {
  status: ReceiptStatus;
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  port: number;
  checks: RuntimeCheck[];
  error?: string;
}) {
  const passed = args.checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_runtime_verification_receipt_json_v1",
    status: args.status,
    generatedAt: args.finishedAt,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    durationMs: Date.parse(args.finishedAt) - Date.parse(args.startedAt),
    baseUrl: args.baseUrl,
    requestedPort,
    actualPort: args.port,
    skipBuild,
    readyTimeoutMs,
    command: `npm run start:product -- --hostname ${host} --port ${args.port} --runtime-dir ${runtimeDirForPort(args.port)}`,
    productionServerMode: "standalone_copy",
    productionServerRuntimePath: path.join(runtimeDirForPort(args.port), "server.js"),
    databaseUrl: demoDatabaseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    packagingBoundary: {
      accepted: false,
      packagingGated: true,
      status: "pending_teacher_acceptance"
    },
    passed,
    total: args.checks.length,
    checks: args.checks,
    runtimeOutputTail: runtimeOutput.join("").split(/\r?\n/).filter(Boolean).slice(-12),
    error: args.error ?? null
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(`\n[verify:product-runtime] receipt written to ${receiptPath}`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const port = await findOpenPort(requestedPort);
  const baseUrl = `http://${host}:${port}`;
  const checks: RuntimeCheck[] = [];
  let server: ChildProcess | null = null;
  let status: ReceiptStatus = "running";
  let errorMessage: string | undefined;

  writeReceipt({
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    port,
    checks
  });

  try {
    if (!skipBuild) {
      cleanRuntimeArtifactsBeforeBuild();
      cleanNextBuildBeforeBuild();
      await runCommand("build", [nextBuildCli, "build"], process.execPath);
    }
    await waitForStandaloneBuild();

    server = startRuntime(port);
    await waitForHttp(`${baseUrl}/api/ai-service-status`, server, readyTimeoutMs);

    const health = await readJson<{
      responseMode?: string;
      status?: string;
      passed?: number;
      total?: number;
    }>(baseUrl, "/api/health");
    const readiness = await readJson<{
      responseMode?: string;
      status?: string;
      missingArtifacts?: string[];
      productRuntimeVerification?: { status?: string };
    }>(baseUrl, "/api/product-readiness");
    const releaseReadiness = await readJson<{
      responseMode?: string;
      status?: string;
      latest?: {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        blockers?: Array<{ name?: string }>;
      };
      trialReadinessIsReleaseReadiness?: boolean;
    }>(baseUrl, "/api/product-release-readiness");
    const ai = await readJson<{
      responseMode?: string;
      activeProvider?: string;
      realModelReady?: boolean;
    }>(baseUrl, "/api/ai-service-status");

    push(
      checks,
      "start:product serves the health contract",
      [200, 500, 503].includes(health.response.status) && health.json?.responseMode === "product_health_json_v1",
      `status=${health.response.status}; health=${health.json?.status ?? "non_json"}; checks=${health.json?.passed ?? "?"}/${
        health.json?.total ?? "?"
      }`
    );

    push(
      checks,
      "Product readiness contract is available under start:product",
      [200, 500].includes(readiness.response.status) &&
        readiness.json?.responseMode === "product_readiness_json_v1" &&
        ["ready_for_human_acceptance", "needs_productization_work"].includes(readiness.json.status ?? "") &&
        Array.isArray(readiness.json.missingArtifacts),
      `status=${readiness.response.status}; readiness=${readiness.json?.status ?? "non_json"}; missingArtifacts=${
        readiness.json?.missingArtifacts?.length ?? "?"
      }`
    );

    push(
      checks,
      "Release go/no-go contract is available under start:product",
      releaseReadiness.response.status === 200 &&
        releaseReadiness.json?.responseMode === "product_release_readiness_latest_json_v1" &&
        releaseReadiness.json.status === "saved" &&
        releaseReadiness.json.latest?.responseMode === "product_release_readiness_gate_json_v1" &&
        ["blocked_not_release_ready", "passed"].includes(releaseReadiness.json.latest.status ?? "") &&
        ["do_not_release", "release_candidate"].includes(releaseReadiness.json.latest.releaseDecision ?? "") &&
        releaseReadiness.json.trialReadinessIsReleaseReadiness === false,
      `status=${releaseReadiness.response.status}; gate=${
        releaseReadiness.json?.latest?.status ?? "non_json"
      }; decision=${releaseReadiness.json?.latest?.releaseDecision ?? "?"}; blockers=${
        releaseReadiness.json?.latest?.blockers?.length ?? "?"
      }`
    );

    push(
      checks,
      "AI provider remains explicit mock under product runtime",
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
      "Runtime command uses standalone copy without locking .next",
      runtimeOutput.join("").includes("[start:product] mode=standalone_copy") &&
        runtimeOutput.join("").includes(`artifacts\\productization\\runtime\\product-runtime-verify-${port}`) &&
        runtimeOutput.join("").includes("[start:product] database=") &&
        runtimeOutput.join("").includes("[start:product] artifacts="),
      runtimeOutput.join("").split(/\r?\n/).filter(Boolean).slice(0, 4).join(" | ")
    );

    status = checks.every((check) => check.pass) ? "passed" : "failed";
    if (status === "failed") {
      throw new Error("One or more product runtime checks failed.");
    }
  } catch (error) {
    status = "failed";
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (server) {
      await stopProcess(server);
    }
    writeReceipt({
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl,
      port,
      checks,
      error: errorMessage
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
