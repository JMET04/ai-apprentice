#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function textArg(name, fallback = "") {
  const filePath = argValue(`${name}-file`, "");
  if (filePath) return readFileSync(resolve(filePath), "utf8").replace(/^\uFEFF/, "").trim();
  return argValue(name, fallback);
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "engineering-command-confirmation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "engineering-command-confirmation";
}

function clamp01(value, fallback = 0.5) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function parseCandidate(raw, index) {
  const parts = String(raw).split("|").map((part) => part.trim());
  const compactFormat = Number.isFinite(Number(parts[1])) && Number.isFinite(Number(parts[2]));
  const id = compactFormat ? `candidate-${index + 1}-${slugify(parts[0]).slice(0, 32)}` : parts[0];
  const label = compactFormat ? parts[0] : parts[1] || parts[0];
  const xValue = compactFormat ? parts[1] : parts[2];
  const yValue = compactFormat ? parts[2] : parts[3];
  const zValue = compactFormat ? parts[3] : parts[4];
  const reasonValue = compactFormat ? parts[4] : parts[5];
  return {
    number: index + 1,
    id: id || `candidate-${index + 1}`,
    label: label || `candidate ${index + 1}`,
    normalizedTarget: {
      x: clamp01(xValue, 0.3 + index * 0.2),
      y: clamp01(yValue, 0.36 + index * 0.08),
      zHint: Number(zValue || 0),
      coordinateSource: compactFormat
        ? "teacher_reviewed_compact_candidate"
        : "teacher_reviewed_or_generated_candidate"
    },
    reason: reasonValue || "Candidate target supplied by teacher or generated as a review placeholder.",
    teacherReviewRequired: true,
    confidence: reasonValue ? "medium" : "low"
  };
}

function defaultCandidates(command) {
  const text = String(command || "").toLowerCase();
  const leftBias = text.includes("left") || text.includes("zuo") || text.includes("左");
  const rightBias = text.includes("right") || text.includes("you") || text.includes("右");
  const topBias = text.includes("top") || text.includes("upper") || text.includes("上");
  const bottomBias = text.includes("bottom") || text.includes("lower") || text.includes("下");
  const x = leftBias ? 0.24 : rightBias ? 0.76 : 0.5;
  const y = topBias ? 0.24 : bottomBias ? 0.76 : 0.5;
  return [
    {
      number: 1,
      id: "candidate-primary",
      label: "most likely visible command target",
      normalizedTarget: { x, y, zHint: 0, coordinateSource: "command_language_heuristic" },
      reason: "Best initial guess from the voice/text command and visible-region language.",
      teacherReviewRequired: true,
      confidence: "low"
    },
    {
      number: 2,
      id: "candidate-nearby-control",
      label: "nearby tool or parameter control",
      normalizedTarget: {
        x: clamp01(x + (x > 0.5 ? -0.14 : 0.14)),
        y: clamp01(y - 0.1),
        zHint: 0,
        coordinateSource: "command_language_heuristic"
      },
      reason: "Alternative for toolbar, feature tree, or property panel controls near the likely area.",
      teacherReviewRequired: true,
      confidence: "low"
    },
    {
      number: 3,
      id: "candidate-model-region",
      label: "model or drawing canvas region",
      normalizedTarget: {
        x: clamp01(x),
        y: clamp01(y + 0.16),
        zHint: 0.2,
        coordinateSource: "command_language_heuristic"
      },
      reason: "Alternative for direct canvas/model interaction when the command describes a geometry operation.",
      teacherReviewRequired: true,
      confidence: "low"
    }
  ];
}

