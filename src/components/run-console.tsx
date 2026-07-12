"use client";

import { useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  PlayCircle,
  RefreshCw
} from "lucide-react";
import type { CorrectionExtraction, ExecutionRunRecord } from "@/lib/types";
import { CorrectionLearningRecord } from "./correction-learning-record";
import { ExecutionPlanPanel } from "./execution-plan-panel";
import { TracePanel } from "./trace-panel";
import { Badge, FieldLabel, PrimaryButton, Surface } from "./ui";

function valueToText(value: unknown) {
  return Array.isArray(value) ? value.join(" / ") : String(value ?? "");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "Completed",
    needs_review: "Needs teacher review",
    failed: "Failed"
  };

  return labels[status] ?? status.replace("_", " ");
}

function appliedRuleTitles(run: ExecutionRunRecord) {
  return Array.from(new Set(run.trace.flatMap((step) => step.appliedRules.map((rule) => rule.title))));
}

function reviewPointCount(run: ExecutionRunRecord) {
  return run.trace.filter((step) => step.needsHumanReview).length;
}

function changedOutputFields(before: ExecutionRunRecord, after: ExecutionRunRecord) {
  return Object.entries(after.output)
    .map(([key, value]) => ({
      key,
      before: valueToText(before.output[key as keyof typeof before.output]),
      after: valueToText(value)
    }))
    .filter((item) => item.before !== item.after);
}

function MemoryPolicyControls({
  applyAutomatically,
  requiresHumanConfirmation,
  onApplyAutomaticallyChange,
  onRequiresHumanConfirmationChange
}: Readonly<{
  applyAutomatically: boolean;
  requiresHumanConfirmation: boolean;
  onApplyAutomaticallyChange: (value: boolean) => void;
  onRequiresHumanConfirmationChange: (value: boolean) => void;
}>) {
  return (
    <div className="mt-3 rounded-md border border-line bg-mist p-3">
      <p className="text-xs font-bold uppercase text-slate-500">Memory policy</p>
      <div className="mt-3 grid gap-2">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={applyAutomatically}
            onChange={(event) => onApplyAutomaticallyChange(event.target.checked)}
          />
          <span>
            <strong className="text-ink">Apply automatically on similar tasks</strong>
            <br />
            Let the apprentice reuse this correction when the condition matches.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={requiresHumanConfirmation}
            onChange={(event) => onRequiresHumanConfirmationChange(event.target.checked)}
          />
          <span>
            <strong className="text-ink">Require teacher confirmation before enabling</strong>
            <br />
            Save the rule as review-gated memory until a teacher explicitly enables it.
          </span>
        </label>
      </div>
    </div>
  );
}

