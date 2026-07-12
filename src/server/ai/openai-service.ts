import type {
  CorrectionExtraction,
  ExecutionOutput,
  ExecutionRunRecord,
  MemoryApplicationPolicy,
  RuleRecord,
  StructuredFeedbackRecord,
  TraceNodeIds,
  TraceStepRecord
} from "@/lib/types";
import type { AIService } from "@/server/ai/types";
import { ensurePublicTraceOnly } from "@/server/policy/guardrails";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAIExecutionDraft = {
  location: string;
  weather: string;
  subjects: string[];
  lightingCondition: string;
  recommendedTitles: string[];
  journalBody: string;
  photographyAdvice: string[];
};

type OpenAICorrectionDraft = {
  errorType: string;
  errorReason: string;
  condition: string;
  action: string;
  confidence?: number;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function clampConfidence(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(0.95, Math.max(0.1, value)) : fallback;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateExecutionOutput(value: unknown): ExecutionOutput {
  const draft = value as Partial<OpenAIExecutionDraft>;
  const {
    location,
    weather,
    subjects,
    lightingCondition,
    recommendedTitles,
    journalBody,
    photographyAdvice
  } = draft;
  const isValid =
    typeof location === "string" &&
    typeof weather === "string" &&
    isStringArray(subjects) &&
    typeof lightingCondition === "string" &&
    isStringArray(recommendedTitles) &&
    typeof journalBody === "string" &&
    isStringArray(photographyAdvice);

  if (!isValid) {
    throw new Error("OpenAI adapter returned output that does not match ExecutionOutput.");
  }

  return {
    location,
    weather,
    subjects,
    lightingCondition,
    recommendedTitles,
    journalBody,
    photographyAdvice
  };
}

function validateCorrectionDraft(value: unknown): Required<OpenAICorrectionDraft> {
  const draft = value as Partial<OpenAICorrectionDraft>;
  const { errorType, errorReason, condition, action } = draft;
  const isValid =
    typeof errorType === "string" &&
    typeof errorReason === "string" &&
    typeof condition === "string" &&
    typeof action === "string";

  if (!isValid) {
    throw new Error("OpenAI adapter returned correction data that does not match the rule draft contract.");
  }

  return {
    errorType,
    errorReason,
    condition,
    action,
    confidence: clampConfidence(draft.confidence, 0.72)
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced?.[1] ?? trimmed;
  return JSON.parse(jsonText) as unknown;
}

function resolveReviewOnlyPolicy(memoryPolicy?: MemoryApplicationPolicy) {
  return {
    applyAutomatically: false,
    requiresHumanConfirmation: memoryPolicy?.requiresHumanConfirmation ?? true
  };
}

export class OpenAICompatibleAIService implements AIService {
  private get apiKey() {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required before using the OpenAI adapter.");
    }
    return apiKey;
  }

  private get endpoint() {
    return env("OPENAI_BASE_URL") || "https://api.openai.com/v1/chat/completions";
  }

  private get model() {
    return env("OPENAI_MODEL") || "gpt-4.1-mini";
  }

  private async requestJson<T>(messages: Array<{ role: "system" | "user"; content: string }>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI adapter request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as OpenAIChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI adapter response did not include message content.");
    }

    return extractJson(content) as T;
  }

  async generateExecution(
    input: string,
    args?: { rules?: RuleRecord[]; taskId?: string; apprenticeId?: string; traceNodeIds?: TraceNodeIds }
  ): Promise<ExecutionRunRecord> {
    const normalizedInput = input.trim();
    const rules = args?.rules ?? [];
    const enabledRules = rules.filter((rule) => rule.enabled);
    const output = validateExecutionOutput(
      await this.requestJson<OpenAIExecutionDraft>([
        {
          role: "system",
          content:
            "You are the model adapter for Transparent AI Apprentice. Return only JSON matching the requested schema. Use public evidence fields only; do not include hidden reasoning."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate a structured photography travel journal.",
            input: normalizedInput,
            enabledRules: enabledRules.map((rule) => ({
              title: rule.title,
              condition: rule.condition,
              action: rule.action,
              confidence: rule.confidence
            })),
            requiredJsonShape: {
              location: "string",
              weather: "string",
              subjects: ["string"],
              lightingCondition: "string",
              recommendedTitles: ["string"],
              journalBody: "string",
              photographyAdvice: ["string"]
            }
          })
        }
      ])
    );
    const traceNodeIds = {
      input: "node-input",
      understand: "node-understand",
      decision: "node-decision",
      execute: "node-execute",
      check: "node-check",
      human_review: "node-human",
      output: "node-output",
      ...args?.traceNodeIds
    };
    const appliedRules = enabledRules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      condition: rule.condition,
      action: rule.action
    }));
    const trace: TraceStepRecord[] = [
      {
        id: "trace-input",
        nodeId: traceNodeIds.input,
        stepName: "Receive travel note",
        input: { rawTravelNote: normalizedInput },
        output: { provider: "openai", model: this.model },
        appliedRules: [],
        confidence: normalizedInput.length > 10 ? 0.9 : 0.55,
        needsHumanReview: normalizedInput.length <= 10,
        validation: normalizedInput.length > 10 ? "Input has enough detail." : "Input may be too short.",
        uncertainty: normalizedInput.length <= 10 ? ["The note is too short."] : []
      },
      {
        id: "trace-execute",
        nodeId: traceNodeIds.execute,
        stepName: "Generate model-structured journal",
        input: { ruleCount: enabledRules.length, provider: "openai" },
        output,
        appliedRules,
        confidence: 0.78,
        needsHumanReview: true,
        validation: "Model output matched the required public JSON shape.",
        uncertainty: ["Real-model output requires teacher review before acceptance or packaging."]
      },
      {
        id: "trace-check",
        nodeId: traceNodeIds.check,
        stepName: "Validate public output contract",
        input: { output },
        output: {
          requiredFieldsPresent: true,
          publicTraceOnly: true,
          accepted: false,
          packagingGated: true
        },
        appliedRules,
        confidence: 0.86,
        needsHumanReview: true,
        validation: "All required fields are present; acceptance remains separate.",
        uncertainty: ["Teacher must confirm whether the model followed the taught behavior."]
      },
      {
        id: "trace-human",
        nodeId: traceNodeIds.human_review,
        stepName: "Teacher review checkpoint",
        input: { provider: "openai", model: this.model },
        output: { prompt: "Review this real-model draft before saving memory, acceptance, or release evidence." },
        appliedRules,
        confidence: 0.82,
        needsHumanReview: true,
        validation: "Human review point is explicit.",
        uncertainty: ["Real-model adapter is not product acceptance."]
      },
      {
        id: "trace-output",
        nodeId: traceNodeIds.output,
        stepName: "Publish structured journal",
        input: { reviewRequired: true },
        output: { finalJournal: output, memoryApplied: appliedRules.map((rule) => rule.title) },
        appliedRules,
        confidence: 0.78,
        needsHumanReview: true,
        validation: "Final output is linked to public trace, validation, and memory provenance.",
        uncertainty: ["Final output remains open for teacher review."]
      }
    ];

    return {
      id: `run-openai-${Date.now()}`,
      taskId: args?.taskId ?? "task-photo-travel-journal",
      apprenticeId: args?.apprenticeId ?? "apprentice-demo",
      input: normalizedInput,
      output,
      status: "needs_review",
      trace: ensurePublicTraceOnly(trace),
      createdAt: new Date().toISOString()
    };
  }

  async extractCorrectionRule(args: {
    feedback: string;
    beforeOutput: unknown;
    structuredFeedback?: StructuredFeedbackRecord;
    memoryPolicy?: MemoryApplicationPolicy;
    taskId: string;
    apprenticeId: string;
  }): Promise<CorrectionExtraction> {
    const draft = validateCorrectionDraft(
      await this.requestJson<OpenAICorrectionDraft>([
        {
          role: "system",
          content:
            "You extract conservative, teacher-review-only rule drafts for Transparent AI Apprentice. Return only JSON with errorType, errorReason, condition, action, and confidence."
        },
        {
          role: "user",
          content: JSON.stringify({
            feedback: args.feedback,
            beforeOutput: args.beforeOutput,
            structuredFeedback: args.structuredFeedback ?? null,
            ruleContract: {
              condition: "when this rule should apply",
              action: "what the apprentice should do",
              enabledByDefault: false,
              requiresTeacherConfirmation: true
            }
          })
        }
      ])
    );
    const memoryPolicy = resolveReviewOnlyPolicy(args.memoryPolicy);
    const createdAt = new Date().toISOString();
    const extractedRule: RuleRecord = {
      id: `rule-openai-${Date.now()}`,
      apprenticeId: args.apprenticeId,
      taskId: args.taskId,
      title: draft.errorType || "Real-model correction draft",
      condition: draft.condition,
      action: draft.action,
      source: "correction",
      confidence: draft.confidence,
      enabled: memoryPolicy.applyAutomatically,
      createdAt
    };

    return {
      errorType: draft.errorType,
      errorReason: draft.errorReason,
      condition: draft.condition,
      action: draft.action,
      extractedRule,
      applyAutomatically: memoryPolicy.applyAutomatically,
      requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation,
      learningTrace: [
        {
          id: "learn-openai-feedback",
          label: "Teacher feedback observed",
          evidence: args.feedback,
          confidence: 0.9,
          validation: "Feedback was passed to the real-model adapter for structured extraction.",
          needsHumanReview: true
        },
        {
          id: "learn-openai-rule-draft",
          label: "Review-only rule draft",
          evidence: `${draft.condition} -> ${draft.action}`,
          confidence: draft.confidence,
          validation: "Draft remains disabled until explicit teacher confirmation.",
          needsHumanReview: true
        }
      ]
    };
  }
}

export const openAICompatibleAIService = new OpenAICompatibleAIService();
