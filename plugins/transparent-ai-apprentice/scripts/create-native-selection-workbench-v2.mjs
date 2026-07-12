#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getNativeSelection } from "./native-selection-store.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = join(pluginRoot, "assets", "native-selection-workbench-v2");
const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const surface = value("surface", "office");
const outputDir = resolve(value("output-dir", ".transparent-apprentice/native-selection-workbenches"));
const selectionId = value("selection-id");
const selectionStorePath = value("selection-store");
const submitEndpoint = value("submit-endpoint");
const surfaceDirs = {
  packaging: "packaging-mask",
  office: "office-native-selection",
  engineering: "engineering-native-selection"
};
if (!surfaceDirs[surface]) throw new Error("--surface must be packaging, office, or engineering");

const selectionRecord = selectionId ? getNativeSelection({ id: selectionId, storePath: selectionStorePath }) : null;
if (selectionId && !selectionRecord) throw new Error(`Native selection not found: ${selectionId}`);
if (selectionRecord?.snapshot?.surfaceKind === "office_native_text" && surface !== "office") {
  throw new Error("Office native selections require --surface office");
}
if (selectionRecord?.snapshot?.surfaceKind === "engineering_native_object" && surface !== "engineering") {
  throw new Error("Engineering native selections require --surface engineering");
}

const config = {
  format: "ai_apprentice_native_selection_workbench_config_v1",
  selectionId: selectionRecord?.id ?? "",
  nativeSelection: selectionRecord?.snapshot ?? null,
  submitEndpoint,
  executionBoundary: {
    mode: "host_agent_plugin",
    reasoningOwner: "host_agent",
    modelApiRequired: false,
    apiKeyRequired: false,
    companionRole: "capture_and_handoff_only"
  }
};

const surfaceRoot = join(assetRoot, surfaceDirs[surface]);
let html = readFileSync(join(surfaceRoot, "index.html"), "utf8");
const styles = [
  readFileSync(join(assetRoot, "shared", "tokens.css"), "utf8"),
  readFileSync(join(assetRoot, "shared", "assistant.css"), "utf8"),
  readFileSync(join(surfaceRoot, "styles.css"), "utf8")
].join("\n");
html = html
  .replace(/<link rel="stylesheet" href="\.\.\/shared\/tokens\.css">/, "")
  .replace(/<link rel="stylesheet" href="\.\.\/shared\/assistant\.css">/, "")
  .replace(/<link rel="stylesheet" href="styles\.css">/, `<style>${styles}</style>`);

if (surface === "packaging") {
  const image = readFileSync(join(assetRoot, "assets", "packaging-case-01.png")).toString("base64");
  html = html.replace("../assets/packaging-case-01.png", `data:image/png;base64,${image}`);
}

const assistantSource = readFileSync(join(assetRoot, "shared", "assistant-v2.js"), "utf8")
  .replace("export function initAssistant", "function initAssistant");
const appSource = readFileSync(join(surfaceRoot, "app.js"), "utf8")
  .replace(/^import \{initAssistant\} from '\.\.\/shared\/assistant-v2\.js';\s*/, "");

