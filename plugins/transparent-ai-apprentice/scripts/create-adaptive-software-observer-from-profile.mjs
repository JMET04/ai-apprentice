#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "adaptive-software-observer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "adaptive-software-observer";
}

function readJson(path, label) {
  if (!path || !existsSync(path)) throw new Error(`${label} not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function eventLogsFrom(profile, probe) {
  const probeLogs = Array.isArray(probe?.eventSummaries)
    ? probe.eventSummaries.filter((item) => !item.error && (item.recentCount ?? 0) >= 0).map((item) => item.logName)
    : [];
  return unique([...(profile.windowsEventLogs ?? []), ...probeLogs, "Application", "System"]);
}

function logPathsFrom(profile, probe, max = 40) {
  const explicit = Array.isArray(profile.explicitLogPaths) ? profile.explicitLogPaths : [];
  const candidates = Array.isArray(probe?.candidateLogs) ? probe.candidateLogs.map((item) => item.path) : [];
  return unique([...explicit, ...candidates]).slice(0, max);
}

function logRootsFrom(profile, max = 12) {
  const roots = Array.isArray(profile.candidateLogRoots) ? profile.candidateLogRoots : [];
  return unique(roots.filter((root) => root !== "current workspace")).slice(0, max);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

const profilePath = resolve(argValue("--profile", argValue("--profile-path", "")));
const probePathArg = argValue("--probe-result", argValue("--probe", ""));
const probePath = probePathArg ? resolve(probePathArg) : "";
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "adaptive-software-observers")));
const createObserver = !argFlag("--no-create-observer");

const profile = readJson(profilePath, "software capability profile");
const probe = probePath && existsSync(probePath) ? readJson(probePath, "software capability probe result") : null;
if (profile.format !== "transparent_ai_software_capability_profile_v1") {
  throw new Error(`Unsupported profile format: ${profile.format}`);
}
if (probe && probe.format !== "transparent_ai_software_capability_probe_result_v1") {
  throw new Error(`Unsupported probe result format: ${probe.format}`);
}

mkdirSync(outputRoot, { recursive: true });
const setupId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${profile.software}-${profile.goal}`)}`;
const setupDir = join(outputRoot, setupId);
mkdirSync(setupDir, { recursive: true });

const selectedLogPaths = logPathsFrom(profile, probe);
const selectedLogRoots = selectedLogPaths.length > 0 ? [] : logRootsFrom(profile);
const selectedEventLogs = eventLogsFrom(profile, probe);
const processName =
  profile.processName ||
  (Array.isArray(probe?.processMatches) && probe.processMatches[0]?.processName ? probe.processMatches[0].processName : "");
const windowTitle =
  profile.windowTitle ||
  (Array.isArray(probe?.processMatches) && probe.processMatches[0]?.mainWindowTitle ? probe.processMatches[0].mainWindowTitle : "");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const observerArgs = [
  "--goal",
  profile.goal || "Learn from this software with low-token observation.",
  "--software",
  profile.software || "unknown software",
  "--output-dir",
  join(setupDir, "universal-observer")
];
if (processName) observerArgs.push("--process-name", processName);
if (windowTitle) observerArgs.push("--window-title", windowTitle);
for (const path of selectedLogPaths) observerArgs.push("--log-path", path);
for (const root of selectedLogRoots) observerArgs.push("--log-root", root);
for (const eventLog of selectedEventLogs) observerArgs.push("--windows-event-log", eventLog);

const observerKit = createObserver ? runNodeScript("create-universal-software-observer-kit.mjs", observerArgs) : null;

const setupPath = join(setupDir, "adaptive-software-observer-setup.json");
const readmePath = join(setupDir, "ADAPTIVE_OBSERVER_START_HERE.md");
const teachTemplatePath = join(setupDir, "teach-apprentice-observation-template.json");
const setup = {
  format: "transparent_ai_adaptive_software_observer_setup_v1",
  setupId,
  profilePath,
  probeResultPath: probePath,
  profileId: profile.profileId,
  software: profile.software,
  goal: profile.goal,
  processName,
  windowTitle,
  selectedLogPaths,
  selectedLogRoots,
  selectedEventLogs,
  selectionReason: [
    selectedLogPaths.length > 0 ? "Use explicit/probed candidate logs first." : "No concrete log files were found; fall back to profile log roots.",
    "Keep Windows Event Log summaries available.",
    "Ask the teacher only when the observer output is ambiguous or no cheap source changes.",
    "Screenshots remain trigger-only and are not continuous recording."
  ],
  observerArgs,
  observerKit,
  nextTeachingCall: {
    tool: "teach_apprentice",
    message: "After running the generated universal observer collector, paste transparent_ai_universal_software_observation_v1 JSON here."
  },
  locks
};

const teachTemplate = {
  format: "transparent_ai_universal_software_observation_v1",
  sourceTool: "adaptive software observer from capability profile",
  software: profile.software,
  profileId: profile.profileId,
  setupId,
  fullContinuousRecording: false,
  logSummaries: [],
  eventSummaries: [],
  teacherNotes: [],
  suggestedTeacherQuestions: [
    "Which observed signal should count as a reusable learning moment?",
    "Is this normal, success, warning, failure, or a boundary case?",
    "Should I ask before acting when this source changes again?"
  ],
  locks
};

writeFileSync(setupPath, `${JSON.stringify(setup, null, 2)}\n`, "utf8");
writeFileSync(teachTemplatePath, `${JSON.stringify(teachTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Adaptive Software Observer From Profile",
    "",
    `Software: ${profile.software}`,
    `Goal: ${profile.goal}`,
    "",
    "This bridges the read-only software capability profile into a universal low-token observer kit.",
    "",
    "Recommended order:",
    "",
    "1. Review `adaptive-software-observer-setup.json` and the selected log/event sources.",
    "2. Open the generated universal observer readme under `universal-observer`.",
    "3. Run the generated collector only when the teacher is ready for low-token observation.",
    "4. Paste the resulting `transparent_ai_universal_software_observation_v1` JSON back to `teach_apprentice`.",
    "",
    "Limits: this does not prove every app exposes logs and does not execute native software. It only narrows and activates the cheapest observer path.",
    "",
    "Locked defaults: ruleEnabled=false, accepted=false, technologyAccepted=false, packagingGated=true, fullContinuousRecording=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_adaptive_software_observer_setup_result_v1",
      setupId,
      setupPath,
      teacherReadme: readmePath,
      teachTemplate: teachTemplatePath,
      observerKitPath: observerKit?.kitPath ?? "",
      observerCollector: observerKit?.collector ?? "",
      selectedLogPathCount: selectedLogPaths.length,
      selectedLogRootCount: selectedLogRoots.length,
      selectedEventLogs,
      defaultNextTool: "create_universal_software_observer_kit",
      fullContinuousRecording: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
