"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import type { QualificationTeacherAcceptanceAgendaDecisionExchange } from "@/server/qualification/learning-report";

export function TeacherAcceptanceAgendaDraftControl({
  apprenticeId,
  taskId,
  decisionExchange
}: Readonly<{
  apprenticeId: string;
  taskId: string;
  decisionExchange: QualificationTeacherAcceptanceAgendaDecisionExchange;
}>) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("Save the current agenda decisions as review-only evidence.");
  const nextReviewPlan = useMemo(() => {
    const followUps = decisionExchange.items.filter((item) => item.proposedDecision !== "ready_for_review");

    return followUps.length > 0
      ? `Continue teacher review on: ${followUps.map((item) => item.label).join(", ")}. Packaging remains locked.`
      : "Agenda decisions are ready for teacher review notes, but this is not technology acceptance.";
  }, [decisionExchange.items]);

  async function saveDraft() {
    setSaveState("saving");
    setMessage("Saving review-only agenda decision draft...");

    try {
      const response = await fetch("/api/teacher-acceptance-agenda-decision-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId,
          taskId,
          nextReviewPlan,
          items: decisionExchange.items.map((item) => ({
            agendaItemId: item.agendaItemId,
            label: item.label,
            evidencePath: item.evidencePath,
            currentReadiness: item.currentReadiness,
            decision: item.proposedDecision,
            note: item.note,
            teacherQuestion: item.teacherQuestion
          }))
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
        throw new Error(result.error ?? "Failed to save agenda decision draft.");
      }

      setSaveState("saved");
      setMessage(
        result.ruleEnabled === false && result.accepted === false && result.packagingGated === true
          ? `Saved agenda decision draft with ${result.draft?.learningTrace?.length ?? 0} public trace steps and ${result.draft?.afterOutput?.followUpItems?.length ?? 0} follow-up rows; packaging remains locked. Refresh to recover it.`
          : "Saved, but please recheck the acceptance and packaging boundary."
      );
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Failed to save agenda decision draft.");
    }
  }

  return (
    <div className="mt-4 rounded-md border border-amber-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveDraft()}
          disabled={saveState === "saving"}
          className="inline-flex items-center gap-2 rounded-md bg-apprentice-amber px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {saveState === "saving" ? "Saving..." : "Save agenda decision draft"}
        </button>
        <p
          className={`text-xs leading-5 ${
            saveState === "error" ? "text-rose-700" : saveState === "saved" ? "text-teal-800" : "text-slate-600"
          }`}
        >
          {message}
        </p>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        This stores a disabled correction record only: `ruleEnabled=false`, `accepted=false`, `packagingGated=true`.
      </p>
    </div>
  );
}
