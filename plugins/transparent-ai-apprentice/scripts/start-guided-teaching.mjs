#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function words(value) {
  return (value.toLowerCase().match(/[a-z0-9_\u4e00-\u9fff-]{2,}/g) ?? []);
}

function scoreRoute(route, inputWords, extension) {
  const haystack = [
    route.id,
    ...(route.toolExamples ?? []),
    ...(route.bestFor ?? []),
    ...(route.acceptedInputs ?? [])
  ]
    .join(" ")
    .toLowerCase();
  let score = inputWords.filter((word) => haystack.includes(word)).length;
  if ([".svg", ".drawio", ".excalidraw"].includes(extension) && route.id === "existing-drawing-software") score += 6;
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension) && route.id === "existing-drawing-software") score += 4;
  if ([".csv", ".json", ".xlsx", ".md", ".txt"].includes(extension) && route.id === "existing-structured-file") score += 4;
  if (inputWords.some((word) => ["draw", "diagram", "screenshot", "whiteboard", "figma", "excalidraw", "画图", "截图", "图"].includes(word)) && route.id === "existing-drawing-software") score += 4;
  if (inputWords.some((word) => ["browser", "terminal", "editor", "workflow", "操作", "演示", "步骤"].includes(word)) && route.id === "existing-desktop-workflow") score += 3;
  return score;
}

const goal = argValue("--goal", argValue("--task", "Teach the apprentice a behavior from a direct demonstration."));
const context = argValue("--context");
const artifact = argValue("--artifact");
const preferredTool = argValue("--preferred-tool", argValue("--tool"));
const futureInput = argValue("--future-input");
const teacherMessage = argValue("--teacher-message");

const catalogPath = join(pluginRoot, "assets", "templates", "tool-adapters.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const artifactPath = artifact ? resolve(artifact) : "";
const artifactExists = artifactPath ? existsSync(artifactPath) : false;
const extension = artifactPath ? extname(artifactPath).toLowerCase() : "";
const inputWords = words([goal, context, artifactPath, preferredTool, teacherMessage].join(" "));

const routes = catalog.adapters
  .map((adapter) => ({
    ...adapter,
    score: scoreRoute(adapter, inputWords, extension)
  }))
  .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

const recommended = routes[0];
const needsArtifact = !artifactPath && !teacherMessage;
const nextMcpCall = artifactPath || teacherMessage
  ? {
      tool: "teach_by_demonstration",
      arguments: {
        name: "guided-apprentice",
        task: goal,
        ...(artifactPath ? { artifact: artifactPath, tool: preferredTool || recommended.toolExamples[0] } : {}),
        ...(teacherMessage ? { teacherMessage } : {}),
        ...(futureInput ? { futureInput } : {})
      }
    }
  : recommended.id === "existing-drawing-software"
    ? {
        tool: "create_visual_teaching_kit",
        arguments: {
          goal,
          tool: preferredTool || "draw.io or Excalidraw",
          ...(futureInput ? { futureInput } : {})
        }
      }
  : {
      tool: "teach_by_demonstration",
      argumentsNeeded: [
        "Either artifact path from an existing tool export/screenshot, or teacherMessage explaining the demonstration.",
        "Optional futureInput for replay before any memory is enabled."
      ]
    };

const result = {
  ok: true,
  format: "transparent_ai_guided_teaching_intake_v1",
  goal,
  mode: "guided_existing_tool_first",
  recommendedRoute: {
    id: recommended.id,
    toolExamples: recommended.toolExamples,
    acceptedInputs: recommended.acceptedInputs,
    proofNeeded: recommended.proofNeeded,
    nativeIntegrationRequired: recommended.nativeIntegrationRequired
  },
  routeOptions: routes.map((route) => ({
    id: route.id,
    score: route.score,
    bestFor: route.bestFor,
    acceptedInputs: route.acceptedInputs,
    nativeIntegrationRequired: route.nativeIntegrationRequired
  })),
  artifactStatus: artifactPath
    ? {
        path: artifactPath,
        exists: artifactExists,
        extension,
        nextAction: artifactExists
          ? "Use this artifact as demonstration evidence."
          : "Ask the teacher to provide an existing exported file or screenshot path that exists."
      }
    : {
        path: "",
        exists: false,
        extension: "",
        nextAction: "Ask the teacher for a screenshot, drawing export, structured file, or short correction message."
      },
  teacherFacingPrompt: needsArtifact
    ? "Show one example with an existing tool, export or screenshot it, then give that file path. For visual teaching, I can first create a draw.io, Excalidraw, and Mermaid starter kit. If no file is available, explain what you did and what the apprentice got wrong."
    : "I have enough to start a review-only teaching draft. I will create a session, capture the evidence, and replay before enabling memory.",
  nextMcpCall,
  locks: {
    ruleEnabled: false,
    accepted: false,
    requiresTeacherConfirmation: true,
    packagingGated: true
  }
};

console.log(JSON.stringify(result, null, 2));
