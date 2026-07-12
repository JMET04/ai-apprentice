import type { AIService } from "./types";
import { extractRuleFromFeedback } from "@/server/corrections/rule-extractor";
import { executePhotographyJournalTask } from "@/server/workflow/execution-engine";

export const mockAIService: AIService = {
  async generateExecution(input, args) {
    // Future replacement point: call a real model service here and then normalize
    // its response into ExecutionRunRecord before returning it to UI/API layers.
    return executePhotographyJournalTask(input, args?.rules, {
      taskId: args?.taskId,
      apprenticeId: args?.apprenticeId,
      traceNodeIds: args?.traceNodeIds
    });
  },
  async extractCorrectionRule(args) {
    // Future replacement point: ask a model to classify feedback and extract a
    // rule, then run policy validation before saving it to the memory store.
    return extractRuleFromFeedback(args);
  }
};
