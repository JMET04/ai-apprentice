"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  Save,
  TriangleAlert,
  XCircle
} from "lucide-react";
import { Badge, Surface } from "@/components/ui";

type StepStatus = "not_run" | "passed" | "failed";

type ManualTestStep = {
  id: string;
  title: string;
  role: string;
  route: string;
  expectedEvidence: string;
  stopIf: string;
};

type GateEvidence = {
  label: string;
  value: string;
  tone: "neutral" | "teal" | "amber" | "blue";
};

type StoredManualTestState = {
  statuses: Record<string, StepStatus>;
  notes: Record<string, string>;
  testerNote: string;
  reviewerName: string;
  humanReviewConfirmed: boolean;
};

type ManualAcceptanceReport = {
  format: "transparent_ai_apprentice_manual_acceptance_report_v1";
  generatedAt: string;
  summary: {
    passed: number;
    failed: number;
    notRun: number;
    readyForHumanTrial: boolean;
  };
  releaseBoundary: {
    reminder: string;
    evidence: GateEvidence[];
  };
  steps: Array<ManualTestStep & { status: StepStatus; note: string }>;
  testerNote: string;
  testerName: string;
};

const storageKey = "transparent-ai-apprentice:manual-test-v1";

const statusLabels: Record<StepStatus, string> = {
  not_run: "Not run",
  passed: "Passed",
  failed: "Blocked"
};

const statusStyles: Record<StepStatus, string> = {
  not_run: "border-slate-200 bg-white text-slate-600",
  passed: "border-teal-200 bg-teal-50 text-teal-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800"
};

