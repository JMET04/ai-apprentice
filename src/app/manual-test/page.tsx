import Link from "next/link";
import { ArrowRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ManualTestWorkbench } from "@/components/manual-test-workbench";
import { Badge, Surface } from "@/components/ui";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import { memoryStore } from "@/server/memory/memory-store";

const stableDemoTaskId = "task-photo-travel-journal";

function isSmokeTask(task: { id: string; name: string }) {
  return task.id.includes("smoke") || task.name.toLowerCase().startsWith("smoke ");
}

export default async function ManualTestPage() {
  const [stableDemoTask, stableDemoStats, recentTasks, stats] = await Promise.all([
    memoryStore.getTaskProfile(stableDemoTaskId).catch(() => null),
    memoryStore.getTaskReadinessStats(stableDemoTaskId),
    memoryStore.listRecentTasks(),
    memoryStore.getDashboardStats()
  ]);
  const fallbackTask = recentTasks.find((task) => !isSmokeTask(task)) ?? recentTasks[0];
  const primaryTask = stableDemoTask ?? fallbackTask;
  const taskSource = stableDemoTask ? "Stable demo task" : fallbackTask ? "Fallback recent task" : "Waiting for task data";
  const reviewRoute = primaryTask ? `/tasks/${primaryTask.id}/review` : "/tasks/new";
  const runRoute = primaryTask ? `/tasks/${primaryTask.id}/run` : "/tasks/new";
  const teachRoute = primaryTask ? `/tasks/${primaryTask.id}/teach` : "/tasks/new";
  const readinessStats = stableDemoStats ?? stats;

  const steps = [
    {
      id: "first-screen",
      title: "Confirm the first screen explains the current product scope",
      role: "Product entry",
      route: "/",
      expectedEvidence:
        "The page presents the bounded teaching loop, shows the all-software goal as paused, and offers a clear next action.",
      stopIf: "Stop if the page still feels like an internal research directory or does not tell a tester where to begin."
    },
    {
      id: "beta-session",
      title: "Open the guided beta session entrypoint",
      role: "Tester onboarding",
      route: "/public-beta",
      expectedEvidence:
        "The page shows readiness, tester steps, feedback return instructions, and the release lock in one place.",
      stopIf: "Stop if a tester must read internal handoff documents before knowing what to do."
    },
    {
      id: "run-once",
      title: "Run the photography journal task once",
      role: "Core execution",
      route: runRoute,
      expectedEvidence:
        "The run page shows input, structured output, execution plan, trace evidence, applied rules, and teacher review points.",
      stopIf: "Stop if the run button is unusable, output is empty, or trace evidence is not visible."
    },
    {
      id: "correct-output",
      title: "Submit one teacher correction and inspect the rule draft",
      role: "Learning loop",
      route: runRoute,
      expectedEvidence:
        "The correction records error type, cause, repair action, reuse strategy, and source run evidence.",
      stopIf: "Stop if the correction cannot be saved or the saved rule source is not visible."
    },
    {
      id: "review-evidence",
      title: "Review task evidence and locked gates",
      role: "Teacher review",
      route: reviewRoute,
      expectedEvidence:
        "The task review page makes loop status, recent learning evidence, packaging lock, and evidence entrypoints understandable.",
      stopIf: "Stop if a normal tester must read raw internal reports to judge whether the core loop worked."
    },
    {
      id: "teach-workflow",
      title: "Open the teaching workbench and inspect the workflow",
      role: "Teaching editor",
      route: teachRoute,
      expectedEvidence:
        "Workflow nodes, edges, teaching notes, and save controls are visible and can be related back to the run trace.",
      stopIf: "Stop if the editor is hard to understand or cannot return the reviewer to task evidence."
    }
  ];

  const gateEvidence = [
    { label: "accepted", value: String(visualLearningAcceptanceGate.accepted), tone: "amber" as const },
    { label: "packagingGated", value: String(visualLearningAcceptanceGate.packagingGated), tone: "teal" as const },
    { label: "status", value: visualLearningAcceptanceGate.status, tone: "blue" as const },
    { label: "demoRuns", value: String(readinessStats.runs), tone: "neutral" as const },
    { label: "demoRules", value: String(readinessStats.rules), tone: "neutral" as const }
  ];

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Surface className="border-teal-100 bg-gradient-to-br from-white via-white to-teal-50">
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">Manual test entry</Badge>
              <Badge tone="amber">Does not unlock release</Badge>
              <Badge tone="blue">Saves human_review evidence</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-ink">
              Use this checklist to decide whether the bounded MVP is ready for the next tester.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Review only the core teaching loop: start a beta session, run the stable task, inspect trace evidence,
              submit a correction, and verify that reusable learning remains review-gated. General all-software
              automation and production release are outside this pass.
            </p>
            <p className="mt-3 max-w-2xl rounded-md border border-blue-100 bg-blue-50 p-3 text-sm font-semibold leading-6 text-blue-950">
              Evidence saved from this page is marked as evidenceKind=human_review. Automated browser smoke is marked as
              automated_browser_smoke and cannot replace a real human pass.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/public-beta"
                className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Start beta session
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={reviewRoute}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                View task evidence
                <ShieldCheck className="size-4" />
              </Link>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-apprentice-teal" />
              <h2 className="font-black text-ink">Review Object</h2>
            </div>
            <div className="mt-4 rounded-md border border-line bg-mist p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Task - {taskSource}</p>
              <p className="mt-2 font-black text-ink">{primaryTask ? primaryTask.name : "No reviewable task yet"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {primaryTask ? primaryTask.goal : "Create or seed a task before manual review."}
              </p>
            </div>
            <p className="mt-4 text-xs font-bold uppercase text-slate-500">Stable demo metrics</p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ["Apprentices", readinessStats.apprentices],
                ["Workflows", readinessStats.workflows],
                ["Rules", readinessStats.rules],
                ["Runs", readinessStats.runs]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-white p-3">
                  <p className="text-xl font-black text-ink">{value}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <ManualTestWorkbench steps={steps} gateEvidence={gateEvidence} />
      </div>
    </AppShell>
  );
}
