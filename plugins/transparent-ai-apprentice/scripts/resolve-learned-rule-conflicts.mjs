#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function ruleId(rule, index) {
  return rule.ruleId || rule.rule_id || rule.id || `rule-${index + 1}`;
}

function canonical(value) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

function applies(rule, context) {
  const conditions = rule.appliesWhen || rule.scope?.applies_when || {};
  return Object.entries(conditions).every(([key, expected]) => {
    const actual = context[key];
    if (Array.isArray(expected)) return expected.includes(actual);
    return actual === expected;
  });
}

function score(rule) {
  const conditions = rule.appliesWhen || rule.scope?.applies_when || {};
  const confidence = { low: 1, medium: 2, high: 3 }[rule.confidence] || 0;
  const priority = Number(rule.priority || 0);
  const teacherException = rule.teacherException === true ? 40 : 0;
  const teacherConfirmed = rule.requiresTeacherConfirmation === false || rule.reviewStatus === "approved" || rule.lifecycle === "active" ? 12 : 0;
  return teacherException + teacherConfirmed + Object.keys(conditions).length * 10 + confidence * 3 + priority;
}

function riskLevel(input) {
  return input.riskLevel || input.context?.riskLevel || "normal";
}

export function resolveLearnedRuleConflicts(input) {
  const context = input.context || {};
  const enabledRules = (Array.isArray(input.rules) ? input.rules : [])
    .map((rule, index) => ({ ...rule, _id: ruleId(rule, index), _score: score(rule) }))
    .filter((rule) => rule.enabled !== false && rule.lifecycle !== "revoked" && rule.lifecycle !== "deprecated")
    .filter((rule) => applies(rule, context));

  if (!enabledRules.length) {
    return {
      format: "mingtu_learned_rule_conflict_resolution_v1",
      status: "no_applicable_rule",
      context,
      decision: null,
      problemMarkers: [],
      publicTrace: [{ step: "match_context", validation: "no enabled rule matched", teacherReviewPoint: "none" }],
      rulesMutated: false
    };
  }

  const actionGroups = new Map();
  for (const rule of enabledRules) {
    const key = canonical(rule.action ?? rule.constraint ?? rule.effect);
    if (!actionGroups.has(key)) actionGroups.set(key, []);
    actionGroups.get(key).push(rule);
  }

  if (actionGroups.size === 1) {
    const selected = [...enabledRules].sort((a, b) => b._score - a._score)[0];
    return {
      format: "mingtu_learned_rule_conflict_resolution_v1",
      status: enabledRules.length === 1 ? "single_rule_selected" : "compatible_rules_merged",
      context,
      decision: {
        selectedRuleId: selected._id,
        compatibleRuleIds: enabledRules.map((rule) => rule._id),
        suppressedRuleIds: [],
        appliedAction: selected.action ?? selected.constraint ?? selected.effect,
        basis: "all applicable rules lead to the same normalized action",
        confidence: "high"
      },
      problemMarkers: [],
      publicTrace: [{ step: "compare_actions", validation: "compatible", teacherReviewPoint: "none" }],
      rulesMutated: false
    };
  }

  const ranked = [...enabledRules].sort((a, b) => b._score - a._score || a._id.localeCompare(b._id));
  const winner = ranked[0];
  const runnerUp = ranked[1];
  const scoreGap = winner._score - runnerUp._score;
  const winnerSpecificity = Object.keys(winner.appliesWhen || winner.scope?.applies_when || {}).length;
  const runnerSpecificity = Object.keys(runnerUp.appliesWhen || runnerUp.scope?.applies_when || {}).length;
  const resolvedByTeacherException = winner.teacherException === true && ranked.filter((rule) => rule.teacherException === true).length === 1;
  const resolvedBySpecificity = winnerSpecificity > runnerSpecificity && scoreGap >= 10;
  const highImpact = ["high", "safety", "legal", "financial", "production"].includes(riskLevel(input));
  const basis = resolvedByTeacherException
    ? "teacher-confirmed exception matches the current context more narrowly"
    : resolvedBySpecificity
      ? "the selected rule has a narrower matching scope and stronger reviewed evidence"
      : "best available contextual score; conflict remains visibly marked";
  const confidence = resolvedByTeacherException || resolvedBySpecificity ? "high" : scoreGap >= 8 ? "medium" : "low";
  const reviewRequired = highImpact || confidence === "low";

  return {
    format: "mingtu_learned_rule_conflict_resolution_v1",
    status: reviewRequired && highImpact ? "blocked_high_impact_ambiguity" : resolvedByTeacherException ? "resolved_by_teacher_exception" : resolvedBySpecificity ? "resolved_by_context_specificity" : "reasoned_decision_with_visible_warning",
    context,
    decision: {
      selectedRuleId: winner._id,
      suppressedRuleIds: ranked.slice(1).map((rule) => rule._id),
      appliedAction: winner.action ?? winner.constraint ?? winner.effect,
      basis,
      confidence,
      executionAllowed: !highImpact && !reviewRequired,
      requiresHighReasoningReview: reviewRequired,
      scoreEvidence: ranked.map((rule) => ({ ruleId: rule._id, score: rule._score, specificity: Object.keys(rule.appliesWhen || rule.scope?.applies_when || {}).length, teacherException: rule.teacherException === true }))
    },
    problemMarkers: [{
      id: `rule-conflict-${winner._id}`,
      type: "apparent_rule_conflict",
      severity: highImpact ? "blocking" : confidence === "low" ? "warning" : "notice",
      message: `Multiple applicable rules propose different actions. Selected ${winner._id} using ${basis}; suppressed rules remain unchanged and visible.`,
      involvedRuleIds: ranked.map((rule) => rule._id),
      selectedRuleId: winner._id,
      requiresTeacherReview: reviewRequired
    }],
    publicTrace: [
      { step: "match_context", inputObserved: context, validation: `${enabledRules.length} rules applicable` },
      { step: "compare_specificity_exception_and_evidence", ruleCandidates: ranked.map((rule) => rule._id), validation: basis },
      { step: "mark_problem_and_decide", actionProposed: winner.action ?? winner.constraint ?? winner.effect, confidence, teacherReviewPoint: reviewRequired ? "review the visible conflict marker" : "none" }
    ],
    rulesMutated: false,
    silentRuleDrop: false
  };
}

function main() {
  const inputPath = argValue("--input");
  if (!inputPath) throw new Error("--input <rule-conflict-request.json> is required");
  const input = JSON.parse(readFileSync(resolve(inputPath), "utf8").replace(/^\uFEFF/, ""));
  const result = resolveLearnedRuleConflicts(input);
  const outputPath = argValue("--output");
  if (outputPath) writeFileSync(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
