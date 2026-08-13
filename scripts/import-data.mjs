import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run data:import -- path/to/export.json");
  process.exit(1);
}
await access(file);
const result = spawnSync(process.execPath, ["prisma/seed-json-to-prisma.mjs"], {
  stdio: "inherit",
  env: { ...process.env, SEED_SOURCE_FILE: file }
});
process.exit(result.status ?? 1);
