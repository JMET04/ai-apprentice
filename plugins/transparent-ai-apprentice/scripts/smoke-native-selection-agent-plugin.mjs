#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contextActionToMaskPacket,
  createNativeContextAction,
  getNativeSelection,
  ingestLatestNativeSelection,
  validateNativeSelection
} from "./native-selection-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "native-selection-agent-plugin");
mkdirSync(root, { recursive: true });
const runRoot = mkdtempSync(join(root, "run-"));
const inbox = join(runRoot, "inbox");
const selectionStore = join(runRoot, "native-selection-store.json");
const correctionStore = join(runRoot, "mask-correction-store.json");
mkdirSync(inbox, { recursive: true });

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const wordFixture = {
  host: {
    application: "Microsoft Word",
    version: "fixture",
    documentName: "项目周报.docx",
    documentPath: join(runRoot, "项目周报.docx"),
    sessionId: "word-fixture"
  },
  selection: {
    nativeKind: "word_range",
    nativeLocator: "paragraph:2/range:18-20",
    text: "周五",
    range: { start: 18, end: 20, storyType: 1 },
    contextBefore: "本方案将在",
    contextAfter: "提交审核。",
    properties: { paragraph: 2, style: "正文", fontName: "宋体", fontSize: 11 },
    relationships: ["active Word document", "exact COM range"],
    protectedObjectIds: ["word-content-before-range:18", "word-content-after-range:20"]
  }
};
const fixturePath = join(runRoot, "word-fixture.json");
writeFileSync(fixturePath, JSON.stringify(wordFixture, null, 2), "utf8");
const wordCapture = spawnSync("powershell", [
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", join(pluginRoot, "host-bridges", "word", "capture-word-selection.ps1"),
  "-Trigger", "test_fixture",
  "-FixturePath", fixturePath,
  "-InboxPath", inbox,
  "-NoOpenCodex"
], { cwd: repoRoot, encoding: "utf8" });
if (wordCapture.status !== 0) throw new Error(wordCapture.stderr || wordCapture.stdout);
const wordCaptureResult = JSON.parse(wordCapture.stdout.replace(/^\uFEFF/, ""));
const wordSnapshot = JSON.parse(readFileSync(wordCaptureResult.selectionPath, "utf8").replace(/^\uFEFF/, ""));
check("Word COM bridge fixture writes the native selection contract", validateNativeSelection(wordSnapshot).ok, wordCaptureResult.selectionPath);
check("Word selection keeps exact text and range locator", wordSnapshot.selection.text === "周五" && wordSnapshot.selection.nativeLocator.includes("range:18-20"));
check("Native capture is bound to the host Agent with no model API or API key", wordCaptureResult.ownApiStarted === false && wordSnapshot.executionBoundary.mode === "host_agent_plugin" && wordSnapshot.executionBoundary.reasoningOwner === "host_agent" && wordSnapshot.executionBoundary.modelApiRequired === false && wordSnapshot.executionBoundary.apiKeyRequired === false);
check("Native capture disables screen control by default", wordSnapshot.interactionPreference.allowScreenControl === false);

