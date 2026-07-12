import Link from "next/link";
import {
  BookOpenCheck,
  BrainCircuit,
  ClipboardCheck,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  PauseCircle,
  PlayCircle,
  UserPlus
} from "lucide-react";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";

const navItems = [
  { href: "/", label: "产品总览", icon: LayoutDashboard },
  { href: "/public-beta", label: "测试会话", icon: ClipboardCheck },
  { href: "/apprentices/new", label: "创建学徒", icon: UserPlus },
  { href: "/apprentices/apprentice-photo-journal", label: "学徒档案", icon: BrainCircuit },
  { href: "/tasks/task-photo-travel-journal/review", label: "任务复核", icon: BookOpenCheck },
  { href: "/tasks/task-photo-travel-journal/teach", label: "教学工作台", icon: GitBranch },
  { href: "/tasks/task-photo-travel-journal/run", label: "运行与纠错", icon: PlayCircle },
  { href: "/handoff", label: "交接状态", icon: FileCheck2 },
  { href: "/manual-test", label: "人工测试", icon: ClipboardCheck }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white/92 px-4 py-5 backdrop-blur lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-apprentice-dark text-sm font-black text-white">
            明
          </span>
          <span>
            <span className="block text-sm font-extrabold text-ink">明徒 AI</span>
            <span className="block text-xs text-slate-500">看得见成长，教得会做事</span>
          </span>
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-ink"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
            <div className="flex items-center gap-2 font-bold">
              <PauseCircle className="size-4" />
              通用软件目标暂缓
            </div>
            <p className="mt-2 leading-5">
              首版聚焦可验证的学习闭环：示范、执行、纠错、规则复核和有限测试证据。
            </p>
          </div>
          <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 text-xs text-teal-900">
            <p className="font-bold">审核边界</p>
            <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-wide">
              {visualLearningAcceptanceGate.status}
            </p>
            <p className="mt-1 leading-5">{visualLearningAcceptanceGate.reason}</p>
          </div>
        </div>
      </aside>
      <main className="min-w-0 overflow-x-hidden lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/86 px-5 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-apprentice-teal">人类教学 {"->"} 学徒改进</p>
              <h1 className="text-lg font-extrabold text-ink">明徒 AI 教学闭环</h1>
            </div>
            <Link
              href="/public-beta"
              className="inline-flex w-fit rounded-md bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              开始测试
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
      </main>
    </div>
  );
}
