import { FileSearch, LockKeyhole } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ready_for_teacher_review: "等待老师审查",
    needs_more_evidence: "需要更多证据"
  };

  return labels[status] ?? status;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "Inspect visual learning evidence": "检查可视化学习证据",
    "Run review-only probes": "运行只审查探针",
    "Rerun local verifier": "重跑本地验证",
    "Accept technology": "确认技术合格",
    Package: "封装",
    Release: "发布",
    Wrap: "包装/封装交付"
  };

  return labels[action] ?? action;
}

export function VisualReviewManifestPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const manifest = report.visualReviewManifest;

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="blue">{manifest.evidenceEndpoints.length} 个只读证据接口</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化审查清单</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这是给外部检查器和 MCP 工具读取的审查清单，列出证据位置、验证命令、只审查模式和封装锁，不提供验收动作。
          </p>
        </div>
        <FileSearch className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">状态</p>
          <p className="mt-1 text-sm font-black text-ink">{statusLabel(manifest.status)}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">只审查</p>
          <p className="mt-1 text-sm font-black text-ink">{manifest.reviewOnly ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-sm font-black text-ink">{manifest.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-sm font-black text-ink">{manifest.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-line bg-mist p-4">
          <p className="text-xs font-bold uppercase text-slate-500">验证命令</p>
          <p className="mt-2 break-words rounded-md bg-white px-3 py-2 font-mono text-sm font-bold text-ink">
            {manifest.verifierCommand}
          </p>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
            <p>
              <span className="font-bold text-ink">审查页面：</span> {manifest.localReviewUrl}
            </p>
            <p>
              <span className="font-bold text-ink">API 报告：</span> {manifest.apiReviewUrl}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-apprentice-blue" />
            <p className="font-extrabold text-blue-950">清单锁定事项</p>
          </div>
          <p className="mt-2">{manifest.blockedActions.map(actionLabel).join(" / ")}</p>
          <p className="mt-2 text-xs font-semibold text-blue-800">
            允许：{manifest.allowedActions.map(actionLabel).join(" / ")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-sm font-extrabold text-ink">证据接口</p>
          <div className="mt-3 grid gap-2">
            {manifest.evidenceEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="rounded-md border border-line bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">{endpoint.method}</Badge>
                  <Badge>{endpoint.persisted ? "已持久化" : "不持久化"}</Badge>
                </div>
                <p className="mt-2 text-sm font-extrabold text-ink">{endpoint.label}</p>
                <p className="mt-1 break-words font-mono text-xs text-slate-500">{endpoint.href}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-extrabold text-ink">证据章节</p>
          <div className="mt-3 grid gap-2">
            {manifest.evidenceSections.map((section) => (
              <div key={section.id} className="rounded-md border border-line bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={section.passed ? "teal" : "amber"}>{section.passed ? "就绪" : "需要证据"}</Badge>
                  <Badge>{section.id}</Badge>
                </div>
                <p className="mt-2 text-sm font-extrabold text-ink">{section.label}</p>
                <p className="mt-1 break-words font-mono text-xs text-slate-500">{section.source}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Surface>
  );
}
