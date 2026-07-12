"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Save, ShieldCheck } from "lucide-react";
import { Badge, FieldLabel, PrimaryButton, Surface } from "@/components/ui";
import type { PublicBetaFeedbackDecision, PublicBetaFeedbackReceipt } from "@/server/productization/public-beta-feedback";

type SaveResult = {
  responseMode?: string;
  status?: string;
  saved?: boolean;
  dryRun?: boolean;
  failedChecks?: string[];
  inboxReceiptPath?: string;
  historyReceiptPath?: string;
  nextAction?: string;
  error?: string;
};

const decisions: Array<{ value: PublicBetaFeedbackDecision; label: string }> = [
  { value: "needs_fix_before_more_testers", label: "Needs fix" },
  { value: "ready_for_next_beta_tester", label: "Ready for next tester" },
  { value: "blocked", label: "Blocked" }
];

const booleanFields = [
  ["setup.couldStartProductRuntime", "Could start product runtime"],
  ["setup.healthEndpointHealthy", "Health endpoint was healthy"],
  ["setup.liveHandoffChecked", "Checked live handoff"],
  ["coreLoop.firstRunClear", "First run was clear"],
  ["coreLoop.traceUnderstandable", "Trace was understandable"],
  ["coreLoop.correctionSubmitted", "Submitted one correction"],
  ["coreLoop.ruleProvenanceVisible", "Rule provenance was visible"],
  ["coreLoop.rerunChangedBehavior", "Rerun behavior changed"],
  ["trustAndBoundaries.learnedBehaviorClear", "Learned behavior was clear"],
  ["trustAndBoundaries.reviewOnlyBoundaryClear", "Review-only boundary was clear"]
] as const;

const today = new Date().toISOString().slice(0, 10);

function setNestedBoolean(receipt: PublicBetaFeedbackReceipt, path: string, value: boolean): PublicBetaFeedbackReceipt {
  const [section, key] = path.split(".") as [
    "setup" | "coreLoop" | "trustAndBoundaries",
    string
  ];

  return {
    ...receipt,
    [section]: {
      ...(receipt[section] ?? {}),
      [key]: value
    }
  };
}

function hasBoolean(value: unknown) {
  return typeof value === "boolean";
}

function receiptFileName(receipt: PublicBetaFeedbackReceipt) {
  const tester = (receipt.tester?.name || "tester")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `public-beta-feedback-${receipt.tester?.date || today}-${tester || "tester"}.json`;
}

