#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "transparent-overlay-browser-spatial-flow", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

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

function extractBrowserScript(html) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const script = matches.at(-1)?.[1];
  if (!script) throw new Error("Generated transparent overlay HTML did not contain an executable browser script.");
  return script;
}

function makeElement(id) {
  return {
    id,
    value: "",
    files: [],
    style: {},
    textContent: "",
    innerHTML: "",
    width: 0,
    height: 0,
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    setPointerCapture() {},
    getContext() {
      return {
        setTransform() {},
        clearRect() {},
        strokeRect() {},
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        lineCap: "round",
        lineJoin: "round",
        setLineDash() {}
      };
    }
  };
}

function runBrowserOverlayScript(html) {
  const elements = new Map();
  for (const id of ["canvas", "preview", "backdrop", "backdropFile", "kind", "mode", "label", "depth", "undo", "clear", "export"]) {
    elements.set(id, makeElement(id));
  }
  elements.get("kind").value = "stroke";
  elements.get("mode").value = "screen_2d";
  elements.get("depth").value = "0";
  elements.get("label").value = "2D screen position mark";

  const context = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    Date,
    Number,
    Math,
    JSON,
    Blob: class Blob {},
    URL: { createObjectURL: () => "blob:transparent-overlay-smoke" },
    navigator: { clipboard: { writeText: async () => {} } },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
      },
      createElement(id) {
        return makeElement(id);
      }
    },
    addEventListener() {}
  };
  for (const [id, element] of elements) context[id] = element;
  vm.createContext(context);
  vm.runInContext(extractBrowserScript(html), context, { timeout: 10000 });

  function draw({ kind, mode, label, depth, from, via, to, viaDepth = depth, toDepth = depth }) {
    context.kind.value = kind;
    context.mode.value = mode;
    context.label.value = label;
    context.depth.value = String(depth);
    const canvas = context.canvas;
    const events = canvas.listeners;
    events.pointerdown({ clientX: from[0], clientY: from[1], pressure: 0.5, pointerId: 1 });
    context.depth.value = String(viaDepth);
    events.pointermove({ clientX: via[0], clientY: via[1], pressure: 0.5, pointerId: 1 });
    context.depth.value = String(toDepth);
    events.pointerup({ clientX: to[0], clientY: to[1], pressure: 0.5, pointerId: 1 });
  }

  draw({
    kind: "anchor",
    mode: "screen_2d",
    label: "teacher marked target area",
    depth: 0,
    from: [705, 155],
    via: [850, 245],
    to: [930, 320]
  });
  draw({
    kind: "stroke",
    mode: "screen_2d",
    label: "2D move result into marked region",
    depth: 0,
    from: [360, 520],
    via: [560, 430],
    to: [805, 250]
  });
  draw({
    kind: "stroke",
    mode: "perspective_grid",
    label: "align with perspective plane toward target",
    depth: 0.15,
    from: [360, 360],
    via: [620, 315],
    to: [825, 230]
  });
  draw({
    kind: "stroke",
    mode: "depth_axis_3d",
    label: "pull nearer along 3D depth axis",
    depth: 0.05,
    viaDepth: 0.3,
    toDepth: 0.65,
    from: [600, 500],
    via: [720, 405],
    to: [850, 275]
  });

  if (typeof context.packet !== "function") throw new Error("Generated browser overlay script did not expose packet().");
  return context.packet();
}

const overlayKit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  "Teacher draws a 2D perspective and 3D depth sketch over engineering software before execution.",
  "--software",
  "ExampleCAD",
  "--output-dir",
  join(smokeRoot, "overlay-kit")
]);
const html = readFileSync(overlayKit.browserOverlay, "utf8");
if (!html.includes("AI 学徒") || !html.includes("老师蒙版纠错")) {
  throw new Error("Generated overlay did not include the AI Apprentice mask workbench UI.");
}
const browserExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
let browserPacket;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(overlayKit.browserOverlay).href, { waitUntil: "load" });
  browserPacket = await page.evaluate(() => {
    const point = (x, y, zHint, planeId) => ({ x, y, t: Date.now(), pressure: 0.5, zHint, planeId });
    globalThis.MingTuOverlay.setCorrection({
      note: "Move the reviewed structure into the marked target and preserve unmarked regions.",
      issueType: "结构错误",
      workflowStep: "Image2 样图复核"
    });
    globalThis.MingTuOverlay.importAnnotations([
      {
        id: "anchor-target",
        tool: "rect",
        mode: "screen_2d",
        semanticLabel: "teacher marked target area",
        color: "#d4463a",
        width: 6,
        depthHint: 0,
        points: [point(0.55, 0.22, 0, "screen_2d"), point(0.73, 0.44, 0, "screen_2d")]
      },
      {
        id: "stroke-screen",
        tool: "brush",
        mode: "screen_2d",
        semanticLabel: "2D move result into marked region",
        color: "#d4463a",
        width: 6,
        depthHint: 0,
        points: [point(0.28, 0.72, 0, "screen_2d"), point(0.44, 0.59, 0, "screen_2d"), point(0.63, 0.34, 0, "screen_2d")]
      },
      {
        id: "stroke-perspective",
        tool: "arrow",
        mode: "perspective_grid",
        semanticLabel: "align with perspective plane toward target",
        color: "#176b87",
        width: 6,
        depthHint: 0.25,
        points: [point(0.28, 0.5, 0.1, "perspective_grid"), point(0.64, 0.32, 0.25, "perspective_grid")]
      },
      {
        id: "stroke-depth",
        tool: "arrow",
        mode: "depth_axis_3d",
        semanticLabel: "pull nearer along 3D depth axis",
        color: "#14796f",
        width: 6,
        depthHint: 0.65,
        points: [point(0.47, 0.7, 0.05, "depth_axis_3d"), point(0.66, 0.37, 0.65, "depth_axis_3d")]
      }
    ]);
    return globalThis.packet();
  });
} finally {
  await browser.close();
}
const browserPacketPath = join(smokeRoot, "browser-generated-transparent-sketch-packet.json");
writeFileSync(browserPacketPath, `${JSON.stringify(browserPacket, null, 2)}\n`, "utf8");

