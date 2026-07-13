#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const scriptsRoot = join(pluginRoot, "scripts");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-direction-operational-console")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-direction-operational-console"
  );
}

function read(relativePath) {
  const fullPath = join(pluginRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function fileReady(relativePath, tokens = []) {
  const fullPath = join(pluginRoot, relativePath);
  const text = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  const missingTokens = tokens.filter((token) => !text.includes(token));
  return {
    path: fullPath,
    exists: existsSync(fullPath),
    missingTokens,
    ready: existsSync(fullPath) && missingTokens.length === 0
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function discoverRagReturnGates() {
  const prefix = "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-";
  const suffix = "-builder.mjs";
  return readdirSync(scriptsRoot)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => {
      const id = name.slice(prefix.length, -suffix.length);
      const validateName = `validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-${id}.mjs`;
      const smokeName = `smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-${id}.mjs`;
      const builderPath = join(scriptsRoot, name);
      const validatorPath = join(scriptsRoot, validateName);
      const smokePath = join(scriptsRoot, smokeName);
      const builderText = existsSync(builderPath) ? readFileSync(builderPath, "utf8") : "";
      const validatorText = existsSync(validatorPath) ? readFileSync(validatorPath, "utf8") : "";
      const smokeText = existsSync(smokePath) ? readFileSync(smokePath, "utf8") : "";
      return {
        id,
        builder: relative(pluginRoot, builderPath).replaceAll("\\", "/"),
        validator: relative(pluginRoot, validatorPath).replaceAll("\\", "/"),
        smoke: relative(pluginRoot, smokePath).replaceAll("\\", "/"),
        ready:
          existsSync(builderPath) &&
          existsSync(validatorPath) &&
          existsSync(smokePath) &&
          builderText.includes("goalComplete: false") &&
          validatorText.includes("high_reasoning_logic_contract_repair") &&
          smokeText.includes("blocks forbidden")
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function decideRoute({ goal, teacherCommand, software }) {
  const text = `${goal} ${teacherCommand} ${software}`.toLowerCase();
  const hasCorrection =
    /\b(correction|correct|wrong|repair|mismatch|failed|failure)\b/.test(text) ||
    ["不对", "纠错", "修正", "错误"].some((token) => text.includes(token));
  const hasRag = ["rag", "knowledge", "manual", "standard", "source", "paper", "知识", "标准", "手册", "资料", "论文"].some(
    (token) => text.includes(token)
  );
  const hasRuntime = ["execute", "run", "reuse", "workflow", "voice", "text", "software", "执行", "复用", "工作流", "语音"].some(
    (token) => text.includes(token)
  );

  if (hasCorrection) {
    return {
      id: "route_to_highest_reasoning_contract_repair",
      label: "Return correction to highest-reasoning contract repair",
      reason: "Teacher correction or mismatch evidence must repair the contract before medium-runtime reuse.",
      nextTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
      reasoningTier: "senior_reasoning_compile"
    };
  }
  if (hasRag) {
    return {
      id: "route_to_rag_evidence_then_contract_compile",
      label: "Collect RAG evidence, then compile or repair the contract",
      reason: "Knowledge sources should become evidence packets and disabled rules, not automatic authority.",
      nextTool: "create_tlcl_rag_evidence_attachment",
      reasoningTier: "senior_reasoning_compile"
    };
  }
  if (hasRuntime) {
    return {
      id: "route_to_reasoning_budget_governor_before_medium_runtime",
      label: "Check reasoning budget before medium-runtime workflow reuse",
      reason: "Medium reasoning may run only reviewed, validated, rollback-protected workflows.",
      nextTool: "create_tlcl_reasoning_budget_governor",
      reasoningTier: "medium_reasoning_runtime_if_confirmed"
    };
  }
  return {
    id: "route_to_tlcl_apprentice_session_launcher",
    label: "Start from the TLCL apprentice session launcher",
    reason: "No confirmed evidence lane is selected yet; start with the teacher-facing route chooser.",
    nextTool: "create_tlcl_apprentice_session_launcher",
    reasoningTier: "teacher_review_first"
  };
}

const goal = argValue("--goal", "Create the TLCL direction operational console.");
const teacherCommand = argValue("--teacher-command", argValue("--command", ""));
const software = argValue("--software", argValue("--app", ""));
const outputRoot = resolve(argValue("--out-dir", argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "tlcl-direction-operational-console"))));
const consoleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const consoleDir = join(outputRoot, consoleId);
mkdirSync(consoleDir, { recursive: true });

const pluginReadme = `${read("README.md")}\n${read("docs/internal-deep-route-catalog.md")}`;
const rootReadme = existsSync(join(repoRoot, "README.md")) ? readFileSync(join(repoRoot, "README.md"), "utf8") : "";
const packageJsonText = existsSync(join(repoRoot, "package.json")) ? readFileSync(join(repoRoot, "package.json"), "utf8") : "";
const mcpServerText = read("scripts/mcp-server.mjs");

const ragReturnGates = discoverRagReturnGates();
const route = decideRoute({ goal, teacherCommand, software });

const capabilityChecks = [
  {
    id: "highest_reasoning_compile_medium_runtime_split",
    ready:
      pluginReadme.includes("create-tlcl-reasoning-budget-governor") &&
      pluginReadme.includes("medium reasoning") &&
      pluginReadme.includes("high reasoning"),
    evidence: "Reasoning budget governor documents high-reasoning compile and medium-runtime reuse."
  },
  {
    id: "rag_external_knowledge_evidence_only",
    ready:
      pluginReadme.includes("RAG evidence") &&
      pluginReadme.includes("non-authoritative") &&
      packageJsonText.includes("smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit"),
    evidence: "RAG evidence is routed to high-reasoning repair and blocked from authority."
  },
  {
    id: "rag_result_return_chain_covered",
    ready:
      ragReturnGates.length >= 18 &&
      ragReturnGates.every((gate) => gate.ready) &&
      packageJsonText.includes("smoke:plugin-tlcl-rag-return-chain-coverage-audit"),
    evidence: `${ragReturnGates.length} TLCL/RAG result-return gates are discoverable and no-op locked.`
  },
  {
    id: "provider_boundary_for_stronger_models_and_distilled_skills",
    ready:
      pluginReadme.includes("create-tlcl-capability-provider-intake") &&
      packageJsonText.includes("smoke:plugin-tlcl-market-response-provider-boundary-audit"),
    evidence: "Stronger models, distilled skills, open-source models, and local tools stay role-scoped providers."
  },
  {
    id: "teacher_correction_returns_to_high_reasoning",
    ready:
      pluginReadme.includes("correction") &&
      pluginReadme.includes("high-reasoning") &&
      mcpServerText.includes("correct_last_result"),
    evidence: "Teacher corrections remain explicit review events and route back to senior compile/repair."
  },
  {
    id: "read_only_teacher_facing_console_entry",
    ready: true,
    evidence: "This console emits next-step commands and review routes only; it runs no model, RAG, software, memory, rule enablement, or packaging unlock."
  }
];

const suggestedCommands = [
  {
    id: "start_tlcl_launcher",
    purpose: "Open the teacher-facing route chooser for a new TLCL apprentice session.",
    command: commandLine("create-tlcl-apprentice-session-launcher.mjs", [
      ["--goal", goal],
      ["--software", software],
      ["--teacher-command", teacherCommand]
    ]),
    executesNow: false
  },
  {
    id: "audit_rag_return_chain",
    purpose: "Confirm the RAG result-return chain has not drifted before continuing.",
    command: "npm run smoke:plugin-tlcl-rag-return-chain-coverage-audit",
    executesNow: false
  },
  {
    id: "check_reasoning_budget",
    purpose: "Route the next reviewed step to high reasoning, medium runtime, low reasoning, or blocked.",
    command: commandLine("create-tlcl-reasoning-budget-governor.mjs", [["--goal", goal]]),
    executesNow: false
  },
  {
    id: "provider_boundary_audit",
    purpose: "Keep stronger models and distilled skills inside the TLCL provider lifecycle.",
    command: "npm run smoke:plugin-tlcl-market-response-provider-boundary-audit",
    executesNow: false
  }
];

const locks = {
  reviewOnly: true,
  staticConsoleOnly: true,
  modelInvoked: false,
  ragFetched: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  ruleEnabled: false,
  accepted: false,
  packagingUnlocked: false,
  goalComplete: false
};

const consolePacket = {
  format: "transparent_ai_tlcl_direction_operational_console_v1",
  consoleId,
  createdAt: new Date().toISOString(),
  status: capabilityChecks.every((check) => check.ready) ? "ready_for_teacher_next_route_review" : "needs_direction_coverage_repair",
  goal,
  software,
  teacherCommand,
  route,
  capabilityChecks,
  ragReturnChain: {
    gateCount: ragReturnGates.length,
    readyGateCount: ragReturnGates.filter((gate) => gate.ready).length,
    gates: ragReturnGates
  },
  suggestedCommands,
  existingCapabilitiesUsed: [
    "create-tlcl-status-refresh.mjs",
    "create-tlcl-apprentice-session-launcher.mjs",
    "create-tlcl-reasoning-budget-governor.mjs",
    "create-tlcl-rag-evidence-attachment.mjs",
    "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
    "smoke-tlcl-rag-return-chain-coverage-audit.mjs",
    "smoke-tlcl-market-response-provider-boundary-audit.mjs"
  ],
  blockedShortcuts: [
    "RAG cannot authorize execution or rule enablement.",
    "Medium reasoning cannot compile or repair normative rules.",
    "Stronger foundation models and distilled skills cannot self-approve.",
    "Teacher corrections must return to high-reasoning contract repair.",
    "No software action may run without separate teacher-reviewed execution gates and rollback."
  ],
  locks
};

const packetPath = join(consoleDir, "tlcl-direction-operational-console.json");
const readmePath = join(consoleDir, "TLCL_DIRECTION_OPERATIONAL_CONSOLE_START_HERE.md");
const htmlPath = join(consoleDir, "tlcl-direction-operational-console.html");
writeFileSync(packetPath, `${JSON.stringify(consolePacket, null, 2)}\n`, "utf8");

const md = [
  "# TLCL Direction Operational Console",
  "",
  `Status: ${consolePacket.status}`,
  `Route: ${route.label}`,
  "",
  "This is a low-token, review-only console for the current project direction. It organizes existing TLCL capabilities into the next safe route without invoking a model, fetching RAG, executing software, writing memory, enabling rules, unlocking packaging, or claiming completion.",
  "",
  "Recommended next route:",
  `- ${route.label}`,
  `- Reason: ${route.reason}`,
  `- Next tool: ${route.nextTool}`,
  `- Reasoning tier: ${route.reasoningTier}`,
  "",
  "Capability checks:",
  ...capabilityChecks.map((check) => `- ${check.ready ? "READY" : "MISSING"} ${check.id}: ${check.evidence}`),
  "",
  "Prepared commands:",
  ...suggestedCommands.map((item) => `- ${item.id}: ${item.command}`),
  "",
  "Locks:",
  ...Object.entries(locks).map(([key, value]) => `- ${key}: ${value}`)
].join("\n");
writeFileSync(readmePath, `${md}\n`, "utf8");

const html = `<!doctype html>
<meta charset="utf-8">
<title>TLCL Direction Operational Console</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;line-height:1.45;color:#17202a;background:#f7f8fa}
main{max-width:1040px;margin:auto}
section{background:white;border:1px solid #d8dee6;border-radius:8px;padding:16px;margin:12px 0}
h1,h2{margin:0 0 10px}
code{background:#eef2f7;padding:2px 5px;border-radius:4px}
.ready{color:#116329;font-weight:600}.missing{color:#9a3412;font-weight:600}
pre{white-space:pre-wrap;background:#101820;color:#f5f7fb;padding:12px;border-radius:6px;overflow:auto}
</style>
<main>
<h1>TLCL Direction Operational Console</h1>
<section><h2>Status</h2><p><b>${htmlEscape(consolePacket.status)}</b></p><p>${htmlEscape(route.reason)}</p></section>
<section><h2>Recommended Route</h2><p>${htmlEscape(route.label)}</p><p>Next tool: <code>${htmlEscape(route.nextTool)}</code></p><p>Reasoning tier: <code>${htmlEscape(route.reasoningTier)}</code></p></section>
<section><h2>Capability Checks</h2>${capabilityChecks
  .map((check) => `<p class="${check.ready ? "ready" : "missing"}">${check.ready ? "READY" : "MISSING"} ${htmlEscape(check.id)}<br><span>${htmlEscape(check.evidence)}</span></p>`)
  .join("")}</section>
<section><h2>Prepared Commands</h2>${suggestedCommands
  .map((item) => `<p><b>${htmlEscape(item.id)}</b></p><pre>${htmlEscape(item.command)}</pre>`)
  .join("")}</section>
<section><h2>Generated Files</h2><p><a href="${pathToFileURL(packetPath).href}">JSON packet</a></p><p><a href="${pathToFileURL(readmePath).href}">Start here Markdown</a></p></section>
</main>`;
writeFileSync(htmlPath, `${html}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_direction_operational_console_result_v1",
      status: consolePacket.status,
      route: route.id,
      nextTool: route.nextTool,
      reasoningTier: route.reasoningTier,
      packetPath,
      readmePath,
      htmlPath,
      ragReturnGateCount: consolePacket.ragReturnChain.gateCount,
      readyCapabilityChecks: capabilityChecks.filter((check) => check.ready).length,
      totalCapabilityChecks: capabilityChecks.length,
      locks
    },
    null,
    2
  )
);
