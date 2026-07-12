#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const outputDir = join(repoRoot, ".transparent-apprentice", "demos", "office-text-mask");
const result = spawnSync(process.execPath, [
  join(__dirname, "create-office-text-mask-workbench.mjs"),
  "--goal", "只把 Word 第 2 段中的周五替换为周一",
  "--software", "Microsoft Word",
  "--demo-preset", "office_text_replace",
  "--output-dir", outputDir
], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });

if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Office text mask demo generation failed");
const generated = JSON.parse(result.stdout);
process.stdout.write(`${JSON.stringify({
  status: "ready_for_teacher_demo",
  ...generated,
  demonstration: {
    nativeTarget: "paragraph:2",
    sourceText: "周五",
    replacementText: "周一",
    wholeDocumentRewriteAllowed: false,
    originalImageMaskChanged: false
  }
}, null, 2)}\n`);
