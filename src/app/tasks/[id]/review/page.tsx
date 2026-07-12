import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  LockKeyhole,
  MessageSquareText,
  PlayCircle,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Surface } from "@/components/ui";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import type { WorkflowNodeDefinition } from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function TaskReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await memoryStore.getTaskProfile(id);

  if (!task) notFound();

  const workflow = task.workflows[0];
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(workflow?.nodes, []);
  const inputSchema = parseJson<{ example?: string }>(task.inputSchema, {});
  const expectedOutput = parseJson<{ fields?: string[]; errorCases?: string[] }>(task.expectedOutput, {});
  const latestRun = task.runs[0];
  const latestCorrection = task.corrections[0];
  const enabledRules = task.rules.filter((rule) => rule.enabled);

  const acceptanceChecks = [
    {
      title: "Task can run",
      detail: latestRun ? `Latest saved run: ${formatDate(latestRun.createdAt)}` : "No saved run yet.",
      pass: Boolean(latestRun),
      href: `/tasks/${task.id}/run`,
      icon: PlayCircle
    },
    {
      title: "Execution is traceable",
      detail: workflowNodes.length > 0 ? `${workflowNodes.length} teaching nodes can align with trace evidence.` : "No reviewable workflow nodes yet.",
      pass: workflowNodes.length > 0,
      href: `/tasks/${task.id}/teach`,
      icon: GitBranch
    },
    {
      title: "Teacher correction is saved",
      detail: latestCorrection ? `Latest correction type: ${latestCorrection.errorType}` : "No teacher correction record yet.",
      pass: Boolean(latestCorrection),
      href: `/tasks/${task.id}/run`,
      icon: MessageSquareText
    },
    {
      title: "Rule source is understandable",
      detail: enabledRules.length > 0 ? `${enabledRules.length} enabled rules have reviewable source evidence.` : "No enabled rules yet.",
      pass: enabledRules.length > 0,
      href: `/tasks/${task.id}`,
      icon: BookOpenCheck
    },
    {
      title: "Packaging remains locked",
      detail: visualLearningAcceptanceGate.reason,
      pass: visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted,
      href: "/manual-test",
      icon: LockKeyhole
    }
  ];

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Surface className="border-teal-100 bg-gradient-to-br from-white via-white to-teal-50">
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">Tester review view</Badge>
              <Badge tone="amber">Review-only evidence</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-ink">{task.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{task.goal}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/tasks/${task.id}/run`}
                className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Run and correct
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/manual-test"
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Open checklist
                <ClipboardCheck className="size-4" />
              </Link>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">Current Review Scope</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Workflow nodes", workflowNodes.length],
                ["Saved runs", task.runs.length],
                ["Corrections", task.corrections.length],
                ["Enabled rules", enabledRules.length]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-mist p-3">
                  <p className="text-2xl font-black text-ink">{value}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              This page only supports bounded human beta review. It does not approve release, packaging, or the paused
              all-software objective.
            </div>
          </Surface>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {acceptanceChecks.map((check) => (
            <Link key={check.title} href={check.href}>
              <Surface className="h-full transition hover:-translate-y-0.5 hover:border-teal-200">
                <div className="flex items-center justify-between gap-3">
                  <check.icon className="size-5 text-apprentice-teal" />
                  <CheckCircle2 className={check.pass ? "size-5 text-apprentice-teal" : "size-5 text-slate-300"} />
                </div>
                <h3 className="mt-3 font-black text-ink">{check.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
              </Surface>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Surface>
            <h2 className="font-black text-ink">Teacher Input</h2>
            <div className="mt-4 rounded-md border border-line bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Example input</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{inputSchema.example ?? "No example input yet."}</p>
            </div>
            <div className="mt-3 rounded-md border border-line bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Expected output fields</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(expectedOutput.fields ?? []).map((field) => (
                  <Badge key={field} tone="blue">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          </Surface>

          <Surface>
            <h2 className="font-black text-ink">Recent Learning Evidence</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-line bg-mist p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Latest correction</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {latestCorrection?.userFeedback ?? "No correction yet. Run the task, then correct one result."}
                </p>
              </div>
              <div className="rounded-md border border-line bg-mist p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Latest rule</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {enabledRules[0]?.title ?? "No reusable rule yet."}
                </p>
              </div>
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface>
            <h2 className="font-black text-ink">Out of Scope for This Review</h2>
            <div className="mt-4 grid gap-3">
              {[
                "Do not test all-software autonomous learning.",
                "Do not test general desktop software control.",
                "Do not treat review-only evidence as acceptance.",
                "Do not unlock packaging, release, or automatic execution."
              ].map((item) => (
                <div key={item} className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                  {item}
                </div>
              ))}
            </div>
          </Surface>

          <Surface>
            <h2 className="font-black text-ink">Deep Evidence</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the full task page and qualification API only when a tester needs to investigate a blocker. The beta
              path should start from the readable review and run screens.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/tasks/${task.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Open full evidence page
                <BookOpenCheck className="size-4" />
              </Link>
              <Link
                href={`/api/tasks/${task.id}/qualification`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                View qualification API
                <ShieldCheck className="size-4" />
              </Link>
            </div>
          </Surface>
        </section>
      </div>
    </AppShell>
  );
}
