import type {
  ExecutionRunRecord,
  RuleRecord,
  TeachingExampleRecord,
  VisualDemonstrationRecord,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition
} from "./types";

export const demoApprentice = {
  id: "apprentice-photo-journal",
  name: "Lumi",
  description:
    "A teachable AI apprentice learning to turn travel notes into transparent photography journals.",
  domain: "Photography travel writing",
  growth: [
    "Learned to extract place, weather, subject, and lighting fields.",
    "Learned that dusk/sunset language should trigger golden hour advice.",
    "Now asks for human review when the lighting condition is ambiguous."
  ]
};

export const demoTask = {
  id: "task-photo-travel-journal",
  apprenticeId: demoApprentice.id,
  name: "Generate a structured photography travel journal from a travel note",
  goal:
    "Teach the apprentice to transform a short travel note into a structured photography journal with visible evidence and reusable correction rules.",
  status: "active",
  inputExample:
    "Today I visited Lake Geneva. The weather was clear, I photographed the lake surface, snow mountains, and a portrait subject. The sunset light was soft and suitable for portraits.",
  inputSchema: {
    example:
      "Today I visited Lake Geneva at sunset, with clear weather, lake reflections, snow mountains, and a portrait subject.",
    rawTravelNote: "string"
  },
  expectedOutput: {
    fields: [
      "location",
      "weather",
      "subjects",
      "lightingCondition",
      "recommendedTitles",
      "journalBody",
      "photographyAdvice"
    ],
    notes: "Show every applied rule, confidence score, validation result, and human review point.",
    errorCases: [
      "Wrong lighting: sunset, dusk, or golden hour is labeled as generic natural light.",
      "Missing advice: photographyAdvice does not mention warm side light or backlight when golden-hour cues are present."
    ]
  },
  notes: [
    "Do not hide reasoning. Show structured trace steps, applied rules, confidence, and human review points.",
    "Corrections should become reusable rules before the next run."
  ]
};

export const demoWorkflow = {
  id: "workflow-photo-journal-v1",
  taskId: demoTask.id,
  name: "Photography journal teaching flow",
  version: 1,
  nodes: [
    {
      id: "node-input",
      type: "input",
      label: "Receive travel note",
      description: "User provides the raw travel note and context.",
      inputFields: ["rawTravelNote"],
      outputFields: ["normalizedNote"],
      validationRules: ["Input must include at least one sentence."],
      fallbackBehavior: "Ask the teacher for a clearer note.",
      position: { x: 20, y: 110 }
    },
    {
      id: "node-understand",
      type: "understand",
      label: "Understand intent",
      description: "Summarize task goal and extract candidate fields.",
      inputFields: ["normalizedNote"],
      outputFields: ["fieldCandidates"],
      validationRules: ["Must identify location, weather, subject candidates."],
      fallbackBehavior: "Mark missing fields as uncertain.",
      position: { x: 195, y: 70 }
    },
    {
      id: "node-decision",
      type: "decision",
      label: "Detect lighting clues",
      description: "Check whether the note contains sunset, dusk, or golden-hour language.",
      inputFields: ["normalizedNote", "fieldCandidates"],
      outputFields: ["lightingCondition", "appliedRules"],
      validationRules: ["If dusk-like words are present, apply golden hour rule."],
      fallbackBehavior: "Use natural light and require human confirmation.",
      position: { x: 370, y: 110 }
    },
    {
      id: "node-execute",
      type: "execute",
      label: "Draft journal",
      description: "Generate structured journal fields using the workflow and rules.",
      inputFields: ["fieldCandidates", "lightingCondition"],
      outputFields: ["journalDraft"],
      validationRules: ["Output must contain all required fields."],
      fallbackBehavior: "Create a partial draft and show missing fields.",
      position: { x: 545, y: 70 }
    },
    {
      id: "node-check",
      type: "check",
      label: "Self-check format",
      description: "Validate format and list uncertain fields.",
      inputFields: ["journalDraft"],
      outputFields: ["validationResult", "uncertainty"],
      validationRules: ["All expected fields present.", "Confidence below 0.82 needs review."],
      fallbackBehavior: "Flag the exact field for teacher review.",
      position: { x: 545, y: 250 }
    },
    {
      id: "node-human",
      type: "human_review",
      label: "Teacher review",
      description: "Ask the human teacher to confirm uncertain or corrected behavior.",
      inputFields: ["validationResult", "uncertainty"],
      outputFields: ["teacherDecision"],
      validationRules: ["Corrections should be saved as rules when approved."],
      fallbackBehavior: "Pause before finalizing.",
      position: { x: 370, y: 315 }
    },
    {
      id: "node-output",
      type: "output",
      label: "Publish structured journal",
      description: "Return final structured output with trace references.",
      inputFields: ["journalDraft", "teacherDecision"],
      outputFields: ["finalJournal"],
      validationRules: ["Trace must reference applied rules and confidence."],
      fallbackBehavior: "Return draft with review warning.",
      position: { x: 220, y: 315 }
    }
  ] satisfies WorkflowNodeDefinition[],
  edges: [
    { id: "edge-1", source: "node-input", target: "node-understand" },
    { id: "edge-2", source: "node-understand", target: "node-decision" },
    { id: "edge-3", source: "node-decision", target: "node-execute" },
    { id: "edge-4", source: "node-execute", target: "node-check" },
    { id: "edge-5", source: "node-check", target: "node-human" },
    { id: "edge-6", source: "node-human", target: "node-output" }
  ] satisfies WorkflowEdgeDefinition[]
};

