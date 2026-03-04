import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function computeStatusNextStep(dueDateIso, statusFinalOutcome) {
  if (!dueDateIso) return "No due date";
  if (statusFinalOutcome === "Done") return "Done";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, month, day] = String(dueDateIso).split("-").map(Number);
  const due = new Date(year, (month || 1) - 1, day || 1);

  const msPerDay = 24 * 60 * 60 * 1000;
  const deltaDays = Math.floor((due.getTime() - today.getTime()) / msPerDay);

  if (deltaDays < 0) return "Too late";
  if (deltaDays === 0) return "Late";
  if (deltaDays <= 1) return "Really near to expire";
  if (deltaDays <= 3) return "Near to expire";
  if (deltaDays <= 7) return "On track";
  return "Safe";
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const baseUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
if (!baseUrl) {
  console.error("Missing NEXT_PUBLIC_APPS_SCRIPT_URL in .env.local");
  process.exit(1);
}

const dbPath = process.env.TASK_DB_PATH || "./data/tasks.db";
const resolvedDbPath = path.resolve(root, dbPath);
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new DatabaseSync(resolvedDbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    google_sub TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_do TEXT NOT NULL,
    status_final_outcome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    next_step TEXT NOT NULL DEFAULT '',
    due_date_next_step TEXT NOT NULL,
    status_next_step TEXT NOT NULL DEFAULT '',
    user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

const ownerEmail = String(process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu")
  .trim()
  .toLowerCase();
const ownerName = String(process.env.DEFAULT_OWNER_NAME || "Santiago Labarca").trim();

const existingOwner = db
  .prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`)
  .get(ownerEmail);

let ownerUserId;
if (existingOwner?.id) {
  ownerUserId = Number(existingOwner.id);
} else {
  const ownerResult = db
    .prepare(
      `INSERT INTO users (email, name, updated_at)
       VALUES (?, ?, datetime('now'))`
    )
    .run(ownerEmail, ownerName);
  ownerUserId = Number(ownerResult.lastInsertRowid);
}

const listUrl = new URL(baseUrl);
listUrl.searchParams.set("action", "list");

const res = await fetch(listUrl.toString());
if (!res.ok) {
  console.error(`Failed to fetch source tasks: ${res.status}`);
  process.exit(1);
}

const data = await res.json();
const sourceTasks = Array.isArray(data.tasks) ? data.tasks : [];

db.exec("BEGIN");
try {
  db.exec("DELETE FROM tasks");

  const insertStmt = db.prepare(
    `INSERT INTO tasks (to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, user_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  for (const task of sourceTasks) {
    const toDo = String(task.toDo || "").trim();
    const statusFinalOutcome = String(task.statusFinalOutcome || "To-do").trim();
    const tipo = String(task.tipo || "Otros").trim();
    const nextStep = String(task.nextStep || "").trim();
    const dueDateNextStep = String(task.dueDateNextStep || "").trim();
    const statusNextStep =
      String(task.statusNextStep || "").trim() ||
      computeStatusNextStep(dueDateNextStep, statusFinalOutcome);

    insertStmt.run(
      toDo,
      statusFinalOutcome,
      tipo,
      nextStep,
      dueDateNextStep,
      statusNextStep,
      ownerUserId
    );
  }

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

console.log(`Migrated ${sourceTasks.length} tasks into local SQLite DB.`);
