#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getMaskCorrection,
  listMaskCorrections,
  recordMaskCorrectionResult,
  retryMaskCorrection,
  reviewMaskCorrection,
  submitMaskCorrection,
  validateMaskCorrectionPacket
} from "./mask-correction-store.mjs";
import { startMaskCorrectionService } from "./mask-correction-service.mjs";

const root = resolve(".ta-smoke", "mask-correction-service");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const storePath = join(root, "store.json");
const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });

function packet(surfaceKind = "office_native_text") {
  return {
    format: "mingtu_multimodal_surgical_mask_correction_v1",
    surfaceKind,
    source: surfaceKind === "office_native_text" ? { nativeLocator: "paragraph:2" } : undefined,
    correction: surfaceKind === "office_native_text" ? { operation: "replace_text", originalText: "周五", replacementText: "周一" } : undefined,
    target: surfaceKind === "engineering_native_object" ? { objectId: "D04", action: "set_dimension", targetValue: 450, unit: "mm" } : undefined,
    maskSemantics: { modify: [{ id: "m1" }], protect: [], reference: [] },
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

const invalid = packet();
invalid.accepted = true;
check("Unsafe acceptance flag is rejected", !validateMaskCorrectionPacket(invalid).ok);

const submitted = submitMaskCorrection({ packet: packet(), metadata: { test: true }, storePath });
check("Office correction persists as pending teacher review", submitted.status === "pending_teacher_review" && submitted.locks.accepted === false, submitted.id);
const duplicate = submitMaskCorrection({ packet: packet(), storePath });
check("Duplicate packet submission is idempotent", duplicate.id === submitted.id && duplicate.idempotent === true);
check("Persisted correction can be replayed", getMaskCorrection({ id: submitted.id, storePath })?.events.length === 1);
check("Correction list exposes the persisted record", listMaskCorrections({ storePath }).records.length === 1);

const reviewed = reviewMaskCorrection({ id: submitted.id, decision: "approved_for_separate_execution", note: "范围正确", storePath });
check("Teacher review prepares separate execution without acceptance", reviewed.status === "reviewed_ready_for_separate_execution" && reviewed.review.accepted === false);
const result = recordMaskCorrectionResult({ id: submitted.id, status: "succeeded", evidence: { output: "edited.docx" }, storePath });
check("Execution result waits for teacher verification", result.status === "result_succeeded_pending_teacher_verification" && result.result.teacherVerified === false);
const retried = retryMaskCorrection({ id: submitted.id, reason: "teacher_requested_retry", storePath });
check("Retry increments attempts and returns to review queue", retried.submissionAttempts === 2 && retried.status === "pending_teacher_review");

const server = startMaskCorrectionService({ host: "127.0.0.1", port: 0, storePath });
await new Promise(resolveReady => server.once("listening", resolveReady));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
try {
  const health = await fetch(`${base}/health`).then(response => response.json());
  check("HTTP service reports health", health.status === "ok");
  const engineering = await fetch(`${base}/api/mask-corrections`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packet: packet("engineering_native_object") })
  }).then(response => response.json());
  check("HTTP service persists engineering correction", engineering.surfaceKind === "engineering_native_object", engineering.id);
  const fetched = await fetch(`${base}/api/mask-corrections/${engineering.id}`).then(response => response.json());
  check("HTTP result replay returns full event history", fetched.events[0].type === "submitted");
  const blocked = await fetch(`${base}/api/mask-corrections/${engineering.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "blocked", note: "对象证据不足" })
  }).then(response => response.json());
  check("HTTP teacher review can block unsafe execution", blocked.status === "blocked");
  const list = await fetch(`${base}/api/mask-corrections`).then(response => response.json());
  check("HTTP list returns both correction types", list.records.length === 2);
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}

const failed = checks.filter(item => !item.pass);
console.log(JSON.stringify({
  format: "ai_apprentice_mask_correction_service_smoke_v1",
  status: failed.length ? "failed" : "passed",
  passed: checks.length - failed.length,
  total: checks.length,
  storePath,
  checks
}, null, 2));
if (failed.length) process.exit(1);
