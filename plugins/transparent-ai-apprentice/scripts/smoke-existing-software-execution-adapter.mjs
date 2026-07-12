#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const smokeRoot = join(repoRoot, ".transparent-apprentice", "execution-adapter-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

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
    return new Promise((resolvePromise, rejectPromise) => pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  return { rpc, stop };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseJsonText(text) {
  return JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
}

function readJson(path) {
  return parseJsonText(readFileSync(path, "utf8"));
}

function websocketAcceptKey(key) {
  return createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function encodeWebSocketTextFrame(text) {
  const payload = Buffer.from(text);
  const header = [];
  header.push(0x81);
  if (payload.length < 126) {
    header.push(payload.length);
  } else {
    header.push(126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  }
  return Buffer.concat([Buffer.from(header), payload]);
}

function decodeWebSocketTextFrame(buffer) {
  const opcode = buffer[0] & 0x0f;
  if (opcode !== 0x1) return "";
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  }
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
  }
  return payload.toString("utf8");
}

async function startMockCdpServer() {
  const receivedCommands = [];
  const sockets = new Set();
  const server = createServer((request, response) => {
    if (request.url === "/json/version") {
      const port = server.address().port;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/mock` }));
      return;
    }
    response.statusCode = 404;
    response.end("not found");
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket) => {
    if (request.url !== "/devtools/page/mock") {
      socket.destroy();
      return;
    }
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${websocketAcceptKey(request.headers["sec-websocket-key"])}`,
      "",
      ""
    ].join("\r\n"));
    socket.on("data", (buffer) => {
      const decoded = decodeWebSocketTextFrame(buffer);
      if (!decoded.trim()) return;
      const command = JSON.parse(decoded);
      receivedCommands.push(command);
      socket.write(encodeWebSocketTextFrame(JSON.stringify({
        id: command.id,
        result: {
          result: {
            type: "object",
            value: {
              ok: true,
              mockCdp: true,
              method: command.method,
              expressionIncludesSelector: String(command.params?.expression || "").includes("document.querySelector")
            }
          }
        }
      })));
      setTimeout(() => {
        try { socket.end(); } catch {}
      }, 50);
    });
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  return {
    versionUrl: `http://127.0.0.1:${server.address().port}/json/version`,
    receivedCommands,
    close: () => new Promise((resolvePromise) => {
      for (const socket of sockets) {
        try { socket.destroy(); } catch {}
      }
      server.close(resolvePromise);
    })
  };
}

async function callAdvancedTool(actionPlanPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_existing_software_execution_adapter",
      arguments: {
        goal: "Execute teacher-reviewed sketch intent inside a browser CRM using existing tooling first.",
        software: "Chrome browser web CRM",
        actionPlan: actionPlanPath,
        preferredAdapter: "existing-browser-automation",
        outputDir: join(smokeRoot, "mcp")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const actionPlanPath = join(smokeRoot, "supervised-action-plan.json");
writeFileSync(
  actionPlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_supervised_software_action_plan_v1",
      software: "Chrome browser web CRM",
      targetSoftware: { windowTitle: "Transparent AI Apprentice Smoke Target" },
      actions: [
        { id: "action-1-click", kind: "click", at: { xNormalized: 0.42, yNormalized: 0.3 } },
        { id: "action-2-type", kind: "type_text", text: "teacher reviewed value" }
      ],
      locks: { nativeUniversalExecution: false, accepted: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);

const directResult = JSON.parse(
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      join(__dirname, "create-existing-software-execution-adapter.mjs"),
      "--goal",
      "Execute teacher-reviewed sketch intent inside a generic desktop app using existing tooling first.",
      "--software",
      "generic desktop app",
      "--action-plan",
      actionPlanPath,
      "--preferred-adapter",
      "existing-windows-ui-automation",
      "--output-dir",
      join(smokeRoot, "direct")
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(stderr || stdout || "direct execution adapter smoke failed"));
      else resolvePromise(stdout);
    });
  })
);
const directSelection = JSON.parse(readFileSync(directResult.selectionPath, "utf8"));
const directExecutionPackage = JSON.parse(readFileSync(directResult.executionPackagePath, "utf8"));
const windowsRunner = directExecutionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-windows-ui-automation");
const windowsDryRunProcess = windowsRunner
  ? spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", windowsRunner.runnerPath], { cwd: repoRoot, encoding: "utf8" })
  : null;
