#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "engineering-voice-control-workbench-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

const visualEvidencePath = join(smokeRoot, "reviewed-engineering-screen.svg");
const teacherExportedSketchPacketPath = join(smokeRoot, "teacher-exported-transparent-sketch-packet.json");
const chineseGoalPath = join(smokeRoot, "chinese-goal.txt");
const chineseCommandPath = join(smokeRoot, "chinese-command.txt");
writeFileSync(chineseGoalPath, "语音控制工程软件：先标编号再确认\n", "utf8");
writeFileSync(chineseCommandPath, "在模型右上角加一个孔，先不要执行\n", "utf8");
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
writeFileSync(
  teacherExportedSketchPacketPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_sketch_overlay_packet_v1",
      kitId: "teacher-exported-workbench-smoke-packet",
      software: "ExampleCAD",
      goal: "Teacher draws 2D perspective and 3D depth intent before engineering software action.",
      fullContinuousRecording: false,
      overlayMode: "depth_axis_3d",
      coordinateSpace: {
        origin: "top_left_screen_or_screenshot",
        units: "normalized_0_to_1",
        supports2D: true,
        supports3DDepthHints: true
      },
      anchors: [
        {
          id: "upper-right-face-anchor",
          type: "teacher_marked_region",
          label: "upper right face with depth mark",
          box: [0.72, 0.16, 0.88, 0.34, 0.42]
        }
      ],
      strokes: [
        {
          id: "depth-arrow-to-upper-right-face",
          mode: "perspective_grid",
          semanticLabel: "create feature on the nearer upper-right face",
          targetAnchorId: "upper-right-face-anchor",
          depthHint: "nearer_than_start",
          color: "#ff3b30",
          width: 4,
          points: [
            { x: 0.42, y: 0.56, t: 0, pressure: 0.5, zHint: -0.2, planeId: "perspective_grid" },
            { x: 0.8, y: 0.24, t: 80, pressure: 0.8, zHint: 0.42, planeId: "perspective_grid" }
          ]
        }
      ],
      spatialIntent: {
        relationships: [
          { subject: "depth-arrow-to-upper-right-face", relation: "attached_to", object: "upper-right-face-anchor" }
        ],
        perspectiveCues: [
          {
            id: "upper-right-vanishing-line",
            vanishingPoint: [0.95, 0.08],
            horizonLine: [0.05, 0.2, 0.95, 0.14],
            depthAxis: [0.42, 0.56, 0.8, 0.24],
            planeNormalHint: "face points toward viewer"
          }
        ],
        inferredTeacherIntent:
          "review_only: teacher drew a perspective depth arrow to show the exact upper-right face before any software execution"
      },
      locks: {
        ruleEnabled: false,
        accepted: false,
        technologyAccepted: false,
        packagingGated: true,
        nativeExecutionImplemented: false,
        teacherReviewRequired: true
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function startServer(extraEnv = {}) {
  const serverScript = join(pluginRoot, "scripts", "mcp-server.mjs");
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let id = 1;
  const pending = new Map();
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    const lines = stdout.split(/\r?\n/);
    stdout = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const requestId = id++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  return { rpc, stop };
}

function parseTextResult(result) {
  return JSON.parse(result.content[0].text);
}

const direct = runNodeScript("create-engineering-voice-control-workbench.mjs", [
  "--goal",
  "Let a non-expert place a reviewed slot in engineering software from a spoken command.",
  "--software",
  "ExampleCAD",
  "--command",
  "Put the slot on the upper right face and prepare a dry run.",
  "--voice-transcript",
  "Put the slot on the upper right face and prepare a dry run.",
  "--visual-evidence",
  visualEvidencePath,
  "--candidate",
  "upper-right-face|upper right face|0.78|0.22|0.3|voice command points to the upper-right visible face",
  "--candidate",
  "feature-tree-slot-command|slot command in feature tree|0.18|0.35|0|possible structured command target",
  "--no-port-scan",
  "--max-files",
  "8",
  "--max-depth",
  "1",
  "--output-dir",
  join(smokeRoot, "direct")
]);

const utf8NoVisual = runNodeScript("create-engineering-voice-control-workbench.mjs", [
  "--goal-file",
  chineseGoalPath,
  "--software",
  "ExampleCAD",
  "--command-file",
  chineseCommandPath,
  "--no-port-scan",
  "--max-files",
  "8",
  "--max-depth",
  "1",
  "--output-dir",
  join(smokeRoot, "utf8-no-visual")
]);

const workbench = readJson(direct.workbenchPath);
const receiptTemplate = readJson(direct.receiptTemplate);
const html = readFileSync(direct.htmlPath, "utf8");
const session = readJson(direct.sessionPath);
const targetConfirmation = readJson(direct.targetConfirmation);
const utf8Workbench = readJson(utf8NoVisual.workbenchPath);
const utf8TargetConfirmation = readJson(utf8NoVisual.targetConfirmation);
const utf8CommandIntent = readJson(utf8TargetConfirmation.commandIntent);
const utf8Html = readFileSync(utf8NoVisual.htmlPath, "utf8");
const spatialFromTeacherSketch = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--overlay-packet",
  teacherExportedSketchPacketPath,
  "--goal",
  "Use the teacher-exported transparent sketch packet from the workbench to create numbered spatial targets.",
  "--software",
  "ExampleCAD",
  "--command",
  "Create the feature on the nearer upper-right face after teacher confirms a number.",
  "--output-dir",
  join(dirname(direct.workbenchPath), "teacher-exported-spatial-target-confirmation-e2e"),
  "--create-action-kit"
]);
const spatialTargetConfirmation = readJson(spatialFromTeacherSketch.targetConfirmation);
const spatialInterpretation = readJson(spatialFromTeacherSketch.spatialIntentInterpretation);
const confirmedSpatialTarget = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  spatialFromTeacherSketch.targetConfirmation,
  "--selected-number",
  "1",
  "--goal",
  "Teacher confirmed one spatial target from the exported transparent sketch packet.",
  "--software",
  "ExampleCAD",
  "--output-dir",
  join(dirname(direct.workbenchPath), "teacher-exported-spatial-target-confirmed-e2e"),
  "--action-output-dir",
  join(dirname(direct.workbenchPath), "teacher-exported-spatial-target-confirmed-e2e", "supervised-action-kits"),
  "--execution-adapter-output-dir",
  join(dirname(direct.workbenchPath), "teacher-exported-spatial-target-confirmed-e2e", "execution-adapter-selections"),
  "--create-action-kit"
]);
const confirmedSpatialOverlay = readJson(confirmedSpatialTarget.narrowedOverlayPacket);

