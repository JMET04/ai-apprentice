#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bridgeRoot = join(pluginRoot, "host-bridges", "aicad-managed");
const sourcePath = join(bridgeRoot, "NativeSelectionExtension.cs");
const projectPath = join(bridgeRoot, "AI.Apprentice.AutoCAD.Selection.csproj");
const contextSourcePath = join(bridgeRoot, "ContextMenuHostExtension.cs");
const contextProjectPath = join(bridgeRoot, "AI.Apprentice.AutoCAD.ContextMenu.csproj");
const packagePath = join(bridgeRoot, "runtime", "AI.Apprentice.NativeSelection.bundle", "PackageContents.xml");
const dllPath = join(bridgeRoot, "runtime", "AI.Apprentice.NativeSelection.bundle", "Contents", "AI.Apprentice.AutoCAD.Selection.dll");
const contextDllPath = join(bridgeRoot, "runtime", "AI.Apprentice.NativeSelection.bundle", "Contents", "AI.Apprentice.AutoCAD.ContextMenu.dll");
const installerPath = join(bridgeRoot, "install-autocad-managed-selection-bridge.ps1");
const liveHostPath = join(bridgeRoot, "apply-autocad-selection.ps1");
const liveAdapterPath = join(pluginRoot, "scripts", "autocad-native-selection-adapter.mjs");
const required = [sourcePath, projectPath, contextSourcePath, contextProjectPath, packagePath, dllPath, contextDllPath, installerPath, liveHostPath, liveAdapterPath];
const source = readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
const contextSource = readFileSync(contextSourcePath, "utf8").replace(/^\uFEFF/, "");
const project = readFileSync(projectPath, "utf8");
const packageXml = readFileSync(packagePath, "utf8");
const installer = readFileSync(installerPath, "utf8").replace(/^\uFEFF/, "");
const liveHost = readFileSync(liveHostPath, "utf8").replace(/^\uFEFF/, "");
const liveAdapter = readFileSync(liveAdapterPath, "utf8").replace(/^\uFEFF/, "");
const dll = readFileSync(dllPath);
const contextDll = readFileSync(contextDllPath);
const checks = [
  ["Managed bridge delivery files exist", required.every(existsSync)],
  ["Compiled runtimes are Windows PE DLLs", dll[0] === 0x4d && dll[1] === 0x5a && dll.length > 10_000 && contextDll[0] === 0x4d && contextDll[1] === 0x5a],
  ["Core capture command is isolated from desktop UI dependencies", !project.includes("AcMgd") && !source.includes("ContextMenuExtension")],
  ["Right-click menu hands the pickset to the connected Agent", contextSource.includes("AddDefaultContextMenuExtension") && contextSource.includes("AIAPPRENTICE_CAPTURE_SELECTION")],
  ["Exact AutoCAD subentities use the selected FullSubentityPath", source.includes("selected.GetSubentities()") && source.includes("FullSubentityPath") && source.includes("SubentId")],
  ["Entity fallback never pretends to be a face", source.includes('nativeKind = subentity is null ? "autocad_entity"')],
  ["AICAD object IDs are read only from the AICAD RegApp payload", source.includes('value.TypeCode == 1001') && source.includes('"AICAD"') && source.includes("inAicadPayload")],
  ["Capture distinguishes context-menu and command triggers", source.includes("AIAPPRENTICE_CAPTURE_SELECTION_COMMAND") && source.includes('CaptureSelectionCore("command")')],
  ["Managed bridge performs guarded native line and face operations", source.includes("AIAPPRENTICE_APPLY_REQUEST") && source.includes("ValidateGeometrySnapshot") && source.includes("solid.OffsetFaces") && source.includes("documentSavedAutomatically")],
  ["Live adapter requires teacher review and uses AutoCAD native dispatch", liveAdapter.includes("reviewed_ready_for_separate_execution") && liveAdapter.includes("recordMaskCorrectionResult") && liveHost.includes("GetActiveObject(\"AutoCAD.Application\")") && liveHost.includes("AIAPPRENTICE_APPLY_REQUEST")],
  ["Runtime packet is host-Agent-only", source.includes('"host_agent_plugin", "host_agent", false, false, "capture_and_handoff_only"')],
  ["Bridge contains no model client or API key", !/OpenAI|Anthropic|OPENAI_API_KEY|ANTHROPIC_API_KEY|chat\/completions/i.test(source + contextSource)],
  ["AutoCAD bundle autoloads core and right-click components", packageXml.includes("LoadOnAutoCADStartup") && packageXml.includes("AI.Apprentice.AutoCAD.Selection.dll") && packageXml.includes("AI.Apprentice.AutoCAD.ContextMenu.dll")],
  ["Build copies only the DLL into the runtime bundle", project.includes("CopyToRuntimeBundle") && project.includes("$(TargetPath)")],
  ["Installer records the host Agent boundary", installer.includes('reasoningOwner = "host_agent"') && installer.includes('modelApiRequired = $false') && installer.includes('apiKeyRequired = $false')]
].map(([name, pass]) => ({ name, pass: Boolean(pass) }));
const passed = checks.filter(check => check.pass).length;
const result = { format: "ai_apprentice_aicad_managed_selection_bridge_smoke_v1", status: passed === checks.length ? "passed" : "failed", passed, total: checks.length, dllSha256: createHash("sha256").update(dll).digest("hex"), checks };
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
