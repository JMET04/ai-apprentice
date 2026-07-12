#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "visual-engineering-target-confirmation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "visual-engineering-target-confirmation";
}

function clamp01(value, fallback = 0.5) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function readJsonIfPath(value) {
  if (!value) return null;
  const candidate = String(value).trim();
  if (!existsSync(candidate)) return null;
  return JSON.parse(readFileSync(candidate, "utf8").replace(/^\uFEFF/, ""));
}

function fileUri(path) {
  if (!path) return "";
  return `file:///${resolve(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function parseCandidate(raw, index, coordinateSource) {
  const parts = String(raw).split("|").map((part) => part.trim());
  const compact = Number.isFinite(Number(parts[1])) && Number.isFinite(Number(parts[2]));
  const id = compact ? `candidate-${index + 1}-${slugify(parts[0]).slice(0, 32)}` : parts[0] || `candidate-${index + 1}`;
  const label = compact ? parts[0] : parts[1] || parts[0] || `candidate ${index + 1}`;
  const x = compact ? parts[1] : parts[2];
  const y = compact ? parts[2] : parts[3];
  const z = compact ? parts[3] : parts[4];
  const reason = compact ? parts[4] : parts[5];
  return {
    number: index + 1,
    id,
    label,
    normalizedTarget: {
      x: clamp01(x, 0.32 + index * 0.18),
      y: clamp01(y, 0.36 + index * 0.08),
      zHint: Number(z || 0),
      coordinateSource
    },
    reason: reason || "Teacher-provided or generated visual candidate; review against the screenshot before execution.",
    confidence: reason ? "medium" : "low",
    teacherReviewRequired: true
  };
}

function defaultCandidates(command) {
  const text = String(command || "").toLowerCase();
  const left = text.includes("left") || text.includes("zuo") || text.includes("左");
  const right = text.includes("right") || text.includes("you") || text.includes("右");
  const upper = text.includes("upper") || text.includes("top") || text.includes("上");
  const lower = text.includes("lower") || text.includes("bottom") || text.includes("下");
  const x = left ? 0.24 : right ? 0.76 : 0.5;
  const y = upper ? 0.24 : lower ? 0.76 : 0.5;
  return [
    {
      label: "likely visible command target",
      x,
      y,
      zHint: 0,
      reason: "Primary visual guess from the command direction words and the reviewed screenshot."
    },
    {
      label: "nearby tool or property control",
      x: clamp01(x > 0.5 ? x - 0.18 : x + 0.18),
      y: clamp01(y - 0.12),
      zHint: 0,
      reason: "Alternative if the intended operation belongs in a toolbar, feature tree, or property panel."
    },
    {
      label: "canvas or model-view region",
      x: clamp01(x),
      y: clamp01(y + 0.18),
      zHint: 0.25,
      reason: "Alternative if the command refers to geometry or a model-space location."
    }
  ].map((candidate, index) => ({
    number: index + 1,
    id: `visual-candidate-${index + 1}`,
    label: candidate.label,
    normalizedTarget: {
      x: candidate.x,
      y: candidate.y,
      zHint: candidate.zHint,
      coordinateSource: "reviewed_screenshot_plus_command_heuristic"
    },
    reason: candidate.reason,
    confidence: "low",
    teacherReviewRequired: true
  }));
}

function inferOperation(command, voiceTranscript) {
  const text = `${command || ""} ${voiceTranscript || ""}`.toLowerCase();
  if (/measure|dimension|distance|尺寸|测量|距离/.test(text)) return "measure_or_dimension";
  if (/draw|create|add|sketch|生成|添加|绘制|新建/.test(text)) return "create_or_add";
  if (/edit|change|modify|move|调整|修改|移动/.test(text)) return "edit_or_modify";
  if (/select|click|choose|选择|点击/.test(text)) return "select_or_click";
  if (/export|save|导出|保存/.test(text)) return "export_or_save";
  return "ambiguous_engineering_command";
}

const captureReceiptPath = argValue("--capture-receipt", argValue("--visual-capture-receipt", ""));
const captureReceipt = readJsonIfPath(captureReceiptPath);
const directVisual = argValue("--visual-evidence", argValue("--image", argValue("--screenshot", "")));
const rawVisualEvidence =
  directVisual ||
    captureReceipt?.screenshotPath ||
    captureReceipt?.visualEvidencePath ||
    captureReceipt?.imagePath ||
    "";
const screenshotPath = rawVisualEvidence ? resolve(rawVisualEvidence) : "";
if (!rawVisualEvidence || !existsSync(screenshotPath)) {
  throw new Error("--visual-evidence, --image, --screenshot, or --capture-receipt with screenshotPath is required");
}

const goal = argValue("--goal", argValue("--task", "Mark likely engineering-software targets from one reviewed visual evidence file."));
const software = argValue("--software", argValue("--app", captureReceipt?.software || "target engineering software"));
const command = argValue("--command", argValue("--text-command", ""));
const voiceTranscript = argValue("--voice-transcript", "");
const processName = argValue("--process-name", captureReceipt?.processName || "");
const windowTitle = argValue("--window-title", captureReceipt?.observedWindowTitle || captureReceipt?.requestedWindowTitle || "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "visual-engineering-target-confirmations")));
const candidateInputs = multiArg("--candidate");

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const commandText = command || voiceTranscript;
const operation = inferOperation(command, voiceTranscript);
const candidates = candidateInputs.length
  ? candidateInputs.map((candidate, index) => parseCandidate(candidate, index, "teacher_reviewed_visual_candidate"))
  : defaultCandidates(commandText);

const commandIntentPath = join(kitDir, "visual-engineering-command-intent.json");
const targetConfirmationPath = join(kitDir, "visual-numbered-target-confirmation.json");
const overlayPacketPath = join(kitDir, "visual-numbered-target-overlay-packet.json");
const visualPacketPath = join(kitDir, "visual-engineering-target-confirmation.json");
const htmlPath = join(kitDir, "visual-engineering-target-confirmation.html");
const readmePath = join(kitDir, "VISUAL_ENGINEERING_TARGET_CONFIRMATION_START_HERE.md");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherConfirmationRequired: true,
  visualEvidenceAlreadyReviewed: true,
  screenshotsCapturedByThisTool: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  dryRunFirst: true
};

const commandIntent = {
  format: "transparent_ai_visual_engineering_command_intent_v1",
  goal,
  software,
  commandText,
  voiceTranscript,
  interpretedOperation: operation,
  targetUnderstandingStatus: "visual_candidates_need_teacher_number_confirmation",
  visualEvidencePath: screenshotPath,
  visualEvidenceSource: captureReceiptPath ? "triggered_visual_capture_receipt" : "reviewed_visual_evidence_file",
  publicReasoningTrace: [
    "Use one reviewed screenshot or visual evidence file as the coordinate backdrop.",
    "Use the voice/text command only to propose possible target regions.",
    "Wait for the teacher to confirm one visible number or correct the candidates.",
    "Route only the selected target into dry-run-first execution planning."
  ],
  confidence: operation === "ambiguous_engineering_command" ? "low" : "medium"
};

const targetConfirmation = {
  format: "transparent_ai_numbered_target_confirmation_v1",
  kitId,
  goal,
  software,
  commandIntent: commandIntentPath,
  visualEvidencePath: screenshotPath,
  status: "waiting_for_teacher_target_number",
  instructionToTeacher: "Review the numbered markers over the screenshot, then confirm exactly one number or correct the candidate list.",
  selectedCandidate: null,
  candidates,
  confirmationRequiredBefore: [
    "confirm_engineering_command_target",
    "create_supervised_software_action_kit",
    "create_existing_software_execution_adapter",
    "any mouse or keyboard event"
  ],
  executionAfterConfirmationPolicy: {
    nextTool: "confirm_engineering_command_target",
    selectedTargetOnly: true,
    dryRunFirst: true,
    requiresRollbackPoint: true,
    requiresTargetWindowOrRoutePreflight: true,
    requiresOutcomeVerification: true
  },
  locks
};

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  goal,
  software,
  overlayMode: "reviewed_visual_evidence_numbered_target_confirmation",
  backdrop: {
    type: "reviewed_screenshot_or_visual_evidence",
    path: screenshotPath,
    uri: fileUri(screenshotPath),
    captureReceipt: captureReceiptPath ? resolve(captureReceiptPath) : ""
  },
  coordinateSpace: {
    origin: "top_left_visual_evidence",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true,
    targetNumbersRequireTeacherConfirmation: true
  },
  anchors: candidates.map((candidate) => {
    const x = candidate.normalizedTarget.x;
    const y = candidate.normalizedTarget.y;
    return {
      id: candidate.id,
      type: "numbered_visual_target_candidate",
      number: candidate.number,
      label: `${candidate.number}. ${candidate.label}`,
      box: [clamp01(x - 0.035), clamp01(y - 0.035), clamp01(x + 0.035), clamp01(y + 0.035)],
      reason: candidate.reason
    };
  }),
  strokes: candidates.map((candidate) => ({
    id: `visual-number-${candidate.number}-target-mark`,
    mode: "screen_2d",
    semanticLabel: `candidate ${candidate.number}: ${candidate.label}`,
    targetAnchorId: candidate.id,
    points: [
      {
        x: candidate.normalizedTarget.x,
        y: candidate.normalizedTarget.y,
        zHint: candidate.normalizedTarget.zHint || 0,
        t: 0,
        planeId: "reviewed_visual_evidence"
      }
    ]
  })),
  spatialIntent: {
    inferredTeacherIntent: "review_only: visual evidence and voice/text command become numbered target candidates before supervised action planning",
    relationships: candidates.map((candidate) => ({
      subject: `visual-number-${candidate.number}-target-mark`,
      relation: "candidate_target_for",
      object: operation,
      teacherMustConfirmNumber: candidate.number
    }))
  },
  commandIntent: commandIntentPath,
  targetConfirmation: targetConfirmationPath,
  locks
};

const visualPacket = {
  ok: true,
  format: "transparent_ai_visual_engineering_target_confirmation_v1",
  kitId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  processName,
  windowTitle,
  visualEvidencePath: screenshotPath,
  captureReceiptPath: captureReceiptPath ? resolve(captureReceiptPath) : "",
  commandText,
  interpretedOperation: operation,
  candidateCount: candidates.length,
  files: {
    teacherReadme: readmePath,
    html: htmlPath,
    commandIntent: commandIntentPath,
    targetConfirmation: targetConfirmationPath,
    overlayPacket: overlayPacketPath,
    packet: visualPacketPath
  },
  nextConfirmationBridge: "confirm_engineering_command_target",
  nextAllowedAction: "Confirm exactly one number, then call confirm_engineering_command_target to create a selected-target dry-run route.",
  blockedActions: [
    "execute_from_visual_guess_without_confirmed_number",
    "capture_more_screenshots_by_default",
    "continuous_recording",
    "write_memory_or_enable_rules_without_teacher_approval",
    "claim_universal_native_execution"
  ],
  locks
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Visual Engineering Target Confirmation</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #18211f; background: #f6f8f4; }
    main { max-width: 1180px; margin: 0 auto; padding: 20px; display: grid; gap: 14px; }
    h1 { font-size: 26px; margin: 0; }
    h2 { font-size: 17px; margin: 0 0 8px; }
    .panel { background: white; border: 1px solid #cbd5cf; border-radius: 6px; padding: 14px; }
    .stage { position: relative; max-height: 72vh; overflow: auto; border: 1px solid #aeb9b3; border-radius: 6px; background: #e9eee9; }
    .stage img { display: block; width: 100%; height: auto; }
    .pin { position: absolute; transform: translate(-50%, -50%); width: 34px; height: 34px; border-radius: 50%; background: #0f766e; color: white; border: 2px solid white; font-weight: 700; box-shadow: 0 3px 12px rgba(0,0,0,.25); cursor: pointer; }
    .pin.selected { background: #8c4f22; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
    .card { border: 1px solid #cbd5cf; border-radius: 6px; padding: 10px; background: #fbfcf9; cursor: pointer; }
    .card.selected { outline: 3px solid rgba(140,79,34,.25); }
    textarea { width: 100%; min-height: 150px; border: 1px solid #cbd5cf; border-radius: 6px; padding: 10px; font: 13px/1.4 Consolas, monospace; box-sizing: border-box; }
    p { color: #506057; line-height: 1.45; }
    code { background: #e8eee9; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
<main>
  <header>
    <h1>Visual Engineering Target Confirmation</h1>
    <p>${htmlEscape(software)} | ${htmlEscape(goal)}</p>
  </header>
  <section class="panel">
    <h2>Reviewed Visual Evidence</h2>
    <p>Operation: <code>${htmlEscape(operation)}</code>. Confirm one number or correct the candidates. This page does not capture screenshots or execute software.</p>
    <div class="stage" id="stage">
      <img src="${htmlEscape(fileUri(screenshotPath))}" alt="Reviewed visual evidence">
    </div>
  </section>
  <section class="panel">
    <h2>Candidate Targets</h2>
    <div class="cards" id="cards"></div>
  </section>
  <section class="panel">
    <h2>Confirm Packet</h2>
    <textarea id="packet" readonly></textarea>
  </section>
</main>
<script>
const packet = ${jsonForScript(visualPacket)};
const targetConfirmation = ${jsonForScript(targetConfirmation)};
let selected = null;
const stage = document.getElementById("stage");
const cards = document.getElementById("cards");
const out = document.getElementById("packet");
function render() {
  for (const old of stage.querySelectorAll(".pin")) old.remove();
  cards.innerHTML = "";
  for (const candidate of targetConfirmation.candidates) {
    const pin = document.createElement("button");
    pin.className = "pin" + (selected === candidate.number ? " selected" : "");
    pin.textContent = candidate.number;
    pin.style.left = (candidate.normalizedTarget.x * 100) + "%";
    pin.style.top = (candidate.normalizedTarget.y * 100) + "%";
    pin.onclick = () => { selected = candidate.number; render(); };
    stage.appendChild(pin);
    const card = document.createElement("div");
    card.className = "card" + (selected === candidate.number ? " selected" : "");
    card.innerHTML = "<strong>" + candidate.number + ". " + candidate.label + "</strong><p>" + candidate.reason + "</p>";
    card.onclick = () => { selected = candidate.number; render(); };
    cards.appendChild(card);
  }
  const confirmCall = {
    tool: "confirm_engineering_command_target",
    arguments: {
      confirmation: packet.files.targetConfirmation,
      selectedCandidateNumber: selected || "<select one number>",
      createActionKit: true,
      createExecutionAdapter: true,
      software: packet.software,
      windowTitle: packet.windowTitle
    },
    locks: packet.locks
  };
  out.value = JSON.stringify(confirmCall, null, 2);
}
render();
</script>
</body>
</html>
`;

writeFileSync(commandIntentPath, `${JSON.stringify(commandIntent, null, 2)}\n`, "utf8");
writeFileSync(targetConfirmationPath, `${JSON.stringify(targetConfirmation, null, 2)}\n`, "utf8");
writeFileSync(overlayPacketPath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");
writeFileSync(visualPacketPath, `${JSON.stringify(visualPacket, null, 2)}\n`, "utf8");
writeFileSync(htmlPath, html, "utf8");
writeFileSync(
  readmePath,
  [
    "# Visual Engineering Target Confirmation",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    `Visual evidence: ${screenshotPath}`,
    "",
    "Use this when a low-token trigger or teacher review produced one screenshot/visual evidence file and the non-expert gave a voice or typed command.",
    "",
    "Flow:",
    `1. Open ${basename(htmlPath)} and review the numbered markers over the visual evidence.`,
    "2. Confirm exactly one number, or correct the candidate list.",
    "3. Run confirm_engineering_command_target with the confirmed number.",
    "4. Review the selected-target dry-run action and existing-adapter route before any execution.",
    "",
    "Locked defaults: screenshotsCapturedByThisTool=false, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, nativeUniversalExecution=false, accepted=false, ruleEnabled=false, packagingGated=true.",
    "",
    `Packet: ${visualPacketPath}`,
    `Target confirmation: ${targetConfirmationPath}`
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_visual_engineering_target_confirmation_result_v1",
  kitId,
  packetPath: visualPacketPath,
  teacherReadme: readmePath,
  htmlPath,
  visualEvidencePath: screenshotPath,
  commandIntent: commandIntentPath,
  targetConfirmation: targetConfirmationPath,
  overlayPacket: overlayPacketPath,
  candidateCount: candidates.length,
  candidateNumbers: candidates.map((candidate) => candidate.number),
  nextConfirmationBridge: "confirm_engineering_command_target",
  screenshotsCapturedByThisTool: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
