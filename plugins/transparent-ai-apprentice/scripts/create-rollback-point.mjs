#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && index + 1 < process.argv.length) {
      values.push(process.argv[index + 1]);
    }
  }
  return values;
}

function slugify(value) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "rollback-point";
}

function assertInsideWorkspace(path) {
  const resolved = resolve(path);
  const relativePath = relative(process.cwd(), resolved);
  if (relativePath.startsWith("..") || relativePath === "..") {
    throw new Error(`Refusing to snapshot outside workspace: ${resolved}`);
  }
  return resolved;
}

const label = argValue("--label", "manual rollback point");
const reason = argValue("--reason", "protect current direction until teacher confirms");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "rollback-points")));
const requestedPaths = multiArg("--path");
if (requestedPaths.length === 0) {
  throw new Error("Usage: node create-rollback-point.mjs --label <label> --path <file-or-directory> [--path <more>]");
}

const rollbackId = `${slugify(label)}-${Date.now()}`;
const rollbackDir = join(outputRoot, rollbackId);
const snapshotDir = join(rollbackDir, "snapshot");
mkdirSync(snapshotDir, { recursive: true });

const copied = [];
for (const requested of requestedPaths) {
  const source = assertInsideWorkspace(requested);
  if (!existsSync(source)) {
    throw new Error(`Rollback source does not exist: ${source}`);
  }
  const stats = statSync(source);
  const target = join(snapshotDir, basename(source));
  cpSync(source, target, {
    recursive: true,
    force: true,
    filter: (path) => {
      const normalized = path.replace(/\\/g, "/");
      return !normalized.includes("/node_modules/") && !normalized.includes("/.git/") && !normalized.includes("/dist/");
    }
  });
  copied.push({
    source,
    target,
    type: stats.isDirectory() ? "directory" : "file",
    bytes: stats.isFile() ? stats.size : null
  });
}

const manifest = {
  format: "transparent_ai_rollback_point_v1",
  rollbackId,
  createdAt: new Date().toISOString(),
  label,
  reason,
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true,
  restoreInstruction:
    "Copy files from snapshot back to their source paths only after the teacher says the current direction was wrong.",
  cleanupInstruction:
    "Delete this rollback point only after the teacher confirms the current direction is correct.",
  copied,
  reviewLocks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    teacherConfirmationRequiredBeforeDelete: true
  }
};

const manifestPath = join(rollbackDir, "rollback-point.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_rollback_point_result_v1",
      rollbackId,
      rollbackDir,
      manifestPath,
      copied,
      status: manifest.status,
      deleteOnlyAfterTeacherConfirmation: true
    },
    null,
    2
  )
);
