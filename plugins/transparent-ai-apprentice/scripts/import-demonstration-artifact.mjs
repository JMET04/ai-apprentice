#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withFileLock(targetPath, operation) {
  const lockPath = `${targetPath}.lock`;
  let handle;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = openSync(lockPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(50);
    }
  }
  if (handle === undefined) {
    throw new Error(`Could not acquire session lock: ${lockPath}`);
  }

  try {
    return operation();
  } finally {
    closeSync(handle);
    rmSync(lockPath, { force: true });
  }
}

function writeJsonAtomic(path, value) {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

function wordsFromText(value) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9_\u4e00-\u9fff-]{2,}/g) ?? []).slice(0, 40))];
}

function decodeXmlValue(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function attributeValue(source, name) {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeXmlValue(match[1]) : "";
}

function inferShapeKind(tag, source = "") {
  const style = attributeValue(source, "style").toLowerCase();
  if (tag === "path" || style.includes("curved") || style.includes("curve")) return "curve_or_path";
  if (tag === "line" || tag === "polyline" || style.includes("edge")) return "connector";
  if (tag === "ellipse" || style.includes("ellipse")) return "ellipse";
  if (tag === "rect" || style.includes("rounded")) return "box";
  if (tag === "mxCell" && attributeValue(source, "edge") === "1") return "connector";
  if (tag === "mxCell" && attributeValue(source, "vertex") === "1") return "shape";
  return tag;
}

function orderedStepsFromLabels(labels) {
  return labels.map((label, index) => ({
    order: index + 1,
    label,
    inferredRole: index === 0 ? "start_or_input" : index === labels.length - 1 ? "target_or_output" : "intermediate"
  }));
}

function extractSvgSignals(text) {
  const tags = [...text.matchAll(/<([a-zA-Z][\w:-]*)\b/g)].map((match) => match[1].toLowerCase());
  const uniqueTags = [...new Set(tags)];
  const textLabels = [...text.matchAll(/>([^<>]{2,80})</g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 20);
  const shapeMatches = [...text.matchAll(/<(rect|circle|ellipse|line|polyline|polygon|path)\b([^>]*)/gi)];
  const shapes = shapeMatches.map((match, index) => ({
    id: attributeValue(match[2], "id") || `svg-shape-${index + 1}`,
    kind: inferShapeKind(match[1].toLowerCase(), match[2]),
    rawTag: match[1].toLowerCase()
  }));
  const connectors = shapes.filter((shape) => ["connector", "curve_or_path"].includes(shape.kind));
  return {
    type: "svg",
    tags: uniqueTags.slice(0, 30),
    textLabels,
    shapes,
    connectors,
    orderedSteps: orderedStepsFromLabels(textLabels),
    cues: [
      ...uniqueTags.slice(0, 12),
      ...wordsFromText(textLabels.join(" ")).slice(0, 12),
      ...[...new Set(shapes.map((shape) => shape.kind))]
    ]
  };
}

function extractDrawioSignals(text) {
  const cells = [...text.matchAll(/<mxCell\b[^>]*>/gi)].map((match, index) => {
    const raw = match[0];
    return {
      id: attributeValue(raw, "id") || `mxcell-${index + 1}`,
      value: attributeValue(raw, "value"),
      source: attributeValue(raw, "source"),
      target: attributeValue(raw, "target"),
      edge: attributeValue(raw, "edge") === "1",
      vertex: attributeValue(raw, "vertex") === "1",
      kind: inferShapeKind("mxCell", raw),
      style: attributeValue(raw, "style")
    };
  });
  const labels = cells.map((cell) => cell.value).filter(Boolean);
  const connectors = cells
    .filter((cell) => cell.edge || cell.source || cell.target)
    .map((cell) => ({
      id: cell.id,
      source: cell.source,
      target: cell.target,
      label: cell.value,
      curved: cell.style.toLowerCase().includes("curved")
    }));
  const shapes = cells
    .filter((cell) => cell.vertex || (!cell.edge && cell.value))
    .map((cell) => ({
      id: cell.id,
      label: cell.value,
      kind: cell.kind,
      style: cell.style
    }));

  return {
    type: "drawio",
    cells: cells.length,
    shapes,
    connectors,
    textLabels: labels,
    orderedSteps: orderedStepsFromLabels(labels),
    cues: [
      "drawio",
      ...wordsFromText(labels.join(" ")),
      ...connectors.map((connector) => (connector.curved ? "curved-connector" : "connector")),
      ...[...new Set(shapes.map((shape) => shape.kind))]
    ]
  };
}

function extractExcalidrawSignals(parsed) {
  const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  const textLabels = elements
    .filter((element) => element.type === "text" && element.text)
    .map((element) => element.text.trim())
    .filter(Boolean);
  const shapes = elements
    .filter((element) => element.type !== "text")
    .map((element) => ({
      id: element.id,
      kind: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height
    }));
  const connectors = elements
    .filter((element) => ["arrow", "line"].includes(element.type))
    .map((element) => ({
      id: element.id,
      kind: element.type,
      startBinding: element.startBinding?.elementId ?? "",
      endBinding: element.endBinding?.elementId ?? ""
    }));

  return {
    type: "excalidraw",
    elementCount: elements.length,
    shapes,
    connectors,
    textLabels,
    orderedSteps: orderedStepsFromLabels(textLabels),
    cues: [
      "excalidraw",
      ...wordsFromText(textLabels.join(" ")),
      ...[...new Set(shapes.map((shape) => shape.kind))],
      ...connectors.map((connector) => connector.kind)
    ]
  };
}

function parseMermaidSide(value = "") {
  const cleaned = value
    .replace(/\|[^|]*\|/g, " ")
    .replace(/:::.*$/g, "")
    .trim();
  const match = cleaned.match(/^([A-Za-z0-9_-]+)\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\}|>"([^"]+)"\])?/);
  if (!match) return null;
  const label = (match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[1]).replace(/^"|"$/g, "").trim();
  return { id: match[1], label };
}

