import type { AIService } from "@/server/ai/types";
import { mockAIService } from "@/server/ai/mock-ai-service";
import { openAICompatibleAIService } from "@/server/ai/openai-service";

const supportedRealProviders = ["openai"] as const;

function requestedProvider() {
  return (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase() || "mock";
}

function manualProviderAcceptanceEnabled() {
  return process.env.AI_PROVIDER_MANUAL_ACCEPTED === "true";
}

export function getAIService(): AIService {
  const requested = requestedProvider();
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY);
  const realProviderAccepted = manualProviderAcceptanceEnabled();

  if (requested === "openai" && openAIConfigured && realProviderAccepted) {
    return openAICompatibleAIService;
  }

  // The bounded product loop intentionally falls back to the deterministic mock
  // service until a real provider is configured and separately accepted.
  return mockAIService;
}

export function getAIServiceRuntimeStatus() {
  const requested = requestedProvider();
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY);
  const openAIModel = process.env.OPENAI_MODEL || "not_set";
  const openAIBaseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
  const realProviderAccepted = manualProviderAcceptanceEnabled();
  const isKnownRealProvider = supportedRealProviders.includes(requested as (typeof supportedRealProviders)[number]);
  const openAIReady = requested === "openai" && openAIConfigured && realProviderAccepted;

  return {
    responseMode: "ai_service_runtime_status_json_v1",
    activeProvider: openAIReady ? "openai" : "mock",
    requestedProvider: requested,
    status:
      requested === "mock"
        ? "mock_active"
        : isKnownRealProvider && openAIConfigured
          ? realProviderAccepted
            ? "real_provider_active_after_manual_acceptance"
            : "real_provider_configured_waiting_manual_acceptance"
          : isKnownRealProvider
            ? "real_provider_missing_credentials"
            : "unknown_provider_falls_back_to_mock",
    realModelReady: openAIReady,
    switchRequires: [
      "Set AI_PROVIDER to a supported real provider.",
      "Configure provider credentials outside source control.",
      "Keep AI_PROVIDER_MANUAL_ACCEPTED=false until a separate human acceptance pass approves the real-model trial.",
      "Run npm run verify:product.",
      "Complete a separate human acceptance pass before changing activeProvider."
    ],
    configured: {
      openAICompatible: openAIConfigured,
      openAIModel,
      openAIBaseUrl,
      openAIAdapterImplemented: true,
      manualProviderAcceptance: realProviderAccepted
    },
    safetyBoundary: {
      mockFallback: !openAIReady,
      accepted: openAIReady,
      packagingGated: true,
      reason: openAIReady
        ? "A real-model adapter is active for a separately accepted trial, while packaging and release remain gated."
        : "The current productized loop uses deterministic mock execution until a real-model adapter is configured and manually accepted."
    }
  };
}
