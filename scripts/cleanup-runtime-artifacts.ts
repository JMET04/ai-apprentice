import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type RuntimeCandidate = {
  name: string;
  path: string;
  lastWriteTime: string;
  bytes: number;
  active: boolean;
};

type CleanupResult = RuntimeCandidate & {
  deleted: boolean;
  error?: string;
};

const apply = process.argv.includes("--apply");
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const runtimeDir = path.join(artifactsDir, "runtime");
const receiptPath = path.join(artifactsDir, "runtime-artifact-cleanup.json");

function isVerificationRuntimeName(name: string) {
  return /^product-runtime-verify-\d+(?:-\d+)?$/.test(name) || /^verify-standalone(?:-\d+)?$/.test(name);
}

function normalizeForSearch(value: string) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function readProcessCommandLines() {
  try {
    if (process.platform === "win32") {
      return execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Select-Object -ExpandProperty CommandLine"
        ],
        { encoding: "utf8" }
      )
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    return execFileSync("ps", ["-axo", "args="], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dirSize(dir: string): number {
  let total = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += dirSize(fullPath);
      } else {
        total += fs.statSync(fullPath).size;
      }
    } catch {
      // Ignore files that disappear while inventory is running.
    }
  }

  return total;
}

function inventory() {
  if (!fs.existsSync(runtimeDir)) {
    return [];
  }

  const commandLines = readProcessCommandLines().map(normalizeForSearch);

  return fs
    .readdirSync(runtimeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isVerificationRuntimeName(entry.name))
    .map((entry): RuntimeCandidate => {
      const fullPath = path.join(runtimeDir, entry.name);
      const normalizedPath = normalizeForSearch(fullPath);
      const normalizedName = normalizeForSearch(entry.name);
      const stats = fs.statSync(fullPath);

      return {
        name: entry.name,
        path: path.join("artifacts", "productization", "runtime", entry.name),
        lastWriteTime: stats.mtime.toISOString(),
        bytes: dirSize(fullPath),
        active: commandLines.some((line) => line.includes(normalizedPath) || line.includes(normalizedName))
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function cleanup(candidates: RuntimeCandidate[]) {
  return candidates.map((candidate): CleanupResult => {
    if (!apply || candidate.active) {
      return { ...candidate, deleted: false };
    }

    const absolutePath = path.join(process.cwd(), candidate.path);
    const resolvedPath = path.resolve(absolutePath);
    const resolvedRuntimeDir = path.resolve(runtimeDir);

    if (!resolvedPath.startsWith(resolvedRuntimeDir + path.sep)) {
      return { ...candidate, deleted: false, error: `Refusing to delete outside runtime dir: ${resolvedPath}` };
    }

    try {
      fs.rmSync(resolvedPath, { recursive: true, force: true });
      return { ...candidate, deleted: true };
    } catch (error) {
      return { ...candidate, deleted: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function main() {
  const before = inventory();
  const results = cleanup(before);
  const after = apply ? inventory() : before;
  const deleted = results.filter((item) => item.deleted);
  const skippedActive = results.filter((item) => item.active && !item.deleted);
  const failed = results.filter((item) => item.error);
  const reclaimedBytes = deleted.reduce((sum, item) => sum + item.bytes, 0);

  const receipt = {
    responseMode: "runtime_artifact_cleanup_receipt_json_v1",
    status: failed.length > 0 ? "completed_with_errors" : "passed",
    mode: apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    command: apply ? "npm run cleanup:runtime-artifacts -- --apply" : "npm run cleanup:runtime-artifacts",
    runtimeDir: path.join("artifacts", "productization", "runtime"),
    before,
    results,
    after,
    deletedCount: deleted.length,
    skippedActiveCount: skippedActive.length,
    failedCount: failed.length,
    reclaimedBytes,
    protectedRuntimeNames: ["standalone"],
    nextAction: apply
      ? "Run npm run doctor:product -- --base-url http://127.0.0.1:3000 after cleanup."
      : "Run npm run cleanup:runtime-artifacts -- --apply to delete inactive verification runtime copies."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nReport written to ${receiptPath}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();

export {};
