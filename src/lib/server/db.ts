import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbFilePath = process.env.TASK_DB_PATH || "./data/tasks.db";
const resolvedDbPath = path.resolve(process.cwd(), dbFilePath);

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
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id)
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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const taskColumns = db
  .prepare(`PRAGMA table_info(tasks)`)
  .all() as Array<{ name: string }>;

if (!taskColumns.some((column) => column.name === "user_id")) {
  db.exec(`ALTER TABLE tasks ADD COLUMN user_id INTEGER`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);

type TaskRow = {
  id: number;
  to_do: string;
  status_final_outcome: string;
  tipo: string;
  next_step: string;
  due_date_next_step: string;
  status_next_step: string;
  user_id: number;
};

type UserRow = {
  id: number;
  email: string;
  name: string;
  google_sub: string | null;
};

export type DbTask = {
  rowId: number;
  toDo: string;
  statusFinalOutcome: string;
  tipo: string;
  nextStep: string;
  dueDateNextStep: string;
  statusNextStep: string;
};

export type DbUser = {
  id: number;
  email: string;
  name: string;
};

function toTask(row: TaskRow): DbTask {
  return {
    rowId: row.id,
    toDo: row.to_do,
    statusFinalOutcome: row.status_final_outcome,
    tipo: row.tipo,
    nextStep: row.next_step,
    dueDateNextStep: row.due_date_next_step,
    statusNextStep: row.status_next_step
  };
}

function toUser(row: UserRow): DbUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name
  };
}

function toSqliteDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function ensureOwnerUserAndBackfill(): void {
  const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu").trim();
  const ownerName = process.env.DEFAULT_OWNER_NAME || "Santiago Labarca";
  if (!ownerEmail) return;

  const owner = findUserByEmail(ownerEmail) || createUser({ email: ownerEmail, name: ownerName });

  db.prepare(`UPDATE tasks SET user_id = ? WHERE user_id IS NULL`).run(owner.id);
}

ensureOwnerUserAndBackfill();

export function listDbTasksByUser(userId: number): DbTask[] {
  const rows = db
    .prepare(
      `SELECT id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, user_id
       FROM tasks
       WHERE user_id = ?
       ORDER BY due_date_next_step ASC, id ASC`
    )
    .all(userId) as TaskRow[];
  return rows.map(toTask);
}

export function createDbTaskForUser(userId: number, input: Omit<DbTask, "rowId">): number {
  const stmt = db.prepare(
    `INSERT INTO tasks (to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, user_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const result = stmt.run(
    input.toDo,
    input.statusFinalOutcome,
    input.tipo,
    input.nextStep,
    input.dueDateNextStep,
    input.statusNextStep,
    userId
  );
  return Number(result.lastInsertRowid);
}

export function getDbTaskByIdForUser(id: number, userId: number): DbTask | null {
  const row = db
    .prepare(
      `SELECT id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, user_id
       FROM tasks
       WHERE id = ? AND user_id = ?`
    )
    .get(id, userId) as TaskRow | undefined;
  if (!row) return null;
  return toTask(row);
}

export function updateDbTaskForUser(
  id: number,
  userId: number,
  patch: Partial<Omit<DbTask, "rowId">>
): boolean {
  const existing = getDbTaskByIdForUser(id, userId);
  if (!existing) return false;

  const next: Omit<DbTask, "rowId"> = {
    toDo: patch.toDo ?? existing.toDo,
    statusFinalOutcome: patch.statusFinalOutcome ?? existing.statusFinalOutcome,
    tipo: patch.tipo ?? existing.tipo,
    nextStep: patch.nextStep ?? existing.nextStep,
    dueDateNextStep: patch.dueDateNextStep ?? existing.dueDateNextStep,
    statusNextStep: patch.statusNextStep ?? existing.statusNextStep
  };

  db.prepare(
    `UPDATE tasks
     SET to_do = ?,
         status_final_outcome = ?,
         tipo = ?,
         next_step = ?,
         due_date_next_step = ?,
         status_next_step = ?,
         updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(
    next.toDo,
    next.statusFinalOutcome,
    next.tipo,
    next.nextStep,
    next.dueDateNextStep,
    next.statusNextStep,
    id,
    userId
  );

  return true;
}

export function replaceAllDbTasksForUser(userId: number, tasks: Array<Omit<DbTask, "rowId">>): void {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM tasks WHERE user_id = ?").run(userId);
    const insertStmt = db.prepare(
      `INSERT INTO tasks (to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );

    for (const task of tasks) {
      insertStmt.run(
        task.toDo,
        task.statusFinalOutcome,
        task.tipo,
        task.nextStep,
        task.dueDateNextStep,
        task.statusNextStep,
        userId
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function findUserByEmail(email: string): DbUser | null {
  const row = db
    .prepare(`SELECT id, email, name, google_sub FROM users WHERE lower(email) = lower(?)`)
    .get(email.trim()) as UserRow | undefined;
  if (!row) return null;
  return toUser(row);
}

export function getUserById(id: number): DbUser | null {
  const row = db
    .prepare(`SELECT id, email, name, google_sub FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
  if (!row) return null;
  return toUser(row);
}

export function createUser(input: { email: string; name?: string; googleSub?: string }): DbUser {
  const email = input.email.trim().toLowerCase();
  const name = (input.name || "").trim();
  const googleSub = input.googleSub?.trim() || null;

  const result = db
    .prepare(
      `INSERT INTO users (email, name, google_sub, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .run(email, name, googleSub);

  const id = Number(result.lastInsertRowid);
  const created = getUserById(id);
  if (!created) throw new Error("Failed to create user");
  return created;
}

export function upsertGoogleUser(input: { email: string; name?: string; googleSub: string }): DbUser {
  const email = input.email.trim().toLowerCase();
  const name = (input.name || "").trim();
  const googleSub = input.googleSub.trim();

  const byGoogleSub = db
    .prepare(`SELECT id, email, name, google_sub FROM users WHERE google_sub = ?`)
    .get(googleSub) as UserRow | undefined;

  if (byGoogleSub) {
    db.prepare(`UPDATE users SET email = ?, name = ?, updated_at = datetime('now') WHERE id = ?`).run(
      email,
      name,
      byGoogleSub.id
    );
    return toUser({ ...byGoogleSub, email, name, google_sub: googleSub });
  }

  const byEmail = db
    .prepare(`SELECT id, email, name, google_sub FROM users WHERE lower(email) = lower(?)`)
    .get(email) as UserRow | undefined;

  if (byEmail) {
    db.prepare(
      `UPDATE users SET google_sub = ?, name = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(googleSub, name || byEmail.name, byEmail.id);
    return toUser({
      ...byEmail,
      google_sub: googleSub,
      name: name || byEmail.name,
      email: byEmail.email
    });
  }

  return createUser({ email, name, googleSub });
}

export function createSession(userId: number, expiresAt: Date): string {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES (?, ?, ?)`
  ).run(token, userId, toSqliteDate(expiresAt));
  return token;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function getUserBySessionToken(token: string): DbUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.google_sub
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?
         AND datetime(s.expires_at) > datetime('now')`
    )
    .get(token) as UserRow | undefined;

  if (!row) return null;
  return toUser(row);
}

export function deleteExpiredSessions(): void {
  db.prepare(`DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')`).run();
}

export function initDb(): void {
  // Importing this module initializes DB + migrations.
}
