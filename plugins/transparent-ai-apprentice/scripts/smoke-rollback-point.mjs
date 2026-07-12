#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs";
const smokeRoot = join(repoRoot, ".transparent-apprentice", "rollback-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const sourcePath = join(smokeRoot, "source-note.txt");
writeFileSync(sourcePath, "checkpoint source\n", "utf8");

function runNodeScript(scriptName, args, expectSuccess = true) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectSuccess && result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  if (!expectSuccess) return result;
  return JSON.parse(result.stdout);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }

  return { rpc, stop };
}

async function callMcpRollback() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const createResult = await server.rpc("tools/call", {
      name: "create_rollback_point",
      arguments: {
        label: "mcp rollback smoke",
        reason: "verify advanced rollback tool",
        paths: [sourcePath],
        outputDir: join(smokeRoot, "mcp")
      }
    });
    const created = JSON.parse(createResult.content[0].text);
    const confirmResult = await server.rpc("tools/call", {
      name: "confirm_rollback_point",
      arguments: {
        manifest: created.manifestPath,
        teacherConfirmation: "confirm current direction is correct, can delete rollback point",
        deleteAfterConfirmation: true
      }
    });
    return { list, created, confirmed: JSON.parse(confirmResult.content[0].text) };
  } finally {
    await server.stop();
  }
}

const created = runNodeScript("create-rollback-point.mjs", [
  "--label",
  "direct rollback smoke",
  "--reason",
  "verify teacher confirmation before cleanup",
  "--path",
  sourcePath,
  "--output-dir",
  join(smokeRoot, "direct")
]);
const manifest = JSON.parse(readFileSync(created.manifestPath, "utf8"));
const rejectedDelete = runNodeScript(
  "confirm-rollback-point.mjs",
  ["--manifest", created.manifestPath, "--teacher-confirmation", "not sure yet", "--delete-after-confirmation"],
  false
);
const marked = runNodeScript("confirm-rollback-point.mjs", [
  "--manifest",
  created.manifestPath,
  "--teacher-confirmation",
  "confirm current direction is correct, keep rollback point for now"
]);
const markedManifest = JSON.parse(readFileSync(created.manifestPath, "utf8"));
const mcp = await callMcpRollback();
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Rollback point snapshots workspace files",
    pass:
      created.format === "transparent_ai_rollback_point_result_v1" &&
      existsSync(created.manifestPath) &&
      existsSync(created.copied?.[0]?.target) &&
      manifest.format === "transparent_ai_rollback_point_v1",
    evidence: created.manifestPath
  },
  {
    name: "Rollback point waits for teacher confirmation",
    pass:
      manifest.status === "waiting_for_teacher_confirmation" &&
      manifest.deleteOnlyAfterTeacherConfirmation === true &&
      manifest.reviewLocks?.teacherConfirmationRequiredBeforeDelete === true,
    evidence: manifest.status
  },
  {
    name: "Delete is rejected without clear confirmation",
    pass: rejectedDelete.status !== 0 && existsSync(created.manifestPath),
    evidence: `exit=${rejectedDelete.status}`
  },
  {
    name: "Confirmation can mark a rollback point without deletion",
    pass:
      marked.status === "teacher_confirmed_current_direction" &&
      marked.deleted === false &&
      markedManifest.status === "teacher_confirmed_current_direction" &&
      existsSync(created.manifestPath),
    evidence: marked.status
  },
  {
    name: "MCP exposes rollback tools in advanced mode",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_rollback_point") &&
      advancedNames.includes("confirm_rollback_point"),
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Confirmed rollback point can be deleted after teacher approval",
    pass:
      mcp.confirmed.status === "deleted_after_teacher_confirmation" &&
      mcp.confirmed.deleted === true &&
      !existsSync(mcp.created.manifestPath),
    evidence: mcp.confirmed.status
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_rollback_point_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
