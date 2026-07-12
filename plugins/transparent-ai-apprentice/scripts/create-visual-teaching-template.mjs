#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "visual-teaching-template";
}

function xmlEscape(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function excalidrawText(id, text, x, y, width = 360) {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height: 48,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1000 + id.length,
    versionNonce: 2000 + id.length,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text,
    fontSize: 20,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: text,
    lineHeight: 1.25
  };
}

function excalidrawRect(id, x, y, width, height) {
  return {
    id,
    type: "rectangle",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: 3000 + id.length,
    versionNonce: 4000 + id.length,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false
  };
}

function excalidrawArrow(id, x, y, width) {
  return {
    id,
    type: "arrow",
    x,
    y,
    width,
    height: 0,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: 5000 + id.length,
    versionNonce: 6000 + id.length,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    points: [
      [0, 0],
      [width, 0]
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow"
  };
}

function createDrawioTemplate({ goal, futureInput }) {
  const labels = [
    `Teaching goal: ${goal}`,
    "Before state: replace this with what the apprentice sees first",
    "Teacher action: replace this with what you do or select",
    "Correct result: replace this with the expected output",
    "Do not generalize: add a counterexample or boundary",
    `Replay example: ${futureInput || "add one similar future input to test before enabling memory"}`
  ];
  const cells = labels
    .map((label, index) => {
      const id = `step-${index + 1}`;
      const x = 40 + (index % 3) * 260;
      const y = 80 + Math.floor(index / 3) * 170;
      return `        <mxCell id="${id}" value="${xmlEscape(label)}" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="220" height="90" as="geometry"/></mxCell>`;
    })
    .join("\n");
  const edges = [
    ["edge-1", "step-1", "step-2", "observe"],
    ["edge-2", "step-2", "step-3", "act"],
    ["edge-3", "step-3", "step-4", "verify"],
    ["edge-4", "step-4", "step-5", "boundary"],
    ["edge-5", "step-5", "step-6", "replay"]
  ]
    .map(
      ([id, source, target, label]) =>
        `        <mxCell id="${id}" value="${label}" style="endArrow=classic;html=1;rounded=0;" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Transparent AI Apprentice">
  <diagram name="Teaching Template">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells}
${edges}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

function createExcalidrawTemplate({ goal, futureInput }) {
  const labels = [
    `Teaching goal: ${goal}`,
    "Before state: replace this with what the apprentice sees first",
    "Teacher action: replace this with what you do or select",
    "Correct result: replace this with the expected output",
    "Do not generalize: add a counterexample or boundary",
    `Replay example: ${futureInput || "add one similar future input to test before enabling memory"}`
  ];
  const elements = [];
  labels.forEach((label, index) => {
    const x = 40 + (index % 3) * 330;
    const y = 80 + Math.floor(index / 3) * 190;
    elements.push(excalidrawRect(`box-${index + 1}`, x, y, 280, 120));
    elements.push(excalidrawText(`text-${index + 1}`, label, x + 18, y + 24, 240));
    if (index < labels.length - 1) {
      const arrowX = x + 285;
      const arrowY = y + 60;
      elements.push(excalidrawArrow(`arrow-${index + 1}`, arrowX, arrowY, index === 2 ? -610 : 40));
    }
  });

  return {
    type: "excalidraw",
    version: 2,
    source: "transparent-ai-apprentice",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      currentItemStrokeColor: "#1e1e1e",
      currentItemBackgroundColor: "transparent",
      currentItemFillStyle: "solid",
      currentItemStrokeWidth: 2,
      currentItemStrokeStyle: "solid",
      currentItemRoughness: 1,
      currentItemOpacity: 100
    },
    files: {}
  };
}

function createMermaidTemplate({ goal, futureInput }) {
  return `flowchart LR
  A["Teaching goal: ${goal.replace(/"/g, "'")}"]
  B["Before state: replace this with what the apprentice sees first"]
  C["Teacher action: replace this with what you do or select"]
  D["Correct result: replace this with the expected output"]
  E["Do not generalize: add a counterexample or boundary"]
  F["Replay example: ${(futureInput || "add one similar future input to test before enabling memory").replace(/"/g, "'")}"]
  A -->|observe| B
  B -->|act| C
  C -->|verify| D
  D -->|boundary| E
  E -->|replay| F
`;
}

const goal = argValue("--goal", argValue("--task", "Teach the apprentice from a visual demonstration."));
const preferredTool = argValue("--tool", "draw.io, Excalidraw, or Mermaid");
const futureInput = argValue("--future-input");
const outputDir = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "visual-templates"));

if (!goal) {
  throw new Error("Usage: node create-visual-teaching-template.mjs --goal <teaching goal>");
}

mkdirSync(outputDir, { recursive: true });
const templateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const drawioPath = join(outputDir, `${templateId}.drawio`);
const excalidrawPath = join(outputDir, `${templateId}.excalidraw.json`);
const mermaidPath = join(outputDir, `${templateId}.mmd`);
const manifestPath = join(outputDir, `${templateId}.manifest.json`);

writeFileSync(drawioPath, createDrawioTemplate({ goal, futureInput }), "utf8");
writeFileSync(excalidrawPath, `${JSON.stringify(createExcalidrawTemplate({ goal, futureInput }), null, 2)}\n`, "utf8");
writeFileSync(mermaidPath, createMermaidTemplate({ goal, futureInput }), "utf8");

const manifest = {
  format: "transparent_ai_visual_teaching_template_v1",
  templateId,
  goal,
  preferredTool,
  files: {
    drawio: drawioPath,
    excalidraw: excalidrawPath,
    mermaid: mermaidPath
  },
  teacherSteps: [
    "Open a template in draw.io, Excalidraw, or any Mermaid-compatible editor.",
    "Replace each placeholder with the real before state, teacher action, correct result, boundary, and replay example.",
    "Save or export the edited file.",
    "Use create_demonstration_capture or teach_by_demonstration with the edited artifact path."
  ],
  nextMcpCallAfterTeacherEdits: {
    tool: "create_demonstration_capture",
    argumentsNeeded: [
      "goal",
      "tool",
      "files: the edited draw.io, Excalidraw, Mermaid, screenshot, or export path",
      "teacherAction",
      "taughtBehavior",
      "futureInput"
    ]
  },
  locks: {
    ruleEnabled: false,
    accepted: false,
    requiresTeacherConfirmation: true,
    packagingGated: true
  }
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_visual_teaching_template_result_v1",
      templateId,
      manifestPath,
      files: manifest.files,
      teacherSteps: manifest.teacherSteps,
      nextMcpCallAfterTeacherEdits: manifest.nextMcpCallAfterTeacherEdits,
      locks: manifest.locks
    },
    null,
    2
  )
);
