#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function runScript(scriptName, args) {
  const packagedScript = join(scriptDir, scriptName);
  const sourceTreeScript = join(process.cwd(), "plugins", "transparent-ai-apprentice", "scripts", scriptName);
  const scriptPath = existsSync(packagedScript) ? packagedScript : sourceTreeScript;
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

function compact(value) {
  if (!value || typeof value !== "object") return value;
  const keep = [
    "ok",
    "format",
    "sessionPath",
    "autoDiscoveredSession",
    "sessionDiscoverySource",
    "capturePath",
    "artifactPath",
    "eventCount",
    "sourceTool",
    "recordingUrl",
    "teacherResponse",
    "responseDecision",
    "needsClarification",
    "manifestPath",
    "templateId",
    "kitPath",
    "htmlPath",
    "readmePath",
    "receiptTemplatePath",
    "files",
    "observationPolicy",
    "sourceMap",
    "questionMode",
    "software",
    "mode",
    "firstUsePreference",
    "taughtResult",
    "replayResult",
    "profileSaveResult",
    "reviewStatus",
    "ruleEnabled",
    "requiresTeacherConfirmation",
    "approvalId",
    "targetRuleDraftId",
    "profilePath",
    "profileName",
    "memoryId",
    "approvedMemoryCount",
    "relationshipCount",
    "correctionCount",
    "generationPlanStatus",
    "input",
    "outcome",
    "actionTaken",
    "selectedMemoryId",
    "matchedCueCount",
    "conflictMemoryIds",
    "conflictMatchedCueCount",
    "stopped",
    "correctedResult",
    "nextTeacherPrompt",
    "locks",
    "counts"
  ];
  return Object.fromEntries(Object.entries(value).filter(([key]) => keep.includes(key)));
}

function addAction(actions, step, script, args) {
  const result = runScript(script, args);
  actions.push({ step, script, result: compact(result) });
  return result;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "screen-event-demonstration";
}

function parseJsonOrTextEvent(value, index) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed ? parsed : { type: "action", text: String(parsed), order: index + 1 };
  } catch {
    return { type: "action", text: value, order: index + 1 };
  }
}

function normalizeScreenEventPayload(rawPayload, rawEvents) {
  if (rawPayload) {
    const parsed = JSON.parse(rawPayload);
    if (Array.isArray(parsed)) return { events: parsed };
    if (parsed && typeof parsed === "object") return parsed;
    throw new Error("--screen-events must be a JSON array or object.");
  }
  if (rawEvents.length > 0) {
    return { events: rawEvents.map((event, index) => parseJsonOrTextEvent(event, index)) };
  }
  return null;
}

function screenEventList(payload) {
  const rawEvents = payload?.events ?? payload?.userEvents ?? payload?.steps ?? payload?.actions ?? [];
  return Array.isArray(rawEvents) ? rawEvents : [];
}

function createPastedScreenEventArtifact({ goal, tool, teacherAction, taughtBehavior, futureInput, payload }) {
  const events = screenEventList(payload);
  if (events.length === 0) {
    throw new Error("Screen event teaching needs at least one event in events, userEvents, steps, or actions.");
  }

  const artifactId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
  const artifactDir = join(process.cwd(), ".transparent-apprentice", "screen-events");
  const artifactPath = join(artifactDir, `${artifactId}.json`);
  mkdirSync(artifactDir, { recursive: true });

  const artifact = {
    format: "transparent_ai_screen_event_log_v1",
    artifactId,
    goal,
    sourceTool: payload.sourceTool ?? payload.tool ?? tool,
    recordingUrl: payload.recordingUrl ?? payload.url ?? "",
    teacherAction,
    taughtBehavior,
    futureInput,
    events,
    locks: {
      ruleEnabled: false,
      accepted: false,
      requiresTeacherConfirmation: true,
      packagingGated: true
    }
  };
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return {
    ok: true,
    format: "transparent_ai_pasted_screen_event_artifact_result_v1",
    artifactPath,
    artifactId,
    eventCount: events.length,
    sourceTool: artifact.sourceTool,
    locks: artifact.locks
  };
}

