#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const manifestPath = resolve(argValue("--manifest", ""));
if (!manifestPath || !existsSync(manifestPath)) {
  throw new Error("Usage: node confirm-rollback-point.mjs --manifest <rollback-point.json> --teacher-confirmation <text> [--delete-after-confirmation]");
}

const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const confirmationText = teacherConfirmation.toLowerCase();
const confirmed =
  confirmationText.includes("confirm") ||
  confirmationText.includes("approved") ||
  confirmationText.includes("correct") ||
  teacherConfirmation.includes("\u786e\u8ba4") ||
  teacherConfirmation.includes("\u6b63\u786e") ||
  teacherConfirmation.includes("\u53ef\u4ee5\u5220\u9664");

if (!confirmed) {
  throw new Error("Teacher confirmation is required before marking or deleting a rollback point.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.status = "teacher_confirmed_current_direction";
manifest.teacherConfirmation = teacherConfirmation;
manifest.confirmedAt = new Date().toISOString();
manifest.deleteOnlyAfterTeacherConfirmation = true;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

let deleted = false;
let rollbackDir = dirname(manifestPath);
if (hasFlag("--delete-after-confirmation")) {
  rmSync(rollbackDir, { recursive: true, force: true });
  deleted = true;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_rollback_point_confirmation_result_v1",
      rollbackId: manifest.rollbackId,
      manifestPath,
      rollbackDir,
      status: deleted ? "deleted_after_teacher_confirmation" : manifest.status,
      deleted,
      teacherConfirmationRequiredBeforeDelete: true
    },
    null,
    2
  )
);
