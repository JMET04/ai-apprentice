#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const testPath = resolve(
  "plugins",
  "transparent-ai-apprentice",
  "integrations",
  "aicad-agent-v1",
  "tests",
  "run_integration_tests.py"
);

const result = spawnSync("python", ["-B", testPath], {
  cwd: process.cwd(),
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  encoding: "utf8",
  windowsHide: true
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