function FirstRunGuide({
  isRunPersisted,
  hasSavedLearning,
  hasRerun
}: Readonly<{ isRunPersisted: boolean; hasSavedLearning: boolean; hasRerun: boolean }>) {
  const steps = [
    {
      title: "Generate a traceable run",
      detail: "Save one real run so later corrections can point back to execution evidence.",
      done: isRunPersisted,
      icon: PlayCircle
    },
    {
      title: "Correct like a teacher",
      detail: "Write one natural-language correction and turn it into a reusable rule draft.",
      done: hasSavedLearning,
      icon: MessageSquareText
    },
    {
      title: "Rerun with the new rule",
      detail: "Look for explainable changes in output fields, applied rules, and review points.",
      done: hasRerun,
      icon: RefreshCw
    },
    {
      title: "Record the result",
      detail: "Return to the manual checklist and save whether this path passed or blocked you.",
      done: hasRerun,
      icon: ClipboardCheck
    }
  ];

  return (
    <Surface className="border-teal-100 bg-gradient-to-br from-white via-white to-teal-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">First run guide</Badge>
            <Badge tone="amber">Does not unlock release</Badge>
          </div>
          <h2 className="mt-3 text-xl font-black text-ink">Complete one reviewable teaching loop.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This page tests one bounded task. Run it, correct it, rerun it, and preserve the result as human review
            evidence. Packaging, release, and all-software automation stay locked.
          </p>
        </div>
        <a
          href="/manual-test"
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Open checklist
          <ClipboardCheck className="size-4" />
        </a>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-md border border-line bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-8 place-items-center rounded-md bg-mist text-xs font-black text-slate-700">
                {index + 1}
              </span>
              {step.done ? <CheckCircle2 className="size-5 text-apprentice-teal" /> : <step.icon className="size-5 text-slate-400" />}
            </div>
            <p className="mt-3 font-black text-ink">{step.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function ImprovementEvidence({
  beforeRun,
  afterRun
}: Readonly<{
  beforeRun: ExecutionRunRecord | null;
  afterRun: ExecutionRunRecord;
}>) {
  if (!beforeRun) return null;

  const changes = changedOutputFields(beforeRun, afterRun);
  const beforeRules = appliedRuleTitles(beforeRun);
  const afterRules = appliedRuleTitles(afterRun);
  const newRules = afterRules.filter((rule) => !beforeRules.includes(rule));
  const beforeReviewPoints = reviewPointCount(beforeRun);
  const afterReviewPoints = reviewPointCount(afterRun);

  return (
    <Surface>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="size-4" />
        </span>
        <div>
          <h2 className="font-extrabold text-ink">Learning Improvement Evidence</h2>
          <p className="text-sm text-slate-500">
            Compare output before and after the saved correction to decide whether the rule helped.
          </p>
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Before learning</p>
          <p className="mt-1 font-bold text-ink">{beforeRun.output.lightingCondition}</p>
          <p className="mt-1 text-slate-600">{beforeReviewPoints} review points</p>
        </div>
        <div className="rounded-md bg-teal-50 p-3 text-teal-950">
          <p className="text-xs font-bold uppercase text-teal-700">After learning</p>
          <p className="mt-1 font-bold">{afterRun.output.lightingCondition}</p>
          <p className="mt-1">{afterReviewPoints} review points</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {changes.length > 0 ? (
          changes.slice(0, 4).map((change) => (
            <div key={change.key} className="rounded-md border border-line bg-white p-3 text-sm">
              <p className="font-bold text-ink">{change.key}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <p className="rounded-md bg-mist p-2 text-slate-600">{change.before}</p>
                <ArrowRight className="mx-auto hidden size-4 text-apprentice-teal sm:block" />
                <p className="rounded-md bg-teal-50 p-2 text-teal-900">{change.after}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
            No output fields changed. Review the trace and decide whether another correction is needed.
          </p>
        )}
      </div>

      {newRules.length > 0 ? (
        <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-bold">Newly applied memory</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {newRules.map((rule) => (
              <Badge key={rule} tone="teal">
                {rule}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

export function RunConsole({
  initialRun,
  taskId,
  apprenticeId,
  inputExample
}: Readonly<{
  initialRun: ExecutionRunRecord;
  taskId: string;
  apprenticeId: string;
  inputExample: string;
}>) {
  const [input, setInput] = useState(inputExample);
  const [run, setRun] = useState(initialRun);
  const [isRunPersisted, setIsRunPersisted] = useState(false);
  const [previousRun, setPreviousRun] = useState<ExecutionRunRecord | null>(null);
  const [feedback, setFeedback] = useState(
    "When the travel note mentions sunset, dusk, golden hour, warm rim light, or evening light, set lightingCondition to golden hour and include soft side-light or backlight advice."
  );
  const [applyCorrectionAutomatically, setApplyCorrectionAutomatically] = useState(true);
  const [requireCorrectionConfirmation, setRequireCorrectionConfirmation] = useState(false);
  const [extraction, setExtraction] = useState<CorrectionExtraction | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const hasSavedLearning = Boolean(extraction);
  const hasRerunAfterLearning = Boolean(previousRun && hasSavedLearning);

  async function execute(overrideInput?: string) {
    setIsRunning(true);
    const runInput = overrideInput ?? input;
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: runInput, taskId, apprenticeId })
    });
    const nextRun = (await response.json()) as ExecutionRunRecord;
    setPreviousRun(run);
    if (overrideInput !== undefined) setInput(overrideInput);
    setRun(nextRun);
    setIsRunPersisted(true);
    setIsRunning(false);
  }

  async function extractRule() {
    if (!isRunPersisted) return;

    setIsExtracting(true);
    const response = await fetch("/api/corrections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feedback,
        beforeOutput: run.output,
        memoryPolicy: {
          applyAutomatically: applyCorrectionAutomatically,
          requiresHumanConfirmation: requireCorrectionConfirmation
        },
        runId: run.id,
        taskId,
        apprenticeId
      })
    });
    setExtraction(await response.json());
    setIsExtracting(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
      <div className="xl:col-span-2">
        <FirstRunGuide
          isRunPersisted={isRunPersisted}
          hasSavedLearning={hasSavedLearning}
          hasRerun={hasRerunAfterLearning}
        />
      </div>

      <div className="space-y-5">
        <Surface>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-teal-50 text-apprentice-teal">
              <Brain className="size-4" />
            </span>
            <div>
              <h2 className="font-extrabold text-ink">Run the AI apprentice</h2>
              <p className="text-sm text-slate-500">Execute the task and inspect public structured trace evidence.</p>
            </div>
          </div>
          <FieldLabel>Travel note input</FieldLabel>
          <textarea
            className="mt-2 min-h-36 w-full rounded-md border border-line px-3 py-2 text-sm"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <PrimaryButton className="mt-3 w-full" onClick={() => execute()} disabled={isRunning}>
            <PlayCircle className="mr-2 size-4" />
            {isRunning ? "Running..." : "Generate transparent run"}
          </PrimaryButton>
          {!isRunPersisted ? (
            <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-bold leading-5 text-amber-900">
              This is only the initial preview. Generate a transparent run before saving a correction so learning can
              point back to real execution history.
            </p>
          ) : (
            <p className="mt-3 rounded-md bg-teal-50 p-2 text-xs font-bold leading-5 text-teal-900">
              Run saved. Corrections from this page will link back to this execution trace.
            </p>
          )}
        </Surface>

        <ImprovementEvidence beforeRun={previousRun} afterRun={run} />

        <Surface>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold text-ink">Structured Output</h2>
            <Badge tone={run.status === "needs_review" ? "amber" : "teal"}>{statusLabel(run.status)}</Badge>
          </div>
          <dl className="space-y-2 text-sm">
            {Object.entries(run.output).map(([key, value]) => (
              <div key={key} className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">{key}</dt>
                <dd className="mt-1 text-slate-800">{Array.isArray(value) ? value.join(" / ") : value}</dd>
              </div>
            ))}
          </dl>
        </Surface>

        <Surface>
          <h2 className="font-extrabold text-ink">Teacher Correction</h2>
          <p className="mt-1 text-sm text-slate-500">
            Correct one result like a teacher. The system extracts a reusable rule draft with visible evidence.
          </p>
          <textarea
            className="mt-3 min-h-28 w-full rounded-md border border-line px-3 py-2 text-sm"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <MemoryPolicyControls
            applyAutomatically={applyCorrectionAutomatically}
            requiresHumanConfirmation={requireCorrectionConfirmation}
            onApplyAutomaticallyChange={(value) => {
              setApplyCorrectionAutomatically(value);
              if (value) setRequireCorrectionConfirmation(false);
            }}
            onRequiresHumanConfirmationChange={(value) => {
              setRequireCorrectionConfirmation(value);
              if (value) setApplyCorrectionAutomatically(false);
            }}
          />
          <PrimaryButton className="mt-3 w-full" onClick={extractRule} disabled={isExtracting || !isRunPersisted}>
            {isExtracting ? "Saving memory..." : "Save correction as rule evidence"}
          </PrimaryButton>
          {!isRunPersisted ? (
            <p className="mt-2 text-xs font-bold text-amber-700">
              Generate a transparent run first so the correction has a traceable source.
            </p>
          ) : null}
          {extraction ? (
            <>
              <CorrectionLearningRecord extraction={extraction} taskId={taskId} sourceRunId={run.id} />
              <PrimaryButton className="mt-3 w-full" onClick={() => execute()} disabled={isRunning}>
                <RefreshCw className="mr-2 size-4" />
                Rerun with saved learning
              </PrimaryButton>
            </>
          ) : null}
        </Surface>
      </div>

      <div className="space-y-5">
        <ExecutionPlanPanel trace={run.trace} />
        <TracePanel trace={run.trace} />
      </div>
    </div>
  );
}