function classifyTeacherResponse(response = "") {
  const text = response.toLowerCase().trim();
  const correctionPatterns = [
    /\u4e0d\u5bf9/,
    /\u4e0d\u662f/,
    /\u9519/,
    /\u4e0d\u80fd/,
    /\u4e0d\u8981/,
    /\u522b/,
    /\u53ea\u6709/,
    /\u9664\u975e/,
    /\u4f46\u662f/,
    /\u5e94\u8be5/,
    /\u6539\u6210/,
    /\u592a\u5bbd/,
    /\u592a\u7a84/,
    /\bwrong\b/,
    /\bincorrect\b/,
    /\bnot\b/,
    /\bdo not\b/,
    /\bdon't\b/,
    /\bonly\b/,
    /\bunless\b/,
    /\bexcept\b/,
    /\bshould\b/,
    /\btoo broad\b/,
    /\btoo narrow\b/
  ];
  if (correctionPatterns.some((pattern) => pattern.test(text))) return "correction";

  const approvalPatterns = [
    /\u6279\u51c6/,
    /\u540c\u610f/,
    /\u53ef\u4ee5/,
    /\u5bf9/,
    /\u662f\u7684/,
    /\u5c31\u8fd9\u6837/,
    /\u6ca1\u95ee\u9898/,
    /\byes\b/,
    /\bok\b/,
    /\bokay\b/,
    /\bapprove\b/,
    /\bapproved\b/,
    /\bcorrect\b/,
    /\bright\b/,
    /\blooks good\b/,
    /\bgood\b/
  ];
  if (approvalPatterns.some((pattern) => pattern.test(text))) return "approval";
  return "clarify";
}

function wantsProfileSave(value = "") {
  const text = value.toLowerCase();
  return [
    "\u8bb0\u4f4f",
    "\u4fdd\u5b58",
    "\u957f\u671f",
    "\u4ee5\u540e\u4e5f\u7528",
    "\u4e0b\u6b21\u4e5f\u7528",
    "\u52a9\u624b\u6863\u6848",
    "\u5b58\u5230",
    "remember",
    "save",
    "persist",
    "profile",
    "use next time",
    "keep this"
  ].some((marker) => text.includes(marker));
}

function wantsParametricDrawingLogicLearning(value = "") {
  const text = String(value || "").toLowerCase();
  const artifactOrOutputMarkers = [
    "cad",
    "cam",
    "cae",
    "solidworks",
    "drawing",
    "diagram",
    "model",
    "sketch",
    "dxf",
    "svg",
    "blueprint",
    "engineering",
    "output artifact",
    "\u56fe\u7eb8",
    "\u6a21\u578b",
    "\u8349\u56fe",
    "\u5de5\u7a0b\u56fe",
    "\u5de5\u7a0b\u8f6f\u4ef6",
    "\u8f93\u51fa\u7ed3\u679c",
    "\u4ea7\u7269"
  ];
  const logicMarkers = [
    "parametric",
    "feature-data",
    "data logic",
    "formula",
    "constraint",
    "logicized",
    "not just look",
    "not just looks",
    "looks similar",
    "surface similarity",
    "new data",
    "generate similar",
    "rigorous",
    "detail logic",
    "\u53c2\u6570\u5316",
    "\u6570\u636e\u903b\u8f91",
    "\u903b\u8f91\u5316",
    "\u516c\u5f0f",
    "\u7ea6\u675f",
    "\u7ec6\u8282\u4e25\u8c28",
    "\u4e0d\u662f\u53ea\u50cf",
    "\u770b\u8d77\u6765\u50cf",
    "\u65b0\u6570\u636e",
    "\u7c7b\u4f3c\u7684",
    "\u751f\u6210\u7c7b\u4f3c",
    "\u89d2\u5ea6",
    "\u7ebf\u6761",
    "\u5c3a\u5bf8",
    "\u534a\u5f84",
    "\u95f4\u8ddd",
    "\u516c\u5dee",
    "\u6750\u6599",
    "\u5de5\u827a"
  ];
  return artifactOrOutputMarkers.some((marker) => text.includes(marker)) && logicMarkers.some((marker) => text.includes(marker));
}

