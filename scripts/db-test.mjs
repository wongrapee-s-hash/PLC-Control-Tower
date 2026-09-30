import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

/**
 * Verify the Supabase layer against a real PostgreSQL server.
 *
 * `schema.sql` and `seed.sql` are written for Supabase, which is Postgres plus
 * an `auth` schema. This script stands up a throwaway Postgres 16 container,
 * applies a shim recreating the three things the schema needs from Supabase,
 * then runs the shim, schema, seed and RLS assertions in order. Any failure
 * aborts the run.
 *
 *   npm run db:test
 *
 * Needs a running Docker. The container is always removed afterwards.
 */

const CONTAINER = "pct-db-test";
const IMAGE = "postgres:16-alpine";
const PORT = 55433;

const STEP = "\u001b[36m";
const BAD = "\u001b[31m";
const GOOD = "\u001b[32m";
const OFF = "\u001b[0m";

/** Runs a command to completion, collecting its combined output. */
function exec(command, args, { report = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (out += c));
    child.on("error", (error) => resolve({ code: 1, out: error.message }));
    child.on("close", (code) => {
      if (report && code !== 0) process.stderr.write(out);
      resolve({ code, out });
    });
  });
}

/** Pipes a file from the host into psql inside the container. */
async function psqlFile(file) {
  let sql;
  try {
    sql = await readFile(file, "utf8");
  } catch (error) {
    return { code: 1, out: `Could not read ${file}: ${error.message}` };
  }

  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (out += c));
    child.on("error", (error) => resolve({ code: 1, out: error.message }));
    child.on("close", (code) => {
      if (code !== 0) process.stderr.write(out);
      resolve({ code, out });
    });
    child.stdin.end(sql);
  });
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { code, out } = await exec("docker", ["exec", CONTAINER, "pg_isready", "-U", "postgres"]);
    if (code === 0 && out.includes("accepting connections")) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

const STEPS = [
  ["supabase/tests/shim.sql", "applying the Supabase shim"],
  ["supabase/schema.sql", "applying the schema"],
  ["supabase/seed.sql", "loading the demo data"],
  ["supabase/tests/rls.sql", "checking the RLS policies"],
];

async function main() {
  const docker = await exec("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (docker.code !== 0) {
    process.stderr.write(`${BAD}Docker is not running. Start Docker Desktop and try again.${OFF}\n`);
    process.exit(1);
  }

  await exec("docker", ["rm", "-f", CONTAINER]);
  if ((await exec("docker", ["pull", "-q", IMAGE])).code !== 0) {
    process.stdout.write(`${STEP}Pulling ${IMAGE} for the first time...${OFF}\n`);
    await exec("docker", ["pull", IMAGE], { report: true });
  }

  const started = await exec("docker", [
    "run", "-d", "--name", CONTAINER,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-p", `${PORT}:5432`,
    IMAGE,
  ], { report: true });
  if (started.code !== 0) {
    process.stderr.write(`${BAD}Could not start the container.${OFF}\n`);
    process.exit(1);
  }

  let failed = false;
  try {
    if (!(await waitForPostgres())) throw new Error("Postgres did not become ready within 30s");

    for (const [file, label] of STEPS) {
      process.stdout.write(`${STEP}${label}${OFF}  ${file}\n`);
      const result = await psqlFile(file);
      if (result.code !== 0) {
        process.stderr.write(`${BAD}FAILED at ${file}${OFF}\n`);
        failed = true;
        break;
      }
    }

    if (!failed) process.stdout.write(`${GOOD}schema, seed and RLS checks all passed${OFF}\n`);
  } catch (error) {
    process.stderr.write(`${BAD}${error.message}${OFF}\n`);
    failed = true;
  } finally {
    await exec("docker", ["rm", "-f", CONTAINER]);
  }

  process.exit(failed ? 1 : 0);
}

await main();
