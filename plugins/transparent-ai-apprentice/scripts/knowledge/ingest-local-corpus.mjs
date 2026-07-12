#!/usr/bin/env node
import { resolve } from "node:path";
import { arg, buildCorpusIndex } from "./knowledge-core.mjs";

const sourcePath = resolve(arg("--source", ""));
const outDir = resolve(arg("--out-dir", ".transparent-apprentice/knowledge/local-corpus"));
const sourceIdPrefix = arg("--source-id-prefix", "local");
const sourceType = arg("--source-type", "teacher_note");
const domain = arg("--domain", "generic");

if (!sourcePath) throw new Error("Usage: node ingest-local-corpus.mjs --source <file-or-directory> [--out-dir <dir>]");

const result = buildCorpusIndex({ sourcePath, outDir, sourceIdPrefix, sourceType, domain });
console.log(JSON.stringify({ ok: true, indexPath: result.indexPath, chunkCount: result.index.chunk_count, sourceCount: result.index.source_count }, null, 2));
