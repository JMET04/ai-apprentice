#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "visual-teaching-kit";
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

const goal = argValue("--goal", argValue("--task", "Teach the apprentice from an existing visual tool."));
const preferredTool = argValue("--tool", "draw.io, Excalidraw, or Mermaid");
const futureInput = argValue("--future-input");
const teacherAction = argValue("--teacher-action", "Teacher demonstrates the intended behavior in an existing visual tool.");
const taughtBehavior = argValue("--taught-behavior", "Apply the teacher-demonstrated visual behavior only after review.");
const outputRoot = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "visual-kits"));

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const template = runNodeScript("create-visual-teaching-template.mjs", [
  "--goal",
  goal,
  "--tool",
  preferredTool,
  "--output-dir",
  kitDir,
  ...(futureInput ? ["--future-input", futureInput] : [])
]);

const catalog = JSON.parse(readFileSync(join(pluginRoot, "assets", "templates", "tool-adapters.json"), "utf8"));
const visualAdapter = catalog.adapters.find((adapter) => adapter.id === "existing-drawing-software");
const demonstrationAdapter = catalog.adapters.find((adapter) => adapter.id === "existing-screen-recording-event-log");

const teacherChecklist = [
  "Open one generated template in an existing tool the teacher already knows.",
  "Replace the placeholders with the real before state, demonstrated action, correct result, and boundary.",
  "Add at least one counterexample or do-not-generalize note before asking the apprentice to learn.",
  "Save or export the edited diagram, screenshot, or event log.",
  "Return the edited file path, screenshot path, or pasted screen events to continue_teaching."
];

const nextMcpCalls = [
  {
    when: "The teacher edited and saved one or more visual files.",
    tool: "continue_teaching",
    arguments: {
      goal,
      tool: preferredTool,
      files: ["<edited draw.io, Excalidraw, Mermaid, screenshot, or export path>"],
      teacherAction,
      taughtBehavior,
      ...(futureInput ? { futureInput } : {})
    }
  },
  {
    when: "The teacher pasted browser, recorder, Jam-style, or Playwright-style events instead of saving a file.",
    tool: "continue_teaching",
    arguments: {
      goal,
      tool: "screen events",
      screenEvents: [{ type: "click", target: "<what the teacher clicked>", note: "<why it mattered>" }],
      teacherAction,
      taughtBehavior,
      ...(futureInput ? { futureInput } : {})
    }
  },
  {
    when: "The teacher reviewed the replay and replies naturally.",
    tool: "continue_teaching",
    arguments: {
      teacherResponse: "<teacher says approval, correction, or asks to clarify>"
    }
  }
];

const kitPath = join(kitDir, `${kitId}.kit.json`);
const readmePath = join(kitDir, "TEACHER_START_HERE.md");
const kit = {
  ok: true,
  format: "transparent_ai_visual_teaching_kit_v1",
  kitId,
  goal,
  preferredTool,
  kitDir,
  files: {
    teacherReadme: readmePath,
    templateManifest: template.manifestPath,
    ...template.files
  },
  adapterStrategy: {
    principle: catalog.principle,
    primaryAdapter: visualAdapter,
    fallbackAdapter: demonstrationAdapter,
    nativeIntegrationRequired: false
  },
  teacherChecklist,
  nextMcpCalls,
  locks: {
    ruleEnabled: false,
    accepted: false,
    requiresTeacherConfirmation: true,
    packagingGated: true,
    technologyAccepted: false
  }
};

const readme = `# Transparent AI Apprentice Visual Teaching Kit

Goal: ${goal}

Use an existing tool first. Open one generated template in draw.io, Excalidraw, Mermaid, PowerPoint, Figma, or a whiteboard-like editor.

## Teacher Checklist

${teacherChecklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Generated Templates

- draw.io: ${template.files.drawio}
- Excalidraw: ${template.files.excalidraw}
- Mermaid: ${template.files.mermaid}

## Continue In Codex

After editing, call \`continue_teaching\` with the edited file path or pasted screen events. The plugin will create review-only evidence, public trace rows, disabled rule drafts, and a replay before any memory is enabled.

Rules stay locked until the teacher explicitly approves a replay.
`;

writeFileSync(kitPath, `${JSON.stringify(kit, null, 2)}\n`, "utf8");
writeFileSync(readmePath, readme, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_visual_teaching_kit_result_v1",
      kitId,
      kitPath,
      teacherReadme: readmePath,
      files: kit.files,
      teacherChecklist,
      nextMcpCalls,
      locks: kit.locks
    },
    null,
    2
  )
);