const windowsDryRun = windowsDryRunProcess?.status === 0 ? parseJsonText(windowsDryRunProcess.stdout) : null;
const windowsDryRunReceipt = windowsRunner && existsSync(windowsRunner.receiptPath) ? readJson(windowsRunner.receiptPath) : null;
const windowsDryRunPreflightPath = windowsDryRunReceipt?.preflightPath || "";
const windowsDryRunPreflight = existsSync(windowsDryRunPreflightPath) ? readJson(windowsDryRunPreflightPath) : null;
const windowsBlockedExecuteProcess = windowsRunner
  ? spawnSync("powershell", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      windowsRunner.runnerPath,
      "-TeacherConfirmed",
      "-Execute",
      "-TargetWindowTitle",
      "Transparent AI Apprentice Definitely Missing Window"
    ], { cwd: repoRoot, encoding: "utf8" })
  : null;
const windowsBlockedExecute = windowsBlockedExecuteProcess?.status === 0 ? parseJsonText(windowsBlockedExecuteProcess.stdout) : null;
const windowsBlockedReceipt = windowsRunner && existsSync(windowsRunner.receiptPath) ? readJson(windowsRunner.receiptPath) : null;
const windowsBlockedPreflightPath = windowsBlockedReceipt?.preflightPath || "";
const windowsBlockedPreflight = existsSync(windowsBlockedPreflightPath) ? readJson(windowsBlockedPreflightPath) : null;
const windowsRunnerText = windowsRunner ? readFileSync(windowsRunner.runnerPath, "utf8") : "";
const mcp = await callAdvancedTool(actionPlanPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const mcpSelection = JSON.parse(readFileSync(mcp.result.selectionPath, "utf8"));
const executionPackage = JSON.parse(readFileSync(mcp.result.executionPackagePath, "utf8"));
const browserRunner = executionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-browser-automation");
const browserDryRun = browserRunner
  ? JSON.parse(
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [browserRunner.runnerPath], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("exit", (code) => {
          if (code !== 0) rejectPromise(new Error(stderr || stdout || "browser dry-run runner failed"));
          else resolvePromise(stdout);
        });
      })
    )
  : null;
const browserReceipt = browserRunner ? JSON.parse(readFileSync(browserRunner.receiptPath, "utf8")) : null;

const browserDomActionPlanPath = join(smokeRoot, "browser-dom-action-plan.json");
writeFileSync(
  browserDomActionPlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_supervised_software_action_plan_v1",
      software: "Local browser DOM document",
      targetSoftware: { url: "file://teacher-reviewed-local-page.html" },
      actions: [
        { id: "browser-dom-set-title", kind: "type_text", selector: "#teacher-note", text: "teacher reviewed browser value" }
      ],
      locks: { nativeUniversalExecution: false, accepted: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);
const browserDomSourcePath = join(smokeRoot, "teacher-reviewed-local-page.html");
writeFileSync(
  browserDomSourcePath,
  [
    "<!doctype html>",
    "<html>",
    "<body>",
    "<main>",
    "<div id=\"teacher-note\">old value</div>",
    "</main>",
    "</body>",
    "</html>"
  ].join("\n"),
  "utf8"
);
const reviewedBrowserTargetPath = join(smokeRoot, "reviewed-browser-target.json");
const expectedBrowserSourceSha256 = sha256(browserDomSourcePath);
writeFileSync(
  reviewedBrowserTargetPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_browser_target_manifest_v1",
      teacherReviewed: true,
      targetKind: "local-html-dom",
      targetHtmlFile: browserDomSourcePath,
      selector: "#teacher-note",
      operation: "setText",
      value: "teacher reviewed browser value",
      targetOutputFileName: "teacher-reviewed-browser-output.html",
      expectedSourceSha256: expectedBrowserSourceSha256
    },
    null,
    2
  ),
  "utf8"
);
const browserDomRouteResult = JSON.parse(
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      join(__dirname, "create-existing-software-execution-adapter.mjs"),
      "--goal",
      "Apply teacher-reviewed browser DOM intent to a local web document using existing browser technology route.",
      "--software",
      "Local browser DOM document",
      "--action-plan",
      browserDomActionPlanPath,
      "--preferred-adapter",
      "existing-browser-automation",
      "--output-dir",
      join(smokeRoot, "browser-dom-route")
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(stderr || stdout || "browser DOM route adapter selection failed"));
      else resolvePromise(stdout);
    });
  })
);
const browserDomExecutionPackage = JSON.parse(readFileSync(browserDomRouteResult.executionPackagePath, "utf8"));
const browserDomRunner = browserDomExecutionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-browser-automation");
const browserDomDryRun = browserDomRunner
  ? JSON.parse(spawnSync(process.execPath, [browserDomRunner.runnerPath], { cwd: repoRoot, encoding: "utf8" }).stdout)
  : null;
