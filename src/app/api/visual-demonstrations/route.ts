import { NextResponse } from "next/server";
import { demoApprentice, demoTask } from "@/lib/demo-data";
import type { VisualCueAnnotation, VisualDemonstrationArtifact } from "@/lib/types";
import { extractRuleFromVisualDemonstration } from "@/server/corrections/visual-demo-extractor";
import { memoryStore } from "@/server/memory/memory-store";

function splitLines(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const fallbackRegions = [
  { x: 72, y: 18, width: 14, height: 18 },
  { x: 34, y: 48, width: 18, height: 18 },
  { x: 12, y: 62, width: 22, height: 14 },
  { x: 52, y: 64, width: 24, height: 14 }
];

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, value));
}

function parseRegion(value: string | undefined, index: number) {
  const fallback = fallbackRegions[index % fallbackRegions.length];
  const [x, y, width, height] = (value ?? "")
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

  return {
    x: clampPercent(x ?? fallback.x, fallback.x),
    y: clampPercent(y ?? fallback.y, fallback.y),
    width: clampPercent(width ?? fallback.width, fallback.width),
    height: clampPercent(height ?? fallback.height, fallback.height)
  };
}

function parseVisualAnnotations(value: string | undefined, visualCues: string[]): VisualCueAnnotation[] {
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return visualCues.slice(0, 4).map((cue, index) => ({
      id: `annotation-${index + 1}`,
      label: `Cue ${index + 1}`,
      cue,
      evidence: "Teacher supplied this visual cue for the reference frame.",
      region: parseRegion(undefined, index),
      confidence: 0.74
    }));
  }

  return lines.map((line, index) => {
    const [label, cue, evidence, region, confidence] = line.split("|").map((item) => item.trim());

    return {
      id: `annotation-${index + 1}`,
      label: label || `Cue ${index + 1}`,
      cue: cue || visualCues[index] || "visual cue",
      evidence: evidence || "Teacher grounded this cue in the reference frame.",
      region: parseRegion(region, index),
      confidence: Math.min(1, Math.max(0, Number(confidence) || 0.78))
    };
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    referenceImageUrl?: string;
    sceneDescription?: string;
    visualCues?: string;
    visualAnnotations?: string;
    lightingSignals?: string;
    expectedPhotographyAdvice?: string;
    teacherNotes?: string;
    apprenticeId?: string;
    taskId?: string;
  };

  if (!body.title?.trim() || !body.sceneDescription?.trim() || !body.teacherNotes?.trim()) {
    return NextResponse.json(
      { error: "Title, scene description, and teacher notes are required." },
      { status: 400 }
    );
  }

  const task = body.taskId ? await memoryStore.getTaskProfile(body.taskId) : null;
  if (body.taskId && !task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const apprenticeId = body.apprenticeId ?? task?.apprenticeId ?? demoApprentice.id;
  const taskId = task?.id ?? body.taskId ?? demoTask.id;

  if (task && task.apprenticeId !== apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const artifact: VisualDemonstrationArtifact = {
    referenceImageUrl: body.referenceImageUrl?.trim() || undefined,
    sceneDescription: body.sceneDescription.trim(),
    visualCues: splitLines(body.visualCues),
    lightingSignals: splitLines(body.lightingSignals),
    expectedPhotographyAdvice: splitLines(body.expectedPhotographyAdvice),
    annotations: parseVisualAnnotations(body.visualAnnotations, splitLines(body.visualCues))
  };
  const extraction = extractRuleFromVisualDemonstration({
    artifact,
    apprenticeId,
    taskId,
    title: body.title.trim()
  });

  await memoryStore.saveRule(extraction.extractedRule);
  const demonstration = await memoryStore.saveVisualDemonstration({
    id: `visual-demo-${Date.now()}`,
    apprenticeId,
    taskId,
    title: body.title.trim(),
    artifact,
    teacherNotes: body.teacherNotes.trim(),
    extractedRule: extraction.extractedRule,
    learningTrace: extraction.learningTrace,
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({
    demonstration,
    extraction
  });
}