function inferIntent(command, voiceTranscript) {
  const text = `${voiceTranscript || ""} ${command || ""}`.toLowerCase();
  const operation =
    /measure|dimension|距离|尺寸|测量/.test(text) ? "measure_or_dimension" :
    /create|add|draw|生成|添加|绘制|新建/.test(text) ? "create_or_add" :
    /edit|change|modify|调整|修改|改/.test(text) ? "edit_or_modify" :
    /select|click|choose|选|点/.test(text) ? "select_or_click" :
    /export|save|导出|保存/.test(text) ? "export_or_save" :
    "ambiguous_engineering_command";
  return {
    format: "transparent_ai_engineering_voice_text_command_intent_v1",
    sourceModalities: {
      voiceTranscriptProvided: Boolean(voiceTranscript),
      textCommandProvided: Boolean(command),
      browserSpeechRecognitionSuggested: true,
      manualTextFallback: true
    },
    commandText: command || voiceTranscript || "",
    voiceTranscript,
    interpretedOperation: operation,
    targetUnderstandingStatus: "needs_numbered_candidate_confirmation",
    confidence: operation === "ambiguous_engineering_command" ? "low" : "medium",
    publicReasoningTrace: [
      "Parse the teacher's voice/text into an engineering operation.",
      "Propose numbered possible target locations instead of executing immediately.",
      "Wait for the teacher to confirm a number or correct the target.",
      "Only after confirmation, compile the chosen target into the existing supervised action bridge."
    ],
    unsupportedWithoutMoreEvidence: [
      "semantic native feature creation in arbitrary engineering software",
      "unreviewed screen recognition",
      "execution without active-window preflight"
    ]
  };
}

function defaultCandidatesUtf8(command) {
  const text = String(command || "").toLowerCase();
  const leftBias = text.includes("left") || text.includes("zuo") || text.includes("左");
  const rightBias = text.includes("right") || text.includes("you") || text.includes("右");
  const topBias = text.includes("top") || text.includes("upper") || text.includes("上");
  const bottomBias = text.includes("bottom") || text.includes("lower") || text.includes("下");
  const x = leftBias ? 0.24 : rightBias ? 0.76 : 0.5;
  const y = topBias ? 0.24 : bottomBias ? 0.76 : 0.5;
  return [
    {
      number: 1,
      id: "candidate-primary",
      label: "most likely visible command target",
      normalizedTarget: { x, y, zHint: 0, coordinateSource: "command_language_heuristic_utf8" },
      reason: "Best initial guess from the voice/text command and visible-region language.",
      teacherReviewRequired: true,
      confidence: "low"
    },
    {
      number: 2,
      id: "candidate-nearby-control",
      label: "nearby tool or parameter control",
      normalizedTarget: {
        x: clamp01(x + (x > 0.5 ? -0.14 : 0.14)),
        y: clamp01(y - 0.1),
        zHint: 0,
        coordinateSource: "command_language_heuristic_utf8"
      },
      reason: "Alternative for toolbar, feature tree, or property panel controls near the likely area.",
      teacherReviewRequired: true,
      confidence: "low"
    },
    {
      number: 3,
      id: "candidate-model-region",
      label: "model or drawing canvas region",
      normalizedTarget: {
        x: clamp01(x),
        y: clamp01(y + 0.16),
        zHint: 0.2,
        coordinateSource: "command_language_heuristic_utf8"
      },
      reason: "Alternative for direct canvas/model interaction when the command describes a geometry operation.",
      teacherReviewRequired: true,
      confidence: "low"
    }
  ];
}

