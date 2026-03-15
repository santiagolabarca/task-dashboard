import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

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

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

const baseUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
if (!baseUrl) {
  console.error("Missing NEXT_PUBLIC_APPS_SCRIPT_URL in .env.local");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
});

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      google_sub TEXT UNIQUE,
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      tipo_options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`
  );
  await pool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS tipo_options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      to_do TEXT NOT NULL,
      status_final_outcome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      next_step TEXT NOT NULL DEFAULT '',
      due_date_next_step DATE NOT NULL,
      status_next_step TEXT NOT NULL DEFAULT '',
      recurrence_interval INTEGER,
      recurrence_unit TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `ALTER TABLE tasks
     ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER`
  );
  await pool.query(
    `ALTER TABLE tasks
     ADD COLUMN IF NOT EXISTS recurrence_unit TEXT`
  );

  const ownerEmail = String(process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu")
    .trim()
    .toLowerCase();
  const ownerName = String(process.env.DEFAULT_OWNER_NAME || "Santiago Labarca").trim();

  const ownerResult = await pool.query(
    `INSERT INTO users (email, name)
     VALUES ($1, $2)
     ON CONFLICT (email)
     DO UPDATE SET
       name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
       onboarding_completed = TRUE,
       updated_at = NOW()
     RETURNING id`,
    [ownerEmail, ownerName]
  );

  const ownerUserId = Number(ownerResult.rows[0].id);

  const listUrl = new URL(baseUrl);
  listUrl.searchParams.set("action", "list");

  const res = await fetch(listUrl.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch source tasks: ${res.status}`);
  }

  const data = await res.json();
  const sourceTasks = Array.isArray(data.tasks) ? data.tasks : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM tasks WHERE user_id = $1`, [ownerUserId]);

    for (const task of sourceTasks) {
      const toDo = String(task.toDo || "").trim();
      const statusFinalOutcome = String(task.statusFinalOutcome || "To-do").trim();
      const tipo = String(task.tipo || "Otros").trim();
      const nextStep = String(task.nextStep || "").trim();
      const dueDateNextStep = String(task.dueDateNextStep || "").trim();
      const statusNextStep =
        String(task.statusNextStep || "").trim() ||
        computeStatusNextStep(dueDateNextStep, statusFinalOutcome);

      if (!toDo || !dueDateNextStep) continue;

      await client.query(
        `INSERT INTO tasks (user_id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, recurrence_interval, recurrence_unit, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, NULL, NULL, NOW())`,
        [
          ownerUserId,
          toDo,
          statusFinalOutcome,
          tipo,
          nextStep,
          dueDateNextStep,
          statusNextStep
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(`Migrated ${sourceTasks.length} tasks into Postgres.`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
