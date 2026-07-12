import crypto from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
};

const allowedSurfaceKinds = new Set(["office_native_text", "engineering_native_object", "packaging_image_mask"]);
const allowedReviewDecisions = new Set([
  "needs_changes",
  "approved_for_separate_execution",
  "blocked"
]);
const allowedResultStatuses = new Set(["succeeded", "failed", "blocked"]);

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
  if (handle === undefined) throw new Error(`Could not acquire correction store lock: ${lockPath}`);
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
  return {
    format: "ai_apprentice_mask_correction_store_v1",
    records: []
  };
}

function readStore(path) {
  if (!existsSync(path)) return defaultStore();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (parsed?.format !== "ai_apprentice_mask_correction_store_v1" || !Array.isArray(parsed.records)) {
    throw new Error("Mask correction store has an unsupported format.");
  }
  return parsed;
}

function event(type, data = {}) {
  return { type, at: new Date().toISOString(), ...data };
}

function publicRecord(record) {
  return {
    ...record,
    locks: { ...locks }
  };
}

export function resolveCorrectionStorePath(path = "") {
  return resolve(
    path || process.env.AI_APPRENTICE_MASK_CORRECTION_STORE ||
      ".transparent-apprentice/mask-corrections/store.json"
  );
}

export function validateMaskCorrectionPacket(packet) {
  const errors = [];
  if (packet?.format !== "mingtu_multimodal_surgical_mask_correction_v1") {
    errors.push("format must be mingtu_multimodal_surgical_mask_correction_v1");
  }
  if (!allowedSurfaceKinds.has(packet?.surfaceKind)) {
    errors.push("surfaceKind must be office_native_text, engineering_native_object, or packaging_image_mask");
  }
  for (const [key, expected] of Object.entries(locks)) {
    if (packet?.[key] !== expected) errors.push(`${key} must be ${expected}`);
  }
  if (!Array.isArray(packet?.maskSemantics?.modify) || packet.maskSemantics.modify.length === 0) {
    errors.push("at least one modify mask is required");
  }
  if (packet?.surfaceKind === "office_native_text") {
    if (!packet?.source?.nativeLocator?.trim()) errors.push("Office nativeLocator is required");
    if (!packet?.correction?.operation) errors.push("Office correction operation is required");
  }
  if (packet?.surfaceKind === "engineering_native_object") {
    if (!packet?.target?.objectId?.trim()) errors.push("engineering objectId is required");
    const operation = packet?.target?.action;
    if (!new Set(["set_dimension", "offset_face", "change_property", "move_object"]).has(operation)) {
      errors.push("engineering action is unsupported");
    }
    if (new Set(["set_dimension", "offset_face"]).has(operation) && !Number.isFinite(packet?.target?.targetValue)) {
      errors.push("engineering targetValue must be numeric for dimension or face changes");
    }
    if (new Set(["set_dimension", "offset_face"]).has(operation) && !packet?.target?.unit) {
      errors.push("engineering unit is required for dimension or face changes");
    }
    if (operation === "change_property" && !packet?.target?.propertyName) {
      errors.push("engineering propertyName is required for property changes");
    }
    if (operation === "move_object") {
      const delta = packet?.target?.delta;
      if (!delta || ![delta.x, delta.y, delta.z].every(Number.isFinite)) {
        errors.push("engineering delta x/y/z must be numeric for object moves");
      }
    }
  }
  if (packet?.surfaceKind === "packaging_image_mask") {
    if (typeof packet?.maskDataUrl !== "string" || !packet.maskDataUrl.startsWith("data:image/")) {
      errors.push("packaging maskDataUrl must be an image data URL");
    }
    if (!packet?.teacherNote?.trim()) errors.push("packaging teacherNote is required");
  }
  return { ok: errors.length === 0, errors, locks: { ...locks } };
}