function extractMermaidSignals(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/%%.*$/, "").trim())
    .filter(Boolean);
  const direction = lines.find((line) => /^(graph|flowchart)\b/i.test(line)) ?? "";
  const nodes = new Map();
  const connectors = [];

  for (const line of lines) {
    const edgeMatch = line.match(/(.+?)(-->|---|==>|-.->|--x|--o)(.+)/);
    if (edgeMatch) {
      const source = parseMermaidSide(edgeMatch[1]);
      const target = parseMermaidSide(edgeMatch[3]);
      const label = edgeMatch[3].match(/\|([^|]+)\|/)?.[1] ?? "";
      if (source) nodes.set(source.id, source);
      if (target) nodes.set(target.id, target);
      connectors.push({
        id: `mermaid-edge-${connectors.length + 1}`,
        source: source?.id ?? "",
        target: target?.id ?? "",
        label,
        kind: edgeMatch[2]
      });
      continue;
    }

    const node = parseMermaidSide(line);
    if (node && !/^(graph|flowchart|subgraph|end|classDef|class)\b/i.test(line)) {
      nodes.set(node.id, node);
    }
  }

  const shapes = [...nodes.values()].map((node) => ({
    id: node.id,
    label: node.label,
    kind: "mermaid_node"
  }));
  const textLabels = shapes.map((shape) => shape.label).filter(Boolean);

  return {
    type: "mermaid",
    direction,
    shapes,
    connectors,
    textLabels,
    orderedSteps: orderedStepsFromLabels(textLabels),
    cues: [
      "mermaid",
      "diagram-as-code",
      ...wordsFromText(textLabels.join(" ")),
      ...connectors.map((connector) => (connector.label ? `connector-${connector.label}` : "connector"))
    ]
  };
}

function extractCaptureSignals(parsed) {
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  const evidenceText = evidence
    .map((item) => [item.role, item.name, item.path].filter(Boolean).join(" "))
    .join(" ");
  return {
    type: "demonstration_capture",
    captureId: parsed.captureId ?? "",
    goal: parsed.goal ?? "",
    tool: parsed.tool ?? "existing-tool",
    teacherAction: parsed.teacherAction ?? "",
    taughtBehavior: parsed.taughtBehavior ?? "",
    evidence: evidence.map((item) => ({
      order: item.order,
      name: item.name,
      path: item.path,
      role: item.role,
      exists: item.exists === true
    })),
    textLabels: [parsed.goal, parsed.teacherAction, parsed.taughtBehavior, parsed.note].filter(Boolean),
    orderedSteps: evidence.map((item, index) => ({
      order: item.order ?? index + 1,
      label: item.name || item.path || `evidence-${index + 1}`,
      inferredRole: item.role || (index === 0 ? "starting_evidence" : "supporting_evidence")
    })),
    cues: [
      "demonstration-capture",
      parsed.tool ?? "existing-tool",
      ...wordsFromText([parsed.goal, parsed.teacherAction, parsed.taughtBehavior, parsed.note, evidenceText].join(" "))
    ]
  };
}

