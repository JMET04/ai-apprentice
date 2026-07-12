#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "voice-teaching-kit";
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const goal = argValue("--goal", argValue("--task", "Teach the apprentice by voice."));
const preferredTone = argValue("--preferred-tone");
const teacherName = argValue("--teacher-name");
const locale = argValue("--locale", "zh-CN");
const voiceMode = argValue("--voice-mode", "browser-web-speech");
const futureInput = argValue("--future-input");
const outputRoot = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "voice-kits"));

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const readmePath = join(kitDir, "VOICE_TEACHING_START_HERE.md");
const htmlPath = join(kitDir, "voice-teaching.html");
const preferencesPath = join(kitDir, "voice-preferences.json");
const manifestPath = join(kitDir, "voice-teaching-manifest.json");

const toneOptions = [
  {
    id: "patient_step_by_step",
    label: "Patient step-by-step",
    teacherPrompt: "Explain calmly, confirm each step, and ask before moving on."
  },
  {
    id: "concise_direct",
    label: "Concise and direct",
    teacherPrompt: "Keep replies short, confirm only important decisions, and move quickly."
  },
  {
    id: "warm_encouraging",
    label: "Warm and encouraging",
    teacherPrompt: "Use a friendly tone, acknowledge corrections, and reduce pressure."
  },
  {
    id: "expert_pair_programmer",
    label: "Expert pair programmer",
    teacherPrompt: "Talk like a senior collaborator, surface tradeoffs, and ask precise questions."
  }
];

const preferences = {
  format: "transparent_ai_voice_preference_v1",
  kitId,
  status: preferredTone ? "teacher_selected" : "needs_teacher_choice",
  firstUseRequired: !preferredTone,
  preferredTone: preferredTone || "",
  teacherName,
  locale,
  voiceMode,
  speakBackEnabledDefault: true,
  confirmationStyle: "ask_before_saving_or_generalizing",
  interruptibility: "teacher_can_stop_or_correct_any_time",
  options: toneOptions,
  locks: {
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    technologyAccepted: false
  }
};

const nextMcpCalls = [
  {
    when: "The teacher exports the voice transcript JSON from the browser page.",
    tool: "teach_apprentice",
    arguments: {
      goal,
      message: "<paste the generated transparent_ai_voice_teaching_turn_v1 JSON>",
      tool: "browser Web Speech API voice kit",
      ...(futureInput ? { futureInput } : {})
    }
  },
  {
    when: "The teacher cannot use microphone permissions or Web Speech API is unavailable.",
    tool: "teach_apprentice",
    arguments: {
      goal,
      message: "<paste the manual transcript from the fallback textarea>",
      tool: "manual voice transcript fallback",
      ...(futureInput ? { futureInput } : {})
    }
  },
  {
    when: "The teacher wants the apprentice to change behavior after reviewing a replay.",
    tool: "teach_apprentice",
    arguments: {
      message: "<teacher says correction, approval, or approve and remember>"
    }
  }
];