const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
let toolList;
let mcp;
try {
  await server.rpc("initialize", {});
  server.rpc("notifications/initialized", {}).catch(() => {});
  toolList = await server.rpc("tools/list", {});
  mcp = parseTextResult(await server.rpc("tools/call", {
    name: "create_engineering_voice_control_workbench",
    arguments: {
      goal: "Control ExampleCAD by voice with numbered target confirmation.",
      software: "ExampleCAD",
      command: "Select the upper right face and prepare a dry run.",
      candidates: [
        "upper-right-face|upper right face|0.8|0.2|0.2|teacher voice command points here",
        "nearby-feature-command|nearby feature command|0.25|0.4|0|alternative control"
      ],
      visualEvidence: visualEvidencePath,
      noPortScan: true,
      maxFiles: 8,
      maxDepth: 1,
      outputDir: join(smokeRoot, "mcp")
    }
  }));
} finally {
  await server.stop();
}

const advancedNames = toolList.tools.map((tool) => tool.name);
const mcpWorkbench = readJson(mcp.workbenchPath);

const checks = [
  {
    name: "Workbench script writes user-facing HTML plus machine-readable state",
    pass:
      direct.format === "transparent_ai_engineering_voice_control_workbench_result_v1" &&
      workbench.format === "transparent_ai_engineering_voice_control_workbench_v1" &&
      existsSync(direct.htmlPath) &&
      existsSync(direct.teacherReadme) &&
      existsSync(direct.receiptTemplate),
    evidence: direct.workbenchPath
  },
  {
    name: "Workbench reuses existing voice session and numbered target confirmation",
    pass:
      session.format === "transparent_ai_engineering_voice_control_session_v1" &&
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length === 2 &&
      workbench.existingAbilitiesReused.includes("create_engineering_voice_control_session") &&
      workbench.existingAbilitiesReused.includes("confirm_engineering_command_target"),
    evidence: `${direct.sessionPath}; ${direct.targetConfirmation}`
  },
  {
    name: "HTML supports voice/text, numbered selection, and confirm packet generation without software execution",
    pass:
      html.includes("SpeechRecognition") &&
      html.includes("selectedCandidateNumber") &&
      html.includes("confirmCommand") &&
      html.includes("transparent_ai_engineering_voice_control_workbench_receipt_v1") &&
      html.includes("workbenchDoesNotExecuteSoftware") &&
      workbench.nextConfirmCommandTemplate.includes("confirm-engineering-command-target.mjs") &&
      workbench.nextConfirmCommandTemplate.includes("__SELECTED_NUMBER__") &&
      workbench.locks.softwareActionsExecuted === false &&
      workbench.locks.uiEventsSent === false &&
      workbench.locks.targetSoftwareCommandsExecuted === false,
    evidence: direct.htmlPath
  },
  {
    name: "Workbench bridges reviewed visual evidence into numbered target markers",
    pass:
      workbench.visualEvidence?.path === visualEvidencePath &&
      workbench.generated.visualTargetConfirmation &&
      workbench.generated.activeTargetConfirmation === direct.targetConfirmation &&
      targetConfirmation.visualEvidencePath === visualEvidencePath &&
      html.includes("Reviewed engineering visual evidence") &&
      html.includes("Using reviewed visual evidence as the coordinate backdrop"),
    evidence: `${direct.targetConfirmation}; ${workbench.generated.visualTargetConfirmation}`
  },
  {
    name: "Workbench exposes transparent sketch export to spatial numbered targets without fabricating teacher sketch evidence",
    pass:
      existsSync(direct.transparentSketchOverlay) &&
      workbench.existingAbilitiesReused.includes("create_transparent_sketch_overlay_kit") &&
      workbench.existingAbilitiesReused.includes("create_spatial_target_confirmation_kit") &&
      workbench.generated.transparentSketchOverlayHtml === direct.transparentSketchOverlay &&
      workbench.spatialSketchBridge?.status === "waiting_for_teacher_exported_transparent_sketch_packet" &&
      workbench.spatialSketchBridge?.teacherExportedOverlayPacketPlaceholder === "<teacher-exported-transparent-sketch-packet.json>" &&
      workbench.spatialSketchBridge?.spatialTargetConfirmationCommandTemplate?.includes("create-spatial-target-confirmation-kit.mjs") &&
      workbench.spatialSketchBridge?.spatialTargetConfirmationCommandTemplate?.includes("<teacher-exported-transparent-sketch-packet.json>") &&
      workbench.spatialSketchBridge?.doesNotUseSamplePacketAsTeacherEvidence === true &&
      workbench.spatialSketchBridge?.generatedSpatialIntentEvidence === false &&
      html.includes("Transparent Sketch To Numbered Targets") &&
      html.includes("Open Sketch Overlay") &&
      html.includes("The sample packet is never treated as teacher evidence."),
    evidence: workbench.spatialSketchBridge?.spatialTargetConfirmationCommandTemplate || "missing spatial sketch bridge"
  },
  {
    name: "Teacher-exported workbench sketch packet becomes numbered spatial target and confirmed dry-run material",
    pass:
      spatialFromTeacherSketch.format === "transparent_ai_spatial_target_confirmation_kit_result_v1" &&
      spatialFromTeacherSketch.sourceOverlayPacket === teacherExportedSketchPacketPath &&
      spatialTargetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      spatialTargetConfirmation.candidates.length >= 1 &&
      spatialTargetConfirmation.spatialEvidenceSummary.supports2D === true &&
      spatialTargetConfirmation.spatialEvidenceSummary.supportsPerspectiveRelationships === true &&
      spatialTargetConfirmation.spatialEvidenceSummary.supports3DDepthHints === true &&
      spatialInterpretation.summary.perspectiveCueCount === 1 &&
      spatialInterpretation.inferredRelationships.some((row) => row.relation === "nearer_than") &&
      confirmedSpatialTarget.format === "transparent_ai_engineering_command_target_confirmation_result_v1" &&
      confirmedSpatialTarget.selectedTargetOnly === true &&
      confirmedSpatialTarget.selectedCandidateNumber === 1 &&
      confirmedSpatialTarget.narrowedOverlayAnchorCount === 1 &&
      confirmedSpatialOverlay.coordinateSpace.targetNumberConfirmedByTeacher === 1 &&
      existsSync(confirmedSpatialTarget.supervisedActionKit) &&
      confirmedSpatialTarget.softwareActionsExecuted === false &&
      confirmedSpatialTarget.nativeUniversalExecution === false,
    evidence: `${spatialFromTeacherSketch.targetConfirmation}; ${confirmedSpatialTarget.receipt}`
  },
  {
    name: "Receipt template blocks acceptance, memory, packaging, and execute-now states",
    pass:
      receiptTemplate.format === "transparent_ai_engineering_voice_control_workbench_receipt_template_v1" &&
      receiptTemplate.allowedStatuses.includes("number_confirmed_for_dry_run") &&
      receiptTemplate.blockedStatuses.includes("execute_now") &&
      receiptTemplate.blockedStatuses.includes("accepted") &&
      receiptTemplate.locks.memoryWritten === false &&
      receiptTemplate.locks.packagingGated === true,
    evidence: direct.receiptTemplate
  },
  {
    name: "UTF-8 Chinese text input can create no-screenshot numbered target candidates",
    pass:
      utf8Workbench.goal === "语音控制工程软件：先标编号再确认" &&
      utf8Workbench.targetCandidates.length === 3 &&
      utf8Workbench.targetCandidates[0].normalizedTarget.x > 0.7 &&
      utf8Workbench.targetCandidates[0].normalizedTarget.y < 0.3 &&
      utf8CommandIntent.commandText === "在模型右上角加一个孔，先不要执行" &&
      utf8CommandIntent.interpretedOperation === "create_or_add" &&
      utf8TargetConfirmation.teacherReplyExamplesPublic.includes("先不要执行") &&
      utf8Html.includes("语音控制工程软件：先标编号再确认") &&
      utf8Workbench.locks.screenshotsCaptured === false &&
      utf8Workbench.locks.softwareActionsExecuted === false,
    evidence: `${utf8NoVisual.workbenchPath}; ${utf8NoVisual.targetConfirmation}`
  },
  {
    name: "MCP advanced tool exposes the workbench",
    pass:
      advancedNames.includes("create_engineering_voice_control_workbench") &&
      mcp.format === "transparent_ai_engineering_voice_control_workbench_result_v1" &&
      mcpWorkbench.format === "transparent_ai_engineering_voice_control_workbench_v1" &&
      mcpWorkbench.visualEvidence?.path === visualEvidencePath,
    evidence: mcp.workbenchPath
  },
  {
    name: "Workbench keeps the full-goal boundary honest",
    pass:
      workbench.locks.nativeUniversalExecution === false &&
      workbench.locks.accepted === false &&
      workbench.locks.ruleEnabled === false &&
      workbench.blockedActions.includes("claim_universal_native_execution_or_all_software_completion"),
    evidence: JSON.stringify(workbench.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_engineering_voice_control_workbench_smoke_v1",
  smokeRoot,
  paths: {
    workbench: direct.workbenchPath,
    html: direct.htmlPath,
    receiptTemplate: direct.receiptTemplate,
    teacherExportedSketchPacket: teacherExportedSketchPacketPath,
    spatialTargetConfirmation: spatialFromTeacherSketch.targetConfirmation,
    confirmedSpatialTarget: confirmedSpatialTarget.receipt,
    mcpWorkbench: mcp.workbenchPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