if (browserDomRunner && browserDomDryRun?.status === undefined) throw new Error("browser DOM dry-run did not return status");
const browserDomExecuteProcess = browserDomRunner
  ? spawnSync(process.execPath, [browserDomRunner.runnerPath, "--teacher-confirmed", "--execute", "--reviewed-browser-target", reviewedBrowserTargetPath], { cwd: repoRoot, encoding: "utf8" })
  : { status: 1, stdout: "", stderr: "missing browser DOM runner" };
if (browserDomExecuteProcess.status !== 0) throw new Error(browserDomExecuteProcess.stderr || browserDomExecuteProcess.stdout || "browser DOM route execute failed");
const browserDomExecuteResult = JSON.parse(browserDomExecuteProcess.stdout);
const browserDomExecuteReceipt = browserDomRunner ? JSON.parse(readFileSync(browserDomRunner.receiptPath, "utf8")) : null;
const browserDomRouteVerification = browserDomRunner
  ? JSON.parse(
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [
          join(__dirname, "verify-supervised-action-outcome.mjs"),
          "--receipt",
          browserDomRunner.receiptPath,
          "--output-dir",
          join(smokeRoot, "browser-dom-route-verification")
        ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("exit", (code) => {
          if (code !== 0) rejectPromise(new Error(stderr || stdout || "browser DOM route outcome verification failed"));
          else resolvePromise(stdout);
        });
      })
    )
  : null;

const mockCdp = await startMockCdpServer();
const browserCdpActionPlanPath = join(smokeRoot, "browser-cdp-action-plan.json");
writeFileSync(
  browserCdpActionPlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_supervised_software_action_plan_v1",
      software: "Local Chrome DevTools browser",
      targetSoftware: { url: "http://127.0.0.1/mock-cdp-page" },
      actions: [
        { id: "browser-cdp-set-text", kind: "type_text", selector: "#teacher-note", text: "teacher reviewed CDP value" }
      ],
      locks: { nativeUniversalExecution: false, accepted: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);
const reviewedBrowserCdpTargetPath = join(smokeRoot, "reviewed-browser-cdp-target.json");
writeFileSync(
  reviewedBrowserCdpTargetPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_browser_target_manifest_v1",
      teacherReviewed: true,
      targetKind: "local-browser-cdp",
      cdpEndpoint: mockCdp.versionUrl,
      selector: "#teacher-note",
      operation: "setText",
      value: "teacher reviewed CDP value",
      targetResponseFileName: "teacher-reviewed-cdp-result.json"
    },
    null,
    2
  ),
  "utf8"
);
const browserCdpRouteResult = JSON.parse(
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      join(__dirname, "create-existing-software-execution-adapter.mjs"),
      "--goal",
      "Apply teacher-reviewed browser intent through a localhost Chrome DevTools endpoint.",
      "--software",
      "Local Chrome DevTools browser",
      "--action-plan",
      browserCdpActionPlanPath,
      "--preferred-adapter",
      "existing-browser-automation",
      "--output-dir",
      join(smokeRoot, "browser-cdp-route")
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(stderr || stdout || "browser CDP route adapter selection failed"));
      else resolvePromise(stdout);
    });
  })
);
const browserCdpExecutionPackage = JSON.parse(readFileSync(browserCdpRouteResult.executionPackagePath, "utf8"));
const browserCdpRunner = browserCdpExecutionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-browser-automation");
const browserCdpExecuteOutput = browserCdpRunner
  ? await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, [browserCdpRunner.runnerPath, "--teacher-confirmed", "--execute", "--reviewed-browser-target", reviewedBrowserCdpTargetPath], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("exit", (code) => {
        if (code !== 0) rejectPromise(new Error(stderr || stdout || "browser CDP route execute failed"));
        else resolvePromise(stdout);
      });
    })
  : await Promise.reject(new Error("missing browser CDP runner"));
const browserCdpExecuteResult = JSON.parse(browserCdpExecuteOutput);
const browserCdpExecuteReceipt = browserCdpRunner ? JSON.parse(readFileSync(browserCdpRunner.receiptPath, "utf8")) : null;
const browserCdpRouteVerification = browserCdpRunner
  ? JSON.parse(
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [
          join(__dirname, "verify-supervised-action-outcome.mjs"),
          "--receipt",
          browserCdpRunner.receiptPath,
          "--output-dir",
          join(smokeRoot, "browser-cdp-route-verification")
        ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("exit", (code) => {
          if (code !== 0) rejectPromise(new Error(stderr || stdout || "browser CDP route outcome verification failed"));
          else resolvePromise(stdout);
        });
      })
    )
  : null;