const goal = argValue("--goal", argValue("--task", "Teach the apprentice with the simplest available evidence."));
const name = argValue("--name", "guided-apprentice");
const sessionArg = argValue("--session");
const artifactArg = argValue("--artifact");
const files = argValues("--file");
const beforeValues = argValues("--before");
const afterValues = argValues("--after");
const stepValues = argValues("--step");
const recordingUrl = argValue("--recording-url", argValue("--url", argValue("--demonstration-url")));
const observation = argValue("--observation", argValue("--note"));
const validation = argValue("--validation");
const screenEventPayload = normalizeScreenEventPayload(
  argValue("--screen-events", argValue("--events-json")),
  [...argValues("--screen-event"), ...argValues("--event")]
);
const tool = argValue("--tool", "existing-tool");
const teacherMessage = argValue("--teacher-message");
const teacherResponse = argValue("--teacher-response", argValue("--teacher-reply"));
const apprenticeAttempt = argValue("--apprentice-attempt");
const rawTeacherCorrection = argValue("--teacher-correction");
const relationshipValues = argValues("--relationship");
const teacherCorrectionValues = argValues("--teacher-correction");
const parametricFlagRequested =
  process.argv.includes("--parametric-drawing-logic") ||
  process.argv.includes("--universal-detail-logic") ||
  process.argv.includes("--feature-data-logic") ||
  relationshipValues.length > 0 ||
  process.argv.includes("--source-data") ||
  process.argv.includes("--new-data") ||
  process.argv.includes("--target-data");
const correction = argValue("--correction", parametricFlagRequested ? "" : rawTeacherCorrection);
const teacherApproval = argValue("--teacher-approval");
const profileName = argValue("--profile-name", argValue("--apprentice-name", "teachable-apprentice"));
const profilePath = argValue("--profile");
const saveToProfile = process.argv.includes("--save-to-profile") || process.argv.includes("--remember");
const teacherAction = argValue("--teacher-action", "Teacher demonstrated the intended behavior.");
const taughtBehavior = argValue("--taught-behavior", "Apply the teacher-confirmed behavior after review.");
const futureInput = argValue("--future-input");
const preferredTone = argValue("--preferred-tone");
const teacherName = argValue("--teacher-name");
const locale = argValue("--locale", "zh-CN");
const voiceMode = argValue("--voice-mode", "browser-web-speech");
const software = argValue("--software", argValue("--domain-software", tool));
const questionMode = argValue("--question-mode", argValue("--preferred-question-mode", "both"));
const logPaths = [...argValues("--log-path"), ...argValues("--log")];
const screenEvidencePaths = [...argValues("--screen-evidence"), ...argValues("--screenshot"), ...argValues("--screen-path")];
const eventLogPaths = [...argValues("--event-log"), ...argValues("--trace-path")];
const sourceDrawingPath = argValue("--source-drawing", argValue("--drawing", argValue("--cad", artifactArg || files[0] || "")));
const sourceData = argValue("--source-data", argValue("--data"));
const newData = argValue("--new-data", argValue("--target-data"));
const learnedInput = argValue("--learned-input", argValue("--input", futureInput || teacherMessage || goal));
const stopRequested = process.argv.includes("--stop-here") || process.argv.includes("--stop") || process.argv.includes("--pause-work");
const learnedWorkRequested =
  !stopRequested &&
  !screenEventPayload &&
  !recordingUrl &&
  !artifactArg &&
  files.length === 0 &&
  beforeValues.length === 0 &&
  afterValues.length === 0 &&
  stepValues.length === 0 &&
  !teacherResponse &&
  !correction &&
  !teacherApproval &&
  (process.argv.includes("--run-learned") || process.argv.includes("--use-learned-memory"));
