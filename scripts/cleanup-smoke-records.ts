import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/server/db/prisma";

type CleanupSummary = {
  mode: "dry-run" | "apply";
  generatedAt: string;
  smokeTasks: Array<{
    id: string;
    name: string;
    apprenticeId: string;
    createdAt: string;
    counts: {
      workflows: number;
      runs: number;
      rules: number;
      corrections: number;
      examples: number;
      visualDemos: number;
    };
  }>;
  smokeApprentices: Array<{
    id: string;
    name: string;
    createdAt: string;
    counts: {
      tasks: number;
      runs: number;
      rules: number;
      corrections: number;
    };
  }>;
  deleted?: Record<string, number>;
  nextAction: string;
};

const apply = process.argv.includes("--apply");
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const reportPath = path.join(artifactsDir, "smoke-record-cleanup.json");

async function getSmokeInventory() {
  const smokeTasks = await prisma.task.findMany({
    where: { name: { startsWith: "Smoke photography journal " } },
    select: {
      id: true,
      name: true,
      apprenticeId: true,
      createdAt: true,
      _count: {
        select: {
          workflows: true,
          runs: true,
          rules: true,
          corrections: true,
          examples: true,
          visualDemos: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const smokeApprentices = await prisma.apprentice.findMany({
    where: { name: { startsWith: "Smoke Apprentice " } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          tasks: true,
          runs: true,
          rules: true,
          corrections: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    smokeTasks: smokeTasks.map((task) => ({
      id: task.id,
      name: task.name,
      apprenticeId: task.apprenticeId,
      createdAt: task.createdAt,
      counts: task._count
    })),
    smokeApprentices: smokeApprentices.map((apprentice) => ({
      id: apprentice.id,
      name: apprentice.name,
      createdAt: apprentice.createdAt,
      counts: apprentice._count
    }))
  };
}

async function applyCleanup(taskIds: string[], apprenticeIds: string[]) {
  if (taskIds.length === 0 && apprenticeIds.length === 0) {
    return {
      corrections: 0,
      traceSteps: 0,
      executionRuns: 0,
      rules: 0,
      examples: 0,
      visualDemos: 0,
      workflowNodes: 0,
      workflows: 0,
      tasks: 0,
      apprentices: 0
    };
  }

  return prisma.$transaction(async (tx) => {
    const runIds = (
      await tx.executionRun.findMany({
        where: { OR: [{ taskId: { in: taskIds } }, { apprenticeId: { in: apprenticeIds } }] },
        select: { id: true }
      })
    ).map((run) => run.id);

    const workflowIds = (
      await tx.workflow.findMany({
        where: { taskId: { in: taskIds } },
        select: { id: true }
      })
    ).map((workflow) => workflow.id);

    const corrections = await tx.correction.deleteMany({
      where: { OR: [{ taskId: { in: taskIds } }, { apprenticeId: { in: apprenticeIds } }] }
    });
    const traceSteps = await tx.traceStep.deleteMany({
      where: { runId: { in: runIds } }
    });
    const executionRuns = await tx.executionRun.deleteMany({
      where: { id: { in: runIds } }
    });
    const rules = await tx.rule.deleteMany({
      where: { OR: [{ taskId: { in: taskIds } }, { apprenticeId: { in: apprenticeIds } }] }
    });
    const examples = await tx.teachingExample.deleteMany({
      where: { OR: [{ taskId: { in: taskIds } }, { apprenticeId: { in: apprenticeIds } }] }
    });
    const visualDemos = await tx.visualDemonstration.deleteMany({
      where: { OR: [{ taskId: { in: taskIds } }, { apprenticeId: { in: apprenticeIds } }] }
    });
    const workflowNodes = await tx.workflowNode.deleteMany({
      where: { workflowId: { in: workflowIds } }
    });
    const workflows = await tx.workflow.deleteMany({
      where: { id: { in: workflowIds } }
    });
    const tasks = await tx.task.deleteMany({
      where: { id: { in: taskIds }, name: { startsWith: "Smoke photography journal " } }
    });
    const apprentices = await tx.apprentice.deleteMany({
      where: {
        id: { in: apprenticeIds },
        name: { startsWith: "Smoke Apprentice " },
        tasks: { none: {} }
      }
    });

    return {
      corrections: corrections.count,
      traceSteps: traceSteps.count,
      executionRuns: executionRuns.count,
      rules: rules.count,
      examples: examples.count,
      visualDemos: visualDemos.count,
      workflowNodes: workflowNodes.count,
      workflows: workflows.count,
      tasks: tasks.count,
      apprentices: apprentices.count
    };
  });
}

async function main() {
  const before = await getSmokeInventory();
  const taskIds = before.smokeTasks.map((task) => task.id);
  const apprenticeIds = Array.from(
    new Set([...before.smokeTasks.map((task) => task.apprenticeId), ...before.smokeApprentices.map((apprentice) => apprentice.id)])
  );

  const deleted = apply ? await applyCleanup(taskIds, apprenticeIds) : undefined;
  const after = apply ? await getSmokeInventory() : before;

  const summary: CleanupSummary = {
    mode: apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    smokeTasks: after.smokeTasks,
    smokeApprentices: after.smokeApprentices,
    deleted,
    nextAction: apply
      ? "Run npm run smoke:product and confirm the product entry still targets task-photo-travel-journal."
      : "Run npm run cleanup:smoke-records -- --apply to delete these generated smoke records."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReport written to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