function inferIntentUtf8(command, voiceTranscript) {
  const text = `${voiceTranscript || ""} ${command || ""}`.toLowerCase();
  const operation =
    /measure|dimension|距离|尺寸|测量/.test(text) ? "measure_or_dimension" :
    /create|add|draw|生成|添加|绘制|新建|加一个|画/.test(text) ? "create_or_add" :
    /edit|change|modify|调整|修改|改/.test(text) ? "edit_or_modify" :
    /select|click|choose|选择|点击|点/.test(text) ? "select_or_click" :
    /export|save|导出|保存/.test(text) ? "export_or_save" :
    "ambiguous_engineering_command";
  return {
    format: "transparent_ai_engineering_voice_text_command_intent_v1",
    sourceModalities: {
      voiceTranscriptProvided: Boolean(voiceTranscript),
      textCommandProvided: Boolean(command),
      browserSpeechRecognitionSuggested: true,
      manualTextFallback: true,
      utf8FileInputSupported: true
    },
    commandText: command || voiceTranscript || "",
    voiceTranscript,
    interpretedOperation: operation,
    targetUnderstandingStatus: "needs_numbered_candidate_confirmation",
    confidence: operation === "ambiguous_engineering_command" ? "low" : "medium",
    publicReasoningTrace: [
      "Parse the teacher's voice/text into an engineering operation.",
      "Propose numbered possible target locations instead of executing immediately.",
      "Wait for the teacher to confirm a number or correct the target.",
      "Only after confirmation, compile the chosen target into the existing supervised action bridge."
    ],
    unsupportedWithoutMoreEvidence: [
      "semantic native feature creation in arbitrary engineering software",
      "unreviewed screen recognition",
      "execution without active-window preflight"
    ]
  };
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const goal = textArg("--goal", textArg("--task", "Control engineering software from a reviewed voice or text command."));
const software = argValue("--software", argValue("--app", "target engineering software"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const command = textArg("--command", textArg("--text-command", ""));
const voiceTranscript = textArg("--voice-transcript", "");
const locale = argValue("--locale", "zh-CN");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-command-confirmation-kits")));
const candidateInputs = multiArg("--candidate");

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const intentPath = join(kitDir, "engineering-command-intent.json");
const voiceControlWorkflowPath = join(kitDir, "engineering-voice-control-workflow.json");
const confirmationPath = join(kitDir, "numbered-target-confirmation.json");
const overlayPacketPath = join(kitDir, "numbered-target-overlay-packet.json");
const htmlPath = join(kitDir, "engineering-command-confirmation.html");
const manifestPath = join(kitDir, "engineering-command-confirmation-manifest.json");
const readmePath = join(kitDir, "ENGINEERING_COMMAND_CONFIRMATION_START_HERE.md");

const commandIntent = inferIntentUtf8(command, voiceTranscript);
const candidates = candidateInputs.length > 0 ? candidateInputs.map(parseCandidate) : defaultCandidatesUtf8(commandIntent.commandText);
const selectedCandidate = null;
const locks = {
  reviewOnly: true,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherConfirmationRequired: true,
  nativeUniversalExecution: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false
};

const voiceControlWorkflow = {
  format: "transparent_ai_engineering_voice_or_text_control_workflow_v1",
  kitId,
  goal,
  software,
  inputModes: [
    {
      mode: "voice",
      existingTechnology: "browser Web Speech API SpeechRecognition or webkitSpeechRecognition",
      fallback: "manual transcript or typed command",
      locale,
      requiresRuntimeMicrophonePermission: true
    },
    {
      mode: "text",
      existingTechnology: "plain typed instruction",
      fallback: "paste speech transcript from any system dictation tool"
    }
  ],
  workflow: [
    {
      step: 1,
      id: "capture_instruction",
      publicTrace: "Capture the non-expert user's voice transcript or typed command.",
      tokenPolicy: "keep only the short command text, not continuous audio or screen recording"
    },
    {
      step: 2,
      id: "understand_operation",
      publicTrace: "Restate the understood engineering operation and mark ambiguous pieces for teacher review.",
      understoodOperation: commandIntent.interpretedOperation,
      confidence: commandIntent.confidence
    },
    {
      step: 3,
      id: "mark_numbered_candidates",
      publicTrace: "Place numbered candidate markers at possible screen/model/control targets.",
      candidateCount: candidates.length,
      coordinateSpace: "normalized_0_to_1_screen_or_screenshot",
      targetUnderstandingStatus: "needs_numbered_candidate_confirmation"
    },
    {
      step: 4,
      id: "teacher_confirms_number",
      publicTrace: "Wait for the teacher to confirm one number or correct the candidate list.",
      allowedReplies: ["one confirmed number", "target correction", "stop"],
      blocksExecutionUntilConfirmed: true
    },
    {
      step: 5,
      id: "compile_single_target_plan",
      publicTrace: "Compile only the confirmed target into the transparent overlay and supervised action bridge.",
      nextTool: "confirm_engineering_command_target",
      selectedTargetOnly: true
    },
    {
      step: 6,
      id: "execute_after_supervised_gate",
      publicTrace: "Execute only through an existing reviewed adapter or supervised UI route after dry-run, window/route preflight, spatial-readiness confirmation, and outcome verification.",
      executionDefault: "dry_run_first",
      nextAdapters: [
        "existing-application-api",
        "existing-cli-or-script",
        "existing-file-import-export",
        "existing-browser-automation",
        "existing-windows-ui-automation"
      ]
    }
  ],
  candidateMarkingPolicy: {
    markerStyle: "visible_numbers_over_possible_targets",
    teacherMustConfirmExactlyOneNumber: true,
    canAskForCorrectedCandidateList: true,
    autoExecuteFromVoiceOnly: false
  },
  lowTokenPolicy: {
    fullContinuousRecording: false,
    storeAudio: false,
    defaultScreenCapture: false,
    inspectLogsOrMetadataBeforeScreenshot: true,
    screenshotOnlyAfterUsefulTriggerOrTeacherReview: true
  },
  blockedUntilTeacherReview: [
    "mouse or keyboard events",
    "native universal execution claim",
    "saving reusable command rule",
    "packaging as accepted technology"
  ],
  locks
};

const targetConfirmation = {
  format: "transparent_ai_numbered_target_confirmation_v1",
  kitId,
  goal,
  software,
  commandIntent: intentPath,
  voiceControlWorkflow: voiceControlWorkflowPath,
  status: "waiting_for_teacher_target_number",
  instructionToTeacher: "Confirm one candidate number, or correct the target before any software action is compiled.",
  selectedCandidate,
  candidates,
  confirmationRequiredBefore: [
    "confirm_engineering_command_target",
    "create_supervised_software_action_kit",
    "run-supervised-software-actions.ps1",
    "any mouse or keyboard event"
  ],
  executionAfterConfirmationPolicy: {
    nextTool: "confirm_engineering_command_target",
    selectedTargetOnly: true,
    dryRunFirst: true,
    requiresTargetWindowOrRoutePreflight: true,
    requiresSpatialReadinessConfirmation: true,
    requiresOutcomeVerification: true
  },
  teacherReplyExamples: ["1", "confirm number 2", "不是这三个，目标在右上角参数框", "先不要执行"],
  locks
};

targetConfirmation.teacherReplyExamplesPublic = [
  "1",
  "confirm number 2",
  "不是这三个，目标在右上角参数框",
  "先不要执行"
];

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  goal,
  software,
  overlayMode: "voice_text_numbered_target_confirmation",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
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
      type: "numbered_teacher_confirmation_candidate",
      number: candidate.number,
      label: `${candidate.number}. ${candidate.label}`,
      box: [clamp01(x - 0.035), clamp01(y - 0.035), clamp01(x + 0.035), clamp01(y + 0.035)],
      reason: candidate.reason
    };
  }),
  strokes: candidates.map((candidate) => ({
    id: `number-${candidate.number}-target-mark`,
    mode: "screen_2d",
    semanticLabel: `candidate ${candidate.number}: ${candidate.label}`,
    targetAnchorId: candidate.id,
    points: [
      {
        x: candidate.normalizedTarget.x,
        y: candidate.normalizedTarget.y,
        zHint: candidate.normalizedTarget.zHint || 0,
        t: 0,
        planeId: "screen_or_model_view"
      },
      {
        x: clamp01(candidate.normalizedTarget.x + 0.004),
        y: clamp01(candidate.normalizedTarget.y + 0.004),
        zHint: candidate.normalizedTarget.zHint || 0,
        t: 30,
        planeId: "screen_or_model_view"
      }
    ]
  })),
  spatialIntent: {
    relationships: candidates.map((candidate) => ({
      subject: `number-${candidate.number}-target-mark`,
      relation: "candidate_target_for",
      object: commandIntent.interpretedOperation,
      teacherMustConfirmNumber: candidate.number
    })),
    inferredTeacherIntent: "review_only: voice/text command becomes numbered target candidates before supervised action planning"
  },
  commandIntent: intentPath,
  voiceControlWorkflow: voiceControlWorkflowPath,
  targetConfirmation: confirmationPath,
  locks
};

