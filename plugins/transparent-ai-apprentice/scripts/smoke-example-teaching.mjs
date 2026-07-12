#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(script, args) {
  const result = spawnSync(process.execPath, [`plugins/transparent-ai-apprentice/scripts/${script}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout);
}

const artifact = run("create-example-teaching-artifact.mjs", [
  "--goal",
  "Teach by showing two before and after examples.",
  "--tool",
  "plain examples",
  "--before",
  "raw title: customer late shipment complaint",
  "--after",
  "tag: shipping_delay; tone: apologize and ask for order id",
  "--before",
  "raw title: billing charged twice",
  "--after",
  "tag: billing_duplicate; tone: acknowledge and request invoice number",
  "--future-input",
  "raw title: payment failed after duplicate charge"
]);

const taught = run("teach-by-demonstration.mjs", [
  "--name",
  "example-teaching-smoke",
  "--task",
  "Teach by showing two before and after examples.",
  "--artifact",
  artifact.artifactPath,
  "--tool",
  "plain examples",
  "--teacher-action",
  "Teacher supplied before and after examples.",
  "--taught-behavior",
  "Classify a future input using only teacher-confirmed example patterns.",
  "--future-input",
  "raw title: payment failed after duplicate charge"
]);

const review = run("review-teaching-session.mjs", ["--session", taught.sessionPath]);

const continued = run("continue-teaching.mjs", [
  "--goal",
  "Teach by showing before and after examples through the single entry.",
  "--tool",
  "plain examples",
  "--before",
  "raw text: user asks for refund after broken item",
  "--after",
  "intent: refund_request; ask for photo evidence",
  "--before",
  "raw text: user asks when package arrives",
  "--after",
  "intent: delivery_status; ask for tracking number",
  "--future-input",
  "raw text: my item arrived broken and I want money back"
]);

const checks = [
  {
    name: "Before/after artifact is created as review-only evidence",
    pass:
      artifact.format === "transparent_ai_example_teaching_artifact_result_v1" &&
      existsSync(artifact.artifactPath) &&
      artifact.exampleCount === 2 &&
      artifact.locks.ruleEnabled === false,
    evidence: `examples=${artifact.exampleCount}; path=${artifact.artifactPath}`
  },
  {
    name: "Before/after artifact teaches through existing import path",
    pass:
      taught.mode === "existing_tool_artifact" &&
      taught.taughtResult.extractedCueCount > 8 &&
      taught.ruleEnabled === false &&
      taught.replayResult?.outcome === "needs_teacher_review",
    evidence: `cues=${taught.taughtResult.extractedCueCount}; outcome=${taught.replayResult?.outcome}`
  },
  {
    name: "Session review exposes disabled example-derived memory",
    pass:
      review.counts.ruleDrafts === 1 &&
      review.counts.disabledRuleDrafts === 1 &&
      review.latestRule.condition.includes("before-after-examples"),
    evidence: `rules=${review.counts.ruleDrafts}; condition=${review.latestRule.condition}`
  },
  {
    name: "Continue teaching accepts plain before/after examples",
    pass:
      continued.route === "teach_from_before_after_examples" &&
      continued.primaryResult.ruleEnabled === false &&
      continued.locks.accepted === false &&
      continued.locks.packagingGated === true,
    evidence: `route=${continued.route}; session=${continued.sessionPath}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  artifact,
  taught,
  review,
  continued,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