export function ManualTestWorkbench({
  steps,
  gateEvidence
}: Readonly<{ steps: ManualTestStep[]; gateEvidence: GateEvidence[] }>) {
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [saveState, setSaveState] = useState<{
    status: "idle" | "saving" | "saved" | "failed";
    message: string;
  }>({ status: "idle", message: "" });
  const [state, setState] = useState<StoredManualTestState>({
    statuses: Object.fromEntries(steps.map((step) => [step.id, "not_run" as StepStatus])),
    notes: {},
    testerNote: "",
    reviewerName: "",
    humanReviewConfirmed: false
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      setIsStorageReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<StoredManualTestState>;
      setState({
        statuses: { ...Object.fromEntries(steps.map((step) => [step.id, "not_run" as StepStatus])), ...parsed.statuses },
        notes: parsed.notes ?? {},
        testerNote: parsed.testerNote ?? "",
        reviewerName: parsed.reviewerName ?? "",
        humanReviewConfirmed: parsed.humanReviewConfirmed ?? false
      });
    } catch {
      window.localStorage.removeItem(storageKey);
    }

    setIsStorageReady(true);
  }, [steps]);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [isStorageReady, state]);

  const summary = useMemo(() => {
    const statuses = steps.map((step) => state.statuses[step.id] ?? "not_run");
    const passed = statuses.filter((status) => status === "passed").length;
    const failed = statuses.filter((status) => status === "failed").length;
    const notRun = statuses.filter((status) => status === "not_run").length;
    const readyForHumanTrial = passed === steps.length && failed === 0;

    return { passed, failed, notRun, readyForHumanTrial };
  }, [state.statuses, steps]);

  function setStatus(stepId: string, status: StepStatus) {
    setState((current) => ({
      ...current,
      statuses: { ...current.statuses, [stepId]: status }
    }));
  }

  function setNote(stepId: string, note: string) {
    setState((current) => ({
      ...current,
      notes: { ...current.notes, [stepId]: note }
    }));
  }

  function reset() {
    setState({
      statuses: Object.fromEntries(steps.map((step) => [step.id, "not_run" as StepStatus])),
      notes: {},
      testerNote: "",
      reviewerName: "",
      humanReviewConfirmed: false
    });
    setSaveState({ status: "idle", message: "" });
  }

  function buildReport(): ManualAcceptanceReport {
    return {
      format: "transparent_ai_apprentice_manual_acceptance_report_v1",
      generatedAt: new Date().toISOString(),
      summary,
      releaseBoundary: {
        reminder: "Manual acceptance does not unlock packaging, release, automatic execution, or all-software goals.",
        evidence: gateEvidence
      },
      steps: steps.map((step) => ({
        id: step.id,
        title: step.title,
        role: step.role,
        route: step.route,
        status: state.statuses[step.id] ?? "not_run",
        expectedEvidence: step.expectedEvidence,
        stopIf: step.stopIf,
        note: state.notes[step.id] ?? ""
      })),
      testerNote: state.testerNote,
      testerName: state.reviewerName.trim()
    };
  }

  function downloadReport() {
    const report = buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transparent-ai-apprentice-manual-acceptance-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function saveReport() {
    const missingStepNotes = steps.filter((step) => !(state.notes[step.id] ?? "").trim());
    const reviewerName = state.reviewerName.trim();

    if (!summary.readyForHumanTrial || missingStepNotes.length > 0 || reviewerName.length < 2 || !state.humanReviewConfirmed) {
      setSaveState({
        status: "failed",
        message:
          "Human review evidence is incomplete. Pass every step, write a note for each step, enter reviewer name, and confirm the manual review attestation."
      });
      return;
    }

    const report = buildReport();
    setSaveState({ status: "saving", message: "Saving review-only human evidence..." });

    try {
      const response = await fetch("/api/manual-acceptance-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual-test-workbench",
          report,
          humanReviewEvidence: {
            responseMode: "manual_test_workbench_human_review_evidence_v1",
            reviewedAt: new Date().toISOString(),
            reviewerName,
            attestation: "human-reviewed-manual-test-workbench",
            savedFrom: "manual-test-workbench",
            stepCount: steps.length,
            passed: summary.passed,
            failed: summary.failed,
            notRun: summary.notRun
          }
        })
      });
      const result = (await response.json()) as {
        responseMode?: string;
        latestReportPath?: string;
        historyReportPath?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(result.error ?? "Save failed");

      setSaveState({
        status: "saved",
        message: `Saved review-only evidence to ${
          result.latestReportPath ?? "artifacts/productization/manual-acceptance-latest.json"
        }`
      });
    } catch (error) {
      setSaveState({
        status: "failed",
        message: error instanceof Error ? error.message : "Save failed"
      });
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]" data-manual-test-ready={isStorageReady}>
      <div className="grid gap-4">
        {steps.map((step, index) => {
          const currentStatus = state.statuses[step.id] ?? "not_run";

          return (
            <Surface key={step.id} className="border-slate-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-md bg-slate-900 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <Badge tone={currentStatus === "passed" ? "teal" : currentStatus === "failed" ? "amber" : "neutral"}>
                      {statusLabels[currentStatus]}
                    </Badge>
                    <span className="text-xs font-bold text-slate-500">{step.role}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-ink">{step.title}</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-line bg-mist p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Evidence to observe</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{step.expectedEvidence}</p>
                    </div>
                    <div className="rounded-md border border-amber-100 bg-amber-50 p-3">
                      <p className="text-xs font-bold uppercase text-amber-700">Stop condition</p>
                      <p className="mt-2 text-sm leading-6 text-amber-950">{step.stopIf}</p>
                    </div>
                  </div>
                </div>
                <Link
                  href={step.route}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  Open page
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["not_run", "passed", "failed"] as StepStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={!isStorageReady}
                    onClick={() => setStatus(step.id, status)}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ${
                      currentStatus === status ? statusStyles[status] : "border-line bg-white text-slate-500 hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {status === "passed" ? <CheckCircle2 className="size-4" /> : null}
                    {status === "failed" ? <XCircle className="size-4" /> : null}
                    {status === "not_run" ? <PlayCircle className="size-4" /> : null}
                    {statusLabels[status]}
                  </button>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase text-slate-500">Tester note</span>
                <textarea
                  value={state.notes[step.id] ?? ""}
                  disabled={!isStorageReady}
                  onChange={(event) => setNote(step.id, event.target.value)}
                  className="mt-2 min-h-20 w-full rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
                  placeholder="Record what you observed, what blocked you, or what another reviewer should verify."
                />
              </label>
            </Surface>
          );
        })}
      </div>

      <div className="grid h-fit gap-5 xl:sticky xl:top-24">
        <Surface className={summary.readyForHumanTrial ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-apprentice-teal" />
            <h2 className="font-black text-ink">Manual Review Status</h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-white p-3">
              <p className="text-2xl font-black text-teal-700">{summary.passed}</p>
              <p className="text-xs font-bold text-slate-500">Passed</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="text-2xl font-black text-rose-700">{summary.failed}</p>
              <p className="text-xs font-bold text-slate-500">Blocked</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <p className="text-2xl font-black text-slate-700">{summary.notRun}</p>
              <p className="text-xs font-bold text-slate-500">Not run</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            {summary.readyForHumanTrial
              ? "The bounded core path has enough human evidence to review before the next tester."
              : "Finish every step before expanding the test audience."}
          </p>
        </Surface>

        <Surface>
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-5 text-apprentice-amber" />
            <h2 className="font-black text-ink">Release Boundary</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {gateEvidence.map((item) => (
              <Badge key={item.label} tone={item.tone}>
                {item.label}: {item.value}
              </Badge>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            A passed manual review only supports another bounded test. It does not unlock packaging, release, automatic
            execution, or the paused all-software objective.
          </p>
        </Surface>

        <Surface>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-apprentice-blue" />
            <h2 className="font-black text-ink">Review Record</h2>
          </div>
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase text-slate-500">Reviewer name</span>
            <input
              value={state.reviewerName}
              onChange={(event) => setState((current) => ({ ...current, reviewerName: event.target.value }))}
              className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm font-bold text-ink outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
              placeholder="Enter the human tester name"
            />
          </label>
          <label className="mt-3 flex items-start gap-3 rounded-md border border-blue-100 bg-blue-50 p-3">
            <input
              type="checkbox"
              checked={state.humanReviewConfirmed}
              onChange={(event) =>
                setState((current) => ({ ...current, humanReviewConfirmed: event.target.checked }))
              }
              className="mt-1 size-4 accent-apprentice-teal"
            />
            <span className="text-sm font-semibold leading-6 text-blue-950">
              I manually reviewed this product path myself. Automated browser smoke cannot use this attestation as real
              acceptance evidence.
            </span>
          </label>
          <textarea
            value={state.testerNote}
            onChange={(event) => setState((current) => ({ ...current, testerNote: event.target.value }))}
            className="mt-4 min-h-36 w-full rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
            placeholder="Write whether another bounded tester should be invited, what needs fixing first, and what productization risk you noticed."
          />
          <button
            type="button"
            disabled={!isStorageReady}
            onClick={reset}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="size-4" />
            Reset record
          </button>
          <button
            type="button"
            disabled={!isStorageReady}
            onClick={downloadReport}
            className="ml-2 mt-3 inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-4" />
            Export report
          </button>
          <button
            type="button"
            data-testid="save-manual-acceptance-report"
            disabled={!isStorageReady || saveState.status === "saving"}
            onClick={saveReport}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 md:ml-2"
          >
            <Save className="size-4" />
            Save human evidence
          </button>
          {saveState.message ? (
            <p
              data-testid="manual-acceptance-save-status"
              className={`mt-3 rounded-md border p-3 text-sm font-semibold ${
                saveState.status === "failed"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-teal-200 bg-teal-50 text-teal-900"
              }`}
            >
              {saveState.message}
            </p>
          ) : null}
        </Surface>

        {summary.failed > 0 ? (
          <Surface className="border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-5 text-rose-700" />
              <p className="text-sm font-bold leading-6 text-rose-900">
                A blocked step should stop packaging, release, and any expansion to more external testers.
              </p>
            </div>
          </Surface>
        ) : null}
      </div>
    </div>
  );
}
