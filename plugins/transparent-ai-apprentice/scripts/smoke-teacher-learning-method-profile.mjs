#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const runsFromSourceTree = existsSync(join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs"));
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const script = join(pluginRoot, "scripts", "create-teacher-learning-method-profile.mjs");
const mcpServer = join(pluginRoot, "scripts", "mcp-server.mjs");
const tempRoot = mkdtempSync(join(tmpdir(), "transparent-ai-teacher-method-"));

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input ?? undefined
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `node ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mcpCall(name, args = {}, env = {}) {
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }
  ];
  const stdout = runNode([mcpServer], { env, input: messages.map((message) => JSON.stringify(message)).join("\n") + "\n" });
  const responses = stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const response = responses.find((item) => item.id === 2);
  assert(response && !response.error, `MCP call failed: ${JSON.stringify(response?.error ?? responses)}`);
  return JSON.parse(response.result.content[0].text);
}

const direct = JSON.parse(
  runNode([
    script,
    "--goal",
    "Learn how this teacher wants the apprentice to watch software and draw overlay corrections.",
    "--software",
    "arbitrary desktop software",
    "--teacher-message",
    "I prefer to first draw a transparent sketch, then let you watch log metadata changes. Ask fewer questions and only ask at reusable rule boundaries.",
    "--teacher-style",
    "overlay sketch, software log deltas, correction-first",
    "--evidence-preference",
    "log metadata first",
    "--preferred-tool",
    "Excalidraw",
    "--output-dir",
    tempRoot
  ])
);

const profile = JSON.parse(readFileSync(direct.profilePath, "utf8"));
const route = JSON.parse(readFileSync(direct.routePath, "utf8"));
assert(profile.format === "transparent_ai_teacher_learning_method_profile_v1", "profile format should be stable");
assert(route.format === "transparent_ai_teacher_learning_method_route_v1", "route format should be stable");
assert(existsSync(direct.teacherReadme), "teacher readme should exist");
assert(profile.locks.packagingGated === true, "packaging should stay gated");
assert(profile.locks.accepted === false && profile.locks.ruleEnabled === false, "profile must not approve memory");
assert(profile.locks.fullContinuousRecording === false, "profile must not enable continuous recording");
assert(profile.locks.nativeUniversalExecution === false, "profile must not claim native universal execution");
assert(profile.preferredTeachingModes.some((mode) => mode.mode === "transparent_overlay_sketch"), "overlay mode should be inferred");
assert(profile.preferredTeachingModes.some((mode) => mode.mode === "software_log_deltas"), "log-delta mode should be inferred");
assert(profile.nextSuggestedTools.includes("create_transparent_sketch_overlay_kit"), "overlay tool should be suggested");
assert(profile.nextSuggestedTools.includes("watch_log_source_metadata_deltas"), "metadata gate should be suggested");

const advanced = mcpCall(
  "create_teacher_learning_method_profile",
  {
    goal: "Adapt to a teacher who explains through examples and corrections.",
    teacherMessage: "I like examples first, then I correct the boundary.",
    evidencePreferences: ["examples", "corrections"],
    outputDir: tempRoot
  },
  { TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }
);
assert(advanced.format === "transparent_ai_teacher_learning_method_profile_result_v1", "advanced MCP tool should return profile result");
assert(advanced.nextSuggestedTools.includes("teach_apprentice"), "advanced profile should route back to teach_apprentice");

const ordinary = mcpCall("teach_apprentice", {
  goal: "Teach the apprentice to adapt to my method before watching software.",
  message: "I prefer sketch first, then log metadata changes; ask fewer questions and only ask at reusable rule boundaries.",
  adaptTeacherMethod: true,
  outputDir: tempRoot
});
assert(ordinary.format === "transparent_ai_teach_apprentice_card_v1", "ordinary route should return teacher card");
assert(ordinary.status === "waiting_for_teacher_method_review", "ordinary route should wait for teacher method review");
assert(ordinary.teacherMethodProfile?.profilePath, "teacher card should expose teacherMethodProfile");
assert(ordinary.teacherMethodProfile.fullContinuousRecording === false, "teacher card should keep continuous recording off");
assert(ordinary.teacherMethodProfile.nativeUniversalExecution === false, "teacher card should keep native execution unclaimed");

const summary = {
  format: "transparent_ai_teacher_learning_method_profile_smoke_v1",
  status: "passed",
  checks: [
    "direct script creates review-only teacher method profile",
    "MCP advanced mode exposes and runs create_teacher_learning_method_profile",
    "ordinary teach_apprentice routes teacher-method intent to a teacher-facing card",
    "profile suggests existing low-token tools instead of continuous recording"
  ],
  tempRoot
};

console.log(JSON.stringify(summary, null, 2));
