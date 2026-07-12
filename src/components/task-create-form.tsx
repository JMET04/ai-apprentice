"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FieldLabel, PrimaryButton, Surface } from "./ui";

const initialForm = {
  name: "生成结构化摄影旅行日志",
  goal: "教 AI 学徒把旅行笔记整理成可追踪的摄影日志。",
  inputExample:
    "今天我在日内瓦湖边 sunset 拍摄，天气 clear，有湖面反光、雪山和人像主体。",
  expectedOutput: "location, weather, subjects, lightingCondition, recommendedTitles, journalBody, photographyAdvice",
  notes: "如果学徒不确定，最终输出前必须先问老师。",
  errorCases:
    "光线判断错误：sunset 被标成 natural light。\n建议缺失：photographyAdvice 没有提到柔和侧光或逆光。"
};

export function TaskCreateForm({
  apprentices
}: Readonly<{
  apprentices: { id: string; name: string; domain: string }[];
}>) {
  const [form, setForm] = useState({
    ...initialForm,
    apprenticeId: apprentices[0]?.id ?? ""
  });
  const [savedTask, setSavedTask] = useState<{
    id: string;
    name: string;
    status: string;
    workflowId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveTask() {
    setIsSaving(true);
    setError(null);
    setSavedTask(null);

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "无法保存可带教任务。");
      setIsSaving(false);
      return;
    }

    setSavedTask(await response.json());
    setIsSaving(false);
  }

  return (
    <Surface className="max-w-3xl">
      <h2 className="text-xl font-extrabold text-ink">创建可带教任务</h2>
      <p className="mt-1 text-sm text-slate-500">
        任务会保存到本地学习数据库里，后续工作流、纠错、示例和执行追踪都会绑定到这个任务。
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await saveTask();
        }}
      >
        {[
          ["name", "任务名称"],
          ["goal", "任务目标"],
          ["inputExample", "示例输入"],
          ["expectedOutput", "期望输出字段"],
          ["notes", "老师备注"],
          ["errorCases", "已知错误案例"]
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
        <div>
          <FieldLabel>AI 学徒</FieldLabel>
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            value={form.apprenticeId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                apprenticeId: event.target.value
              }))
            }
          >
            {apprentices.map((apprentice) => (
              <option key={apprentice.id} value={apprentice.id}>
                {apprentice.name} - {apprentice.domain}
              </option>
            ))}
          </select>
        </div>
        <PrimaryButton type="submit" disabled={isSaving}>
          {isSaving ? "正在保存任务..." : "开始带教这个任务"}
        </PrimaryButton>
      </form>
      {savedTask ? (
        <div className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700">
          <p className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            已把 {savedTask.name} 保存为 {savedTask.status === "active" ? "进行中" : savedTask.status} 任务记忆（{savedTask.id}）。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link className="rounded-md bg-white px-3 py-1 text-teal-800" href={`/tasks/${savedTask.id}`}>
              打开任务
            </Link>
            <Link className="rounded-md bg-white px-3 py-1 text-teal-800" href={`/tasks/${savedTask.id}/teach`}>
              构建可视化流程
            </Link>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
    </Surface>
  );
}
