import { CheckCircle2, Layers3 } from "lucide-react";
import type { ArchitectureAuditLayer } from "@/lib/architecture-audit";
import { Badge, Surface } from "./ui";

export function ArchitectureAuditPanel({
  layers
}: Readonly<{
  layers: ArchitectureAuditLayer[];
}>) {
  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">
            Architecture layers {layers.length}/{layers.length}
          </Badge>
          <h2 className="mt-3 font-extrabold text-ink">Architecture Boundary Audit</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            The apprentice system keeps UI, API, AI service, workflow execution, memory, trace, correction extraction,
            tool/skill registries, and guardrails separate so the beta can be tested without hiding product risk.
          </p>
        </div>
        <Layers3 className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {layers.map((layer) => (
          <article key={layer.name} className="rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-ink">{layer.name}</p>
                  <Badge tone="blue">{layer.path}</Badge>
                </div>
                <p className="mt-2 leading-6 text-slate-700">{layer.responsibility}</p>
                <p className="mt-2 break-words rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                  {layer.proof}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
