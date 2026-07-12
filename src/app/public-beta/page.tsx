import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  MessageSquareText,
  PlayCircle,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PublicBetaFeedbackWorkbench } from "@/components/public-beta-feedback-workbench";
import { Badge, Surface } from "@/components/ui";
import { buildProductReadiness } from "@/server/productization/readiness";

export const dynamic = "force-dynamic";

const taskId = "task-photo-travel-journal";

const testerSteps = [
  {
    title: "Run the stable task",
    detail: "Open the run console, execute the photography journal task, and inspect the visible trace.",
    href: `/tasks/${taskId}/run`,
    icon: PlayCircle
  },
  {
    title: "Correct one result",
    detail: "Add teacher feedback and confirm the saved correction can become a reusable rule draft.",
    href: `/tasks/${taskId}/run`,
    icon: MessageSquareText
  },
  {
    title: "Review evidence",
    detail: "Check task evidence, review-only gates, and packaging locks before calling the loop trustworthy.",
    href: `/tasks/${taskId}/review`,
    icon: ShieldCheck
  },
  {
    title: "Save human review",
    detail: "Use the manual checklist to save real human_review evidence with per-step notes.",
    href: "/manual-test",
    icon: ClipboardCheck
  }
];

export default async function PublicBetaPage() {
  const readiness = await buildProductReadiness();
  const betaReady = readiness.publicBetaReadiness.status === "passed" && readiness.publicBetaReadiness.betaCanStart;
  const preflightReady =
    readiness.publicBetaTesterSessionPreflight.status === "passed" &&
    readiness.publicBetaTesterSessionPreflight.canInviteTester;
  const releaseLocked = readiness.productReleaseReadiness.status === "blocked_not_release_ready";

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Surface className="border-teal-100 bg-gradient-to-br from-white via-white to-teal-50">
            <div className="flex flex-wrap gap-2">
              <Badge tone={betaReady ? "teal" : "amber"}>Public beta {readiness.publicBetaReadiness.status}</Badge>
              <Badge tone={preflightReady ? "teal" : "amber"}>
                Tester preflight {readiness.publicBetaTesterSessionPreflight.status}
              </Badge>
              <Badge tone={releaseLocked ? "teal" : "amber"}>Release locked</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-ink">
              Bounded beta session for the core teaching loop
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              This page is the tester-facing entrypoint for one controlled beta session. It covers the stable demo task,
              correction loop, evidence review, and human feedback capture. It does not claim production release
              readiness or resume the paused all-software objective.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/tasks/${taskId}/run`}
                className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Run stable task
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/manual-test"
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Open manual checklist
                <ClipboardCheck className="size-4" />
              </Link>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-apprentice-blue" />
              <h2 className="font-black text-ink">Live Readiness</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["Public beta", readiness.publicBetaReadiness.status, readiness.publicBetaReadiness.passed, readiness.publicBetaReadiness.total],
                [
                  "Tester preflight",
                  readiness.publicBetaTesterSessionPreflight.status,
                  readiness.publicBetaTesterSessionPreflight.passed,
                  readiness.publicBetaTesterSessionPreflight.total
                ],
                ["Handoff", readiness.handoffGate.status, readiness.handoffGate.passed, readiness.handoffGate.total],
                ["Live handoff", readiness.liveProductHandoff.status, readiness.liveProductHandoff.passed, readiness.liveProductHandoff.total]
              ].map(([label, status, passed, total]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md border border-line bg-mist p-3">
                  <div>
                    <p className="text-sm font-extrabold text-ink">{label}</p>
                    <p className="text-xs font-semibold text-slate-500">{String(status)}</p>
                  </div>
                  <Badge tone={status === "passed" ? "teal" : "amber"}>
                    {String(passed)}/{String(total)}
                  </Badge>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-apprentice-teal" />
            <h2 className="font-black text-ink">Tester Steps</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {testerSteps.map((step, index) => (
            <Link key={step.title} href={step.href}>
              <Surface className="h-full transition hover:-translate-y-0.5 hover:border-teal-200">
                <div className="flex items-center justify-between gap-3">
                  <step.icon className="size-5 text-apprentice-teal" />
                  <span className="text-xs font-black text-slate-400">{index + 1}</span>
                </div>
                <h3 className="mt-3 font-extrabold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
              </Surface>
            </Link>
          ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">What to Return</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>Return the saved manual acceptance JSON if you complete the checklist.</p>
              <p>Also return any filled public beta feedback receipt JSON if you are using the structured packet flow.</p>
              <p>Describe confusion points, broken steps, missing evidence, and whether another tester should be invited.</p>
            </div>
          </Surface>

          <Surface className="border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <LockKeyhole className="size-5 text-apprentice-amber" />
              <h2 className="font-black text-ink">Release Boundary</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="amber">releaseDecision={readiness.productReleaseReadiness.releaseDecision}</Badge>
              <Badge tone="teal">accepted=false</Badge>
              <Badge tone="teal">packagingGated=true</Badge>
              <Badge tone="blue">allSoftwareObjective=paused</Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-amber-950">
              A good beta session can justify another bounded test or a focused fix. It cannot approve release, enable
              packaging, activate real-model behavior, or expand scope to general software control.
            </p>
          </Surface>
        </section>

        <PublicBetaFeedbackWorkbench />
      </div>
    </AppShell>
  );
}
