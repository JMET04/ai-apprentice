#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, buildCorpusIndex, hashText, stableId, writeJson } from "./knowledge-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, "..", "..");
const defaultAdviserNote = join(pluginRoot, "KNOWLEDGE_AUGMENTED_RAG_RESEARCH_DIRECTION.md");

const adviserNotePath = resolve(arg("--adviser-note", defaultAdviserNote));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-research-intake-queue")));
const runId = stableId("rag_research_intake", adviserNotePath);
const runDir = join(outDir, runId);
const corpusDir = join(runDir, "corpus");

mkdirSync(runDir, { recursive: true });

const adviserNoteText = readFileSync(adviserNotePath, "utf8");
const { index, indexPath } = buildCorpusIndex({
  sourcePath: adviserNotePath,
  outDir: corpusDir,
  sourceIdPrefix: "adviser.rag",
  sourceType: "teacher_note",
  domain: "knowledge_augmentation.rag"
});

function sourceCandidate({
  id,
  sourceType,
  domain = "knowledge_augmentation.rag",
  title,
  uri,
  trustLevel,
  permissionStatus,
  permissionNote,
  reviewQuestion,
  researchAction,
  evidenceNeed
}) {
  return {
    candidate_id: id,
    source_card: {
      schema_version: "knowledge_source_card_v1",
      source_id: id,
      source_type: sourceType,
      domain,
      title,
      uri,
      trust_level: trustLevel,
      permission: {
        status: permissionStatus,
        note: permissionNote
      },
      review: {
        accepted: false,
        review_only: true,
        packaging_gated: true,
        reviewer_id: null,
        reviewed_at: null
      },
      hashes: {
        source_hash: hashText(`${title}\n${uri}\n${researchAction}`)
      },
      created_at: new Date().toISOString()
    },
    review_question: reviewQuestion,
    research_action: researchAction,
    evidence_need: evidenceNeed,
    status: "waiting_for_research_or_teacher_review",
    locks: {
      evidenceOnly: true,
      accepted: false,
      ruleEnabled: false,
      memoryEnabled: false,
      softwareActionsExecuted: false,
      packagingGated: true
    }
  };
}

const sourceCandidates = [
  sourceCandidate({
    id: "adviser_wechat_rag_direction_note",
    sourceType: "teacher_note",
    title: "Adviser WeChat screenshots: knowledge enhancement and RAG direction",
    uri: adviserNotePath,
    trustLevel: "teacher_supplied",
    permissionStatus: "teacher_supplied",
    permissionNote: "User supplied screenshots and requested this direction be added to the goal.",
    reviewQuestion: "Does this extraction accurately preserve the adviser's intended RAG and knowledge-enhancement direction?",
    researchAction: "Use as the teacher-supplied seed note for the research lane.",
    evidenceNeed: "Teacher review of the extraction and any missing nuance from the screenshots."
  }),
  sourceCandidate({
    id: "rag_general_research_survey_lead",
    sourceType: "paper",
    title: "RAG and retrieval-augmented generation survey lead",
    uri: "research-lead://rag-general-survey",
    trustLevel: "unverified",
    permissionStatus: "unknown",
    permissionNote: "Placeholder research lead only; no paper has been verified by this script.",
    reviewQuestion: "Which current RAG survey papers should be admitted as public references?",
    researchAction: "Find recent survey papers and record source ids, URLs, publication venues, and limits.",
    evidenceNeed: "Verified bibliographic source, abstract-level relevance, and license or access note."
  }),
  sourceCandidate({
    id: "knowledge_augmented_large_model_lead",
    sourceType: "paper",
    title: "Knowledge-augmented large model research lead",
    uri: "research-lead://knowledge-augmented-large-model",
    trustLevel: "unverified",
    permissionStatus: "unknown",
    permissionNote: "Placeholder research lead only; it must not be treated as a cited source.",
    reviewQuestion: "Which knowledge-augmented LLM methods are applicable to teachable agents rather than generic chat?",
    researchAction: "Compare knowledge injection, retrieval grounding, memory editing, and tool-augmented agent methods.",
    evidenceNeed: "Source-backed comparison with methods, assumptions, and failure modes."
  }),
  sourceCandidate({
    id: "zhejiang_university_research_lead",
    sourceType: "unknown",
    title: "Zhejiang University knowledge-enhanced model research lead",
    uri: "research-lead://zhejiang-university-knowledge-enhancement",
    trustLevel: "unverified",
    permissionStatus: "unknown",
    permissionNote: "Mentioned in adviser feedback as a lead to investigate; not verified here.",
    reviewQuestion: "Which Zhejiang University teams or papers, if any, are actually relevant to this product direction?",
    researchAction: "Verify the adviser lead through primary sources before adding citations or implementation claims.",
    evidenceNeed: "Primary project page, paper, lab page, or official repository; do not use hearsay."
  }),
  sourceCandidate({
    id: "software_manuals_and_log_reference_lead",
    sourceType: "software_doc",
    title: "Domain software manuals, CLI/API docs, and log-format references",
    uri: "research-lead://software-manuals-log-references",
    trustLevel: "unverified",
    permissionStatus: "unknown",
    permissionNote: "The exact manuals depend on the teacher-selected software and local corpus.",
    reviewQuestion: "Which manuals and log-format references should be ingested for the next target software group?",
    researchAction: "Collect only permitted local or public docs, then ingest with source ids and hashes.",
    evidenceNeed: "Teacher-approved source list, freshness note, and bounded retrieval queries."
  })
];

