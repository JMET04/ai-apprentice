#!/usr/bin/env node
import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withFileLock(targetPath, operation) {
  const lockPath = `${targetPath}.lock`;
  let handle;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = openSync(lockPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(50);
    }
  }
  if (handle === undefined) {
    throw new Error(`Could not acquire session lock: ${lockPath}`);
  }

  try {
    return operation();
  } finally {
    closeSync(handle);
    rmSync(lockPath, { force: true });
  }
}

function writeJsonAtomic(path, value) {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

function inferCorrectionType(text, explicitType) {
  if (explicitType) return explicitType;
  const lower = text.toLowerCase();
  if (lower.includes("too broad") || lower.includes("不要泛化") || lower.includes("过度泛化")) return "too_broad";
  if (lower.includes("wrong arrow") || lower.includes("箭头") || lower.includes("connector")) return "wrong_connector";
  if (lower.includes("not condition") || lower.includes("不是条件") || lower.includes("decorative")) return "not_a_condition";
  if (lower.includes("counterexample") || lower.includes("反例")) return "counterexample";
  return "teacher_refinement";
}

function latestRuleDraft(session) {
  const drafts = session.ruleDrafts ?? [];
  return drafts[drafts.length - 1];
}

const rawSessionPath = argValue("--session");
const correctionText = argValue("--correction");

if (!rawSessionPath || !correctionText) {
  throw new Error("Usage: node apply-teacher-correction.mjs --session <session.json> --correction <teacher correction> [--rule-id <id>] [--type too_broad]");
}

const sessionPath = resolve(rawSessionPath);
const targetRuleId = argValue("--rule-id");
const correctionType = inferCorrectionType(correctionText, argValue("--type"));
const teacherDecision = argValue("--decision", "needs_teacher_review");

if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

let output;
withFileLock(sessionPath, () => {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const targetRule = targetRuleId
    ? (session.ruleDrafts ?? []).find((rule) => rule.id === targetRuleId)
    : latestRuleDraft(session);

  if (!targetRule) {
    throw new Error("No target rule draft found. Import a demonstration artifact first or pass --rule-id.");
  }

  const correctionId = `correction-${Date.now()}`;
  const traceId = `trace-${Date.now()}-correction`;
  const previousCondition = targetRule.condition;
  const previousAction = targetRule.action;

  const boundary = {
    type: correctionType,
    teacherCorrection: correctionText,
    appliesToRuleDraftId: targetRule.id,
    reviewStatus: teacherDecision,
    ruleEnabled: false,
    requiresTeacherConfirmation: true
  };

  targetRule.teacherCorrections = [...(targetRule.teacherCorrections ?? []), boundary];
  targetRule.reviewStatus = teacherDecision;
  targetRule.enabled = false;
  targetRule.requiresTeacherConfirmation = true;
  targetRule.confidence = "low";

  if (correctionType === "too_broad" || correctionType === "not_a_condition") {
    targetRule.condition = `${previousCondition}; only after teacher confirms the cue is intentional, not decorative or accidental.`;
    targetRule.counterexamples = [...(targetRule.counterexamples ?? []), correctionText];
  } else if (correctionType === "wrong_connector") {
    targetRule.condition = `${previousCondition}; connector direction/order must be confirmed by teacher.`;
    targetRule.counterexamples = [...(targetRule.counterexamples ?? []), correctionText];
  } else if (correctionType === "counterexample") {
    targetRule.counterexamples = [...(targetRule.counterexamples ?? []), correctionText];
  } else {
    targetRule.action = `${previousAction}; teacher refinement pending: ${correctionText}`;
  }

  const correctionRecord = {
    format: "transparent_ai_teacher_correction_v1",
    id: correctionId,
    targetRuleDraftId: targetRule.id,
    correctionType,
    teacherCorrection: correctionText,
    previousCondition,
    revisedCondition: targetRule.condition,
    previousAction,
    revisedAction: targetRule.action,
    ruleEnabled: false,
    requiresTeacherConfirmation: true,
    reviewStatus: teacherDecision
  };

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceCorrectionId: correctionId,
    steps: [
      {
        step: "capture teacher correction",
        inputObserved: correctionText,
        ruleCandidates: [targetRule.id],
        actionProposed: "Treat the teacher correction as review evidence, not automatic rule enablement.",
        confidence: "medium",
        validation: `correctionType=${correctionType}`,
        teacherReviewPoint: "Confirm the revised condition and counterexample boundary.",
        memoryEffect: "rule draft revised but disabled"
      },
      {
        step: "revise disabled rule draft",
        inputObserved: JSON.stringify({ previousCondition, revisedCondition: targetRule.condition }).slice(0, 1200),
        ruleCandidates: [targetRule.id],
        actionProposed: "Keep the rule draft disabled and require teacher confirmation before replay.",
        confidence: "low",
        validation: "ruleEnabled=false; requiresTeacherConfirmation=true",
        teacherReviewPoint: "Approve, refine again, or add a concrete counterexample.",
        memoryEffect: "narrowed draft"
      }
    ]
  };

  session.corrections = [...(session.corrections ?? []), correctionRecord];
  session.publicTraces = [...(session.publicTraces ?? []), publicTrace];
  session.nextReplayPlan = [
    ...(session.nextReplayPlan ?? []),
    {
      sourceCorrectionId: correctionId,
      sourceRuleDraftId: targetRule.id,
      action: "Replay the corrected demonstration boundary on a small future task before enabling any memory.",
      ruleEnabled: false,
      requiresTeacherConfirmation: true
    }
  ];

  writeJsonAtomic(sessionPath, session);
  output = {
    ok: true,
    sessionPath,
    correctionId,
    traceId,
    targetRuleDraftId: targetRule.id,
    correctionType,
    reviewStatus: targetRule.reviewStatus,
    counterexampleCount: targetRule.counterexamples?.length ?? 0,
    ruleEnabled: targetRule.enabled,
    requiresTeacherConfirmation: targetRule.requiresTeacherConfirmation
  };
});

console.log(JSON.stringify(output, null, 2));
