"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FieldLabel, PrimaryButton, Surface } from "./ui";

const initialForm = {
  name: "Mira",
  description: "一个可以从示例、纠错和执行历史中学习可重复工作流的 AI 学徒。",
  domain: "文档审查与结构化写作"
};

export function ApprenticeCreateForm() {
  const [form, setForm] = useState(initialForm);
  const [saved, setSaved] = useState<{ id: string; name: string; domain: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveApprentice() {
    setIsSaving(true);
    setError(null);
    setSaved(null);

    const response = await fetch("/api/apprentices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "无法创建学徒。");
      setIsSaving(false);
      return;
    }

    setSaved(await response.json());
    setIsSaving(false);
  }

  return (
    <Surface className="max-w-3xl">
      <h2 className="text-xl font-extrabold text-ink">创建 AI 学徒</h2>
      <p className="mt-1 text-sm text-slate-500">
        先创建一个可带教身份。后续任务、工作流版本、规则、纠错和追踪都会绑定到这个学徒身上。
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await saveApprentice();
        }}
      >
        {[
          ["name", "学徒名称"],
          ["description", "学习画像"],
          ["domain", "学习领域"]
        ].map(([field, label]) => (
          <div key={field}>
            <FieldLabel>{label}</FieldLabel>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm"
              value={form[field as keyof typeof form]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field]: event.target.value
                }))
              }
            />
          </div>
        ))}
        <PrimaryButton type="submit" disabled={isSaving}>
          {isSaving ? "正在创建学徒..." : "创建学徒"}
        </PrimaryButton>
      </form>
      {saved ? (
        <div className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700">
          <p className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            {saved.name} 已准备好学习：{saved.domain}（{saved.id}）。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link className="rounded-md bg-white px-3 py-1 text-teal-800" href={`/apprentices/${saved.id}`}>
              打开学徒
            </Link>
            <Link className="rounded-md bg-white px-3 py-1 text-teal-800" href="/tasks/new">
              创建可带教任务
            </Link>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
    </Surface>
  );
}