const retrievalQueries = [
  {
    query_id: "rag_direction_definition",
    query: "knowledge enhancement RAG external knowledge retriever evidence layer teacher review",
    purpose: "Ground the product definition of the RAG lane in the adviser note."
  },
  {
    query_id: "low_token_rag_bridge",
    query: "low-token software signals retrieve compact evidence manuals logs rule drafts",
    purpose: "Connect low-token observation to bounded retrieval instead of continuous recording."
  },
  {
    query_id: "strict_detail_logic_rag",
    query: "strict detail logic source backed constraints disabled Rule Cards teacher review",
    purpose: "Connect RAG evidence to rigorous detail logic rather than similar-looking output."
  }
];

const queue = {
  format: "transparent_ai_rag_research_intake_queue_v1",
  runId,
  createdAt: new Date().toISOString(),
  adviserNotePath,
  adviserNoteHash: hashText(adviserNoteText),
  corpus: {
    indexPath,
    corpusId: index.corpus_id,
    sourceCount: index.source_count,
    chunkCount: index.chunk_count,
    accepted: false,
    reviewOnly: true,
    packagingGated: true
  },
  sourceCandidates,
  retrievalQueries,
  reviewPlan: [
    {
      step: "teacher_review_adviser_extraction",
      instruction: "Teacher checks whether the extracted adviser direction is faithful.",
      continueCondition: "Teacher confirms or corrects the extraction.",
      stopCondition: "Teacher says the extraction is inaccurate or missing a major point."
    },
    {
      step: "verify_external_research_leads",
      instruction: "Researcher verifies unverified leads through primary sources before citation.",
      continueCondition: "Each admitted source has source id, URI, hash or stable locator, trust note, and permission note.",
      stopCondition: "A lead cannot be traced to a primary or permitted source."
    },
    {
      step: "ingest_confirmed_sources",
      instruction: "Only teacher-approved or public-reference sources are ingested into the local corpus.",
      continueCondition: "Confirmed sources produce knowledge-source-card and retrieval-evidence-packet records.",
      stopCondition: "Source permission, trust level, or freshness is unclear."
    }
  ],
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    fullLogRead: false,
    technologyAccepted: false,
    packagingGated: true,
    packagingUnlocked: false
  },
  forbiddenActions: [
    "treat_unverified_leads_as_citations",
    "enable_rules_from_research_queue",
    "execute_target_software",
    "write_long_term_memory",
    "claim_zhejiang_university_evidence_without_primary_source",
    "unlock_packaging_or_release"
  ]
};

const queuePath = join(runDir, "rag-research-intake-queue.json");
writeJson(queuePath, queue);

const readmePath = join(runDir, "RAG_RESEARCH_INTAKE_QUEUE_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Research Intake Queue",
    "",
    "This is a review-only queue. It turns adviser feedback into structured knowledge-source candidates and local retrieval queries.",
    "",
    `- Queue: ${queuePath}`,
    `- Corpus index: ${indexPath}`,
    `- Adviser note: ${adviserNotePath}`,
    "",
    "## Locks",
    "",
    "- Does not verify external research leads.",
    "- Does not enable rules.",
    "- Does not execute target software.",
    "- Does not write long-term memory.",
    "- Does not unlock packaging or release.",
    "",
    "## Next Review",
    "",
    "1. Confirm whether the adviser extraction is faithful.",
    "2. Verify external leads through primary sources before citing them.",
    "3. Ingest only confirmed and permitted sources into the local RAG corpus."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: queue.format,
      queuePath,
      readmePath,
      indexPath,
      sourceCandidates: sourceCandidates.length,
      retrievalQueries: retrievalQueries.length,
      locks: queue.locks
    },
    null,
    2
  )
);
