import crypto from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const locks = Object.freeze({
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
});

const executionBoundary = Object.freeze({
  mode: "host_agent_plugin",
  reasoningOwner: "host_agent",
  modelApiRequired: false,
  apiKeyRequired: false,
  companionRole: "capture_and_handoff_only"
});

const surfaceKinds = new Set(["office_native_text", "engineering_native_object"]);
const triggers = new Set(["right_click", "command", "desktop_companion", "test_fixture"]);
const operations = new Set([
  "replace_text",
  "delete_text",
  "set_dimension",
  "offset_face",
  "change_property",
  "move_object",
  "other"
]);

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withFileLock(path, operation) {
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true });
  let handle;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      handle = openSync(lockPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(25);
    }
  }
  if (handle === undefined) throw new Error(`Could not acquire native selection store lock: ${lockPath}`);
  try {
    return operation();
  } finally {
    closeSync(handle);
    rmSync(lockPath, { force: true });
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function defaultStore() {
  return { format: "ai_apprentice_native_selection_store_v1", selections: [], actions: [] };
}

function readStore(path) {
  if (!existsSync(path)) return defaultStore();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (
    parsed?.format !== "ai_apprentice_native_selection_store_v1" ||
    !Array.isArray(parsed.selections) ||
    !Array.isArray(parsed.actions)
  ) {
    throw new Error("Native selection store has an unsupported format.");
  }
  return parsed;
}

function event(type, data = {}) {
  return { type, at: new Date().toISOString(), ...data };
}

function publicValue(value, storePath) {
  return { ...value, executionBoundary: { ...executionBoundary }, locks: { ...locks }, storePath };
}

export function resolveNativeSelectionStorePath(path = "") {
  return resolve(
    path || process.env.AI_APPRENTICE_NATIVE_SELECTION_STORE ||
      ".transparent-apprentice/native-selections/store.json"
  );
}

export function resolveNativeSelectionInboxPath(path = "") {
  return resolve(
    path || process.env.AI_APPRENTICE_NATIVE_SELECTION_INBOX ||
      ".transparent-apprentice/native-selections/inbox"
  );
}

export function validateNativeSelection(selection) {
  const errors = [];
  if (selection?.format !== "ai_apprentice_native_selection_v1") {
    errors.push("format must be ai_apprentice_native_selection_v1");
  }
  if (!surfaceKinds.has(selection?.surfaceKind)) {
    errors.push("surfaceKind must be office_native_text or engineering_native_object");
  }
  if (!selection?.host?.application?.trim()) errors.push("host.application is required");
  if (!selection?.host?.documentName?.trim()) errors.push("host.documentName is required");
  if (!selection?.selection?.nativeKind?.trim()) errors.push("selection.nativeKind is required");
  if (!selection?.selection?.nativeLocator?.trim()) errors.push("selection.nativeLocator is required");
  if (!triggers.has(selection?.capture?.trigger)) errors.push("capture.trigger is unsupported");
  if (!selection?.capture?.adapter?.trim()) errors.push("capture.adapter is required");
  for (const [key, expected] of Object.entries(executionBoundary)) {
    if (selection?.executionBoundary?.[key] !== expected) {
      errors.push(`executionBoundary.${key} must be ${expected}`);
    }
  }
  for (const [key, expected] of Object.entries(locks)) {
    if (selection?.[key] !== expected) errors.push(`${key} must be ${expected}`);
  }
  if (selection?.surfaceKind === "office_native_text" && typeof selection?.selection?.text !== "string") {
    errors.push("Office selection.text is required");
  }
  if (selection?.surfaceKind === "engineering_native_object") {
    if (!selection?.selection?.objectId?.trim()) errors.push("Engineering selection.objectId is required");
    if (!selection?.selection?.objectType?.trim()) errors.push("Engineering selection.objectType is required");
  }
  return { ok: errors.length === 0, errors, locks: { ...locks } };
}

export function captureNativeSelection({ selection, metadata = {}, storePath = "" }) {
  const validation = validateNativeSelection(selection);
  if (!validation.ok) throw new Error(`Invalid native selection: ${validation.errors.join("; ")}`);
  const path = resolveNativeSelectionStorePath(storePath);
  return withFileLock(path, () => {
    const store = readStore(path);
    const capturedAt = selection.capture.capturedAt || new Date().toISOString();
    const normalized = {
      ...selection,
      capture: { ...selection.capture, capturedAt },
      executionBoundary: { ...executionBoundary },
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    };
    const fingerprint = sha256(JSON.stringify({
      surfaceKind: normalized.surfaceKind,
      host: normalized.host,
      selection: normalized.selection
    }));
    const id = `selection-${Date.now()}-${fingerprint.slice(0, 8)}`;
    const record = {
      format: "ai_apprentice_native_selection_record_v1",
      id,
      fingerprint,
      status: "captured_waiting_for_instruction",
      snapshot: normalized,
      metadata,
      actionIds: [],
      events: [event("native_selection_captured", { trigger: normalized.capture.trigger })],
      createdAt: capturedAt,
      updatedAt: capturedAt,
      locks: { ...locks }
    };
    store.selections.push(record);
    writeJsonAtomic(path, store);
    return publicValue(record, path);
  });
}

export function readLatestNativeSelectionFile({ filePath = "", inboxPath = "" } = {}) {
  const explicitPath = filePath ? resolve(filePath) : "";
  let selectedPath = explicitPath;
  if (!selectedPath) {
    const inbox = resolveNativeSelectionInboxPath(inboxPath);
    if (!existsSync(inbox)) throw new Error(`Native selection inbox not found: ${inbox}`);
    const candidates = readdirSync(inbox)
      .filter(name => /^selection-.*\.json$/i.test(name))
      .map(name => resolve(inbox, name))
      .filter(path => statSync(path).isFile())
      .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    selectedPath = candidates[0] || "";
  }
  if (!selectedPath || !existsSync(selectedPath)) {
    throw new Error(`Native selection file not found: ${selectedPath || "no JSON file in inbox"}`);
  }
  const selection = JSON.parse(readFileSync(selectedPath, "utf8").replace(/^\uFEFF/, ""));
  return { selection, selectionPath: selectedPath };
}

export function ingestLatestNativeSelection({ filePath = "", inboxPath = "", storePath = "" } = {}) {
  const { selection, selectionPath } = readLatestNativeSelectionFile({ filePath, inboxPath });
  return captureNativeSelection({
    selection,
    metadata: { source: "agent_plugin_native_selection_inbox", selectionPath },
    storePath
  });
}

export function getNativeSelection({ id, storePath = "" }) {
  const path = resolveNativeSelectionStorePath(storePath);
  const record = readStore(path).selections.find(item => item.id === id);
  return record ? publicValue(record, path) : null;
}

export function listNativeSelections({ storePath = "", status = "", limit = 50 } = {}) {
  const path = resolveNativeSelectionStorePath(storePath);
  const selections = readStore(path).selections
    .filter(item => !status || item.status === status)
    .slice(-Math.max(1, Math.min(Number(limit) || 50, 200)))
    .reverse()
    .map(item => publicValue(item, path));
  return { format: "ai_apprentice_native_selection_list_v1", selections, locks: { ...locks }, storePath: path };
}

export function createNativeContextAction({
  selectionId,
  instruction,
  requestedChange,
  teacherInstructionRevision = null,
  handoffRequestedAt = "",
  interactionPreference = null,
  storePath = ""
}) {
  if (!instruction?.trim()) throw new Error("Context action instruction is required.");
  if (!operations.has(requestedChange?.operation)) throw new Error("Context action operation is unsupported.");
  const path = resolveNativeSelectionStorePath(storePath);
  return withFileLock(path, () => {
    const store = readStore(path);
    const selection = store.selections.find(item => item.id === selectionId);
    if (!selection) throw new Error(`Native selection not found: ${selectionId}`);
    const createdAt = new Date().toISOString();
    const sourcePreference = interactionPreference ?? selection.snapshot.interactionPreference ?? {};
    const normalizedPreference = {
      backgroundPreparation: sourcePreference.backgroundPreparation !== false,
      allowScreenControl: sourcePreference.allowScreenControl === true,
      keepHostDocumentOpen: sourcePreference.keepHostDocumentOpen !== false
    };
    const normalizedRevision = Number.isInteger(Number(teacherInstructionRevision)) && Number(teacherInstructionRevision) > 0
      ? Number(teacherInstructionRevision)
      : null;
    const action = {
      format: "ai_apprentice_context_action_v1",
      id: `action-${Date.now()}-${sha256(`${selectionId}:${instruction}`).slice(0, 8)}`,
      selectionId,
      surfaceKind: selection.snapshot.surfaceKind,
      instruction: instruction.trim(),
      teacherInstructionRevision: normalizedRevision,
      handoffRequestedAt: handoffRequestedAt || createdAt,
      preparationMode: normalizedPreference.backgroundPreparation ? "background" : "foreground",
      screenControlPolicy: normalizedPreference.allowScreenControl ? "explicit_opt_in" : "disabled",
      interactionPreference: normalizedPreference,
      requestedChange,
      scope: "selected_native_target_only",
      executionBoundary: { ...executionBoundary },
      status: "draft_preview_waiting_for_teacher_submit",
      preview: buildContextActionPreview(selection.snapshot, requestedChange),
      correctionId: null,
      events: [event("context_action_created")],
      createdAt,
      updatedAt: createdAt,
      ...locks,
      locks: { ...locks }
    };
    store.actions.push(action);
    selection.actionIds.push(action.id);
    selection.status = "instruction_drafted";
    selection.updatedAt = createdAt;
    selection.events.push(event("instruction_drafted", {
      actionId: action.id,
      teacherInstructionRevision: normalizedRevision,
      preparationMode: action.preparationMode,
      screenControlPolicy: action.screenControlPolicy
    }));
    writeJsonAtomic(path, store);
    return publicValue(action, path);
  });
}

export function getNativeContextAction({ id, storePath = "" }) {
  const path = resolveNativeSelectionStorePath(storePath);
  const action = readStore(path).actions.find(item => item.id === id);
  return action ? publicValue(action, path) : null;
}

export function linkContextActionCorrection({ actionId, correctionId, storePath = "" }) {
  const path = resolveNativeSelectionStorePath(storePath);
  return withFileLock(path, () => {
    const store = readStore(path);
    const action = store.actions.find(item => item.id === actionId);
    if (!action) throw new Error(`Native context action not found: ${actionId}`);
    const selection = store.selections.find(item => item.id === action.selectionId);
    const updatedAt = new Date().toISOString();
    action.correctionId = correctionId;
    action.status = "submitted_pending_teacher_review";
    action.updatedAt = updatedAt;
    action.events.push(event("submitted_as_correction", { correctionId }));
    if (selection) {
      selection.status = "correction_pending_teacher_review";
      selection.updatedAt = updatedAt;
      selection.events.push(event("correction_submitted", { actionId, correctionId }));
    }
    writeJsonAtomic(path, store);
    return publicValue(action, path);
  });
}

export function buildContextActionPreview(snapshot, requestedChange) {
  if (snapshot.surfaceKind === "office_native_text") {
    return {
      kind: "office_text_diff",
      locator: snapshot.selection.nativeLocator,
      before: snapshot.selection.text,
      after: requestedChange.operation === "delete_text" ? "" : String(requestedChange.replacementText ?? ""),
      unchanged: ["document content outside the selected range", "styles", "tables", "formulas", "comments"]
    };
  }
  return {
    kind: "engineering_object_diff",
    objectId: snapshot.selection.objectId,
    objectType: snapshot.selection.objectType,
    before: snapshot.selection.properties ?? {},
    requestedChange,
    protectedObjectIds: snapshot.selection.protectedObjectIds ?? [],
    unchanged: ["unselected objects", "constraints", "topology", "annotations"]
  };
}

export function contextActionToMaskPacket({ action, selection }) {
  if (!action || !selection) throw new Error("Context action and native selection are required.");
  const nativeMark = {
    id: `native-${selection.id}`,
    semantic: "modify",
    tool: "native_selection",
    selectionId: selection.id,
    nativeLocator: selection.snapshot.selection.nativeLocator
  };
  if (selection.snapshot.surfaceKind === "office_native_text") {
    return {
      format: "mingtu_multimodal_surgical_mask_correction_v1",
      surfaceKind: "office_native_text",
      executionBoundary: { ...executionBoundary },
      createdAt: new Date().toISOString(),
      source: {
        officeType: "docx",
        fileName: selection.snapshot.host.documentName,
        documentPath: selection.snapshot.host.documentPath ?? "",
        nativeLocator: selection.snapshot.selection.nativeLocator,
        selectionId: selection.id
      },
      correction: {
        operation: action.requestedChange.operation === "delete_text" ? "delete_text" : "replace_text",
        originalText: selection.snapshot.selection.text,
        replacementText: action.requestedChange.operation === "delete_text"
          ? ""
          : String(action.requestedChange.replacementText ?? ""),
        teacherInstruction: action.instruction
      },
      maskSemantics: { modify: [nativeMark], protect: [], reference: [] },
      invariants: {
        defaultScope: "only_selected_native_locator",
        preserveOtherParagraphsCells: true,
        preserveFormulasStylesStructure: true
      },
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    };
  }
  return {
    format: "mingtu_multimodal_surgical_mask_correction_v1",
    surfaceKind: "engineering_native_object",
    executionBoundary: { ...executionBoundary },
    createdAt: new Date().toISOString(),
    target: {
      objectType: selection.snapshot.selection.objectType,
      objectId: selection.snapshot.selection.objectId,
      action: action.requestedChange.operation,
      targetValue: action.requestedChange.targetValue === undefined ? null : Number(action.requestedChange.targetValue),
      unit: action.requestedChange.unit || selection.snapshot.selection.properties?.unit || "mm",
      propertyName: action.requestedChange.propertyName || null,
      propertyValue: action.requestedChange.propertyValue ?? null,
      delta: action.requestedChange.delta ?? null,
      constraints: action.instruction,
      selectionId: selection.id
    },
    maskSemantics: { modify: [nativeMark], protect: [], reference: [] },
    invariants: {
      defaultScope: "only_selected_engineering_object",
      protectObjectIds: selection.snapshot.selection.protectedObjectIds ?? [],
      referenceRelations: selection.snapshot.selection.relationships ?? [],
      preserveOtherEntities: true,
      preserveConstraintsTopologyText: true
    },
    execution: {
      mode: "teacher_review_only",
      requiresSoftwareAdapter: true,
      adapterHint: selection.snapshot.capture.adapter
    },
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

export const nativeSelectionLocks = locks;
export const nativeSelectionExecutionBoundary = executionBoundary;
