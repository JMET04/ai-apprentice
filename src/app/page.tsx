import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ArchitectureAuditPanel } from "@/components/architecture-audit-panel";
import { Badge, Surface } from "@/components/ui";
import { architectureAuditLayers } from "@/lib/architecture-audit";
import { memoryStore } from "@/server/memory/memory-store";
import { skillRegistry } from "@/server/registries/skill-registry";
import { toolRegistry } from "@/server/registries/tool-registry";

const stableDemoTaskId = "task-photo-travel-journal";

const productPath = [
  {
    title: "Start a beta session",
    detail: "Use one guided product entrypoint for the bounded tester flow.",
    href: "/public-beta",
    icon: ClipboardCheck
  },
  {
    title: "Run the demo task",
    detail: "Execute the photography journal workflow and inspect structured output plus trace evidence.",
    href: "/tasks/task-photo-travel-journal/run",
    icon: PlayCircle
  },
  {
    title: "Submit a correction",
    detail: "Turn teacher feedback into a reusable rule draft with source and confidence visible.",
    href: "/tasks/task-photo-travel-journal/run",
    icon: MessageSquareText
  },
  {
    title: "Review before reuse",
    detail: "Check rule evidence and packaging locks before treating learning as trustworthy.",
    href: "/tasks/task-photo-travel-journal/review",
    icon: ShieldCheck
  },
  {
    title: "Save human evidence",
    detail: "Record a real tester pass in the manual acceptance workbench.",
    href: "/manual-test",
    icon: ClipboardCheck
  }
];

const confidenceItems = [
  "The bounded teaching loop is implemented: run, trace, correct, extract rules, and rerun.",
  "Productization gates are explicit: handoff, live handoff, public beta, preflight, and release readiness.",
  "Tester feedback is treated as review-only evidence, not as release approval.",
  "The all-software objective remains paused while the first usable product path is hardened."
];

const pausedItems = [
  "General native desktop/software control is outside the current beta.",
  "Autonomous all-software learning is not part of the current product promise.",
  "Real-model acceptance is separate from the mock AI beta runtime.",
  "Packaging and release stay locked until human acceptance and approval are explicit."
];

export default async function DashboardPage() {
  const [apprentices, stableDemoTask, stableDemoStats, recentTasks, recentCorrections, stats] = await Promise.all([
    memoryStore.listApprentices(),
    memoryStore.getTaskProfile(stableDemoTaskId).catch(() => null),
    memoryStore.getTaskReadinessStats(stableDemoTaskId),
    memoryStore.listRecentTasks(),
    memoryStore.listCorrections({ take: 3 }),
    memoryStore.getDashboardStats()
  ]);
  const productTask =
    stableDemoTask ?? recentTasks.find((task) => !task.name.toLowerCase().startsWith("smoke ")) ?? recentTasks[0];
  const primaryApprentice = apprentices[0];
  const latestCorrection = recentCorrections[0]?.userFeedback;
  const heroStats = stableDemoStats ?? stats;

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Surface className="overflow-hidden border-teal-100 bg-gradient-to-br from-white via-white to-teal-50/60">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="teal">Bounded public beta path</Badge>
                  <Badge tone="amber">All-software goal paused</Badge>
                </div>
                <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-ink">
                  Teach one apprentice, run one task, correct it, and verify the learning loop.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  This product is being hardened around a single clear promise: a human can teach an AI apprentice
                  through visible execution traces and reusable correction rules. The next milestone is one bounded beta
                  tester, not a broad all-software automation launch.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href="/public-beta"
                  className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
                >
                  Start beta session
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/handoff"
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  View readiness
                  <ClipboardCheck className="size-4" />
                </Link>
              </div>
            </div>
            <p className="mt-5 text-xs font-bold uppercase text-slate-500">Stable demo evidence</p>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              {[
                ["Apprentices", String(heroStats.apprentices)],
                ["Workflows", String(heroStats.workflows)],
                ["Enabled rules", String(heroStats.rules)],
                ["Traceable runs", String(heroStats.runs)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-white/80 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black text-ink">{value}</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-apprentice-teal" />
              <h2 className="font-extrabold text-ink">Productization Check</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                "A tester can start from a product page, not from internal docs only.",
                "The stable task is pinned to task-photo-travel-journal.",
                "Release remains blocked while beta testing opens.",
                "Manual evidence is separated from automated browser smoke.",
                "Feedback can be collected before inviting another tester."
              ].map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {productPath.map((item, index) => (
            <Link key={item.title} href={item.href}>
              <Surface className="h-full transition hover:-translate-y-0.5 hover:border-teal-200">
                <div className="flex items-center justify-between gap-3">
                  <item.icon className="size-5 text-apprentice-teal" />
                  <span className="text-xs font-black text-slate-400">{index + 1}</span>
                </div>
                <h3 className="mt-3 font-extrabold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </Surface>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Surface>
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-5 text-apprentice-blue" />
              <h2 className="font-extrabold text-ink">Current Demo Task</h2>
            </div>
            {productTask ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={stableDemoTask ? "teal" : "amber"}>
                    {stableDemoTask ? "Stable demo task" : "Fallback recent task"}
                  </Badge>
                  <Badge tone="blue">{productTask.id}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-black text-ink">{productTask.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{productTask.goal}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="blue">Runnable demo</Badge>
                  <Badge tone="teal">Trace evidence</Badge>
                  <Badge tone="amber">Needs human review</Badge>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">No task exists yet. Create or seed one before beta.</p>
            )}
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <PauseCircle className="size-5 text-apprentice-amber" />
              <h2 className="font-extrabold text-ink">Paused Scope</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pausedItems.map((item) => (
                <div key={item} className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  {item}
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface>
            <h2 className="font-extrabold text-ink">Capabilities I Trust Most</h2>
            <div className="mt-4 space-y-3">
              {confidenceItems.map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface>
            <h2 className="font-extrabold text-ink">Recent Learning Evidence</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-line bg-mist p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Apprentice</p>
                <p className="mt-2 font-extrabold text-ink">{primaryApprentice?.name ?? "No apprentice yet"}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {primaryApprentice
                    ? `${primaryApprentice._count.tasks} tasks, ${primaryApprentice._count.rules} rules`
                    : "Create an apprentice before expanding the beta."}
                </p>
              </div>
              <div className="rounded-md border border-line bg-mist p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Latest correction</p>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">
                  {latestCorrection ?? "No teacher correction has been saved yet."}
                </p>
              </div>
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface>
            <h2 className="font-extrabold text-ink">Internal Tool Slots</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These remain developer-facing capability slots. They are not the first path for a beta tester.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {toolRegistry.map((tool) => (
                <div key={tool.name} className="rounded-md border border-line bg-mist p-3">
                  <p className="font-bold text-ink">{tool.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{tool.description}</p>
                </div>
              ))}
            </div>
          </Surface>
          <Surface>
            <h2 className="font-extrabold text-ink">Registered Skill Slots</h2>
            <div className="mt-4 space-y-3">
              {skillRegistry.map((skill) => (
                <div key={skill.name} className="rounded-md border border-line bg-mist p-3">
                  <p className="font-bold text-ink">{skill.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{skill.description}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <ArchitectureAuditPanel layers={architectureAuditLayers} />
      </div>
    </AppShell>
  );
}
