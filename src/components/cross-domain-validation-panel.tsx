"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

const domainLabels: Record<string, string> = {
  photography_journal: "摄影日志",
  spatial_engineering: "三维工程",
  human_knowledge: "人类知识记忆"
};

export function CrossDomainValidationPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const validation = report.crossDomainValidationReport;
  const scoreReplay = validation.teacherBatchScoreReplay;
  const scoreRecovery = validation.teacherScoreDraftRecoveryDiff;
  const [saveStatus, setSaveStatus] = useState("");
  const scoreDraftPayload = useMemo(
    () => ({
      apprenticeId: report.apprenticeId,
      taskId: report.taskId,
      items: scoreReplay.items.map((item) => ({
        caseId: item.caseId,
        apprenticeId: item.apprenticeId,
        domain: item.domain,
        score: item.score,
        decision: item.decision,
        note: item.note,
        followUpQuestion: item.followUpQuestion
      })),
      followUpDraft: scoreReplay.items
        .filter((item) => item.decision !== "approve_for_review")
        .map((item) => `${item.caseId}: ${item.followUpQuestion}`)
        .join("\n")
    }),
    [report.apprenticeId, report.taskId, scoreReplay.items]
  );

  async function saveCrossDomainScoreDraft() {
    setSaveStatus("Saving review-only score draft...");
    try {
      const response = await fetch("/api/cross-domain-score-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoreDraftPayload)
      });
      const result = (await response.json()) as {
        draft?: { learningTrace?: unknown[] };
        error?: string;
      };

      if (!response.ok) {
        setSaveStatus(result.error ?? "Failed to save score draft.");
        return;
      }

      setSaveStatus(
        `Saved review-only score draft with ${result.draft?.learningTrace?.length ?? 0} public trace steps; packaging remains locked. Refresh the report to recover it.`
      );
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Failed to save score draft.");
    }
  }

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={validation.status === "ready_for_teacher_review" ? "teal" : "amber"}>
              多学徒跨领域验证
            </Badge>
            <Badge tone="neutral">{validation.mode}</Badge>
            <Badge tone="amber">reviewOnly=true</Badge>
            <Badge tone="amber">accepted=false</Badge>
            <Badge tone="amber">packagingGated=true</Badge>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-ink">多学徒跨领域验证报告</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里把摄影日志、三维工程和人类知识记忆放在同一张审查表里，帮助老师判断学习能力是否能迁移，
            同时明确哪些边界仍必须继续请教。
          </p>
        </div>
        <GitCompareArrows className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">验证案例</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.crossDomainValidationCases}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">领域数</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.crossDomainValidationDomains}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">学徒预演</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.crossDomainValidationApprentices}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">稳定迁移</p>
          <p className="mt-1 text-xl font-black text-ink">{validation.stableTransfers}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">老师审查边界</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.crossDomainValidationReviewBoundaries}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {validation.cases.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{domainLabels[item.domain] ?? item.domain}</Badge>
              <Badge tone={item.reviewState === "needs_teacher_review" ? "amber" : "neutral"}>
                {item.reviewState === "needs_teacher_review" ? "仍需老师审查" : "可审查"}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.apprenticeLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.transferQuestion}</p>
            <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
              <p className="font-bold text-ink">复用学习</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {item.reusedLearning.map((learning) => (
                  <li key={`${item.id}-${learning}`}>{learning}</li>
                ))}
              </ul>
            </div>
            <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">{item.observedBehavior}</p>
            <p className="mt-3 rounded-md bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-950">
              {item.boundaryCheck}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">{scoreReplay.mode}</Badge>
              <Badge tone="neutral">{scoreReplay.format}</Badge>
              <Badge tone="amber">ruleEnabled=false</Badge>
              <Badge tone="amber">accepted=false</Badge>
              <Badge tone="amber">packagingGated=true</Badge>
            </div>
            <h4 className="mt-3 text-base font-extrabold text-ink">老师批量回填评分预演</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-950">{scoreReplay.teacherQuestion}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs text-amber-950">
            <p>
              平均分
              <span className="ml-2 text-lg font-black text-ink">{scoreReplay.averageScore}</span>
            </p>
            <p>
              需复审
              <span className="ml-2 text-lg font-black text-ink">{scoreReplay.needsFollowUp}</span>
            </p>
            <p>
              草稿影响
              <span className="ml-2 text-lg font-black text-ink">{scoreReplay.disabledDraftImpacts}</span>
            </p>
            <p>
              条目
              <span className="ml-2 text-lg font-black text-ink">{scoreReplay.items.length}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {scoreReplay.items.map((item) => (
            <article key={item.caseId} className="rounded-md border border-amber-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.decision === "approve_for_review" ? "teal" : "amber"}>{item.score}/100</Badge>
                <Badge tone="neutral">{item.decision}</Badge>
                <Badge tone="amber">ruleEnabled=false</Badge>
              </div>
              <p className="mt-2 text-xs font-bold text-ink">{domainLabels[item.domain] ?? item.domain}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{item.note}</p>
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs font-bold leading-5 text-amber-950">
                {item.followUpQuestion}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{item.draftImpact}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
            <p className="font-extrabold text-ink">允许决策</p>
            <p className="mt-1 font-mono">{scoreReplay.allowedDecisions.join(" / ")}</p>
            <p className="mt-3 font-extrabold text-ink">回填说明</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {scoreReplay.importInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
            <p className="mt-3 font-extrabold text-ink">禁止动作</p>
            <p className="mt-1">{scoreReplay.blockedActions.join(" / ")}</p>
          </div>
          <textarea
            aria-label="teacher_cross_domain_score_json_v1"
            className="min-h-56 w-full resize-y rounded-md border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
            readOnly
            value={scoreReplay.templateJson}
          />
        </div>
      </div>

      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{scoreRecovery.mode}</Badge>
              <Badge tone="neutral">{scoreRecovery.format}</Badge>
              <Badge tone="amber">ruleEnabled=false</Badge>
              <Badge tone="amber">accepted=false</Badge>
              <Badge tone="amber">packagingGated=true</Badge>
            </div>
            <h4 className="mt-3 text-base font-extrabold text-ink">Cross-domain score draft recovery diff</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-950">{scoreRecovery.teacherQuestion}</p>
          </div>
          <button
            type="button"
            onClick={() => void saveCrossDomainScoreDraft()}
            className="rounded-md bg-ink px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-700"
          >
            Save score draft
          </button>
        </div>

        {saveStatus ? (
          <p className="mt-3 rounded-md bg-white p-3 text-xs font-bold leading-5 text-blue-950">{saveStatus}</p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Rows</p>
            <p className="mt-1 text-xl font-black text-ink">{scoreRecovery.rows.length}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Persisted</p>
            <p className="mt-1 text-xl font-black text-ink">{scoreRecovery.persistedDraftCount}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Changed</p>
            <p className="mt-1 text-xl font-black text-ink">{scoreRecovery.changedRows}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Missing</p>
            <p className="mt-1 text-xl font-black text-ink">{scoreRecovery.missingRecoveredRows}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Follow-ups</p>
            <p className="mt-1 text-xl font-black text-ink">{scoreRecovery.recoveredFollowUps}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {scoreRecovery.rows.map((row) => (
            <article key={row.caseId} className="rounded-md border border-blue-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.recoveredScore === null ? "amber" : row.decisionChanged ? "amber" : "teal"}>
                  {row.recoveredScore === null ? "needs saved score" : `delta=${row.scoreDelta}`}
                </Badge>
                <Badge tone="neutral">{row.staticDecision}</Badge>
                <Badge tone="amber">ruleEnabled=false</Badge>
              </div>
              <p className="mt-2 text-xs font-bold text-ink">{domainLabels[row.domain] ?? row.domain}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                static {row.staticScore}/100 - recovered {row.recoveredScore ?? "missing"}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                recovered decision: {row.recoveredDecision ?? "missing"}
              </p>
              <p className="mt-2 rounded-md bg-blue-50 p-2 text-xs font-bold leading-5 text-blue-950">
                {row.nextTeachingFocus}
              </p>
              {row.recoveredNote ? <p className="mt-2 text-xs leading-5 text-slate-600">{row.recoveredNote}</p> : null}
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
            <p className="font-extrabold text-ink">Allowed actions</p>
            <p className="mt-1">{scoreRecovery.allowedActions.join(" / ")}</p>
            <p className="mt-3 font-extrabold text-ink">Blocked actions</p>
            <p className="mt-1">{scoreRecovery.blockedActions.join(" / ")}</p>
            <p className="mt-3 font-extrabold text-ink">Latest correction</p>
            <p className="mt-1 font-mono">{scoreRecovery.latestCorrectionId ?? "none"}</p>
          </div>
          <textarea
            aria-label="teacher_cross_domain_score_recovery_diff_json_v1"
            className="min-h-56 w-full resize-y rounded-md border border-blue-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
            readOnly
            value={scoreRecovery.exportJson}
          />
        </div>
      </div>

      <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-950">
        {validation.teacherQuestion}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          <p className="font-extrabold text-teal-950">允许动作</p>
          <p className="mt-1">{validation.allowedActions.join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <p className="font-extrabold text-blue-950">仍然禁止</p>
          <p className="mt-1">{validation.blockedActions.join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
