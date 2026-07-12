#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function touch(path, text = "ok") {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text, "utf8");
}

const temp = mkdtempSync(join(tmpdir(), "current-goal-next-teacher-confirmation-cockpit-validation-"));
const artifacts = join(temp, "artifacts");
mkdirSync(artifacts, { recursive: true });
const paths = {
  batchHtml: join(artifacts, "batch.html"),
  proofHtml: join(artifacts, "proof.html"),
  overlayHtml: join(artifacts, "overlay.html"),
  samplePacket: join(artifacts, "sample-packet.json"),
  shortestHtml: join(artifacts, "shortest.html"),
  shortestReceiptHtml: join(artifacts, "shortest-receipt.html"),
  finalHtml: join(artifacts, "final.html"),
  convergenceHtml: join(artifacts, "convergence.html"),
  inventory: join(artifacts, "inventory.json"),
  candidateEvidence: join(artifacts, "candidate-evidence.json")
};
for (const path of Object.values(paths)) touch(path);

const launchpadPath = join(temp, "current-goal-start-here.json");
writeFileSync(
  launchpadPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_start_here_launchpad_v1",
      status: "stable_start_here_ready_review_only_goal_not_complete",
      statusSummary: {
        allSoftwareObserverInventoryBatchReviewBuilderStatus: "waiting_for_teacher_inventory_batch_review_receipt",
        nextProofGapFocusedReceiptBuilderStatus: "waiting_for_teacher_to_fill_next_proof_gap_focused_receipt",
        nextProofGapCandidateEvidencePath: paths.candidateEvidence,
        spatialStatus: "waiting_for_teacher_exported_overlay_packet",
        shortestTeacherEvidencePackStatus: "shortest_teacher_evidence_pack_ready_review_only_goal_not_complete",
        finalTeacherAcceptanceReviewPackStatus: "waiting_for_final_teacher_acceptance_review"
      },
      entryLinks: [
        { id: "all_software_observer_inventory_batch_review_builder_html", path: paths.batchHtml },
        { id: "all_software_observer_inventory_probe_output", path: paths.inventory },
        { id: "next_proof_gap_focused_receipt_builder_html", path: paths.proofHtml },
        { id: "proof_gap_evidence_prefill_html", path: paths.candidateEvidence },
        { id: "transparent_overlay_browser_html", path: paths.overlayHtml },
        { id: "spatial_handoff_html", path: paths.samplePacket },
        { id: "shortest_teacher_evidence_pack_html", path: paths.shortestHtml },
        { id: "shortest_teacher_evidence_receipt_builder_html", path: paths.shortestReceiptHtml },
        { id: "final_teacher_acceptance_review_pack_html", path: paths.finalHtml },
        { id: "final_convergence_readiness_gate_html", path: paths.convergenceHtml }
      ],
      safeNextActions: [
        {
          id: "build_all_software_reviewed_queue_from_receipt",
          commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-observer-reviewed-queue-from-receipt.mjs --receipt <teacher-filled.json>"
        },
        {
          id: "validate_proof_gap_teacher_queue_receipt",
          commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --receipt <teacher-filled.json>"
        },
        {
          id: "validate_teacher_overlay_packet",
          commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-transparent-sketch-overlay-packet.mjs --overlay-packet <teacher-exported.json>"
        },
        {
          id: "validate_shortest_teacher_evidence_receipt",
          commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-current-goal-shortest-teacher-evidence-receipt.mjs --receipt <teacher-filled.json>"
        },
        {
          id: "validate_final_teacher_acceptance_receipt",
          commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-current-goal-final-teacher-acceptance-receipt.mjs --receipt <teacher-filled.json>"
        }
      ],
      paths: {
        allSoftwareObserverInventoryBatchReviewBuilderHtml: paths.batchHtml,
        allSoftwareObserverInventoryProbeOutput: paths.inventory,
        proofGapNextFocusedReceiptBuilderHtml: paths.proofHtml,
        teacherSpatialOverlayHtml: paths.overlayHtml,
        teacherSpatialSampleOverlayPacket: paths.samplePacket
      },
      goalComplete: false
    },
    null,
    2
  )}\n`,
  "utf8"
);

const cockpitResult = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "plugins/transparent-ai-apprentice/scripts/create-current-goal-next-teacher-confirmation-cockpit.mjs",
      "--launchpad",
      launchpadPath,
      "--output-dir",
      join(temp, "cockpit")
    ],
    { cwd: process.cwd(), encoding: "utf8" }
  )
);
const cockpit = readJson(cockpitResult.cockpitPath);
const receiptPath = join(temp, "teacher-filled-current-goal-cockpit-receipt.json");
const receipt = {
  ...cockpit.receiptTemplate,
  blockedActionsConfirmed: true,
  rowDecisions: cockpit.receiptTemplate.rowDecisions.map((row, index) => ({
    ...row,
    teacherDecision: index === 0 ? "teacher_reviewed_continue" : "needs_teacher_review",
    evidenceReviewed: index === 0,
    teacherNote: index === 0 ? "Teacher reviewed this row." : ""
  }))
};
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

const validationResult = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "plugins/transparent-ai-apprentice/scripts/validate-current-goal-next-teacher-confirmation-cockpit-receipt.mjs",
      "--cockpit",
      cockpitResult.cockpitPath,
      "--receipt",
      receiptPath,
      "--output-dir",
      join(temp, "validations")
    ],
    { cwd: process.cwd(), encoding: "utf8" }
  )
);
const validation = readJson(validationResult.validationPath);
assert(validation.format === "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_validation_v1", "unexpected validation format");
assert(validation.status === "validated_with_reviewed_current_goal_confirmation_rows", "unexpected validation status");
assert(validation.counts.readyRows === 1, "one reviewed row should be ready");
assert(validation.nextSafeCommands.length === 1, "one copy-only downstream command should be prepared");
assert(validation.locks.validationDoesNotExecuteCommands === true, "validation should not execute commands");
assert(validation.locks.validationDoesNotCreateQueues === true, "validation should not create queues");
assert(validation.locks.validationDoesNotReadLogs === true, "validation should not read logs");
assert(validation.goalComplete === false, "validation must not claim completion");

const forbiddenReceiptPath = join(temp, "teacher-forbidden-current-goal-cockpit-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  `${JSON.stringify(
    {
      ...receipt,
      rowDecisions: receipt.rowDecisions.map((row, index) => ({
        ...row,
        teacherDecision: index === 0 ? "execute_now" : row.teacherDecision
      }))
    },
    null,
    2
  )}\n`,
  "utf8"
);
const forbidden = spawnSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/validate-current-goal-next-teacher-confirmation-cockpit-receipt.mjs",
    "--cockpit",
    cockpitResult.cockpitPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(temp, "forbidden-validations")
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);
assert(forbidden.status !== 0, "forbidden execute_now decision should fail closed");
assert(
  `${forbidden.stdout}\n${forbidden.stderr}`.includes('"forbiddenDecisionUsed": true'),
  "forbidden validation should report blocked decision"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_validation_smoke_v1",
      validationPath: validationResult.validationPath,
      readyRowCount: validation.counts.readyRows,
      forbiddenBlocked: true
    },
    null,
    2
  )
);
