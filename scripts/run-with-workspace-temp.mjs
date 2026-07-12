#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const separator = process.argv.indexOf("--");
const command = separator >= 0 ? process.argv[separator + 1] : "";
const args = separator >= 0 ? process.argv.slice(separator + 2) : [];
if (!command) {
  throw new Error("Usage: node scripts/run-with-workspace-temp.mjs -- <command> [...args]");
}

const event = String(process.env.npm_lifecycle_event || command)
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80) || "command";
const temp = resolve(".ta-smoke", "workspace-temp", `${event}-${process.pid}`);
mkdirSync(temp, { recursive: true });

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp },
  stdio: "inherit",
  windowsHide: true,
  shell: process.platform === "win32"
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
