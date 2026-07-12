import { prisma } from "../src/server/db/prisma";

async function main() {
  const humanCreatedAt = "2026-06-01T04:06:23.624Z";
  const humanRule = {
    id: "human-teaching-rule-1780286783624",
    apprenticeId: "apprentice-photo-journal",
    taskId: "task-photo-travel-journal",
    title: "人类带教待确认：三维导轨先确认坐标系",
    condition: "当老师用三维坐标描述导轨或线条时，先确认坐标系、单位、轴向和容差。",
    action: "先复述老师规则，再检查旧记忆是否冲突；确认原点、单位、轴向和容差后，生成多个拟合候选让老师选择。",
    source: "manual" as const,
    confidence: 0.88,
    enabled: false,
    createdAt: humanCreatedAt
  };
  const humanNote = "这条规则用于工程三维坐标带教，不要直接套到摄影游记任务；未来命中时先请老师确认。";

  await prisma.rule.update({
    where: { id: humanRule.id },
    data: {
      title: humanRule.title,
      condition: humanRule.condition,
      action: humanRule.action,
      confidence: humanRule.confidence,
      enabled: humanRule.enabled,
      createdAt: humanRule.createdAt
    }
  });

  const humanCorrection = await prisma.correction.findUnique({ where: { id: "human-knowledge-ingest-1780286783624" } });
  if (humanCorrection) {
    const beforeOutput = JSON.parse(humanCorrection.beforeOutput) as { teacherNote?: string };
    beforeOutput.teacherNote = humanNote;
    const learningTrace = JSON.parse(humanCorrection.learningTrace ?? "[]") as Array<{ evidence?: string }>;
    if (learningTrace[0]) learningTrace[0].evidence = humanNote;
    await prisma.correction.update({
      where: { id: humanCorrection.id },
      data: {
        userFeedback: humanNote,
        extractedRule: JSON.stringify(humanRule),
        beforeOutput: JSON.stringify(beforeOutput),
        learningTrace: JSON.stringify(learningTrace)
      }
    });
  }

  const spatialReview = await prisma.correction.findUnique({ where: { id: "spatial-memory-review-1780285735103" } });
  if (spatialReview) {
    const teacherNote = "请把沿 x 轴延展作为适用条件，未来匹配前先解释坐标系、残差和容差。";
    const afterOutput = JSON.parse(spatialReview.afterOutput ?? "{}") as { teacherNote?: string };
    afterOutput.teacherNote = teacherNote;
    const learningTrace = JSON.parse(spatialReview.learningTrace ?? "[]") as Array<{ evidence?: string }>;
    if (learningTrace[0]) learningTrace[0].evidence = `补充适用条件，未来匹配前先解释条件：${teacherNote}`;
    await prisma.correction.update({
      where: { id: spatialReview.id },
      data: {
        userFeedback: teacherNote,
        afterOutput: JSON.stringify(afterOutput),
        learningTrace: JSON.stringify(learningTrace)
      }
    });
  }

  const codePatchReview = await prisma.correction.findUnique({
    where: { id: "spatial-code-patch-match-review-1780291032758" }
  });
  if (codePatchReview) {
    const teacherNote = "这次只能作为同类导轨参考，未来命中前要展示 JSON 锚点差异。";
    const afterOutput = JSON.parse(codePatchReview.afterOutput ?? "{}") as { teacherNote?: string };
    afterOutput.teacherNote = teacherNote;
    const learningTrace = JSON.parse(codePatchReview.learningTrace ?? "[]") as Array<{ evidence?: string }>;
    if (learningTrace[0]) learningTrace[0].evidence = `收窄旧代码草稿适用条件：${teacherNote}`;
    await prisma.correction.update({
      where: { id: codePatchReview.id },
      data: {
        userFeedback: teacherNote,
        afterOutput: JSON.stringify(afterOutput),
        learningTrace: JSON.stringify(learningTrace)
      }
    });
  }

  const teacherDraft = await prisma.correction.findUnique({ where: { id: "visual-teacher-review-draft-1780296098911" } });
  if (teacherDraft) {
    const itemLabel = "三维拟合候选解释还不够清楚";
    const note = "希望每个候选说明更短、更像老师能直接选择的选项。";
    const followUpDraft = "下一轮优先补强三维拟合候选解释，并继续保持 accepted=false、packagingGated=true。";
    const userFeedback = [
      "老师审查草稿：暂定通过 1 项，需要修改 1 项，不确定 0 项，未标注 0 项。",
      `1. 需要修改：${itemLabel}；老师备注：${note}`
    ].join("\n");
    const extractedRule = JSON.parse(teacherDraft.extractedRule) as { action?: string };
    extractedRule.action = `下一轮优先处理：${itemLabel}。`;
    const afterOutput = JSON.parse(teacherDraft.afterOutput ?? "{}") as {
      followUpItems?: Array<{ id: string; label: string; decision: string; note: string }>;
      followUpDraft?: string;
    };
    afterOutput.followUpItems = [{ id: "spatial-fit-selection-decision", label: itemLabel, decision: "needs_change", note }];
    afterOutput.followUpDraft = followUpDraft;
    const learningTrace = JSON.parse(teacherDraft.learningTrace ?? "[]") as Array<{ evidence?: string }>;
    if (learningTrace[0]) learningTrace[0].evidence = userFeedback;
    if (learningTrace[1]) learningTrace[1].evidence = followUpDraft;
    await prisma.correction.update({
      where: { id: teacherDraft.id },
      data: {
        userFeedback,
        extractedRule: JSON.stringify(extractedRule),
        afterOutput: JSON.stringify(afterOutput),
        learningTrace: JSON.stringify(learningTrace)
      }
    });
  }

  const rows = [
    ...(await prisma.rule.findMany()).map((row) => ({ table: "Rule", id: row.id, text: JSON.stringify(row) })),
    ...(await prisma.correction.findMany()).map((row) => ({ table: "Correction", id: row.id, text: JSON.stringify(row) })),
    ...(await prisma.teachingExample.findMany()).map((row) => ({
      table: "TeachingExample",
      id: row.id,
      text: JSON.stringify(row)
    })),
    ...(await prisma.visualDemonstration.findMany()).map((row) => ({
      table: "VisualDemonstration",
      id: row.id,
      text: JSON.stringify(row)
    }))
  ];
  const unreadableRows = rows.filter((row) => /\?{4,}/.test(row.text) || row.text.includes("�"));

  console.log(
    JSON.stringify(
      {
        repaired: unreadableRows.length === 0,
        checkedRows: rows.length,
        unreadableRows: unreadableRows.map((row) => `${row.table}:${row.id}`)
      },
      null,
      2
    )
  );

  if (unreadableRows.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
