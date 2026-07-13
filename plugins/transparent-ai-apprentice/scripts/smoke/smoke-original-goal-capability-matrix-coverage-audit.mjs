#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function read(relativePath) {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

const files = {
  readme: `${read("README.md")}\n${read("docs/internal-deep-route-catalog.md")}`,
  framework: read("TRANSPARENT_AI_APPRENTICE_FRAMEWORK_AND_LOGIC.md"),
  ragDirection: read("KNOWLEDGE_AUGMENTED_RAG_RESEARCH_DIRECTION.md"),
  mcpServer: read("scripts/mcp-server.mjs"),
  packageJson: readFileSync(join(repoRoot, "package.json"), "utf8"),
  verifyPlugin: read("scripts/verify-plugin.mjs"),
  goalCoverage: read("scripts/smoke-goal-coverage.mjs")
};

const capabilities = [
  {
    id: "knowledge_augmented_rag",
    description: "Knowledge-augmented RAG remains a research/evidence lane with source-backed disabled drafts.",
    pass:
      hasAll(files.readme, [
        "Current Knowledge-Augmented RAG Prototype",
        "source ids, hashes, trust notes",
        "npm run smoke:plugin-knowledge-rag-rule-draft"
      ]) &&
      hasAll(files.framework, ["知识增强与 RAG 研究分支", "RAG 是证据层，不是执行权"]) &&
      hasAll(files.ragDirection, ["knowledge-augmented RAG lane", "teacher review", "rollback points"]) &&
      hasAll(files.mcpServer, ["augment_low_token_learning_with_retrieval", "create_knowledge_augmented_spatial_execution_bridge"]) &&
      hasAll(files.packageJson, [
        "smoke:plugin-knowledge-rag-rule-draft",
        "smoke:plugin-knowledge-augmented-low-token-learning",
        "smoke:plugin-knowledge-augmented-spatial-execution-bridge"
      ])
  },
  {
    id: "low_token_visual_escalation",
    description: "Low-token observation uses metadata/log deltas first and escalates to bounded visual checks only after review.",
    pass:
      hasAll(files.readme, [
        "does not continuously record",
        "changed log/metadata trigger creates one reviewed screenshot request",
        "npm run smoke:plugin-triggered-visual-check"
      ]) &&
      hasAll(files.framework, ["低 token 观察", "默认不连续录屏", "必要时截图"]) &&
      hasAll(files.mcpServer, ["visualCheckAfterLogChange", "create_triggered_visual_check_request"]) &&
      hasAll(files.packageJson, [
        "smoke:plugin-triggered-visual-check",
        "smoke:plugin-triggered-visual-capture",
        "smoke:plugin-triggered-visual-learning-handoff"
      ])
  },
  {
    id: "voice_text_numbered_engineering_control",
    description: "Voice/text engineering control routes through numbered target candidates and approval gates.",
    pass:
      hasAll(files.readme, [
        "engineering voice/text control session chains the existing voice kit",
        "waits at numbered target candidates before teacher confirmation",
        "npm run smoke:plugin-engineering-voice-control-workbench"
      ]) &&
      hasAll(files.framework, ["语音/文字操控工程软件", "老师选择编号", "没有目标编号确认"]) &&
      hasAll(files.mcpServer, [
        "engineeringVoiceControlWorkbench",
        "engineeringVoiceControlSession",
        "run_engineering_voice_command_control_loop"
      ]) &&
      hasAll(files.packageJson, [
        "smoke:plugin-engineering-voice-control-session",
        "smoke:plugin-engineering-voice-control-workbench",
        "smoke:plugin-engineering-voice-command-control-loop"
      ])
  },
  {
    id: "spatial_numbered_target_confirmation",
    description: "Transparent sketch and spatial intent produce numbered candidates before any execution route.",
    pass:
      hasAll(files.readme, [
        "target is numbered and teacher-confirmed",
        "npm run smoke:plugin-spatial-target-confirmation",
        "npm run smoke:plugin-spatial-execution-route"
      ]) &&
      hasAll(files.framework, ["透明绘画蒙版与空间理解", "目标对象编号", "AI 标号"]) &&
      hasAll(files.mcpServer, ["spatialTargetConfirmation", "create_spatial_software_execution_route_bridge"]) &&
      hasAll(files.packageJson, ["smoke:plugin-spatial-target-confirmation", "smoke:plugin-spatial-execution-route"])
  },
  {
    id: "universal_detail_logic",
    description: "Detail logic turns lines, angles, proportions, constraints, and data relationships into reviewable rules.",
    pass:
      hasAll(files.readme, [
        "universal detail logic",
        "create-parametric-drawing-logic-learning-kit.mjs",
        "apply-universal-detail-logic-rule-package-dry-run.mjs"
      ]) &&
      hasAll(files.framework, ["Original Goal Capability Matrix Audit", "universal detail logic", "strict data-to-output relationships"]) &&
      hasAll(files.mcpServer, ["universalDetailLogic", "featureDataLogic", "create_universal_detail_logic_existing_tool_preview_package"]) &&
      hasAll(files.packageJson, [
        "smoke:plugin-universal-detail-logic-application-dry-run",
        "smoke:plugin-universal-detail-logic-existing-tool-preview-package"
      ])
  },
  {
    id: "existing_tool_first_feasibility",
    description: "Early feasibility uses existing drawing, voice, browser, CLI/API, import/export, and supervised UI routes.",
    pass:
      hasAll(files.readme, [
        "existing-tool route such as draw.io",
        "draw.io, Excalidraw",
        "existing software execution adapter"
      ]) &&
      hasAll(files.framework, ["使用现有工具优先", "draw.io、Excalidraw、Mermaid", "文件导入导出"]) &&
      hasAll(files.mcpServer, ["create_existing_software_execution_adapter", "existing-browser-automation", "existing-file-import-export"]) &&
      hasAll(files.packageJson, ["smoke:plugin-import", "smoke:plugin-existing-drawing-spatial-controlled-execution"])
  },
  {
    id: "rollback_and_approval_safety",
    description: "Rollback points and approval gates stay visible before reviewed execution or registration steps.",
    pass:
      hasAll(files.readme, ["npm run smoke:plugin-rollback", "rollback point", "approval gate"]) &&
      hasAll(files.framework, ["rollback point", "审批门控", "回滚点"]) &&
      hasAll(files.mcpServer, ["rollbackPointCreated", "create_engineering_voice_execution_approval_gate"]) &&
      hasAll(files.packageJson, ["smoke:plugin-rollback", "smoke:plugin-engineering-voice-execution-approval-gate"])
  }
];

