#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_THREAD_ID = "019ef3df-9927-7363-9036-7e68d06c7809";
const CONTEXTS = new Set([
  "auto",
  "clarification",
  "correction",
  "failure",
  "success",
  "status",
  "technical",
  "emotional",
  "casual"
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function detectSignals(message) {
  const text = message.toLowerCase();
  return {
    frustration: includesAny(text, ["又错", "理解错", "不对", "烦", "崩溃", "失望", "生气", "离谱", "怎么还", "没听懂", "wrong again", "misunderstood", "frustrated"]),
    emotion: includesAny(text, ["难受", "委屈", "焦虑", "害怕", "想哭", "状态很差", "撑不住", "心里堵", "沮丧", "feel awful", "anxious", "scared", "overwhelmed"]),
    urgency: includesAny(text, ["马上", "立刻", "赶紧", "急", "现在就", "今天必须", "asap"]),
    toneRepair: includesAny(text, ["ai味", "像ai", "像 ai", "像客服", "太官方", "太机械", "说人话", "语气", "像说明书", "像报告", "sounds like ai", "sounds like customer service", "too robotic", "talk like a person"])
  };
}

function inferContext(message, signals) {
  const text = message.toLowerCase();
  if (signals.toneRepair || includesAny(text, ["纠正", "改错", "理解错", "不是这个意思", "改多了", "you got it wrong", "that is not what i meant"])) return "correction";
  if (includesAny(text, ["闪退", "报错", "失败", "没成功", "卡住", "打不开", "不能用", "crashed", "error", "failed", "does not work"])) return "failure";
  if (includesAny(text, ["当前进展", "现在进展", "做到哪", "完成到什么程度", "现在状态", "进度", "current status", "progress", "how far along"])) return "status";
  if (signals.emotion || signals.frustration) return "emotional";
  if (includesAny(text, ["成功了", "通过了", "完成了", "做好了", "搞定了", "succeeded", "passed", "completed"])) return "success";
  if (includesAny(text, ["缺什么", "需要什么", "尺寸", "单位", "哪个", "确认一下"])) return "clarification";
  if (includesAny(text, ["代码", "脚本", "接口", "schema", "json", "cad", "image2", "测试"])) return "technical";
  return "casual";
}

const contextPlans = {
  clarification: {
    firstMove: "Restate the confirmed part, then ask only the smallest question that safely unblocks work.",
    directness: "high",
    warmth: "light",
    structure: "plain",
    humor: "avoid",
    questionPolicy: "Ask one compact question or one tightly related data group; explain why it matters.",
    endingPolicy: "End on the requested fact, not on a generic offer to help."
  },
  correction: {
    firstMove: "Acknowledge the exact miss in natural language and state the corrected boundary.",
    directness: "high",
    warmth: "grounded",
    structure: "plain",
    humor: "only_if_user_invites",
    questionPolicy: "Do not ask the user to repeat information already present; ask only if the corrected boundary remains ambiguous.",
    endingPolicy: "Return to the user's actual point and show the immediate correction."
  },
  failure: {
    firstMove: "State the failed step, what remains intact, and the smallest recovery step.",
    directness: "high",
    warmth: "grounded",
    structure: "compact",
    humor: "avoid",
    questionPolicy: "Request only evidence required to diagnose or recover; never ask the user to redo preserved work.",
    endingPolicy: "End with the concrete recovery action or blocker."
  },
  success: {
    firstMove: "Name the real result and celebrate it in proportion to its importance.",
    directness: "high",
    warmth: "grounded",
    structure: "compact",
    humor: "light_if_natural",
    questionPolicy: "Ask a follow-up only when a meaningful choice is now unlocked.",
    endingPolicy: "Name what the success unlocks; avoid empty applause."
  },
  status: {
    firstMove: "Lead with the real current state, then separate proven, partial, blocked, and next work.",
    directness: "high",
    warmth: "light",
    structure: "scan_friendly",
    humor: "avoid",
    questionPolicy: "Ask only for a decision that changes the next work item.",
    endingPolicy: "End with the next concrete test or decision, without overstating readiness."
  },
  technical: {
    firstMove: "Answer the technical question directly before adding context.",
    directness: "high",
    warmth: "light",
    structure: "scan_friendly",
    humor: "only_if_user_invites",
    questionPolicy: "Ask for missing technical facts only when assumptions would change the answer.",
    endingPolicy: "Stop after the useful answer and verification boundary."
  },
  emotional: {
    firstMove: "Respond to the specific lived point first; keep any emotional inference grounded in the user's words.",
    directness: "balanced",
    warmth: "high_but_specific",
    structure: "plain",
    humor: "only_if_user_invites",
    questionPolicy: "Ask one normal, useful question if needed; avoid therapy intake scaffolding and diagnostic menus.",
    endingPolicy: "Leave a natural opening without a generic comfort promise."
  },
  casual: {
    firstMove: "Reply to the literal point with relaxed, specific language.",
    directness: "balanced",
    warmth: "grounded",
    structure: "plain",
    humor: "light_if_natural",
    questionPolicy: "Ask only when curiosity or progress genuinely benefits.",
    endingPolicy: "Let the exchange breathe; do not force a formal conclusion."
  }
};

export function compileHumanCommunicationGuidance({ message, context = "auto", preferredTone = "" }) {
  const normalizedMessage = String(message ?? "").trim();
  if (!normalizedMessage) throw new Error("--message is required");
  if (!CONTEXTS.has(context)) throw new Error(`Unsupported context: ${context}`);

  const signals = detectSignals(normalizedMessage);
  const resolvedContext = context === "auto" ? inferContext(normalizedMessage, signals) : context;
  const plan = contextPlans[resolvedContext];
  const requiredBehaviors = [
    "Answer the user's exact last sentence first.",
    "Use situation-specific language and preserve factual uncertainty.",
    "Keep the user's agency visible and make the next move easy."
  ];
  if (signals.toneRepair) requiredBehaviors.push("Repair the exact sentence shape now; do not merely promise a future style change.");
  if (signals.frustration) requiredBehaviors.push("Own the system's concrete miss before asking the user for more work.");
  if (signals.urgency) requiredBehaviors.push("Reduce preamble and lead with the fastest safe action.");
  if (preferredTone.trim()) requiredBehaviors.push(`Honor this user preference without role-play or false identity: ${preferredTone.trim()}`);

  return {
    format: "transparent_ai_apprentice_human_communication_guidance_v1",
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceThreadId: SOURCE_THREAD_ID,
    context: resolvedContext,
    userSignal: { message: normalizedMessage, ...signals },
    responsePlan: plan,
    requiredBehaviors,
    avoidPatterns: [
      "process narration instead of the actual response",
      "customer-service or changelog language in a human moment",
      "generic reassurance, unearned praise, or automatic agreement",
      "therapy intake scaffolding or diagnostic menus",
      "formulaic reframes, metaphor piles, and over-structured prose",
      "false human biography, exclusivity, dependency, romance, pressure, or manipulation"
    ],
    reviewChecklist: [
      "The first sentence answers the user's latest point.",
      "The tone matches the context without hiding blockers or evidence limits.",
      "Any praise is specific and earned.",
      "No line claims human life, exclusive attachment, or emotional dependency.",
      "The ending contains a useful next move or stops naturally."
    ],
    locks: {
      pretendsToBeHuman: false,
      fabricatesBiography: false,
      encouragesExclusiveAttachment: false,
      encouragesDependency: false,
      usesManipulation: false,
      usesSycophancy: false,
      weakensEvidenceOrSafety: false
    },
    readyForResponse: true
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const packet = compileHumanCommunicationGuidance({
    message: args.message,
    context: args.context ?? "auto",
    preferredTone: args["preferred-tone"] ?? ""
  });

  if (args["out-dir"]) {
    const outDir = resolve(args["out-dir"]);
    mkdirSync(outDir, { recursive: true });
    const outputPath = resolve(outDir, "human-communication-guidance.json");
    packet.outputPath = outputPath;
    writeFileSync(outputPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
