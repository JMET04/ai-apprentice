import { describe, expect, it, afterEach } from "vitest";
import { getAIService, getAIServiceRuntimeStatus } from "@/server/ai/service";
import { mockAIService } from "@/server/ai/mock-ai-service";

const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_PROVIDER_MANUAL_ACCEPTED: process.env.AI_PROVIDER_MANUAL_ACCEPTED,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("AI service selector", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("keeps the deterministic mock active by default", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_MANUAL_ACCEPTED;
    delete process.env.OPENAI_API_KEY;

    const status = getAIServiceRuntimeStatus();

    expect(getAIService()).toBe(mockAIService);
    expect(status.activeProvider).toBe("mock");
    expect(status.requestedProvider).toBe("mock");
    expect(status.status).toBe("mock_active");
    expect(status.realModelReady).toBe(false);
    expect(status.configured.openAIAdapterImplemented).toBe(true);
    expect(status.safetyBoundary).toMatchObject({
      mockFallback: true,
      accepted: false,
      packagingGated: true
    });
  });

  it("does not activate OpenAI just because credentials are configured", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_PROVIDER_MANUAL_ACCEPTED = "false";

    const status = getAIServiceRuntimeStatus();

    expect(getAIService()).toBe(mockAIService);
    expect(status.activeProvider).toBe("mock");
    expect(status.requestedProvider).toBe("openai");
    expect(status.status).toBe("real_provider_configured_waiting_manual_acceptance");
    expect(status.realModelReady).toBe(false);
    expect(status.configured.manualProviderAcceptance).toBe(false);
  });

  it("activates the OpenAI adapter only after explicit manual acceptance", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_PROVIDER_MANUAL_ACCEPTED = "true";

    const status = getAIServiceRuntimeStatus();

    expect(getAIService()).not.toBe(mockAIService);
    expect(status.activeProvider).toBe("openai");
    expect(status.status).toBe("real_provider_active_after_manual_acceptance");
    expect(status.realModelReady).toBe(true);
    expect(status.configured.manualProviderAcceptance).toBe(true);
    expect(status.safetyBoundary.packagingGated).toBe(true);
  });
});
