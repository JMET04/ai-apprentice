import type { TraceStepRecord } from "@/lib/types";

const privateTraceKeys = new Set(["chainOfThought", "privateChainOfThought", "hiddenReasoning"]);

function stripPrivateTraceFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPrivateTraceFields);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateTraceKeys.has(key))
        .map(([key, item]) => [key, stripPrivateTraceFields(item)])
    );
  }

  return value;
}

export function ensurePublicTraceOnly(trace: TraceStepRecord[]) {
  return stripPrivateTraceFields(trace) as TraceStepRecord[];
}

export function needsHumanReview(confidence: number, uncertainty: string[]) {
  return confidence < 0.82 || uncertainty.length > 0;
}