export const demoRules: RuleRecord[] = [
  {
    id: "rule-golden-hour",
    apprenticeId: demoApprentice.id,
    taskId: demoTask.id,
    title: "Dusk words mean golden hour",
    condition:
      "Text contains \u508d\u665a / \u9ec4\u660f / \u5915\u9633 / \u65e5\u843d / sunset / dusk / golden hour.",
    action:
      "Set lighting condition to golden hour and recommend soft side light or backlight composition.",
    source: "correction",
    confidence: 0.92,
    enabled: true,
    createdAt: "2026-06-01T09:00:00.000Z"
  },
  {
    id: "rule-visual-golden-hour-cues",
    apprenticeId: demoApprentice.id,
    taskId: demoTask.id,
    title: "Visual low-sun cues mean golden hour",
    condition:
      "Text or visual note resembles a teacher reference with low sun, warm highlights, rim light, backlight, or long shadows.",
    action:
      "Set lighting condition to golden hour and recommend warm side light, rim light, or backlight composition.",
    source: "correction",
    confidence: 0.86,
    enabled: true,
    createdAt: "2026-06-01T09:03:00.000Z"
  }
];

export const demoTeachingExamples: TeachingExampleRecord[] = [
  {
    id: "example-golden-hour",
    apprenticeId: demoApprentice.id,
    taskId: demoTask.id,
    input: "sunset by Lake Geneva with snowy mountains and a portrait subject",
    expectedOutput: {
      lightingCondition: "golden hour",
      photographyAdvice: "Use warm side light or backlight."
    },
    extractedRule: demoRules[1],
    learningTrace: [
      {
        id: "learn-read-signal",
        label: "Read teacher signal",
        evidence: "sunset by Lake Geneva with snowy mountains and a portrait subject",
        confidence: 0.88,
        validation: "Teacher signal captured from example.",
        needsHumanReview: false
      },
      {
        id: "learn-extract-rule",
        label: "Extract reusable rule",
        evidence: "Visual low-sun cues mean golden hour",
        confidence: 0.86,
        validation: "Reusable condition and action were separated from the source evidence.",
        needsHumanReview: false
      },
      {
        id: "learn-policy-check",
        label: "Apply memory policy",
        evidence: "Rule can run automatically.",
        confidence: 0.9,
        validation: "Memory can be applied to matching future runs.",
        needsHumanReview: false
      }
    ],
    createdAt: "2026-06-01T09:02:00.000Z"
  }
];

