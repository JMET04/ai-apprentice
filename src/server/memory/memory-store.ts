import { demoApprentice, demoRules, demoTask, demoWorkflow, recentCorrections } from "@/lib/demo-data";
import type {
  CorrectionExtraction,
  ExecutionRunRecord,
  RuleRecord,
  TeachingExampleRecord,
  VisualDemonstrationRecord,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition
} from "@/lib/types";
import { prisma } from "@/server/db/prisma";

function parseRule(row: {
  id: string;
  apprenticeId: string;
  taskId: string | null;
  title: string;
  condition: string;
  action: string;
  source: string;
  confidence: number;
  enabled: boolean;
  createdAt: string;
}): RuleRecord {
  return {
    id: row.id,
    apprenticeId: row.apprenticeId,
    taskId: row.taskId ?? demoTask.id,
    title: row.title,
    condition: row.condition,
    action: row.action,
    source: row.source === "seed" || row.source === "manual" ? row.source : "correction",
    confidence: row.confidence,
    enabled: row.enabled,
    createdAt: row.createdAt
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createStarterWorkflow(taskId: string) {
  const idMap = new Map(demoWorkflow.nodes.map((node) => [node.id, `${taskId}-${node.id}`]));
  const nodes = demoWorkflow.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id) ?? `${taskId}-${node.id}`
  }));
  const edges = demoWorkflow.edges.map((edge) => ({
    ...edge,
    id: `${taskId}-${edge.id}`,
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target
  }));

  return {
    id: `workflow-${taskId}-v1`,
    name: "Starter teaching flow",
    version: 1,
    nodes,
    edges
  };
}

