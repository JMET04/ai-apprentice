import type {
  CorrectionExtraction,
  ExecutionRunRecord,
  MemoryApplicationPolicy,
  RuleRecord,
  StructuredFeedbackRecord,
  TraceNodeIds
} from "@/lib/types";

export interface AIService {
  generateExecution(
    input: string,
    args?: { rules?: RuleRecord[]; taskId?: string; apprenticeId?: string; traceNodeIds?: TraceNodeIds }
  ): Promise<ExecutionRunRecord>;
  extractCorrectionRule(args: {
    feedback: string;
    beforeOutput: unknown;
    structuredFeedback?: StructuredFeedbackRecord;
    memoryPolicy?: MemoryApplicationPolicy;
    taskId: string;
    apprenticeId: string;
  }): Promise<CorrectionExtraction>;
}
