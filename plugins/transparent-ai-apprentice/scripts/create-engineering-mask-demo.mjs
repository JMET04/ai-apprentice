#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const backdrop = argValue("--backdrop", join(pluginRoot, "assets", "examples", "engineering-object-index.png"));
const outputDir = argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "demos", "engineering-surgical-mask"));
if (!existsSync(backdrop)) throw new Error(`Engineering demo backdrop is missing: ${backdrop}`);

const result = spawnSync(process.execPath, [
  join(__dirname, "create-transparent-sketch-overlay-kit.mjs"),
  "--goal", "只修改工程对象 D04，不重画其他已确认内容",
  "--software", "AICAD / AutoCAD 工程图审校",
  "--content-type", "engineering",
  "--demo-preset", "engineering_dimension_change",
  "--backdrop", backdrop,
  "--output-dir", outputDir
], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });

if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Engineering mask demo generation failed");
const generated = JSON.parse(result.stdout);
process.stdout.write(`${JSON.stringify({
  format: "mingtu_engineering_surgical_mask_demo_v1",
  status: "ready_for_teacher_demo",
  ...generated,
  demonstration: {
    exactChangeTarget: "D04",
    requestedValue: "450 mm",
    changeRegionColor: "red",
    protectionRegionColor: "green",
    referenceRelationColor: "blue",
    wholeDrawingRegenerationAllowed: false,
    targetSoftwareExecuted: false
  }
}, null, 2)}\n`);
