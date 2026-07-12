"use client";

import { useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, LockKeyhole, Save } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

type ReviewDecision = "keep_paused" | "add_applicability_condition" | "mark_conflict_reason";
type MatchReviewDecision = "use_as_reference" | "different_scene" | "tighten_applicability";

type ReviewState = {
  decision: ReviewDecision;
  note: string;
  status: "idle" | "saving" | "saved" | "error";
  message: string;
  traceSteps: number;
};

type MatchReviewState = {
  decision: MatchReviewDecision;
  note: string;
  status: "idle" | "saving" | "saved" | "error";
  message: string;
  traceSteps: number;
};

const decisionLabels: Record<ReviewDecision, string> = {
  keep_paused: "继续暂停",
  add_applicability_condition: "补充适用条件",
  mark_conflict_reason: "标记冲突原因"
};

const decisionDescriptions: Record<ReviewDecision, string> = {
  keep_paused: "这条三维记忆先不进入执行，只作为老师已教过的候选证据。",
  add_applicability_condition: "把老师补充的坐标系、残差、约束、场景边界记下来，未来匹配前必须先解释。",
  mark_conflict_reason: "记录为什么它和旧知识不一致，后续遇到相似问题时先请教老师。"
};

const matchDecisionLabels: Record<MatchReviewDecision, string> = {
  use_as_reference: "作为参考继续预演",
  different_scene: "这是不同场景",
  tighten_applicability: "收窄适用条件"
};

const matchDecisionDescriptions: Record<MatchReviewDecision, string> = {
  use_as_reference: "旧 JSON 草稿可以作为参考，但仍要逐步请老师确认后才能继续。",
  different_scene: "这次候选和旧草稿不是同一场景，未来命中时要先提示冲突。",
  tighten_applicability: "旧草稿可保留，但必须补充坐标系、锚点数量、容差或场景限制。"
};

function initialReviewState(): ReviewState {
  return {
    decision: "keep_paused",
    note: "",
    status: "idle",
    message: "",
    traceSteps: 0
  };
}

function initialMatchReviewState(): MatchReviewState {
  return {
    decision: "use_as_reference",
    note: "",
    status: "idle",
    message: "",
    traceSteps: 0
  };
}

