#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass, evidence });
}

function runConsole(args = []) {
  const result = spawnSync(
    process.execPath,
    [
      join(pluginRoot, "scripts", "create-tlcl-direction-operational-console.mjs"),
      "--out-dir",
      join(repoRoot, ".ta-smoke", "tlcl-direction-operational-console"),
      ...args
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`Console failed:\n${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const defaultResult = runConsole(["--goal", "Start the TLCL direction from a teacher-facing route chooser."]);
const ragResult = runConsole([
  "--goal",
  "Use RAG manuals and standards as evidence before contract compile.",
  "--teacher-command",
  "Read the standard and manual before making a reusable workflow."
]);
const correctionResult = runConsole([
  "--goal",
  "Repair a workflow after teacher correction.",
  "--teacher-command",
  "不对，刚才的角度规则错了，需要纠错后再执行。"
]);
const runtimeResult = runConsole([
  "--goal",
  "Reuse a confirmed workflow in engineering software.",
  "--teacher-command",
  "Execute the reviewed workflow with medium reasoning after validation.",
  "--software",
  "FixtureCAD"
]);

const defaultPacket = JSON.parse(readFileSync(defaultResult.packetPath, "utf8"));
const ragPacket = JSON.parse(readFileSync(ragResult.packetPath, "utf8"));
const correctionPacket = JSON.parse(readFileSync(correctionResult.packetPath, "utf8"));
const runtimePacket = JSON.parse(readFileSync(runtimeResult.packetPath, "utf8"));

check(
  "Console writes teacher-facing artifacts",
  defaultResult.format === "transparent_ai_tlcl_direction_operational_console_result_v1" &&
    existsSync(defaultResult.packetPath) &&
    existsSync(defaultResult.readmePath) &&
    existsSync(defaultResult.htmlPath),
  defaultResult.packetPath
);

check(
  "Console discovers the TLCL RAG return chain",
  defaultPacket.ragReturnChain.gateCount >= 18 &&
    defaultPacket.ragReturnChain.readyGateCount === defaultPacket.ragReturnChain.gateCount,
  `gates=${defaultPacket.ragReturnChain.gateCount}`
);

check(
  "Default route starts with the TLCL apprentice session launcher",
  defaultPacket.route.id === "route_to_tlcl_apprentice_session_launcher" &&
    defaultPacket.route.nextTool === "create_tlcl_apprentice_session_launcher",
  defaultPacket.route.reason
);

check(
  "RAG route keeps knowledge evidence non-authoritative",
  ragPacket.route.id === "route_to_rag_evidence_then_contract_compile" &&
    ragPacket.route.nextTool === "create_tlcl_rag_evidence_attachment" &&
    ragPacket.blockedShortcuts.some((item) => item.includes("RAG cannot authorize execution")),
  ragPacket.route.reason
);

check(
  "Teacher correction routes back to high reasoning repair",
  correctionPacket.route.id === "route_to_highest_reasoning_contract_repair" &&
    correctionPacket.route.nextTool === "create_tlcl_rag_informed_high_reasoning_repair_intake" &&
    correctionPacket.route.reasoningTier === "senior_reasoning_compile",
  correctionPacket.route.reason
);

check(
  "Runtime intent routes through reasoning budget before medium reuse",
  runtimePacket.route.id === "route_to_reasoning_budget_governor_before_medium_runtime" &&
    runtimePacket.route.nextTool === "create_tlcl_reasoning_budget_governor" &&
    runtimePacket.route.reasoningTier === "medium_reasoning_runtime_if_confirmed",
  runtimePacket.route.reason
);

check(
  "Console remains review-only and no-op locked",
  [defaultPacket, ragPacket, correctionPacket, runtimePacket].every(
    (packet) =>
      packet.locks.reviewOnly === true &&
      packet.locks.modelInvoked === false &&
      packet.locks.ragFetched === false &&
      packet.locks.targetSoftwareCommandsExecuted === false &&
      packet.locks.memoryWritten === false &&
      packet.locks.ruleEnabled === false &&
      packet.locks.packagingUnlocked === false &&
      packet.locks.goalComplete === false
  ),
  "model/RAG/software/memory/rules/packaging/completion locked"
);

const passed = checks.filter((item) => item.pass).length;
const status = passed === checks.length ? "passed" : "failed";
console.log(
  JSON.stringify(
    {
      status,
      smoke: "transparent_ai_tlcl_direction_operational_console_smoke_v1",
      passed,
      total: checks.length,
      checks
    },
    null,
    2
  )
);
if (status !== "passed") process.exit(1);
