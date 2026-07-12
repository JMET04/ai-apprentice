#!/usr/bin/env node
import { resolve } from "node:path";
import { arg, readJson, retrieveFromCorpus, writeJson } from "./knowledge-core.mjs";

const corpusIndexPath = resolve(arg("--corpus-index", ""));
const query = arg("--query", "");
const topK = Number(arg("--top-k", "3"));
const outPath = resolve(arg("--out", ".transparent-apprentice/knowledge/retrieval-evidence-packet.json"));

if (!corpusIndexPath || !query) {
  throw new Error("Usage: node retrieve-local-knowledge.mjs --corpus-index <path> --query <text> [--out <path>]");
}

const packet = retrieveFromCorpus({ corpusIndex: readJson(corpusIndexPath), query, topK });
writeJson(outPath, packet);
console.log(JSON.stringify({ ok: true, status: packet.status, outPath, chunks: packet.chunks.length, locks: packet.locks }, null, 2));