const manifest = {
  ok: true,
  format: "transparent_ai_voice_teaching_kit_v1",
  kitId,
  goal,
  kitDir,
  technology: {
    primary: "Browser Web Speech API SpeechRecognition or webkitSpeechRecognition",
    speakBack: "Browser speechSynthesis",
    fallback: "Manual transcript textarea",
    customSpeechEngine: false,
    networkRequired: false
  },
  files: {
    teacherReadme: readmePath,
    html: htmlPath,
    preferences: preferencesPath,
    manifest: manifestPath
  },
  firstUsePreference: preferences,
  nextMcpCalls,
  locks: preferences.locks
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transparent AI Apprentice Voice Teaching Kit</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#5f6b76; --line:#cfd8df; --panel:#f7f9fb; --accent:#0f766e; --warn:#9a3412; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif; color: var(--ink); background: #fff; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; display: grid; gap: 18px; }
    header { border-bottom: 1px solid var(--line); padding-bottom: 16px; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; }
    h2 { margin: 0 0 10px; font-size: 17px; }
    p { margin: 0 0 10px; color: var(--muted); line-height: 1.5; }
    section { border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--panel); }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    button, select, input, textarea { font: inherit; }
    button { border: 1px solid #8aa39e; background: #fff; color: var(--ink); border-radius: 6px; padding: 9px 12px; cursor: pointer; }
    button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    label { display: grid; gap: 6px; font-weight: 650; }
    input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: #fff; color: var(--ink); }
    textarea { min-height: 170px; resize: vertical; line-height: 1.45; }
    .tone-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .tone { text-align: left; min-height: 86px; }
    .tone.active { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(15, 118, 110, .18); }
    .status { padding: 10px 12px; border-radius: 6px; background: #fff; border: 1px solid var(--line); color: var(--muted); }
    .warn { color: var(--warn); }
    code { background: #edf2f7; padding: 2px 4px; border-radius: 4px; }
    @media (max-width: 760px) { main { padding: 14px; } .grid, .tone-options { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Voice Teaching Kit</h1>
      <p>Goal: <strong id="goal"></strong></p>
      <p>This page reuses browser/system speech: <code>SpeechRecognition</code>, <code>webkitSpeechRecognition</code>, and <code>speechSynthesis</code>. It also works as a manual transcript pad if speech is unavailable.</p>
    </header>

    <section id="firstUse">
      <h2>First enable: choose how the apprentice should talk back</h2>
      <p>Select the tone before teaching. The choice is stored in this browser only and included in the transcript JSON you paste back to Codex.</p>
      <div id="toneOptions" class="tone-options"></div>
      <div class="grid">
        <label>Teacher name
          <input id="teacherName" autocomplete="name" placeholder="Optional">
        </label>
        <label>Language / locale
          <input id="locale" value="${locale}" placeholder="zh-CN">
        </label>
      </div>
      <div class="row">
        <button id="savePrefs" class="primary">Save preference</button>
        <span id="prefStatus" class="status">Waiting for tone preference</span>
      </div>
    </section>

    <section>
      <h2>Teach by voice</h2>
      <div class="row">
        <button id="speakPrompt">Read prompt aloud</button>
        <button id="start" class="primary">Start dictation</button>
        <button id="stop">Stop</button>
        <button id="markCorrection">Mark latest as correction</button>
        <button id="buildJson">Build JSON for teach_apprentice</button>
      </div>
      <p id="speechStatus" class="status">Speech engine status will appear here.</p>
      <label>Live or manual transcript
        <textarea id="transcript" placeholder="Speak, or type the transcript here if microphone access is blocked."></textarea>
      </label>
      <label>Apprentice question or timely response to the teacher
        <textarea id="assistantPrompt" placeholder="The kit will draft a short confirmation here. Edit it before reading aloud if needed."></textarea>
      </label>
    </section>

    <section>
      <h2>Paste back to Codex</h2>
      <p>Copy this JSON into <code>teach_apprentice.message</code>. It is review-only evidence; it does not approve memory or packaging.</p>
      <textarea id="outputJson" spellcheck="false"></textarea>
    </section>
  </main>

  <script>
    const manifest = ${jsonScript(manifest)};
    const toneOptions = ${jsonScript(toneOptions)};
    const goalText = ${jsonScript(goal)};
    const storageKey = 'transparent_ai_voice_teaching_preferences_v1';
    const goalEl = document.getElementById('goal');
    const toneContainer = document.getElementById('toneOptions');
    const teacherNameEl = document.getElementById('teacherName');
    const localeEl = document.getElementById('locale');
    const prefStatus = document.getElementById('prefStatus');
    const speechStatus = document.getElementById('speechStatus');
    const transcriptEl = document.getElementById('transcript');
    const assistantPromptEl = document.getElementById('assistantPrompt');
    const outputJsonEl = document.getElementById('outputJson');
    let selectedTone = ${jsonScript(preferredTone)};
    let recognition = null;
    let lastSegmentType = 'instruction';
    goalEl.textContent = goalText;

    function loadPrefs() {
      try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
    }

    function savePrefs() {
      const prefs = {
        format: 'transparent_ai_voice_preference_v1',
        status: 'teacher_selected',
        preferredTone: selectedTone || 'patient_step_by_step',
        teacherName: teacherNameEl.value.trim(),
        locale: localeEl.value.trim() || 'zh-CN',
        speakBackEnabled: true,
        confirmationStyle: 'ask_before_saving_or_generalizing'
      };
      localStorage.setItem(storageKey, JSON.stringify(prefs));
      prefStatus.textContent = 'Saved: ' + prefs.preferredTone;
      draftAssistantPrompt();
      return prefs;
    }

    function renderToneOptions() {
      const stored = loadPrefs();
      selectedTone = selectedTone || stored.preferredTone || '';
      teacherNameEl.value = stored.teacherName || ${jsonScript(teacherName)};
      localeEl.value = stored.locale || ${jsonScript(locale)};
      toneContainer.innerHTML = '';
      toneOptions.forEach((tone) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tone' + (tone.id === selectedTone ? ' active' : '');
        button.innerHTML = '<strong>' + tone.label + '</strong><br><span>' + tone.teacherPrompt + '</span>';
        button.addEventListener('click', () => {
          selectedTone = tone.id;
          document.querySelectorAll('.tone').forEach((node) => node.classList.remove('active'));
          button.classList.add('active');
          prefStatus.textContent = 'Selected: ' + tone.label;
        });
        toneContainer.appendChild(button);
      });
      if (stored.preferredTone) prefStatus.textContent = 'Loaded saved preference: ' + stored.preferredTone;
    }

    function draftAssistantPrompt() {
      const prefs = loadPrefs();
      const tone = prefs.preferredTone || selectedTone || 'patient_step_by_step';
      const transcript = transcriptEl.value.trim();
      const opener = tone === 'concise_direct'
        ? 'Got it. I will confirm the rule boundary before saving anything.'
        : tone === 'expert_pair_programmer'
          ? 'I heard the teaching signal. I will separate the reusable rule from counterexamples before replay.'
          : tone === 'warm_encouraging'
            ? 'Thanks, I am following. I will repeat the intended rule gently and wait for your correction.'
            : 'I am listening step by step. I will ask before I generalize this into memory.';
      assistantPromptEl.value = transcript ? opener + '\\n\\nObserved so far: ' + transcript.slice(-360) : opener;
    }

    function createRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        speechStatus.innerHTML = '<span class="warn">SpeechRecognition is unavailable in this browser. Use the manual transcript box.</span>';
        return null;
      }
      const instance = new SpeechRecognition();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = localeEl.value.trim() || 'zh-CN';
      instance.onstart = () => { speechStatus.textContent = 'Listening. You can stop anytime to correct me.'; };
      instance.onerror = (event) => { speechStatus.textContent = 'Speech error: ' + event.error + '. Manual transcript still works.'; };
      instance.onend = () => { speechStatus.textContent = 'Stopped. Review or continue dictation.'; };
      instance.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = event.results[index][0].transcript;
          if (event.results[index].isFinal) finalText += text;
          else interimText += text;
        }
        if (finalText.trim()) transcriptEl.value += (transcriptEl.value ? '\\n' : '') + finalText.trim();
        if (interimText.trim()) speechStatus.textContent = 'Hearing: ' + interimText.trim();
        draftAssistantPrompt();
      };
      return instance;
    }

    function speak(text) {
      if (!('speechSynthesis' in window)) {
        speechStatus.textContent = 'speechSynthesis is unavailable; read the prompt manually.';
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = localeEl.value.trim() || 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }

    function buildJson() {
      const prefs = savePrefs();
      const transcript = transcriptEl.value.trim();
      const assistantPrompt = assistantPromptEl.value.trim();
      const payload = {
        format: 'transparent_ai_voice_teaching_turn_v1',
        sourceTool: 'browser Web Speech API voice kit',
        goal: goalText,
        preferredTone: prefs.preferredTone,
        teacherName: prefs.teacherName,
        locale: prefs.locale,
        transcript,
        assistantPrompt,
        events: [
          { type: 'voice_preference', preferredTone: prefs.preferredTone, teacherName: prefs.teacherName, order: 1 },
          { type: lastSegmentType, text: transcript, order: 2 },
          { type: 'assistant_timely_response', text: assistantPrompt, order: 3 }
        ],
        suggestedTeachApprentice: manifest.nextMcpCalls[0],
        locks: {
          ruleEnabled: false,
          accepted: false,
          packagingGated: true,
          technologyAccepted: false
        }
      };
      outputJsonEl.value = JSON.stringify(payload, null, 2);
      return payload;
    }

    document.getElementById('savePrefs').addEventListener('click', savePrefs);
    document.getElementById('speakPrompt').addEventListener('click', () => {
      draftAssistantPrompt();
      speak(assistantPromptEl.value);
    });
    document.getElementById('start').addEventListener('click', () => {
      savePrefs();
      recognition = recognition || createRecognition();
      if (recognition) recognition.start();
    });
    document.getElementById('stop').addEventListener('click', () => {
      if (recognition) recognition.stop();
    });
    document.getElementById('markCorrection').addEventListener('click', () => {
      lastSegmentType = 'teacher_correction';
      speechStatus.textContent = 'Latest transcript will be marked as a teacher correction.';
      draftAssistantPrompt();
    });
    document.getElementById('buildJson').addEventListener('click', buildJson);
    transcriptEl.addEventListener('input', draftAssistantPrompt);
    renderToneOptions();
    draftAssistantPrompt();
    buildJson();
  </script>
</body>
</html>
`;

const readme = `# Transparent AI Apprentice Voice Teaching Kit

Goal: ${goal}

This kit uses existing browser/system voice technology first:

1. Open \`${htmlPath}\` in a browser that supports Web Speech API, usually Chrome or Edge.
2. On first enable, choose the apprentice response tone: patient, concise, warm, or expert collaborator.
3. Use Start dictation while teaching, or type into the manual transcript box if microphone access is blocked.
4. Use Read prompt aloud when you want the apprentice to respond with speech synthesis.
5. Copy the generated \`transparent_ai_voice_teaching_turn_v1\` JSON back into \`teach_apprentice.message\`.

The kit is review-only evidence. It does not approve memory, enable rules, accept technology, or unlock packaging.
`;

writeFileSync(preferencesPath, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeFileSync(htmlPath, html, "utf8");
writeFileSync(readmePath, readme, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_voice_teaching_kit_result_v1",
      kitId,
      kitPath: manifestPath,
      teacherReadme: readmePath,
      files: manifest.files,
      firstUsePreference: preferences,
      nextMcpCalls,
      locks: manifest.locks
    },
    null,
    2
  )
);