await mockCdp.close();

const fileCapabilityProfilePath = join(smokeRoot, "file-capability-profile.json");
writeFileSync(
  fileCapabilityProfilePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_capability_profile_v1",
      software: "Generic file import/export app",
      discoveredCapabilities: ["import CSV", "export JSON", "file-based project update"],
      reviewedExecutionRoutes: ["existing-file-import-export"],
      locks: { accepted: false, ruleEnabled: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);
const sourceImportPath = join(smokeRoot, "teacher-reviewed-source.csv");
writeFileSync(sourceImportPath, "id,value\n1,teacher-reviewed\n", "utf8");
const reviewedMappingPath = join(smokeRoot, "reviewed-file-mapping.json");
const expectedSourceSha256 = sha256(sourceImportPath);
writeFileSync(
  reviewedMappingPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_file_import_export_mapping_v1",
      teacherReviewed: true,
      sourceFile: sourceImportPath,
      targetFileName: "prepared-teacher-reviewed-import.csv",
      targetFormat: "csv",
      expectedSourceSha256,
      rollbackRequired: true
    },
    null,
    2
  ),
  "utf8"
);

const fileRouteResult = JSON.parse(
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      join(__dirname, "create-existing-software-execution-adapter.mjs"),
      "--goal",
      "Prepare reviewed CSV import/export file for target software using existing file route.",
      "--software",
      "Generic file import/export app",
      "--action-plan",
      actionPlanPath,
      "--capability-profile",
      fileCapabilityProfilePath,
      "--preferred-adapter",
      "existing-file-import-export",
      "--output-dir",
      join(smokeRoot, "file-route")
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(stderr || stdout || "file route adapter selection failed"));
      else resolvePromise(stdout);
    });
  })
);
const fileExecutionPackage = JSON.parse(readFileSync(fileRouteResult.executionPackagePath, "utf8"));
const fileRunner = fileExecutionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-file-import-export");
const fileDryRun = fileRunner
  ? JSON.parse(spawnSync(process.execPath, [fileRunner.runnerPath], { cwd: repoRoot, encoding: "utf8" }).stdout)
  : null;
if (fileRunner && fileDryRun?.status === undefined) throw new Error("file route dry-run did not return status");
const fileExecuteProcess = fileRunner
  ? spawnSync(process.execPath, [fileRunner.runnerPath, "--teacher-confirmed", "--execute", "--reviewed-mapping", reviewedMappingPath], { cwd: repoRoot, encoding: "utf8" })
  : { status: 1, stdout: "", stderr: "missing file runner" };
if (fileExecuteProcess.status !== 0) throw new Error(fileExecuteProcess.stderr || fileExecuteProcess.stdout || "file route execute failed");
const fileExecuteResult = JSON.parse(fileExecuteProcess.stdout);
const fileExecuteReceipt = fileRunner ? JSON.parse(readFileSync(fileRunner.receiptPath, "utf8")) : null;
const fileRouteVerification = fileRunner
  ? JSON.parse(
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [
          join(__dirname, "verify-supervised-action-outcome.mjs"),
          "--receipt",
          fileRunner.receiptPath,
          "--output-dir",
          join(smokeRoot, "file-route-verification")
        ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("exit", (code) => {
          if (code !== 0) rejectPromise(new Error(stderr || stdout || "file route outcome verification failed"));
          else resolvePromise(stdout);
        });
      })
    )
  : null;

const cliCapabilityProfilePath = join(smokeRoot, "cli-capability-profile.json");
writeFileSync(
  cliCapabilityProfilePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_capability_profile_v1",
      software: "Generic CLI-capable app",
      discoveredCapabilities: ["command line tool", "script export", "node script dry run"],
      reviewedExecutionRoutes: ["existing-cli-or-script"],
      locks: { accepted: false, ruleEnabled: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);
const reviewedScriptPath = join(smokeRoot, "teacher-reviewed-cli-script.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "if (!outputPath) process.exit(2);",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, route: 'existing-cli-or-script', value: 'teacher-reviewed-cli-output' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);
const reviewedCommandPath = join(smokeRoot, "reviewed-cli-command.json");
const expectedScriptSha256 = sha256(reviewedScriptPath);
writeFileSync(
  reviewedCommandPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_cli_command_manifest_v1",
      teacherReviewed: true,
      commandKind: "node-script",
      scriptSourceFile: reviewedScriptPath,
      targetOutputFileName: "teacher-reviewed-cli-output.json",
      expectedScriptSha256,
      rollbackRequired: true
    },
    null,
    2
  ),
  "utf8"
);
const cliRouteResult = JSON.parse(
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      join(__dirname, "create-existing-software-execution-adapter.mjs"),
      "--goal",
      "Run a teacher-reviewed CLI script for target software using existing command route.",
      "--software",
      "Generic CLI-capable app",
      "--action-plan",
      actionPlanPath,
      "--capability-profile",
      cliCapabilityProfilePath,
      "--preferred-adapter",
      "existing-cli-or-script",
      "--output-dir",
      join(smokeRoot, "cli-route")
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(stderr || stdout || "cli route adapter selection failed"));
      else resolvePromise(stdout);
    });
  })
);
const cliExecutionPackage = JSON.parse(readFileSync(cliRouteResult.executionPackagePath, "utf8"));
const cliRunner = cliExecutionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-cli-or-script");
const cliDryRunProcess = cliRunner
  ? spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", cliRunner.runnerPath], { cwd: repoRoot, encoding: "utf8" })
  : { status: 1, stdout: "", stderr: "missing cli runner" };
