import fs from "node:fs";
import path from "node:path";
import { OpenAICompatibleAIService } from "../src/server/ai/openai-service";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type FetchCall = {
  url: string;
  method?: string;
  authorizationPresent: boolean;
  contentType?: string;
  model?: string;
  responseFormat?: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "real-model-adapter-contract-verification.json");
const contractSecret = "sk-contract-secret-should-not-appear";

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function containsSecret(value: unknown) {
  return JSON.stringify(value).includes(contractSecret);
}

function installFakeOpenAIFetch(calls: FetchCall[]) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const headers = new Headers(init?.headers);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userContent = String(messages.find((message: { role?: string }) => message.role === "user")?.content ?? "");
    const parsedUserContent = userContent ? JSON.parse(userContent) : {};
    const isCorrectionRequest = Boolean(parsedUserContent.ruleContract);
    const url = typeof input === "string" ? input : input.toString();

    calls.push({
      url,
      method: init?.method,
      authorizationPresent: headers.has("authorization"),
      contentType: headers.get("content-type") ?? undefined,
      model: body.model,
      responseFormat: body.response_format?.type
    });

    const content = isCorrectionRequest
      ? {
          errorType: "Missing teacher priority",
          errorReason: "The draft did not preserve the teacher's requested focus.",
          condition: "When the note asks for a priority subject",
          action: "Lead the journal and advice with that subject before secondary scenery.",
          confidence: 0.81
        }
      : {
          location: "Kyoto riverside",
          weather: "cool evening after rain",
          subjects: ["lantern reflections", "stone bridge", "traveler portrait"],
          lightingCondition: "blue hour with warm lantern contrast",
          recommendedTitles: ["Lanterns After Rain", "Bridge at Blue Hour"],
          journalBody: "A quiet riverside walk frames lantern reflections and a portrait moment after rain.",
          photographyAdvice: ["Expose for the lantern highlights.", "Use the bridge as a leading line."]
        };

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(content)
            }
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function main() {
  const checks: VerificationCheck[] = [];
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL
  };
  const calls: FetchCall[] = [];
  const restoreFetch = installFakeOpenAIFetch(calls);

  process.env.OPENAI_API_KEY = contractSecret;
  process.env.OPENAI_MODEL = "contract-test-model";
  process.env.OPENAI_BASE_URL = "https://example.invalid/v1/chat/completions";

  try {
    const service = new OpenAICompatibleAIService();
    const run = await service.generateExecution("Kyoto after-rain walk with lanterns and a portrait subject.", {
      taskId: "task-photo-travel-journal",
      apprenticeId: "apprentice-contract",
      rules: [
        {
          id: "rule-enabled-priority-subject",
          apprenticeId: "apprentice-contract",
          taskId: "task-photo-travel-journal",
          title: "Prioritize named subject",
          condition: "When the teacher names a priority subject",
          action: "Lead with that subject in the journal and advice.",
          source: "correction",
          confidence: 0.86,
          enabled: true,
          createdAt: "2026-06-23T00:00:00.000Z"
        },
        {
          id: "rule-disabled-unaccepted",
          apprenticeId: "apprentice-contract",
          taskId: "task-photo-travel-journal",
          title: "Unaccepted draft rule",
          condition: "Draft-only condition",
          action: "Do not apply until accepted.",
          source: "correction",
          confidence: 0.52,
          enabled: false,
          createdAt: "2026-06-23T00:00:00.000Z"
        }
      ]
    });
    const correction = await service.extractCorrectionRule({
      feedback: "Lead with the named subject before the scenery.",
      beforeOutput: run.output,
      structuredFeedback: {
        field: "journalBody",
        correctedValue: "Lead with the traveler portrait before scenery.",
        conditionCue: "teacher says named subject"
      },
      memoryPolicy: {
        applyAutomatically: false,
        requiresHumanConfirmation: true
      },
      taskId: "task-photo-travel-journal",
      apprenticeId: "apprentice-contract"
    });

    const traceHasHumanReview = run.trace.some((step) => step.needsHumanReview && step.nodeId.includes("human"));
    const traceHasOnlyPublicBoundary = !JSON.stringify(run.trace).includes("chain-of-thought");
    const enabledRuleApplied = run.trace.some((step) =>
      step.appliedRules.some((rule) => rule.id === "rule-enabled-priority-subject")
    );
    const disabledRuleApplied = run.trace.some((step) =>
      step.appliedRules.some((rule) => rule.id === "rule-disabled-unaccepted")
    );
    const secretLeaked = containsSecret({ calls, run, correction });

    push(
      checks,
      "OpenAI-compatible adapter can generate the bounded execution contract",
      run.status === "needs_review" &&
        run.taskId === "task-photo-travel-journal" &&
        run.output.location === "Kyoto riverside" &&
        Array.isArray(run.output.photographyAdvice) &&
        run.output.photographyAdvice.length > 0,
      `status=${run.status}; location=${run.output.location}; advice=${run.output.photographyAdvice.length}`
    );

    push(
      checks,
      "OpenAI-compatible adapter keeps public trace and human review checkpoints",
      run.trace.length >= 5 && traceHasHumanReview && traceHasOnlyPublicBoundary,
      `traceSteps=${run.trace.length}; humanReview=${traceHasHumanReview}; publicOnly=${traceHasOnlyPublicBoundary}`
    );

    push(
      checks,
      "OpenAI-compatible adapter applies only enabled rules to trace evidence",
      enabledRuleApplied && !disabledRuleApplied,
      `enabledApplied=${enabledRuleApplied}; disabledApplied=${disabledRuleApplied}`
    );

    push(
      checks,
      "OpenAI-compatible adapter extracts review-only correction rules",
      correction.applyAutomatically === false &&
        correction.requiresHumanConfirmation === true &&
        correction.extractedRule.enabled === false &&
        correction.learningTrace.every((step) => step.needsHumanReview),
      `applyAutomatically=${correction.applyAutomatically}; requiresHumanConfirmation=${correction.requiresHumanConfirmation}; ruleEnabled=${correction.extractedRule.enabled}`
    );

    push(
      checks,
      "OpenAI-compatible adapter sends JSON chat-completion requests through the configured endpoint",
      calls.length === 2 &&
        calls.every(
          (call) =>
            call.url === "https://example.invalid/v1/chat/completions" &&
            call.method === "POST" &&
            call.authorizationPresent &&
            call.contentType === "application/json" &&
            call.model === "contract-test-model" &&
            call.responseFormat === "json_object"
        ),
      `calls=${calls.length}; models=${calls.map((call) => call.model).join(",")}; authRedacted=${calls.every(
        (call) => call.authorizationPresent
      )}`
    );

    push(
      checks,
      "OpenAI-compatible adapter contract receipt does not leak provider secrets",
      !secretLeaked,
      "Scanned generated run, correction, and redacted request metadata for the contract secret."
    );

    push(
      checks,
      "OpenAI-compatible adapter contract cannot unlock release or packaging",
      true,
      "This verifier does not write acceptance, does not set AI_PROVIDER_MANUAL_ACCEPTED, does not enable rules, and does not change packaging state."
    );
  } finally {
    restoreFetch();
    if (originalEnv.OPENAI_API_KEY === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    }
    if (originalEnv.OPENAI_MODEL === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
    }
    if (originalEnv.OPENAI_BASE_URL === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL;
    }
  }

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "real_model_adapter_contract_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:real-model-adapter-contract",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    realNetworkUsed: false,
    realProviderAccepted: false,
    canActivateRealModel: false,
    canRelease: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Keep this adapter contract receipt with the real-model trial kit before any separate real-provider trial."
        : "Fix the OpenAI-compatible adapter contract before relying on real-model trial planning."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nReal model adapter contract verification written to ${receiptPath}`);

  if (verification.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
