import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".json"]);

export function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function hashText(text) {
  return `sha256:${createHash("sha256").update(String(text)).digest("hex")}`;
}

export function stableId(prefix, seed = "") {
  const suffix = seed ? hashText(seed).slice(7, 19) : new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}.${suffix}`;
}

export function listTextFiles(inputPath) {
  const root = resolve(inputPath);
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (TEXT_EXTENSIONS.has(extname(current).toLowerCase())) {
      files.push(current);
    }
  }
  files.sort();
  return files;
}

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fff]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2);
}

export function chunkText(text, { maxChars = 900 } = {}) {
  const normalized = String(text).replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && `${current}\n\n${paragraph}`.length > maxChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChars * 1.5) return [chunk];
    const parts = [];
    for (let index = 0; index < chunk.length; index += maxChars) parts.push(chunk.slice(index, index + maxChars));
    return parts;
  });
}

export function buildSourceCard({ sourceId, sourcePath, sourceType = "teacher_note", domain = "generic", title = "" }) {
  const text = readFileSync(sourcePath, "utf8");
  return {
    schema_version: "knowledge_source_card_v1",
    source_id: sourceId,
    source_type: sourceType,
    domain,
    title: title || basename(sourcePath),
    uri: sourcePath,
    trust_level: "teacher_supplied",
    permission: {
      status: "teacher_supplied",
      note: "Local teacher-provided source for review-only retrieval."
    },
    review: {
      accepted: false,
      review_only: true,
      packaging_gated: true,
      reviewer_id: null,
      reviewed_at: null
    },
    hashes: {
      source_hash: hashText(text)
    },
    created_at: new Date().toISOString()
  };
}

export function buildCorpusIndex({ sourcePath, outDir, sourceIdPrefix = "local", sourceType = "teacher_note", domain = "generic" }) {
  const files = listTextFiles(sourcePath);
  if (!files.length) throw new Error(`No supported text files found under ${sourcePath}`);
  const chunks = [];
  const sources = [];
  for (const file of files) {
    const sourceId = `${sourceIdPrefix}.${hashText(file).slice(7, 15)}`;
    const sourceCard = buildSourceCard({ sourceId, sourcePath: file, sourceType, domain });
    sources.push(sourceCard);
    const text = readFileSync(file, "utf8");
    chunkText(text).forEach((chunk, index) => {
      const chunkId = `${sourceId}.chunk.${String(index + 1).padStart(3, "0")}`;
      chunks.push({
        chunk_id: chunkId,
        source_id: sourceId,
        source_path: file,
        locator: `chunk:${index + 1}`,
        text: chunk,
        hash: hashText(chunk),
        token_estimate: Math.ceil(chunk.length / 4),
        terms: tokenize(chunk)
      });
    });
  }
  const index = {
    schema_version: "knowledge_corpus_index_v1",
    corpus_id: stableId("corpus", `${sourcePath}:${chunks.map((chunk) => chunk.hash).join("|")}`),
    source_path: resolve(sourcePath),
    created_at: new Date().toISOString(),
    source_count: sources.length,
    chunk_count: chunks.length,
    sources,
    chunks,
    locks: {
      review_only: true,
      accepted: false,
      packaging_gated: true,
      can_enable_rules: false,
      can_execute_target_software: false
    }
  };
  const indexPath = join(outDir, "knowledge-corpus-index.json");
  writeJson(indexPath, index);
  writeJson(join(outDir, "knowledge-source-cards.json"), sources);
  return { index, indexPath };
}

export function retrieveFromCorpus({ corpusIndex, query, topK = 3 }) {
  const queryTerms = tokenize(query);
  const querySet = new Set(queryTerms);
  const scored = corpusIndex.chunks.map((chunk) => {
    const chunkTerms = new Set(chunk.terms || tokenize(chunk.text));
    let score = 0;
    for (const term of querySet) if (chunkTerms.has(term)) score += 2;
    for (const term of queryTerms) if (String(chunk.text).toLowerCase().includes(term)) score += 0.25;
    return { chunk, score };
  });
  const selected = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunk_id.localeCompare(b.chunk.chunk_id))
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      chunk_id: chunk.chunk_id,
      source_id: chunk.source_id,
      source_path: chunk.source_path,
      locator: chunk.locator,
      score,
      hash: chunk.hash,
      text: chunk.text
    }));
  return {
    schema_version: "retrieval_evidence_packet_v1",
    retrieval_id: stableId("retrieval", `${corpusIndex.corpus_id}:${query}:${selected.map((chunk) => chunk.hash).join("|")}`),
    query,
    retriever: {
      kind: "local_keyword",
      version: "0.1.0",
      top_k: topK
    },
    status: selected.length ? "evidence_found" : "no_results",
    chunks: selected,
    locks: {
      evidence_only: true,
      can_enable_rules: false,
      can_execute_target_software: false,
      can_unlock_packaging: false,
      requires_teacher_review: true
    },
    missing_evidence: selected.length ? [] : ["No local corpus chunk matched the query."],
    created_at: new Date().toISOString()
  };
}

export function draftRuleCardFromRetrieval({ packet, ruleId = "knowledge.review_only.draft", domain = "knowledge.grounded_rule" }) {
  const evidenceRefs = packet.chunks.map((chunk) => `retrieval://${packet.retrieval_id}/${chunk.chunk_id}`);
  const naturalLanguage = packet.chunks
    .slice(0, 2)
    .map((chunk) => chunk.text.replace(/\s+/g, " ").slice(0, 240))
    .join(" ");
  return {
    dsl_version: "0.1",
    rule_id: ruleId,
    title: "Review-only rule draft from retrieved knowledge",
    domain,
    lifecycle: "draft_disabled",
    severity: "warning",
    owner: {
      teacher_id: "teacher.local",
      reviewer_id: null,
      approved_at: null
    },
    source: {
      type: "retrieval_evidence",
      evidence_refs: evidenceRefs,
      natural_language: naturalLanguage || "No retrieved evidence was available."
    },
    scope: { artifact_types: ["execution_plan"] },
    inputs_required: ["artifact.risk_level", "artifact.approval.teacher_confirmed", "artifact.rollback_point.exists"],
    constraint: {
      type: "policy_gate",
      validator: "execution_approval_gate",
      params: {
        require_teacher_confirmed: true,
        require_rollback_point: true,
        high_risk_levels: ["medium", "high"]
      }
    },
    failure: {
      message: "Retrieved knowledge indicates teacher review is required before risky execution.",
      action: "block_execution",
      remediation_hint: "Ask the teacher to review the retrieved evidence, then approve or rewrite this rule."
    },
    audit: {
      created_by: "rag_retrieval_draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: "0.1.0"
    }
  };
}
