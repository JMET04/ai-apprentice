import { Eye, GitPullRequestArrow, Lightbulb, Sparkles } from "lucide-react";
import type { CorrectionExtraction, VisualDemonstrationArtifact } from "@/lib/types";
import { LearningExtractionTrace } from "./learning-extraction-trace";
import { Badge } from "./ui";

export function VisualDemonstrationLearningRecord({
  artifact,
  extraction
}: Readonly<{
  artifact: VisualDemonstrationArtifact;
  extraction: CorrectionExtraction;
}>) {
  return (
    <div className="mt-3 rounded-md bg-white p-3 text-xs text-blue-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="blue">视觉示范学习记录</Badge>
          <p className="mt-2 font-extrabold text-blue-950">参考画面已转换为可复用记忆</p>
          <p className="mt-1 leading-5 text-blue-800">
            这条公开记录展示学徒如何把老师给的参考图片、结构化线索和区域坐标转换成可审查规则，
            不暴露私有思维链。
          </p>
        </div>
        <Eye className="size-4 text-apprentice-blue" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-apprentice-blue" />
            <p className="font-bold text-blue-950">老师参考画面</p>
          </div>
          {artifact.referenceImageUrl ? (
            <div className="relative mt-2 overflow-hidden rounded-md border border-blue-100 bg-white">
              <img
                src={artifact.referenceImageUrl}
                alt="带区域线索的老师视觉参考"
                className="aspect-[16/10] w-full object-cover"
              />
              {(artifact.annotations ?? []).map((annotation, index) => (
                <div
                  key={annotation.id}
                  className="absolute rounded border-2 border-amber-300 bg-amber-300/10 shadow-sm"
                  style={{
                    left: `${annotation.region.x}%`,
                    top: `${annotation.region.y}%`,
                    width: `${annotation.region.width}%`,
                    height: `${annotation.region.height}%`
                  }}
                >
                  <span className="absolute -left-2 -top-2 grid size-5 place-items-center rounded-full bg-amber-300 text-[10px] font-black text-amber-950">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-2 leading-5">{artifact.sceneDescription}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-apprentice-blue" />
            <p className="font-bold text-blue-950">抽取出的视觉线索</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {artifact.visualCues.map((cue) => (
              <Badge key={cue} tone="blue">
                {cue}
              </Badge>
            ))}
            {artifact.lightingSignals.map((signal) => (
              <Badge key={signal} tone="amber">
                {signal}
              </Badge>
            ))}
          </div>
          {(artifact.annotations ?? []).length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="font-bold text-blue-950">带区域证据的视觉线索</p>
              {(artifact.annotations ?? []).map((annotation, index) => (
                <div key={annotation.id} className="rounded-md bg-white p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">区域 {index + 1}</Badge>
                    <span className="font-bold">{annotation.label}</span>
                    <span>{Math.round(annotation.confidence * 100)}%</span>
                  </div>
                  <p className="mt-1 leading-5">
                    <strong>{annotation.cue}:</strong> {annotation.evidence}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="rounded-md bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <GitPullRequestArrow className="size-4 text-apprentice-blue" />
            <p className="font-bold text-blue-950">从视觉证据抽取的规则</p>
          </div>
          <p className="mt-2 leading-5">
            <strong>条件：</strong> {extraction.condition}
          </p>
          <p className="mt-1 leading-5">
            <strong>动作：</strong> {extraction.action}
          </p>
        </div>
        <div className="rounded-md bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-apprentice-blue" />
            <p className="font-bold text-blue-950">未来复用策略</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={extraction.applyAutomatically ? "teal" : "amber"}>
              {extraction.applyAutomatically ? "以后自动应用" : "先问老师"}
            </Badge>
            <Badge tone={extraction.requiresHumanConfirmation ? "amber" : "teal"}>
              {extraction.requiresHumanConfirmation ? "需要老师确认" : "可用于下一次运行"}
            </Badge>
            <Badge tone={extraction.extractedRule.enabled ? "teal" : "neutral"}>
              {extraction.extractedRule.enabled ? "已保存为启用视觉规则" : "已保存但暂停"}
            </Badge>
          </div>
          {artifact.expectedPhotographyAdvice.length > 0 ? (
            <p className="mt-3 leading-5">
              期望建议：{artifact.expectedPhotographyAdvice.join(" / ")}
            </p>
          ) : null}
        </div>
      </div>

      <LearningExtractionTrace trace={extraction.learningTrace} />
    </div>
  );
}
