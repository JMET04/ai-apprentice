import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import {
  demoApprentice,
  demoRules,
  demoTeachingExamples,
  demoTask,
  demoVisualDemonstrations,
  demoWorkflow,
  recentCorrections
} from "../src/lib/demo-data";
import { extractRuleFromExecutionHistory } from "../src/server/corrections/history-lesson-extractor";
import { executePhotographyJournalTask } from "../src/server/workflow/execution-engine";

const dbPath = join(process.cwd(), "prisma", "dev.db");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

function run(sql: string, params: Record<string, SQLInputValue> = {}) {
  db.prepare(sql).run(params);
}

function json(value: unknown) {
  return JSON.stringify(value);
}

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Apprentice (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  domain TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id)
);

CREATE TABLE IF NOT EXISTS Task (
  id TEXT PRIMARY KEY,
  apprenticeId TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  inputSchema TEXT NOT NULL,
  expectedOutput TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (apprenticeId) REFERENCES Apprentice(id)
);

CREATE TABLE IF NOT EXISTS Workflow (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (taskId) REFERENCES Task(id)
);

CREATE TABLE IF NOT EXISTS WorkflowNode (
  id TEXT PRIMARY KEY,
  workflowId TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  inputFields TEXT NOT NULL,
  outputFields TEXT NOT NULL,
  validationRules TEXT NOT NULL,
  fallbackBehavior TEXT NOT NULL,
  FOREIGN KEY (workflowId) REFERENCES Workflow(id)
);

CREATE TABLE IF NOT EXISTS Rule (
  id TEXT PRIMARY KEY,
  apprenticeId TEXT NOT NULL,
  taskId TEXT,
  title TEXT NOT NULL,
  condition TEXT NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  enabled INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (apprenticeId) REFERENCES Apprentice(id),
  FOREIGN KEY (taskId) REFERENCES Task(id)
);

CREATE TABLE IF NOT EXISTS Correction (
  id TEXT PRIMARY KEY,
  apprenticeId TEXT NOT NULL,
  taskId TEXT NOT NULL,
  runId TEXT,
  userFeedback TEXT NOT NULL,
  errorType TEXT NOT NULL,
  extractedRule TEXT NOT NULL,
  beforeOutput TEXT NOT NULL,
  afterOutput TEXT,
  learningTrace TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (apprenticeId) REFERENCES Apprentice(id),
  FOREIGN KEY (taskId) REFERENCES Task(id)
);

CREATE TABLE IF NOT EXISTS TeachingExample (
  id TEXT PRIMARY KEY,
  apprenticeId TEXT NOT NULL,
  taskId TEXT NOT NULL,
  input TEXT NOT NULL,
  expectedOutput TEXT NOT NULL,
  extractedRule TEXT,
  learningTrace TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (apprenticeId) REFERENCES Apprentice(id),
  FOREIGN KEY (taskId) REFERENCES Task(id)
);

CREATE TABLE IF NOT EXISTS VisualDemonstration (
  id TEXT PRIMARY KEY,
  apprenticeId TEXT NOT NULL,
  taskId TEXT NOT NULL,
  title TEXT NOT NULL,
  artifact TEXT NOT NULL,
  teacherNotes TEXT NOT NULL,
  extractedRule TEXT,
  learningTrace TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (apprenticeId) REFERENCES Apprentice(id),
  FOREIGN KEY (taskId) REFERENCES Task(id)
);

CREATE TABLE IF NOT EXISTS ExecutionRun (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  apprenticeId TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  status TEXT NOT NULL,
  trace TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (taskId) REFERENCES Task(id),
  FOREIGN KEY (apprenticeId) REFERENCES Apprentice(id)
);

