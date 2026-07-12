import { PrismaClient } from "@prisma/client";
import {
  demoApprentice,
  demoRules,
  demoTeachingExamples,
  demoTask,
  demoWorkflow
} from "../src/lib/demo-data";

const prisma = new PrismaClient();

async function main() {
  const now = new Date().toISOString();
  const user = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      name: "Demo Teacher",
      email: "teacher@example.com",
      createdAt: now
    }
  });

  const apprentice = await prisma.apprentice.upsert({
    where: { id: demoApprentice.id },
    update: {
      name: demoApprentice.name,
      description: demoApprentice.description,
      domain: demoApprentice.domain
    },
    create: {
      id: demoApprentice.id,
      userId: user.id,
      name: demoApprentice.name,
      description: demoApprentice.description,
      domain: demoApprentice.domain,
      createdAt: now,
      updatedAt: now
    }
  });

  const task = await prisma.task.upsert({
    where: { id: demoTask.id },
    update: {
      name: demoTask.name,
      goal: demoTask.goal,
      inputSchema: JSON.stringify(demoTask.inputSchema),
      expectedOutput: JSON.stringify(demoTask.expectedOutput),
      status: demoTask.status
    },
    create: {
      id: demoTask.id,
      apprenticeId: apprentice.id,
      name: demoTask.name,
      goal: demoTask.goal,
      inputSchema: JSON.stringify(demoTask.inputSchema),
      expectedOutput: JSON.stringify(demoTask.expectedOutput),
      status: demoTask.status,
      createdAt: now,
      updatedAt: now
    }
  });

  await prisma.workflow.upsert({
    where: { id: demoWorkflow.id },
    update: {
      name: demoWorkflow.name,
      version: demoWorkflow.version,
      nodes: JSON.stringify(demoWorkflow.nodes),
      edges: JSON.stringify(demoWorkflow.edges)
    },
    create: {
      id: demoWorkflow.id,
      taskId: task.id,
      name: demoWorkflow.name,
      version: demoWorkflow.version,
      nodes: JSON.stringify(demoWorkflow.nodes),
      edges: JSON.stringify(demoWorkflow.edges),
      createdAt: now,
      updatedAt: now,
      nodeRows: {
        create: demoWorkflow.nodes.map((node) => ({
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

  for (const rule of demoRules) {
    await prisma.rule.upsert({
      where: { id: rule.id },
      update: {
        title: rule.title,
        condition: rule.condition,
        action: rule.action,
        source: rule.source,
        confidence: rule.confidence,
        enabled: rule.enabled
        ,
        createdAt: rule.createdAt
      },
      create: {
        ...rule,
        apprenticeId: apprentice.id,
        taskId: task.id
      }
    });
  }

  for (const example of demoTeachingExamples) {
    await prisma.teachingExample.upsert({
      where: { id: example.id },
      update: {
        input: example.input,
        expectedOutput: JSON.stringify(example.expectedOutput),
        extractedRule: example.extractedRule ? JSON.stringify(example.extractedRule) : null,
        createdAt: example.createdAt
      },
      create: {
        id: example.id,
        apprenticeId: apprentice.id,
        taskId: task.id,
        input: example.input,
        expectedOutput: JSON.stringify(example.expectedOutput),
        extractedRule: example.extractedRule ? JSON.stringify(example.extractedRule) : null,
        createdAt: example.createdAt
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
