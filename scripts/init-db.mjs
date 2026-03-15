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

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

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
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);

  const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu")
    .trim()
    .toLowerCase();
  const ownerName = (process.env.DEFAULT_OWNER_NAME || "Santiago Labarca").trim();

  if (ownerEmail) {
    const owner = await pool.query(
      `INSERT INTO users (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email)
       DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name), updated_at = NOW()
       RETURNING id`,
      [ownerEmail, ownerName]
    );

    if (owner.rowCount) {
      await pool.query(`UPDATE tasks SET user_id = $1 WHERE user_id IS NULL`, [owner.rows[0].id]);
    }
  }

  console.log("Postgres DB initialized.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
