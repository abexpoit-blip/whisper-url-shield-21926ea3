import { existsSync, readFileSync } from "node:fs";

const REQUIRED_REF = "qnzwncleajzzwpauifnp";
const REQUIRED_URL = `https://${REQUIRED_REF}.supabase.co`;

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

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function inspectKey(name, value) {
  if (!value) return `${name} is missing`;
  const parts = value.split(".");
  if (parts.length !== 3) return `${name} is not a JWT-style publishable/anon key`;

  try {
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    if (header.alg !== "HS256") return `${name} alg must be HS256, got ${header.alg ?? "unknown"}`;
    if (payload.iss !== "supabase") return `${name} issuer must be "supabase", got ${payload.iss ?? "unknown"}`;
    if (payload.ref !== REQUIRED_REF) return `${name} project ref must be ${REQUIRED_REF}, got ${payload.ref ?? "unknown"}`;
    if (payload.role !== "anon") return `${name} role must be anon, got ${payload.role ?? "unknown"}`;
  } catch (error) {
    return `${name} could not be decoded: ${error instanceof Error ? error.message : String(error)}`;
  }

  return null;
}

const dotEnv = parseDotEnv();
const env = { ...dotEnv, ...process.env };
const errors = [];

for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
  if (env[name] !== REQUIRED_URL) errors.push(`${name} must be ${REQUIRED_URL}, got ${env[name] || "missing"}`);
}

for (const name of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  const error = inspectKey(name, env[name]);
  if (error) errors.push(error);
}

if (env.SUPABASE_PUBLISHABLE_KEY !== env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  errors.push("SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY must be identical");
}

if (env.VITE_SUPABASE_PROJECT_ID !== REQUIRED_REF) {
  errors.push(`VITE_SUPABASE_PROJECT_ID must be ${REQUIRED_REF}, got ${env.VITE_SUPABASE_PROJECT_ID || "missing"}`);
}

if (errors.length) {
  console.error("Environment verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Environment verification passed.");