export const demoVisualDemonstrations: VisualDemonstrationRecord[] = [
  {
    id: "visual-demo-golden-hour-board",
    apprenticeId: demoApprentice.id,
    taskId: demoTask.id,
    title: "Golden-hour reference board",
    artifact: {
      referenceImageUrl:
        "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20800%20520'%3E%3Cdefs%3E%3ClinearGradient%20id='sky'%20x1='0'%20x2='0'%20y1='0'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%23f7b267'/%3E%3Cstop%20offset='0.55'%20stop-color='%23ffd6a5'/%3E%3Cstop%20offset='1'%20stop-color='%238ecae6'/%3E%3C/linearGradient%3E%3ClinearGradient%20id='lake'%20x1='0'%20x2='1'%3E%3Cstop%20offset='0'%20stop-color='%23457b9d'/%3E%3Cstop%20offset='1'%20stop-color='%23f4a261'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='800'%20height='520'%20fill='url(%23sky)'/%3E%3Ccircle%20cx='650'%20cy='145'%20r='58'%20fill='%23ffd166'/%3E%3Cpath%20d='M0%20272%20L145%20170%20L260%20255%20L365%20142%20L520%20272Z'%20fill='%23edf6f9'/%3E%3Cpath%20d='M0%20278%20L220%20215%20L420%20282%20L800%20222%20L800%20520%20L0%20520Z'%20fill='url(%23lake)'/%3E%3Cpath%20d='M95%20342%20C240%20312%20396%20318%20540%20362'%20fill='none'%20stroke='%23ffe8b6'%20stroke-width='8'%20opacity='0.65'/%3E%3Ccircle%20cx='270'%20cy='294'%20r='34'%20fill='%232b2d42'/%3E%3Cpath%20d='M222%20438%20C230%20355%20315%20355%20326%20438Z'%20fill='%232b2d42'/%3E%3Cpath%20d='M302%20270%20C348%20292%20370%20340%20370%20428'%20fill='none'%20stroke='%23ffd166'%20stroke-width='10'%20opacity='0.9'/%3E%3Ctext%20x='36'%20y='62'%20font-family='Arial'%20font-size='28'%20font-weight='700'%20fill='%232b2d42'%3EGolden-hour%20reference%20frame%3C/text%3E%3C/svg%3E",
      sceneDescription:
        "A lake portrait frame with low warm light, long shadows, bright rim light, and snow mountains in the background.",
      visualCues: ["low sun angle", "warm orange highlights", "soft face shadows", "reflective lake surface"],
      annotations: [
        {
          id: "annotation-sun-disk",
          label: "Sun disk",
          cue: "low sun angle",
          evidence: "The warm sun sits low in the upper-right of the frame.",
          region: { x: 73, y: 17, width: 14, height: 18 },
          confidence: 0.92
        },
        {
          id: "annotation-rim-light",
          label: "Rim highlight",
          cue: "warm rim light",
          evidence: "The subject has a bright warm outline along the camera-right edge.",
          region: { x: 36, y: 49, width: 17, height: 31 },
          confidence: 0.88
        },
        {
          id: "annotation-lake-reflection",
          label: "Lake reflection",
          cue: "reflective lake surface",
          evidence: "Warm highlights repeat across the water surface.",
          region: { x: 11, y: 63, width: 56, height: 13 },
          confidence: 0.83
        }
      ],
      lightingSignals: ["sunset", "dusk", "golden hour"],
      expectedPhotographyAdvice: ["Use warm side light.", "Try backlight rim composition.", "Keep skin tones soft."]
    },
    teacherNotes:
      "When the travel note visually implies sunset or dusk, the apprentice should classify lighting as golden hour and adapt the photography advice.",
    extractedRule: demoRules[0],
    learningTrace: [
      {
        id: "learn-read-signal",
        label: "Read teacher signal",
        evidence: "Golden-hour reference board: reference image attached.",
        confidence: 0.88,
        validation: "Teacher signal captured from visual_demo.",
        needsHumanReview: false
      },
      {
        id: "learn-extract-rule",
        label: "Extract reusable rule",
        evidence: "Dusk words mean golden hour",
        confidence: 0.86,
        validation: "Reusable condition and action were separated from the source evidence.",
        needsHumanReview: false
      },
      {
        id: "learn-policy-check",
        label: "Apply memory policy",
        evidence: "Rule can run automatically.",
        confidence: 0.9,
        validation: "Memory can be applied to matching future runs.",
        needsHumanReview: false
      }
    ],
    createdAt: "2026-06-01T09:03:00.000Z"
  }
];

export const demoRun: ExecutionRunRecord = {
  id: "run-demo-golden-hour",
  taskId: demoTask.id,
  apprenticeId: demoApprentice.id,
  input: demoTask.inputExample,
  output: {
    location: "Lake Geneva",
    weather: "clear",
    subjects: ["lake surface", "snow mountains", "portrait subject"],
    lightingCondition: "golden hour",
    recommendedTitles: ["Lake light at golden hour", "Portraits in warm evening light"],
    journalBody:
      "Lake Geneva has soft evening light, and lake surface, snow mountains, and portrait subject form a layered photography journal scene.",
    photographyAdvice: ["Use warm side light to shape the subject.", "Try backlight or rim-light composition."]
  },
  status: "needs_review",
  trace: [],
  createdAt: "2026-06-01T09:10:00.000Z"
};

export const recentCorrections = [
  {
    id: "correction-golden-hour",
    feedback:
      "In future runs, if words like sunset, dusk, golden hour, \u508d\u665a, \u9ec4\u660f, or \u5915\u9633 appear, set lightingCondition to golden hour instead of generic natural light.",
    extractedRule: demoRules[0],
    createdAt: "2026-06-01T09:05:00.000Z"
  }
];
