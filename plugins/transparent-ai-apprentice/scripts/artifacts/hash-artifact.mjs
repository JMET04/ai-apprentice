#!/usr/bin/env node
import { readJson, sha256Object } from "../rules/rule-dsl-core.mjs";

const path = process.argv[2] || process.argv[process.argv.indexOf("--artifact") + 1];
if (!path) throw new Error("Provide --artifact");
console.log(JSON.stringify({ artifactPath: path, hash: sha256Object(readJson(path)) }, null, 2));
