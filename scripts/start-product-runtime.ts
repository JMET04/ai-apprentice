import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const host = getArg("--hostname") ?? process.env.HOSTNAME ?? "127.0.0.1";
const port = getArg("--port") ?? process.env.PORT ?? "3000";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const standaloneDir = path.join(process.cwd(), ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const demoDatabaseUrl = `file:${path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")}`;
const databaseUrl = process.env.DATABASE_URL ?? demoDatabaseUrl;
const productArtifactsDir = path.join(process.cwd(), "artifacts", "productization");
const productRuntimeDir =
  getArg("--runtime-dir") ??
  process.env.PRODUCT_RUNTIME_DIR ??
  path.join(productArtifactsDir, "runtime", "standalone");

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function copyIfExists(from: string, to: string) {
  if (!fs.existsSync(from)) {
    return;
  }

  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
}

function shouldCopyStandaloneSource(source: string) {
  const relative = path.relative(standaloneDir, source);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return true;
  }

  const [topLevel] = relative.split(path.sep);

  // Generated evidence can be traced into .next/standalone. Copying it into a
  // runtime directory recursively copies older runtime copies on the next run.
  return topLevel !== "artifacts";
}

function prepareStandaloneRuntime() {
  if (!fs.existsSync(standaloneServer)) {
    return null;
  }

  console.log(`[start:product] preparing runtime=${productRuntimeDir}`);
  fs.rmSync(productRuntimeDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(productRuntimeDir), { recursive: true });
  fs.cpSync(standaloneDir, productRuntimeDir, {
    recursive: true,
    verbatimSymlinks: true,
    filter: shouldCopyStandaloneSource
  });
  copyIfExists(path.join(process.cwd(), ".next", "server", "chunks"), path.join(productRuntimeDir, ".next", "server", "chunks"));
  copyIfExists(
    path.join(process.cwd(), "node_modules", "next", "dist", "build", "output"),
    path.join(productRuntimeDir, "node_modules", "next", "dist", "build", "output")
  );
  copyIfExists(path.join(process.cwd(), ".next", "static"), path.join(productRuntimeDir, ".next", "static"));
  copyIfExists(path.join(process.cwd(), "public"), path.join(productRuntimeDir, "public"));
  console.log(`[start:product] prepared runtime=${productRuntimeDir}`);

  return path.join(productRuntimeDir, "server.js");
}

function start() {
  const runtimeStandaloneServer = prepareStandaloneRuntime();
  const args = runtimeStandaloneServer ? [runtimeStandaloneServer] : [nextBin, "start", "-H", host, "-p", port];

  console.log(`[start:product] mode=${runtimeStandaloneServer ? "standalone_copy" : "next_start"}`);
  console.log(`[start:product] url=http://${host}:${port}`);
  console.log(`[start:product] database=${databaseUrl}`);
  console.log(`[start:product] artifacts=${productArtifactsDir}`);
  if (runtimeStandaloneServer) {
    console.log(`[start:product] runtime=${runtimeStandaloneServer}`);
  }

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PRODUCT_ARTIFACTS_DIR: productArtifactsDir,
      HOSTNAME: host,
      PORT: port,
      NODE_ENV: "production"
    },
    shell: false,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[start:product] stopped by ${signal}`);
      return;
    }

    process.exitCode = code ?? 0;
  });

  child.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

start();
