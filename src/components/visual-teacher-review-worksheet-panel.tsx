"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Download, LockKeyhole, Save, Upload } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

type ReviewDecision = "unreviewed" | "tentative_pass" | "needs_change" | "unsure";
const reviewDecisionValues: ReviewDecision[] = ["unreviewed", "tentative_pass", "needs_change", "unsure"];

const reviewDecisionLabels: Record<ReviewDecision, string> = {
  unreviewed: "未标注",
  tentative_pass: "暂定通过",
  needs_change: "需要修改",
  unsure: "不确定"
};

const reviewDecisionDescriptions: Record<ReviewDecision, string> = {
  unreviewed: "老师还没有给这个问题做本地判断。",
  tentative_pass: "当前证据看起来可以支撑这一项，但这不是正式验收。",
  needs_change: "这一项还需要继续改学习流程或补证据。",
  unsure: "这一项还要继续观察，AI 不能据此自动前进。"
};

function signalTone(signal: string): "neutral" | "teal" | "amber" | "blue" {
  if (signal === "strong") {
    return "teal";
  }

  if (signal === "locked") {
    return "blue";
  }

  return "amber";
}

function signalLabel(signal: string) {
  const labels: Record<string, string> = {
    strong: "证据较强",
    review_carefully: "需要仔细审查",
    locked: "封装锁定"
  };

  return labels[signal] ?? signal;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "Inspect worksheet": "查看审查问题",
    "Inspect worksheet evidence": "查看审查证据",
    "Run challenge probes": "运行审查探针",
    "Run review-only probes": "运行只读审查探针",
    "Rerun local verifier": "重新运行本地验证",
    "Compare draft versions": "比较草稿版本",
    "Edit local draft": "编辑本地草稿",
    "Export batch JSON": "导出批量 JSON",
    "Save review-only draft": "保存只读审查草稿",
    "Accept technology": "确认技术合格",
    Package: "封装",
    Release: "发布",
    Wrap: "包装/封装交付"
  };

  return labels[action] ?? action;
}

export function VisualTeacherReviewWorksheetPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const worksheet = report.visualTeacherReviewWorksheet;
  const batchExchange = worksheet.batchReviewExchange;
  const draftVersionComparison = worksheet.draftVersionComparison;
  const recoveryReport = report.visualTeacherReviewDraftRecoveryReport;
  const replayReport = report.visualTeacherReviewDraftReplayReport;
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [batchReviewJson, setBatchReviewJson] = useState(batchExchange.templateJson);
  const [batchImportMessage, setBatchImportMessage] = useState(
    "可以先导出模板，批量填写 decision/note 后粘贴回填；这只更新本地草稿。"
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const draftSummary = useMemo(() => {
    const values = worksheet.items.map((item) => decisions[item.id] ?? "unreviewed");

    return {
      tentativePass: values.filter((value) => value === "tentative_pass").length,
      needsChange: values.filter((value) => value === "needs_change").length,
      unsure: values.filter((value) => value === "unsure").length,
      unreviewed: values.filter((value) => value === "unreviewed").length,
      notes: Object.values(notes).filter((note) => note.trim().length > 0).length
    };
  }, [decisions, notes, worksheet.items]);
  const followUpDraft = useMemo(() => {
    const followUpItems = worksheet.items
      .map((item) => ({
        item,
        decision: decisions[item.id] ?? "unreviewed",
        note: notes[item.id]?.trim() ?? ""
      }))
      .filter(({ decision }) => decision === "needs_change" || decision === "unsure");
    const tentativePassItems = worksheet.items.filter((item) => decisions[item.id] === "tentative_pass");
    const lines = [
      "本地审查草稿：只用于继续带教，不代表验收，不保存数据库，不解锁封装。",
      `暂定通过：${tentativePassItems.length} 项；需要修改：${followUpItems.filter(({ decision }) => decision === "needs_change").length} 项；不确定：${followUpItems.filter(({ decision }) => decision === "unsure").length} 项。`,
      "",
      "下一轮带教修正清单：",
      ...(followUpItems.length > 0
        ? followUpItems.map(({ item, decision, note }, index) =>
            `${index + 1}. ${reviewDecisionLabels[decision]}：${item.label}\n   老师问题：${item.question}\n   建议教法：请 AI 先解释当前证据为什么不足，再给出下一步要补的 trace、案例或规则边界。${note ? `\n   老师备注：${note}` : ""}`
          )
        : ["暂无。请先把某些审查项标为“需要修改”或“不确定”。"]),
      "",
      "封装边界：accepted=false，packagingGated=true，继续停留在 visual_learning_review_only。"
    ];

    return {
      followUpItems,
      text: lines.join("\n")
    };
  }, [decisions, notes, worksheet.items]);

  function resetBatchReviewJson() {
    setBatchReviewJson(batchExchange.templateJson);
    setBatchImportMessage("已重新生成批量审查 JSON 模板；仍然只是本地草稿，不记录验收。");
  }

  function applyBatchReviewJson() {
    try {
      const parsed = JSON.parse(batchReviewJson) as {
        format?: unknown;
        items?: Array<{ id?: unknown; decision?: unknown; note?: unknown }>;
      };

      if (parsed.format !== batchExchange.format) {
        throw new Error(`format 必须是 ${batchExchange.format}`);
      }

      if (!Array.isArray(parsed.items)) {
        throw new Error("items 必须是数组。");
      }

      const validIds = new Set(worksheet.items.map((item) => item.id));
      const nextDecisions: Record<string, ReviewDecision> = {};
      const nextNotes: Record<string, string> = {};
      let applied = 0;

      for (const item of parsed.items) {
        if (typeof item.id !== "string" || !validIds.has(item.id)) {
          continue;
        }

        const decision = reviewDecisionValues.includes(item.decision as ReviewDecision)
          ? (item.decision as ReviewDecision)
          : "unreviewed";
        nextDecisions[item.id] = decision;
        nextNotes[item.id] = typeof item.note === "string" ? item.note : "";
        applied += 1;
      }

      if (applied === 0) {
        throw new Error("没有找到可回填的审查项 id。");
      }

      setDecisions((current) => ({ ...current, ...nextDecisions }));
      setNotes((current) => ({ ...current, ...nextNotes }));
      setBatchImportMessage(`已回填 ${applied} 项到本地审查草稿；accepted=false，packagingGated=true。`);
    } catch (error) {
      setBatchImportMessage(error instanceof Error ? `回填失败：${error.message}` : "回填失败：JSON 格式无法识别。");
    }
  }

  async function saveReviewDraft() {
    setSaveState("saving");
    setSaveMessage("正在保存老师审查草稿...");

    try {
      const response = await fetch("/api/teacher-review-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          followUpDraft: followUpDraft.text,
          items: worksheet.items.map((item) => ({
            id: item.id,
            label: item.label,
            question: item.question,
            evidence: item.evidence,
            decision: decisions[item.id] ?? "unreviewed",
            note: notes[item.id] ?? ""
          }))
        })
      });
      const result = (await response.json()) as {
        error?: string;
        draft?: { learningTrace?: unknown[]; afterOutput?: { followUpItems?: unknown[] } };
        accepted?: boolean;
        packagingGated?: boolean;
        ruleEnabled?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存失败。");
      }

      setSaveState("saved");
      setSaveMessage(
        result.accepted === false && result.packagingGated === true && result.ruleEnabled === false
          ? `已保存为老师审查草稿，生成 ${result.draft?.learningTrace?.length ?? 0} 步公开学习 trace，${result.draft?.afterOutput?.followUpItems?.length ?? 0} 项进入下一轮修正；封装仍锁定。`
          : "已保存，但请复核验收边界。"
      );
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "保存失败。");
    }
  }

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="amber">
            {report.summary.visualTeacherWorksheetReady}/{report.summary.visualTeacherWorksheetItems} 个审查问题已准备
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">老师最终审查表</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里把所有证据翻译成老师要判断的问题。问题保持未回答状态：它只帮助你审查可视化学习是否合格，
            不会记录“已验收”，也不会解锁封装。
          </p>
        </div>
        <ClipboardList className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查状态</p>
          <p className="mt-1 text-sm font-black text-ink">等待老师判断</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">未回答问题</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualTeacherWorksheetUnanswered}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{worksheet.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装闸门</p>
          <p className="mt-1 text-xl font-black text-ink">{worksheet.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        <p className="font-extrabold text-amber-950">给老师的审查说明</p>
        <p className="mt-1">
          请逐条判断这些证据是否足以证明“AI 能被教、能解释、能纠错、能记住、能在不确定时请教”。
          当前界面只收集判断依据，不提供技术验收按钮。
        </p>
      </div>

      <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">本地审查草稿</Badge>
          <Badge tone="neutral">不保存数据库</Badge>
          <Badge tone="amber">不代表验收</Badge>
          <Badge tone="amber">不解锁封装</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-blue-950">
          你可以先像批作业一样逐条标注。这里的标注只存在当前浏览器页面里，刷新就会消失；
          系统不会把这些选择写成 acceptance，也不会开启封装或发布流程。
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">暂定通过</p>
            <p className="mt-1 text-xl font-black text-ink">{draftSummary.tentativePass}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">需要修改</p>
            <p className="mt-1 text-xl font-black text-ink">{draftSummary.needsChange}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">不确定</p>
            <p className="mt-1 text-xl font-black text-ink">{draftSummary.unsure}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">未标注</p>
            <p className="mt-1 text-xl font-black text-ink">{draftSummary.unreviewed}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">老师备注</p>
            <p className="mt-1 text-xl font-black text-ink">{draftSummary.notes}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">批量导出/回填审查 JSON</Badge>
          <Badge tone="neutral">{batchExchange.itemCount} 个问题</Badge>
          <Badge tone={batchExchange.passed ? "teal" : "amber"}>
            {batchExchange.format}
          </Badge>
          <Badge tone="amber">不记录验收</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          老师可以把这份 JSON 发给外部审查、表格脚本或另一个 AI 辅助填写，再粘贴回来一次性回填本地判断。
          系统只读取每项的 <span className="font-bold text-ink">decision</span> 和{" "}
          <span className="font-bold text-ink">note</span>，不会把回填当作技术验收，也不会解锁封装。
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-md bg-mist p-3 text-xs leading-5 text-slate-600">
            <p className="font-bold text-ink">回填格式</p>
            <p className="mt-2">允许 decision：</p>
            <p className="mt-1 font-mono">{batchExchange.allowedDecisions.join(" / ")}</p>
            <p className="mt-2">必填字段：{batchExchange.requiredFields.join(" / ")}</p>
            <p className="mt-2">封装边界：accepted=false，packagingGated=true</p>
            <ul className="mt-3 list-disc space-y-1 pl-4">
              {batchExchange.importInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </div>
          <label className="grid gap-2 text-xs font-bold uppercase text-slate-500">
            teacher_review_batch_json_v1
            <textarea
              value={batchReviewJson}
              onChange={(event) => setBatchReviewJson(event.target.value)}
              spellCheck={false}
              className="min-h-80 rounded-md border border-line bg-slate-950 p-3 font-mono text-xs font-normal normal-case leading-5 text-slate-100 outline-none focus:border-apprentice-blue"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={resetBatchReviewJson}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition hover:border-apprentice-blue/40"
          >
            <Download className="size-4" />
            重新生成导出模板
          </button>
          <button
            type="button"
            onClick={applyBatchReviewJson}
            className="inline-flex items-center gap-2 rounded-md bg-apprentice-blue px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Upload className="size-4" />
            应用批量回填到本地草稿
          </button>
          <p className="text-xs leading-5 text-slate-600">{batchImportMessage}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">老师审查草稿版本对比</Badge>
          <Badge tone="neutral">{draftVersionComparison.versions.length} 个版本</Badge>
          <Badge tone={draftVersionComparison.passed ? "teal" : "amber"}>
            {draftVersionComparison.mode}
          </Badge>
          <Badge tone="amber">reviewOnly=true</Badge>
          <Badge tone="amber">accepted=false</Badge>
          <Badge tone="amber">packagingGated=true</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-indigo-950">{draftVersionComparison.teacherQuestion}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">版本数</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.visualTeacherWorksheetDraftVersions}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">当前变化项</p>
            <p className="mt-1 text-xl font-black text-ink">
              {report.summary.visualTeacherWorksheetDraftChangedItems}
            </p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">下一轮修正项</p>
            <p className="mt-1 text-xl font-black text-ink">
              {report.summary.visualTeacherWorksheetDraftFollowUpItems}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {draftVersionComparison.versions.map((version) => (
            <article key={version.id} className="rounded-md border border-indigo-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={version.version === "current" ? "teal" : "neutral"}>{version.version}</Badge>
                <Badge tone="amber">{version.packagingGated ? "封装锁定" : "封装未锁"}</Badge>
              </div>
              <p className="mt-3 font-extrabold text-ink">{version.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{version.teacherNote}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {reviewDecisionValues.map((decision) => (
                  <div key={`${version.id}-${decision}`} className="rounded-md bg-mist p-2">
                    <p className="text-[11px] font-bold text-slate-500">{reviewDecisionLabels[decision]}</p>
                    <p className="mt-1 text-lg font-black text-ink">{version.decisionCounts[decision]}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md bg-indigo-50 p-3 text-xs leading-5 text-indigo-950">
                <p className="font-bold">版本变化</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {version.comparisonToPrevious.map((line) => (
                    <li key={`${version.id}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="neutral">变化 {version.changedItemIds.length}</Badge>
                <Badge tone="amber">修正 {version.followUpItemIds.length}</Badge>
                <Badge tone={version.accepted ? "teal" : "amber"}>{version.accepted ? "已验收" : "未验收"}</Badge>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
            <p className="font-extrabold text-ink">允许动作</p>
            <p className="mt-1">{draftVersionComparison.allowedActions.map(actionLabel).join(" / ")}</p>
          </div>
          <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
            <p className="font-extrabold text-ink">禁止动作</p>
            <p className="mt-1">{draftVersionComparison.blockedActions.map(actionLabel).join(" / ")}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-sky-100 bg-sky-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">Persisted teacher review draft recovery</Badge>
          <Badge tone="neutral">{recoveryReport.mode}</Badge>
          <Badge tone={recoveryReport.passed ? "teal" : "amber"}>{recoveryReport.status}</Badge>
          <Badge tone="amber">ruleEnabled=false</Badge>
          <Badge tone="amber">accepted=false</Badge>
          <Badge tone="amber">packagingGated=true</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-sky-950">
          Saved teacher review drafts are recovered from `visual_teacher_review_draft` correction records. This history
          helps continue the next teaching round, but it still cannot accept the technology, enable rules, or unlock
          packaging.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">persisted drafts</p>
            <p className="mt-1 text-xl font-black text-ink">{recoveryReport.persistedDraftCount}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">recovered versions</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.visualTeacherReviewDraftRecoveryVersions}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">follow-up items</p>
            <p className="mt-1 text-xl font-black text-ink">{recoveryReport.restoredFollowUpItems}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">latest</p>
            <p className="mt-1 break-words text-xs font-black text-ink">{recoveryReport.latestVersionId ?? "none"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3">
            {recoveryReport.versions.length > 0 ? (
              recoveryReport.versions.map((version) => (
                <article key={version.id} className="rounded-md border border-sky-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={version.passed ? "teal" : "amber"}>{version.label}</Badge>
                    <Badge tone="neutral">{version.learningTraceSteps} trace steps</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{version.createdAt}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p>unreviewed: {version.decisionCounts.unreviewed}</p>
                    <p>tentative: {version.decisionCounts.tentative_pass}</p>
                    <p>needs change: {version.decisionCounts.needs_change}</p>
                    <p>unsure: {version.decisionCounts.unsure}</p>
                  </div>
                  <p className="mt-2 text-xs font-bold text-sky-900">follow-up items: {version.followUpItemCount}</p>
                  <p className="mt-2 rounded-md bg-sky-50 p-2 text-xs leading-5 text-sky-950">
                    {version.teacherSummary}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-md border border-sky-100 bg-white p-3 text-sm leading-6 text-sky-950">
                No persisted teacher review draft has been saved yet. The recovery report is ready and will populate
                after `/api/teacher-review-drafts` stores a review-only correction.
              </div>
            )}
          </div>
          <textarea
            aria-label="teacher_review_draft_persistence_recovery_v1"
            readOnly
            value={recoveryReport.exportJson}
            className="min-h-72 rounded-md border border-sky-100 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
            <p className="font-extrabold text-ink">Allowed</p>
            <p className="mt-1">{recoveryReport.allowedActions.join(" / ")}</p>
          </div>
          <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
            <p className="font-extrabold text-ink">Blocked</p>
            <p className="mt-1">{recoveryReport.blockedActions.join(" / ")}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-violet-100 bg-violet-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">Draft diff recovery replay</Badge>
          <Badge tone="neutral">{replayReport.mode}</Badge>
          <Badge tone={replayReport.passed ? "teal" : "amber"}>{replayReport.format}</Badge>
          <Badge tone="amber">ruleEnabled=false</Badge>
          <Badge tone="amber">accepted=false</Badge>
          <Badge tone="amber">packagingGated=true</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-violet-950">
          Static draft versions and persisted recovery drafts are replayed as one diff export. The replay only helps
          plan the next teaching round; it cannot accept the technology, enable rules, or unlock packaging.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">static diffs</p>
            <p className="mt-1 text-xl font-black text-ink">{replayReport.staticVersionDiffs}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">persisted diffs</p>
            <p className="mt-1 text-xl font-black text-ink">{replayReport.persistedRecoveryDiffs}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">replay rows</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.visualTeacherReviewDraftReplayRows}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">exported</p>
            <p className="mt-1 text-xl font-black text-ink">{replayReport.exportedReplayCount}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            {replayReport.rows.map((row) => (
              <article key={row.id} className="rounded-md border border-violet-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.source === "persisted_recovery_diff" ? "teal" : "neutral"}>{row.source}</Badge>
                  <Badge tone="neutral">
                    {row.fromVersionId ?? "baseline"} {"->"} {row.toVersionId}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-extrabold text-ink">{row.label}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-5 text-slate-700">
                  <p>changed: {row.changedItemIds.length}</p>
                  <p>focus: {row.nextTeachingFocusIds.length}</p>
                  <p>added follow-ups: {row.addedFollowUpItemIds.length}</p>
                  <p>removed follow-ups: {row.removedFollowUpItemIds.length}</p>
                </div>
                <div className="mt-3 rounded-md bg-violet-50 p-2 text-xs leading-5 text-violet-950">
                  <p className="font-bold">Replay steps</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {row.replaySteps.map((step) => (
                      <li key={`${row.id}-${step}`}>{step}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <textarea
            aria-label="teacher_review_draft_diff_recovery_replay_json_v1"
            readOnly
            value={replayReport.exportJson}
            className="min-h-80 rounded-md border border-violet-100 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
            <p className="font-extrabold text-ink">Allowed</p>
            <p className="mt-1">{replayReport.allowedActions.join(" / ")}</p>
          </div>
          <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
            <p className="font-extrabold text-ink">Blocked</p>
            <p className="mt-1">{replayReport.blockedActions.join(" / ")}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-teal-100 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">下一轮带教修正清单</Badge>
          <Badge tone="neutral">{followUpDraft.followUpItems.length} 项待继续教</Badge>
          <Badge tone="amber">仍是本地草稿</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-teal-950">
          当你把某些问题标成“需要修改”或“不确定”时，这里会自动汇总成下一轮可直接教 AI 的清单。
          这段文字可以作为后续对话的参考，但当前页面不会把它写入长期记忆。
        </p>
        <label className="mt-4 grid gap-2 text-xs font-bold uppercase text-slate-500">
          可复制给 AI 的本地草稿
          <textarea
            readOnly
            value={followUpDraft.text}
            className="min-h-52 rounded-md border border-teal-100 bg-white p-3 font-mono text-xs font-normal normal-case leading-5 text-ink outline-none"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveReviewDraft()}
            disabled={saveState === "saving"}
            className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-4" />
            保存老师审查草稿
          </button>
          <p
            className={`text-xs leading-5 ${
              saveState === "error" ? "text-rose-700" : saveState === "saved" ? "text-teal-800" : "text-slate-600"
            }`}
          >
            {saveMessage ||
              "保存后只形成可追踪审查记录和下一轮修正清单，不验收技术、不启用规则、不解锁封装。"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {worksheet.items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            {(() => {
              const decision = decisions[item.id] ?? "unreviewed";

              return (
                <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.evidenceReady ? "teal" : "amber"}>
                {item.evidenceReady ? "证据已准备" : "需要补证据"}
              </Badge>
              <Badge tone="amber">未回答</Badge>
              <Badge tone={signalTone(item.readinessSignal)}>{signalLabel(item.readinessSignal)}</Badge>
              <Badge tone={decision === "tentative_pass" ? "teal" : decision === "needs_change" ? "amber" : "neutral"}>
                本地：{reviewDecisionLabels[decision]}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.question}</p>
            <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.sourceIds.slice(0, 8).map((sourceId) => (
                <Badge key={`${item.id}-${sourceId}`} tone="neutral">
                  {sourceId}
                </Badge>
              ))}
            </div>

            <div className="mt-4 rounded-md bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">老师本地判断</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["tentative_pass", "needs_change", "unsure"] as const).map((option) => (
                  <button
                    key={`${item.id}-${option}`}
                    type="button"
                    onClick={() =>
                      setDecisions((current) => ({
                        ...current,
                        [item.id]: current[item.id] === option ? "unreviewed" : option
                      }))
                    }
                    className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                      decision === option
                        ? "border-apprentice-blue bg-blue-50 text-apprentice-blue"
                        : "border-line bg-white text-slate-600 hover:border-apprentice-blue/40"
                    }`}
                  >
                    {reviewDecisionLabels[option]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{reviewDecisionDescriptions[decision]}</p>
              <label className="mt-3 grid gap-1 text-xs font-bold uppercase text-slate-500">
                老师备注草稿
                <textarea
                  value={notes[item.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.id]: event.target.value
                    }))
                  }
                  placeholder="这里可以写：为什么暂定通过、哪里需要改、下一轮希望 AI 怎么调整。"
                  className="min-h-20 rounded-md border border-line bg-mist p-2 text-sm font-normal normal-case leading-6 text-ink outline-none focus:border-apprentice-blue"
                />
              </label>
            </div>
                </>
              );
            })()}
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          <p className="font-extrabold text-teal-950">审查期间允许做</p>
          <p className="mt-1">{worksheet.allowedActions.map(actionLabel).join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-apprentice-blue" />
            <p className="font-extrabold text-blue-950">仍然禁止</p>
          </div>
          <p className="mt-1">{worksheet.blockedActions.map(actionLabel).join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
