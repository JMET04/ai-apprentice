import { ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

const compactAcceptanceEvidenceStages = [
  {
    label: "Teacher acceptance agenda decision replay",
    schema: "teacher_acceptance_agenda_decision_replay_json_v1"
  },
  {
    label: "Teacher acceptance agenda decision draft recovery",
    schema: "teacher_acceptance_agenda_decision_draft_recovery_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review queue",
    schema: "teacher_acceptance_agenda_next_review_queue_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt decision replay",
    schema: "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt follow-up plan",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt follow-up lock audit",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification packet",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result template",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result validation",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run audit",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt template",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template",
    schema: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review handoff",
    schema: "teacher_acceptance_agenda_next_review_handoff_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review runbook",
    schema: "teacher_acceptance_agenda_next_review_runbook_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review dry-run audit",
    schema: "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt template",
    schema: "teacher_acceptance_agenda_next_review_receipt_template_json_v1"
  },
  {
    label: "Teacher acceptance agenda next review receipt validation",
    schema: "teacher_acceptance_agenda_next_review_receipt_validation_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
  },
  {
    label:
      "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template",
    schema:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  }
] as const;

function workLabel(item: string) {
  const labels: Record<string, string> = {
    "Visual learning review": "Review visual learning",
    "Evidence inspection": "Inspect evidence",
    "Verifier rerun": "Rerun verifier",
    Packaging: "Packaging",
    Release: "Release",
    Wrapping: "Wrapping"
  };

  return labels[item] ?? item;
}

export function TeacherAcceptanceBoundaryPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const boundary = report.teacherAcceptanceBoundary;
  const agenda = report.teacherAcceptanceEvidenceAgenda;
  const decisionExchange = agenda.decisionExchange;
  const complete = report.summary.acceptanceBoundaryPassed === report.summary.acceptanceBoundaryTotal;

  return (
    <Surface className="border-amber-200 bg-amber-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={complete ? "teal" : "amber"}>
            {report.summary.acceptanceBoundaryPassed}/{report.summary.acceptanceBoundaryTotal} boundary checks
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">Teacher acceptance boundary</h3>
          <p className="sr-only">老师验收边界</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            This is a review-only preview. It keeps acceptance, rule enablement, packaging, release, and wrapping locked
            until the teacher explicitly accepts the technology.
          </p>
        </div>
        <LockKeyhole className="size-5 text-apprentice-amber" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[280px_1fr_1fr]">
        <div className="rounded-md border border-amber-100 bg-white p-4 text-sm">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
            <div className="min-w-0">
              <p className="font-extrabold text-ink">Current mode</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="blue">{boundary.mode}</Badge>
                <Badge tone="amber">awaiting teacher</Badge>
                <Badge tone="neutral">accepted: {boundary.accepted ? "yes" : "no"}</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                No acceptance button is exposed on this page.
              </p>
              <p className="sr-only">这个页面不提供验收按钮</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-sm font-extrabold text-ink">Allowed during review</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {boundary.allowedWork.map((item) => (
              <Badge key={item} tone="teal">
                {workLabel(item)}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">{boundary.reason}</p>
        </div>

        <div className="rounded-md border border-amber-100 bg-white p-4">
          <p className="text-sm font-extrabold text-ink">Blocked before acceptance</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {boundary.blockedWork.map((item) => (
              <Badge key={item} tone="amber">
                {workLabel(item)}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Exposed acceptance action: {boundary.exposedAcceptanceAction ? "yes" : "no"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-amber-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Teacher acceptance evidence agenda</Badge>
          <Badge tone="neutral">{agenda.mode}</Badge>
          <Badge tone={agenda.packagingGated ? "neutral" : "amber"}>
            {agenda.packagingGated ? "packaging gated" : "packaging open"}
          </Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{agenda.teacherQuestion}</p>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">items</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.teacherAcceptanceAgendaItems}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">ready</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.teacherAcceptanceAgendaReady}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">unanswered</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.teacherAcceptanceAgendaUnanswered}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">locked</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.teacherAcceptanceAgendaLocked}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {agenda.items.map((item) => (
            <article key={item.id} className="rounded-md border border-line bg-mist p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.readiness === "ready_for_teacher_decision" ? "teal" : "amber"}>
                  {item.readiness}
                </Badge>
                <Badge tone="neutral">{item.evidencePath}</Badge>
              </div>
              <p className="mt-2 font-extrabold text-ink">{item.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-700">{item.evidenceSummary}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">teacher decision needed</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{item.teacherDecisionNeeded}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-amber-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Teacher acceptance agenda decision exchange</Badge>
          <Badge tone="neutral">{decisionExchange.format}</Badge>
          <Badge tone="neutral">{decisionExchange.itemCount} rows</Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{decisionExchange.teacherQuestion}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {decisionExchange.items.map((item) => (
            <article key={item.agendaItemId} className="rounded-md border border-line bg-mist p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{item.currentReadiness}</Badge>
                <Badge tone={item.proposedDecision === "ready_for_review" ? "teal" : "amber"}>
                  {item.proposedDecision}
                </Badge>
              </div>
              <p className="mt-2 font-extrabold text-ink">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{item.teacherQuestion}</p>
              <p className="mt-2 rounded-md bg-white p-3 text-xs leading-5 text-slate-700">{item.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-amber-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">teacher_acceptance_evidence_gap_agenda_json_v1</Badge>
          <Badge tone="amber">teacher_acceptance_agenda_decision_json_v1</Badge>
          <Badge tone="neutral">visual_learning_review_only</Badge>
          <Badge tone="neutral">review-only lock ledger</Badge>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {compactAcceptanceEvidenceStages.map((stage) => (
            <div key={stage.schema} className="rounded-md bg-amber-50 p-3">
              <p className="text-xs font-extrabold text-ink">{stage.label}</p>
              <p className="mt-1 break-words text-[11px] leading-4 text-slate-600">{stage.schema}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-extrabold">Deep handoff packet is not embedded in the task page</p>
            <p className="mt-2 leading-6">
              The large review-only runbooks, receipt templates, replays, and verification packets remain machine
              inspectable through the qualification endpoint. Keeping them out of the page prevents the product UI from
              becoming unusably large.
            </p>
            <a
              href={`/api/tasks/${report.taskId}/qualification?view=full`}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-bold text-amber-950"
            >
              Open full local report <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </Surface>
  );
}
