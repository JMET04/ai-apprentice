export type ArchitectureAuditLayer = {
  name: string;
  path: string;
  responsibility: string;
  proof: string;
};

export const architectureAuditLayers: ArchitectureAuditLayer[] = [
  {
    name: "UI layer",
    path: "src/app, src/components",
    responsibility: "Render apprentice, task, workflow, run, trace, correction, and evidence screens.",
    proof: "Pages and components consume service data but keep execution and memory logic outside the UI."
  },
  {
    name: "API layer",
    path: "src/app/api",
    responsibility: "Expose apprentice, task, workflow, run, correction, example, visual-demo, rule, and history endpoints.",
    proof: "Routes validate request ownership and delegate persistence/execution work to server modules."
  },
  {
    name: "AI service layer",
    path: "src/server/ai",
    responsibility: "Isolate mock AI execution behind a replaceable service boundary.",
    proof: "The mock service implements the same contract a real model adapter can later satisfy."
  },
  {
    name: "Workflow execution engine",
    path: "src/server/workflow",
    responsibility: "Run the photography journal workflow and produce structured output plus public trace steps.",
    proof: "Execution logic maps learned rules to output changes and workflow-node trace evidence."
  },
  {
    name: "Memory store",
    path: "src/server/memory",
    responsibility: "Persist apprentices, tasks, workflows, rules, corrections, examples, visual demos, runs, and trace rows.",
    proof: "The store is the single server-facing boundary around Prisma persistence."
  },
  {
    name: "Trace store",
    path: "src/server/traces",
    responsibility: "Summarize rule decisions, applied memory, disabled memory, unmatched rules, and review points.",
    proof: "Trace tests verify summary counts and public-trace guardrail behavior."
  },
  {
    name: "Correction and rule extraction",
    path: "src/server/corrections",
    responsibility: "Convert natural-language corrections, structured feedback, examples, visual demos, and execution history into reusable rules.",
    proof: "Extractors return public learning traces with confidence, validation, and review status."
  },
  {
    name: "Tool registry",
    path: "src/server/registries/tool-registry.ts",
    responsibility: "Reserve MCP/tool capability slots without mixing them into UI or execution code.",
    proof: "The dashboard displays available tool slots from a dedicated registry module."
  },
  {
    name: "Skill registry",
    path: "src/server/registries/skill-registry.ts",
    responsibility: "Reserve teachable skill slots separately from tools and execution.",
    proof: "The dashboard displays skill slots from a dedicated registry module."
  },
  {
    name: "Guardrail and policy layer",
    path: "src/server/policy",
    responsibility: "Prevent private reasoning leakage and decide when teacher review is required.",
    proof: "The execution engine calls public-trace and review guardrails before returning run evidence."
  }
];
