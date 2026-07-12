"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, DraftingCompass } from "lucide-react";
import type { QualificationReport, QualificationSpatialPoint3D } from "@/server/qualification/learning-report";
import {
  buildSpatialCandidateImpactCorrectionRehearsal,
  buildSpatialCandidateImpactSecondRoundSelectionPreview,
  buildSpatialCoordinateDialoguePreview,
  buildCodeFirstSpatialTeachingModel,
  buildSpatialConstructionRevisionCandidates,
  buildSpatialConstructionRevisionSelectionPreview,
  defaultSpatialCoordinateDialogueJson,
  parseSpatialConstructionCodePatch,
  parseSpatialTeachingInput,
  spatialTeachingExampleJson,
  spatialTeachingPresetJson,
  type SpatialCandidateImpactCorrectionDecision,
  type SpatialConstructionCorrectionDecision,
  type SpatialPoint3D,
  type SpatialTeachingInput
} from "@/lib/spatial-teaching";
import { Badge, Surface } from "./ui";

function project(point: QualificationSpatialPoint3D) {
  return {
    x: 64 + point.x * 205 + point.y * 64,
    y: 205 - point.z * 210 - point.y * 48
  };
}

function pointsToPath(points: QualificationSpatialPoint3D[]) {
  return points
    .map((point, index) => {
      const projected = project(point);
      return `${index === 0 ? "M" : "L"} ${projected.x} ${projected.y}`;
    })
    .join(" ");
}

function candidateColor(index: number) {
  return ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#be123c"][index % 5];
}

function candidateModelLabel(model: string) {
  if (model === "least_squares_line") {
    return "最小二乘意图线";
  }

  if (model === "axis_constrained_line") {
    return "轴向约束导轨";
  }

  if (model === "two_segment_polyline") {
    return "两段折线候选";
  }

  if (model === "circular_arc") {
    return "圆弧意图候选";
  }

  if (model === "bezier_spline") {
    return "平滑样条意图候选";
  }

  if (model === "multi_segment_bezier_spline") {
    return "多段样条意图候选";
  }

  if (model === "surface_patch") {
    return "曲面拟合意图候选";
  }

  return model.replaceAll("_", " ");
}

function cloneTeachingInput(input: SpatialTeachingInput): SpatialTeachingInput {
  return JSON.parse(JSON.stringify(input)) as SpatialTeachingInput;
}

function pointToObject(point: SpatialPoint3D | [number, number, number]): SpatialPoint3D {
  if (Array.isArray(point)) {
    return { x: Number(point[0]), y: Number(point[1]), z: Number(point[2]) };
  }

  return { x: Number(point.x), y: Number(point.y), z: Number(point.z) };
}

export function SpatialEngineeringTeachingPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const seedModel = report.spatialEngineeringTeachingModel;
  const [teachingCode, setTeachingCode] = useState(seedModel.codeTeachingProtocol.example || spatialTeachingExampleJson());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [constructionCorrection, setConstructionCorrection] = useState("这一步构造预测还不符合我的真实意图，请先修正锚点或构造顺序。");
  const [constructionDecision, setConstructionDecision] =
    useState<SpatialConstructionCorrectionDecision>("revise_anchor_points");
  const [impactCorrection, setImpactCorrection] = useState(
    "适用条件太宽，先不要直接泛化；请重新生成更窄的规则和冲突边界。"
  );
  const [impactDecision, setImpactDecision] =
    useState<SpatialCandidateImpactCorrectionDecision>("tighten_rule_scope");
  const [selectedImpactSecondRoundId, setSelectedImpactSecondRoundId] = useState("");
  const [constructionSaveState, setConstructionSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [constructionSaveMessage, setConstructionSaveMessage] = useState("");
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [revisionCodePatch, setRevisionCodePatch] = useState<string | null>(null);
  const parsedTeaching = useMemo(() => parseSpatialTeachingInput(teachingCode), [teachingCode]);
  const model = useMemo(() => {
    if (!parsedTeaching.ok) {
      return seedModel;
    }

    return buildCodeFirstSpatialTeachingModel(parsedTeaching.value);
  }, [parsedTeaching, seedModel]);
  const [selectedId, setSelectedId] = useState(seedModel.candidates[0]?.id ?? "");
  const [coordinateDialogueCode, setCoordinateDialogueCode] = useState(() =>
    defaultSpatialCoordinateDialogueJson(seedModel.candidates[0]?.id)
  );
  const selected = model.candidates.find((candidate) => candidate.id === selectedId) ?? model.candidates[0];
  const selectedCandidateIndex = Math.max(
    0,
    model.candidates.findIndex((candidate) => candidate.id === selected?.id)
  );
  const selectedCandidateColor = candidateColor(selectedCandidateIndex);
  const surfacePatchStabilityReport = model.batchPatternLearning.surfacePatchStabilityReport;
  const selectedRehearsal =
    model.teachingRehearsals.find((rehearsal) => rehearsal.selectedCandidateId === selected?.id) ??
    model.teachingRehearsals[0];
  const selectedConstructionPlan =
    model.constructionPredictionPlans.find((plan) => plan.selectedCandidateId === selected?.id) ??
    model.constructionPredictionPlans[0];
  const selectedImpactPreview =
    model.candidateSelectionImpactPreviews.find((preview) => preview.candidateId === selected?.id) ??
    model.candidateSelectionImpactPreviews[0];
  const selectedImpactCorrectionRehearsal = useMemo(() => {
    if (!selectedImpactPreview) {
      return null;
    }

    const { correctionRehearsal: _correctionRehearsal, ...previewWithoutRehearsal } = selectedImpactPreview;
    void _correctionRehearsal;

    return buildSpatialCandidateImpactCorrectionRehearsal({
      preview: previewWithoutRehearsal,
      teacherCorrection: impactCorrection,
      preferredDecision: impactDecision
    });
  }, [selectedImpactPreview, impactCorrection, impactDecision]);
  const selectedImpactSecondRoundCandidate =
    selectedImpactCorrectionRehearsal?.secondRoundCandidates.find(
      (candidate) => candidate.id === selectedImpactSecondRoundId
    ) ?? selectedImpactCorrectionRehearsal?.secondRoundCandidates[0];
  const selectedImpactSecondRoundPreview = useMemo(() => {
    if (!selectedImpactSecondRoundCandidate) {
      return null;
    }

    return buildSpatialCandidateImpactSecondRoundSelectionPreview(selectedImpactSecondRoundCandidate);
  }, [selectedImpactSecondRoundCandidate]);
  const coordinateDialoguePreview = useMemo(
    () =>
      buildSpatialCoordinateDialoguePreview({
        rawCode: coordinateDialogueCode,
        rawStroke: model.rawStroke,
        candidates: model.candidates,
        selectedCandidateId: selected?.id
      }),
    [coordinateDialogueCode, model.candidates, model.rawStroke, selected?.id]
  );
  const constructionRevisionCandidates = useMemo(() => {
    if (!selectedConstructionPlan || !constructionCorrection.trim()) {
      return [];
    }

    return buildSpatialConstructionRevisionCandidates({
      plan: selectedConstructionPlan,
      teacherCorrection: constructionCorrection,
      decision: constructionDecision
    });
  }, [selectedConstructionPlan, constructionCorrection, constructionDecision]);
  const selectedRevisionCandidate =
    constructionRevisionCandidates.find((candidate) => candidate.id === selectedRevisionId) ??
    constructionRevisionCandidates[0];
  const selectedRevisionPreview = useMemo(() => {
    if (!selectedRevisionCandidate) {
      return null;
    }

    return buildSpatialConstructionRevisionSelectionPreview(selectedRevisionCandidate);
  }, [selectedRevisionCandidate]);
  useEffect(() => {
    setRevisionCodePatch(selectedRevisionPreview?.codePatchJson ?? "");
  }, [selectedRevisionPreview?.id]);
  const effectiveRevisionCodePatch = revisionCodePatch ?? selectedRevisionPreview?.codePatchJson ?? "";
  const parsedRevisionCodePatch = useMemo(() => {
    if (!selectedRevisionPreview) {
      return null;
    }

    return parseSpatialConstructionCodePatch(effectiveRevisionCodePatch);
  }, [selectedRevisionPreview, effectiveRevisionCodePatch]);
  const rawPath = useMemo(() => pointsToPath(model.rawStroke), [model.rawStroke]);
  const readyCandidates = model.candidates.filter((candidate) => candidate.passed).length;
  const editableTeachingInput = parsedTeaching.ok ? parsedTeaching.value : null;
  const currentTolerance = editableTeachingInput?.strokes[0]?.tolerance ?? 0.08;

  function updateTeachingInput(transform: (draft: SpatialTeachingInput) => void) {
    const fallback = parseSpatialTeachingInput(spatialTeachingExampleJson());
    const source = parsedTeaching.ok ? parsedTeaching.value : fallback.ok ? fallback.value : null;

    if (!source) {
      return;
    }

    const draft = cloneTeachingInput(source);
    transform(draft);
    setTeachingCode(JSON.stringify(draft, null, 2));
  }

  function updatePoint(index: number, axis: keyof SpatialPoint3D, value: string) {
    const nextValue = Number(value);

    if (!Number.isFinite(nextValue)) {
      return;
    }

    updateTeachingInput((draft) => {
      const stroke = draft.strokes[0];
      const points = stroke.points.map(pointToObject);
      points[index] = {
        ...points[index],
        [axis]: nextValue
      };
      stroke.points = points;
      draft.sampleCount = points.length;
    });
  }

  function updateTolerance(value: string) {
    const nextValue = Number(value);

    if (!Number.isFinite(nextValue)) {
      return;
    }

    updateTeachingInput((draft) => {
      draft.strokes[0].tolerance = Math.max(0.001, nextValue);
    });
  }

  function addTeachingPoint() {
    updateTeachingInput((draft) => {
      const stroke = draft.strokes[0];
      const points = stroke.points.map(pointToObject);
      const lastPoint = points[points.length - 1] ?? { x: 0, y: 0, z: 0 };
      points.push({
        x: Math.round((lastPoint.x + 0.22) * 1000) / 1000,
        y: lastPoint.y,
        z: lastPoint.z
      });
      stroke.points = points;
      draft.sampleCount = points.length;
    });
  }

  function removeTeachingPoint(index: number) {
    updateTeachingInput((draft) => {
      const stroke = draft.strokes[0];
      const points = stroke.points.map(pointToObject);

      if (points.length <= 2) {
        return;
      }

      stroke.points = points.filter((_, pointIndex) => pointIndex !== index);
      draft.sampleCount = stroke.points.length;
    });
  }

  async function savePausedMemory() {
    if (!selected || !selectedRehearsal) {
      return;
    }

    setSaveState("saving");
    setSaveMessage("");

    try {
      const response = await fetch("/api/spatial-teaching-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          teachingCode,
          selectedCandidateId: selected.id
        })
      });
      const result = (await response.json()) as {
        rule?: { title: string };
        error?: string;
        memoryState?: string;
        conflictReport?: { status: string; teacherQuestion: string };
        serverRecomputedCandidates?: number;
        evidence?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存失败。");
      }

      setSaveState("saved");
      setSaveMessage(
        result.conflictReport?.status === "conflict_requires_teacher"
          ? `服务端已从老师代码重新拟合 ${result.serverRecomputedCandidates ?? model.candidates.length} 个候选，并保存为待确认记忆；检测到新旧三维知识冲突：${result.conflictReport.teacherQuestion}`
          : `服务端已从老师代码重新拟合 ${result.serverRecomputedCandidates ?? model.candidates.length} 个候选，并保存为待确认记忆：${result.rule?.title ?? selected.label}。未来使用前仍需人类确认。`
      );
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "保存失败。");
    }
  }

  async function saveConstructionCorrection() {
    if (!selectedConstructionPlan || !constructionCorrection.trim()) {
      return;
    }

    if (parsedRevisionCodePatch && !parsedRevisionCodePatch.ok) {
      setConstructionSaveState("error");
      setConstructionSaveMessage(`代码草稿还不能保存：${parsedRevisionCodePatch.error}`);
      return;
    }

    setConstructionSaveState("saving");
    setConstructionSaveMessage("");

    try {
      const response = await fetch("/api/spatial-construction-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          plan: selectedConstructionPlan,
          teacherCorrection: constructionCorrection.trim(),
          decision: constructionDecision,
          codePatch: parsedRevisionCodePatch?.ok ? parsedRevisionCodePatch.patch : undefined
        })
      });
      const result = (await response.json()) as {
        rule?: { title: string };
        error?: string;
        conflictReport?: { status: string; teacherQuestion: string };
        codePatchSaved?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存构造纠正失败。");
      }

      setConstructionSaveState("saved");
      setConstructionSaveMessage(
        result.conflictReport?.status === "conflict_requires_teacher"
          ? `已保存为待确认构造纠正${
              result.codePatchSaved ? "，并连同老师编辑的 JSON 构造草稿一起记住" : ""
            }，但检测到旧知识冲突：${result.conflictReport.teacherQuestion}`
          : `已保存为待确认构造纠正${
              result.codePatchSaved ? "，并连同老师编辑的 JSON 构造草稿一起记住" : ""
            }：${result.rule?.title ?? selectedConstructionPlan.label}。未来使用前仍需老师确认。`
      );
    } catch (error) {
      setConstructionSaveState("error");
      setConstructionSaveMessage(error instanceof Error ? error.message : "保存构造纠正失败。");
    }
  }

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={model.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {readyCandidates}/{model.candidates.length} 个拟合候选
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">三维工程带教模型</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            人类用代码化的坐标点、约束、容差来教 AI。AI 会像预测下一步棋一样，根据已有规则拟合多个几何候选，
            说明每个候选为什么合理，再等人类选择或纠正。
          </p>
        </div>
        <DraftingCompass className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">样本</p>
          <p className="mt-1 text-xl font-black text-ink">{model.sampleCount}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">可选择</p>
          <p className="mt-1 text-xl font-black text-ink">{model.candidates.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">规则</p>
          <p className="mt-1 text-xl font-black text-ink">{model.extractedRules.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已验收</p>
          <p className="mt-1 text-xl font-black text-ink">{model.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁定</p>
          <p className="mt-1 text-xl font-black text-ink">{model.packagingGated ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-line bg-mist p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">代码优先带教</Badge>
          <Badge tone="neutral">{model.codeTeachingProtocol.format.replace("_", " ")}</Badge>
          <Badge tone="blue">图片仅作参考</Badge>
        </div>
        <p className="mt-3 text-sm font-extrabold text-ink">带教输入协议</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">{model.codeTeachingProtocol.tokenSavingRationale}</p>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase text-slate-500">在这里输入人类带教代码</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: "straight" as const, label: "直线示例" },
                { id: "axis" as const, label: "轴向轨道" },
                { id: "bend" as const, label: "折线意图" }
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setTeachingCode(spatialTeachingPresetJson(preset.id));
                    setSelectedId("fit-freehand-intent-line");
                  }}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-apprentice-teal hover:text-apprentice-teal"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              value={teachingCode}
              onChange={(event) => setTeachingCode(event.target.value)}
              spellCheck={false}
              className="mt-2 h-72 w-full resize-y rounded-md border border-line bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
            />
            {editableTeachingInput ? (
              <div className="mt-3 rounded-md border border-line bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">三维点位带教表</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      老师可以直接改点位和容差，JSON 会同步更新，候选拟合会立刻重算。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTeachingPoint}
                    className="rounded-md border border-apprentice-teal bg-teal-50 px-3 py-1.5 text-xs font-bold text-apprentice-teal transition hover:bg-white"
                  >
                    增加点
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="text-xs font-bold uppercase text-slate-500">容差 m</span>
                    <input
                      type="number"
                      min="0.001"
                      step="0.005"
                      value={currentTolerance}
                      onChange={(event) => updateTolerance(event.target.value)}
                      className="mt-1 w-28 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <p className="max-w-lg text-xs leading-5 text-slate-600">
                    当前候选会用这个容差判断“可用/需要证据”。这一步只是带教预演，不会验收技术，也不会解锁封装。
                  </p>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-1 font-bold">点</th>
                        <th className="px-2 py-1 font-bold">x</th>
                        <th className="px-2 py-1 font-bold">y</th>
                        <th className="px-2 py-1 font-bold">z</th>
                        <th className="px-2 py-1 font-bold">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.rawStroke.map((point, index) => (
                        <tr key={`${index}-${point.x}-${point.y}-${point.z}`} className="bg-mist">
                          <td className="rounded-l-md px-2 py-1.5 font-black text-slate-700">P{index + 1}</td>
                          {(["x", "y", "z"] as const).map((axis) => (
                            <td key={axis} className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={point[axis]}
                                onChange={(event) => updatePoint(index, axis, event.target.value)}
                                className="w-20 rounded-md border border-line bg-white px-2 py-1 font-mono text-xs text-slate-800 outline-none focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
                              />
                            </td>
                          ))}
                          <td className="rounded-r-md px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => removeTeachingPoint(index)}
                              disabled={model.rawStroke.length <= 2}
                              className="rounded-md border border-line bg-white px-2 py-1 font-bold text-slate-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
          <div className="min-w-0 rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">实时解析结果</p>
            {parsedTeaching.ok ? (
              <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                <p>已读取 {model.rawStroke.length} 个三维点。</p>
                <p>已生成 {model.candidates.length} 个拟合候选。</p>
                <p>已准备 {model.teachingRehearsals.length} 个候选转规则预演。</p>
                <p>下一步预测：请人类选择最符合意图的几何候选，AI 再抽取可复用的位置规则。</p>
              </div>
            ) : (
              <p className="mt-2 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                {parsedTeaching.error}
              </p>
            )}
            <p className="mt-4 text-xs font-bold uppercase text-slate-500">Schema</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
              {model.codeTeachingProtocol.schema}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">三维带教分步生成记录</Badge>
          <Badge tone="teal">{model.guidedGenerationSteps.length} 步等待老师审查</Badge>
          <Badge tone="neutral">不暴露私有思维</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-950">
          AI 每次只推进一个可检查步骤：先展示要生成什么，再说明为什么这样生成，并预留老师纠正点。
          这让老师能像教学生一样逐步打断、纠偏、补规则。
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {model.guidedGenerationSteps.map((step) => (
            <article key={step.id} className="rounded-md bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-apprentice-blue">STEP {step.order}</p>
                <Badge tone={step.passed ? "teal" : "amber"}>{step.reviewState === "awaiting_teacher_review" ? "等老师审查" : "继续"}</Badge>
              </div>
              <p className="mt-2 font-extrabold text-ink">{step.label}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">生成内容</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.proposedOutput}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">为什么这样生成</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.whyThisStep}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">老师纠正点</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.teacherCorrectionSlot}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">下一步预测</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.nextStepPrediction}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0 rounded-md border border-line bg-slate-950 p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-300">
              <Box className="size-4" />
              {model.coordinateFrame.axes.join("/")} 坐标系，{model.coordinateFrame.unit}
            </div>
            <Badge tone="blue">仅本地选择，不保存验收</Badge>
          </div>
          <svg className="mt-4 h-[300px] w-full" viewBox="0 0 360 260" role="img" aria-label="三维坐标带教画布">
            <defs>
              <marker id="arrow-x" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 z" fill="#38bdf8" />
              </marker>
              <marker id="arrow-y" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 z" fill="#a78bfa" />
              </marker>
              <marker id="arrow-z" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 z" fill="#34d399" />
              </marker>
            </defs>
            <path d="M 44 214 L 326 214" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow-x)" />
            <path d="M 44 214 L 126 154" stroke="#a78bfa" strokeWidth="2" markerEnd="url(#arrow-y)" />
            <path d="M 44 214 L 44 40" stroke="#34d399" strokeWidth="2" markerEnd="url(#arrow-z)" />
            <text x="332" y="218" fill="#bfdbfe" fontSize="12" fontWeight="700">
              x
            </text>
            <text x="132" y="154" fill="#ddd6fe" fontSize="12" fontWeight="700">
              y
            </text>
            <text x="36" y="34" fill="#bbf7d0" fontSize="12" fontWeight="700">
              z
            </text>
            <path d={rawPath} fill="none" stroke="#f8fafc" strokeDasharray="5 6" strokeWidth="3" />
            {model.rawStroke.map((point, index) => {
              const projected = project(point);
              return <circle key={`${point.x}-${index}`} cx={projected.x} cy={projected.y} r="3.5" fill="#f8fafc" />;
            })}
            {model.candidates.map((candidate, index) => (
              <path
                key={candidate.id}
                d={pointsToPath(candidate.controlPoints)}
                fill="none"
                stroke={candidateColor(index)}
                strokeOpacity={candidate.id === selected?.id ? 1 : 0.35}
                strokeWidth={candidate.id === selected?.id ? 5 : 3}
              />
            ))}
            {(() => {
              const selectedLens = model.residualTeachingLenses.find((lens) => lens.candidateId === selected?.id);
              if (!selectedLens) return null;
              return selectedLens.vectors.map((vector, vectorIndex) => {
                const rawProj = project(vector.rawPoint);
                const fitProj = project(vector.nearestFitPoint);
                const strokeColor = vector.exceedsTolerance ? (vectorIndex % 2 === 0 ? "#f97316" : "#ef4444") : "#94a3b8";
                const strokeW = vector.exceedsTolerance ? 2 : 1;
                const dash = vector.exceedsTolerance ? "4 3" : undefined;
                return (
                  <line
                    key={`residual-${selected?.id}-${vectorIndex}`}
                    x1={rawProj.x}
                    y1={rawProj.y}
                    x2={fitProj.x}
                    y2={fitProj.y}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    strokeDasharray={dash}
                  />
                );
              });
            })()}
          </svg>
          <div id="teach-fit-candidates" />
          {selected ? (
            <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: selectedCandidateColor }}
                  aria-hidden="true"
                />
                <Badge tone="blue">当前数学建模候选</Badge>
                <Badge tone="neutral">{candidateModelLabel(selected.model)}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-200">
                人类粗线条先被保留为白色虚线；AI 只把它拟合成多个可选数学模型，不自动替老师决定真实意图。
              </p>
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                {selected.surfacePatch ? (
                  <div className="rounded-md bg-slate-800 p-2">
                    <p className="font-bold text-slate-400">曲面 patch 候选</p>
                    <p className="mt-1 leading-5 text-slate-100">
                      中心 ({selected.surfacePatch.patchCenter.x}, {selected.surfacePatch.patchCenter.y},{" "}
                      {selected.surfacePatch.patchCenter.z})，最大高度残差{" "}
                      {selected.surfacePatch.maxHeightResidual}m，超容差 {selected.surfacePatch.exceedCount} 点。
                    </p>
                  </div>
                ) : null}
                <div className="rounded-md bg-slate-800 p-2">
                  <p className="font-bold text-slate-400">控制点</p>
                  <p className="mt-1 break-words leading-5 text-slate-100">
                    {selected.controlPoints.map((point) => `(${point.x}, ${point.y}, ${point.z})`).join(" -> ")}
                  </p>
                </div>
                <div className="rounded-md bg-slate-800 p-2">
                  <p className="font-bold text-slate-400">拟合检查</p>
                  <p className="mt-1 leading-5 text-slate-100">
                    残差 {selected.residual}m / 容差 {currentTolerance}m，置信度{" "}
                    {Math.round(selected.confidence * 100)}%。
                  </p>
                  {selected.multiSegment ? (
                    <p className="mt-2 leading-5 text-slate-300">
                      多段样条：{selected.multiSegment.segmentCount} 段，
                      {selected.multiSegment.sampledPointCount} 个采样点，最大段跨度{" "}
                      {selected.multiSegment.maxSegmentSpan}m。
                    </p>
                  ) : null}
                </div>
                <div className="rounded-md bg-slate-800 p-2">
                  <p className="font-bold text-slate-400">老师下一步可教</p>
                  <p className="mt-1 leading-5 text-slate-100">
                    改 JSON 点位、换候选、收紧容差，或标记它和旧知识冲突。
                  </p>
                </div>
              </div>
              {(() => {
                const selectedLens = model.residualTeachingLenses.find((lens) => lens.candidateId === selected?.id);
                if (!selectedLens) return null;
                return (
                  <div className="mt-3 rounded-md border border-orange-700/50 bg-slate-850 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="amber">拟合误差教学放大镜</Badge>
                      <Badge tone="neutral">
                        {selectedLens.exceedCount}/{selectedLens.vectors.length} 超容差
                      </Badge>
                      <Badge tone="neutral">
                        容差 {selectedLens.tolerance}m
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      每个老师粗略点到当前候选拟合线的残差向量。橙色行表示超容差点，需老师特别审查。
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                        <thead>
                          <tr className="text-left text-slate-400">
                            <th className="px-2 py-1 font-bold">点序号</th>
                            <th className="px-2 py-1 font-bold">原始点 (x, y, z)</th>
                            <th className="px-2 py-1 font-bold">最近拟合点 (x, y, z)</th>
                            <th className="px-2 py-1 font-bold">残差距离</th>
                            <th className="px-2 py-1 font-bold">超容差</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLens.vectors.map((vector, vectorIndex) => (
                            <tr
                              key={`residual-row-${selected?.id}-${vectorIndex}`}
                              className={vector.exceedsTolerance ? "bg-orange-950/50" : "bg-slate-800"}
                            >
                              <td className="rounded-l-md px-2 py-1.5 font-bold text-slate-300">
                                P{vectorIndex + 1}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-slate-300">
                                ({vector.rawPoint.x}, {vector.rawPoint.y}, {vector.rawPoint.z})
                              </td>
                              <td className="px-2 py-1.5 font-mono text-slate-300">
                                ({vector.nearestFitPoint.x}, {vector.nearestFitPoint.y}, {vector.nearestFitPoint.z})
                              </td>
                              <td className="px-2 py-1.5 font-mono text-slate-300">
                                {vector.residualDistance}m
                              </td>
                              <td className="rounded-r-md px-2 py-1.5 font-bold">
                                {vector.exceedsTolerance ? (
                                  <span className="text-orange-400">超容差</span>
                                ) : (
                                  <span className="text-slate-500">在容差内</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      放大镜 reviewOnly=true、accepted=false、packagingGated=true。只作为教学辅助，不验收技术。
                    </p>
                  </div>
                );
              })()}
              {(() => {
                const directionCheck = model.directionToleranceChecks.find((check) => check.candidateId === selected?.id);
                if (!directionCheck) return null;
                return (
                  <div className="mt-3 rounded-md border border-cyan-700/50 bg-slate-850 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={directionCheck.passed ? "teal" : "amber"}>方向容差审查</Badge>
                      <Badge tone="neutral">
                        偏差 {directionCheck.angularDeviationDeg}° / 容差 {directionCheck.allowedDeviationDeg}°
                      </Badge>
                      <Badge tone="neutral">{directionCheck.status === "within_tolerance" ? "方向可审查" : "需要老师确认方向"}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      把老师粗略起止方向和当前候选拟合方向做夹角比较，避免 AI 虽然残差低却把工程方向理解歪。
                    </p>
                    <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                      <div className="rounded-md bg-slate-800 p-2">
                        <p className="font-bold text-slate-400">老师粗略方向</p>
                        <p className="mt-1 font-mono text-slate-100">
                          ({directionCheck.teacherDirection.x}, {directionCheck.teacherDirection.y},{" "}
                          {directionCheck.teacherDirection.z})
                        </p>
                      </div>
                      <div className="rounded-md bg-slate-800 p-2">
                        <p className="font-bold text-slate-400">候选拟合方向</p>
                        <p className="mt-1 font-mono text-slate-100">
                          ({directionCheck.candidateDirection.x}, {directionCheck.candidateDirection.y},{" "}
                          {directionCheck.candidateDirection.z})
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{directionCheck.teacherQuestion}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      方向审查 reviewOnly=true、accepted=false、packagingGated=true，只用于老师判断拟合方向。
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          {model.candidates.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedId(candidate.id)}
              className={`w-full rounded-md border p-3 text-left transition ${
                candidate.id === selected?.id ? "border-apprentice-teal bg-teal-50" : "border-line bg-mist hover:bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: candidateColor(index) }}
                  aria-hidden="true"
                />
                <Badge tone={candidate.passed ? "teal" : "amber"}>{candidate.passed ? "拟合可用" : "需要证据"}</Badge>
                <Badge tone="neutral">{candidate.model.replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-2 font-extrabold text-ink">{candidate.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{candidate.evidence}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <span className="rounded-md bg-white px-2 py-1 font-bold text-slate-600">
                  置信度 {Math.round(candidate.confidence * 100)}%
                </span>
                <span className="rounded-md bg-white px-2 py-1 font-bold text-slate-600">
                  残差 {candidate.residual}m
                </span>
                <span className="rounded-md bg-white px-2 py-1 font-bold text-slate-600">
                  容差 {currentTolerance}m
                </span>
              </div>
              <p className="mt-2 break-words rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                {candidate.equation}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-cyan-100 bg-cyan-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">拟合候选对比矩阵</Badge>
          <Badge tone="neutral">{model.candidateComparisonMatrix.length} 个候选</Badge>
          <Badge tone="neutral">reviewOnly=true</Badge>
          <Badge tone="neutral">{model.packagingGated ? "封装锁定" : "封装打开"}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-cyan-950">
          AI 把每个候选的残差、方向偏差、复杂度和取舍放在同一张表里，老师可以先按建议顺序审查，再点击右侧候选继续看三维画布和残差放大镜。
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] border-separate border-spacing-y-1 text-xs md:min-w-full">
            <thead>
              <tr className="text-left text-cyan-900">
                <th className="px-2 py-1 font-bold">顺序</th>
                <th className="px-2 py-1 font-bold">候选</th>
                <th className="px-2 py-1 font-bold">残差/排名</th>
                <th className="px-2 py-1 font-bold">方向偏差/排名</th>
                <th className="px-2 py-1 font-bold">复杂度</th>
                <th className="px-2 py-1 font-bold">老师先看什么</th>
              </tr>
            </thead>
            <tbody>
              {[...model.candidateComparisonMatrix]
                .sort((a, b) => a.recommendedReviewOrder - b.recommendedReviewOrder)
                .map((comparison) => (
                  <tr key={comparison.candidateId} className="bg-white">
                    <td className="rounded-l-md px-2 py-2 font-black text-cyan-800">
                      #{comparison.recommendedReviewOrder}
                    </td>
                    <td className="w-[120px] px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(comparison.candidateId)}
                        className="text-left font-extrabold text-ink underline decoration-cyan-300 underline-offset-4"
                      >
                        {comparison.candidateLabel}
                      </button>
                      <p className="mt-1 text-slate-500">{candidateModelLabel(comparison.model)}</p>
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-700">
                      {comparison.residual}m / #{comparison.residualRank}
                      <p className="font-sans text-slate-500">超容差 {comparison.exceedToleranceCount} 点</p>
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-700">
                      {comparison.angularDeviationDeg}° / #{comparison.directionRank}
                      <p className="font-sans text-slate-500">最大残差 {comparison.maxResidual}m</p>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={comparison.complexity === "low" ? "teal" : comparison.complexity === "medium" ? "amber" : "blue"}>
                        {comparison.complexity}
                      </Badge>
                    </td>
                    <td className="w-[280px] rounded-r-md px-2 py-2 text-slate-700">
                      <p>{comparison.teacherDecisionHint}</p>
                      <p className="mt-1 text-slate-500">{comparison.selectionTradeoff}</p>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-5 text-cyan-800">
          对比矩阵只帮助老师选择审查顺序，不代表技术验收；accepted=false、packagingGated=true。
        </p>
      </div>

      <div className="mt-5 rounded-md border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">曲面 patch 教学放大镜</Badge>
          <Badge tone="neutral">{model.surfacePatchTeachingLens.fitModel}</Badge>
          <Badge tone="neutral">高度残差 {model.surfacePatchTeachingLens.vectors.length} 点</Badge>
          <Badge tone="neutral">{model.surfacePatchTeachingLens.packagingGated ? "封装锁定" : "封装打开"}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-950">
          AI 额外把粗点列投影到一个局部 x/z 到 y 高度 patch 上，只公开高度残差和老师确认问题；它不是自动规则，也不替代线、圆弧或样条候选。
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
            <p className="font-extrabold text-ink">{model.surfacePatchTeachingLens.label}</p>
            <p className="mt-2 break-words rounded-md bg-emerald-50 p-2 font-mono">
              {model.surfacePatchTeachingLens.equation}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-emerald-50 p-2">
                <p className="font-bold text-emerald-900">patch 中心</p>
                <p className="mt-1 font-mono">
                  ({model.surfacePatchTeachingLens.patchCenter.x}, {model.surfacePatchTeachingLens.patchCenter.y},{" "}
                  {model.surfacePatchTeachingLens.patchCenter.z})
                </p>
              </div>
              <div className="rounded-md bg-emerald-50 p-2">
                <p className="font-bold text-emerald-900">高度梯度</p>
                <p className="mt-1 font-mono">
                  x={model.surfacePatchTeachingLens.gradient.xSlope}, z={model.surfacePatchTeachingLens.gradient.zSlope}
                </p>
              </div>
            </div>
            <p className="mt-3 font-bold text-emerald-900">老师确认问题</p>
            <p>{model.surfacePatchTeachingLens.teacherQuestion}</p>
            <p className="mt-2 font-bold text-emerald-900">下一步预测</p>
            <p>{model.surfacePatchTeachingLens.nextStepPrediction}</p>
          </div>

          <div className="overflow-x-auto rounded-md bg-white p-3">
            <table className="min-w-[620px] border-separate border-spacing-y-1 text-xs md:min-w-full">
              <thead>
                <tr className="text-left text-emerald-900">
                  <th className="px-2 py-1 font-bold">点</th>
                  <th className="px-2 py-1 font-bold">原始点</th>
                  <th className="px-2 py-1 font-bold">patch 投影点</th>
                  <th className="px-2 py-1 font-bold">高度残差</th>
                  <th className="px-2 py-1 font-bold">状态</th>
                </tr>
              </thead>
              <tbody>
                {model.surfacePatchTeachingLens.vectors.map((vector, vectorIndex) => (
                  <tr key={`surface-patch-vector-${vectorIndex}`} className="bg-emerald-50">
                    <td className="rounded-l-md px-2 py-1.5 font-bold text-emerald-900">P{vectorIndex + 1}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-700">
                      ({vector.rawPoint.x}, {vector.rawPoint.y}, {vector.rawPoint.z})
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-700">
                      ({vector.projectedPatchPoint.x}, {vector.projectedPatchPoint.y}, {vector.projectedPatchPoint.z})
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-700">{vector.heightResidual}m</td>
                    <td className="rounded-r-md px-2 py-1.5 font-bold">
                      {vector.exceedsTolerance ? (
                        <span className="text-orange-700">超容差</span>
                      ) : (
                        <span className="text-emerald-700">在容差内</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-5 text-emerald-800">
              均值残差 {model.surfacePatchTeachingLens.meanHeightResidual}m；最大残差{" "}
              {model.surfacePatchTeachingLens.maxHeightResidual}m；超容差{" "}
              {model.surfacePatchTeachingLens.exceedCount} 点；reviewOnly=true，accepted=false，packagingGated=true。
            </p>
          </div>
        </div>
      </div>

      {selectedImpactPreview ? (
        <div className="mt-5 rounded-md border border-violet-100 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">候选选择影响预演</Badge>
            <Badge tone="neutral">{selectedImpactPreview.candidateLabel}</Badge>
            <Badge tone="neutral">disabled 草稿 {selectedImpactPreview.disabledRuleDrafts.length}</Badge>
            <Badge tone="neutral">{selectedImpactPreview.packagingGated ? "封装锁定" : "封装打开"}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-violet-950">{selectedImpactPreview.selectionSummary}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-violet-950">{selectedImpactPreview.teacherQuestion}</p>

          <div className="mt-3 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3">
              {selectedImpactPreview.disabledRuleDrafts.map((draft) => (
                <article key={draft.id} className="rounded-md border border-violet-100 bg-white p-3 text-xs leading-5 text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">{draft.willBeEnabled ? "会启用" : "保持 disabled"}</Badge>
                    <Badge tone="neutral">{draft.draftType === "position_rule" ? "位置规则" : "构造规则"}</Badge>
                    <Badge tone="neutral">{draft.teacherReviewRequired ? "需要老师确认" : "无需确认"}</Badge>
                  </div>
                  <p className="mt-2 font-extrabold text-ink">{draft.label}</p>
                  <p className="mt-2 rounded-md bg-violet-50 p-2">{draft.draftText}</p>
                  <p className="mt-2 text-slate-500">{draft.sourceEvidence}</p>
                  <p className="mt-2 font-bold text-violet-900">冲突边界：{draft.conflictBoundary}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-3">
              {selectedImpactPreview.predictedSteps.map((step) => (
                <article key={step.id} className="rounded-md border border-violet-100 bg-white p-3 text-xs leading-5 text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={step.passed ? "teal" : "amber"}>预演 {step.order}</Badge>
                    <Badge tone="neutral">{step.reviewState === "awaiting_teacher_review" ? "等待老师审查" : step.reviewState}</Badge>
                  </div>
                  <p className="mt-2 font-extrabold text-ink">{step.label}</p>
                  <p className="mt-1">{step.predictedAction}</p>
                  <p className="mt-2 font-bold text-violet-900">为什么这样走</p>
                  <p>{step.whyThisStep}</p>
                  <p className="mt-2 font-bold text-violet-900">老师纠正点</p>
                  <p>{step.teacherCorrectionSlot}</p>
                  <p className="mt-2 font-bold text-violet-900">下一步预测</p>
                  <p>{step.nextStepPrediction}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              <p className="font-extrabold text-ink">旧知识冲突边界</p>
              <ul className="mt-2 space-y-1">
                {selectedImpactPreview.conflictBoundaries.map((boundary) => (
                  <li key={boundary} className="rounded-md bg-violet-50 p-2">
                    {boundary}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              <p className="font-extrabold text-ink">记忆影响</p>
              <p className="mt-2">模式：{selectedImpactPreview.memoryImpact.mode}</p>
              <p>路径：{selectedImpactPreview.memoryImpact.apiPath}</p>
              <p>autoApplies={String(selectedImpactPreview.memoryImpact.autoApplies)}</p>
              <p>requiresTeacherConfirmation={String(selectedImpactPreview.memoryImpact.requiresTeacherConfirmation)}</p>
              <p className="mt-2 font-bold text-violet-900">
                blocked：{selectedImpactPreview.blockedActions.join(" / ")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-fuchsia-200 bg-white p-3 text-xs leading-5 text-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">老师纠正后二轮即时再生</Badge>
              <Badge tone="neutral">
                {selectedImpactCorrectionRehearsal?.secondRoundCandidates.length ?? 0} 个二轮候选
              </Badge>
              <Badge tone="neutral">
                {selectedImpactCorrectionRehearsal?.packagingGated ? "封装锁定" : "封装打开"}
              </Badge>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <label className="block">
                <span className="text-xs font-bold uppercase text-violet-900">老师纠正文本</span>
                <textarea
                  value={impactCorrection}
                  onChange={(event) => setImpactCorrection(event.target.value)}
                  className="mt-1 h-24 w-full resize-y rounded-md border border-fuchsia-200 bg-fuchsia-50 p-2 text-xs leading-5 text-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-violet-900">纠正类型</span>
                <select
                  value={impactDecision}
                  onChange={(event) => setImpactDecision(event.target.value as SpatialCandidateImpactCorrectionDecision)}
                  className="mt-1 w-full rounded-md border border-fuchsia-200 bg-fuchsia-50 p-2 text-xs font-bold text-slate-800"
                >
                  <option value="tighten_rule_scope">收窄适用条件</option>
                  <option value="split_candidate_intent">拆分候选意图</option>
                  <option value="mark_prior_conflict">旧知识优先冲突</option>
                </select>
                <p className="mt-2 rounded-md bg-fuchsia-50 p-2 text-xs leading-5 text-violet-900">
                  本地即时重算；不会保存纠正、启用规则、验收技术或解锁封装。
                </p>
              </label>
            </div>

            <p className="mt-3 font-bold text-violet-950">
              {selectedImpactCorrectionRehearsal?.seedTeacherCorrection}
            </p>
            <p className="mt-1 text-violet-900">{selectedImpactCorrectionRehearsal?.teacherQuestion}</p>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {selectedImpactCorrectionRehearsal?.secondRoundCandidates.map((candidate) => (
                <article key={candidate.id} className="rounded-md border border-fuchsia-100 bg-fuchsia-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={candidate.passed ? "teal" : "amber"}>
                      {candidate.passed ? "可审查" : "待补证据"}
                    </Badge>
                    <Badge tone="neutral">{candidate.sourceDecision}</Badge>
                    <Badge tone="neutral">disabled 草稿 {candidate.regeneratedRuleDrafts.length}</Badge>
                  </div>
                  <p className="mt-2 font-extrabold text-ink">{candidate.label}</p>
                  <p className="mt-2">{candidate.revisedSelectionSummary}</p>
                  <p className="mt-2 font-bold text-violet-900">为什么这样改</p>
                  <p>{candidate.whyThisRevision}</p>
                  <p className="mt-2 font-bold text-violet-900">二轮冲突边界</p>
                  <ul className="mt-1 space-y-1">
                    {candidate.regeneratedConflictBoundaries.slice(0, 2).map((boundary) => (
                      <li key={boundary} className="rounded-md bg-white p-2">
                        {boundary}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-bold text-violet-900">下一步预测</p>
                  <p>{candidate.nextStepPrediction}</p>
                  <p className="mt-2 text-slate-500">{candidate.teacherCorrectionSlot}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedImpactSecondRoundId(candidate.id)}
                    className="mt-3 rounded-md border border-fuchsia-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-900 transition hover:border-fuchsia-400 hover:bg-fuchsia-100"
                  >
                    选择这个二轮走法
                  </button>
                </article>
              ))}
            </div>

            {selectedImpactSecondRoundPreview ? (
              <div className="mt-3 rounded-md border border-violet-100 bg-violet-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">二轮走法 follow-up plan</Badge>
                  <Badge tone="neutral">{selectedImpactSecondRoundPreview.selectedDecision}</Badge>
                  <Badge tone="neutral">{selectedImpactSecondRoundPreview.verifierCommand}</Badge>
                  <Badge tone="neutral">
                    {selectedImpactSecondRoundPreview.packagingGated ? "封装锁定" : "封装打开"}
                  </Badge>
                </div>
                <ol className="mt-3 grid gap-2 md:grid-cols-2">
                  {selectedImpactSecondRoundPreview.followUpPlanSteps.map((step, index) => (
                    <li key={step} className="rounded-md bg-white p-2">
                      <span className="font-black text-violet-900">{index + 1}. </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-white p-2">
                    <p className="font-bold text-violet-900">no-op actions</p>
                    <p className="mt-1">{selectedImpactSecondRoundPreview.noOpActions.join(" / ")}</p>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <p className="font-bold text-violet-900">blocked actions</p>
                    <p className="mt-1">{selectedImpactSecondRoundPreview.blockedActions.join(" / ")}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-md bg-white p-2">
                  <p className="font-bold text-violet-900">public structured trace</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {selectedImpactSecondRoundPreview.publicTraceSteps.map((step) => (
                      <div key={step.id} className="rounded-md bg-violet-50 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={step.passed ? "teal" : "amber"}>trace {step.order}</Badge>
                          <Badge tone="neutral">{Math.round(step.confidence * 100)}%</Badge>
                        </div>
                        <p className="mt-2 font-extrabold text-ink">{step.label}</p>
                        <p className="mt-1 text-slate-600">{step.publicReason}</p>
                        <p className="mt-1 font-bold text-violet-900">validation: {step.validation}</p>
                        <p className="mt-1 text-slate-500">{step.teacherReviewPoint}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-violet-900">
                  evidence: {selectedImpactSecondRoundPreview.evidencePath}; ruleEnabled=
                  {String(selectedImpactSecondRoundPreview.ruleEnabled)}; accepted=
                  {String(selectedImpactSecondRoundPreview.accepted)}; packagingGated=
                  {String(selectedImpactSecondRoundPreview.packagingGated)}
                </p>
              </div>
            ) : null}
          </div>

          <p className="mt-2 text-xs leading-5 text-violet-800">
            这个预演只告诉老师“选它之后会发生什么”，不会启用规则、不会验收技术、不会解锁封装；accepted=false、packagingGated=true。
          </p>
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={model.batchPatternLearning.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            批量示教数学建模
          </Badge>
          <Badge tone="neutral">{model.batchPatternLearning.sampleCount} 个示教样本</Badge>
          <Badge tone="neutral">{model.batchPatternLearning.packagingGated ? "封装锁定" : "封装打开"}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-amber-950">{model.batchPatternLearning.teacherQuestion}</p>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">批量共识模型</p>
            <p className="mt-2 text-sm font-extrabold leading-6 text-ink">
              {model.batchPatternLearning.consensusModel}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{model.batchPatternLearning.variationSummary}</p>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              {model.batchPatternLearning.stableAnchorPoints.map((point, index) => (
                <div key={`${point.x}-${point.y}-${point.z}-${index}`} className="rounded-md bg-amber-50 p-2">
                  <p className="font-bold text-amber-800">稳定锚点 {index + 1}</p>
                  <p className="mt-1 text-slate-700">
                    ({point.x}, {point.y}, {point.z})
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {model.batchPatternLearning.ruleCandidates.map((candidate) => (
              <article key={candidate.id} className="rounded-md border border-amber-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={candidate.passed ? "teal" : "amber"}>
                    {candidate.passed ? "可审查" : "需要更多样本"}
                  </Badge>
                  <Badge tone="neutral">置信度 {Math.round(candidate.confidence * 100)}%</Badge>
                </div>
                <p className="mt-2 font-extrabold text-ink">{candidate.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-700">{candidate.ruleDraft}</p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">请教老师</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{candidate.teacherQuestion}</p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">下一步预测</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{candidate.nextStepPrediction}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-amber-100 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">位置参数学习报告</Badge>
            <Badge tone="neutral">
              {model.batchPatternLearning.positionParameterLearningReport.sourceSampleCount} 个样本建模
            </Badge>
            <Badge
              tone={
                model.batchPatternLearning.positionParameterLearningReport.status === "ready_for_teacher_review"
                  ? "teal"
                  : "amber"
              }
            >
              {model.batchPatternLearning.positionParameterLearningReport.status === "ready_for_teacher_review"
                ? "可审查"
                : "需要更多样本"}
            </Badge>
            <Badge tone="neutral">
              {model.batchPatternLearning.positionParameterLearningReport.packagingGated ? "封装锁定" : "封装打开"}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            {model.batchPatternLearning.positionParameterLearningReport.teacherQuestion}
          </p>

          <div className="mt-3 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-slate-700">
              <p className="font-bold text-amber-900">均值锚点和方向模型</p>
              <p className="mt-2">
                起点均值：({model.batchPatternLearning.positionParameterLearningReport.anchorMean.startPoint.x},{" "}
                {model.batchPatternLearning.positionParameterLearningReport.anchorMean.startPoint.y},{" "}
                {model.batchPatternLearning.positionParameterLearningReport.anchorMean.startPoint.z})
              </p>
              <p className="mt-1">
                终点均值：({model.batchPatternLearning.positionParameterLearningReport.anchorMean.endPoint.x},{" "}
                {model.batchPatternLearning.positionParameterLearningReport.anchorMean.endPoint.y},{" "}
                {model.batchPatternLearning.positionParameterLearningReport.anchorMean.endPoint.z})
              </p>
              <p className="mt-2">
                平均方向：(
                {model.batchPatternLearning.positionParameterLearningReport.directionModel.meanDirection.x},{" "}
                {model.batchPatternLearning.positionParameterLearningReport.directionModel.meanDirection.y},{" "}
                {model.batchPatternLearning.positionParameterLearningReport.directionModel.meanDirection.z})
              </p>
              <p className="mt-1">
                最大方向漂移：
                {model.batchPatternLearning.positionParameterLearningReport.directionModel.maxAngularDriftDeg}°
              </p>
              <p className="mt-2 font-bold text-amber-900">请教老师</p>
              <p>{model.batchPatternLearning.positionParameterLearningReport.directionModel.teacherQuestion}</p>
            </div>

            <div className="overflow-x-auto rounded-md border border-amber-100">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead className="bg-amber-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-2">参数</th>
                    <th className="px-2 py-2">均值</th>
                    <th className="px-2 py-2">范围</th>
                    <th className="px-2 py-2">标准差</th>
                    <th className="px-2 py-2">稳定性</th>
                    <th className="px-2 py-2">AI 解释</th>
                  </tr>
                </thead>
                <tbody>
                  {model.batchPatternLearning.positionParameterLearningReport.parameterRows.map((row) => (
                    <tr key={row.id} className="border-t border-amber-100 align-top">
                      <td className="px-2 py-2 font-bold text-ink">{row.label}</td>
                      <td className="px-2 py-2 font-mono text-slate-700">{row.meanValue}</td>
                      <td className="px-2 py-2 font-mono text-slate-700">
                        {row.minValue} - {row.maxValue}
                        <p className="font-sans text-slate-500">range {row.range}</p>
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-700">{row.standardDeviation}</td>
                      <td className="px-2 py-2">
                        <Badge
                          tone={
                            row.stability === "stable"
                              ? "teal"
                              : row.stability === "needs_teacher_review"
                                ? "amber"
                                : "blue"
                          }
                        >
                          {row.stability === "stable"
                            ? "稳定"
                            : row.stability === "needs_teacher_review"
                              ? "待老师审查"
                              : "变化较大"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        <p>{row.inference}</p>
                        <p className="mt-1 text-slate-500">{row.teacherQuestion}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-slate-700">
              <p className="font-bold text-amber-900">推荐容差</p>
              <p className="mt-1">
                y={model.batchPatternLearning.positionParameterLearningReport.toleranceRecommendation.yTolerance}m / z=
                {model.batchPatternLearning.positionParameterLearningReport.toleranceRecommendation.zTolerance}m / 跨度=
                {model.batchPatternLearning.positionParameterLearningReport.toleranceRecommendation.spanTolerance}m
              </p>
              <p className="mt-1">{model.batchPatternLearning.positionParameterLearningReport.toleranceRecommendation.rationale}</p>
              <p className="mt-1 font-bold text-amber-900">
                {model.batchPatternLearning.positionParameterLearningReport.toleranceRecommendation.teacherQuestion}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-slate-700">
              <p className="font-bold text-amber-900">离群保护</p>
              <p className="mt-1">
                离群数 {model.batchPatternLearning.positionParameterLearningReport.outlierPolicy.outlierCount}；最大残差{" "}
                {model.batchPatternLearning.positionParameterLearningReport.outlierPolicy.maxResidual}m
              </p>
              <p className="mt-1">{model.batchPatternLearning.positionParameterLearningReport.outlierPolicy.ruleDraft}</p>
              <p className="mt-1 font-bold text-amber-900">
                {model.batchPatternLearning.positionParameterLearningReport.outlierPolicy.teacherQuestion}
              </p>
            </div>
          </div>

          <p className="mt-2 text-xs leading-5 text-amber-800">
            这份报告只把多次示教转换成可审查的数学证据；accepted=false、packagingGated=true。
          </p>
        </div>

        <div className="mt-3 rounded-md border border-amber-100 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">曲面 patch 批量稳定性报告</Badge>
            <Badge tone="neutral">{surfacePatchStabilityReport.sourceSampleCount} 个曲面样本</Badge>
            <Badge tone={surfacePatchStabilityReport.status === "ready_for_teacher_review" ? "teal" : "amber"}>
              {surfacePatchStabilityReport.status === "ready_for_teacher_review" ? "可审查" : "需要更多样本"}
            </Badge>
            <Badge tone="neutral">
              {surfacePatchStabilityReport.packagingGated ? "封装锁定" : "封装打开"}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-950">{surfacePatchStabilityReport.teacherQuestion}</p>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-slate-700">
              <p className="font-bold text-amber-900">梯度共识</p>
              <p className="mt-2">
                x slope={surfacePatchStabilityReport.gradientConsensus.meanXSlope} / z slope=
                {surfacePatchStabilityReport.gradientConsensus.meanZSlope}
              </p>
              <p className="mt-1">
                范围 x={surfacePatchStabilityReport.gradientConsensus.xSlopeRange} / z=
                {surfacePatchStabilityReport.gradientConsensus.zSlopeRange}
              </p>
              <Badge
                tone={surfacePatchStabilityReport.gradientConsensus.stability === "stable" ? "teal" : "amber"}
              >
                {surfacePatchStabilityReport.gradientConsensus.stability === "stable" ? "梯度稳定" : "待老师审查"}
              </Badge>
              <p className="mt-2 font-bold text-amber-900">请教老师</p>
              <p>{surfacePatchStabilityReport.gradientConsensus.teacherQuestion}</p>
            </div>

            <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-slate-700">
              <p className="font-bold text-amber-900">高度残差包络</p>
              <p className="mt-2">
                平均残差 {surfacePatchStabilityReport.residualEnvelope.meanHeightResidual}m；最大残差{" "}
                {surfacePatchStabilityReport.residualEnvelope.maxHeightResidual}m
              </p>
              <p className="mt-1">
                残差范围 {surfacePatchStabilityReport.residualEnvelope.residualRange}m；容差{" "}
                {surfacePatchStabilityReport.residualEnvelope.teacherTolerance}m
              </p>
              <p className="mt-1">
                稳定样本 {surfacePatchStabilityReport.residualEnvelope.stableSampleCount}/
                {surfacePatchStabilityReport.sourceSampleCount}
              </p>
            </div>

            <div className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-slate-700">
              <p className="font-bold text-amber-900">离群保护</p>
              <p className="mt-2">离群数 {surfacePatchStabilityReport.outlierPolicy.outlierCount}</p>
              <p className="mt-1">{surfacePatchStabilityReport.outlierPolicy.ruleDraft}</p>
              <p className="mt-2 font-bold text-amber-900">
                {surfacePatchStabilityReport.outlierPolicy.teacherQuestion}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">曲面批量老师选择回放</Badge>
              <Badge tone="neutral">{surfacePatchStabilityReport.teacherSelectionReplay.mode}</Badge>
              <Badge tone="neutral">
                {surfacePatchStabilityReport.teacherSelectionReplay.memoryPolicy.mode}
              </Badge>
              <Badge tone={surfacePatchStabilityReport.teacherSelectionReplay.packagingGated ? "neutral" : "amber"}>
                {surfacePatchStabilityReport.teacherSelectionReplay.packagingGated ? "封装锁定" : "封装打开"}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-amber-950">
              {surfacePatchStabilityReport.teacherSelectionReplay.teacherQuestion}
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {surfacePatchStabilityReport.teacherSelectionReplay.options.map((option) => (
                <article key={option.id} className="rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{option.label}</p>
                    <Badge tone={option.passed ? "teal" : "amber"}>{option.teacherSelection}</Badge>
                  </div>
                  <p className="mt-2 text-slate-600">样本：{option.selectedSampleIds.join("、") || "无需指定样本"}</p>
                  <div className="mt-2 rounded-md bg-amber-50 p-2">
                    <p className="font-bold text-amber-900">disabled 规则草稿</p>
                    {option.disabledRuleDrafts.map((draft) => (
                      <div key={draft.id} className="mt-2">
                        <p className="font-bold text-ink">{draft.title}</p>
                        <p className="mt-1">条件：{draft.condition}</p>
                        <p className="mt-1">动作：{draft.action}</p>
                        <p className="mt-1">willBeEnabled={draft.willBeEnabled ? "true" : "false"}</p>
                        <p className="mt-1 font-bold text-amber-900">{draft.teacherQuestion}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 rounded-md bg-mist p-2">
                    <p className="font-bold text-ink">旧知识冲突边界</p>
                    {option.oldKnowledgeConflictBoundaries.map((boundary) => (
                      <p key={boundary} className="mt-1">
                        {boundary}
                      </p>
                    ))}
                  </div>
                  <p className="mt-2 font-bold text-indigo-900">{option.nextStepPrediction}</p>
                  <p className="mt-1 text-slate-600">{option.teacherCorrectionPoint}</p>
                </article>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="neutral">
                reviewOnly={surfacePatchStabilityReport.teacherSelectionReplay.reviewOnly ? "true" : "false"}
              </Badge>
              <Badge tone="neutral">
                accepted={surfacePatchStabilityReport.teacherSelectionReplay.accepted ? "true" : "false"}
              </Badge>
              <Badge tone="neutral">
                packagingGated={surfacePatchStabilityReport.teacherSelectionReplay.packagingGated ? "true" : "false"}
              </Badge>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-md border border-amber-100">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="bg-amber-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2">曲面样本</th>
                  <th className="px-2 py-2">x/z 梯度</th>
                  <th className="px-2 py-2">高度残差</th>
                  <th className="px-2 py-2">稳定性</th>
                  <th className="px-2 py-2">老师确认点</th>
                </tr>
              </thead>
              <tbody>
                {surfacePatchStabilityReport.samples.slice(0, 6).map((sample) => (
                  <tr key={sample.id} className="border-t border-amber-100 align-top">
                    <td className="px-2 py-2 font-bold text-ink">{sample.label}</td>
                    <td className="px-2 py-2 font-mono text-slate-700">
                      {sample.xSlope} / {sample.zSlope}
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-700">
                      mean {sample.meanHeightResidual}m / max {sample.maxHeightResidual}m
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={sample.stability === "stable" ? "teal" : "amber"}>
                        {sample.stability === "stable" ? "稳定" : "待审"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{sample.teacherQuestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs leading-5 text-amber-800">
            这份曲面稳定性报告只用于老师预演和审查；accepted=false、packagingGated=true，不启用规则、不解锁封装。
          </p>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {model.batchPatternLearning.samples.slice(0, 6).map((sample) => (
            <div key={sample.id} className="rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={sample.passed ? "teal" : "amber"}>{sample.passed ? "稳定样本" : "离群待审"}</Badge>
                <span className="font-bold text-ink">{sample.label}</span>
              </div>
              <p className="mt-2">残差到共识：{sample.residualToConsensus}m</p>
              <p className="mt-1">y/z 漂移：{sample.yOffset}m / {sample.zOffset}m</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-teal-100 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={coordinateDialoguePreview.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            三维坐标对话脚本
          </Badge>
          <Badge tone="neutral">代码输入优先</Badge>
          <Badge tone="neutral">{coordinateDialoguePreview.packagingGated ? "封装锁定" : "封装打开"}</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-teal-950">
          老师可以直接用 JSON 命令和 AI 在 x/y/z 坐标系里交流：补点、要求生成多个拟合候选、选择候选、追问下一步。
          AI 只做本地预演和公开解释，不保存验收、不启用规则、不解锁封装。
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <label className="min-w-0">
            <span className="text-xs font-bold uppercase text-teal-800">老师坐标对话代码</span>
            <textarea
              value={coordinateDialogueCode}
              onChange={(event) => setCoordinateDialogueCode(event.target.value)}
              spellCheck={false}
              className="mt-2 h-72 w-full resize-y rounded-md border border-teal-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <div className="min-w-0">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">命令数</p>
                <p className="mt-1 text-xl font-black text-ink">{coordinateDialoguePreview.commands.length}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">预演步</p>
                <p className="mt-1 text-xl font-black text-ink">{coordinateDialoguePreview.turns.length}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
                <p className="mt-1 text-xl font-black text-ink">{coordinateDialoguePreview.accepted ? "是" : "否"}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">状态</p>
                <p className="mt-1 text-sm font-black text-ink">
                  {coordinateDialoguePreview.status === "ready_for_teacher_review" ? "等待老师审查" : "需要老师修正"}
                </p>
              </div>
            </div>

            {coordinateDialoguePreview.error ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                {coordinateDialoguePreview.error}
              </p>
            ) : null}

            <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-teal-900">
              {coordinateDialoguePreview.teacherQuestion}
            </p>

            <div className="mt-3 grid gap-3">
              {coordinateDialoguePreview.turns.map((turn) => (
                <article key={turn.id} className="rounded-md border border-teal-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={turn.passed ? "teal" : "amber"}>对话 {turn.order}</Badge>
                    <Badge tone="neutral">等老师审查</Badge>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950 p-2 text-xs leading-5 text-slate-100">
                    {turn.teacherCode}
                  </pre>
                  <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-700 md:grid-cols-2">
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-ink">AI 如何理解</p>
                      <p className="mt-1">{turn.aiInterpretation}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-ink">坐标影响</p>
                      <p className="mt-1">{turn.coordinateEffect}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-ink">候选影响</p>
                      <p className="mt-1">{turn.candidateImpact}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-ink">为什么这样处理</p>
                      <p className="mt-1">{turn.whyThisStep}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-ink">老师纠正点</p>
                      <p className="mt-1">{turn.teacherCorrectionSlot}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-ink">下一步预测</p>
                      <p className="mt-1">{turn.nextStepPrediction}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-teal-800">{turn.evidence}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {selectedRehearsal ? (
          <article className="rounded-md border border-apprentice-teal bg-teal-50 p-4 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selectedRehearsal.passed ? "teal" : "amber"}>
                {selectedRehearsal.passed ? "规则预演可审查" : "需要更多证据"}
              </Badge>
              <Badge tone="neutral">默认不自动写入</Badge>
              <Badge tone="blue">{selectedRehearsal.memoryPolicy.replaceAll("_", " ")}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{selectedRehearsal.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{selectedRehearsal.ruleDraft}</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">冲突检查</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  {selectedRehearsal.conflictChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">请教人类</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{selectedRehearsal.teacherQuestion}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">下一步预测</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{selectedRehearsal.nextStepPrediction}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{selectedRehearsal.evidence}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={savePausedMemory}
                disabled={saveState === "saving" || !selectedRehearsal.passed}
                className="rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === "saving" ? "保存中..." : "保存为待确认记忆"}
              </button>
              <p
                className={`text-xs leading-5 ${
                  saveState === "error" ? "text-rose-700" : saveState === "saved" ? "text-teal-800" : "text-slate-600"
                }`}
              >
                {saveMessage || "只保存为 paused 记忆，不会确认技术合格，也不会解锁封装。"}
              </p>
            </div>
          </article>
        ) : null}
        {selectedConstructionPlan ? (
          <article className="rounded-md border border-blue-200 bg-blue-50 p-4 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selectedConstructionPlan.passed ? "teal" : "amber"}>
                {selectedConstructionPlan.passed ? "构造预测可审查" : "需要老师补证据"}
              </Badge>
              <Badge tone="blue">候选后续预测</Badge>
              <Badge tone="neutral">不自动执行</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{selectedConstructionPlan.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{selectedConstructionPlan.teacherQuestion}</p>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">锚点</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {selectedConstructionPlan.anchorPoints
                    .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
                    .join(" -> ")}
                </p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">方向/跨度</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  ({selectedConstructionPlan.offsetVector.x}, {selectedConstructionPlan.offsetVector.y},{" "}
                  {selectedConstructionPlan.offsetVector.z})
                </p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">记忆策略</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {selectedConstructionPlan.memoryPolicy.replaceAll("_", " ")}，验收={selectedConstructionPlan.accepted ? "是" : "否"}，
                  封装锁定={selectedConstructionPlan.packagingGated ? "是" : "否"}。
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {selectedConstructionPlan.constructionSteps.map((step) => (
                <div key={step.id} className="rounded-md bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-apprentice-blue">构造 {step.order}</p>
                    <Badge tone={step.passed ? "teal" : "amber"}>等老师审查</Badge>
                  </div>
                  <p className="mt-2 font-extrabold text-ink">{step.label}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-slate-500">生成几何</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{step.generatedGeometry}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-slate-500">为什么这样生成</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{step.whyThisStep}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-slate-500">验证检查</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{step.validationCheck}</p>
                  <p className="mt-2 text-xs font-bold uppercase text-slate-500">下一步预测</p>
                  <p className="mt-1 text-xs leading-5 text-slate-700">{step.nextStepPrediction}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs leading-5 text-blue-900">{selectedConstructionPlan.evidence}</p>
            <div className="mt-4 rounded-md border border-blue-100 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">老师纠正构造预测</Badge>
                <Badge tone="neutral">保存为待确认记忆</Badge>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label className="min-w-0">
                  <span className="text-xs font-bold uppercase text-slate-500">纠正内容</span>
                  <textarea
                    value={constructionCorrection}
                    onChange={(event) => setConstructionCorrection(event.target.value)}
                    className="mt-1 h-24 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label>
                  <span className="text-xs font-bold uppercase text-slate-500">纠正类型</span>
                  <select
                    value={constructionDecision}
                    onChange={(event) =>
                      setConstructionDecision(event.target.value as SpatialConstructionCorrectionDecision)
                    }
                    className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="revise_anchor_points">修正锚点或偏移</option>
                    <option value="revise_construction_order">修正构造顺序</option>
                    <option value="mark_prediction_conflict">标记预测冲突</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 rounded-md border border-dashed border-blue-200 bg-blue-50/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">纠正后重新生成候选</Badge>
                  <Badge tone="neutral">本地预览不保存</Badge>
                  <Badge tone="neutral">封装仍锁定</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-blue-900">
                  AI 会像预测下一步棋一样，根据老师刚输入的纠正先生成多个修正版构造方案；这里只让老师选择方向，不自动验收、不写正式执行策略。
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {constructionRevisionCandidates.map((candidate) => (
                    <article
                      key={candidate.id}
                      className={`rounded-md border bg-white p-3 ${
                        selectedRevisionCandidate?.id === candidate.id ? "border-apprentice-blue" : "border-blue-100"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={selectedRevisionCandidate?.id === candidate.id ? "blue" : "teal"}>
                          {selectedRevisionCandidate?.id === candidate.id ? "当前预演" : "待老师选择"}
                        </Badge>
                        <Badge tone="neutral">accepted={candidate.accepted ? "true" : "false"}</Badge>
                      </div>
                      <p className="mt-2 font-extrabold text-ink">{candidate.label}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-500">修正版锚点</p>
                      <p className="mt-1 text-xs leading-5 text-slate-700">
                        {candidate.revisedAnchorPoints
                          .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
                          .join(" -> ")}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-500">几何补丁</p>
                      <p className="mt-1 text-xs leading-5 text-slate-700">{candidate.geometryPatch}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-500">为什么这样改</p>
                      <p className="mt-1 text-xs leading-5 text-slate-700">{candidate.whyThisRevision}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-500">验证</p>
                      <p className="mt-1 text-xs leading-5 text-slate-700">{candidate.validationCheck}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-500">下一步预测</p>
                      <p className="mt-1 text-xs leading-5 text-slate-700">{candidate.nextStepPrediction}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedRevisionId(candidate.id)}
                        className="mt-3 w-full rounded-md border border-apprentice-blue px-3 py-2 text-xs font-bold text-apprentice-blue transition hover:bg-blue-50"
                      >
                        选择此候选继续预演
                      </button>
                    </article>
                  ))}
                </div>
                {selectedRevisionPreview ? (
                  <div className="mt-3 rounded-md border border-blue-100 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="blue">已选候选的代码化预演</Badge>
                      <Badge tone="neutral">等待老师逐步纠正</Badge>
                      <Badge tone="neutral">
                        accepted={selectedRevisionPreview.accepted ? "true" : "false"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedRevisionPreview.teacherQuestion}</p>
                    <label className="mt-3 block">
                      <span className="text-xs font-bold uppercase text-slate-500">
                        老师可直接改 JSON 构造草稿
                      </span>
                      <textarea
                        value={effectiveRevisionCodePatch}
                        onChange={(event) => setRevisionCodePatch(event.target.value)}
                        className="mt-1 h-56 w-full resize-y rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
                      />
                    </label>
                    {parsedRevisionCodePatch ? (
                      <div
                        className={`mt-3 rounded-md border p-3 ${
                          parsedRevisionCodePatch.ok
                            ? "border-teal-200 bg-teal-50 text-teal-900"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={parsedRevisionCodePatch.ok ? "teal" : "amber"}>
                            {parsedRevisionCodePatch.ok ? "代码草稿校验通过" : "代码草稿需要老师修正"}
                          </Badge>
                          <Badge tone="neutral">accepted={parsedRevisionCodePatch.accepted ? "true" : "false"}</Badge>
                          <Badge tone="neutral">
                            packagingGated={parsedRevisionCodePatch.packagingGated ? "true" : "false"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5">{parsedRevisionCodePatch.evidence}</p>
                        {!parsedRevisionCodePatch.ok ? (
                          <p className="mt-1 text-xs font-bold">{parsedRevisionCodePatch.error}</p>
                        ) : (
                          <p className="mt-1 text-xs font-bold">
                            已读取 {parsedRevisionCodePatch.patch.anchorPoints.length} 个锚点，仍等待老师确认后才能保存为
                            disabled 记忆。
                          </p>
                        )}
                        <p className="mt-1 text-xs leading-5">{parsedRevisionCodePatch.nextStepPrediction}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {selectedRevisionPreview.guidedSteps.map((step) => (
                        <article key={step.id} className="rounded-md bg-blue-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-apprentice-blue">预演 {step.order}</p>
                            <Badge tone={step.passed ? "teal" : "amber"}>等老师确认</Badge>
                          </div>
                          <p className="mt-2 font-extrabold text-ink">{step.label}</p>
                          <p className="mt-2 text-xs font-bold uppercase text-slate-500">生成草稿</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                            {step.generatedDraft}
                          </p>
                          <p className="mt-2 text-xs font-bold uppercase text-slate-500">为什么这样生成</p>
                          <p className="mt-1 text-xs leading-5 text-slate-700">{step.whyThisStep}</p>
                          <p className="mt-2 text-xs font-bold uppercase text-slate-500">老师纠正点</p>
                          <p className="mt-1 text-xs leading-5 text-slate-700">{step.teacherCorrectionSlot}</p>
                          <p className="mt-2 text-xs font-bold uppercase text-slate-500">下一步预测</p>
                          <p className="mt-1 text-xs leading-5 text-slate-700">{step.nextStepPrediction}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveConstructionCorrection}
                  disabled={constructionSaveState === "saving" || !constructionCorrection.trim()}
                  className="rounded-md bg-apprentice-blue px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {constructionSaveState === "saving" ? "保存中..." : "保存构造纠正"}
                </button>
                <p
                  className={`text-xs leading-5 ${
                    constructionSaveState === "error"
                      ? "text-rose-700"
                      : constructionSaveState === "saved"
                        ? "text-blue-800"
                        : "text-slate-600"
                  }`}
                >
                  {constructionSaveMessage ||
                    "只会保存为 disabled 规则和可追踪 correction，不自动启用、不验收技术、不解锁封装。"}
                </p>
              </div>
            </div>
          </article>
        ) : null}
        {model.extractedRules.map((rule) => (
          <article key={rule.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={rule.passed ? "teal" : "amber"}>{rule.passed ? "规则可审查" : "需要证据"}</Badge>
              <Badge tone="neutral">{rule.sourceCandidateIds.length} 个候选来源</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{rule.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{rule.rule}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{rule.evidence}</p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