if (cliDryRunProcess.status !== 0) throw new Error(cliDryRunProcess.stderr || cliDryRunProcess.stdout || "cli dry-run failed");
const cliDryRun = JSON.parse(cliDryRunProcess.stdout);
const cliExecuteProcess = cliRunner
  ? spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", cliRunner.runnerPath, "-TeacherConfirmed", "-Execute", "-ReviewedCommand", reviewedCommandPath], { cwd: repoRoot, encoding: "utf8" })
  : { status: 1, stdout: "", stderr: "missing cli runner" };
if (cliExecuteProcess.status !== 0) throw new Error(cliExecuteProcess.stderr || cliExecuteProcess.stdout || "cli route execute failed");
const cliExecuteResult = JSON.parse(cliExecuteProcess.stdout);
const cliExecuteReceipt = cliRunner ? JSON.parse(readFileSync(cliRunner.receiptPath, "utf8").replace(/^\uFEFF/, "")) : null;
const cliRouteVerification = cliRunner
  ? JSON.parse(
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [
          join(__dirname, "verify-supervised-action-outcome.mjs"),
          "--receipt",
          cliRunner.receiptPath,
          "--output-dir",
          join(smokeRoot, "cli-route-verification")
        ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("exit", (code) => {
          if (code !== 0) rejectPromise(new Error(stderr || stdout || "cli route outcome verification failed"));
          else resolvePromise(stdout);
        });
      })
    )
  : null;

const apiCapabilityProfilePath = join(smokeRoot, "api-capability-profile.json");
writeFileSync(
  apiCapabilityProfilePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_capability_profile_v1",
      software: "Generic local API-capable app",
      discoveredCapabilities: ["local REST API", "SDK endpoint", "reviewed application API"],
      reviewedExecutionRoutes: ["existing-application-api"],
      locks: { accepted: false, ruleEnabled: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);
let apiRequestBody = "";
const apiServer = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/reviewed-action") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not-found" }));
    return;
  }
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    apiRequestBody += chunk;
  });
  request.on("end", () => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, route: "existing-application-api", received: JSON.parse(apiRequestBody) }) + "\n");
  });
});
await new Promise((resolvePromise) => apiServer.listen(0, "127.0.0.1", resolvePromise));
const apiPort = apiServer.address().port;
const reviewedApiRequestPath = join(smokeRoot, "reviewed-api-request.json");
writeFileSync(
  reviewedApiRequestPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_application_api_request_v1",
      teacherReviewed: true,
      method: "POST",
      url: `http://127.0.0.1:${apiPort}/reviewed-action`,
      headers: { "content-type": "application/json" },
      bodyJson: { action: "teacher-reviewed-api-call", value: 42 },
      targetResponseFileName: "teacher-reviewed-api-response.json",
      expectedStatus: 200,
      timeoutMs: 5000
    },
    null,
    2
  ),
  "utf8"
);
const apiRouteResult = JSON.parse(
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      join(__dirname, "create-existing-software-execution-adapter.mjs"),
      "--goal",
      "Call a teacher-reviewed local application API for target software using existing API route.",
      "--software",
      "Generic local API-capable app",
      "--action-plan",
      actionPlanPath,
      "--capability-profile",
      apiCapabilityProfilePath,
      "--preferred-adapter",
      "existing-application-api",
      "--output-dir",
      join(smokeRoot, "api-route")
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => {
      if (code !== 0) rejectPromise(new Error(stderr || stdout || "api route adapter selection failed"));
      else resolvePromise(stdout);
    });
  })
);
const apiExecutionPackage = JSON.parse(readFileSync(apiRouteResult.executionPackagePath, "utf8"));
const apiRunner = apiExecutionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-application-api");
const apiDryRunProcess = apiRunner
  ? spawnSync(process.execPath, [apiRunner.runnerPath], { cwd: repoRoot, encoding: "utf8" })
  : { status: 1, stdout: "", stderr: "missing api runner" };