export function PublicBetaFeedbackWorkbench() {
  const [receipt, setReceipt] = useState<PublicBetaFeedbackReceipt>({
    responseMode: "public_beta_feedback_receipt_template_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaDecisionAllowedValues: decisions.map((decision) => decision.value),
    defaultBetaDecision: "needs_fix_before_more_testers",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    tester: {
      name: "",
      role: "",
      date: today,
      environment: ""
    },
    setup: {
      couldStartProductRuntime: null,
      healthEndpointHealthy: null,
      liveHandoffChecked: null,
      notes: ""
    },
    coreLoop: {
      firstRunClear: null,
      traceUnderstandable: null,
      correctionSubmitted: null,
      ruleProvenanceVisible: null,
      rerunChangedBehavior: null,
      notes: ""
    },
    trustAndBoundaries: {
      learnedBehaviorClear: null,
      reviewOnlyBoundaryClear: null,
      noReleaseOrAllSoftwareClaim: true,
      notes: ""
    },
    blockers: {
      blockingIssue: "",
      confusingWording: "",
      missingProductBehavior: "",
      screenshotOrEvidencePath: ""
    },
    betaDecision: "needs_fix_before_more_testers",
    nextActionRecommendation: "",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  });
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState(false);

  const completedChecks = useMemo(() => {
    return booleanFields.filter(([path]) => {
      const [section, key] = path.split(".") as [
        "setup" | "coreLoop" | "trustAndBoundaries",
        string
      ];
      return hasBoolean(receipt[section]?.[key as never]);
    }).length;
  }, [receipt]);

  const canSubmit =
    Boolean(receipt.tester?.name?.trim()) &&
    Boolean(receipt.tester?.environment?.trim()) &&
    completedChecks === booleanFields.length &&
    receipt.trustAndBoundaries?.noReleaseOrAllSoftwareClaim === true &&
    Boolean(receipt.nextActionRecommendation?.trim()) &&
    (receipt.betaDecision !== "blocked" || Boolean(receipt.blockers?.blockingIssue?.trim()));

  function updateTester(key: "name" | "role" | "date" | "environment", value: string) {
    setReceipt((current) => ({
      ...current,
      tester: {
        ...(current.tester ?? {}),
        [key]: value
      }
    }));
  }

  function updateText(
    section: "setup" | "coreLoop" | "trustAndBoundaries" | "blockers",
    key: string,
    value: string
  ) {
    setReceipt((current) => ({
      ...current,
      [section]: {
        ...(current[section] ?? {}),
        [key]: value
      }
    }));
  }

  async function submit(dryRun: boolean) {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/public-beta-feedback-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt, dryRun })
      });
      const payload = (await response.json()) as SaveResult;
      setResult(payload);
    } catch (error) {
      setResult({ status: "failed", error: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setBusy(false);
    }
  }

  function downloadReceipt() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = receiptFileName(receipt);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-apprentice-teal" />
            <h2 className="font-black text-ink">Feedback Receipt Builder</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Capture one bounded tester return as structured review-only evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">reviewOnly=true</Badge>
          <Badge tone="teal">accepted=false</Badge>
          <Badge tone="amber">releaseDecision=do_not_release</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="grid gap-2">
          <FieldLabel>Tester name</FieldLabel>
          <input
            value={receipt.tester?.name ?? ""}
            onChange={(event) => updateTester("name", event.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Role</FieldLabel>
          <input
            value={receipt.tester?.role ?? ""}
            onChange={(event) => updateTester("role", event.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Date</FieldLabel>
          <input
            type="date"
            value={receipt.tester?.date ?? today}
            onChange={(event) => updateTester("date", event.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2">
        <FieldLabel>Environment</FieldLabel>
        <input
          value={receipt.tester?.environment ?? ""}
          onChange={(event) => updateTester("environment", event.target.value)}
          placeholder="OS, browser, URL, branch, or device notes"
          className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
        />
      </label>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {booleanFields.map(([path, label]) => {
          const [section, key] = path.split(".") as [
            "setup" | "coreLoop" | "trustAndBoundaries",
            string
          ];
          const value = receipt[section]?.[key as never];
          return (
            <div key={path} className="flex items-center justify-between gap-3 rounded-md border border-line bg-mist p-3">
              <span className="text-sm font-semibold text-ink">{label}</span>
              <div className="flex rounded-md border border-line bg-white p-1">
                {[true, false].map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    onClick={() => setReceipt((current) => setNestedBoolean(current, path, option))}
                    className={`rounded px-3 py-1 text-xs font-bold ${
                      value === option ? "bg-apprentice-teal text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {option ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel>Core loop notes</FieldLabel>
          <textarea
            value={receipt.coreLoop?.notes ?? ""}
            onChange={(event) => updateText("coreLoop", "notes", event.target.value)}
            className="min-h-28 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Boundary notes</FieldLabel>
          <textarea
            value={receipt.trustAndBoundaries?.notes ?? ""}
            onChange={(event) => updateText("trustAndBoundaries", "notes", event.target.value)}
            className="min-h-28 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel>Beta decision</FieldLabel>
          <select
            value={receipt.betaDecision ?? "needs_fix_before_more_testers"}
            onChange={(event) =>
              setReceipt((current) => ({ ...current, betaDecision: event.target.value as PublicBetaFeedbackDecision }))
            }
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          >
            {decisions.map((decision) => (
              <option key={decision.value} value={decision.value}>
                {decision.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <FieldLabel>Next action recommendation</FieldLabel>
          <input
            value={receipt.nextActionRecommendation ?? ""}
            onChange={(event) =>
              setReceipt((current) => ({ ...current, nextActionRecommendation: event.target.value }))
            }
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="grid gap-2">
          <FieldLabel>Blocking issue</FieldLabel>
          <textarea
            value={receipt.blockers?.blockingIssue ?? ""}
            onChange={(event) => updateText("blockers", "blockingIssue", event.target.value)}
            className="min-h-24 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Confusing wording</FieldLabel>
          <textarea
            value={receipt.blockers?.confusingWording ?? ""}
            onChange={(event) => updateText("blockers", "confusingWording", event.target.value)}
            className="min-h-24 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Missing behavior</FieldLabel>
          <textarea
            value={receipt.blockers?.missingProductBehavior ?? ""}
            onChange={(event) => updateText("blockers", "missingProductBehavior", event.target.value)}
            className="min-h-24 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2">
        <FieldLabel>Screenshot or evidence path</FieldLabel>
        <input
          value={receipt.blockers?.screenshotOrEvidencePath ?? ""}
          onChange={(event) => updateText("blockers", "screenshotOrEvidencePath", event.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal-400"
        />
      </label>

      <label className="mt-4 flex items-start gap-3 rounded-md border border-line bg-mist p-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={receipt.trustAndBoundaries?.noReleaseOrAllSoftwareClaim === true}
          onChange={(event) =>
            setReceipt((current) => ({
              ...current,
              trustAndBoundaries: {
                ...(current.trustAndBoundaries ?? {}),
                noReleaseOrAllSoftwareClaim: event.target.checked
              }
            }))
          }
          className="mt-1"
        />
        <span>This feedback does not approve release, packaging, rule enablement, or all-software scope.</span>
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" onClick={() => submit(true)} disabled={busy || !canSubmit}>
          <CheckCircle2 className="mr-2 size-4" />
          Validate
        </PrimaryButton>
        <button
          type="button"
          onClick={downloadReceipt}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Download className="size-4" />
          Download JSON
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={busy || !canSubmit}
          className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          Save to inbox
        </button>
        <Badge tone={canSubmit ? "teal" : "amber"}>
          {completedChecks}/{booleanFields.length} checks
        </Badge>
      </div>

      {result ? (
        <div className="mt-4 rounded-md border border-line bg-mist p-3 text-sm leading-6 text-slate-700">
          <p className="font-extrabold text-ink">Receipt status: {result.status ?? "unknown"}</p>
          {result.inboxReceiptPath ? <p>Saved: {result.inboxReceiptPath}</p> : null}
          {result.historyReceiptPath ? <p>History: {result.historyReceiptPath}</p> : null}
          {result.failedChecks?.length ? <p>Failed checks: {result.failedChecks.join(", ")}</p> : null}
          {result.error ? <p>{result.error}</p> : null}
          {result.nextAction ? <p>{result.nextAction}</p> : null}
        </div>
      ) : null}
    </Surface>
  );
}