export function SpatialMemoryReviewPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const spatialMemories = report.memoryProvenance.filter((rule) => rule.sourceTypes.includes("Spatial teaching"));
  const pausedMemories = spatialMemories.filter((rule) => !rule.enabled);
  const reusedMemories = spatialMemories.filter((rule) => rule.appliedRunIds.length > 0);
  const codePatchReplays = report.spatialConstructionCodePatchMemoryReplays;
  const codePatchMatches = report.spatialConstructionCodePatchMemoryMatches;
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
  const [matchReviews, setMatchReviews] = useState<Record<string, MatchReviewState>>({});

  const reviewFor = (ruleId: string) => reviews[ruleId] ?? initialReviewState();
  const matchReviewFor = (matchId: string) => matchReviews[matchId] ?? initialMatchReviewState();
  const updateReview = (ruleId: string, patch: Partial<ReviewState>) => {
    setReviews((current) => ({
      ...current,
      [ruleId]: {
        ...initialReviewState(),
        ...current[ruleId],
        ...patch
      }
    }));
  };
  const updateMatchReview = (matchId: string, patch: Partial<MatchReviewState>) => {
    setMatchReviews((current) => ({
      ...current,
      [matchId]: {
        ...initialMatchReviewState(),
        ...current[matchId],
        ...patch
      }
    }));
  };

  const saveReview = async (ruleId: string) => {
    const review = reviewFor(ruleId);

    if (review.note.trim().length < 6) {
      updateReview(ruleId, {
        status: "error",
        message: "请至少写一句老师审查备注，说明为什么继续暂停、补条件或标记冲突。"
      });
      return;
    }

    updateReview(ruleId, { status: "saving", message: "正在保存老师审查记录..." });

    try {
      const response = await fetch("/api/spatial-teaching-memory-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          ruleId,
          decision: review.decision,
          teacherNote: review.note
        })
      });
      const result = (await response.json()) as {
        error?: string;
        review?: { learningTrace?: unknown[] };
        ruleEnabled?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存失败。");
      }

      updateReview(ruleId, {
        status: "saved",
        traceSteps: result.review?.learningTrace?.length ?? 0,
        message:
          result.ruleEnabled === false && result.accepted === false && result.packagingGated === true
            ? "已保存为老师审查学习记录；规则仍暂停，技术未验收，封装仍锁定。"
            : "已保存，但请复核封装锁状态。"
      });
    } catch (error) {
      updateReview(ruleId, {
        status: "error",
        message: error instanceof Error ? error.message : "保存失败。"
      });
    }
  };

  const saveMatchReview = async (matchId: string) => {
    const match = codePatchMatches.find((item) => item.id === matchId);
    const replay = match ? codePatchReplays.find((item) => item.id === match.replayId) : null;
    const review = matchReviewFor(matchId);

    if (!match || !replay) {
      return;
    }

    if (review.note.trim().length < 6) {
      updateMatchReview(matchId, {
        status: "error",
        message: "请至少写一句老师判断，说明为什么这次命中可以参考、不能沿用或要收窄条件。"
      });
      return;
    }

    updateMatchReview(matchId, { status: "saving", message: "正在保存老师对旧代码草稿命中的判断..." });

    try {
      const response = await fetch("/api/spatial-code-patch-match-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          ruleId: replay.ruleId,
          match,
          decision: review.decision,
          teacherNote: review.note
        })
      });
      const result = (await response.json()) as {
        error?: string;
        review?: { learningTrace?: unknown[] };
        ruleEnabled?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存匹配审查失败。");
      }

      updateMatchReview(matchId, {
        status: "saved",
        traceSteps: result.review?.learningTrace?.length ?? 0,
        message:
          result.ruleEnabled === false && result.accepted === false && result.packagingGated === true
            ? "已保存为旧代码草稿命中审查记录；旧规则仍暂停，封装仍锁定。"
            : "已保存，但请复核封装锁状态。"
      });
    } catch (error) {
      updateMatchReview(matchId, {
        status: "error",
        message: error instanceof Error ? error.message : "保存匹配审查失败。"
      });
    }
  };

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={pausedMemories.length === spatialMemories.length ? "teal" : "amber"}>
            {pausedMemories.length}/{spatialMemories.length} 条三维记忆保持暂停
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">三维带教记忆审查台</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里专门审查人类通过三维代码带教保存下来的空间规则。它们会被长期记住，但默认暂停；如果新旧规则冲突，
            AI 必须先比较证据并请教人类，不能自动合并或自动应用。
          </p>
        </div>
        <BrainCircuit className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">空间记忆</p>
          <p className="mt-1 text-xl font-black text-ink">{spatialMemories.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">暂停等待确认</p>
          <p className="mt-1 text-xl font-black text-ink">{pausedMemories.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已自动应用</p>
          <p className="mt-1 text-xl font-black text-ink">{reusedMemories.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装状态</p>
          <p className="mt-1 text-xl font-black text-ink">
            {report.teacherAcceptanceBoundary.packagingGated ? "锁定" : "打开"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-teal-100 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">老师代码草稿记忆回放</Badge>
          <Badge tone="neutral">
            {report.summary.spatialCodePatchMemoriesReady}/{report.summary.spatialCodePatchMemories} 份可审查
          </Badge>
          <Badge tone="neutral">只回放不执行</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-teal-950">
          老师在三维构造纠正里改过的 JSON 草稿会在这里回放。AI 未来命中相似构造时，必须先展示这些锚点、偏移向量和几何补丁，再请老师确认，不能直接套用。
        </p>
        {codePatchReplays.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-teal-200 bg-white p-3 text-xs leading-5 text-slate-600">
            还没有保存过老师编辑的 JSON 构造草稿。可以先在三维工程带教模型里选择候选、编辑 JSON 草稿，再保存为待确认构造纠正。
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {codePatchReplays.map((replay) => (
              <article key={replay.id} className="rounded-md border border-teal-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={replay.passed ? "teal" : "amber"}>
                    {replay.passed ? "待确认记忆" : "需要复核"}
                  </Badge>
                  <Badge tone="neutral">accepted={replay.accepted ? "true" : "false"}</Badge>
                  <Badge tone="neutral">packagingGated={replay.packagingGated ? "true" : "false"}</Badge>
                </div>
                <p className="mt-2 font-extrabold text-ink">{replay.ruleTitle}</p>
                <p className="mt-1 break-words text-xs text-slate-500">{replay.correctionId}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-md bg-teal-50 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">锚点</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">
                      {replay.anchorPoints.map((point) => `(${point.x}, ${point.y}, ${point.z})`).join(" -> ")}
                    </p>
                  </div>
                  <div className="rounded-md bg-teal-50 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">偏移向量</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">
                      ({replay.offsetVector.x}, {replay.offsetVector.y}, {replay.offsetVector.z})
                    </p>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-mist p-3 text-xs leading-5 text-slate-700">
                  <p className="font-bold uppercase text-slate-500">几何补丁</p>
                  <p className="mt-1">{replay.geometryPatch}</p>
                </div>
                <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                  <p className="font-bold uppercase">记忆证据</p>
                  <p className="mt-1">{replay.evidence}</p>
                  <p className="mt-1">{replay.nextStepPrediction}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  trace={replay.learningTraceStepCount} 步；teacherReviewRequired=
                  {replay.teacherReviewRequired ? "true" : "false"}；这份代码草稿只作为老师带教证据，不自动执行。
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">旧代码草稿命中新构造预演</Badge>
          <Badge tone="neutral">
            {report.summary.spatialCodePatchMemoryMatchesReady}/{report.summary.spatialCodePatchMemoryMatches} 个匹配可审查
          </Badge>
          <Badge tone="neutral">先请教老师</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-blue-950">
          这里模拟未来执行时 AI 怎么使用老师教过的 JSON 草稿：先计算旧草稿和当前候选的方向、跨度、锚点相似度，再列出冲突检查和要问老师的问题。
        </p>
        {codePatchMatches.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-blue-200 bg-white p-3 text-xs leading-5 text-slate-600">
            暂时没有可匹配的老师代码草稿。保存至少一份 JSON 构造草稿后，这里会显示它和当前候选的命中预演。
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {codePatchMatches.map((match) => (
              <article key={match.id} className="rounded-md border border-blue-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={match.passed ? "teal" : "amber"}>
                    {match.passed ? "可作为参考" : "弱匹配需请教"}
                  </Badge>
                  <Badge tone="neutral">score={Math.round(match.matchScore * 100)}%</Badge>
                  <Badge tone="neutral">accepted={match.accepted ? "true" : "false"}</Badge>
                </div>
                <p className="mt-2 text-sm font-extrabold text-ink">{match.selectedCandidateId}</p>
                <p className="mt-2 text-xs leading-5 text-slate-700">{match.matchedReason}</p>
                <div className="mt-2 rounded-md bg-mist p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">冲突检查</p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
                    {match.conflictChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                  <p className="font-bold uppercase">请教老师</p>
                  <p className="mt-1">{match.teacherQuestion}</p>
                  <p className="mt-1">{match.nextStepPrediction}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  packagingGated={match.packagingGated ? "true" : "false"}；旧草稿命中只生成预演，不自动应用。
                </p>
                <div className="mt-3 rounded-md border border-line bg-mist p-3">
                  <p className="text-sm font-extrabold text-ink">保存老师对这次命中的判断</p>
                  <div className="mt-2 grid gap-2">
                    {(Object.keys(matchDecisionLabels) as MatchReviewDecision[]).map((decision) => (
                      <label
                        key={`${match.id}-${decision}`}
                        className="flex cursor-pointer gap-2 rounded-md border border-line bg-white p-2 text-xs leading-5 text-slate-700"
                      >
                        <input
                          type="radio"
                          name={`match-review-${match.id}`}
                          value={decision}
                          checked={matchReviewFor(match.id).decision === decision}
                          onChange={() => updateMatchReview(match.id, { decision })}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-bold text-ink">{matchDecisionLabels[decision]}</span>
                          {matchDecisionDescriptions[decision]}
                        </span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={matchReviewFor(match.id).note}
                    onChange={(event) => updateMatchReview(match.id, { note: event.target.value })}
                    placeholder="例如：这次只是方向相似，但锚点数量不同，未来只能作为参考，不能直接沿用。"
                    className="mt-3 min-h-20 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-apprentice-blue"
                  />
                  <button
                    type="button"
                    disabled={matchReviewFor(match.id).status === "saving"}
                    onClick={() => void saveMatchReview(match.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-apprentice-blue px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="size-4" />
                    保存命中审查
                  </button>
                  {matchReviewFor(match.id).message ? (
                    <p
                      className={`mt-3 rounded-md p-3 text-xs leading-5 ${
                        matchReviewFor(match.id).status === "error"
                          ? "bg-rose-50 text-rose-800"
                          : "bg-teal-50 text-teal-800"
                      }`}
                    >
                      {matchReviewFor(match.id).message}
                      {matchReviewFor(match.id).traceSteps > 0
                        ? ` 已生成 ${matchReviewFor(match.id).traceSteps} 步公开学习 trace。`
                        : ""}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    保存后只记录老师对匹配的判断，不启用旧规则，不确认技术合格，不解锁封装。
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          <p className="font-extrabold">像下棋一样动态预测下一步</p>
        </div>
        <p className="mt-2">
          老师每次审查后，AI 都要根据已教规则预测下一步：先生成多个候选，解释为什么这么生成，再暴露残差、约束和冲突点，
          让老师能马上纠正。这个预测只是带教辅助，不代表技术验收通过。
        </p>
      </div>

      {spatialMemories.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-line bg-mist p-4 text-sm leading-6 text-slate-600">
          还没有保存三维带教记忆。可以先在“三维工程带教模型”里选择一个拟合候选，再保存为待确认记忆。
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {spatialMemories.map((rule) => {
            const review = reviewFor(rule.ruleId);

            return (
              <article key={rule.ruleId} className="rounded-md border border-line bg-mist p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={rule.enabled ? "amber" : "teal"}>{rule.enabled ? "需要复核：已启用" : "已暂停"}</Badge>
                  <Badge tone="neutral">{Math.round(rule.confidence * 100)}% 置信度</Badge>
                  <Badge tone="blue">三维带教</Badge>
                </div>
                <p className="mt-3 break-words font-extrabold text-ink">{rule.ruleTitle}</p>
                <p className="mt-1 break-words text-xs font-bold text-slate-500">{rule.ruleId}</p>

                <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="size-3 text-apprentice-teal" />
                    <p className="font-bold uppercase text-slate-500">记忆策略</p>
                  </div>
                  <p className="mt-2">
                    这条规则已经进入长期记忆，但保持 disabled。未来如果命中类似三维场景，AI 应先说明匹配理由和冲突检查，
                    再请求人类确认是否启用。
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {rule.sources.map((source) => (
                    <div key={`${rule.ruleId}-${source.createdAt}`} className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                      <p className="font-bold text-ink">{source.label}</p>
                      <p className="mt-1 break-words">{source.evidence}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-3" />
                    <p className="font-bold uppercase">冲突处理要求</p>
                  </div>
                  <p className="mt-2">
                    如果新教知识和这条旧记忆不一致，AI 必须先比较候选模型、适用条件、残差和人类选择记录；
                    仍无法判断时，要把问题交回人类老师。
                  </p>
                </div>

                <div className="mt-4 rounded-md border border-line bg-white p-3">
                  <p className="text-sm font-extrabold text-ink">老师审查备注</p>
                  <div className="mt-3 grid gap-2">
                    {(Object.keys(decisionLabels) as ReviewDecision[]).map((decision) => (
                      <label
                        key={decision}
                        className="flex cursor-pointer gap-2 rounded-md border border-line bg-mist p-2 text-xs leading-5 text-slate-700"
                      >
                        <input
                          type="radio"
                          name={`review-${rule.ruleId}`}
                          value={decision}
                          checked={review.decision === decision}
                          onChange={() => updateReview(rule.ruleId, { decision })}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-bold text-ink">{decisionLabels[decision]}</span>
                          {decisionDescriptions[decision]}
                        </span>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={review.note}
                    onChange={(event) => updateReview(rule.ruleId, { note: event.target.value })}
                    placeholder="例如：这条只适用于 x 轴导轨草图，折线场景要重新生成候选，不能直接沿用。"
                    className="mt-3 min-h-24 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-apprentice-blue"
                  />
                  <button
                    type="button"
                    disabled={review.status === "saving"}
                    onClick={() => void saveReview(rule.ruleId)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="size-4" />
                    保存审查备注
                  </button>
                  {review.message ? (
                    <p
                      className={`mt-3 rounded-md p-3 text-xs leading-5 ${
                        review.status === "error" ? "bg-rose-50 text-rose-800" : "bg-teal-50 text-teal-800"
                      }`}
                    >
                      {review.message}
                      {review.traceSteps > 0 ? ` 已生成 ${review.traceSteps} 步公开学习 trace。` : ""}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    保存动作只记录老师审查，不启用规则，不确认技术合格，不解锁封装。
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
