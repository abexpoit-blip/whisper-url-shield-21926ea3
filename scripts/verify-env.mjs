import { existsSync, readFileSync } from "node:fs";

function parseDotEnv(path = ".env") {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

const dotEnv = parseDotEnv();
const env = { ...dotEnv, ...process.env };
const errors = [];

for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
  const v = env[name];
  if (!v) errors.push(`${name} is missing`);
  else if (!/^https?:\/\//.test(v)) errors.push(`${name} must be an http(s) URL, got ${v}`);
}

if (env.SUPABASE_URL && env.VITE_SUPABASE_URL && env.SUPABASE_URL !== env.VITE_SUPABASE_URL) {
  errors.push("SUPABASE_URL and VITE_SUPABASE_URL must be identical");
}

for (const name of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!env[name]) errors.push(`${name} is missing`);
}

if (
  env.SUPABASE_PUBLISHABLE_KEY &&
  env.VITE_SUPABASE_PUBLISHABLE_KEY &&
  env.SUPABASE_PUBLISHABLE_KEY !== env.VITE_SUPABASE_PUBLISHABLE_KEY
) {
  errors.push("SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY must be identical");
}

if (errors.length) {
  console.error("Environment verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Environment verification passed.");
