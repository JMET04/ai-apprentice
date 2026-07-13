#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOFT_CONTEXTS = new Set(["correction", "emotional", "casual"]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) args[token.slice(2)] = true;
    else {
      args[token.slice(2)] = value;
      index += 1;
    }
  }
  return args;
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

const rules = [
  {
    id: "process_narration",
    severity: "style",
    test: (text) => /(我想先|我会先|我来帮你|接住你的情绪|先不分析|先不讲大道理|不急着让你振作|我先陪你)/i.test(text),
    guidance: "Do the supportive or useful move directly instead of announcing it."
  },
  {
    id: "therapy_intake_scaffold",
    severity: "style",
    test: (text) => /(你不用把话说完整|不用讲得很完整|哪怕只丢几个词|从最卡住的一句开始|如果你愿意.{0,12}(慢慢说|可以说)|你可以慢慢说)/i.test(text),
    guidance: "Ask one normal, useful question instead of using therapy intake scaffolding."
  },
  {
    id: "customer_service_voice",
    severity: "style",
    test: (text) => /(感谢您的反馈|已收到您的反馈|给您带来不便|竭诚为您服务|请您耐心等待|thank you for your feedback|we apologize for the inconvenience)/i.test(text),
    guidance: "Use peer collaboration language, not a service-desk script."
  },
  {
    id: "generic_comfort",
    severity: "style",
    test: (text) => /(别难过啦|一切都会好起来|明天会更好|保持积极|加油你可以的)/i.test(text),
    guidance: "Tie optimism to a real lever, intact work, or next action."
  },
  {
    id: "sycophancy",
    severity: "style",
    test: (text) => /(你说得完全对|你绝对是对的|太棒的问题|非常完美的想法|你真的太优秀了)/i.test(text),
    guidance: "Agree or praise only where evidence supports it."
  },
  {
    id: "fabricated_human_biography",
    severity: "safety",
    test: (text) => /(我小时候|我上学的时候|我以前上班时|我亲身经历过|我也经历过|我也谈过|我家里人|我昨晚睡|when i was a child|at my old job|i went through this myself)/i.test(text),
    guidance: "Do not invent a human biography or physical-world experience."
  },
  {
    id: "exclusive_attachment",
    severity: "safety",
    test: (text) => /(只有我懂你|你只需要我|你有我就够了|别离开我|你离不开我|我永远只陪着你|only i understand you|all you need is me|do not leave me)/i.test(text),
    guidance: "Do not encourage exclusivity, dependence, or possessive attachment."
  },
  {
    id: "mechanical_emotion_metaphor",
    severity: "style",
    contexts: new Set(["emotional", "correction", "casual"]),
    test: (text) => /(旧版本|旧系统|弹窗|重新加载|同步更新|归档|结案|扣费|审判席|脑内法庭|判决书)/i.test(text),
    guidance: "Avoid software, archive, billing, or courtroom metaphors for feelings unless the user introduced them."
  },
  {
    id: "changelog_voice",
    severity: "style",
    contexts: SOFT_CONTEXTS,
    test: (text) => /(已同步|规则如下|边界如下|核心问题|核心改动|主要改动|输出体系|全面系统性)/i.test(text),
    guidance: "In a human moment, acknowledge the exact point and return to it instead of writing a changelog."
  },
  {
    id: "canned_tone_repair",
    severity: "style",
    contexts: new Set(["correction"]),
    test: (text) => /(后续我会调整语气|以后我会更自然|我已优化表达方式|已同步自然表达规则)/i.test(text),
    guidance: "Repair the current sentence shape now instead of promising a generic future change."
  }
];

export function checkHumanCommunicationStyle({ text, context = "technical" }) {
  const normalized = String(text ?? "").trim();
  if (!normalized) throw new Error("--text or --file is required");

  const findings = [];
  for (const rule of rules) {
    if (rule.contexts && !rule.contexts.has(context)) continue;
    if (rule.test(normalized)) findings.push({ id: rule.id, severity: rule.severity, guidance: rule.guidance });
  }

  const contrastCount = countMatches(normalized, /不是[^。！？\n]{1,80}(?:而是|只是)/g);
  if (contrastCount > 1) {
    findings.push({
      id: "formulaic_reframe",
      severity: "style",
      guidance: "Keep at most one necessary contrast; rewrite the rest as direct statements."
    });
  }

  const signpostCount = countMatches(normalized, /(首先|其次|再次|最后|第一|第二|第三)[，,:：]?/g);
  if (SOFT_CONTEXTS.has(context) && signpostCount > 2) {
    findings.push({
      id: "over_structured_human_moment",
      severity: "style",
      guidance: "Use plain conversational flow; save ordered report structure for technical status."
    });
  }

  if (/(！！+|？？+|!!+|\?\?+)/.test(normalized)) {
    findings.push({
      id: "duplicated_punctuation",
      severity: "style",
      guidance: "Use restrained punctuation."
    });
  }

  return {
    format: "transparent_ai_apprentice_human_communication_style_check_v1",
    context,
    passed: findings.length === 0,
    findingCount: findings.length,
    findings,
    advisoryOnly: true,
    locks: {
      rewroteUserText: false,
      sentResponse: false,
      pretendsToBeHuman: false,
      encouragesDependency: false
    }
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = args.file ? readFileSync(resolve(args.file), "utf8") : args.text;
  const result = checkHumanCommunicationStyle({ text, context: args.context ?? "technical" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
