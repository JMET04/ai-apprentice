import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  Inbox,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  TerminalSquare
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Surface } from "@/components/ui";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import {
  buildProductReadiness,
  productReadinessCommands,
  stableProductTaskId
} from "@/server/productization/readiness";

export const dynamic = "force-dynamic";

const productizationDefinition = [
  "A teammate can understand what is testable without reading the whole codebase.",
  "The core path has fixed entrypoints, fixed verification commands, and reproducible evidence.",
  "Smoke data, beta feedback, and real human acceptance are separated.",
  "Mock AI, paused all-software scope, and locked release gates are visible."
];

const entryPoints = [
  {
    label: "Beta session",
    href: "/public-beta",
    detail: "Tester-facing entrypoint for the bounded public beta session.",
    icon: ClipboardCheck
  },
  {
    label: "Manual acceptance",
    href: "/manual-test",
    detail: "Record human_review evidence with step notes and reviewer attestation.",
    icon: ClipboardCheck
  },
  {
    label: "Run stable task",
    href: `/tasks/${stableProductTaskId}/run`,
    detail: "Execute the photography journal task, inspect trace evidence, and save a correction.",
    icon: PlayCircle
  },
  {
    label: "Task review",
    href: `/tasks/${stableProductTaskId}/review`,
    detail: "Review learning evidence, rule source, acceptance boundaries, and deep evidence links.",
    icon: ShieldCheck
  }
];