const interpretationResult = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  browserPacketPath,
  "--output-dir",
  join(smokeRoot, "spatial-intent")
]);
const interpretation = readJson(interpretationResult.interpretationPath);

const targetResult = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--overlay-packet",
  browserPacketPath,
  "--spatial-intent",
  interpretationResult.interpretationPath,
  "--command",
  "Use the teacher's sketch to choose the exact target before any software action.",
  "--output-dir",
  join(smokeRoot, "spatial-target-confirmation")
]);
const targetConfirmation = readJson(targetResult.targetConfirmation);
const numberedOverlayPacket = readJson(targetResult.overlayPacket);

const strokeModes = new Set(browserPacket.strokes.map((stroke) => stroke.mode));
const declaredRelations = new Set(browserPacket.spatialIntent.relationships.map((row) => row.relation));
const inferredRelations = new Set(interpretation.inferredRelationships.map((row) => row.relation));
const checks = [
  {
    name: "Browser overlay JS generates 2D perspective and 3D depth packet",
    pass:
      browserPacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
      browserPacket.coordinateSpace.supports2D === true &&
      browserPacket.coordinateSpace.supports3DDepthHints === true &&
      browserPacket.coordinateSpace.supportsPerspectiveRelationships === true &&
      browserPacket.anchors.length === 1 &&
      browserPacket.strokes.length === 3 &&
      strokeModes.has("screen_2d") &&
      strokeModes.has("perspective_grid") &&
      strokeModes.has("depth_axis_3d") &&
      declaredRelations.has("perspective_to") &&
      declaredRelations.has("nearer_than"),
    evidence: browserPacketPath
  },
  {
    name: "Browser-generated packet flows into spatial interpretation",
    pass:
      interpretation.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      interpretation.summary.supports2D === true &&
      interpretation.summary.supports3DDepthHints === true &&
      interpretation.strokeGeometry.length === 3 &&
      inferredRelations.has("perspective_to") &&
      inferredRelations.has("nearer_than") &&
      interpretation.reviewLocks.nativeUniversalExecution === false,
    evidence: interpretationResult.interpretationPath
  },
  {
    name: "Browser-generated spatial intent becomes numbered target confirmation",
    pass:
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length >= 2 &&
      targetConfirmation.spatialEvidenceSummary.supports2D === true &&
      targetConfirmation.spatialEvidenceSummary.supports3DDepthHints === true &&
      targetConfirmation.spatialEvidenceSummary.supportsPerspectiveRelationships === true &&
      numberedOverlayPacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
      numberedOverlayPacket.overlayMode === "spatial_intent_numbered_target_confirmation",
    evidence: targetResult.targetConfirmation
  },
  {
    name: "Browser overlay spatial flow keeps execution memory and native claims locked",
    pass:
      browserPacket.fullContinuousRecording === false &&
      browserPacket.proposedSoftwareAction.nativeExecutionImplemented === false &&
      interpretation.reviewLocks.accepted === false &&
      interpretation.reviewLocks.ruleEnabled === false &&
      targetResult.softwareActionsExecuted === false &&
      targetResult.nativeUniversalExecution === false &&
      targetResult.reviewLocks.accepted === false &&
      targetResult.reviewLocks.packagingGated === true,
    evidence: JSON.stringify({
      browserLocks: browserPacket.locks,
      interpretationLocks: interpretation.reviewLocks,
      targetLocks: targetResult.reviewLocks
    })
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_transparent_overlay_browser_packet_spatial_flow_smoke_v1",
  smokeRoot,
  paths: {
    overlayHtml: overlayKit.browserOverlay,
    browserPacket: browserPacketPath,
    spatialIntent: interpretationResult.interpretationPath,
    targetConfirmation: targetResult.targetConfirmation,
    numberedOverlayPacket: targetResult.overlayPacket
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
