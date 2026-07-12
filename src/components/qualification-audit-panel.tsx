import Link from "next/link";
import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { Badge, Surface } from "./ui";

export type QualificationAuditItem = {
  label: string;
  principle: string;
  evidence: string;
  complete: boolean;
  href?: string;
};

export function QualificationAuditPanel({
  items
}: Readonly<{
  items: QualificationAuditItem[];
}>) {
  const completeCount = items.filter((item) => item.complete).length;
  const allComplete = completeCount === items.length;

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={allComplete ? "teal" : "amber"}>
            {completeCount}/{items.length} 项要求已证明
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">合格性审计</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            用逐项证据证明这个 demo 是可带教的 AI 学徒，而不是普通聊天机器人或不可见自动化。
          </p>
        </div>
        <ShieldCheck className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.label}
            className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm"
          >
            <div className="flex items-start gap-2">
              {item.complete ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-ink">{item.label}</p>
                  <Badge tone={item.complete ? "teal" : "amber"}>{item.complete ? "证据已通过" : "需要证据"}</Badge>
                </div>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500">{item.principle}</p>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.evidence}</p>
                {item.href ? (
                  <Link href={item.href} className="mt-2 inline-flex text-xs font-bold text-apprentice-blue">
                    查看证据
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
