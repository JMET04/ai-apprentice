"use client";

import { FlaskConical, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { defaultLearningChallengeSuite } from "@/lib/learning-challenge-presets";
import { Badge, PrimaryButton, Surface } from "./ui";

type ChallengeProbe = {
  input: string;
  expectedLighting: string | null;
  expectedReview: boolean | null;
  baselineOutput: {
    lightingCondition: string;
    recommendedTitles: string[];
    photographyAdvice: string[];
    journalBody: string;
  };
  output: {
    lightingCondition: string;
    recommendedTitles: string[];
    photographyAdvice: string[];
    journalBody: string;
  };
  status: "completed" | "needs_review";
  expectationResult: {
    passed: boolean | null;
    lightingMatches: boolean | null;
    reviewMatches: boolean | null;
    evidence: string;
  };
  persisted: false;
  reviewOnly: true;
  packagingGated: true;
  accepted: false;
  changedByMemory: boolean;
  memoryComparison: Array<{
    field: "lightingCondition" | "recommendedTitles" | "photographyAdvice";
    baseline: string;
    learned: string;
    changed: boolean;
  }>;
  traceSummary: Array<{
    stepId: string;
    stepName: string;
    confidence: number;
    validation: string;
    needsHumanReview: boolean;
    appliedRuleTitles: string[];
  }>;
  ruleDecisions: Array<{
    title: string;
    decision: string;
    memorySource: string;
    matchedCues: string[];
    counterCues: string[];
    counterEvidenceSources: string[];
    reason: string;
  }>;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function statusLabel(status: string) {
  if (status === "completed") {
    return "已完成";
  }

  if (status === "needs_review") {
    return "需要老师审查";
  }

  return status;
}

function lightingLabel(lighting: string | null) {
  if (lighting === "golden hour") {
    return "黄金时刻";
  }

  if (lighting === "natural light") {
    return "自然光";
  }

  return lighting ?? "未指定";
}

function decisionLabel(decision: string) {
  const labels: Record<string, string> = {
    applied: "已应用",
    conflicted: "有冲突",
    counterexample: "反例命中",
    not_matched: "未命中",
    disabled: "已暂停"
  };

  return labels[decision] ?? decision;
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    visual_demonstration: "视觉示范",
    manual: "老师手动规则",
    correction: "纠错记忆",
    example: "示例记忆",
    execution_history: "执行历史"
  };

  return labels[source] ?? source.replace("_", " ");
}

export function LearningChallengeProbe({
  taskId,
  initialInput
}: Readonly<{
  taskId: string;
  initialInput: string;
}>) {
  const [input, setInput] = useState(initialInput);
  const [expectedLighting, setExpectedLighting] = useState("golden hour");
  const [expectedReview, setExpectedReview] = useState(false);
  const [probe, setProbe] = useState<ChallengeProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function applyPreset(preset: (typeof defaultLearningChallengeSuite)[number]) {
    setInput(preset.input);
    setExpectedLighting(preset.expectedLighting);
    setExpectedReview(preset.expectedReview);
    setProbe(null);
    setError(null);
  }

  async function runProbe() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/learning-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, expectedLighting, expectedReview })
      });
      const payload = (await response.json()) as ChallengeProbe | { error?: string };

      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "挑战探针运行失败。");
        setProbe(null);
        return;
      }

      setProbe(payload as ChallengeProbe);
    } catch {
      setError("挑战探针运行失败。");
      setProbe(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">只读审查探针</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">老师挑战输入</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            用新的旅行笔记挑战当前视觉学习记忆。这里会显示输出、规则决策和公开追踪证据，但不会保存运行、
            不会改写记忆，也不会确认技术合格。
          </p>
        </div>
        <FlaskConical className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {defaultLearningChallengeSuite.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-ink transition hover:border-apprentice-teal hover:text-teal-700"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-32 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none transition focus:border-apprentice-teal"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              预期光线
              <select
                value={expectedLighting}
                onChange={(event) => setExpectedLighting(event.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold normal-case text-ink outline-none focus:border-apprentice-teal"
              >
                <option value="golden hour">黄金时刻</option>
                <option value="natural light">自然光</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={expectedReview}
                onChange={(event) => setExpectedReview(event.target.checked)}
                className="size-4 accent-teal-600"
              />
              预期需要老师审查
            </label>
            <PrimaryButton type="button" onClick={runProbe} disabled={loading}>
              {loading ? "正在运行探针..." : "运行审查探针"}
            </PrimaryButton>
            <Badge tone="amber">不写入记忆</Badge>
            <Badge tone="amber">封装锁定</Badge>
          </div>
          {error ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error}</p> : null}
        </div>

        <aside className="rounded-md border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-extrabold">探针边界</p>
              <p className="mt-2 leading-6">
                这里只用于验收检查。它不会保存执行历史、不会抽取新规则、不会确认技术合格，也不会解锁封装。
              </p>
            </div>
          </div>
        </aside>
      </div>

      {probe ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <article className="rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={probe.status === "completed" ? "teal" : "amber"}>{statusLabel(probe.status)}</Badge>
              <Badge tone={probe.changedByMemory ? "teal" : "amber"}>
                {probe.changedByMemory ? "记忆改变了输出" : "记忆未改变输出"}
              </Badge>
              <Badge
                tone={
                  probe.expectationResult.passed === null
                    ? "neutral"
                    : probe.expectationResult.passed
                      ? "teal"
                      : "amber"
                }
              >
                {probe.expectationResult.passed === null
                  ? "未评分"
                  : probe.expectationResult.passed
                    ? "挑战通过"
                    : "挑战未通过"}
              </Badge>
              <Badge tone="neutral">已验收：{probe.accepted ? "是" : "否"}</Badge>
              <Badge tone="neutral">已保存：{probe.persisted ? "是" : "否"}</Badge>
            </div>
            <p className="mt-3 rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
              {probe.expectationResult.evidence}
            </p>
            <p className="mt-3 font-extrabold text-ink">{lightingLabel(probe.output.lightingCondition)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{probe.output.journalBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {probe.output.recommendedTitles.map((title) => (
                <Badge key={title} tone="blue">
                  {title}
                </Badge>
              ))}
            </div>
          </article>

          <article className="rounded-md border border-line bg-mist p-3 text-sm">
            <p className="font-extrabold text-ink">记忆影响对比</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              同一个输入，先看没有复用记忆时的输出，再看当前视觉学习记忆介入后的输出。
            </p>
            <div className="mt-3 grid gap-2">
              {probe.memoryComparison.map((item) => (
                <div key={item.field} className="rounded-md bg-white p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.changed ? "teal" : "neutral"}>
                      {item.changed ? "已改变" : "保持不变"}
                    </Badge>
                    <p className="font-bold text-ink">{item.field}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-mist p-2">
                      <p className="text-xs font-bold uppercase text-slate-500">不使用记忆</p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.baseline}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="text-xs font-bold uppercase text-slate-500">使用已学记忆</p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.learned}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-md border border-line bg-mist p-3 text-sm">
            <p className="font-extrabold text-ink">规则决策</p>
            <div className="mt-3 grid gap-2">
              {probe.ruleDecisions.length > 0 ? (
                probe.ruleDecisions.map((decision) => (
                  <div key={`${decision.title}-${decision.decision}`} className="rounded-md bg-white p-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={decision.decision === "applied" ? "teal" : "amber"}>{decisionLabel(decision.decision)}</Badge>
                      <Badge tone={decision.memorySource === "visual_demonstration" ? "blue" : "neutral"}>
                        {sourceLabel(decision.memorySource)}
                      </Badge>
                    </div>
                    <p className="mt-1 font-bold text-ink">{decision.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{decision.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[...decision.matchedCues, ...decision.counterCues].join(", ") || "没有直接线索。"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                  没有命中可复用记忆；老师仍然可以继续审查和纠正。
                </p>
              )}
            </div>
          </article>

          <article className="rounded-md border border-line bg-mist p-3 text-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-ink">Public trace replay</p>
              <Badge tone="blue">{probe.traceSummary.length} 步</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {probe.traceSummary.map((step) => (
                <div key={step.stepId} className="rounded-md bg-white p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={step.needsHumanReview ? "amber" : "teal"}>
                      {step.needsHumanReview ? "老师审查" : percent(step.confidence)}
                    </Badge>
                    <p className="font-bold text-ink">{step.stepName}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{step.validation}</p>
                  {step.appliedRuleTitles.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">规则：{step.appliedRuleTitles.join(", ")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </Surface>
  );
}