function extractExampleSignals(parsed) {
  const examples = Array.isArray(parsed.examples) ? parsed.examples : [];
  const labels = [
    parsed.goal,
    parsed.teacherAction,
    parsed.taughtBehavior,
    ...examples.flatMap((example) => [
      `before: ${example.before ?? ""}`,
      `after: ${example.after ?? ""}`,
      example.teacherNote ?? ""
    ])
  ].filter(Boolean);
  return {
    type: "before_after_examples",
    artifactId: parsed.artifactId ?? "",
    goal: parsed.goal ?? "",
    tool: parsed.tool ?? "before-after-examples",
    teacherAction: parsed.teacherAction ?? "",
    taughtBehavior: parsed.taughtBehavior ?? "",
    exampleCount: examples.length,
    examples: examples.map((example, index) => ({
      order: example.order ?? index + 1,
      before: example.before ?? "",
      after: example.after ?? "",
      teacherNote: example.teacherNote ?? ""
    })),
    textLabels: labels,
    orderedSteps: examples.flatMap((example, index) => [
      {
        order: index * 2 + 1,
        label: `before ${index + 1}: ${example.before ?? ""}`,
        inferredRole: "input_example"
      },
      {
        order: index * 2 + 2,
        label: `after ${index + 1}: ${example.after ?? ""}`,
        inferredRole: "expected_output"
      }
    ]),
    cues: [
      "before-after-examples",
      parsed.tool ?? "examples",
      ...wordsFromText(labels.join(" "))
    ]
  };
}

function extractActionSequenceSignals(parsed) {
  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const labels = [
    parsed.goal,
    parsed.context,
    parsed.teacherAction,
    parsed.taughtBehavior,
    ...steps.flatMap((step) => [step.actionType, step.instruction, step.teacherNote])
  ].filter(Boolean);
  return {
    type: "action_sequence",
    artifactId: parsed.artifactId ?? "",
    goal: parsed.goal ?? "",
    tool: parsed.tool ?? "manual-action-sequence",
    context: parsed.context ?? "",
    teacherAction: parsed.teacherAction ?? "",
    taughtBehavior: parsed.taughtBehavior ?? "",
    stepCount: steps.length,
    actionSteps: steps.map((step, index) => ({
      order: step.order ?? index + 1,
      actionType: step.actionType ?? "action",
      instruction: step.instruction ?? "",
      teacherNote: step.teacherNote ?? ""
    })),
    textLabels: labels,
    orderedSteps: steps.map((step, index) => ({
      order: step.order ?? index + 1,
      label: `${step.actionType ?? "action"}: ${step.instruction ?? ""}`,
      inferredRole: index === 0 ? "start_or_setup" : index === steps.length - 1 ? "target_or_commit" : "intermediate_action"
    })),
    cues: [
      "action-sequence",
      parsed.tool ?? "manual-action-sequence",
      ...steps.map((step) => step.actionType ?? "action"),
      ...wordsFromText(labels.join(" "))
    ]
  };
}

function eventActionText(event) {
  return String(
    event.action ??
      event.type ??
      event.eventType ??
      event.name ??
      event.kind ??
      event.command ??
      "action"
  ).toLowerCase();
}

function eventTargetText(event) {
  return [
    event.label,
    event.text,
    event.value,
    event.selector,
    event.target,
    event.url,
    event.page,
    event.screen,
    event.note
  ]
    .filter(Boolean)
    .join(" ");
}

function eventInstruction(event, index) {
  const action = eventActionText(event);
  const target = eventTargetText(event);
  return target ? `${action}: ${target}` : `${action} ${index + 1}`;
}

