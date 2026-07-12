"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Badge, Surface } from "@/components/ui";
import type { TeacherTrialFeedbackDecision, TeacherTrialFeedbackItem } from "@/lib/teacher-trial-feedback-draft";

const trialDecisionLabels: Record<TeacherTrialFeedbackDecision, string> = {
  works: "Works",
  needs_change: "Needs change",
  blocked: "Blocked",
  not_tried: "Not tried"
};

const trialRoutes: TeacherTrialFeedbackItem[] = [
  {
    id: "task-detail",
    label: "Task detail review",
    route: "/tasks/task-photo-travel-journal",
    expectedEvidence: "The teacher can inspect task goal, workflow evidence, learning loop, review panels, and packaging lock.",
    decision: "not_tried",
    note: ""
  },
  {
    id: "run-and-correct",
    label: "Run and correction flow",
    route: "/tasks/task-photo-travel-journal/run",
    expectedEvidence: "The teacher can run the task, inspect public trace, and save a correction as reusable review memory.",
    decision: "not_tried",
    note: ""
  },
  {
    id: "visual-teaching",
    label: "Visual teaching flow",
    route: "/tasks/task-photo-travel-journal/teach",
    expectedEvidence: "The teacher can edit the visual workflow and keep execution trace aligned to nodes.",
    decision: "not_tried",
    note: ""
  },
  {
    id: "review-exports",
    label: "Review exports and handoffs",
    route: "/tasks/task-photo-travel-journal",
    expectedEvidence: "The teacher can copy review-only JSON packets without accepting technology or unlocking packaging.",
    decision: "not_tried",
    note: ""
  }
];

export function TeacherTrialFeedbackPanel({
  apprenticeId,
  taskId
}: Readonly<{
  apprenticeId: string;
  taskId: string;
}>) {
  const [items, setItems] = useState<TeacherTrialFeedbackItem[]>(
    trialRoutes.map((item) => ({ ...item, route: item.route.replace("task-photo-travel-journal", taskId) }))
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("Record hands-on trial feedback without accepting technology.");

  const nextReviewPlan = useMemo(() => {
    const followUps = items.filter((item) => item.decision !== "works");

    return followUps.length > 0
      ? `Continue product review on: ${followUps.map((item) => item.label).join(", ")}. Packaging remains locked.`
      : "All trial routes were marked works, but this is still review-only and not technology acceptance.";
  }, [items]);

  function updateItem(id: string, patch: Partial<TeacherTrialFeedbackItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function saveDraft() {
    setSaveState("saving");
    setMessage("Saving review-only trial feedback...");

    try {
      const response = await fetch("/api/teacher-trial-feedback-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId,
          taskId,
          items,
          nextReviewPlan
        })
      });
      const result = (await response.json()) as {
        error?: string;
        draft?: { learningTrace?: unknown[]; afterOutput?: { followUpItems?: unknown[] } };
        ruleEnabled?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save trial feedback.");
      }

      setSaveState("saved");
      setMessage(
        result.ruleEnabled === false && result.accepted === false && result.packagingGated === true
          ? `Saved trial receipt with ${result.draft?.learningTrace?.length ?? 0} public trace steps and ${result.draft?.afterOutput?.followUpItems?.length ?? 0} follow-up routes; packaging remains locked. Refresh to see it in learning evidence.`
          : "Saved, but please recheck the acceptance and packaging boundary."
      );
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Failed to save trial feedback.");
    }
  }

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">Hands-on trial receipt</Badge>
          <h3 className="mt-3 text-xl font-black text-ink">Teacher trial feedback</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Record what happened while trying the preview package. This creates review-only evidence; it does not enable
            rules, accept the technology, package, release, wrap, or unlock packaging.
          </p>
        </div>
        <Badge tone="amber">accepted=false / packagingGated=true</Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.decision === "works" ? "teal" : "amber"}>
                {trialDecisionLabels[item.decision]}
              </Badge>
              <Badge tone="neutral">{item.route}</Badge>
            </div>
            <p className="mt-2 font-extrabold text-ink">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{item.expectedEvidence}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(Object.keys(trialDecisionLabels) as TeacherTrialFeedbackDecision[]).map((decision) => (
                <label key={decision} className="flex cursor-pointer gap-2 rounded-md border border-line bg-white p-2 text-xs text-slate-700">
                  <input
                    type="radio"
                    name={`trial-feedback-${item.id}`}
                    value={decision}
                    checked={item.decision === decision}
                    onChange={() => updateItem(item.id, { decision })}
                  />
                  <span>{trialDecisionLabels[decision]}</span>
                </label>
              ))}
            </div>
            <textarea
              value={item.note}
              onChange={(event) => updateItem(item.id, { note: event.target.value })}
              placeholder="Observed evidence, blocker, or next review note..."
              className="mt-3 min-h-20 w-full resize-y rounded-md border border-line bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-apprentice-blue"
            />
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-teal-100 bg-teal-50 p-3">
        <p className="text-xs font-bold uppercase text-teal-900">Next review plan</p>
        <p className="mt-1 text-sm leading-6 text-teal-950">{nextReviewPlan}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveDraft()}
          disabled={saveState === "saving"}
          className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {saveState === "saving" ? "Saving..." : "Save trial feedback"}
        </button>
        <p
          className={`text-xs leading-5 ${
            saveState === "error" ? "text-rose-700" : saveState === "saved" ? "text-teal-800" : "text-slate-600"
          }`}
        >
          {message}
        </p>
      </div>
    </Surface>
  );
}
