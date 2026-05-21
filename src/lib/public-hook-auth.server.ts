import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function requirePublicHookSecret(request: Request) {
  const expected = process.env.PUBLIC_HOOK_SECRET?.trim();
  if (!expected) {
    return new Response(JSON.stringify({ error: "PUBLIC_HOOK_SECRET missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headerToken = request.headers.get("x-hook-secret") ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = request.headers.get("apikey") ?? "";
  const provided = headerToken || bearerToken || apiKey;

  if (!provided || !safeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}