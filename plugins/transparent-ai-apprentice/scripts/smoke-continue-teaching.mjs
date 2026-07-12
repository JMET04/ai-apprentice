#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function run(args) {
  const result = spawnSync(process.execPath, ["plugins/transparent-ai-apprentice/scripts/continue-teaching.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "continue-teaching failed");
  }
  return JSON.parse(result.stdout);
}

const noEvidence = run([
  "--goal",
  "Teach a beginner by visual demonstration without making them explain every rule.",
  "--tool",
  "draw.io or Excalidraw",
  "--future-input",
  "Replay the same lesson on a second drawing."
]);

const multiFile = run([
  "--goal",
  "Teach from two existing drawing exports.",
  "--tool",
  "draw.io plus Excalidraw",
  "--file",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "drawio-demo.drawio"),
  "--file",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "excalidraw-demo.json"),
  "--teacher-action",
  "Teacher showed before and after diagram states.",
  "--taught-behavior",
  "Follow the teacher-confirmed diagram flow only after review.",
  "--future-input",
  "Use the confirmed flow on another diagram."
]);

const pastedScreenEvents = run([
  "--goal",
  "Teach from pasted browser recorder events without making the teacher save a file.",
  "--tool",
  "browser recorder",
  "--screen-events",
  JSON.stringify([
    { type: "click", selector: "#refunds", label: "Refund queue" },
    { type: "click", selector: ".ticket.urgent", label: "urgent damaged item ticket" },
    { type: "type", selector: "textarea.reply", value: "Please upload photo evidence before refund approval." },
    { type: "verify", selector: ".preview", text: "photo evidence before refund" }
  ]),
  "--teacher-action",
  "Teacher pasted a browser recorder event log.",
  "--taught-behavior",
  "Use the demonstrated event order only after teacher review.",
  "--future-input",
  "Handle another urgent damaged item refund ticket."
]);

const correction = run([
  "--session",
  multiFile.sessionPath,
  "--correction",
  "The arrow order is an example, not a universal condition.",
  "--future-input",
  "Use the confirmed flow on another diagram with an exception."
]);

const autoCorrectionSeed = run([
  "--goal",
  "Teach a behavior that can be corrected without a session path.",
  "--tool",
  "browser workflow",
  "--step",
  "Open the refund exception queue.",
  "--step",
  "Check the policy note before choosing an answer.",
  "--step",
  "Write the answer only after the policy note is checked.",
  "--future-input",
  "Handle another refund exception with a policy note."
]);

const autoCorrection = run([
  "--correction",
  "Do not generalize this to all refunds; only use it when a policy note is present.",
  "--future-input",
  "Handle another refund exception with a policy note and a missing photo."
]);

const teacherResponseCorrectionSeed = run([
  "--goal",
  "Teach a behavior that can be corrected from a plain teacher reply.",
  "--tool",
  "browser workflow",
  "--step",
  "Open the refund queue.",
  "--step",
  "Check the policy note.",
  "--step",
  "Draft the answer after policy review.",
  "--future-input",
  "Handle another refund with policy notes."
]);

const teacherResponseCorrection = run([
  "--teacher-response",
  "不对，只有有政策备注的退款才这样处理，普通退款不要套用。",
  "--future-input",
  "Handle another refund with policy notes and missing evidence."
]);

const approval = run([
  "--session",
  multiFile.sessionPath,
  "--teacher-approval",
  "I approve this corrected replay for this teaching session only."
]);

const autoApprovalSeed = run([
  "--goal",
  "Teach a replayed behavior that can be approved without a session path.",
  "--tool",
  "browser workflow",
  "--step",
  "Open the refund ticket.",
  "--step",
  "Ask for damaged item photo evidence.",
  "--step",
  "Verify the reply asks for evidence before refund.",
  "--future-input",
  "Handle another damaged item refund ticket."
]);

const autoApproval = run([
  "--teacher-approval",
  "Yes, approve the latest replayed behavior for this teaching session."
]);

const teacherResponseApprovalSeed = run([
  "--goal",
  "Teach a behavior that can be approved from a plain teacher reply.",
  "--tool",
  "browser workflow",
  "--step",
  "Open the high priority ticket.",
  "--step",
  "Ask for verification before closing.",
  "--future-input",
  "Handle another high priority ticket that needs verification."
]);

const teacherResponseApproval = run([
  "--teacher-response",
  "对，就这样，批准这次回放。"
]);

const teacherResponseClarify = run([
  "--teacher-response",
  "嗯这个先看看"
]);

