import { Download, Headphones } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function yesNo(value: boolean | null) {
  if (value === null) return "not recorded";
  return value ? "yes" : "no";
}

export function VoiceBrowserCompatibilityComparisonPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const comparison = report.voiceBrowserCompatibilityComparisonReport;
  const batchDiff = report.voiceBrowserCompatibilityBatchDiffReport;

  return (
    <Surface className="border-cyan-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={comparison.passed ? "teal" : "amber"}>
              {report.summary.voiceBrowserCompatibilityComparisonBrowsers} browsers
            </Badge>
            <Badge tone="neutral">{comparison.mode}</Badge>
            <Badge tone="amber">voiceOnlyMemoryEnabled=false</Badge>
            <Badge tone="amber">accepted=false</Badge>
            <Badge tone="amber">packagingGated=true</Badge>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-ink">Voice Browser Compatibility Comparison</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Saved runtime checks are compared with the static browser audit, then exported as a review-only JSON
            payload. Missing browser rows stay visible as audit-only evidence instead of becoming acceptance proof.
          </p>
        </div>
        <Headphones className="size-5 text-cyan-700" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">saved reviews</p>
          <p className="mt-1 text-xl font-black text-ink">{comparison.persistedReviewCount}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">fallback tested</p>
          <p className="mt-1 text-xl font-black text-ink">{comparison.fallbackTestedBrowsers}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">export format</p>
          <p className="mt-1 break-words text-xs font-black text-ink">{comparison.format}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">status</p>
          <p className="mt-1 text-sm font-black text-ink">{comparison.status}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {comparison.items.map((item) => (
          <article key={item.browser} className="rounded-md border border-cyan-100 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-extrabold text-ink">{item.browser}</p>
              <Badge tone={item.evidenceStatus === "runtime_review_saved" ? "teal" : "amber"}>
                {item.evidenceStatus}
              </Badge>
            </div>
            <p className="mt-2 text-slate-700">{item.plannedSupport.platformScope}</p>
            <p className="mt-2">recognition: {item.plannedSupport.speechRecognitionSupport}</p>
            <p>synthesis: {item.plannedSupport.speechSynthesisSupport}</p>
            <p>voice list: {item.plannedSupport.voiceListReliability}</p>
            <p>Chinese voice risk: {item.plannedSupport.chineseVoiceRisk}</p>
            <div className="mt-3 rounded-md bg-white p-2">
              <p>runtime recognition: {yesNo(item.runtimeRecognitionAvailable)}</p>
              <p>runtime synthesis: {yesNo(item.runtimeSynthesisAvailable)}</p>
              <p>voices: {item.runtimeVoiceCount ?? "not recorded"}</p>
              <p>zh voices: {item.runtimeChineseVoiceCount ?? "not recorded"}</p>
              <p>fallback tested: {yesNo(item.transcriptFallbackTested)}</p>
            </div>
            <p className="mt-2 font-bold text-cyan-900">{item.plannedSupport.requiredFallback}</p>
            {item.teacherNotes.length > 0 ? (
              <p className="mt-2 rounded-md bg-white p-2 text-slate-700">{item.teacherNotes[0]}</p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md bg-cyan-50 p-3 text-sm leading-6 text-cyan-950">
          <div className="flex items-center gap-2">
            <Download className="size-4 text-cyan-700" />
            <p className="font-extrabold text-ink">Review Export</p>
          </div>
          <p className="mt-2">{comparison.teacherQuestion}</p>
          <p className="mt-3 font-bold">Allowed</p>
          <p>{comparison.allowedActions.join(" / ")}</p>
          <p className="mt-3 font-bold">Blocked</p>
          <p>{comparison.blockedActions.join(" / ")}</p>
        </div>
        <textarea
          aria-label="voice_browser_runtime_review_export_json_v1"
          className="min-h-72 w-full resize-y rounded-md border border-cyan-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
          readOnly
          value={comparison.exportJson}
        />
      </div>

      <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">Runtime batch gap diff</Badge>
          <Badge tone="neutral">{batchDiff.mode}</Badge>
          <Badge tone={batchDiff.passed ? "teal" : "amber"}>{batchDiff.format}</Badge>
          <Badge tone="amber">voiceOnlyMemoryEnabled=false</Badge>
          <Badge tone="amber">accepted=false</Badge>
          <Badge tone="amber">packagingGated=true</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-blue-950">
          Missing runtime reviews and static/runtime differences are exported as a batch completion worksheet. This
          stays review-only evidence and cannot enable voice-only memory or packaging.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">rows</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.voiceBrowserCompatibilityBatchDiffRows}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">missing reviews</p>
            <p className="mt-1 text-xl font-black text-ink">{batchDiff.missingRuntimeReviews}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">runtime diffs</p>
            <p className="mt-1 text-xl font-black text-ink">{batchDiff.runtimeDiffs}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">fallback gaps</p>
            <p className="mt-1 text-xl font-black text-ink">{batchDiff.fallbackGaps}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {batchDiff.rows.map((row) => (
            <article key={row.browser} className="rounded-md border border-blue-100 bg-white p-3 text-xs leading-5 text-blue-950">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold text-ink">{row.browser}</p>
                <Badge tone={row.completionStatus === "runtime_review_saved" ? "teal" : "amber"}>
                  {row.completionStatus}
                </Badge>
              </div>
              <p className="mt-2">static recognition: {row.staticRecognitionSupport}</p>
              <p>runtime recognition: {yesNo(row.runtimeRecognitionAvailable)}</p>
              <p>static synthesis: {row.staticSynthesisSupport}</p>
              <p>runtime synthesis: {yesNo(row.runtimeSynthesisAvailable)}</p>
              <p>zh voice risk: {row.staticChineseVoiceRisk}</p>
              <p>runtime zh voices: {row.runtimeChineseVoiceCount ?? "not recorded"}</p>
              <p className="mt-2 font-bold text-blue-900">missing fields: {row.missingRuntimeFields.length}</p>
              <p className="font-bold text-blue-900">diff flags: {row.diffFlags.length}</p>
              <p className="mt-2 rounded-md bg-blue-50 p-2 text-blue-950">{row.completionPrompt}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-2 text-xs font-bold uppercase text-slate-500">
            Batch completion template
            <textarea
              aria-label="voice_browser_runtime_batch_gap_diff_template_json_v1"
              className="min-h-72 w-full resize-y rounded-md border border-blue-100 bg-white p-3 font-mono text-xs font-normal normal-case leading-5 text-slate-700 outline-none"
              readOnly
              value={batchDiff.batchCompletionTemplateJson}
            />
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase text-slate-500">
            Batch gap diff export
            <textarea
              aria-label="voice_browser_runtime_batch_gap_diff_json_v1"
              className="min-h-72 w-full resize-y rounded-md border border-blue-100 bg-white p-3 font-mono text-xs font-normal normal-case leading-5 text-slate-700 outline-none"
              readOnly
              value={batchDiff.exportJson}
            />
          </label>
        </div>
      </div>
    </Surface>
  );
}
