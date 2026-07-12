"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff } from "lucide-react";
import { PrimaryButton } from "./ui";

export function RuleMemoryControl({
  ruleId,
  enabled,
  apprenticeId,
  taskId
}: Readonly<{
  ruleId: string;
  enabled: boolean;
  apprenticeId: string;
  taskId: string;
}>) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleRule() {
    setIsSaving(true);
    setError(null);
    const response = await fetch(`/api/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: !isEnabled,
        apprenticeId,
        taskId
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "无法更新这条记忆。");
      setIsSaving(false);
      return;
    }

    const rule = (await response.json()) as { enabled: boolean };
    setIsEnabled(rule.enabled);
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <p className={isEnabled ? "mb-2 text-xs font-bold text-teal-700" : "mb-2 text-xs font-bold text-slate-500"}>
        这条记忆当前{isEnabled ? "已启用，会影响后续运行" : "已暂停，不会自动影响后续运行"}。
      </p>
      <PrimaryButton
        className={isEnabled ? "w-full bg-slate-700 hover:bg-slate-800" : "w-full"}
        onClick={toggleRule}
        disabled={isSaving}
      >
        {isEnabled ? <PowerOff className="mr-2 size-4" /> : <Power className="mr-2 size-4" />}
        {isSaving ? "正在更新..." : isEnabled ? "暂停这条记忆" : "启用这条记忆"}
      </PrimaryButton>
      {error ? <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}