export function submitMaskCorrection({ packet, metadata = {}, storePath = "" }) {
  const validation = validateMaskCorrectionPacket(packet);
  if (!validation.ok) throw new Error(`Invalid mask correction: ${validation.errors.join("; ")}`);
  const path = resolveCorrectionStorePath(storePath);
  const packetText = JSON.stringify(packet);
  const packetSha256 = sha256(packetText);
  return withFileLock(path, () => {
    const store = readStore(path);
    const duplicate = store.records.find(
      item => item.packetSha256 === packetSha256 && item.status !== "closed"
    );
    if (duplicate) return { ...publicRecord(duplicate), idempotent: true, storePath: path };
    const createdAt = new Date().toISOString();
    const record = {
      format: "ai_apprentice_mask_correction_record_v1",
      id: `mask-${Date.now()}-${packetSha256.slice(0, 8)}`,
      surfaceKind: packet.surfaceKind,
      status: "pending_teacher_review",
      packetSha256,
      packet,
      metadata,
      submissionAttempts: 1,
      review: null,
      result: null,
      events: [event("submitted", { packetSha256 })],
      createdAt,
      updatedAt: createdAt,
      locks: { ...locks }
    };
    store.records.push(record);
    writeJsonAtomic(path, store);
    return { ...publicRecord(record), idempotent: false, storePath: path };
  });
}

export function getMaskCorrection({ id, storePath = "" }) {
  const path = resolveCorrectionStorePath(storePath);
  const record = readStore(path).records.find(item => item.id === id);
  return record ? { ...publicRecord(record), storePath: path } : null;
}

export function listMaskCorrections({ storePath = "", status = "", limit = 50 } = {}) {
  const path = resolveCorrectionStorePath(storePath);
  const records = readStore(path).records
    .filter(item => !status || item.status === status)
    .slice(-Math.max(1, Math.min(Number(limit) || 50, 200)))
    .reverse()
    .map(publicRecord);
  return { format: "ai_apprentice_mask_correction_list_v1", records, storePath: path, locks: { ...locks } };
}

export function reviewMaskCorrection({ id, decision, note = "", reviewer = "teacher", storePath = "" }) {
  if (!allowedReviewDecisions.has(decision)) {
    throw new Error(`Unsupported review decision: ${decision}`);
  }
  const path = resolveCorrectionStorePath(storePath);
  return withFileLock(path, () => {
    const store = readStore(path);
    const record = store.records.find(item => item.id === id);
    if (!record) throw new Error(`Mask correction not found: ${id}`);
    const statusByDecision = {
      needs_changes: "needs_changes",
      approved_for_separate_execution: "reviewed_ready_for_separate_execution",
      blocked: "blocked"
    };
    record.review = { decision, note, reviewer, reviewedAt: new Date().toISOString(), accepted: false };
    record.status = statusByDecision[decision];
    record.updatedAt = record.review.reviewedAt;
    record.events.push(event("teacher_reviewed", { decision, reviewer, note }));
    record.locks = { ...locks };
    writeJsonAtomic(path, store);
    return { ...publicRecord(record), storePath: path };
  });
}

export function retryMaskCorrection({ id, reason = "manual_retry", storePath = "" }) {
  const path = resolveCorrectionStorePath(storePath);
  return withFileLock(path, () => {
    const store = readStore(path);
    const record = store.records.find(item => item.id === id);
    if (!record) throw new Error(`Mask correction not found: ${id}`);
    record.submissionAttempts += 1;
    record.status = "pending_teacher_review";
    record.updatedAt = new Date().toISOString();
    record.events.push(event("retried", { reason, attempt: record.submissionAttempts }));
    writeJsonAtomic(path, store);
    return { ...publicRecord(record), storePath: path };
  });
}

export function recordMaskCorrectionResult({ id, status, evidence = {}, note = "", storePath = "" }) {
  if (!allowedResultStatuses.has(status)) throw new Error(`Unsupported result status: ${status}`);
  const path = resolveCorrectionStorePath(storePath);
  return withFileLock(path, () => {
    const store = readStore(path);
    const record = store.records.find(item => item.id === id);
    if (!record) throw new Error(`Mask correction not found: ${id}`);
    if (status === "succeeded" && record.status !== "reviewed_ready_for_separate_execution") {
      throw new Error("A succeeded result requires approved_for_separate_execution teacher review.");
    }
    const recordedAt = new Date().toISOString();
    record.result = { status, evidence, note, recordedAt, teacherVerified: false };
    record.status = status === "succeeded"
      ? "result_succeeded_pending_teacher_verification"
      : `result_${status}`;
    record.updatedAt = recordedAt;
    record.events.push(event("result_recorded", { status, note }));
    record.locks = { ...locks };
    writeJsonAtomic(path, store);
    return { ...publicRecord(record), storePath: path };
  });
}

export const maskCorrectionLocks = Object.freeze({ ...locks });
