"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic, RefreshCw, Save, Square, Volume2 } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { buildVoiceTeachingTranscriptDraft } from "@/lib/human-knowledge-teaching";
import { Badge, Surface } from "./ui";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function appliesTone(appliesTo: string): "neutral" | "teal" | "amber" | "blue" {
  if (appliesTo === "all_future_commands") {
    return "teal";
  }

  if (appliesTo === "conflicting_new_knowledge") {
    return "amber";
  }

  return "blue";
}

export function HumanTeachingMemoryProtocolPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const protocol = report.humanTeachingMemoryProtocol;
  const [title, setTitle] = useState("三维导轨先确认坐标系");
  const [condition, setCondition] = useState("当老师用三维坐标描述导轨、线条或工程路径时");
  const [action, setAction] = useState("先确认原点、单位、轴向和容差，再生成多个候选拟合供老师选择");
  const [teacherNote, setTeacherNote] = useState("这条规则来自人类老师带教，未来遇到相似任务时必须先解释匹配理由，再请求确认。");
  const [priority, setPriority] = useState<"normal" | "high">("high");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState(protocol.voiceTranscriptDraft.transcript);
  const [voiceMessage, setVoiceMessage] = useState("语音只是输入体验；转写内容必须先变成结构化规则草稿，再由老师确认。");
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [voiceCompatibilitySaveState, setVoiceCompatibilitySaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [voiceCompatibilitySaveMessage, setVoiceCompatibilitySaveMessage] = useState(
    "跨浏览器实测结果只会保存为审查草稿，不启用 voice-only memory。"
  );
  const voiceDraft = useMemo(() => buildVoiceTeachingTranscriptDraft(voiceTranscript), [voiceTranscript]);
  const selectedBrowserVoice = useMemo(
    () => browserVoices.find((voice) => voice.voiceURI === selectedVoiceURI) ?? null,
    [browserVoices, selectedVoiceURI]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setBrowserVoices(voices);
      setSelectedVoiceURI((current) => {
        if (current && voices.some((voice) => voice.voiceURI === current)) {
          return current;
        }

        return (
          voices.find((voice) => voice.lang.toLowerCase().startsWith("zh-cn"))?.voiceURI ??
          voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"))?.voiceURI ??
          voices[0]?.voiceURI ??
          ""
        );
      });
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  async function saveHumanKnowledge() {
    if (!title.trim() || !condition.trim() || !action.trim() || !teacherNote.trim()) {
      setSaveState("error");
      setSaveMessage("请把标题、适用条件、执行规则和老师备注都写完整。");
      return;
    }

    setSaveState("saving");
    setSaveMessage("正在保存人类知识带教记录...");

    try {
      const response = await fetch("/api/human-knowledge-teaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          title,
          condition,
          action,
          teacherNote,
          priority
        })
      });
      const result = (await response.json()) as {
        error?: string;
        rule?: { title?: string };
        conflictReport?: { status?: string; teacherQuestion?: string };
        ruleEnabled?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存失败。");
      }

      setSaveState("saved");
      setSaveMessage(
        result.ruleEnabled === false && result.accepted === false && result.packagingGated === true
          ? `已保存为待确认人类知识记忆：${result.rule?.title ?? title}。冲突状态：${result.conflictReport?.status ?? "unknown"}。规则仍暂停，封装仍锁定。`
          : "已保存，但请复核规则启用和封装锁状态。"
      );
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "保存失败。");
    }
  }

  function applyVoiceDraft() {
    setTitle(voiceDraft.suggestedInput.title);
    setCondition(voiceDraft.suggestedInput.condition);
    setAction(voiceDraft.suggestedInput.action);
    setTeacherNote(voiceDraft.suggestedInput.teacherNote);
    setPriority(voiceDraft.suggestedInput.priority);
    setVoiceMessage("已把语音转写预演成结构化规则草稿。请老师检查后再保存为待确认记忆。");
  }

  function speakVoiceQuestion() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceMessage("当前浏览器没有可用的语音播报接口，请直接查看文字问题。");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voiceDraft.teacherQuestion);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    setVoiceMessage("已播报请教问题；长期记忆仍然只会从老师确认后的结构化规则保存。");
  }

  function speakVoiceRestatement() {
    const restatement = voiceDraft.aiRestatement;
    if (!restatement) {
      setVoiceMessage("还没有可朗读的 AI 复述，请先输入或听写一段老师语音。");
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceMessage("当前浏览器没有可用的语音朗读接口，请直接查看 AI 复述文字。");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(restatement.ttsPreview.utteranceText);
    utterance.lang = restatement.ttsPreview.language;
    utterance.rate = restatement.ttsPreview.rate;
    utterance.pitch = restatement.ttsPreview.pitch;
    if (selectedBrowserVoice) {
      utterance.voice = selectedBrowserVoice;
    }
    window.speechSynthesis.speak(utterance);
    setVoiceMessage(
      selectedBrowserVoice
        ? `已用所选浏览器 voice「${selectedBrowserVoice.name}」朗读 AI 复述；这只是本地 TTS 预演，不保存验收、不启用规则、不解锁封装。`
        : "已朗读 AI 复述文案；这只是浏览器本地 TTS 预演，不保存验收、不启用规则、不解锁封装。"
    );
  }

  function stopVoicePlayback() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setVoiceMessage("已停止本地语音朗读；语音体验仍然只作为老师审查辅助。");
  }

  function inferCurrentBrowser(): "Chrome" | "Edge" | "Safari" | "Firefox" {
    if (typeof navigator === "undefined") return "Chrome";
    const agent = navigator.userAgent;

    if (agent.includes("Firefox")) return "Firefox";
    if (agent.includes("Edg/")) return "Edge";
    if (agent.includes("Safari") && !agent.includes("Chrome") && !agent.includes("Chromium")) return "Safari";

    return "Chrome";
  }

  async function saveVoiceCompatibilityReview() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as SpeechRecognitionWindow).SpeechRecognition ??
          (window as SpeechRecognitionWindow).webkitSpeechRecognition
        : undefined;
    const selectedCase =
      voiceDraft.aiRestatement?.browserCompatibilityAudit.cases.find((item) => item.browser === inferCurrentBrowser()) ??
      voiceDraft.aiRestatement?.browserCompatibilityAudit.cases[0];
    const chineseVoiceCount = browserVoices.filter((voice) => voice.lang.toLowerCase().startsWith("zh")).length;

    if (!selectedCase) {
      setVoiceCompatibilitySaveState("error");
      setVoiceCompatibilitySaveMessage("尚未生成跨浏览器兼容性审查草稿。");
      return;
    }

    setVoiceCompatibilitySaveState("saving");
    setVoiceCompatibilitySaveMessage("正在保存真实浏览器语音兼容性审查草稿...");

    try {
      const response = await fetch("/api/voice-browser-compatibility-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: report.apprenticeId,
          taskId: report.taskId,
          browser: selectedCase.browser,
          platformScope: selectedCase.platformScope,
          speechRecognitionAvailable: Boolean(SpeechRecognition),
          speechSynthesisAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
          voiceCount: browserVoices.length,
          chineseVoiceCount,
          selectedVoiceName: selectedBrowserVoice?.name ?? "",
          transcriptFallbackTested: voiceTranscript.trim().length > 0,
          teacherNote: `老师记录 ${selectedCase.browser} 实测：voice=${browserVoices.length}，中文 voice=${chineseVoiceCount}，fallback=${voiceTranscript.trim().length > 0 ? "已用转写草稿" : "待手动粘贴"}。`
        })
      });
      const result = (await response.json()) as {
        error?: string;
        ruleEnabled?: boolean;
        voiceOnlyMemoryEnabled?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "保存语音兼容性审查失败。");
      }

      setVoiceCompatibilitySaveState("saved");
      setVoiceCompatibilitySaveMessage(
        result.ruleEnabled === false &&
          result.voiceOnlyMemoryEnabled === false &&
          result.accepted === false &&
          result.packagingGated === true
          ? "已保存为语音兼容性审查草稿；voice-only memory 未启用，accepted=false，packagingGated=true。"
          : "已保存，但请复核 voice-only memory 和封装锁状态。"
      );
    } catch (error) {
      setVoiceCompatibilitySaveState("error");
      setVoiceCompatibilitySaveMessage(error instanceof Error ? error.message : "保存语音兼容性审查失败。");
    }
  }

  function startVoiceTeaching() {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognition =
      (window as SpeechRecognitionWindow).SpeechRecognition ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceMessage("当前浏览器不支持语音识别。你可以手动粘贴转写文本，流程仍然一样。");
      return;
    }

    const nextRecognition = new SpeechRecognition();
    nextRecognition.lang = "zh-CN";
    nextRecognition.continuous = true;
    nextRecognition.interimResults = true;
    nextRecognition.onresult = (event) => {
      const finalParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalParts.push(result[0].transcript.trim());
        }
      }

      if (finalParts.length > 0) {
        setVoiceTranscript((current) => [current.trim(), finalParts.join("，")].filter(Boolean).join("\n"));
      }
    };
    nextRecognition.onerror = (event) => {
      setVoiceMessage(`语音识别暂时不可用：${event.error ?? "未知错误"}。你仍然可以手动输入转写。`);
    };
    nextRecognition.onend = () => {
      setIsListening(false);
      setRecognition(null);
    };
    setRecognition(nextRecognition);
    setIsListening(true);
    setVoiceMessage("正在听写老师语音。你可以说规则、条件、纠正点，结束后再转成结构化草稿。");
    nextRecognition.start();
  }

  function stopVoiceTeaching() {
    recognition?.stop();
    setIsListening(false);
    setVoiceMessage("已停止听写。请检查转写，再转成结构化规则草稿。");
  }

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={protocol.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.humanTeachingMemoryRulesReady}/{report.summary.humanTeachingMemoryRules} 条记忆规则
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">人类带教记忆协议</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            人类教过的东西必须变成长期规则。以后执行命令前，AI 要先检查这些知识；如果新知识和旧知识冲突，
            要先认真比较，再把不确定点拿出来请教人类。语音互动是可选体验，真正的记忆仍然落在结构化规则里。
          </p>
        </div>
        <RefreshCw className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">未来规则</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.humanTeachingMemoryRules}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">冲突步骤</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.teachingConflictStepsReady}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">语音模式</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.voiceTeachingModes}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已验收</p>
          <p className="mt-1 text-xl font-black text-ink">{protocol.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁定</p>
          <p className="mt-1 text-xl font-black text-ink">{protocol.packagingGated ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={protocol.futureCommandReplay.hits.length > 0 ? "teal" : "amber"}>未来命令记忆回放</Badge>
          <Badge tone="blue">先查旧知识</Badge>
          <Badge tone="neutral">不自动执行</Badge>
        </div>
        <p className="mt-3 text-sm font-extrabold text-ink">老师刚发来的未来命令</p>
        <p className="mt-2 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
          {protocol.futureCommandReplay.input.command}
        </p>
        {protocol.futureCommandReplay.input.context ? (
          <p className="mt-2 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
            上下文：{protocol.futureCommandReplay.input.context}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {protocol.futureCommandReplay.hits.map((hit) => (
            <article key={hit.ruleId} className="rounded-md border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={hit.ruleEnabled ? "teal" : "amber"}>
                  {hit.ruleEnabled ? "可用规则" : "待确认记忆"}
                </Badge>
                <Badge tone="neutral">匹配 {Math.round(hit.matchScore * 100)}%</Badge>
              </div>
              <p className="mt-3 font-extrabold text-ink">{hit.ruleTitle}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{hit.recallReason}</p>
              <div className="mt-3 rounded-md bg-mist p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-ink">AI 准备怎么遵守旧知识</p>
                <p className="mt-1">{hit.proposedBehavior}</p>
              </div>
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                <p className="font-bold">冲突/边界检查</p>
                {hit.conflictNotes.map((note) => (
                  <p key={note} className="mt-1">
                    {note}
                  </p>
                ))}
              </div>
              <p className="mt-3 rounded-md bg-indigo-50 p-3 text-xs font-bold leading-5 text-indigo-950">
                {hit.teacherQuestion}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
          {protocol.futureCommandReplay.nextStepPrediction}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {protocol.futureCommandReplay.blockedActions.map((action) => (
            <Badge key={action} tone="neutral">
              禁止：{action}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-teal-100 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">人类知识输入</Badge>
          <Badge tone="blue">保存为暂停记忆</Badge>
          <Badge tone="neutral">不确认技术合格</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-teal-950">
          老师可以把新要求直接写成结构化知识。系统会先和旧记忆比较，生成公开学习 trace，
          再保存为 disabled 的长期规则；未来命中前仍要先请老师确认。
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink">
            知识标题
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-md border border-line bg-white p-2 text-sm font-normal text-ink outline-none focus:border-apprentice-teal"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            优先级
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value === "high" ? "high" : "normal")}
              className="rounded-md border border-line bg-white p-2 text-sm font-normal text-ink outline-none focus:border-apprentice-teal"
            >
              <option value="high">高：人类明确要求</option>
              <option value="normal">普通：候选知识</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            适用条件
            <textarea
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              className="min-h-24 rounded-md border border-line bg-white p-2 text-sm font-normal leading-6 text-ink outline-none focus:border-apprentice-teal"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            执行规则
            <textarea
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="min-h-24 rounded-md border border-line bg-white p-2 text-sm font-normal leading-6 text-ink outline-none focus:border-apprentice-teal"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink lg:col-span-2">
            老师备注
            <textarea
              value={teacherNote}
              onChange={(event) => setTeacherNote(event.target.value)}
              className="min-h-24 rounded-md border border-line bg-white p-2 text-sm font-normal leading-6 text-ink outline-none focus:border-apprentice-teal"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveHumanKnowledge()}
            disabled={saveState === "saving"}
            className="inline-flex items-center gap-2 rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-4" />
            保存为待确认知识
          </button>
          <p
            className={`text-xs leading-5 ${
              saveState === "error" ? "text-rose-700" : saveState === "saved" ? "text-teal-800" : "text-slate-600"
            }`}
          >
            {saveMessage || "保存后只进入审查记忆，不启用规则，不解锁封装。"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {protocol.rules.map((rule) => (
          <article key={rule.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={rule.passed ? "teal" : "amber"}>{rule.passed ? "已记住" : "需要证据"}</Badge>
              <Badge tone={appliesTone(rule.appliesTo)}>{rule.appliesTo.replaceAll("_", " ")}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{rule.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{rule.requirement}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{rule.evidence}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-3">
          {protocol.conflictSteps.map((step) => (
            <article key={step.id} className="rounded-md border border-line bg-mist p-4">
              <Badge tone={step.passed ? "teal" : "amber"}>{step.passed ? "冲突处理就绪" : "需要证据"}</Badge>
              <p className="mt-3 font-extrabold text-ink">{step.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{step.action}</p>
              <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-ink">向人类请教的问题</p>
                <p className="mt-1">{step.teacherQuestion}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-md border border-line bg-mist p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Mic className="size-4 text-apprentice-blue" />
            <Badge tone="blue">{protocol.voiceExperience.mode.replaceAll("_", " ")}</Badge>
            <Badge tone={protocol.voiceExperience.passed ? "teal" : "amber"}>
              {protocol.voiceExperience.passed ? "体验就绪" : "需要证据"}
            </Badge>
            <Badge tone={voiceDraft.packagingGated ? "neutral" : "amber"}>
              {voiceDraft.packagingGated ? "封装锁定" : "封装打开"}
            </Badge>
          </div>
          <p className="mt-3 font-extrabold text-ink">{protocol.voiceExperience.label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{protocol.voiceExperience.goal}</p>
          <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
            <p className="font-bold text-ink">给人类老师的体验价值</p>
            <p className="mt-1">{protocol.voiceExperience.teacherBenefit}</p>
          </div>
          <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-ink">中文语音带教预演</p>
                <p className="mt-1 text-xs leading-5 text-blue-900">
                  支持浏览器语音识别时可直接听写；不支持时也可以手动粘贴转写。保存前必须先转成结构化规则草稿。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={isListening ? stopVoiceTeaching : startVoiceTeaching}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold text-white transition ${
                    isListening ? "bg-rose-600 hover:bg-rose-700" : "bg-apprentice-blue hover:bg-blue-700"
                  }`}
                >
                  {isListening ? "停止听写" : "开始语音带教"}
                </button>
                <button
                  type="button"
                  onClick={speakVoiceQuestion}
                  className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-apprentice-blue transition hover:bg-blue-50"
                >
                  播报请教问题
                </button>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase text-blue-900">语音转写/手动输入</span>
              <textarea
                value={voiceTranscript}
                onChange={(event) => setVoiceTranscript(event.target.value)}
                className="mt-1 min-h-28 w-full resize-y rounded-md border border-blue-100 bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-apprentice-blue"
              />
            </label>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-blue-950 md:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">AI 结构化理解</p>
                <p className="mt-1">{voiceDraft.suggestedInput.title}</p>
                <p className="mt-1">{voiceDraft.suggestedInput.condition}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">保存边界</p>
                <p className="mt-1">ruleEnabled={voiceDraft.ruleEnabled ? "true" : "false"}</p>
                <p>accepted={voiceDraft.accepted ? "true" : "false"}</p>
                <p>packagingGated={voiceDraft.packagingGated ? "true" : "false"}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {voiceDraft.learningTrace.map((step) => (
                <article key={step.id} className="rounded-md bg-white p-2 text-xs leading-5 text-blue-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={step.needsHumanReview ? "amber" : "teal"}>等老师确认</Badge>
                    <p className="font-bold text-ink">{step.label}</p>
                  </div>
                  <p className="mt-1">{step.validation}</p>
                </article>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={applyVoiceDraft}
                disabled={!voiceTranscript.trim()}
                className="rounded-md bg-apprentice-blue px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                把语音转成结构化规则草稿
              </button>
              <p className="text-xs leading-5 text-blue-900">{voiceMessage}</p>
            </div>
            <p className="mt-3 rounded-md bg-white p-2 text-xs font-bold leading-5 text-blue-900">
              {voiceDraft.teacherQuestion}
            </p>
            {voiceDraft.aiRestatement ? (
              <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50/60 p-3">
                <div className="flex items-center gap-2">
                  <Mic className="size-4 text-indigo-600" />
                  <p className="text-xs font-bold uppercase text-indigo-800">AI 向老师复述请教</p>
                  <Badge tone="neutral">教学辅助体验</Badge>
                </div>
                <div className="mt-2 rounded-md border border-indigo-100 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-lg">💬</span>
                    <p className="text-sm leading-6 text-slate-800">
                      {voiceDraft.aiRestatement.spokenText}
                    </p>
                  </div>
                </div>
                <div className="mt-2 rounded-md border border-indigo-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">TTS 语音朗读预演</Badge>
                    <Badge tone="neutral">{voiceDraft.aiRestatement.ttsPreview.mode}</Badge>
                    <Badge tone={voiceDraft.aiRestatement.ttsPreview.packagingGated ? "neutral" : "amber"}>
                      {voiceDraft.aiRestatement.ttsPreview.packagingGated ? "封装锁定" : "封装打开"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-indigo-900">
                    {voiceDraft.aiRestatement.ttsPreview.teacherQuestion}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={speakVoiceRestatement}
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
                    >
                      <Volume2 className="size-4" />
                      朗读 AI 复述文案
                    </button>
                    <button
                      type="button"
                      onClick={stopVoicePlayback}
                      className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      <Square className="size-3.5" />
                      停止朗读
                    </button>
                    <span className="text-xs leading-5 text-slate-500">
                      lang={voiceDraft.aiRestatement.ttsPreview.language}; rate={voiceDraft.aiRestatement.ttsPreview.rate};
                      pitch={voiceDraft.aiRestatement.ttsPreview.pitch}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">
                      reviewOnly={voiceDraft.aiRestatement.ttsPreview.reviewOnly ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      accepted={voiceDraft.aiRestatement.ttsPreview.accepted ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      packagingGated={voiceDraft.aiRestatement.ttsPreview.packagingGated ? "true" : "false"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 rounded-md border border-sky-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">真实语音引擎声音选择</Badge>
                    <Badge tone="neutral">{voiceDraft.aiRestatement.voiceEngineSelection.mode}</Badge>
                    <Badge tone="neutral">
                      runtime={voiceDraft.aiRestatement.voiceEngineSelection.runtimeVoiceListSource}
                    </Badge>
                    <Badge tone={voiceDraft.aiRestatement.voiceEngineSelection.packagingGated ? "neutral" : "amber"}>
                      {voiceDraft.aiRestatement.voiceEngineSelection.packagingGated ? "封装锁定" : "封装打开"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-sky-950">
                    {voiceDraft.aiRestatement.voiceEngineSelection.teacherQuestion}
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                    <label className="grid gap-2 text-xs font-bold uppercase text-slate-500">
                      本机浏览器 voices
                      <select
                        value={selectedVoiceURI}
                        onChange={(event) => setSelectedVoiceURI(event.target.value)}
                        className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-normal normal-case text-ink outline-none focus:border-apprentice-blue"
                      >
                        {browserVoices.length > 0 ? (
                          browserVoices.map((voice) => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} · {voice.lang}
                            </option>
                          ))
                        ) : (
                          <option value="">当前浏览器尚未返回 voice 列表</option>
                        )}
                      </select>
                      <span className="text-[11px] font-normal normal-case leading-5 text-slate-500">
                        已加载 {browserVoices.length} 个 voice
                        {selectedBrowserVoice ? `；当前选择：${selectedBrowserVoice.name} / ${selectedBrowserVoice.lang}` : "；未选择"}
                      </span>
                    </label>
                    <div className="rounded-md bg-sky-50 p-3 text-xs leading-5 text-sky-950">
                      <p className="font-bold text-ink">真实 voice 降级策略</p>
                      <p className="mt-1">
                        requiresRuntimeVoiceList=
                        {voiceDraft.aiRestatement.voiceEngineSelection.requiresRuntimeVoiceList ? "true" : "false"}；
                        如果没有中文 voice，页面仍可用默认 voice 播放，但只能作为临时审查降级。
                      </p>
                      <p className="mt-1">
                        允许动作：{voiceDraft.aiRestatement.voiceEngineSelection.allowedActions.join(" / ")}
                      </p>
                      <p className="mt-1">
                        禁止动作：{voiceDraft.aiRestatement.voiceEngineSelection.blockedActions.join(" / ")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {voiceDraft.aiRestatement.voiceEngineSelection.candidates.map((candidate) => (
                      <article key={candidate.id} className="rounded-md bg-sky-50 p-3 text-xs leading-5 text-sky-950">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">{candidate.label}</p>
                          <Badge tone={candidate.id === voiceDraft.aiRestatement?.voiceEngineSelection.preferredVoiceId ? "teal" : "neutral"}>
                            {candidate.id === voiceDraft.aiRestatement?.voiceEngineSelection.preferredVoiceId ? "推荐" : "候选"}
                          </Badge>
                          <Badge tone="blue">overall={candidate.teacherScoreReplay.overall}/5</Badge>
                        </div>
                        <p className="mt-2 text-slate-700">{candidate.selectionReason}</p>
                        <div className="mt-2 grid gap-1 sm:grid-cols-4">
                          <p>清晰度 {candidate.teacherScoreReplay.clarity}/5</p>
                          <p>温和感 {candidate.teacherScoreReplay.warmth}/5</p>
                          <p>学生感 {candidate.teacherScoreReplay.studentTone}/5</p>
                          <p>自然度 {candidate.teacherScoreReplay.naturalness}/5</p>
                        </div>
                        <p className="mt-2 font-bold text-sky-900">{candidate.teacherScoreReplay.teacherNote}</p>
                        <p className="mt-1 text-slate-600">runtime hint：{candidate.runtimeVoiceHint}</p>
                        <p className="mt-1 text-slate-600">fallback：{candidate.fallbackIfMissing}</p>
                      </article>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">
                      reviewOnly={voiceDraft.aiRestatement.voiceEngineSelection.reviewOnly ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      accepted={voiceDraft.aiRestatement.voiceEngineSelection.accepted ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      packagingGated={voiceDraft.aiRestatement.voiceEngineSelection.packagingGated ? "true" : "false"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 rounded-md border border-cyan-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">跨浏览器兼容性审查</Badge>
                    <Badge tone="neutral">{voiceDraft.aiRestatement.browserCompatibilityAudit.mode}</Badge>
                    <Badge tone={voiceDraft.aiRestatement.browserCompatibilityAudit.packagingGated ? "neutral" : "amber"}>
                      {voiceDraft.aiRestatement.browserCompatibilityAudit.packagingGated ? "封装锁定" : "封装打开"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-cyan-950">
                    {voiceDraft.aiRestatement.browserCompatibilityAudit.teacherQuestion}
                  </p>
                  <div className="mt-3 grid gap-2 lg:grid-cols-4">
                    {voiceDraft.aiRestatement.browserCompatibilityAudit.cases.map((item) => (
                      <article key={item.id} className="rounded-md bg-cyan-50 p-3 text-xs leading-5 text-cyan-950">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">{item.browser}</p>
                          <Badge tone={item.speechRecognitionSupport === "native_or_prefixed" ? "teal" : "amber"}>
                            {item.speechRecognitionSupport}
                          </Badge>
                        </div>
                        <p className="mt-2 text-slate-700">{item.platformScope}</p>
                        <p className="mt-1">朗读：{item.speechSynthesisSupport}</p>
                        <p className="mt-1">voice list：{item.voiceListReliability}</p>
                        <p className="mt-1">中文 voice 风险：{item.chineseVoiceRisk}</p>
                        <p className="mt-2 font-bold text-cyan-900">{item.requiredFallback}</p>
                        <p className="mt-2 rounded-md bg-white p-2 font-bold text-cyan-950">{item.teacherQuestion}</p>
                      </article>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md bg-cyan-50 p-3 text-xs leading-5 text-cyan-950">
                    <p className="font-bold text-ink">runtime APIs</p>
                    <p className="mt-1 font-mono">{voiceDraft.aiRestatement.browserCompatibilityAudit.runtimeApis.join(" / ")}</p>
                    <p className="mt-2">
                      可朗读浏览器 {voiceDraft.aiRestatement.browserCompatibilityAudit.synthesisReadyBrowsers}；
                      听写风险浏览器 {voiceDraft.aiRestatement.browserCompatibilityAudit.recognitionRiskBrowsers}；
                      需要 fallback {voiceDraft.aiRestatement.browserCompatibilityAudit.fallbackRequiredBrowsers}
                    </p>
                    <p className="mt-2">允许动作：{voiceDraft.aiRestatement.browserCompatibilityAudit.allowedActions.join(" / ")}</p>
                    <p className="mt-1">禁止动作：{voiceDraft.aiRestatement.browserCompatibilityAudit.blockedActions.join(" / ")}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void saveVoiceCompatibilityReview()}
                      disabled={voiceCompatibilitySaveState === "saving"}
                      className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Save className="size-4" />
                      保存本浏览器实测审查
                    </button>
                    <span className="text-xs leading-5 text-cyan-950">{voiceCompatibilitySaveMessage}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">
                      reviewOnly={voiceDraft.aiRestatement.browserCompatibilityAudit.reviewOnly ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      accepted={voiceDraft.aiRestatement.browserCompatibilityAudit.accepted ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      packagingGated={voiceDraft.aiRestatement.browserCompatibilityAudit.packagingGated ? "true" : "false"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 rounded-md border border-violet-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">老师历史评分与版本对比</Badge>
                    <Badge tone="neutral">{voiceDraft.aiRestatement.teacherReviewHistory.mode}</Badge>
                    <Badge tone={voiceDraft.aiRestatement.teacherReviewHistory.packagingGated ? "neutral" : "amber"}>
                      {voiceDraft.aiRestatement.teacherReviewHistory.packagingGated ? "封装锁定" : "封装打开"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-violet-950">
                    {voiceDraft.aiRestatement.teacherReviewHistory.comparisonSummary}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {voiceDraft.aiRestatement.teacherReviewHistory.versions.map((version) => (
                      <article key={version.id} className="rounded-md bg-violet-50 p-3 text-xs leading-5 text-violet-950">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink">
                            {version.version} · {version.label}
                          </p>
                          <Badge tone={version.reviewState === "current_waiting_teacher_review" ? "amber" : "neutral"}>
                            {version.reviewState === "current_waiting_teacher_review" ? "当前待审查" : "历史评分"}
                          </Badge>
                          <Badge tone="blue">overall={version.teacherScores.overall}/5</Badge>
                        </div>
                        <p className="mt-2 text-slate-700">{version.utteranceText}</p>
                        <div className="mt-2 grid gap-1 sm:grid-cols-3">
                          <p>尊重老师 {version.teacherScores.respectsTeacher}/5</p>
                          <p>学生请教感 {version.teacherScores.soundsLikeStudent}/5</p>
                          <p>自然度 {version.teacherScores.naturalness}/5</p>
                        </div>
                        <p className="mt-2 font-bold text-violet-900">{version.teacherNote}</p>
                        <p className="mt-1 text-slate-600">改进：{version.improvedDimensions.join("、")}</p>
                        <p className="mt-1 text-slate-600">仍需审查：{version.remainingConcerns.join("、")}</p>
                      </article>
                    ))}
                  </div>
                  <p className="mt-2 rounded-md bg-violet-50 p-2 text-xs font-bold leading-5 text-violet-950">
                    {voiceDraft.aiRestatement.teacherReviewHistory.teacherQuestion}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">
                      reviewOnly={voiceDraft.aiRestatement.teacherReviewHistory.reviewOnly ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      accepted={voiceDraft.aiRestatement.teacherReviewHistory.accepted ? "true" : "false"}
                    </Badge>
                    <Badge tone="neutral">
                      packagingGated={voiceDraft.aiRestatement.teacherReviewHistory.packagingGated ? "true" : "false"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-indigo-50 p-2 text-xs leading-5 text-indigo-900">
                  <p className="font-bold">结构化理解</p>
                  <p className="mt-1">{voiceDraft.aiRestatement.structuredInterpretation}</p>
                </div>
                <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs font-bold uppercase text-amber-800">语气自然度审查</p>
                  <div className="mt-2 grid gap-1 text-xs">
                    {[
                      { label: "尊重老师", value: voiceDraft.aiRestatement.toneCheck.respectsTeacher },
                      { label: "语气像学生请教", value: voiceDraft.aiRestatement.toneCheck.soundsLikeStudent },
                      { label: "不机械", value: voiceDraft.aiRestatement.toneCheck.notRobotic }
                    ].map((check) => (
                      <div key={check.label} className="flex items-center gap-2">
                        <span className={check.value ? "text-teal-600" : "text-rose-600"}>
                          {check.value ? "✓" : "✗"}
                        </span>
                        <span className="text-slate-700">{check.label}</span>
                        <Badge tone={check.value ? "teal" : "amber"}>{check.value ? "通过" : "待改进"}</Badge>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-amber-900">
                    {voiceDraft.aiRestatement.teacherToneReview.question}
                  </p>
                  <Badge tone="amber">审查状态：等待老师审查</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="neutral">reviewOnly={voiceDraft.aiRestatement.reviewOnly ? "true" : "false"}</Badge>
                  <Badge tone="neutral">accepted={voiceDraft.aiRestatement.accepted ? "true" : "false"}</Badge>
                  <Badge tone="neutral">packagingGated={voiceDraft.aiRestatement.packagingGated ? "true" : "false"}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  语音复述只是教学辅助体验，不自动启用规则。所有约束保持 reviewOnly=true、accepted=false、packagingGated=true。
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Surface>
  );
}