const parametricDrawingLogicIntentText = `${goal} ${tool} ${software} ${teacherMessage} ${teacherAction} ${taughtBehavior}`.toLowerCase();
const parametricDrawingLogicRequested =
  !learnedWorkRequested &&
  !screenEventPayload &&
  !recordingUrl &&
  beforeValues.length === 0 &&
  afterValues.length === 0 &&
  stepValues.length === 0 &&
  !teacherResponse &&
  !correction &&
  !teacherApproval &&
  Boolean(
    parametricFlagRequested ||
    process.argv.includes("--parametric-drawing-logic") ||
      process.argv.includes("--universal-detail-logic") ||
      process.argv.includes("--feature-data-logic") ||
      sourceData ||
      newData ||
      wantsParametricDrawingLogicLearning(parametricDrawingLogicIntentText)
  );
const workalongIntentText = `${goal} ${tool} ${software} ${teacherMessage}`.toLowerCase();
const workalongRequested =
  !learnedWorkRequested &&
  !parametricDrawingLogicRequested &&
  !screenEventPayload &&
  !recordingUrl &&
  !artifactArg &&
  files.length === 0 &&
  beforeValues.length === 0 &&
  afterValues.length === 0 &&
  stepValues.length === 0 &&
  !teacherResponse &&
  !correction &&
  !teacherApproval &&
  Boolean(
    process.argv.includes("--workalong") ||
      process.argv.includes("--work-along") ||
      process.argv.includes("--observe-while-working") ||
      [
        "workalong",
        "work-along",
        "observe while",
        "watch while",
        "side by side",
        "low-token",
        "low token",
        "log delta",
        "triggered screenshot",
        "solidworks",
        "solidwork",
        "cad",
        "cam",
        "cae",
        "\u65c1\u8fb9\u5b66",
        "\u8fb9\u5de5\u4f5c\u8fb9\u5b66",
        "\u65e5\u5fd7",
        "\u5c4f\u5e55\u6570\u636e",
        "\u622a\u5c4f",
        "\u6d6e\u7a97",
        "\u60ac\u6d6e",
        "\u7535\u8111\u4e0a\u80fd\u5b8c\u6210"
      ].some((marker) => workalongIntentText.includes(marker))
  );
const voiceIntentText = `${goal} ${tool} ${teacherMessage}`.toLowerCase();
const voiceRequested =
  !learnedWorkRequested &&
  !parametricDrawingLogicRequested &&
  !workalongRequested &&
  !screenEventPayload &&
  !recordingUrl &&
  !artifactArg &&
  files.length === 0 &&
  beforeValues.length === 0 &&
  afterValues.length === 0 &&
  stepValues.length === 0 &&
  !teacherResponse &&
  !correction &&
  !teacherApproval &&
  Boolean(
    process.argv.includes("--voice") ||
      process.argv.includes("--voice-kit") ||
      [
        "voice",
        "speech",
        "dictation",
        "microphone",
        "mic",
        "talk",
        "speak",
        "spoken",
        "tts",
        "stt",
        "\u8bed\u97f3",
        "\u542c\u5199",
        "\u6717\u8bfb",
        "\u9ea6\u514b\u98ce",
        "\u8bf4\u8bdd",
        "\u53e3\u8ff0",
        "\u53ca\u65f6\u6c9f\u901a"
      ].some((marker) => voiceIntentText.includes(marker))
  );