class McpClient {
  constructor() {
    this.child = spawn(process.execPath, [join(pluginRoot, "scripts", "mcp-server.mjs")], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.nextId = 1;
    this.buffer = "";
    this.pending = new Map();
    this.child.stdout.on("data", chunk => {
      this.buffer += chunk.toString("utf8");
      let newline;
      while ((newline = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        const waiter = this.pending.get(message.id);
        if (!waiter) continue;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      }
    });
  }

  rpc(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(new Error(`MCP timeout: ${method}`));
      }, 15000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolvePromise(value); },
        reject: error => { clearTimeout(timeout); rejectPromise(error); }
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

function toolJson(result) {
  return JSON.parse(result.content[0].text);
}

const client = new McpClient();
try {
  await client.rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "native-selection-smoke", version: "1" } });
  const listed = await client.rpc("tools/list");
  const toolNames = listed.tools.map(tool => tool.name);
  check("Default Agent plugin surface exposes native selection management", toolNames.includes("manage_native_selection"), toolNames.join(","));
  const nativeTool = listed.tools.find(tool => tool.name === "manage_native_selection");
  check("Native selection tool exposes separate reviewed Word and AutoCAD live execution routes", nativeTool?.inputSchema?.properties?.action?.enum?.includes("execute_word_live") && nativeTool?.inputSchema?.properties?.action?.enum?.includes("execute_autocad_live"));

  const ingested = toolJson(await client.rpc("tools/call", {
    name: "manage_native_selection",
    arguments: { action: "read_latest", inboxPath: inbox, selectionStorePath: selectionStore }
  }));
  check("Agent plugin ingests the latest host selection file", ingested.snapshot.selection.text === "周五", ingested.id);

  const workbench = toolJson(await client.rpc("tools/call", {
    name: "manage_native_selection",
    arguments: { action: "create_workbench", id: ingested.id, selectionStorePath: selectionStore, outputDir: join(runRoot, "generated-workbenches") }
  }));
  check("Agent plugin creates the refined self-contained workbench for the exact selection", workbench.surface === "office" && workbench.selectionId === ingested.id && workbench.hostAgentPlugin === true && workbench.modelApiRequired === false && existsSync(workbench.outputPath), workbench.outputPath);

  const action = toolJson(await client.rpc("tools/call", {
    name: "manage_native_selection",
    arguments: {
      action: "create_action",
      id: ingested.id,
      instruction: "只把周五改成周一，其他内容和格式保持不变。",
      teacherInstructionRevision: 2,
      handoffRequestedAt: new Date().toISOString(),
      interactionPreference: { backgroundPreparation: true, allowScreenControl: false, keepHostDocumentOpen: true },
      requestedChange: { operation: "replace_text", replacementText: "周一" },
      selectionStorePath: selectionStore
    }
  }));
  check("Agent plugin creates a bounded native diff preview", action.preview.before === "周五" && action.preview.after === "周一");
  check("Context action remains review-only before submission", action.status === "draft_preview_waiting_for_teacher_submit" && action.accepted === false);
  check("Context action keeps the host Agent as the sole reasoning owner", action.executionBoundary.reasoningOwner === "host_agent" && action.executionBoundary.modelApiRequired === false);
  check("Incremental opinion revision remains auditable and background-ready", action.teacherInstructionRevision === 2 && action.preparationMode === "background");
  check("Screen control remains disabled unless the teacher explicitly opts in", action.screenControlPolicy === "disabled" && action.interactionPreference.allowScreenControl === false);

  const submitted = toolJson(await client.rpc("tools/call", {
    name: "manage_native_selection",
    arguments: {
      action: "submit_action",
      id: action.id,
      selectionStorePath: selectionStore,
      correctionStorePath: correctionStore
    }
  }));
  check("Native context action submits into the existing teacher review task chain", submitted.correction.status === "pending_teacher_review", submitted.correction.id);
  check("Submitted native task preserves exact Word target", submitted.correction.packet.source.nativeLocator.includes("range:18-20") && submitted.correction.packet.correction.replacementText === "周一");
} finally {
  client.close();
}