if (apiDryRunProcess.status !== 0) throw new Error(apiDryRunProcess.stderr || apiDryRunProcess.stdout || "api dry-run failed");
const apiDryRun = JSON.parse(apiDryRunProcess.stdout);
const apiExecuteOutput = apiRunner
  ? await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, [apiRunner.runnerPath, "--teacher-confirmed", "--execute", "--reviewed-api-request", reviewedApiRequestPath], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("exit", (code) => {
        if (code !== 0) rejectPromise(new Error(stderr || stdout || "api route execute failed"));
        else resolvePromise(stdout);
      });
    })
  : null;
apiServer.close();
if (!apiExecuteOutput) throw new Error("missing api runner");
const apiExecuteResult = JSON.parse(apiExecuteOutput);
const apiExecuteReceipt = apiRunner ? JSON.parse(readFileSync(apiRunner.receiptPath, "utf8")) : null;
const apiRouteVerification = apiRunner
  ? JSON.parse(
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [
          join(__dirname, "verify-supervised-action-outcome.mjs"),
          "--receipt",
          apiRunner.receiptPath,
          "--output-dir",
          join(smokeRoot, "api-route-verification")
        ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("exit", (code) => {
          if (code !== 0) rejectPromise(new Error(stderr || stdout || "api route outcome verification failed"));
          else resolvePromise(stdout);
        });
      })
    )
  : null;