const boundary = config.executionBoundary;
const formalizer = surface === "office" ? `
(() => {
  const cfg = window.__MINGTU_OVERLAY_CONFIG__;
  const snapshot = cfg.nativeSelection || {};
  const selected = snapshot.selection || {};
  if (selected.text) {
    document.querySelector('#nativeSelection').textContent = selected.text;
    document.querySelector('#sourceText').textContent = selected.text;
  }
  const originalPacket = globalThis.MingTuOverlay.packet;
  globalThis.MingTuOverlay.packet = () => {
    const visual = originalPacket();
    const locator = selected.nativeLocator || visual.nativeSelection.locator;
    const originalText = selected.text || document.querySelector('#sourceText').textContent;
    const replacementText = document.querySelector('#replacementText').textContent;
    const instruction = document.querySelector('#instruction').value;
    return {
      format: 'mingtu_multimodal_surgical_mask_correction_v1',
      surfaceKind: 'office_native_text',
      createdAt: new Date().toISOString(),
      source: { officeType: 'docx', fileName: snapshot.host?.documentName || 'active-document.docx', documentPath: snapshot.host?.documentPath || '', nativeLocator: locator, selectionId: cfg.selectionId },
      correction: { operation: 'replace_text', originalText, replacementText, teacherInstruction: instruction, formatConstraints: document.querySelector('#formatConstraint').value },
      maskSemantics: { modify: [{ id: 'native-' + (cfg.selectionId || 'selection'), semantic: 'modify', tool: 'native_selection', nativeLocator: locator }], protect: [], reference: [] },
      invariants: { defaultScope: 'only_selected_native_locator', preserveOtherParagraphsCells: true, preserveFormulasStylesStructure: true },
      nativeSelection: snapshot,
      contextAction: { format: 'ai_apprentice_context_action_v1', selectionId: cfg.selectionId, instruction, requestedChange: { operation: 'replace_text', replacementText }, scope: 'selected_native_target_only', executionBoundary: cfg.executionBoundary, reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true },
      executionBoundary: cfg.executionBoundary,
      previewReady: visual.previewReady,
      reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true
    };
  };
})();` : surface === "engineering" ? `
(() => {
  const cfg = window.__MINGTU_OVERLAY_CONFIG__;
  const snapshot = cfg.nativeSelection || {};
  const selected = snapshot.selection || {};
  const originalPacket = globalThis.MingTuOverlay.packet;
  globalThis.MingTuOverlay.packet = () => {
    const visual = originalPacket();
    const instruction = document.querySelector('#instruction').value;
    const targetValue = Number(document.querySelector('#targetValue').value);
    const unit = document.querySelector('#unit').value;
    const objectId = selected.objectId || visual.nativeSelection.object.id;
    const locator = selected.nativeLocator || 'object:' + objectId;
    const operation = selected.nativeKind === 'autocad_face' ? 'offset_face' : 'set_dimension';
    return {
      format: 'mingtu_multimodal_surgical_mask_correction_v1',
      surfaceKind: 'engineering_native_object',
      createdAt: new Date().toISOString(),
      target: { objectType: selected.objectType || visual.nativeSelection.object.type, objectId, action: operation, targetValue, unit, constraints: instruction, selectionId: cfg.selectionId, nativeLocator: locator },
      maskSemantics: { modify: [{ id: 'native-' + (cfg.selectionId || 'selection'), semantic: 'modify', tool: 'native_selection', nativeLocator: locator }], protect: [], reference: [] },
      invariants: { defaultScope: 'only_selected_engineering_object', protectObjectIds: selected.protectedObjectIds || [], referenceRelations: selected.relationships || [], preserveOtherEntities: true, preserveConstraintsTopologyText: true },
      execution: { mode: 'teacher_review_only', requiresSoftwareAdapter: true, adapterHint: snapshot.capture?.adapter || '' },
      nativeSelection: snapshot,
      contextAction: { format: 'ai_apprentice_context_action_v1', selectionId: cfg.selectionId, instruction, requestedChange: { operation, targetValue, unit }, scope: 'selected_native_target_only', executionBoundary: cfg.executionBoundary, reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true },
      executionBoundary: cfg.executionBoundary,
      previewReady: visual.previewReady,
      reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true
    };
  };
})();` : `
(() => {
  const originalPacket = globalThis.MingTuOverlay.packet;
  globalThis.MingTuOverlay.packet = () => {
    const visual = originalPacket();
    return {
      ...visual,
      maskSemantics: {
        modify: [{ id: 'packaging-mask', semantic: 'modify', tool: visual.tool || 'brush' }],
        protect: [],
        reference: []
      },
      executionBoundary: window.__MINGTU_OVERLAY_CONFIG__.executionBoundary
    };
  };
})();`;

let submission = "";
const client = readFileSync(join(pluginRoot, "assets", "mask-submission-client.js"), "utf8");
const button = surface === "office" ? "#submitOffice" : surface === "engineering" ? "#submitEngineering" : "#submitReview";
const state = surface === "office" ? "#officeState" : surface === "engineering" ? "#engineeringState" : "#saveState";
submission = `${client}\nAIApprenticeMaskSubmission.install({ packet: () => MingTuOverlay.packet(), validate: () => MingTuOverlay.validate?.() ?? { valid: true }, button: document.querySelector('${button}'), stateElement: document.querySelector('${state}'), config: window.__MINGTU_OVERLAY_CONFIG__ });`;

const runtime = `<script>window.__MINGTU_OVERLAY_CONFIG__=${JSON.stringify(config).replace(/</g, "\\u003c")};</script><script>${assistantSource}\n${appSource}\n${formalizer}\n${submission}</script>`;
html = html.replace(/<script type="module" src="app\.js"><\/script>/, () => runtime);

mkdirSync(outputDir, { recursive: true });
const outputPath = join(outputDir, `${surface}-${Date.now()}-ai-apprentice-workbench.html`);
writeFileSync(outputPath, html, "utf8");
const result = {
  format: "ai_apprentice_native_selection_workbench_result_v1",
  surface,
  outputPath,
  selectionId: selectionRecord?.id ?? null,
  selfContained: true,
  hostAgentPlugin: true,
  modelApiRequired: false,
  apiKeyRequired: false,
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
};
console.log(JSON.stringify(result, null, 2));
