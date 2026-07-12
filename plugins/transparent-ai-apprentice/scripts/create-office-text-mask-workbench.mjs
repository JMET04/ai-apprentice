#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const forwarded = process.argv.slice(2).filter((value, index, values) => {
  if (value === "--content-type") return false;
  if (index > 0 && values[index - 1] === "--content-type") return false;
  return true;
});
const result = spawnSync(
  process.execPath,
  [join(__dirname, "create-precise-content-mask-workbench.mjs"), "--content-type", "text", ...forwarded],
  { cwd: process.cwd(), encoding: "utf8", env: process.env }
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exit(result.status ?? 1);