const manifest = {
  ok: true,
  format: "transparent_ai_engineering_command_confirmation_kit_v1",
  kitId,
  goal,
  software,
  targetSoftware: {
    software,
    processName,
    windowTitle,
    requiresActiveTargetWindow: true
  },
  files: {
    teacherReadme: readmePath,
    browserHtml: htmlPath,
    commandIntent: intentPath,
    voiceControlWorkflow: voiceControlWorkflowPath,
    targetConfirmation: confirmationPath,
    overlayPacket: overlayPacketPath,
    manifest: manifestPath
  },
  capabilities: {
    acceptsVoiceTranscript: true,
    acceptsTextCommand: true,
    createsVoiceOrTextControlWorkflow: true,
    usesExistingBrowserSpeechRecognition: true,
    manualTextFallback: true,
    restatesUnderstoodOperationBeforeExecution: true,
    proposesNumberedTargets: true,
    requiresTeacherCandidateNumber: true,
    compilesToTransparentOverlayPacket: true,
    nextConfirmationBridge: "confirm_engineering_command_target",
    nextBridge: "create_supervised_software_action_kit",
    defaultMode: "review_only_no_execution",
    nativeUniversalExecution: false,
    softwareActionsExecuted: false
  },
  nextMcpCalls: [
    {
      when: "The teacher confirms exactly one candidate number.",
      tool: "confirm_engineering_command_target",
      arguments: {
        confirmation: confirmationPath,
        selectedCandidateNumber: "<teacher confirmed number>",
        createActionKit: true,
        createExecutionAdapter: true
      },
      gate: "This narrows the numbered candidates to one selected overlay before create_supervised_software_action_kit."
    },
    {
      when: "The teacher says the numbered candidates are wrong.",
      tool: "create_engineering_command_confirmation_kit",
      arguments: {
        goal,
        software,
        command: "<teacher correction or refined target>",
        candidate: "<label|x|y|zHint|reason>"
      }
    },
    {
      when: "A runner receipt exists after dry-run or supervised execution.",
      tool: "verify_supervised_action_outcome",
      arguments: {
        receipt: "<supervised-action-execution-receipt.json>",
        plan: "<supervised-action-plan.json>",
        preflight: "<supervised-action-preflight.json>"
      }
    }
  ],
  locks
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Engineering Command Confirmation</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1120px; margin: 0 auto; padding: 20px; display: grid; gap: 16px; }
    section { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; background: #fff; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 0 0 10px; font-size: 17px; }
    p { color: #475569; line-height: 1.45; }
    ol { color: #475569; line-height: 1.45; padding-left: 20px; }
    textarea, input { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: inherit; }
    textarea { min-height: 110px; }
    button { border: 1px solid #64748b; border-radius: 6px; background: #fff; padding: 8px 11px; font: inherit; cursor: pointer; }
    button.primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .workspace { position: relative; aspect-ratio: 16/9; border: 1px dashed #94a3b8; border-radius: 8px; background: linear-gradient(135deg, #f8fafc, #eef2f7); overflow: hidden; }
    .marker { position: absolute; transform: translate(-50%, -50%); width: 34px; height: 34px; border-radius: 50%; background: #0f766e; color: #fff; display: grid; place-items: center; font-weight: 800; box-shadow: 0 5px 16px rgba(15, 118, 110, .28); }
    .marker.selected { outline: 4px solid rgba(15, 118, 110, .25); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
    .summary { display: grid; gap: 6px; }
    code { background: #e2e8f0; border-radius: 4px; padding: 1px 4px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Engineering Command Confirmation</h1>
      <p>Say or type an engineering software command, then confirm a numbered target before the supervised action bridge is allowed to prepare a dry run.</p>
    </header>
    <section>
      <h2>Voice or text command</h2>
      <div class="row">
        <button id="startVoice" class="primary">Start dictation</button>
        <button id="stopVoice">Stop</button>
        <button id="exportJson">Export review JSON</button>
      </div>
      <p id="status">Uses <code>SpeechRecognition</code> or <code>webkitSpeechRecognition</code> when available; type manually when microphone access is unavailable.</p>
      <textarea id="command">${commandIntent.commandText}</textarea>
    </section>
    <section>
      <h2>Understood operation and gate</h2>
      <div class="summary">
        <p>Understood operation: <code>${commandIntent.interpretedOperation}</code>. Confidence: <code>${commandIntent.confidence}</code>.</p>
        <p>Execution is blocked until one number is confirmed, the single-target action plan is dry-run reviewed, and the target window or existing adapter preflight passes.</p>
      </div>
      <ol>
        <li>Capture voice or typed command.</li>
        <li>Mark possible targets with numbers.</li>
        <li>Teacher confirms exactly one number or corrects the candidates.</li>
        <li>Only the confirmed target may enter the supervised action bridge.</li>
      </ol>
    </section>
    <section>
      <h2>Confirm target number</h2>
      <div class="workspace" id="workspace"></div>
      <div class="cards" id="cards"></div>
    </section>
    <section>
      <h2>Paste back to Codex</h2>
      <textarea id="jsonOut" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const manifest = ${jsonScript(manifest)};
    const intent = ${jsonScript(commandIntent)};
    const voiceControlWorkflow = ${jsonScript(voiceControlWorkflow)};
    const confirmation = ${jsonScript(targetConfirmation)};
    const workspace = document.getElementById('workspace');
    const cards = document.getElementById('cards');
    const commandEl = document.getElementById('command');
    const out = document.getElementById('jsonOut');
    const statusEl = document.getElementById('status');
    let selected = null;
    let recognition = null;

    function render() {
      workspace.innerHTML = '';
      cards.innerHTML = '';
      for (const candidate of confirmation.candidates) {
        const marker = document.createElement('button');
        marker.className = 'marker' + (selected === candidate.number ? ' selected' : '');
        marker.style.left = (candidate.normalizedTarget.x * 100) + '%';
        marker.style.top = (candidate.normalizedTarget.y * 100) + '%';
        marker.textContent = candidate.number;
        marker.onclick = () => { selected = candidate.number; render(); buildJson(); };
        workspace.appendChild(marker);
        const card = document.createElement('button');
        card.className = 'card';
        card.innerHTML = '<strong>' + candidate.number + '. ' + candidate.label + '</strong><p>' + candidate.reason + '</p>';
        card.onclick = () => { selected = candidate.number; render(); buildJson(); };
        cards.appendChild(card);
      }
    }

    function buildJson() {
      const packet = {
        format: 'transparent_ai_engineering_command_confirmation_review_v1',
        manifest,
        voiceControlWorkflow,
        commandIntent: { ...intent, commandText: commandEl.value.trim() },
        targetConfirmation: { ...confirmation, status: selected ? 'teacher_selected_candidate_number' : 'waiting_for_teacher_target_number', selectedCandidateNumber: selected },
        nextAllowedTool: selected ? 'confirm_engineering_command_target' : 'none_until_teacher_confirms_number',
        softwareActionsExecuted: false,
        locks: confirmation.locks
      };
      out.value = JSON.stringify(packet, null, 2);
    }

    document.getElementById('exportJson').onclick = buildJson;
    document.getElementById('startVoice').onclick = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        statusEl.textContent = 'SpeechRecognition unavailable. Type the command manually.';
        return;
      }
      recognition = new SpeechRecognition();
      recognition.lang = ${jsonScript(locale)};
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let text = '';
        for (const result of event.results) text += result[0].transcript;
        commandEl.value = text;
        buildJson();
      };
      recognition.start();
      statusEl.textContent = 'Listening. Confirm a numbered target after the transcript looks right.';
    };
    document.getElementById('stopVoice').onclick = () => recognition && recognition.stop();
    commandEl.oninput = buildJson;
    render();
    buildJson();
  </script>
</body>
</html>
`;

writeFileSync(intentPath, `${JSON.stringify(commandIntent, null, 2)}\n`, "utf8");
writeFileSync(voiceControlWorkflowPath, `${JSON.stringify(voiceControlWorkflow, null, 2)}\n`, "utf8");
writeFileSync(confirmationPath, `${JSON.stringify(targetConfirmation, null, 2)}\n`, "utf8");
writeFileSync(overlayPacketPath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeFileSync(htmlPath, html, "utf8");
writeFileSync(readmePath, [
  "# Engineering Command Confirmation Kit",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  "",
  "Use this when a non-expert wants to control engineering software by speaking or typing a command.",
  "",
  "Workflow:",
  "",
  `1. Open ${basename(htmlPath)} or review ${basename(voiceControlWorkflowPath)} and ${basename(confirmationPath)}.`,
  "2. Say or type the command.",
  "3. Confirm exactly one numbered target, or correct the target candidates.",
  "4. Run confirm_engineering_command_target with the confirmed number to narrow the packet to one target.",
  `5. Use ${basename(overlayPacketPath)} only as review evidence; real action planning must use the confirmed single-target overlay from the target-confirmation result.`,
  "6. Run the generated supervised runner in dry-run mode first; execute only with teacher confirmation and active-window preflight.",
  "",
  "Locked defaults: softwareActionsExecuted=false, nativeUniversalExecution=false, fullContinuousRecording=false, ruleEnabled=false, accepted=false, packagingGated=true."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_engineering_command_confirmation_kit_result_v1",
  kitId,
  kitPath: manifestPath,
  teacherReadme: readmePath,
  browserHtml: htmlPath,
  commandIntent: intentPath,
  voiceControlWorkflow: voiceControlWorkflowPath,
  targetConfirmation: confirmationPath,
  overlayPacket: overlayPacketPath,
  candidateCount: candidates.length,
  candidateNumbers: candidates.map((candidate) => candidate.number),
  nextConfirmationBridge: "confirm_engineering_command_target",
  nextBridge: "create_supervised_software_action_kit",
  teacherConfirmationRequired: true,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
