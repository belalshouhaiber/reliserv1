import { execSync } from "child_process";
import path from "path";
import { config } from "dotenv";
import { Client } from "pg";

const appDir = __dirname;
const envPath = path.resolve(appDir, ".env.test");
const maxWaitMs = 20000;
const retryDelayMs = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase(databaseUrl: string) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < maxWaitMs) {
    const client = new Client({ connectionString: databaseUrl });

    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await sleep(retryDelayMs);
    }
  }

  const details = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    [
      `Test database is unreachable after ${maxWaitMs / 1000}s.`,
      "Start Postgres before running Jest:",
      "docker compose -f infra/docker-compose.yml up -d",
      `DATABASE_URL=${databaseUrl}`,
      `Last connection error: ${details}`,
    ].join("\n"),
  );
}

export default async function globalSetup() {
  config({ path: envPath });
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is missing in ${envPath}`);
  }

  await waitForDatabase(databaseUrl);

  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    cwd: appDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DOTENV_CONFIG_PATH: ".env.test",
      dotenv_config_path: ".env.test",
    },
    stdio: "inherit",
  });
}
