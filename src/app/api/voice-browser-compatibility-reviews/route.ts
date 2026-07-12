import { NextResponse } from "next/server";
import {
  buildVoiceBrowserCompatibilityReviewRecord,
  type AIVoiceBrowserCompatibilityCase
} from "@/lib/human-knowledge-teaching";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

const browserNames = new Set<AIVoiceBrowserCompatibilityCase["browser"]>(["Chrome", "Edge", "Safari", "Firefox"]);

function normalizeBrowser(value: unknown): AIVoiceBrowserCompatibilityCase["browser"] | null {
  return typeof value === "string" && browserNames.has(value as AIVoiceBrowserCompatibilityCase["browser"])
    ? (value as AIVoiceBrowserCompatibilityCase["browser"])
    : null;
}

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    browser?: string;
    platformScope?: string;
    speechRecognitionAvailable?: boolean;
    speechSynthesisAvailable?: boolean;
    voiceCount?: number;
    chineseVoiceCount?: number;
    selectedVoiceName?: string;
    transcriptFallbackTested?: boolean;
    teacherNote?: string;
  };
  const browser = normalizeBrowser(body.browser);

  if (!body.apprenticeId || !body.taskId) {
    return NextResponse.json({ error: "apprenticeId and taskId are required." }, { status: 400 });
  }

  if (!browser) {
    return NextResponse.json({ error: "browser must be Chrome, Edge, Safari, or Firefox." }, { status: 400 });
  }

  if (!body.teacherNote?.trim() || body.teacherNote.trim().length < 6) {
    return NextResponse.json({ error: "teacherNote must describe the runtime voice check." }, { status: 400 });
  }

  const task = await memoryStore.getTaskProfile(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (task.apprenticeId !== body.apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const review = buildVoiceBrowserCompatibilityReviewRecord({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    input: {
      browser,
      platformScope: body.platformScope?.trim() || "unknown runtime",
      speechRecognitionAvailable: body.speechRecognitionAvailable === true,
      speechSynthesisAvailable: body.speechSynthesisAvailable === true,
      voiceCount: normalizeCount(body.voiceCount),
      chineseVoiceCount: normalizeCount(body.chineseVoiceCount),
      selectedVoiceName: body.selectedVoiceName?.trim() || "",
      transcriptFallbackTested: body.transcriptFallbackTested === true,
      teacherNote: body.teacherNote.trim()
    }
  });

  await prisma.correction.create({
    data: {
      id: review.id,
      apprenticeId: body.apprenticeId,
      taskId: body.taskId,
      runId: null,
      userFeedback: review.userFeedback,
      errorType: review.errorType,
      extractedRule: JSON.stringify(review.extractedRule),
      beforeOutput: JSON.stringify(review.beforeOutput),
      afterOutput: JSON.stringify(review.afterOutput),
      learningTrace: JSON.stringify(review.learningTrace),
      createdAt: review.createdAt
    }
  });

  return NextResponse.json({
    review,
    ruleEnabled: false,
    voiceOnlyMemoryEnabled: false,
    accepted: false,
    packagingGated: true,
    mode: "visual_learning_review_only"
  });
}
