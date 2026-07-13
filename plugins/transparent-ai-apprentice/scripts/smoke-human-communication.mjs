#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileHumanCommunicationGuidance } from "./compile-human-communication-guidance.mjs";
import { checkHumanCommunicationStyle } from "./check-human-communication-style.mjs";

const checks = [];

function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
}

const cases = [
  ["你怎么又把我的要求理解错了", "correction"],
  ["蒙版一打开就闪退", "failure"],
  ["请告诉我当前进展", "status"],
  ["我今天状态很差", "emotional"],
  ["这次测试通过了", "success"],
  ["这个 JSON Schema 怎么用", "technical"]
];

for (const [message, expectedContext] of cases) {
  const packet = compileHumanCommunicationGuidance({ message, context: "auto" });
  check(`Infers ${expectedContext} context`, packet.context === expectedContext);
  check(`${expectedContext} starts from the user's point`, packet.requiredBehaviors.includes("Answer the user's exact last sentence first."));
  check(`${expectedContext} preserves identity boundary`, packet.locks.pretendsToBeHuman === false && packet.locks.fabricatesBiography === false);
}

const toneRepair = compileHumanCommunicationGuidance({ message: "这句话太像客服了，说人话", context: "auto" });
check("Tone repair requests immediate sentence-shape repair", toneRepair.requiredBehaviors.some((item) => item.includes("exact sentence shape")));
check("Tone repair avoids dependency", toneRepair.locks.encouragesDependency === false);

const englishToneRepair = compileHumanCommunicationGuidance({ message: "This sounds like AI and too robotic.", context: "auto" });
check("English tone repair is inferred", englishToneRepair.context === "correction" && englishToneRepair.userSignal.toneRepair === true);

const goodCorrection = checkHumanCommunicationStyle({
  text: "这次确实改多了。你要的是保留原结构，只调整上盖方向；我按这个边界重做。",
  context: "correction"
});
check("Natural correction passes", goodCorrection.passed);

const reportCorrection = checkHumanCommunicationStyle({
  text: "已同步规则如下：核心问题是语气不够自然，后续我会调整语气。",
  context: "correction"
});
check("Changelog correction is flagged", reportCorrection.findings.some((item) => item.id === "changelog_voice"));
check("Canned tone repair is flagged", reportCorrection.findings.some((item) => item.id === "canned_tone_repair"));

const processNarration = checkHumanCommunicationStyle({
  text: "我先接住你的情绪，再陪你慢慢分析。",
  context: "emotional"
});
check("Process narration is flagged", processNarration.findings.some((item) => item.id === "process_narration"));

const intake = checkHumanCommunicationStyle({
  text: "如果你愿意，可以慢慢说，你不用把话说完整。",
  context: "emotional"
});
check("Therapy intake scaffold is flagged", intake.findings.some((item) => item.id === "therapy_intake_scaffold"));

const technicalStatus = checkHumanCommunicationStyle({
  text: "已完成核心流程测试。当前有两项阻塞：真实宿主验证和人工验收。",
  context: "status"
});
check("Technical status may say completed", technicalStatus.passed);

const fakeHuman = checkHumanCommunicationStyle({
  text: "我小时候也经历过，所以只有我懂你。",
  context: "emotional"
});
check("Fabricated biography is flagged", fakeHuman.findings.some((item) => item.id === "fabricated_human_biography"));
check("Exclusive attachment is flagged", fakeHuman.findings.some((item) => item.id === "exclusive_attachment"));

const englishBoundary = checkHumanCommunicationStyle({
  text: "I went through this myself, so only I understand you.",
  context: "emotional"
});
check("English fabricated biography is flagged", englishBoundary.findings.some((item) => item.id === "fabricated_human_biography"));
check("English exclusive attachment is flagged", englishBoundary.findings.some((item) => item.id === "exclusive_attachment"));

const sycophancy = checkHumanCommunicationStyle({
  text: "你说得完全对，这是一个太棒的问题！",
  context: "casual"
});
check("Sycophancy is flagged", sycophancy.findings.some((item) => item.id === "sycophancy"));

const formula = checkHumanCommunicationStyle({
  text: "这不是失败，而是学习。你不是做错了，而是还没找到方法。",
  context: "emotional"
});
check("Repeated polished reframes are flagged", formula.findings.some((item) => item.id === "formulaic_reframe"));

const tempDir = mkdtempSync(join(tmpdir(), "ai-apprentice-human-communication-"));
try {
  const schema = JSON.parse(readFileSync(new URL("../schemas/human-communication-guidance.schema.json", import.meta.url), "utf8"));
  check("Schema declares guidance format", schema.properties.format.const === "transparent_ai_apprentice_human_communication_guidance_v1");
  check("Schema locks false human identity", schema.properties.locks.properties.pretendsToBeHuman.const === false);
  check("Smoke temp directory is isolated", tempDir.includes("ai-apprentice-human-communication-"));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const failed = checks.filter((item) => !item.passed);
const result = {
  format: "transparent_ai_apprentice_human_communication_smoke_v1",
  passed: failed.length === 0,
  total: checks.length,
  passedCount: checks.length - failed.length,
  failedCount: failed.length,
  checks
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failed.length > 0) process.exitCode = 1;
