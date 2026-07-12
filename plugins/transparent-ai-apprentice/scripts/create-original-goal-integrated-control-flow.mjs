#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-integrated-control-flow")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-integrated-control-flow"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function optionalJson(path) {
  if (!path) return null;
  const resolved = resolve(path);
  return existsSync(resolved) ? readJson(resolved) : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}` : "";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    integratedFlowDoesNotCaptureScreenshots: true,
    integratedFlowDoesNotReadFullLogs: true,
    integratedFlowDoesNotExecuteSoftware: true,
    integratedFlowDoesNotSendUiEvents: true,
    integratedFlowDoesNotWriteMemory: true,
    integratedFlowDoesNotRegisterSchedule: true,
    integratedFlowDoesNotEnableRules: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    fullLogsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    scheduledTaskRegistered: false,
    nativeUniversalExecution: false,
    teacherConfirmationRequiredBeforeCapture: true,
    teacherConfirmationRequiredBeforeLearning: true,
    teacherConfirmationRequiredBeforeExecution: true,
    rollbackPointRequiredBeforeExecution: true,
    goalComplete: false
  };
}

function stage(id, label, purpose, reusedTools, inputEvidence, output, nextCommand, gate, blockedActions) {
  return {
    id,
    label,
    purpose,
    reusedTools,
    inputEvidence,
    output,
    nextCommand,
    gate,
    blockedActions,
    locks: locks()
  };
}

function buildStages({ refreshPath, refresh }) {
  return [
    stage(
      "all_software_metadata_baseline",
      "All-software metadata baseline",
      "Inventory every reachable software/log/source cheaply before any high-token observation.",
      [
        "create-software-observer-inventory.mjs",
        "create-software-observer-queue.mjs",
        "watch-log-source-metadata-deltas.mjs",
        "monitor-software-observation-deltas.mjs"
      ],
      [refreshPath || "<optional-current-status-refresh.json>"].filter(Boolean),
      "bounded metadata or compact delta rows",
      commandLine("create-original-goal-current-status-refresh.mjs", [["--goal", "<current original goal text>"]]),
      "teacher reviews source coverage and confirms the next low-token lane",
      ["read_full_logs_first", "continuous_screen_recording", "claim_all_software_complete_from_metadata_only"]
    ),
    stage(
      "event_triggered_low_token_policy",
      "Event-triggered low-token policy",
      "Choose metadata-only, bounded-tail, or one visual-check request only after a changed signal exists.",
      [
        "create-low-token-operation-preflight-policy.mjs",
        "create-low-token-trigger-budget-plan.mjs",
        "create-event-triggered-low-token-observation-policy.mjs",
        "create-original-goal-low-token-metadata-gate-preflight.mjs"
      ],
      [
        refresh?.paths?.lowTokenOperationPreflightPolicy || "<low-token-operation-preflight-policy.json>",
        refresh?.paths?.lowTokenTriggerBudgetPlan || "<low-token-trigger-budget-plan.json>"
      ],
      "trigger rows with maxScreenshotsPerTrigger=1 and screenshotAllowedWithoutTeacher=false",
      commandLine("create-event-triggered-low-token-observation-policy.mjs", [
        ["--budget-plan", "<low-token-trigger-budget-plan.json>"],
        ["--output-dir", "<event-triggered-policy-output-dir>"]
      ]),
      "teacher confirms the policy row before any screenshot request",
      ["capture_screenshot_without_trigger", "read_raw_full_log", "write_memory_from_unreviewed_delta"]
    ),
    stage(
      "one_bounded_visual_evidence",
      "One bounded visual evidence",
      "When compact evidence is ambiguous, prepare exactly one teacher-confirmed screenshot request.",
      [
        "create-automatic-triggered-visual-check-queue.mjs",
        "create-triggered-visual-check-command-builder.mjs",
        "capture-triggered-visual-check.mjs"
      ],
      [refresh?.paths?.triggeredVisualCheckCommandBuilder || "<triggered-visual-check-command-builder.json>"],
      "transparent_ai_triggered_visual_check_capture_receipt_v1",
      commandLine("capture-triggered-visual-check.mjs", [
        ["--request", "<triggered-visual-check-request.json>"],
        ["--selected-request-id", "<teacher-reviewed-request-id>"],
        ["--teacher-confirmed", "true"],
        ["--reviewed-source-image", "<single-teacher-reviewed-image>"]
      ]),
      "teacher confirms one visual check; no continuous recording",
      ["bulk_screenshot_collection", "background_recording", "capture_without_receipt"]
    ),
    stage(
      "learning_handoff",
      "Triggered visual learning handoff",
      "Bind the low-token change and the one visual evidence into a review-only learning card.",
      [
        "create-triggered-visual-evidence-learning-handoff.mjs",
        "run-triggered-visual-evidence-learning-handoff-review.mjs",
        "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"
      ],
      ["<triggered-visual-check-capture-receipt.json>", "<single-visual-evidence-file>"],
      "teacher-facing learning card plus receipt validation command",
      commandLine("create-triggered-visual-evidence-learning-handoff.mjs", [
        ["--capture-receipt", "<triggered-visual-check-capture-receipt.json>"],
        ["--request", "<triggered-visual-check-request.json>"]
      ]),
      "teacher corrects or approves learning before memory/rule use",
      ["learn_from_screenshot_without_trigger", "write_memory_without_teacher_approval", "enable_rule_without_receipt"]
    ),
    stage(
      "tlcl_rag_contract_repair_loop",
      "TLCL RAG evidence and high-reasoning contract repair loop",
      "Use the highest-reasoning layer to compile or repair the logic contract from teacher correction and non-authoritative RAG evidence before any medium-runtime route can continue.",
      [
        "create-tlcl-rag-evidence-attachment.mjs",
        "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
        "create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs",
        "create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs",
        "validate-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
        "smoke-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit.mjs"
      ],
      [
        "<teacher-correction-or-mismatch-validation.json>",
        "<reviewed-rag-evidence-attachment.json>",
        "<providerRoleUsePlanTrace>"
      ],
      "draft_disabled repair package, deterministic validation package, workflow fingerprint review, and medium-runtime continuation blocker",
      "npm.cmd run smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit",
      "teacher verifies RAG is evidence only, deterministic validators pass, workflow fingerprint is reviewed, and medium-runtime reuse stays blocked until approval",
      [
        "treat_retrieved_knowledge_as_authority",
        "continue_medium_runtime_after_mismatch_without_high_reasoning_repair",
        "enable_rule_from_rag_without_teacher_review",
        "drop_providerRoleUsePlanTrace"
      ]
    ),
    stage(
      "voice_text_numbered_target",
      "Voice/text numbered target workbench",
      "Turn a non-expert voice or text command into numbered candidate locations before any action.",
      [
        "create-triggered-visual-evidence-voice-control-workbench.mjs",
        "create-engineering-voice-control-workbench.mjs",
        "create-visual-engineering-target-confirmation-kit.mjs",
        "confirm-engineering-command-target.mjs"
      ],
      ["<triggered-visual-evidence-learning-handoff.json>", "<teacher voice transcript or typed command>"],
      "numbered candidate target packet",
      commandLine("create-triggered-visual-evidence-voice-control-workbench.mjs", [
        ["--handoff", "<triggered-visual-evidence-learning-handoff.json>"],
        ["--command", "<teacher voice transcript or typed command>"],
        ["--software", "<teacher-reviewed-software>"]
      ]),
      "teacher confirms exactly one visible number or corrects candidates",
      ["execute_voice_command_from_unvalidated_target", "choose_target_for_teacher", "skip_numbered_confirmation"]
    ),
    stage(
      "transparent_sketch_depth_demo",
      "Transparent sketch 2D/perspective/3D rehearsal",
      "Let the teacher draw on a transparent mask, then logicize position, angle, perspective, and depth before route planning.",
      [
        "create-transparent-sketch-overlay-kit.mjs",
        "interpret-transparent-sketch-spatial-intent.mjs",
        "create-spatial-target-confirmation-kit.mjs",
        "create-transparent-sketch-depth-demonstration-rehearsal.mjs",
        "create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs"
      ],
      ["<teacher-exported-transparent-sketch-packet.json>", "<selected numbered target>"],
      "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
      commandLine("create-transparent-sketch-depth-demonstration-rehearsal.mjs", [
        ["--goal", "<teacher sketch intent>"],
        ["--software", "<teacher-reviewed-software>"],
        ["--selected-number", "<teacher-confirmed-number>"],
        ["--teacher-confirmed-number", "true"]
      ]),
      "teacher reviews rehearsal receipt; missing detail logic blocks execution",
      ["fabricate_spatial_intent_without_teacher_packet", "generate_lookalike_details_without_logic", "execute_from_unreviewed_sketch"]
    ),
    stage(
      "execution_approval_gate",
      "Execution approval gate",
      "Only after validated target evidence, reviewed route evidence, teacher confirmation, and rollback point can a runner request be prepared.",
      [
        "create-engineering-voice-execution-approval-gate.mjs",
        "create-real-local-execution-approval-gate.mjs",
        "create-all-software-execution-approved-gate-command-builder.mjs",
        "run-all-software-execution-approved-gate-runner.mjs"
      ],
      ["<validated-target-receipt.json>", "<reviewed-route-evidence.json>", "<retained-rollback-point>"],
      "prepared runner request or explicit blocker; this integrated flow does not execute it",
      commandLine("create-engineering-voice-execution-approval-gate.mjs", [
        ["--target-receipt-validation", "<validated-numbered-target-receipt.json>"],
        ["--route-evidence", "<reviewed-route-evidence.json>"],
        ["--teacher-confirmation", "<explicit teacher execution confirmation>"],
        ["--rollback-point-created", "true"]
      ]),
      "teacher confirms execution and retained rollback point before any runner",
      ["execute_without_rollback", "execute_without_validated_target", "execute_without_teacher_confirmation"]
    ),
    stage(
      "post_action_evidence",
      "Post-action evidence and correction",
      "After a separately approved run, collect bounded evidence, let the teacher correct, and convert corrections into reusable rules only when approved.",
      [
        "create-post-action-evidence-checkpoint.mjs",
        "apply-teacher-correction.mjs",
        "correct-apprentice-memory.mjs",
        "approve-teaching-memory.mjs"
      ],
      ["<approved-runner-output.json>", "<post-action-evidence>"],
      "teacher correction packet or approved memory/rule request",
      commandLine("create-post-action-evidence-checkpoint.mjs", [
        ["--action-result", "<approved-runner-output.json>"],
        ["--output-dir", "<post-action-evidence-output-dir>"]
      ]),
      "teacher approves correction before memory or rule enablement",
      ["write_memory_without_teacher_approval", "enable_rule_without_teacher_approval", "claim_goal_complete_without_all-requirement-proof"]
    )
  ];
}

function buildRequirementCoverage(stages) {
  const stageIds = stages.map((item) => item.id);
  return [
    {
      requirement: "all software can be observed through low-token log/state learning, not just CAD or SolidWorks",
      currentCoverage: ["all_software_metadata_baseline", "event_triggered_low_token_policy", "one_bounded_visual_evidence"],
      evidenceNeededForCompletion: "live enrolled coverage for all reachable software plus recurring monitor output and teacher-reviewed post-registration witness",
      status: "partially_implemented_not_complete"
    },
    {
      requirement: "adapt to any teacher learning method",
      currentCoverage: ["learning_handoff", "tlcl_rag_contract_repair_loop", "post_action_evidence"],
      evidenceNeededForCompletion: "teacher-specific correction profiles proven across multiple teaching styles and retained review receipts",
      status: "review_gated_capability_available"
    },
    {
      requirement: "use high reasoning for contract compilation and repair, then medium reasoning only for reviewed bounded runtime",
      currentCoverage: ["tlcl_rag_contract_repair_loop", "execution_approval_gate", "post_action_evidence"],
      evidenceNeededForCompletion:
        "teacher-reviewed Rule Card/Rule DSL repair package, deterministic validation, workflow fingerprint review, providerRoleUsePlanTrace continuity, and fresh outcome review after each medium-runtime run",
      status: "tlcl_cost_control_loop_review_gated"
    },
    {
      requirement: "RAG is an external knowledge retriever and evidence source, not automatic authority",
      currentCoverage: ["tlcl_rag_contract_repair_loop", "learning_handoff"],
      evidenceNeededForCompletion:
        "retrieval evidence attachment with citations or logicExtractionHint, explicit non-authority locks, teacher review receipt, and fail-closed validation before repair reuse",
      status: "rag_evidence_only_locked"
    },
    {
      requirement: "stronger foundation models and distilled skills stay replaceable provider roles inside the contract lifecycle",
      currentCoverage: ["tlcl_rag_contract_repair_loop", "execution_approval_gate"],
      evidenceNeededForCompletion:
        "provider intake, provider qualification, providerRoleUsePlanTrace, runtime gate, deterministic validators, rollback evidence, and teacher review proving no provider bypasses TLCL",
      status: "provider_boundary_review_gated"
    },
    {
      requirement: "transparent drawing mask lets the teacher draw intent",
      currentCoverage: ["transparent_sketch_depth_demo"],
      evidenceNeededForCompletion: "teacher-exported overlay packet and validated spatial-intent receipt for a real local software case",
      status: "implemented_as_review_only_rehearsal"
    },
    {
      requirement: "understand perspective, position, 2D, and 3D sketch/depth demonstrations",
      currentCoverage: ["transparent_sketch_depth_demo", "voice_text_numbered_target"],
      evidenceNeededForCompletion: "spatial interpretation plus numbered target receipt tied to teacher evidence and route review",
      status: "implemented_as_logicized_dry_run_path"
    },
    {
      requirement: "execute in software only after teacher confirmation",
      currentCoverage: ["execution_approval_gate", "post_action_evidence"],
      evidenceNeededForCompletion: "validated target, reviewed route, explicit teacher execution confirmation, retained rollback point, and post-action witness",
      status: "gated_not_executed_by_this_flow"
    },
    {
      requirement: "avoid wasting tokens by using log changes before screenshots",
      currentCoverage: ["all_software_metadata_baseline", "event_triggered_low_token_policy", "one_bounded_visual_evidence"],
      evidenceNeededForCompletion: "delta monitor shows changed metadata before any visual check and policy caps screenshot count at one",
      status: "policy_defined_and_review_gated"
    },
    {
      requirement: "keep rollback points until the teacher confirms the direction",
      currentCoverage: stageIds,
      evidenceNeededForCompletion: "retained rollback-point path in execution receipts and no deletion before teacher confirmation",
      status: "required_by_flow_locks"
    }
  ];
}

function writeHtml(path, packet) {
  const stages = packet.stages
    .map(
      (item, index) => `<section>
        <h2>${index + 1}. ${escapeHtml(item.label)}</h2>
        <p>${escapeHtml(item.purpose)}</p>
        <p><strong>Gate:</strong> ${escapeHtml(item.gate)}</p>
        <p><strong>Output:</strong> ${escapeHtml(item.output)}</p>
        <p><strong>Next command template:</strong> <code>${escapeHtml(item.nextCommand)}</code></p>
        <p><strong>Reused tools:</strong> ${escapeHtml(item.reusedTools.join(", "))}</p>
        <p><strong>Blocked:</strong> ${escapeHtml(item.blockedActions.join(", "))}</p>
      </section>`
    )
    .join("\n");
  const requirements = packet.requirementCoverage
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(item.requirement)}</td>
        <td>${escapeHtml(item.currentCoverage.join(", "))}</td>
        <td>${escapeHtml(item.evidenceNeededForCompletion)}</td>
      </tr>`
    )
    .join("\n");
  const links = Object.entries(packet.paths)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li><a href="${escapeHtml(fileHref(value))}">${escapeHtml(key)}</a></li>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Original Goal Integrated Control Flow</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #18212b; background: #f7f9fc; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    section { background: white; border: 1px solid #dce3ea; padding: 14px; margin: 12px 0; border-radius: 6px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    code { background: #eef2f6; padding: 1px 4px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border: 1px solid #dce3ea; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef2f6; }
    .lock { color: #7b241c; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Integrated Control Flow</h1>
    <p>Status: <strong>${escapeHtml(packet.status)}</strong></p>
    <p>${escapeHtml(packet.purpose)}</p>
    <p class="lock">This packet does not capture screenshots, read full logs, execute software, send UI events, write memory, register schedules, enable rules, unlock packaging, or claim completion.</p>
    <h2>Files</h2>
    <ul>${links}</ul>
    <h2>Stages</h2>
    ${stages}
    <h2>Requirement Coverage</h2>
    <table>
      <thead><tr><th>Status</th><th>Requirement</th><th>Current coverage</th><th>Evidence still needed</th></tr></thead>
      <tbody>${requirements}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue(
  "--goal",
  "Original goal: all-software low-token log/state learning, teacher-method adaptation, transparent 2D/perspective/3D sketch intent, voice/text numbered confirmation, and gated execution."
);
const refreshPathInput = argValue("--refresh", argValue("--current-status-refresh", ""));
const refreshPath = refreshPathInput && existsSync(refreshPathInput) ? resolve(refreshPathInput) : "";
const refresh = optionalJson(refreshPath);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-integrated-control-flows")));

mkdirSync(outputRoot, { recursive: true });
const flowId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const flowDir = join(outputRoot, flowId);
mkdirSync(flowDir, { recursive: true });

const flowPath = join(flowDir, "original-goal-integrated-control-flow.json");
const htmlPath = join(flowDir, "original-goal-integrated-control-flow.html");
const readmePath = join(flowDir, "ORIGINAL_GOAL_INTEGRATED_CONTROL_FLOW_START_HERE.md");
const stageList = buildStages({ refreshPath, refresh });
const requirementCoverage = buildRequirementCoverage(stageList);

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_integrated_control_flow_v1",
  flowId,
  createdAt: new Date().toISOString(),
  goal,
  status: "ready_for_teacher_review_unified_low_token_visual_voice_sketch_flow",
  purpose:
    "One teacher-facing control flow that connects existing low-token software observation, triggered visual evidence, learning handoff, TLCL/RAG high-reasoning contract repair, voice/text numbered confirmation, transparent 2D/perspective/3D sketch rehearsal, execution gates, post-action evidence, and rollback discipline.",
  existingAbilitiesReused: Array.from(new Set(stageList.flatMap((item) => item.reusedTools))),
  stages: stageList,
  requirementCoverage,
  completionBoundary:
    "This flow proves the review-only wiring and gates, not universal native execution or completed all-software deployment.",
  nextSafeAction:
    "Open the HTML, pick one stage, fill the relevant teacher receipt, and keep a rollback point before any approved runner.",
  paths: {
    flow: flowPath,
    html: htmlPath,
    readme: readmePath,
    sourceRefresh: refreshPath
  },
  locks: locks()
};

