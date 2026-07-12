"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { History, Save } from "lucide-react";
import type { RuleRecord } from "@/lib/types";
import { Badge, PrimaryButton } from "./ui";

export function HistoryLessonControl({
  runId,
  apprenticeId,
  taskId
}: Readonly<{
  runId: string;
  apprenticeId: string;
  taskId: string;
}>) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [rule, setRule] = useState<RuleRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveHistoryLesson() {
    setIsSaving(true);
    setError(null);
    const response = await fetch("/api/run-lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, apprenticeId, taskId })
    });
    const payload = (await response.json()) as { rule?: RuleRecord; error?: string };
    setIsSaving(false);

    if (!response.ok || !payload.rule) {
      setError(payload.error ?? "无法把这次执行历史保存为记忆。");
      return;
    }

    setRule(payload.rule);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
      <div className="flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-apprentice-blue">
          <History className="size-4" />
        </span>
        <div>
          <p className="font-extrabold">从这次执行历史中学习</p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            把已保存的 trace 转成可复用记忆，并保留运行 ID 作为来源证据。
          </p>
        </div>
      </div>

      <PrimaryButton className="mt-3 w-full" onClick={saveHistoryLesson} disabled={isSaving}>
        <Save className="mr-2 size-4" />
        {isSaving ? "正在保存历史课程..." : "保存 trace 为记忆"}
      </PrimaryButton>

      {error ? <p className="mt-3 rounded-md bg-red-50 p-2 text-xs font-bold text-red-700">{error}</p> : null}
      {rule ? (
        <div className="mt-3 rounded-md bg-white p-3 text-xs text-blue-900">
          <div className="flex flex-wrap gap-2">
            <Badge tone={rule.enabled ? "teal" : "neutral"}>{rule.enabled ? "已启用" : "已暂停"}</Badge>
            <Badge tone="blue">{Math.round(rule.confidence * 100)}%</Badge>
          </div>
          <p className="mt-2 font-extrabold">{rule.title}</p>
          <p className="mt-1">
            <strong>条件：</strong> {rule.condition}
          </p>
          <p className="mt-1">
            <strong>动作：</strong> {rule.action}
          </p>
        </div>
      ) : null}
    </div>
  );
}
