#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "visual-engineering-target-confirmation-smoke", String(Date.now()));
const mcpServerSource = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], env = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const visualEvidencePath = join(smokeRoot, "reviewed-engineering-screen.svg");
writeFileSync(
  visualEvidencePath,
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">',
    '<rect width="1280" height="720" fill="#eef3f0"/>',
    '<rect x="36" y="80" width="260" height="580" rx="8" fill="#d9e3de" stroke="#8ca199"/>',
    '<rect x="340" y="80" width="880" height="580" rx="8" fill="#f9fbf8" stroke="#8ca199"/>',
    '<circle cx="960" cy="180" r="72" fill="#9bc6b5" stroke="#0f766e" stroke-width="8"/>',
    '<text x="78" y="132" font-family="Arial" font-size="28" fill="#203d35">feature tree</text>',
    '<text x="884" y="184" font-family="Arial" font-size="24" fill="#203d35">upper right target</text>',
    '</svg>'
  ].join(""),
  "utf8"
);

const visualKit = runNodeScript("create-visual-engineering-target-confirmation-kit.mjs", [
  "--goal",
  "Let a non-expert mark a visible engineering target from one reviewed screenshot.",
  "--software",
  "generic engineering modeler",
  "--command",
  "Select the upper right target and prepare a measurement there.",
  "--visual-evidence",
  visualEvidencePath,
  "--candidate",
  "upper right model target|0.75|0.25|0.15|visual evidence contains the target in the upper right model view",
  "--candidate",
  "left feature tree item|0.16|0.42|0|alternative if the command refers to the feature tree",
  "--output-dir",
  join(smokeRoot, "visual-kit")
]);

const packet = readJson(visualKit.packetPath);
const targetConfirmation = readJson(visualKit.targetConfirmation);
const overlay = readJson(visualKit.overlayPacket);

const confirmed = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  visualKit.targetConfirmation,
  "--selected-number",
  "1",
  "--software",
  "generic engineering modeler",
  "--create-action-kit",
  "--output-dir",
  join(smokeRoot, "confirmed")
]);
const confirmedReceipt = readJson(confirmed.receipt);
const narrowedOverlay = readJson(confirmed.narrowedOverlayPacket);

const checks = [
  {
    name: "Visual evidence becomes a numbered engineering target confirmation packet",
    pass:
      visualKit.format === "transparent_ai_visual_engineering_target_confirmation_result_v1" &&
      packet.format === "transparent_ai_visual_engineering_target_confirmation_v1" &&
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.visualEvidencePath === visualEvidencePath &&
      targetConfirmation.candidates.length === 2,
    evidence: visualKit.packetPath
  },
  {
    name: "Numbered overlay uses the reviewed screenshot as backdrop without capturing a new screenshot",
    pass:
      overlay.format === "transparent_ai_sketch_overlay_packet_v1" &&
      overlay.backdrop.path === visualEvidencePath &&
      overlay.anchors.length === 2 &&
      packet.locks.screenshotsCapturedByThisTool === false &&
      packet.locks.softwareActionsExecuted === false,
    evidence: visualKit.overlayPacket
  },
  {
    name: "Confirmed visual number reuses the existing single-target dry-run bridge",
    pass:
      confirmedReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmedReceipt.selectedCandidateNumber === 1 &&
      confirmedReceipt.evidence.selectedTargetOnly === true &&
      narrowedOverlay.anchors.length === 1 &&
      confirmed.softwareActionsExecuted === false &&
      confirmed.nativeUniversalExecution === false,
    evidence: confirmed.receipt
  },
  {
    name: "MCP advanced tool exposes visual engineering target confirmation",
    pass: mcpServerSource.includes('name: "create_visual_engineering_target_confirmation_kit"'),
    evidence: "mcp-server.mjs contains create_visual_engineering_target_confirmation_kit"
  },
  {
    name: "Visual target confirmation keeps broad completion honest",
    pass:
      packet.locks.accepted === false &&
      packet.locks.ruleEnabled === false &&
      packet.locks.nativeUniversalExecution === false &&
      packet.blockedActions.includes("claim_universal_native_execution"),
    evidence: JSON.stringify(packet.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_visual_engineering_target_confirmation_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