writeFileSync(flowPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeFileSync(
  readmePath,
  [
    "# Original Goal Integrated Control Flow",
    "",
    `Status: ${packet.status}`,
    "",
    "This is the shortest single entry point for discussing or operating the original goal without pretending the full system is complete.",
    "",
    `HTML: ${htmlPath}`,
    `JSON: ${flowPath}`,
    refreshPath ? `Source refresh: ${refreshPath}` : "Source refresh: not provided",
    "",
    "Use order:",
    "1. Review all-software metadata and low-token trigger policy.",
    "2. Approve at most one bounded visual check only when compact evidence is ambiguous.",
    "3. Review the learning handoff before any memory/rule use.",
    "4. Use TLCL/RAG repair only as a high-reasoning contract loop: RAG is evidence, not authority; medium runtime stays blocked until teacher review and deterministic validation.",
    "5. Use voice/text or transparent sketch to produce numbered targets.",
    "6. Require selected target, reviewed route, teacher execution confirmation, and retained rollback point before any runner.",
    "7. Use post-action evidence and teacher correction before reusable memory or rules.",
    "",
    "Locked defaults: no screenshots, no full-log reads, no software execution, no UI events, no memory writes, no schedule registration, no rule enablement, no packaging unlock, goalComplete=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_integrated_control_flow_result_v1",
      flowId,
      flowPath,
      htmlPath,
      readmePath,
      stageCount: stageList.length,
      requirementCount: requirementCoverage.length,
      status: packet.status,
      locks: packet.locks
    },
    null,
    2
  )
);
