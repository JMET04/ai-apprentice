#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "demonstration-capture";
}

const goal = argValue("--goal", argValue("--task", "Teach from a direct demonstration capture."));
const tool = argValue("--tool", "existing-tool");
const teacherAction = argValue("--teacher-action", "Teacher demonstrated the workflow with existing materials.");
const taughtBehavior = argValue("--taught-behavior", "Apply the teacher-confirmed demonstrated behavior after review.");
const futureInput = argValue("--future-input");
const note = argValue("--note");
const files = argValues("--file").map((file, index) => {
  const filePath = resolve(file);
  return {
    order: index + 1,
    path: filePath,
    name: basename(filePath),
    exists: existsSync(filePath),
    role: index === 0 ? "starting_evidence" : "supporting_evidence"
  };
});

if (!goal) throw new Error("Usage: node create-demonstration-capture.mjs --goal <teaching goal> [--file <path>]...");
if (files.length === 0 && !note) {
  throw new Error("Provide at least one --file path or --note so the capture has reviewable evidence.");
}

const captureId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const captureDir = join(process.cwd(), ".transparent-apprentice", "captures");
const capturePath = join(captureDir, `${captureId}.json`);
mkdirSync(captureDir, { recursive: true });

const missingFiles = files.filter((file) => !file.exists).map((file) => file.path);
const capture = {
  format: "transparent_ai_demonstration_capture_v1",
  captureId,
  goal,
  tool,
  teacherAction,
  taughtBehavior,
  futureInput,
  note,
  evidence: files,
  locks: {
    ruleEnabled: false,
    accepted: false,
    requiresTeacherConfirmation: true,
    packagingGated: true
  },
  nextMcpCall: {
    tool: "teach_by_demonstration",
    arguments: {
      name: slugify(goal),
      task: goal,
      artifact: capturePath,
      tool,
      teacherAction,
      taughtBehavior,
      ...(futureInput ? { futureInput } : {})
    }
  }
};

writeFileSync(capturePath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_demonstration_capture_result_v1",
      capturePath,
      captureId,
      evidenceCount: files.length,
      missingFiles,
      nextMcpCall: capture.nextMcpCall,
      locks: capture.locks
    },
    null,
    2
  )
);
