import { BrainCircuit, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

const compactEvidenceStages = [
  {
    label: "Codex capability transplant rehearsal",
    schema: "codex_capability_transplant_rehearsal_json_v1"
  },
  {
    label: "Codex capability transplant rehearsal result template",
    schema: "codex_capability_transplant_rehearsal_result_template_json_v1"
  },
  {
    label: "result validation replay",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_json_v1"
  },
  {
    label: "result replay next review queue",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1"
  },
  {
    label: "result replay queue handoff",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1"
  },
  {
    label: "result replay queue handoff runbook",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run audit",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt template",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation replay",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation replay queue",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation replay queue handoff",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
  },
  {
    label: "result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
  },
  {
    label: "receipt validation",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
  },
  {
    label: "receipt validation replay",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
  },
  {
    label: "receipt validation replay queue",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
  },
  {
    label: "receipt validation replay queue handoff",
    schema: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
  }
] as const;

export function CodexCapabilityTransferPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const transfer = report.codexCapabilityTransferReport;
  const transplantRows = transfer.transplantDraft?.rows ?? [];

  return (
    <Surface className="border-blue-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={transfer.passed ? "blue" : "amber"}>
            {report.summary.codexCapabilityTransferReady}/{report.summary.codexCapabilityTransferItems} transfer patterns
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">Codex capability transfer review</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            This page shows the usable review summary only. The full nested transfer packet is available through the
            qualification API for local deep inspection, but it is intentionally not embedded in the task page.
          </p>
        </div>
        <BrainCircuit className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">items</p>
          <p className="mt-1 text-xl font-black text-ink">{transfer.itemCount}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">ready</p>
          <p className="mt-1 text-xl font-black text-ink">{transfer.readyItems}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">locked</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.codexCapabilityTransferLocked}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">replay rows</p>
          <p className="mt-1 text-xl font-black text-ink">
            {report.summary.codexCapabilityTransplantRehearsalResultValidationReplayRows}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
        {transfer.teacherQuestion}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {transfer.items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-extrabold text-ink">{item.sourceCapability}</p>
              <Badge tone="neutral">{item.architectureLayer}</Badge>
              <Badge tone="amber">review-only</Badge>
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "locked" : "needs evidence"}</Badge>
            </div>
            <p className="mt-2 text-xs font-bold uppercase text-slate-500">transfer pattern</p>
            <p className="mt-1 text-xs leading-5 text-slate-700">{item.transplantedPattern}</p>
            <p className="mt-2 text-xs font-bold uppercase text-slate-500">MVP use</p>
            <p className="mt-1 text-xs leading-5 text-slate-700">{item.mvpUse}</p>
            <p className="mt-2 rounded-md bg-white p-3 text-xs leading-5 text-blue-950">
              {item.teacherReviewQuestion}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone={transfer.transplantDraft?.passed ? "blue" : "amber"}>
              {transfer.transplantDraft?.readyRows ?? 0}/{transfer.transplantDraft?.rowCount ?? 0} contracts
            </Badge>
            <h4 className="mt-3 text-base font-extrabold text-ink">Codex capability transplant draft</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-950">
              Contract rows stay visible for teacher review, while large rehearsal/export JSON is kept out of the
              rendered page to keep the product usable.
            </p>
          </div>
          <ShieldCheck className="size-5 text-apprentice-blue" />
        </div>

        <div className="mt-4 rounded-md border border-blue-100 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">codex_capability_transplant_draft_json_v1</Badge>
            <Badge tone="blue">codex_capability_transplant_rehearsal_result_validation_json_v1</Badge>
            <Badge tone="amber">review-only evidence ledger</Badge>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {compactEvidenceStages.map((stage) => (
              <div key={stage.schema} className="rounded-md bg-mist p-3">
                <p className="text-xs font-extrabold text-ink">{stage.label}</p>
                <p className="mt-1 break-words text-[11px] leading-4 text-slate-600">{stage.schema}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {transplantRows.map((row) => (
            <article key={row.id} className="rounded-md border border-blue-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold text-ink">{row.apprenticeInterface}</p>
                <Badge tone="amber">review-only</Badge>
                <Badge tone="teal">{row.verifierCommand}</Badge>
              </div>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">contract</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{row.transplantContract}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">teacher control</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{row.teacherControl}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-extrabold">Full packet kept out of the page</p>
            <p className="mt-2 leading-6">
              Use the qualification endpoint for machine review. The page keeps acceptance, rule enablement, packaging,
              release, and wrapping locked.
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