CREATE TABLE IF NOT EXISTS TraceStep (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL,
  nodeId TEXT NOT NULL,
  stepName TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  appliedRules TEXT NOT NULL,
  confidence REAL NOT NULL,
  needsHumanReview INTEGER NOT NULL,
  validation TEXT NOT NULL,
  uncertainty TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (runId) REFERENCES ExecutionRun(id)
);
`);

try {
  run(`ALTER TABLE TraceStep ADD COLUMN validation TEXT NOT NULL DEFAULT ''`);
} catch {
  // Existing local databases may already have this column.
}

try {
  run(`ALTER TABLE TraceStep ADD COLUMN uncertainty TEXT NOT NULL DEFAULT '[]'`);
} catch {
  // Existing local databases may already have this column.
}

for (const statement of [
  `ALTER TABLE Correction ADD COLUMN learningTrace TEXT`,
  `ALTER TABLE TeachingExample ADD COLUMN learningTrace TEXT`,
  `ALTER TABLE VisualDemonstration ADD COLUMN learningTrace TEXT`
]) {
  try {
    run(statement);
  } catch {
    // Existing local databases may already have this column.
  }
}

db.exec(`
DELETE FROM TraceStep;
DELETE FROM Correction;
DELETE FROM ExecutionRun;
DELETE FROM TeachingExample;
DELETE FROM VisualDemonstration;
DELETE FROM Rule;
DELETE FROM WorkflowNode;
DELETE FROM Workflow;
DELETE FROM Task;
DELETE FROM Apprentice;
DELETE FROM User;
`);

const now = new Date().toISOString();
const seededPreLearningRun = {
  ...executePhotographyJournalTask(demoTask.inputExample, [], {
    taskId: demoTask.id,
    apprenticeId: demoApprentice.id
  }),
  id: "run-demo-before-teaching",
  createdAt: "2026-06-01T09:04:00.000Z"
};
const seededDemoRun = {
  ...executePhotographyJournalTask(demoTask.inputExample, demoRules, {
    taskId: demoTask.id,
    apprenticeId: demoApprentice.id
  }),
  id: "run-demo-golden-hour",
  createdAt: "2026-06-01T09:10:00.000Z"
};
const seededHistoryRule = {
  ...extractRuleFromExecutionHistory({
    runId: seededDemoRun.id,
    apprenticeId: seededDemoRun.apprenticeId,
    taskId: seededDemoRun.taskId,
    input: seededDemoRun.input,
    output: seededDemoRun.output,
    trace: seededDemoRun.trace
  }),
  createdAt: "2026-06-01T09:12:00.000Z"
};

run(
  `INSERT OR REPLACE INTO User (id, name, email, createdAt)
   VALUES ($id, $name, $email, $createdAt)`,
  { $id: "user-demo-teacher", $name: "Demo Teacher", $email: "teacher@example.com", $createdAt: now }
);

run(
  `INSERT OR REPLACE INTO Apprentice (id, userId, name, description, domain, createdAt, updatedAt)
   VALUES ($id, $userId, $name, $description, $domain, $createdAt, $updatedAt)`,
  {
    $id: demoApprentice.id,
    $userId: "user-demo-teacher",
    $name: demoApprentice.name,
    $description: demoApprentice.description,
    $domain: demoApprentice.domain,
    $createdAt: now,
    $updatedAt: now
  }
);

run(
  `INSERT OR REPLACE INTO Task (id, apprenticeId, name, goal, inputSchema, expectedOutput, status, createdAt, updatedAt)
   VALUES ($id, $apprenticeId, $name, $goal, $inputSchema, $expectedOutput, $status, $createdAt, $updatedAt)`,
  {
    $id: demoTask.id,
    $apprenticeId: demoApprentice.id,
    $name: demoTask.name,
    $goal: demoTask.goal,
    $inputSchema: json(demoTask.inputSchema),
    $expectedOutput: json(demoTask.expectedOutput),
    $status: demoTask.status,
    $createdAt: now,
    $updatedAt: now
  }
);

run(
  `INSERT OR REPLACE INTO Workflow (id, taskId, name, version, nodes, edges, createdAt, updatedAt)
   VALUES ($id, $taskId, $name, $version, $nodes, $edges, $createdAt, $updatedAt)`,
  {
    $id: demoWorkflow.id,
    $taskId: demoTask.id,
    $name: demoWorkflow.name,
    $version: demoWorkflow.version,
    $nodes: json(demoWorkflow.nodes),
    $edges: json(demoWorkflow.edges),
    $createdAt: now,
    $updatedAt: now
  }
);

for (const node of demoWorkflow.nodes) {
  run(
    `INSERT OR REPLACE INTO WorkflowNode
     (id, workflowId, type, label, description, inputFields, outputFields, validationRules, fallbackBehavior)
     VALUES ($id, $workflowId, $type, $label, $description, $inputFields, $outputFields, $validationRules, $fallbackBehavior)`,
    {
      $id: node.id,
      $workflowId: demoWorkflow.id,
      $type: node.type,
      $label: node.label,
      $description: node.description,
      $inputFields: json(node.inputFields),
      $outputFields: json(node.outputFields),
      $validationRules: json(node.validationRules),
      $fallbackBehavior: node.fallbackBehavior
    }
  );
}

for (const rule of demoRules) {
  run(
    `INSERT OR REPLACE INTO Rule
     (id, apprenticeId, taskId, title, condition, action, source, confidence, enabled, createdAt)
     VALUES ($id, $apprenticeId, $taskId, $title, $condition, $action, $source, $confidence, $enabled, $createdAt)`,
    {
      $id: rule.id,
      $apprenticeId: rule.apprenticeId,
      $taskId: rule.taskId,
      $title: rule.title,
      $condition: rule.condition,
      $action: rule.action,
      $source: rule.source,
      $confidence: rule.confidence,
      $enabled: rule.enabled ? 1 : 0,
      $createdAt: rule.createdAt
    }
  );
}

run(
  `INSERT OR REPLACE INTO Rule
   (id, apprenticeId, taskId, title, condition, action, source, confidence, enabled, createdAt)
   VALUES ($id, $apprenticeId, $taskId, $title, $condition, $action, $source, $confidence, $enabled, $createdAt)`,
  {
    $id: seededHistoryRule.id,
    $apprenticeId: seededHistoryRule.apprenticeId,
    $taskId: seededHistoryRule.taskId,
    $title: seededHistoryRule.title,
    $condition: seededHistoryRule.condition,
    $action: seededHistoryRule.action,
    $source: seededHistoryRule.source,
    $confidence: seededHistoryRule.confidence,
    $enabled: seededHistoryRule.enabled ? 1 : 0,
    $createdAt: seededHistoryRule.createdAt
  }
);

for (const runRecord of [seededPreLearningRun, seededDemoRun]) {
  run(
    `INSERT OR REPLACE INTO ExecutionRun
     (id, taskId, apprenticeId, input, output, status, trace, createdAt)
     VALUES ($id, $taskId, $apprenticeId, $input, $output, $status, $trace, $createdAt)`,
    {
      $id: runRecord.id,
      $taskId: runRecord.taskId,
      $apprenticeId: runRecord.apprenticeId,
      $input: json({ rawTravelNote: runRecord.input }),
      $output: json(runRecord.output),
      $status: runRecord.status,
      $trace: json(runRecord.trace),
      $createdAt: runRecord.createdAt
    }
  );

  for (const step of runRecord.trace) {
    run(
      `INSERT OR REPLACE INTO TraceStep
       (id, runId, nodeId, stepName, input, output, appliedRules, confidence, needsHumanReview, validation, uncertainty, createdAt)
       VALUES ($id, $runId, $nodeId, $stepName, $input, $output, $appliedRules, $confidence, $needsHumanReview, $validation, $uncertainty, $createdAt)`,
      {
        $id: `${runRecord.id}-${step.id}`,
        $runId: runRecord.id,
        $nodeId: step.nodeId,
        $stepName: step.stepName,
        $input: json(step.input),
        $output: json(step.output),
        $appliedRules: json(step.appliedRules),
        $confidence: step.confidence,
        $needsHumanReview: step.needsHumanReview ? 1 : 0,
        $validation: step.validation,
        $uncertainty: json(step.uncertainty),
        $createdAt: runRecord.createdAt
      }
    );
  }
}

for (const correction of recentCorrections) {
  run(
    `INSERT OR REPLACE INTO Correction
     (id, apprenticeId, taskId, runId, userFeedback, errorType, extractedRule, beforeOutput, afterOutput, learningTrace, createdAt)
     VALUES ($id, $apprenticeId, $taskId, $runId, $userFeedback, $errorType, $extractedRule, $beforeOutput, $afterOutput, $learningTrace, $createdAt)`,
    {
      $id: correction.id,
      $apprenticeId: demoApprentice.id,
      $taskId: demoTask.id,
      $runId: seededPreLearningRun.id,
      $userFeedback: correction.feedback,
      $errorType: "lighting_condition_rule",
      $extractedRule: json(correction.extractedRule),
      $beforeOutput: json(seededPreLearningRun.output),
      $afterOutput: json(seededDemoRun.output),
      $learningTrace: json([
        {
          id: "learn-read-signal",
          label: "Read teacher signal",
          evidence: correction.feedback,
          confidence: 0.88,
          validation: "Teacher signal captured from correction.",
          needsHumanReview: false
        },
        {
          id: "learn-extract-rule",
          label: "Extract reusable rule",
          evidence: correction.extractedRule.title,
          confidence: correction.extractedRule.confidence,
          validation: "Reusable condition and action were separated from the source evidence.",
          needsHumanReview: false
        },
        {
          id: "learn-policy-check",
          label: "Apply memory policy",
          evidence: "Rule can run automatically.",
          confidence: 0.9,
          validation: "Memory can be applied to matching future runs.",
          needsHumanReview: false
        }
      ]),
      $createdAt: correction.createdAt
    }
  );
}

for (const example of demoTeachingExamples) {
  run(
    `INSERT OR REPLACE INTO TeachingExample
     (id, apprenticeId, taskId, input, expectedOutput, extractedRule, learningTrace, createdAt)
     VALUES ($id, $apprenticeId, $taskId, $input, $expectedOutput, $extractedRule, $learningTrace, $createdAt)`,
    {
      $id: example.id,
      $apprenticeId: example.apprenticeId,
      $taskId: example.taskId,
      $input: example.input,
      $expectedOutput: json(example.expectedOutput),
      $extractedRule: example.extractedRule ? json(example.extractedRule) : null,
      $learningTrace: example.learningTrace ? json(example.learningTrace) : null,
      $createdAt: example.createdAt
    }
  );
}

for (const demo of demoVisualDemonstrations) {
  run(
    `INSERT OR REPLACE INTO VisualDemonstration
     (id, apprenticeId, taskId, title, artifact, teacherNotes, extractedRule, learningTrace, createdAt)
     VALUES ($id, $apprenticeId, $taskId, $title, $artifact, $teacherNotes, $extractedRule, $learningTrace, $createdAt)`,
    {
      $id: demo.id,
      $apprenticeId: demo.apprenticeId,
      $taskId: demo.taskId,
      $title: demo.title,
      $artifact: json(demo.artifact),
      $teacherNotes: demo.teacherNotes,
      $extractedRule: demo.extractedRule ? json(demo.extractedRule) : null,
      $learningTrace: demo.learningTrace ? json(demo.learningTrace) : null,
      $createdAt: demo.createdAt
    }
  );
}

db.close();
console.log(`Demo SQLite database ready at ${dbPath}`);