export default async function HandoffPage() {
  const readiness = await buildProductReadiness();
  const reportChecks = readiness.handoffGate.checks.slice(0, 5);
  const demoStats = readiness.stableDemoStats;
  const stableDemoTask = readiness.stableAcceptanceObject;
  const releaseBlockers = readiness.productReleaseReadiness.blockers ?? [];
  const operatorActions = readiness.productOperatorBrief.immediateActions ?? [];
  const blockedOperatorActions = readiness.productOperatorBrief.blockedActions ?? [];
  const betaReturnActions = readiness.publicBetaReturnLoop.actions ?? [];
  const betaReturnCommands = readiness.publicBetaReturnLoop.commandSequence ?? [];

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <Surface className="border-teal-100 bg-gradient-to-br from-white via-white to-teal-50/70">
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">Product handoff state</Badge>
              <Badge tone="amber">All-software goal paused</Badge>
              <Badge tone="blue">{stableProductTaskId}</Badge>
              <Badge tone={readiness.status === "ready_for_human_acceptance" ? "teal" : "amber"}>
                {readiness.status}
              </Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black text-ink">
              Productization means the next person can run, judge, and continue the bounded product path.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              The current handoff object is not a broad all-software system. It is one usable teaching loop: stable task,
              traceable run, teacher correction, rule draft, rerun evidence, manual review, and beta feedback handling.
            </p>
            <div className="mt-4 grid gap-2 text-xs font-bold text-slate-700 md:grid-cols-2">
              <code className="rounded-md bg-slate-950 px-3 py-2 text-white">GET /api/product-readiness</code>
              <code className="rounded-md bg-slate-950 px-3 py-2 text-white">GET /api/product-release-readiness</code>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/public-beta"
                className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Start beta session
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={`/tasks/${stableProductTaskId}/run`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Run stable task
                <PlayCircle className="size-4" />
              </Link>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">Latest Handoff Gate</h2>
            </div>
            <div className="mt-4 rounded-md border border-line bg-mist p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Status</p>
              <p className="mt-2 text-2xl font-black text-ink">{readiness.handoffGate.status}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {readiness.handoffGate.passed}/{readiness.handoffGate.total} checks passed.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["runs", demoStats.runs],
                ["rules", demoStats.rules],
                ["corrections", demoStats.corrections]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-white p-3">
                  <p className="text-2xl font-black text-ink">{value}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {entryPoints.map((item) => (
            <Link key={item.href} href={item.href}>
              <Surface className="h-full transition hover:-translate-y-0.5 hover:border-teal-200">
                <item.icon className="size-5 text-apprentice-teal" />
                <h3 className="mt-3 font-black text-ink">{item.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </Surface>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Surface className="border-teal-200 bg-teal-50/60">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">Product Operator Brief</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={readiness.productOperatorBrief.status === "ready_for_operator_handoff" ? "teal" : "amber"}>
                operatorBrief={readiness.productOperatorBrief.status}
              </Badge>
              <Badge tone={readiness.productOperatorBrief.canInviteBoundedBetaTester ? "teal" : "amber"}>
                beta={String(readiness.productOperatorBrief.canInviteBoundedBetaTester)}
              </Badge>
              <Badge tone={readiness.productOperatorBrief.canStartHumanAcceptanceReview ? "teal" : "amber"}>
                human={String(readiness.productOperatorBrief.canStartHumanAcceptanceReview)}
              </Badge>
              <Badge tone={readiness.productOperatorBrief.canPlanRealModelTrial ? "teal" : "amber"}>
                modelTrial={String(readiness.productOperatorBrief.canPlanRealModelTrial)}
              </Badge>
              <Badge tone="amber">release={String(readiness.productOperatorBrief.canRelease)}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {operatorActions.map((action) => (
                <div key={action.id} className="rounded-md border border-teal-200 bg-white/80 p-3">
                  <p className="text-xs font-bold uppercase text-teal-700">
                    allowed={String(action.allowed)}
                  </p>
                  <p className="mt-2 font-black text-ink">{action.title}</p>
                  <code className="mt-2 block break-words rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                    {action.command}
                  </code>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <Ban className="size-5 text-apprentice-amber" />
              <h2 className="font-black text-ink">Operator Stop Lines</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {blockedOperatorActions.map((action) => (
                <div key={action.id} className="rounded-md border border-amber-200 bg-white/75 p-3">
                  <p className="font-bold text-amber-950">
                    {action.title} blocked={String(action.blocked)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{action.reason}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Surface>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">What Productized Means Here</h2>
            </div>
            <div className="mt-4 space-y-3">
              {productizationDefinition.map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <Ban className="size-5 text-apprentice-amber" />
              <h2 className="font-black text-ink">Production Release Go/No-Go</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="amber">status={readiness.productReleaseReadiness.status}</Badge>
              <Badge tone="amber">releaseDecision={readiness.productReleaseReadiness.releaseDecision}</Badge>
              <Badge tone="teal">trialReadinessIsReleaseReadiness=false</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {releaseBlockers.map((blocker) => (
                <div key={blocker.name} className="rounded-md border border-amber-200 bg-white/75 p-3">
                  <p className="font-bold text-amber-950">{blocker.name}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{blocker.nextAction}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <Surface>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">Public Beta Readiness</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={readiness.publicBetaReadiness.status === "passed" ? "teal" : "amber"}>
                {readiness.publicBetaReadiness.status}
              </Badge>
              <Badge tone={readiness.publicBetaReadiness.betaCanStart ? "teal" : "amber"}>
                betaCanStart={String(readiness.publicBetaReadiness.betaCanStart)}
              </Badge>
              <Badge tone="blue">
                {readiness.publicBetaReadiness.passed}/{readiness.publicBetaReadiness.total}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Use the public beta packet and the product page at /public-beta for one bounded tester.
            </p>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <Inbox className="size-5 text-apprentice-blue" />
              <h2 className="font-black text-ink">Tester Session Preflight</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={readiness.publicBetaTesterSessionPreflight.status === "passed" ? "teal" : "amber"}>
                {readiness.publicBetaTesterSessionPreflight.status}
              </Badge>
              <Badge tone={readiness.publicBetaTesterSessionPreflight.canInviteTester ? "teal" : "amber"}>
                canInvite={String(readiness.publicBetaTesterSessionPreflight.canInviteTester)}
              </Badge>
              <Badge tone="blue">
                {readiness.publicBetaTesterSessionPreflight.passed}/{readiness.publicBetaTesterSessionPreflight.total}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {readiness.publicBetaTesterSessionPreflight.nextAction}
            </p>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <Cpu className="size-5 text-apprentice-blue" />
              <h2 className="font-black text-ink">Runtime Boundary</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">AI provider={readiness.aiService.activeProvider}</Badge>
              <Badge tone="amber">realModelReady={String(readiness.aiService.realModelReady)}</Badge>
              <Badge tone="teal">mockFallback=true</Badge>
              <Badge tone={readiness.realModelAdapterContractVerification.status === "passed" ? "teal" : "amber"}>
                adapterContract={readiness.realModelAdapterContractVerification.status}
              </Badge>
              <Badge tone="blue">
                adapterChecks={readiness.realModelAdapterContractVerification.passed}/
                {readiness.realModelAdapterContractVerification.total}
              </Badge>
              <Badge tone="amber">
                realNetwork={String(readiness.realModelAdapterContractVerification.realNetworkUsed)}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Mock AI is acceptable for the bounded beta. The OpenAI-compatible adapter contract is fake-fetch evidence;
              a real model still needs separate acceptance before release.
            </p>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Surface className="border-blue-200 bg-blue-50/60">
            <div className="flex items-center gap-2">
              <Inbox className="size-5 text-apprentice-blue" />
              <h2 className="font-black text-ink">Beta Feedback Return Loop</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">returnLoop={readiness.publicBetaReturnLoop.status}</Badge>
              <Badge tone={readiness.publicBetaReturnLoop.collectionStatus === "waiting_for_feedback" ? "teal" : "amber"}>
                collection={readiness.publicBetaReturnLoop.collectionStatus}
              </Badge>
              <Badge tone={readiness.publicBetaReturnLoop.followUpVerificationStatus === "passed" ? "teal" : "amber"}>
                followUp={readiness.publicBetaReturnLoop.followUpVerificationStatus}
              </Badge>
              <Badge tone={readiness.publicBetaReturnLoop.returnIntakeVerificationStatus === "passed" ? "teal" : "amber"}>
                intake={readiness.publicBetaReturnLoop.returnIntakeVerificationStatus}
              </Badge>
              <Badge tone="amber">release={readiness.publicBetaReturnLoop.releaseDecision}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["total", readiness.publicBetaReturnLoop.totalReceipts],
                ["valid", readiness.publicBetaReturnLoop.validReceipts],
                ["invalid", readiness.publicBetaReturnLoop.invalidReceipts]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-blue-200 bg-white/80 p-3 text-center">
                  <p className="text-2xl font-black text-ink">{value}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-blue-700">{label} receipts</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {betaReturnActions.map((action) => (
                <div key={action.id} className="rounded-md border border-blue-200 bg-white/80 p-3">
                  <p className="text-xs font-bold uppercase text-blue-700">{action.lane}</p>
                  <p className="mt-1 font-black text-ink">{action.title}</p>
                  <code className="mt-2 block break-words rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                    {action.command}
                  </code>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <TerminalSquare className="size-5 text-apprentice-blue" />
              <h2 className="font-black text-ink">Return Handling Commands</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {betaReturnCommands.map((command) => (
                <code key={command} className="block break-words rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                  {command}
                </code>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{readiness.publicBetaReturnLoop.nextAction}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="teal">accepted={String(readiness.publicBetaReturnLoop.accepted)}</Badge>
              <Badge tone="teal">packagingGated={String(readiness.publicBetaReturnLoop.packagingGated)}</Badge>
              <Badge tone="amber">reviewOnly={String(readiness.publicBetaReturnLoop.reviewOnly)}</Badge>
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Surface>
            <div className="flex items-center gap-2">
              <PauseCircle className="size-5 text-apprentice-amber" />
              <h2 className="font-black text-ink">Acceptance Boundary</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="amber">accepted={String(visualLearningAcceptanceGate.accepted)}</Badge>
              <Badge tone="teal">packagingGated={String(visualLearningAcceptanceGate.packagingGated)}</Badge>
              <Badge tone="blue">status={visualLearningAcceptanceGate.status}</Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{visualLearningAcceptanceGate.reason}</p>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <TerminalSquare className="size-5 text-apprentice-blue" />
              <h2 className="font-black text-ink">Commands to Trust</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {productReadinessCommands.map((item) => (
                <div key={item.command} className="rounded-md border border-line bg-mist p-3">
                  <p className="text-sm font-black text-ink">{item.label}</p>
                  <code className="mt-2 block break-words rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                    {item.command}
                  </code>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface>
            <h2 className="font-black text-ink">Stable Acceptance Object</h2>
            <div className="mt-4 rounded-md border border-line bg-mist p-4">
              <p className="text-xs font-bold uppercase text-slate-500">{stableDemoTask.id}</p>
              <p className="mt-2 font-black text-ink">{stableDemoTask.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{stableDemoTask.goal}</p>
            </div>
          </Surface>

          <Surface>
            <h2 className="font-black text-ink">Recent Handoff Checks</h2>
            <div className="mt-4 space-y-3">
              {reportChecks.map((check) => (
                <div key={check.name} className="rounded-md border border-line bg-mist p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={check.pass ? "size-4 text-apprentice-teal" : "size-4 text-amber-600"} />
                    <p className="font-bold text-ink">{check.name}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{check.evidence}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>
      </div>
    </AppShell>
  );
}
