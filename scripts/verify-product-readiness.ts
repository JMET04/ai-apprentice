import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { buildProductTrialPacket } from "./build-product-trial-packet";

const host = "127.0.0.1";
const requestedPort = Number(getArg("--port") ?? process.env.PRODUCT_VERIFY_PORT ?? "3100");
const keepRecords = process.argv.includes("--keep-records");
const npmCommand = "npm";
const nextBuildCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const nextBuildDir = path.join(process.cwd(), ".next");
const demoDatabaseUrl = `file:${path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")}`;
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const runtimeArtifactsDir = path.join(artifactsDir, "runtime");
const productVerifyRuntimeDir = path.join(artifactsDir, "runtime", `verify-standalone-${process.pid}`);
const verificationReceiptPath = path.join(artifactsDir, "product-verification-receipt.json");

type VerificationStep = {
  label: string;
  command: string;
  args: string[];
  status: "running" | "passed" | "failed";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number | null;
  error?: string;
};

const verificationSteps: VerificationStep[] = [];
let productionServerMode = "not_started";
let productionServerRuntimePath: string | null = null;

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

function runCommand(label: string, command: string, args: string[], env: Record<string, string | undefined> = {}) {
  return new Promise<void>((resolve, reject) => {
    console.log(`\n[verify:product] ${label}`);
    const startedAtMs = Date.now();
    const step: VerificationStep = {
      label,
      command,
      args,
      status: "running",
      startedAt: new Date(startedAtMs).toISOString()
    };
    verificationSteps.push(step);
    const actualCommand = process.platform === "win32" && command === npmCommand ? "cmd.exe" : command;
    const actualArgs = process.platform === "win32" && command === npmCommand ? ["/d", "/s", "/c", command, ...args] : args;
    const child = spawn(actualCommand, actualArgs, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      shell: false,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      step.status = "failed";
      step.finishedAt = new Date().toISOString();
      step.durationMs = Date.now() - startedAtMs;
      step.error = error.message;
      reject(error);
    });
    child.on("exit", (code) => {
      step.status = code === 0 ? "passed" : "failed";
      step.finishedAt = new Date().toISOString();
      step.durationMs = Date.now() - startedAtMs;
      step.exitCode = code;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}.`));
      }
    });
  });
}

function cleanRuntimeArtifactsBeforeBuild() {
  const resolvedRuntimeDir = path.resolve(runtimeArtifactsDir);
  const resolvedVerifyRuntimeDir = path.resolve(productVerifyRuntimeDir);
  const resolvedArtifactsDir = path.resolve(artifactsDir);
  if (!resolvedRuntimeDir.startsWith(resolvedArtifactsDir + path.sep)) {
    throw new Error(`Refusing to clean runtime artifacts outside product artifacts: ${resolvedRuntimeDir}`);
  }
  if (!resolvedVerifyRuntimeDir.startsWith(resolvedRuntimeDir + path.sep)) {
    throw new Error(`Refusing to clean verify runtime outside runtime artifacts: ${resolvedVerifyRuntimeDir}`);
  }

  try {
    fs.rmSync(resolvedVerifyRuntimeDir, { recursive: true, force: true });
    if (fs.existsSync(resolvedRuntimeDir)) {
      for (const entry of fs.readdirSync(resolvedRuntimeDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith("product-runtime-verify-")) {
          fs.rmSync(path.join(resolvedRuntimeDir, entry.name), { recursive: true, force: true });
        }
      }
    }
  } catch (error) {
    console.warn(
      `[verify:product] runtime artifact cleanup skipped: ${error instanceof Error ? error.message : String(error)}`
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
    console.warn(`[verify:product] .next cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function waitForHttp(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise<void>((resolve, reject) => {
    async function poll() {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until the server is ready or the timeout expires.
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

function startNextServer(port: number) {
  productionServerMode = "standalone_copy";
  productionServerRuntimePath = path.join(productVerifyRuntimeDir, "server.js");
  console.log(`\n[verify:product] start production server on http://${host}:${port}`);
  const actualCommand = process.platform === "win32" ? "cmd.exe" : npmCommand;
  const actualArgs =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          npmCommand,
          "run",
          "start:product",
          "--",
          "--hostname",
          host,
          "--port",
          String(port),
          "--runtime-dir",
          productVerifyRuntimeDir
        ]
      : [
          "run",
          "start:product",
          "--",
          "--hostname",
          host,
          "--port",
          String(port),
          "--runtime-dir",
          productVerifyRuntimeDir
        ];
  const child = spawn(actualCommand, actualArgs, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: demoDatabaseUrl, PRODUCT_ARTIFACTS_DIR: artifactsDir },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(`[start:product] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[start:product] ${chunk}`));

  return child;
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

function writeVerificationReceipt(args: {
  status: "running" | "passed" | "failed";
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  error?: string;
  buildPacket?: boolean;
}) {
  const receipt = {
    responseMode: "product_verification_receipt_json_v1",
    status: args.status,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    durationMs: Date.parse(args.finishedAt) - Date.parse(args.startedAt),
    baseUrl: args.baseUrl,
    requestedPort,
    productionServerMode,
    productionServerRuntimePath: productionServerRuntimePath
      ? path.relative(process.cwd(), productionServerRuntimePath).replace(/\\/g, "/")
      : null,
    keepRecords,
    demoDatabaseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    packagingBoundary: {
      accepted: false,
      packagingGated: true,
      status: "pending_teacher_acceptance"
    },
    steps: verificationSteps,
    error: args.error ?? null
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(verificationReceiptPath, JSON.stringify(receipt, null, 2));
  console.log(`\n[verify:product] receipt written to ${verificationReceiptPath}`);

  if (args.status === "passed" && args.buildPacket !== false) {
    const manifest = buildProductTrialPacket("verify:product");
    console.log(`[verify:product] product trial packet written to ${manifest.packetDir}`);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const port = await findOpenPort(requestedPort);
  const baseUrl = `http://${host}:${port}`;
  let server: ChildProcess | null = null;
  let status: "running" | "passed" | "failed" = "running";
  let errorMessage: string | undefined;

  try {
    writeVerificationReceipt({
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl
    });
    await runCommand("typecheck", npmCommand, ["run", "typecheck"]);
    await runCommand("manual acceptance classification gate", npmCommand, ["run", "verify:manual-acceptance-classification"]);
    cleanRuntimeArtifactsBeforeBuild();
    cleanNextBuildBeforeBuild();
    await runCommand("build", process.execPath, [nextBuildCli, "build"]);
    await runCommand("public product runtime smoke", npmCommand, ["run", "verify:product-runtime", "--", "--skip-build"]);

    server = startNextServer(port);
    await waitForHttp(baseUrl);
    writeVerificationReceipt({
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl
    });

    await runCommand("product runtime doctor", npmCommand, ["run", "doctor:product", "--", "--base-url", baseUrl], {
      DATABASE_URL: demoDatabaseUrl
    });
    await runCommand("manual acceptance browser smoke", npmCommand, ["run", "smoke:manual-browser", "--", "--base-url", baseUrl], {
      DATABASE_URL: demoDatabaseUrl
    });
    await runCommand("human acceptance gate snapshot", npmCommand, ["run", "verify:human-acceptance", "--", "--allow-pending"], {
      DATABASE_URL: demoDatabaseUrl
    });
    await runCommand("product handoff readiness", npmCommand, ["run", "verify:handoff", "--", "--allow-missing-live-handoff"], {
      DATABASE_URL: demoDatabaseUrl
    });
    await runCommand("product UI/API smoke", npmCommand, ["run", "smoke:product", "--", "--base-url", baseUrl], {
      DATABASE_URL: demoDatabaseUrl
    });
    await runCommand(
      "core teach-correct-rerun smoke",
      npmCommand,
      ["run", "smoke:core-loop", "--", "--base-url", baseUrl, ...(keepRecords ? ["--keep-records"] : [])],
      { DATABASE_URL: demoDatabaseUrl }
    );
    status = "passed";
    writeVerificationReceipt({
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl,
      buildPacket: false
    });
    await runCommand("product release readiness snapshot", npmCommand, [
      "run",
      "verify:product-release-readiness",
      "--",
      "--allow-blocked"
    ]);
    console.log("\n[verify:product] passed");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (server) {
      await stopProcess(server);
    }
    writeVerificationReceipt({
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseUrl,
      error: errorMessage
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