const missing = capabilities.filter((capability) => !capability.pass);
const result = {
  ok: missing.length === 0,
  smoke: "transparent_ai_original_goal_capability_matrix_coverage_audit_smoke_v1",
  capabilityCount: capabilities.length,
  coveredCapabilityIds: capabilities.filter((capability) => capability.pass).map((capability) => capability.id),
  missingCapabilityIds: missing.map((capability) => capability.id),
  capabilities,
  auditedSurfaces: [
    "README.md",
    "docs/internal-deep-route-catalog.md",
    "TRANSPARENT_AI_APPRENTICE_FRAMEWORK_AND_LOGIC.md",
    "KNOWLEDGE_AUGMENTED_RAG_RESEARCH_DIRECTION.md",
    "scripts/mcp-server.mjs",
    "package.json",
    "scripts/verify-plugin.mjs",
    "scripts/smoke-goal-coverage.mjs"
  ],
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    externalFetchPerformed: false,
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    ruleEnabled: false,
    acceptanceClaimed: false,
    packagingUnlocked: false,
    goalComplete: false
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error(
    JSON.stringify(
      {
        error: "ORIGINAL_GOAL_CAPABILITY_MATRIX_COVERAGE_AUDIT_MISSING_CAPABILITIES",
        missingCapabilityIds: result.missingCapabilityIds
      },
      null,
      2
    )
  );
  process.exit(1);
}