const checks = [
  {
    name: "Direct script selects an existing execution adapter before UI fallback",
    pass:
      directResult.format === "transparent_ai_existing_software_execution_adapter_selection_result_v1" &&
      directSelection.format === "transparent_ai_existing_software_execution_adapter_selection_v1" &&
      directSelection.selectedAdapters.some((adapter) => adapter.id === "existing-windows-ui-automation") &&
      directSelection.recommendedRoute.dryRunFirst === true,
    evidence: directResult.selectionPath
  },
  {
    name: "Windows UI route delegates reviewed action plans to a dry-run-first supervised runner",
    pass:
      windowsRunner?.routeReadiness?.readyForDryRun === true &&
      windowsRunner?.routeReadiness?.readyForExecution === false &&
      windowsRunner?.routeReadiness?.executeBlocker === "missing_target_window_or_low_token_verifier" &&
      windowsRunner?.routeReadiness?.requiredEvidenceBeforeExecute?.includes("reviewed target window title") &&
      windowsDryRun?.status === "dry_run_no_ui_events" &&
      windowsDryRunReceipt?.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      windowsDryRunReceipt?.uiEventsSent === false &&
      windowsDryRunPreflight?.format === "transparent_ai_existing_windows_ui_preflight_v1" &&
      windowsRunnerText.includes("teacher_confirmed_windows_ui_actions_sent") &&
      windowsRunnerText.includes("SetCursorPos") &&
      windowsRunnerText.includes("SendKeys"),
    evidence: windowsRunner?.receiptPath || "missing"
  },
  {
    name: "Windows UI execute request blocks before UI events when active window preflight fails",
    pass:
      windowsBlockedExecute?.status === "blocked_by_preflight" &&
      windowsBlockedReceipt?.status === "blocked_by_preflight" &&
      windowsBlockedReceipt?.uiEventsSent === false &&
      windowsBlockedPreflight?.executeAllowed === false &&
      windowsBlockedPreflight?.activeWindowTitleMatched === false &&
      windowsBlockedPreflight?.blockReasons?.includes("active window title mismatch"),
    evidence: windowsBlockedReceipt?.preflightPath || "missing"
  },
  {
    name: "Adapter selection prefers browser automation when teacher intent targets a web app",
    pass:
      mcp.result.primaryAdapterId === "existing-browser-automation" &&
      mcpSelection.selectedAdapters[0]?.id === "existing-browser-automation",
    evidence: mcp.result.primaryAdapterId
  },
  {
    name: "Selection package keeps execution and acceptance gates closed",
    pass:
      mcpSelection.locks.reviewOnly === true &&
      mcpSelection.locks.noAutonomousExecution === true &&
      mcpSelection.locks.nativeUniversalExecution === false &&
      mcpSelection.locks.ruleEnabled === false &&
      mcpSelection.locks.accepted === false &&
      mcpSelection.locks.packagingGated === true,
    evidence: JSON.stringify(mcpSelection.locks)
  },
  {
    name: "Selection package generates dry-run-first existing execution runners",
    pass:
      mcp.result.executionPackagePath &&
      executionPackage.format === "transparent_ai_existing_software_execution_package_v1" &&
      executionPackage.locks.dryRunDefault === true &&
      executionPackage.existingTechnologyPolicy?.preferStructuredRoutesBeforeUiEvents === true &&
      executionPackage.existingTechnologyPolicy?.routeReadinessRequiredBeforeExecute === true &&
      executionPackage.existingTechnologyPolicy?.noGuessingSelectorsCommandsPayloadsOrWindows === true &&
      executionPackage.runnerEntries.some((entry) => entry.adapterId === "existing-browser-automation") &&
      executionPackage.runnerEntries.every((entry) =>
        entry.teacherConfirmationRequired === true &&
        entry.executeFlagRequired === true &&
        entry.routeReadiness?.readyForDryRun === true &&
        entry.routeReadiness?.teacherReviewRequired === true &&
        Array.isArray(entry.proofChecklist) &&
        entry.proofChecklist.length > 0
      ),
    evidence: mcp.result.executionPackagePath
  },
  {
    name: "Execution package blocks real route execution until reviewed route evidence exists",
    pass:
      browserRunner?.routeReadiness?.readyForExecution === false &&
      browserRunner?.executeBlocker === "missing_reviewed_browser_url_or_selectors" &&
      browserRunner?.proofChecklist?.includes("reviewed target URL") &&
      browserRunner?.routeReadiness?.lowTokenVerificationSignals?.includes("metadata-only log or file delta"),
    evidence: JSON.stringify(browserRunner?.routeReadiness || {})
  },
  {
    name: "Generated browser automation runner writes a dry-run receipt without browser events",
    pass:
      browserDryRun?.status === "dry_run_no_browser_events" &&
      browserReceipt?.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      browserReceipt?.uiEventsSent === false &&
      browserReceipt?.browserAutomationAttempted === false &&
      browserReceipt?.locks?.nativeUniversalExecution === false,
    evidence: browserRunner?.receiptPath || "missing"
  },
  {
    name: "Browser route can apply a reviewed local DOM operation after teacher-confirmed execute",
    pass:
      browserDomRouteResult.primaryAdapterId === "existing-browser-automation" &&
      browserDomRunner?.routeReadiness?.readyForExecution === true &&
      browserDomDryRun?.status === "dry_run_no_browser_events" &&
      browserDomExecuteResult?.status === "teacher_confirmed_browser_dom_operation_applied" &&
      browserDomExecuteReceipt?.browserDomOperationApplied === true &&
      browserDomExecuteReceipt?.uiEventsSent === false &&
      browserDomExecuteReceipt?.sourceSha256 === expectedBrowserSourceSha256 &&
      existsSync(browserDomExecuteReceipt?.browserDomOutputPath || "") &&
      readFileSync(browserDomExecuteReceipt?.browserDomOutputPath || "", "utf8").includes("teacher reviewed browser value") &&
      browserDomExecuteReceipt?.locks?.nativeUniversalExecution === false,
    evidence: browserDomRunner?.receiptPath || "missing"
  },
  {
    name: "Outcome verifier accepts teacher-confirmed browser DOM receipts without unlocking learning",
    pass:
      browserDomRouteVerification?.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      browserDomRouteVerification?.status === "execution_receipt_waiting_for_teacher_review",
    evidence: browserDomRouteVerification?.verificationPath || "missing"
  },
  {
    name: "Browser route can apply a reviewed localhost CDP setText operation after teacher-confirmed execute",
    pass:
      browserCdpRouteResult.primaryAdapterId === "existing-browser-automation" &&
      browserCdpRunner?.routeReadiness?.readyForExecution === true &&
      browserCdpExecuteResult?.status === "teacher_confirmed_browser_cdp_setText_applied" &&
      browserCdpExecuteReceipt?.browserCdpOperationApplied === true &&
      browserCdpExecuteReceipt?.browserAutomationAttempted === true &&
      browserCdpExecuteReceipt?.uiEventsSent === false &&
      browserCdpExecuteReceipt?.cdpWebSocketUrl?.startsWith("ws://127.0.0.1:") &&
      existsSync(browserCdpExecuteReceipt?.cdpResponsePath || "") &&
      browserCdpExecuteReceipt?.cdpResultSha256 === sha256(browserCdpExecuteReceipt?.cdpResponsePath || "") &&
      mockCdp.receivedCommands.some((command) => command.method === "Runtime.evaluate") &&
      mockCdp.receivedCommands.some((command) => String(command.params?.expression || "").includes("document.querySelector")) &&
      browserCdpExecuteReceipt?.locks?.nativeUniversalExecution === false,
    evidence: browserCdpRunner?.receiptPath || "missing"
  },
  {
    name: "Outcome verifier accepts teacher-confirmed browser CDP receipts without unlocking learning",
    pass:
      browserCdpRouteVerification?.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      browserCdpRouteVerification?.status === "execution_receipt_waiting_for_teacher_review",
    evidence: browserCdpRouteVerification?.verificationPath || "missing"
  },
  {
    name: "File import/export route can prepare a reviewed import file after teacher-confirmed execute",
    pass:
      fileRouteResult.primaryAdapterId === "existing-file-import-export" &&
      fileRunner?.routeReadiness?.readyForExecution === true &&
      fileDryRun?.status === "dry_run_no_files_written" &&
      fileExecuteResult?.status === "teacher_confirmed_file_prepared_for_import" &&
      fileExecuteReceipt?.filesWrittenForImport === true &&
      existsSync(fileExecuteReceipt?.preparedImportFilePath || "") &&
      fileExecuteReceipt?.sourceSha256 === expectedSourceSha256 &&
      fileExecuteReceipt?.preparedFileSha256 === expectedSourceSha256 &&
      fileExecuteReceipt?.locks?.nativeUniversalExecution === false,
    evidence: fileRunner?.receiptPath || "missing"
  },
  {
    name: "Outcome verifier accepts teacher-confirmed file route receipts without unlocking learning",
    pass:
      fileRouteVerification?.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      fileRouteVerification?.status === "execution_receipt_waiting_for_teacher_review",
    evidence: fileRouteVerification?.verificationPath || "missing"
  },
  {
    name: "CLI/script route can run a reviewed Node script after teacher-confirmed execute",
    pass:
      cliRouteResult.primaryAdapterId === "existing-cli-or-script" &&
      cliRunner?.routeReadiness?.readyForExecution === true &&
      cliDryRun?.status === "dry_run_no_command_executed" &&
      cliExecuteResult?.status === "teacher_confirmed_cli_script_executed" &&
      cliExecuteReceipt?.commandExecuted === true &&
      cliExecuteReceipt?.scriptSha256 === expectedScriptSha256 &&
      existsSync(cliExecuteReceipt?.cliOutputPath || "") &&
      cliExecuteReceipt?.locks?.nativeUniversalExecution === false,
    evidence: cliRunner?.receiptPath || "missing"
  },
  {
    name: "Outcome verifier accepts teacher-confirmed CLI route receipts without unlocking learning",
    pass:
      cliRouteVerification?.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      cliRouteVerification?.status === "execution_receipt_waiting_for_teacher_review",
    evidence: cliRouteVerification?.verificationPath || "missing"
  },
  {
    name: "Application API route can call a reviewed local API after teacher-confirmed execute",
    pass:
      apiRouteResult.primaryAdapterId === "existing-application-api" &&
      apiRunner?.routeReadiness?.readyForExecution === true &&
      apiDryRun?.status === "dry_run_no_api_request_sent" &&
      apiExecuteResult?.status === "teacher_confirmed_api_request_completed" &&
      apiExecuteReceipt?.apiRequestSent === true &&
      apiExecuteReceipt?.responseStatus === 200 &&
      existsSync(apiExecuteReceipt?.responseBodyPath || "") &&
      apiExecuteReceipt?.responseSha256 === sha256(apiExecuteReceipt?.responseBodyPath || "") &&
      apiExecuteReceipt?.locks?.nativeUniversalExecution === false,
    evidence: apiRunner?.receiptPath || "missing"
  },
  {
    name: "Outcome verifier accepts teacher-confirmed API route receipts without unlocking learning",
    pass:
      apiRouteVerification?.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      apiRouteVerification?.status === "execution_receipt_waiting_for_teacher_review",
    evidence: apiRouteVerification?.verificationPath || "missing"
  },
  {
    name: "MCP advanced mode exposes existing software execution adapter selector",
    pass:
      advancedNames.includes("create_existing_software_execution_adapter") &&
      mcp.result.format === "transparent_ai_existing_software_execution_adapter_selection_result_v1" &&
      mcp.list.tools.length >= 56,
    evidence: `mode=advanced; count=${mcp.list.tools.length}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_existing_software_execution_adapter_smoke_v1",
  checks,
  advancedToolCount: mcp.list.tools.length
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
