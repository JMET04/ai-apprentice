#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const compiler = join(root, "scripts", "compile-image2-initial-prompt.mjs");
const smokeParent = resolve(root, "..", "..", ".ta-smoke");
mkdirSync(smokeParent, { recursive: true });
const temp = mkdtempSync(join(smokeParent, "image2-prompt-optimizer-"));

function compile(input, name) {
  const inputPath = join(temp, `${name}-input.json`);
  const outputPath = join(temp, `${name}-guidance.json`);
  writeFileSync(inputPath, JSON.stringify(input), "utf8");
  const result = spawnSync(process.execPath, [compiler, "--input", inputPath, "--output", outputPath, "--library-root", join(temp, "missing-library")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TEMP: smokeParent, TMP: smokeParent }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(readFileSync(outputPath, "utf8"));
}

const packaging = compile({
  task: "为电子设备设计插舌锁合折叠盒中文审校样图",
  domain: "packaging",
  productType: "电子设备插舌锁合折叠盒",
  dimensions: { length: 200, width: 120, height: 60, unit: "mm" },
  confirmedFacts: { material: "0.5 mm 白卡纸" }
}, "packaging");
assert.equal(packaging.format, "mingtu_image2_initial_prompt_guidance_v1");
assert.equal(packaging.route.domain, "packaging");
assert.equal(packaging.readyForGeneration, true);
assert.match(packaging.prompt, /200 × 120 × 60 mm/);
assert.match(packaging.prompt, /简体中文/);
assert.match(packaging.prompt, /禁止从图片像素量取或推断/);
assert.equal(packaging.library.mode, "bundled_fallback");
assert.equal(packaging.locks.accepted, false);

const blockedPackaging = compile({ task: "给产品做一个包装", domain: "packaging" }, "blocked-packaging");
assert.equal(blockedPackaging.readyForGeneration, false);
assert.equal(blockedPackaging.blockingUnknowns.length, 2);

const ui = compile({ task: "设计一个高密度设备维护仪表盘", domain: "auto", outputType: "桌面端后台界面" }, "ui");
assert.equal(ui.route.domain, "ui_web");
assert.match(ui.prompt, /正视界面/);
assert.match(ui.negativePrompt, /重叠控件/);

const product = compile({ task: "生成一张产品商业摄影主图", subject: "便携式标签打印机" }, "product");
assert.equal(product.route.domain, "product_visual");
assert.equal(product.readyForGeneration, true);
assert.equal(product.provenance.sourceThreadId, "019f09a9-90ab-76b2-aa1f-b7c9bddf93e8");

console.log(JSON.stringify({
  ok: true,
  smoke: "mingtu_image2_prompt_optimizer_smoke_v1",
  checks: 18,
  routes: [packaging.route.domain, blockedPackaging.route.domain, ui.route.domain, product.route.domain],
  temp
}, null, 2));