const engineeringSnapshot = {
  format: "ai_apprentice_native_selection_v1",
  surfaceKind: "engineering_native_object",
  host: { application: "AICAD / AutoCAD", version: "25.0", documentName: "包装箱.dwg", documentPath: "D:/cases/包装箱.dwg" },
  selection: {
    nativeKind: "autocad_entity_or_subentity",
    nativeLocator: "handle:4A2/pick:[450,120,0]",
    objectId: "D04",
    objectType: "DIMENSION",
    properties: { handle: "4A2", layer: "AICAD_DIM", measurement: 420, unit: "mm" },
    relationships: ["drawing-handle:4A2", "layer:AICAD_DIM"],
    protectedObjectIds: ["D08", "D10"]
  },
  capture: { trigger: "right_click", adapter: "aicad_autocad_xdata_selection_bridge_v1", capturedAt: new Date().toISOString() },
  interactionPreference: { backgroundPreparation: true, allowScreenControl: false, keepHostDocumentOpen: true },
  executionBoundary: { mode: "host_agent_plugin", reasoningOwner: "host_agent", modelApiRequired: false, apiKeyRequired: false, companionRole: "capture_and_handoff_only" },
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
};
const engineeringPath = join(inbox, "selection-aicad-fixture.json");
writeFileSync(engineeringPath, JSON.stringify(engineeringSnapshot, null, 2), "utf8");
const engineeringRecord = ingestLatestNativeSelection({ filePath: engineeringPath, storePath: selectionStore });
const engineeringAction = createNativeContextAction({
  selectionId: engineeringRecord.id,
  instruction: "只把 D04 改为 450 mm，保护 D08、D10。",
  requestedChange: { operation: "set_dimension", targetValue: 450, unit: "mm" },
  storePath: selectionStore
});
const engineeringPacket = contextActionToMaskPacket({
  action: engineeringAction,
  selection: getNativeSelection({ id: engineeringRecord.id, storePath: selectionStore })
});
check("Engineering selection maps XData object id into a bounded change", engineeringPacket.target.objectId === "D04" && engineeringPacket.target.targetValue === 450);
check("Engineering native packet preserves protected object ids", engineeringPacket.invariants.protectObjectIds.join(",") === "D08,D10");
check("Reviewed correction handoff preserves the Agent-plugin boundary", engineeringPacket.executionBoundary.mode === "host_agent_plugin" && engineeringPacket.executionBoundary.apiKeyRequired === false);

const wordMacroText = readFileSync(join(pluginRoot, "host-bridges", "word", "CAIApprenticeEvents.cls"), "utf8");
const aicadLispText = readFileSync(join(pluginRoot, "host-bridges", "aicad", "AI_Apprentice_Selection.lsp"), "utf8");
const companionText = readFileSync(join(pluginRoot, "assets", "desktop-companion", "AI-Apprentice-Companion.ps1"), "utf8");
const serviceText = readFileSync(join(pluginRoot, "scripts", "mask-correction-service.mjs"), "utf8");
check("Word bridge uses the real right-click event without suppressing Word menu", wordMacroText.includes("App_WindowBeforeRightClick") && wordMacroText.includes("Cancel = False"));
check("AICAD bridge reads selected or clicked entities through native APIs", aicadLispText.includes(":vlr-beginRightClick") && aicadLispText.includes("nentselp") && aicadLispText.includes("entget"));
check("Desktop companion queues work for the current Agent without forcing a new Codex task", companionText.includes('[string]$CodexLink = ""') && companionText.includes("if ($CodexLink) { Start-Process $CodexLink }") && companionText.includes("allowScreenControl = [bool]") && !companionText.includes("codex://threads/new") && !companionText.includes("OpenAI"));
check("Desktop companion records incremental opinions without owning reasoning", companionText.includes("teacherInstructionRevision") && companionText.includes("teacherInstructionHistory") && companionText.includes("screenControlPolicy") && companionText.includes("explicit_opt_in"));
check("Native selection work adds no standalone API route", !serviceText.includes("api/native-selections") && !serviceText.includes("native-context-actions"));
check("Native protocol rejects a standalone AI execution boundary", validateNativeSelection({ ...engineeringSnapshot, executionBoundary: { ...engineeringSnapshot.executionBoundary, reasoningOwner: "desktop_companion" } }).ok === false);

const passed = checks.filter(item => item.pass).length;
const result = {
  format: "ai_apprentice_native_selection_agent_plugin_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  runRoot,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