export const memoryStore = {
  async listApprentices() {
    try {
      return prisma.apprentice.findMany({
        include: {
          _count: {
            select: {
              tasks: true,
              rules: true,
              corrections: true,
              runs: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      });
    } catch {
      return [
        {
          ...demoApprentice,
          userId: "user-demo-teacher",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: {
            tasks: 1,
            rules: demoRules.length,
            corrections: recentCorrections.length,
            runs: 0
          }
        }
      ];
    }
  },

  async getApprenticeProfile(id: string) {
    const apprentice = await prisma.apprentice.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { createdAt: "desc" } },
        rules: { orderBy: { createdAt: "desc" } },
        corrections: { orderBy: { createdAt: "desc" } },
        examples: { orderBy: { createdAt: "desc" } },
        visualDemos: { orderBy: { createdAt: "desc" } },
        runs: { orderBy: { createdAt: "desc" }, take: 8 }
      }
    });

    if (!apprentice) {
      return null;
    }

    return apprentice;
  },

  async createApprentice(args: {
    name: string;
    description: string;
    domain: string;
    userId?: string;
  }) {
    const now = new Date().toISOString();
    return prisma.apprentice.create({
      data: {
        id: `apprentice-${Date.now()}`,
        userId: args.userId ?? "user-demo-teacher",
        name: args.name,
        description: args.description,
        domain: args.domain,
        createdAt: now,
        updatedAt: now
      }
    });
  },

  async listRecentTasks() {
    try {
      return prisma.task.findMany({
        include: { apprentice: true },
        orderBy: { createdAt: "desc" },
        take: 6
      });
    } catch {
      return [
        {
          ...demoTask,
          inputSchema: JSON.stringify(demoTask.inputSchema),
          expectedOutput: JSON.stringify(demoTask.expectedOutput),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          apprentice: {
            ...demoApprentice,
            userId: "user-demo-teacher",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }
      ];
    }
  },

  async getTaskProfile(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        apprentice: true,
        workflows: {
          orderBy: { version: "desc" },
          include: { nodeRows: true }
        },
        rules: { orderBy: { createdAt: "desc" } },
        corrections: { orderBy: { createdAt: "desc" } },
        examples: { orderBy: { createdAt: "desc" } },
        visualDemos: { orderBy: { createdAt: "desc" } },
        runs: { orderBy: { createdAt: "desc" }, take: 6 }
      }
    });

    if (!task) {
      return null;
    }

    return task;
  },

  async getRunProfile(id: string) {
    const run = await prisma.executionRun.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            workflows: {
              orderBy: { version: "desc" }
            },
            corrections: { orderBy: { createdAt: "desc" } },
            examples: { orderBy: { createdAt: "desc" } },
            visualDemos: { orderBy: { createdAt: "desc" } }
          }
        },
        apprentice: true,
        traceSteps: { orderBy: { id: "asc" } },
        corrections: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!run) {
      return null;
    }

    return run;
  },

  async getDashboardStats() {
    let apprentices = 1;
    let workflows = 1;
    let rules = demoRules.length;
    let corrections = recentCorrections.length;
    let runs = 0;

    try {
      [apprentices, workflows, rules, corrections, runs] = await Promise.all([
        prisma.apprentice.count(),
        prisma.workflow.count(),
        prisma.rule.count({ where: { enabled: true } }),
        prisma.correction.count(),
        prisma.executionRun.count()
      ]);
    } catch {
      // Keep the dashboard usable before local setup has run.
    }

    return {
      apprentices,
      workflows,
      rules,
      corrections,
      runs
    };
  },

  async getTaskReadinessStats(taskId: string) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { apprenticeId: true }
      });

      if (!task) {
        return null;
      }

      const [workflows, rules, corrections, runs] = await Promise.all([
        prisma.workflow.count({ where: { taskId } }),
        prisma.rule.count({ where: { taskId, enabled: true } }),
        prisma.correction.count({ where: { taskId } }),
        prisma.executionRun.count({ where: { taskId } })
      ]);

      return {
        apprentices: 1,
        workflows,
        rules,
        corrections,
        runs
      };
    } catch {
      return {
        apprentices: 1,
        workflows: 1,
        rules: demoRules.filter((rule) => rule.enabled).length,
        corrections: recentCorrections.length,
        runs: 0
      };
    }
  },

  async listRules(args: { apprenticeId?: string; taskId?: string; includeDisabled?: boolean } = {}) {
    try {
      const rows = await prisma.rule.findMany({
        where: {
          apprenticeId: args.apprenticeId ?? demoApprentice.id,
          ...(args.includeDisabled ? {} : { enabled: true }),
          OR: [{ taskId: args.taskId ?? demoTask.id }, { taskId: null }]
        },
        orderBy: { createdAt: "asc" }
      });
      return rows.map(parseRule);
    } catch {
      return demoRules;
    }
  },

  async saveRule(rule: RuleRecord) {
    await prisma.rule.upsert({
      where: { id: rule.id },
      update: {
        title: rule.title,
        condition: rule.condition,
        action: rule.action,
        source: rule.source,
        confidence: rule.confidence,
        enabled: rule.enabled
      },
      create: {
        id: rule.id,
        apprenticeId: rule.apprenticeId,
        taskId: rule.taskId,
        title: rule.title,
        condition: rule.condition,
        action: rule.action,
        source: rule.source,
        confidence: rule.confidence,
        enabled: rule.enabled,
        createdAt: rule.createdAt
      }
    });
    return rule;
  },

  async updateRuleEnabled(args: {
    ruleId: string;
    enabled: boolean;
    apprenticeId?: string;
    taskId?: string;
  }) {
    const rule = await prisma.rule.findUnique({ where: { id: args.ruleId } });

    if (!rule) {
      return null;
    }

    if (args.apprenticeId && rule.apprenticeId !== args.apprenticeId) {
      throw new Error("Rule does not belong to this apprentice.");
    }

    if (args.taskId && rule.taskId !== args.taskId) {
      throw new Error("Rule does not belong to this task.");
    }

    const updated = await prisma.rule.update({
      where: { id: args.ruleId },
      data: { enabled: args.enabled }
    });

    return parseRule(updated);
  },

  async saveRun(run: ExecutionRunRecord) {
    await prisma.executionRun.create({
      data: {
        id: run.id,
        taskId: run.taskId,
        apprenticeId: run.apprenticeId,
        input: JSON.stringify({ rawTravelNote: run.input }),
        output: JSON.stringify(run.output),
        status: run.status,
        trace: JSON.stringify(run.trace),
        createdAt: run.createdAt,
        traceSteps: {
          create: run.trace.map((step) => ({
            id: `${run.id}-${step.id}`,
            nodeId: step.nodeId,
            stepName: step.stepName,
            input: JSON.stringify(step.input),
            output: JSON.stringify(step.output),
            appliedRules: JSON.stringify(step.appliedRules),
            confidence: step.confidence,
            needsHumanReview: step.needsHumanReview,
            validation: step.validation,
            uncertainty: JSON.stringify(step.uncertainty),
            createdAt: run.createdAt
          }))
        }
      }
    });
    return run;
  },

  async saveTaskDraft(args: {
    apprenticeId: string;
    name: string;
    goal: string;
    inputExample: string;
    expectedOutput: string;
    notes: string;
    errorCases: string;
  }) {
    const now = new Date().toISOString();
    const id = `task-${Date.now()}`;
    const fields = args.expectedOutput
      .split(/[,，、\r\n]+/)
      .map((field) => field.trim())
      .filter(Boolean);
    const errorCases = args.errorCases
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const starterWorkflow = createStarterWorkflow(id);

    return prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          id,
          apprenticeId: args.apprenticeId,
          name: args.name,
          goal: args.goal,
          inputSchema: JSON.stringify({
            rawInput: "string",
            example: args.inputExample
          }),
          expectedOutput: JSON.stringify({
            fields,
            notes: args.notes,
            errorCases
          }),
          status: "draft",
          createdAt: now,
          updatedAt: now
        }
      });

      const workflow = await tx.workflow.create({
        data: {
          id: starterWorkflow.id,
          taskId: task.id,
          name: starterWorkflow.name,
          version: starterWorkflow.version,
          nodes: JSON.stringify(starterWorkflow.nodes),
          edges: JSON.stringify(starterWorkflow.edges),
          createdAt: now,
          updatedAt: now,
          nodeRows: {
            create: starterWorkflow.nodes.map((node) => ({
              id: node.id,
              type: node.type,
              label: node.label,
              description: node.description,
              inputFields: JSON.stringify(node.inputFields),
              outputFields: JSON.stringify(node.outputFields),
              validationRules: JSON.stringify(node.validationRules),
              fallbackBehavior: node.fallbackBehavior
            }))
          }
        }
      });

      return { task, workflow };
    });
  },

  async saveWorkflowVersion(args: {
    workflowId: string;
    nodes: WorkflowNodeDefinition[];
    edges: WorkflowEdgeDefinition[];
  }) {
    const now = new Date().toISOString();

    return prisma.$transaction(async (tx) => {
      const current = await tx.workflow.findUnique({
        where: { id: args.workflowId },
        select: { version: true }
      });
      const nextVersion = (current?.version ?? 0) + 1;

      const workflow = await tx.workflow.update({
        where: { id: args.workflowId },
        data: {
          version: nextVersion,
          nodes: JSON.stringify(args.nodes),
          edges: JSON.stringify(args.edges),
          updatedAt: now
        }
      });

      await tx.workflowNode.deleteMany({
        where: { workflowId: args.workflowId }
      });

      await tx.workflowNode.createMany({
        data: args.nodes.map((node) => ({
          id: node.id,
          workflowId: args.workflowId,
          type: node.type,
          label: node.label,
          description: node.description,
          inputFields: JSON.stringify(node.inputFields),
          outputFields: JSON.stringify(node.outputFields),
          validationRules: JSON.stringify(node.validationRules),
          fallbackBehavior: node.fallbackBehavior
        }))
      });

      return workflow;
    });
  },

  async saveCorrection(args: {
    extraction: CorrectionExtraction;
    feedback: string;
    beforeOutput: unknown;
    afterOutput?: unknown;
    apprenticeId: string;
    taskId: string;
    runId?: string | null;
  }) {
    await prisma.correction.create({
      data: {
        id: `correction-${Date.now()}`,
        apprenticeId: args.apprenticeId,
        taskId: args.taskId,
        runId: args.runId ?? null,
        userFeedback: args.feedback,
        errorType: args.extraction.errorType,
        extractedRule: JSON.stringify(args.extraction.extractedRule),
        beforeOutput: JSON.stringify(args.beforeOutput),
        afterOutput: args.afterOutput ? JSON.stringify(args.afterOutput) : null,
        learningTrace: JSON.stringify(args.extraction.learningTrace),
        createdAt: new Date().toISOString()
      }
    });
    return args.extraction;
  },

  async saveTeachingExample(example: TeachingExampleRecord) {
    await prisma.teachingExample.create({
      data: {
        id: example.id,
        apprenticeId: example.apprenticeId,
        taskId: example.taskId,
        input: example.input,
        expectedOutput: JSON.stringify(example.expectedOutput),
        extractedRule: example.extractedRule ? JSON.stringify(example.extractedRule) : null,
        learningTrace: example.learningTrace ? JSON.stringify(example.learningTrace) : null,
        createdAt: example.createdAt
      }
    });
    return example;
  },

  async saveVisualDemonstration(demo: VisualDemonstrationRecord) {
    await prisma.visualDemonstration.create({
      data: {
        id: demo.id,
        apprenticeId: demo.apprenticeId,
        taskId: demo.taskId,
        title: demo.title,
        artifact: JSON.stringify(demo.artifact),
        teacherNotes: demo.teacherNotes,
        extractedRule: demo.extractedRule ? JSON.stringify(demo.extractedRule) : null,
        learningTrace: demo.learningTrace ? JSON.stringify(demo.learningTrace) : null,
        createdAt: demo.createdAt
      }
    });
    return demo;
  },

  async listCorrections(args: { apprenticeId?: string; take?: number } = {}) {
    try {
      return prisma.correction.findMany({
        where: args.apprenticeId ? { apprenticeId: args.apprenticeId } : undefined,
        orderBy: { createdAt: "desc" },
        take: args.take ?? 6
      });
    } catch {
      return recentCorrections.map((correction) => ({
        id: correction.id,
        apprenticeId: demoApprentice.id,
        taskId: demoTask.id,
        runId: null,
        userFeedback: correction.feedback,
        errorType: "lighting_condition_rule",
        extractedRule: JSON.stringify(correction.extractedRule),
        beforeOutput: "{}",
        afterOutput: null,
        createdAt: correction.createdAt
      }));
    }
  }
};