const actions = [];
const sessionPath = sessionArg ? resolve(sessionArg) : "";
if (sessionPath && !existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

let route = "";
let primaryResult;
let reviewResult = null;

if (stopRequested) {
  route = "teacher_stopped_work_session";
  primaryResult = {
    ok: true,
    format: "transparent_ai_teacher_stop_result_v1",
    stopped: true,
    actionTaken: "Stopped because the teacher said this is enough for now. No further generation, teaching, approval, or memory write was performed.",
    locks: {
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      technologyAccepted: false,
      stoppedByTeacher: true
    }
  };
  actions.push({ step: "stop on teacher command", script: "continue-teaching.mjs", result: compact(primaryResult) });
} else if (learnedWorkRequested) {
  const resolvedProfilePath = profilePath
    ? resolve(profilePath)
    : join(process.cwd(), ".transparent-apprentice", "apprentices", `${slugify(profileName)}.json`);
  if (!existsSync(resolvedProfilePath)) {
    route = "learned_work_needs_profile_memory";
    primaryResult = {
      ok: true,
      format: "transparent_ai_learned_work_needs_profile_v1",
      profilePath: resolvedProfilePath,
      profileName,
      input: learnedInput,
      outcome: "no_profile_memory_available",
      actionTaken:
        "No approved apprentice profile memory exists yet. Teach one case, approve the replay, and say approve and remember before asking me to continue from learned knowledge.",
      locks: {
        ruleEnabled: false,
        accepted: false,
        packagingGated: true,
        technologyAccepted: false
      }
    };
    actions.push({ step: "learned work needs approved profile memory", script: "continue-teaching.mjs", result: compact(primaryResult) });
  } else {
    route = "run_profile_memory_for_learned_work";
    const profileArgs = ["--input", learnedInput, "--profile-name", profileName];
    if (profilePath) profileArgs.push("--profile", profilePath);
    primaryResult = addAction(actions, "run approved profile memory for learned work", "run-apprentice-profile.mjs", profileArgs);
  }
} else if (teacherApproval) {
  const shouldSaveProfile = saveToProfile || wantsProfileSave(teacherApproval) || Boolean(profilePath);
  route = shouldSaveProfile ? "approve_and_save_replayed_session_memory" : "approve_latest_replayed_session_memory";
  const approvalArgs = ["--teacher-approval", teacherApproval];
  if (sessionPath) approvalArgs.unshift("--session", sessionPath);
  primaryResult = addAction(actions, "approve latest replayed rule", "approve-teaching-memory.mjs", approvalArgs);
  if (shouldSaveProfile) {
    const saveArgs = ["--session", primaryResult.sessionPath, "--profile-name", profileName];
    if (profilePath) saveArgs.push("--profile", profilePath);
    primaryResult.profileSaveResult = addAction(actions, "save approved memory to apprentice profile", "save-apprentice-memory.mjs", saveArgs);
  }
  reviewResult = addAction(actions, "review teaching session", "review-teaching-session.mjs", ["--session", primaryResult.sessionPath]);
} else if (correction) {
  route = "correct_latest_session_result";
  const correctionArgs = ["--correction", correction];
  if (sessionPath) correctionArgs.unshift("--session", sessionPath);
  primaryResult = addAction(actions, "record teacher correction", "correct-last-result.mjs", correctionArgs);
  const correctedSessionPath = primaryResult.sessionPath || sessionPath;
  if (futureInput) {
    addAction(actions, "replay corrected draft", "replay-teaching-session.mjs", ["--session", correctedSessionPath, "--input", futureInput]);
  }
  reviewResult = addAction(actions, "review teaching session", "review-teaching-session.mjs", ["--session", correctedSessionPath]);
} else if (teacherResponse) {
  const responseDecision = classifyTeacherResponse(teacherResponse);
  if (responseDecision === "approval") {
    const shouldSaveProfile = saveToProfile || wantsProfileSave(teacherResponse) || Boolean(profilePath);
    route = shouldSaveProfile ? "teacher_response_approves_and_saves_profile_memory" : "teacher_response_approves_session_memory";
    const approvalArgs = ["--teacher-approval", teacherResponse];
    if (sessionPath) approvalArgs.unshift("--session", sessionPath);
    primaryResult = addAction(actions, "approve from teacher response", "approve-teaching-memory.mjs", approvalArgs);
    if (shouldSaveProfile) {
      const saveArgs = ["--session", primaryResult.sessionPath, "--profile-name", profileName];
      if (profilePath) saveArgs.push("--profile", profilePath);
      primaryResult.profileSaveResult = addAction(actions, "save approved memory to apprentice profile", "save-apprentice-memory.mjs", saveArgs);
    }
    reviewResult = addAction(actions, "review teaching session", "review-teaching-session.mjs", ["--session", primaryResult.sessionPath]);
  } else if (responseDecision === "correction") {
    route = "teacher_response_corrects_latest_result";
    const correctionArgs = ["--correction", teacherResponse];
    if (sessionPath) correctionArgs.unshift("--session", sessionPath);
    primaryResult = addAction(actions, "correct from teacher response", "correct-last-result.mjs", correctionArgs);
    const correctedSessionPath = primaryResult.sessionPath || sessionPath;
    if (futureInput) {
      addAction(actions, "replay corrected draft", "replay-teaching-session.mjs", ["--session", correctedSessionPath, "--input", futureInput]);
    }
    reviewResult = addAction(actions, "review teaching session", "review-teaching-session.mjs", ["--session", correctedSessionPath]);
  } else {
    route = "clarify_teacher_response";
    primaryResult = {
      ok: true,
      format: "transparent_ai_teacher_response_clarification_v1",
      teacherResponse,
      responseDecision,
      needsClarification: true,
      nextTeacherPrompt: "Please say whether this is approval or correction. Example: 'approve this replay' or 'wrong because only refund tickets should use this'.",
      locks: {
        ruleEnabled: false,
        accepted: false,
        packagingGated: true,
        technologyAccepted: false
      }
    };
    actions.push({ step: "ask teacher to clarify response", script: "continue-teaching.mjs", result: compact(primaryResult) });
  }
} else if (parametricDrawingLogicRequested) {
  route = "create_parametric_drawing_logic_learning_kit";
  const parametricArgs = [
    "--goal",
    goal,
    "--software",
    software || tool || "CAD, engineering, drawing, modeling, or output software"
  ];
  if (sourceDrawingPath) parametricArgs.push("--source-drawing", sourceDrawingPath);
  if (sourceData) parametricArgs.push("--source-data", sourceData);
  if (newData) parametricArgs.push("--new-data", newData);
  for (const relationship of relationshipValues) parametricArgs.push("--relationship", relationship);
  for (const correctionValue of teacherCorrectionValues) parametricArgs.push("--teacher-correction", correctionValue);
  primaryResult = addAction(
    actions,
    "create parametric universal-detail logic learning kit",
    "create-parametric-drawing-logic-learning-kit.mjs",
    parametricArgs
  );
} else if (voiceRequested) {
  route = "create_existing_tool_voice_kit";
  const voiceArgs = [
    "--goal",
    goal,
    "--voice-mode",
    voiceMode,
    "--locale",
    locale,
    ...(preferredTone ? ["--preferred-tone", preferredTone] : []),
    ...(teacherName ? ["--teacher-name", teacherName] : []),
    ...(futureInput ? ["--future-input", futureInput] : [])
  ];
  primaryResult = addAction(actions, "create voice teaching kit", "create-voice-teaching-kit.mjs", voiceArgs);
} else if (workalongRequested) {
  route = "create_existing_tool_workalong_kit";
  const workalongArgs = [
    "--goal",
    goal,
    "--software",
    software || tool || "desktop software",
    "--question-mode",
    questionMode,
    "--locale",
    locale,
    ...(preferredTone ? ["--preferred-tone", preferredTone] : []),
    ...(teacherName ? ["--teacher-name", teacherName] : []),
    ...(futureInput ? ["--future-input", futureInput] : [])
  ];
  for (const path of logPaths) workalongArgs.push("--log-path", path);
  for (const path of screenEvidencePaths) workalongArgs.push("--screen-evidence", path);
  for (const path of eventLogPaths) workalongArgs.push("--event-log", path);
  primaryResult = addAction(actions, "create low-token work-along teaching kit", "create-workalong-teaching-kit.mjs", workalongArgs);
} else if (beforeValues.length > 0 || afterValues.length > 0) {
  route = "teach_from_before_after_examples";
  const exampleArgs = ["--goal", goal, "--tool", tool, "--teacher-action", teacherAction, "--taught-behavior", taughtBehavior];
  if (futureInput) exampleArgs.push("--future-input", futureInput);
  for (const before of beforeValues) exampleArgs.push("--before", before);
  for (const after of afterValues) exampleArgs.push("--after", after);
  const exampleArtifact = addAction(actions, "create before/after teaching artifact", "create-example-teaching-artifact.mjs", exampleArgs);
  primaryResult = addAction(actions, "teach from before/after examples", "teach-by-demonstration.mjs", [
    ...(sessionPath ? ["--session", sessionPath] : ["--name", name]),
    "--task",
    goal,
    "--artifact",
    exampleArtifact.artifactPath,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
} else if (screenEventPayload) {
  route = "teach_from_pasted_screen_events";
  const screenEventArtifact = createPastedScreenEventArtifact({
    goal,
    tool,
    teacherAction,
    taughtBehavior,
    futureInput,
    payload: screenEventPayload
  });
  actions.push({ step: "create pasted screen-event artifact", script: "continue-teaching.mjs", result: compact(screenEventArtifact) });
  primaryResult = addAction(actions, "teach from pasted screen events", "teach-by-demonstration.mjs", [
    ...(sessionPath ? ["--session", sessionPath] : ["--name", name]),
    "--task",
    goal,
    "--artifact",
    screenEventArtifact.artifactPath,
    "--tool",
    screenEventArtifact.sourceTool || tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
} else if (recordingUrl) {
  route = "teach_from_recording_link";
  const recordingArgs = [
    "--goal",
    goal,
    "--recording-url",
    recordingUrl,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior
  ];
  if (observation) recordingArgs.push("--observation", observation);
  if (validation) recordingArgs.push("--validation", validation);
  if (futureInput) recordingArgs.push("--future-input", futureInput);
  for (const step of stepValues) recordingArgs.push("--step", step);
  const recordingArtifact = addAction(
    actions,
    "create recording demonstration artifact",
    "create-recording-demonstration-artifact.mjs",
    recordingArgs
  );
  primaryResult = addAction(actions, "teach from recording link", "teach-by-demonstration.mjs", [
    ...(sessionPath ? ["--session", sessionPath] : ["--name", name]),
    "--task",
    goal,
    "--artifact",
    recordingArtifact.artifactPath,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
} else if (stepValues.length > 0) {
  route = "teach_from_action_sequence";
  const sequenceArgs = ["--goal", goal, "--tool", tool, "--teacher-action", teacherAction, "--taught-behavior", taughtBehavior];
  if (futureInput) sequenceArgs.push("--future-input", futureInput);
  for (const step of stepValues) sequenceArgs.push("--step", step);
  const sequenceArtifact = addAction(actions, "create action sequence teaching artifact", "create-action-sequence-artifact.mjs", sequenceArgs);
  primaryResult = addAction(actions, "teach from action sequence", "teach-by-demonstration.mjs", [
    ...(sessionPath ? ["--session", sessionPath] : ["--name", name]),
    "--task",
    goal,
    "--artifact",
    sequenceArtifact.artifactPath,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
} else if (files.length > 1) {
  route = "package_multi_file_demonstration_then_teach";
  const captureArgs = ["--goal", goal, "--tool", tool, "--teacher-action", teacherAction, "--taught-behavior", taughtBehavior];
  if (futureInput) captureArgs.push("--future-input", futureInput);
  for (const file of files) captureArgs.push("--file", file);
  const capture = addAction(actions, "package demonstration capture", "create-demonstration-capture.mjs", captureArgs);
  primaryResult = addAction(actions, "teach from packaged capture", "teach-by-demonstration.mjs", [
    ...(sessionPath ? ["--session", sessionPath] : ["--name", name]),
    "--task",
    goal,
    "--artifact",
    capture.capturePath,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
} else if (artifactArg || files.length === 1 || teacherMessage) {
  route = artifactArg || files.length === 1 ? "teach_from_existing_artifact" : "teach_from_teacher_message";
  const artifactPath = artifactArg || files[0] || "";
  primaryResult = addAction(actions, "teach by demonstration", "teach-by-demonstration.mjs", [
    ...(sessionPath ? ["--session", sessionPath] : ["--name", name]),
    "--task",
    goal,
    ...(artifactPath ? ["--artifact", artifactPath, "--tool", tool, "--teacher-action", teacherAction] : []),
    ...(teacherMessage ? ["--teacher-message", teacherMessage] : []),
    ...(apprenticeAttempt ? ["--apprentice-attempt", apprenticeAttempt] : []),
    ...(correction ? ["--teacher-correction", correction] : []),
    "--taught-behavior",
    taughtBehavior,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
} else {
  route = "create_existing_tool_visual_kit";
  const guided = addAction(actions, "choose existing-tool route", "start-guided-teaching.mjs", [
    "--goal",
    goal,
    "--tool",
    tool,
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
  primaryResult = addAction(actions, "create visual teaching kit", "create-visual-teaching-kit.mjs", [
    "--goal",
    goal,
    "--tool",
    tool || "draw.io or Excalidraw",
    ...(futureInput ? ["--future-input", futureInput] : [])
  ]);
  primaryResult.guidedRoute = compact(guided);
}

const resultSessionPath = primaryResult?.sessionPath || reviewResult?.sessionPath || sessionPath || "";
const nextTeacherAction =
  route === "teacher_stopped_work_session"
    ? "Stop here. Wait for the teacher to explicitly ask for another lesson, correction, or learned-work run."
    : route === "run_profile_memory_for_learned_work"
      ? "Review the generated action from approved profile memory. Correct it if it is stale or too broad, or say stop when enough has been generated."
      : route === "learned_work_needs_profile_memory"
        ? "Teach and approve one reusable memory first, then say the next task is something the apprentice has learned before."
        : route === "create_parametric_drawing_logic_learning_kit"
          ? "Review the generated universal detail logic kit, name every consequential output feature, bind each one to data/formulas/constraints or mark it decorative/non-parametric, then review the dry-run generation plan before any target-software action."
        : route === "create_existing_tool_visual_kit"
    ? "Open the teacher-start-here kit, edit one generated template in an existing tool, then pass the edited file or pasted events back to continue_teaching."
    : route === "create_existing_tool_workalong_kit"
      ? "Run the low-token collector or use the overlay while working, then paste the generated transparent_ai_workalong_observation_v1 JSON back to teach_apprentice."
    : route === "create_existing_tool_voice_kit"
      ? "Open the voice teaching kit, choose the first-use tone preference, record or type the transcript, then paste the generated JSON back to teach_apprentice."
    : route === "approve_and_save_replayed_session_memory" || route === "teacher_response_approves_and_saves_profile_memory"
      ? "Run the apprentice profile on a future task, or review the saved profile memory if the teacher wants to narrow it."
    : route === "approve_latest_replayed_session_memory" || route === "teacher_response_approves_session_memory"
      ? "Run a learned task or save the approved session memory into an apprentice profile if this behavior should persist."
      : route === "teacher_response_corrects_latest_result"
        ? "Review the corrected public trace, then replay or approve the session rule."
      : route === "clarify_teacher_response"
        ? "Reply with a clear approval or correction so the plugin can safely continue."
      : route === "teach_from_before_after_examples"
        ? "Review the replay against the examples, then correct overgeneralization or approve the session rule."
        : route === "teach_from_pasted_screen_events"
        ? "Review the inferred event order from the pasted demonstration, then correct accidental events or approve the session rule."
        : route === "teach_from_recording_link"
          ? "Review the inferred steps from the recording link, mark accidental actions, then replay or approve the session rule."
        : route === "teach_from_action_sequence"
          ? "Review the inferred action order, correct any step that should not generalize, then replay or approve the session rule."
      : "Review the public trace and replay result, then correct, approve, or provide another example.";

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_continue_teaching_result_v1",
      route,
      goal,
      sessionPath: resultSessionPath,
      primaryResult: compact(primaryResult),
      review: compact(reviewResult),
      actions,
      teacherFacingSummary: `I chose route '${route}' from the evidence you provided and kept the learning loop reviewable.`,
      nextTeacherAction,
      locks: {
        accepted: false,
        packagingGated: true,
        technologyAccepted: false,
        requiresTeacherConfirmation:
          route !== "teacher_stopped_work_session" &&
          route !== "approve_latest_replayed_session_memory" &&
          route !== "teacher_response_approves_session_memory" &&
          route !== "approve_and_save_replayed_session_memory" &&
          route !== "teacher_response_approves_and_saves_profile_memory"
      }
    },
    null,
    2
  )
);
