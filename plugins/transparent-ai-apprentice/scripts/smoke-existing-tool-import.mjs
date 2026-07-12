#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");

function run(script, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout);
}

const sessionResult = run("create-teaching-session.mjs", [
  "--name",
  "existing tool import smoke",
  "--task",
  "verify svg drawio and excalidraw imports"
]);

const fixtures = [
  {
    artifact: "plugins/transparent-ai-apprentice/assets/examples/drawing-demo.svg",
    tool: "SVG export",
    teacherAction: "Teacher drew a smooth curve between two states",
    taughtBehavior: "Preserve smooth curve intent"
  },
  {
    artifact: "plugins/transparent-ai-apprentice/assets/examples/drawio-demo.drawio",
    tool: "draw.io",
    teacherAction: "Teacher connected intent to disabled rule draft",
    taughtBehavior: "Use draw.io connectors as reviewable teaching sequence"
  },
  {
    artifact: "plugins/transparent-ai-apprentice/assets/examples/excalidraw-demo.json",
    tool: "Excalidraw",
    teacherAction: "Teacher used boxes and arrows to show the learning path",
    taughtBehavior: "Treat Excalidraw arrows as draft training flow until teacher confirms"
  },
  {
    artifact: "plugins/transparent-ai-apprentice/assets/examples/mermaid-demo.mmd",
    tool: "Mermaid",
    teacherAction: "Teacher wrote a flowchart in an existing Mermaid editor",
    taughtBehavior: "Treat Mermaid nodes and edges as a reviewable teaching sequence"
  },
  {
    artifact: "plugins/transparent-ai-apprentice/assets/examples/screen-event-log-demo.json",
    tool: "screen recording event export",
    teacherAction: "Teacher recorded a hands-on refund triage workflow",
    taughtBehavior: "Follow the demonstrated event order only after teacher review"
  }
];

const imports = fixtures.map((fixture) =>
  run("import-demonstration-artifact.mjs", [
    "--session",
    sessionResult.sessionPath,
    "--artifact",
    fixture.artifact,
    "--tool",
    fixture.tool,
    "--teacher-action",
    fixture.teacherAction,
    "--taught-behavior",
    fixture.taughtBehavior
  ])
);

const session = JSON.parse(readFileSync(sessionResult.sessionPath, "utf8"));
const checks = [
  {
    name: "All fixtures imported",
    pass: session.teacherDemonstrations?.length === fixtures.length,
    evidence: `demonstrations=${session.teacherDemonstrations?.length ?? 0}`
  },
  {
    name: "Public traces created",
    pass: session.publicTraces?.length === fixtures.length && session.publicTraces.every((trace) => trace.steps.length >= 3),
    evidence: `traces=${session.publicTraces?.length ?? 0}; steps=${session.publicTraces?.map((trace) => trace.steps.length).join(",")}`
  },
  {
    name: "Rule drafts remain disabled",
    pass:
      session.ruleDrafts?.length === fixtures.length &&
      session.ruleDrafts.every((rule) => rule.enabled === false && rule.requiresTeacherConfirmation === true),
    evidence: `ruleDrafts=${session.ruleDrafts?.length ?? 0}`
  },
  {
    name: "Shapes, connectors, and event steps extracted",
    pass: imports.every((item) => item.shapeCount > 0 && item.connectorCount > 0 && item.inferredStepCount > 0),
    evidence: imports
      .map((item) => `${item.shapeCount}/${item.connectorCount}/${item.inferredStepCount}`)
      .join("; ")
  },
  {
    name: "Screen recording event log becomes ordered teaching evidence",
    pass: imports.at(-1)?.inferredStepCount === 5 && imports.at(-1)?.shapeCount === 5,
    evidence: `screenEvent=${imports.at(-1)?.shapeCount}/${imports.at(-1)?.connectorCount}/${imports.at(-1)?.inferredStepCount}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  sessionPath: sessionResult.sessionPath,
  imports,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
