"use client";

import { useMemo, useState } from "react";
import { Cable, CheckCircle2, GitBranch, MoveRight } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import {
  buildDynamicTeachingPredictionPreview,
  defaultDynamicTeachingPredictionJson
} from "@/lib/teaching-prediction";
import { Badge, Surface } from "./ui";

function inputModeLabel(mode: string) {
  const labels: Record<string, string> = {
    domain_context: "领域认知",
    code_coordinate: "代码坐标",
    candidate_selection: "候选选择",
    memory_conflict: "记忆冲突",
    durable_memory: "长期记忆"
  };

  return labels[mode] ?? mode;
}

function inputModeTone(mode: string): "neutral" | "teal" | "amber" | "blue" {
  if (mode === "memory_conflict") {
    return "amber";
  }

  if (mode === "durable_memory") {
    return "teal";
  }

  if (mode === "code_coordinate" || mode === "candidate_selection") {
    return "blue";
  }

  return "neutral";
}

export function TeachingPredictionBoardPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const board = report.teachingPredictionBoard;
  const [teachingMoveCode, setTeachingMoveCode] = useState(defaultDynamicTeachingPredictionJson());
  const dynamicPreview = useMemo(() => buildDynamicTeachingPredictionPreview(teachingMoveCode), [teachingMoveCode]);

  return (
    <Surface className="border-blue-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={board.status === "ready_for_teacher_review" ? "teal" : "amber"}>
              {report.summary.teachingPredictionMovesReady}/{report.summary.teachingPredictionMoves} 步可审查
            </Badge>
            <Badge tone="blue">像下棋一样预测下一步</Badge>
            <Badge tone="neutral">{board.accepted ? "已验收" : "未验收"}</Badge>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-ink">中文带教棋局预测板</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{board.teacherPrompt}</p>
        </div>
        <GitBranch className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">预测步数</p>
          <p className="mt-1 text-xl font-black text-ink">{board.moves.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查模式</p>
          <p className="mt-1 text-xl font-black text-ink">{board.reviewOnly ? "只审查" : "可执行"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">长期记忆</p>
          <p className="mt-1 text-xl font-black text-ink">暂停</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁定</p>
          <p className="mt-1 text-xl font-black text-ink">{board.packagingGated ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {board.moves.map((move, index) => (
          <article key={move.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={move.passed ? "teal" : "amber"}>{move.passed ? "可继续请老师审查" : "需要补证据"}</Badge>
              <Badge tone={inputModeTone(move.teacherInputMode)}>{inputModeLabel(move.teacherInputMode)}</Badge>
              <Badge tone="neutral">第 {move.order} 手</Badge>
            </div>
            <div className="mt-3 flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-sm font-black text-apprentice-blue">
                {move.order}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-ink">{move.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{move.apprenticePrediction}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-ink">为什么这样预测</p>
                <p className="mt-1">{move.whyThisPrediction}</p>
              </div>
              <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-ink">老师纠正点</p>
                <p className="mt-1">{move.teacherCorrectionPoint}</p>
              </div>
              <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-ink">记忆和冲突策略</p>
                <p className="mt-1">{move.memoryEffect}</p>
                <p className="mt-2">{move.conflictPolicy}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <CheckCircle2 className="size-4 text-apprentice-teal" />
              <span>{move.reviewState === "awaiting_teacher_review" ? "等老师审查，不自动进入下一步" : move.reviewState}</span>
              {index < board.moves.length - 1 ? (
                <>
                  <MoveRight className="size-4 text-slate-400" />
                  <span>下一步仍先展示预测</span>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-md border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={dynamicPreview.status === "ready_for_teacher_review" ? "teal" : "amber"}>
                动态预测预演
              </Badge>
              <Badge tone="blue">代码优先</Badge>
              <Badge tone="neutral">{dynamicPreview.accepted ? "已验收" : "未验收"}</Badge>
            </div>
            <h4 className="mt-3 text-base font-extrabold text-ink">中文带教下一手模拟器</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
              老师输入一手新的教学事件，AI 先像看棋局一样预测下一步、解释理由、暴露纠正点和记忆边界。
            </p>
          </div>
          <Badge tone={dynamicPreview.packagingGated ? "amber" : "teal"}>封装仍锁定</Badge>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-500">老师这一手教学代码</span>
            <textarea
              className="mt-2 min-h-64 w-full resize-y rounded-md border border-blue-100 bg-white p-3 font-mono text-xs leading-5 text-slate-800 shadow-sm outline-none transition focus:border-apprentice-blue focus:ring-2 focus:ring-blue-100"
              value={teachingMoveCode}
              onChange={(event) => setTeachingMoveCode(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="space-y-3">
            {dynamicPreview.error ? (
              <div className="rounded-md border border-amber-200 bg-white p-3 text-sm leading-6 text-amber-950">
                <p className="font-extrabold">需要老师先修正输入</p>
                <p className="mt-1">{dynamicPreview.error}</p>
                <p className="mt-2">{dynamicPreview.teacherQuestion}</p>
              </div>
            ) : null}

            {dynamicPreview.candidates.map((candidate) => (
              <article key={candidate.id} className="rounded-md border border-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={candidate.id === dynamicPreview.recommendedCandidateId ? "teal" : "blue"}>
                    {candidate.id === dynamicPreview.recommendedCandidateId ? "建议先审查" : "备选下一手"}
                  </Badge>
                  <Badge tone="neutral">置信度 {Math.round(candidate.confidence * 100)}%</Badge>
                </div>
                <p className="mt-3 font-extrabold text-ink">{candidate.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{candidate.predictedNextStep}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-mist p-3 text-xs leading-5 text-slate-600">
                    <p className="font-bold text-ink">为什么这么预测</p>
                    <p className="mt-1">{candidate.whyThisPrediction}</p>
                  </div>
                  <div className="rounded-md bg-mist p-3 text-xs leading-5 text-slate-600">
                    <p className="font-bold text-ink">老师纠正点</p>
                    <p className="mt-1">{candidate.teacherCorrectionPoint}</p>
                  </div>
                  <div className="rounded-md bg-mist p-3 text-xs leading-5 text-slate-600">
                    <p className="font-bold text-ink">记忆影响</p>
                    <p className="mt-1">{candidate.memoryEffect}</p>
                  </div>
                  <div className="rounded-md bg-mist p-3 text-xs leading-5 text-slate-600">
                    <p className="font-bold text-ink">冲突策略</p>
                    <p className="mt-1">{candidate.conflictPolicy}</p>
                  </div>
                </div>
              </article>
            ))}

            <div className="rounded-md border border-line bg-white p-3 text-sm leading-6 text-slate-700">
              <p className="font-extrabold text-ink">AI 请教老师</p>
              <p className="mt-1">{dynamicPreview.teacherQuestion}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {dynamicPreview.blockedActions.map((action) => (
                  <Badge key={action} tone="neutral">
                    禁止：{action}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Cable className="size-4 text-amber-700" />
          <Badge tone="amber">封装仍锁定</Badge>
          {board.blockedActions.map((action) => (
            <Badge key={action} tone="neutral">
              {action}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-amber-950">
          这块只证明“AI 能把下一步想法说清楚并等待老师纠正”。它不会记录技术验收，也不会开放包装、发布或封装动作。
        </p>
      </div>
    </Surface>
  );
}