function extractScreenEventLogSignals(parsed) {
  const rawEvents = parsed.events ?? parsed.userEvents ?? parsed.steps ?? parsed.actions ?? [];
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const actionSteps = events.map((event, index) => ({
    order: event.order ?? event.index ?? index + 1,
    actionType: eventActionText(event),
    instruction: eventInstruction(event, index),
    target: event.selector ?? event.target ?? event.label ?? "",
    value: event.value ?? event.text ?? "",
    url: event.url ?? event.page ?? "",
    timestamp: event.timestamp ?? event.time ?? ""
  }));
  const textLabels = [
    parsed.goal,
    parsed.task,
    parsed.summary,
    parsed.teacherAction,
    parsed.taughtBehavior,
    ...actionSteps.flatMap((step) => [step.actionType, step.instruction, step.target, step.url])
  ].filter(Boolean);
  const connectors = actionSteps.slice(1).map((step, index) => ({
    id: `event-transition-${index + 1}`,
    source: `event-${index + 1}`,
    target: `event-${index + 2}`,
    label: "then"
  }));

  return {
    type: "screen_event_log",
    sourceTool: parsed.sourceTool ?? parsed.tool ?? "screen-recording-or-event-log",
    recordingUrl: parsed.recordingUrl ?? parsed.url ?? "",
    eventCount: actionSteps.length,
    actionSteps,
    textLabels,
    shapes: actionSteps.map((step) => ({
      id: `event-${step.order}`,
      label: step.instruction,
      kind: "user_event"
    })),
    connectors,
    orderedSteps: actionSteps.map((step, index) => ({
      order: step.order,
      label: step.instruction,
      inferredRole: index === 0 ? "start_or_setup" : index === actionSteps.length - 1 ? "target_or_validation" : "intermediate_action"
    })),
    cues: [
      "screen-event-log",
      parsed.sourceTool ?? parsed.tool ?? "recording",
      ...actionSteps.map((step) => step.actionType),
      ...wordsFromText(textLabels.join(" "))
    ]
  };
}

function extractTextSignals(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);
  return {
    type: "text",
    lines,
    cues: wordsFromText(lines.join(" "))
  };
}

function extractArtifactSignals(path) {
  const extension = extname(path).toLowerCase();
  const binaryLike = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".pptx", ".docx", ".xlsx"];
  if (binaryLike.includes(extension)) {
    return {
      type: "binary_artifact",
      cues: [extension.slice(1), "visual-reference", "teacher-review-needed"],
      note: "Binary artifact is registered as evidence; add a screenshot description or exported text/SVG for richer cue extraction."
    };
  }

  const text = readFileSync(path, "utf8");
  if (extension === ".mmd" || extension === ".mermaid" || /^(graph|flowchart)\b/im.test(text)) {
    return extractMermaidSignals(text);
  }

  if (extension === ".drawio" || text.includes("<mxfile") || text.includes("<mxCell")) {
    return extractDrawioSignals(text);
  }

  if (extension === ".svg") {
    return extractSvgSignals(text);
  }

  if (extension === ".json") {
    const parsed = JSON.parse(text);
    if (parsed.format === "transparent_ai_action_sequence_v1") {
      return extractActionSequenceSignals(parsed);
    }
    if (
      parsed.format === "transparent_ai_screen_event_log_v1" ||
      Array.isArray(parsed.events) ||
      Array.isArray(parsed.userEvents)
    ) {
      return extractScreenEventLogSignals(parsed);
    }
    if (parsed.format === "transparent_ai_before_after_examples_v1") {
      return extractExampleSignals(parsed);
    }
    if (parsed.format === "transparent_ai_demonstration_capture_v1") {
      return extractCaptureSignals(parsed);
    }
    if (Array.isArray(parsed.elements) || parsed.type === "excalidraw") {
      return extractExcalidrawSignals(parsed);
    }
    return {
      type: "json",
      topLevelKeys: Object.keys(parsed).slice(0, 30),
      cues: wordsFromText(JSON.stringify(parsed).slice(0, 8000))
    };
  }

  return extractTextSignals(text);
}

const rawSessionPath = argValue("--session");
const rawArtifactPath = argValue("--artifact");

if (!rawSessionPath || !rawArtifactPath) {
  throw new Error("Usage: node import-demonstration-artifact.mjs --session <session.json> --artifact <file> [--tool draw.io] [--teacher-action ...]");
}

const sessionPath = resolve(rawSessionPath);
const artifactPath = resolve(rawArtifactPath);
const tool = argValue("--tool", "existing-tool");
const teacherAction = argValue("--teacher-action", "Teacher provided a demonstration artifact.");
const taughtBehavior = argValue("--taught-behavior", "Extract reusable behavior from the demonstration.");

if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}
if (!existsSync(artifactPath)) {
  throw new Error(`Artifact not found: ${artifactPath}`);
}

