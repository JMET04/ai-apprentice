"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Save } from "lucide-react";
import type { CorrectionExtraction, VisualCueAnnotation, VisualDemonstrationArtifact } from "@/lib/types";
import { FieldLabel, PrimaryButton } from "./ui";
import { VisualDemonstrationLearningRecord } from "./visual-demonstration-learning-record";

function splitList(value: string) {
  return value
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

function parseRegion(value: string | undefined, index: number) {
  const fallback = fallbackRegions[index % fallbackRegions.length];
  const [x, y, width, height] = (value ?? "")
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

  return {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y,
    width: Number.isFinite(width) ? width : fallback.width,
    height: Number.isFinite(height) ? height : fallback.height
  };
}

function parseVisualAnnotations(value: string, visualCues: string[]): VisualCueAnnotation[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, cue, evidence, region, confidence] = line.split("|").map((item) => item.trim());

      return {
        id: `annotation-${index + 1}`,
        label: label || `线索 ${index + 1}`,
        cue: cue || visualCues[index] || "visual cue",
        evidence: evidence || "老师把这条线索绑定到参考画面的具体区域。",
        region: parseRegion(region, index),
        confidence: Math.min(1, Math.max(0, Number(confidence) || 0.78))
      };
    });
}

export function VisualDemonstrationForm({
  apprenticeId,
  taskId
}: Readonly<{
  apprenticeId: string;
  taskId: string;
}>) {
  const router = useRouter();
  const [title, setTitle] = useState("老师参考：低角度暖光湖边人像");
  const [referenceImageUrl, setReferenceImageUrl] = useState(
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20520'%3E%3Cdefs%3E%3ClinearGradient%20id='sky'%20x1='0'%20x2='0'%20y1='0'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%23f7b267'/%3E%3Cstop%20offset='0.55'%20stop-color='%23ffd6a5'/%3E%3Cstop%20offset='1'%20stop-color='%238ecae6'/%3E%3C/linearGradient%3E%3ClinearGradient%20id='lake'%20x1='0'%20x2='1'%3E%3Cstop%20offset='0'%20stop-color='%23457b9d'/%3E%3Cstop%20offset='1'%20stop-color='%23f4a261'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='800'%20height='520'%20fill='url(%23sky)'/%3E%3Ccircle%20cx='650'%20cy='145'%20r='58'%20fill='%23ffd166'/%3E%3Cpath%20d='M0%20272%20L145%20170%20L260%20255%20L365%20142%20L520%20272Z'%20fill='%23edf6f9'/%3E%3Cpath%20d='M0%20278%20L220%20215%20L420%20282%20L800%20222%20L800%20520%20L0%20520Z'%20fill='url(%23lake)'/%3E%3Cpath%20d='M95%20342%20C240%20312%20396%20318%20540%20362'%20fill='none'%20stroke='%23ffe8b6'%20stroke-width='8'%20opacity='0.65'/%3E%3Ccircle%20cx='270'%20cy='294'%20r='34'%20fill='%232b2d42'/%3E%3Cpath%20d='M222%20438%20C230%20355%20315%20355%20326%20438Z'%20fill='%232b2d42'/%3E%3Cpath%20d='M302%20270%20C348%20292%20370%20340%20370%20428'%20fill='none'%20stroke='%23ffd166'%20stroke-width='10'%20opacity='0.9'/%3E%3C/svg%3E"
  );
  const [sceneDescription, setSceneDescription] = useState(
    "日内瓦湖边 sunset 人像：低角度暖光、长而柔和的阴影，人物边缘有 warm rim light。"
  );
  const [visualCues, setVisualCues] = useState("low sun angle, warm highlights, soft face shadows, reflective lake");
  const [visualAnnotations, setVisualAnnotations] = useState(
    [
      "太阳位置 | low sun angle | 太阳位于画面右上方且接近地平线 | 73,17,14,18 | 0.92",
      "人物轮廓光 | warm rim light | 人物右侧边缘有明亮暖色轮廓 | 36,49,17,31 | 0.88",
      "湖面反光 | reflective lake surface | 湖面重复出现暖色高光 | 11,63,56,13 | 0.83"
    ].join("\n")
  );
  const [lightingSignals, setLightingSignals] = useState("sunset, dusk, golden hour");
  const [expectedAdvice, setExpectedAdvice] = useState("利用柔和侧光塑造人物, 尝试逆光或轮廓光构图");
  const [teacherNotes, setTeacherNotes] = useState(
    "以后遇到类似视觉线索或 sunset、dusk、golden hour 等文本线索，要判断为黄金时刻，并调整摄影建议。"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [extraction, setExtraction] = useState<CorrectionExtraction | null>(null);
  const [savedArtifact, setSavedArtifact] = useState<VisualDemonstrationArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveVisualDemo() {
    setIsSaving(true);
    setError(null);
    const artifact: VisualDemonstrationArtifact = {
      referenceImageUrl: referenceImageUrl.trim() || undefined,
      sceneDescription: sceneDescription.trim(),
      visualCues: splitList(visualCues),
      lightingSignals: splitList(lightingSignals),
      expectedPhotographyAdvice: splitList(expectedAdvice),
      annotations: parseVisualAnnotations(visualAnnotations, splitList(visualCues))
    };
    const response = await fetch("/api/visual-demonstrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        referenceImageUrl,
        sceneDescription,
        visualCues,
        visualAnnotations,
        lightingSignals,
        expectedPhotographyAdvice: expectedAdvice,
        teacherNotes,
        apprenticeId,
        taskId
      })
    });
    const payload = (await response.json()) as { extraction?: CorrectionExtraction; error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "无法保存视觉示范。");
      return;
    }

    setExtraction(payload.extraction ?? null);
    setSavedArtifact(artifact);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
      <div className="mb-3 flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-apprentice-blue">
          <Eye className="size-4" />
        </span>
        <div>
          <p className="font-extrabold">添加视觉示范</p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            用结构化文字、线索列表和区域坐标教 AI；图片只是参考证据，避免每次重新识别图片浪费 token。
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <FieldLabel>示范标题</FieldLabel>
          <input
            className="mt-1 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <FieldLabel>参考图片 URL</FieldLabel>
          <input
            className="mt-1 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
            value={referenceImageUrl}
            onChange={(event) => setReferenceImageUrl(event.target.value)}
          />
          {referenceImageUrl ? (
            <img
              src={referenceImageUrl}
              alt="老师视觉参考"
              className="mt-2 aspect-[16/10] w-full rounded-md border border-blue-100 object-cover"
            />
          ) : null}
        </div>
        <div>
          <FieldLabel>参考画面描述</FieldLabel>
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
            value={sceneDescription}
            onChange={(event) => setSceneDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>视觉线索</FieldLabel>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
              value={visualCues}
              onChange={(event) => setVisualCues(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel>光线信号</FieldLabel>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
              value={lightingSignals}
              onChange={(event) => setLightingSignals(event.target.value)}
            />
          </div>
        </div>
        <div>
          <FieldLabel>把视觉线索绑定到图片区域</FieldLabel>
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
            value={visualAnnotations}
            onChange={(event) => setVisualAnnotations(event.target.value)}
          />
          <p className="mt-1 text-xs leading-5 text-blue-700">
            格式：标签 | 线索 | 证据 | x,y,width,height | 置信度。区域值使用百分比坐标。
          </p>
        </div>
        <div>
          <FieldLabel>期望摄影建议</FieldLabel>
          <textarea
            className="mt-1 min-h-16 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
            value={expectedAdvice}
            onChange={(event) => setExpectedAdvice(event.target.value)}
          />
        </div>
        <div>
          <FieldLabel>老师备注</FieldLabel>
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-blue-100 px-3 py-2 text-sm"
            value={teacherNotes}
            onChange={(event) => setTeacherNotes(event.target.value)}
          />
        </div>
      </div>

      <PrimaryButton className="mt-3 w-full" onClick={saveVisualDemo} disabled={isSaving}>
        <Save className="mr-2 size-4" />
        {isSaving ? "正在保存视觉记忆..." : "保存视觉示范"}
      </PrimaryButton>

      {error ? <p className="mt-3 rounded-md bg-red-50 p-2 text-xs font-bold text-red-700">{error}</p> : null}
      {extraction && savedArtifact ? (
        <VisualDemonstrationLearningRecord artifact={savedArtifact} extraction={extraction} />
      ) : null}
    </div>
  );
}