const checks = [
  {
    name: "Continue teaching creates a visual teaching kit when no evidence exists",
    pass:
      noEvidence.route === "create_existing_tool_visual_kit" &&
      existsSync(noEvidence.primaryResult.files.teacherReadme) &&
      existsSync(noEvidence.primaryResult.files.drawio) &&
      existsSync(noEvidence.primaryResult.files.excalidraw) &&
      existsSync(noEvidence.primaryResult.files.mermaid),
    evidence: `route=${noEvidence.route}; next=${noEvidence.nextTeacherAction}`
  },
  {
    name: "Continue teaching packages multiple existing artifacts and teaches from them",
    pass:
      multiFile.route === "package_multi_file_demonstration_then_teach" &&
      multiFile.primaryResult.mode === "existing_tool_artifact" &&
      multiFile.primaryResult.ruleEnabled === false &&
      Boolean(multiFile.sessionPath),
    evidence: `route=${multiFile.route}; session=${multiFile.sessionPath}`
  },
  {
    name: "Continue teaching accepts pasted screen events without a file",
    pass:
      pastedScreenEvents.route === "teach_from_pasted_screen_events" &&
      pastedScreenEvents.actions[0].result.eventCount === 4 &&
      pastedScreenEvents.primaryResult.mode === "existing_tool_artifact" &&
      pastedScreenEvents.primaryResult.ruleEnabled === false &&
      pastedScreenEvents.primaryResult.replayResult.outcome === "needs_teacher_review",
    evidence: `route=${pastedScreenEvents.route}; events=${pastedScreenEvents.actions[0].result.eventCount}; session=${pastedScreenEvents.sessionPath}`
  },
  {
    name: "Continue teaching routes plain teacher correction without internal ids",
    pass:
      correction.route === "correct_latest_session_result" &&
      correction.review.counts.disabledRuleDrafts >= 1 &&
      correction.locks.accepted === false,
    evidence: `route=${correction.route}; disabled=${correction.review.counts.disabledRuleDrafts}`
  },
  {
    name: "Continue teaching corrects latest session without a path",
    pass:
      autoCorrectionSeed.route === "teach_from_action_sequence" &&
      autoCorrection.route === "correct_latest_session_result" &&
      autoCorrection.primaryResult.autoDiscoveredSession === true &&
      autoCorrection.primaryResult.sessionDiscoverySource === "active-session" &&
      autoCorrection.sessionPath === autoCorrectionSeed.sessionPath &&
      autoCorrection.review.counts.disabledRuleDrafts >= 1 &&
      autoCorrection.locks.packagingGated === true,
    evidence: `auto=${autoCorrection.primaryResult.autoDiscoveredSession}; source=${autoCorrection.primaryResult.sessionDiscoverySource}; session=${autoCorrection.sessionPath}`
  },
  {
    name: "Continue teaching routes plain teacher response as correction",
    pass:
      teacherResponseCorrectionSeed.route === "teach_from_action_sequence" &&
      teacherResponseCorrection.route === "teacher_response_corrects_latest_result" &&
      teacherResponseCorrection.primaryResult.autoDiscoveredSession === true &&
      teacherResponseCorrection.primaryResult.sessionDiscoverySource === "active-session" &&
      teacherResponseCorrection.sessionPath === teacherResponseCorrectionSeed.sessionPath &&
      teacherResponseCorrection.review.counts.disabledRuleDrafts >= 1 &&
      teacherResponseCorrection.locks.packagingGated === true,
    evidence: `route=${teacherResponseCorrection.route}; source=${teacherResponseCorrection.primaryResult.sessionDiscoverySource}; session=${teacherResponseCorrection.sessionPath}`
  },
  {
    name: "Continue teaching accepts explicit session approval without product acceptance",
    pass:
      approval.route === "approve_latest_replayed_session_memory" &&
      approval.primaryResult.ruleEnabled === true &&
      approval.locks.accepted === false &&
      approval.locks.packagingGated === true &&
      approval.locks.technologyAccepted === false,
    evidence: JSON.stringify(approval.locks)
  },
  {
    name: "Continue teaching approves latest replayed session without a path",
    pass:
      autoApprovalSeed.route === "teach_from_action_sequence" &&
      autoApproval.route === "approve_latest_replayed_session_memory" &&
      autoApproval.primaryResult.autoDiscoveredSession === true &&
      autoApproval.primaryResult.sessionDiscoverySource === "active-session" &&
      autoApproval.sessionPath === autoApprovalSeed.sessionPath &&
      autoApproval.primaryResult.ruleEnabled === true &&
      autoApproval.locks.packagingGated === true,
    evidence: `auto=${autoApproval.primaryResult.autoDiscoveredSession}; source=${autoApproval.primaryResult.sessionDiscoverySource}; session=${autoApproval.sessionPath}`
  },
  {
    name: "Continue teaching routes plain teacher response as approval",
    pass:
      teacherResponseApprovalSeed.route === "teach_from_action_sequence" &&
      teacherResponseApproval.route === "teacher_response_approves_session_memory" &&
      teacherResponseApproval.primaryResult.autoDiscoveredSession === true &&
      teacherResponseApproval.primaryResult.sessionDiscoverySource === "active-session" &&
      teacherResponseApproval.sessionPath === teacherResponseApprovalSeed.sessionPath &&
      teacherResponseApproval.primaryResult.ruleEnabled === true &&
      teacherResponseApproval.locks.packagingGated === true &&
      teacherResponseApproval.locks.technologyAccepted === false,
    evidence: `route=${teacherResponseApproval.route}; source=${teacherResponseApproval.primaryResult.sessionDiscoverySource}; session=${teacherResponseApproval.sessionPath}`
  },
  {
    name: "Continue teaching asks for clarification on ambiguous teacher response",
    pass:
      teacherResponseClarify.route === "clarify_teacher_response" &&
      teacherResponseClarify.primaryResult.responseDecision === "clarify" &&
      teacherResponseClarify.primaryResult.needsClarification === true &&
      teacherResponseClarify.primaryResult.locks.ruleEnabled === false &&
      teacherResponseClarify.locks.packagingGated === true,
    evidence: `route=${teacherResponseClarify.route}; decision=${teacherResponseClarify.primaryResult.responseDecision}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  noEvidence,
  multiFile,
  pastedScreenEvents,
  correction,
  autoCorrectionSeed,
  autoCorrection,
  teacherResponseCorrectionSeed,
  teacherResponseCorrection,
  approval,
  autoApprovalSeed,
  autoApproval,
  teacherResponseApprovalSeed,
  teacherResponseApproval,
  teacherResponseClarify,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