const signals = extractArtifactSignals(artifactPath);
const demonstrationId = `demo-${Date.now()}`;
const traceId = `trace-${Date.now()}`;
const ruleId = `rule-draft-${Date.now()}`;

const demonstration = {
  id: demonstrationId,
  tool,
  artifactPath,
  artifactName: basename(artifactPath),
  teacherAction,
  taughtBehavior,
  extractedSignals: signals,
  reviewStatus: "needs_teacher_review"
};

const publicTrace = {
  format: "transparent_ai_public_trace_v1",
  traceId,
  sourceDemonstrationId: demonstrationId,
  steps: [
    {
      step: "register demonstration artifact",
      inputObserved: `${tool}: ${artifactPath}`,
      ruleCandidates: [],
      actionProposed: "Use the artifact as teacher evidence, not automatic acceptance.",
      confidence: "medium",
      validation: "artifact path exists",
      teacherReviewPoint: "Confirm this artifact represents the behavior to learn.",
      memoryEffect: "none"
    },
    {
      step: "extract visible cues",
      inputObserved: JSON.stringify(signals).slice(0, 1200),
      ruleCandidates: [],
      actionProposed: "Convert observed cues into a disabled rule draft with counterexample review.",
      confidence: signals.cues.length > 0 ? "medium" : "low",
      validation: `cues=${signals.cues.length}`,
      teacherReviewPoint: "Remove cues that are accidental or too broad.",
      memoryEffect: "candidate only"
    },
    {
      step: "infer demonstration structure",
      inputObserved: JSON.stringify({
        type: signals.type,
        labels: signals.textLabels ?? [],
        connectors: signals.connectors ?? [],
        orderedSteps: signals.orderedSteps ?? []
      }).slice(0, 1200),
      ruleCandidates: [],
      actionProposed: "Use labels, shapes, and connectors as a reviewable teaching sequence.",
      confidence: (signals.connectors?.length ?? 0) > 0 || (signals.orderedSteps?.length ?? 0) > 1 ? "medium" : "low",
      validation: `shapes=${signals.shapes?.length ?? 0}; connectors=${signals.connectors?.length ?? 0}; steps=${signals.orderedSteps?.length ?? 0}`,
      teacherReviewPoint: "Confirm the inferred order and connector meaning before enabling any memory.",
      memoryEffect: "draft structure only"
    }
  ]
};

const ruleDraft = {
  format: "transparent_ai_rule_memory_draft_v1",
  id: ruleId,
  condition: signals.cues.length
    ? `When future input matches teacher-confirmed cues: ${signals.cues.slice(0, 8).join(", ")}`
    : "When teacher later supplies confirmed cues for this artifact",
  action: taughtBehavior,
  counterexamples: ["Do not apply when similar visuals are decorative or the teacher marks the case as different."],
  sourceEvidence: [artifactPath, demonstrationId, traceId],
  confidence: signals.cues.length > 2 ? "medium" : "low",
  enabled: false,
  requiresTeacherConfirmation: true,
  reviewStatus: "needs_teacher_review"
};

mkdirSync(join(process.cwd(), ".transparent-apprentice", "sessions"), { recursive: true });
withFileLock(sessionPath, () => {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  session.teacherDemonstrations = [...(session.teacherDemonstrations ?? []), demonstration];
  session.publicTraces = [...(session.publicTraces ?? []), publicTrace];
  session.ruleDrafts = [...(session.ruleDrafts ?? []), ruleDraft];
  session.nextReplayPlan = [
    ...(session.nextReplayPlan ?? []),
    {
      sourceRuleDraftId: ruleId,
      action: "Replay a small future task using this disabled draft and ask the teacher whether the behavior matches.",
      ruleEnabled: false,
      requiresTeacherConfirmation: true
    }
  ];
  writeJsonAtomic(sessionPath, session);
});

console.log(
  JSON.stringify(
    {
      ok: true,
      sessionPath,
      demonstrationId,
      traceId,
      ruleDraftId: ruleId,
      extractedCueCount: signals.cues.length,
      shapeCount: signals.shapes?.length ?? 0,
      connectorCount: signals.connectors?.length ?? 0,
      inferredStepCount: signals.orderedSteps?.length ?? 0,
      ruleEnabled: false,
      requiresTeacherConfirmation: true
    },
    null,
    2
  )
);
