#!/usr/bin/env node
import { resolveLearnedRuleConflicts } from "./resolve-learned-rule-conflicts.mjs";

const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });

const compatible = resolveLearnedRuleConflicts({
  context: { documentType: "word_docx" },
  rules: [
    { id: "r1", enabled: true, action: "preserve unselected text", appliesWhen: { documentType: "word_docx" }, confidence: "high" },
    { id: "r2", enabled: true, action: "preserve unselected text", confidence: "medium" }
  ]
});
check("Compatible rules merge instead of reporting a false absolute conflict", compatible.status === "compatible_rules_merged" && compatible.problemMarkers.length === 0, compatible.status);

const exception = resolveLearnedRuleConflicts({
  context: { documentType: "excel_xlsx", sheet: "财务复核" },
  rules: [
    { id: "general", enabled: true, action: "round to whole number", appliesWhen: { documentType: "excel_xlsx" }, confidence: "high" },
    { id: "teacher-exception", enabled: true, action: "keep two decimals", appliesWhen: { documentType: "excel_xlsx", sheet: "财务复核" }, teacherException: true, confidence: "high", reviewStatus: "approved" }
  ]
});
check("Teacher exception wins in its exact context", exception.status === "resolved_by_teacher_exception" && exception.decision.selectedRuleId === "teacher-exception", JSON.stringify(exception.decision));
check("Resolved conflict remains visibly marked", exception.problemMarkers.length === 1 && exception.silentRuleDrop === false, JSON.stringify(exception.problemMarkers));

const ambiguous = resolveLearnedRuleConflicts({
  context: { task: "rewrite_title" },
  rules: [
    { id: "short", enabled: true, action: "use a short title", priority: 2, confidence: "medium" },
    { id: "descriptive", enabled: true, action: "use a descriptive title", priority: 1, confidence: "medium" }
  ]
});
check("Ambiguous ordinary conflict still makes a reasoned recommendation", ambiguous.status === "reasoned_decision_with_visible_warning" && ambiguous.decision.selectedRuleId === "short", JSON.stringify(ambiguous.decision));
check("Low-confidence decision is labeled for review", ambiguous.problemMarkers[0]?.requiresTeacherReview === true && ambiguous.decision.requiresHighReasoningReview === true, JSON.stringify(ambiguous.problemMarkers));

const highImpact = resolveLearnedRuleConflicts({
  riskLevel: "production",
  context: { task: "release" },
  rules: [
    { id: "release-a", enabled: true, action: "release", confidence: "high" },
    { id: "release-b", enabled: true, action: "hold", confidence: "high" }
  ]
});
check("High-impact ambiguity blocks execution but records a recommendation", highImpact.status === "blocked_high_impact_ambiguity" && highImpact.decision.executionAllowed === false, JSON.stringify(highImpact.decision));
check("Conflict resolution never mutates or silently drops learned rules", highImpact.rulesMutated === false && highImpact.silentRuleDrop === false, JSON.stringify({ rulesMutated: highImpact.rulesMutated, silentRuleDrop: highImpact.silentRuleDrop }));

const failed = checks.filter((item) => !item.pass);
console.log(JSON.stringify({
  format: "mingtu_learned_rule_conflict_resolution_smoke_v1",
  status: failed.length ? "failed" : "passed",
  passed: checks.length - failed.length,
  total: checks.length,
  checks
}, null, 2));
if (failed.length) process.exit(1);
