import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";

const DomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(253)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
});

const IdSchema = z.object({ id: z.string().uuid() });

type DomainStatus =
  | "action_required"
  | "verifying"
  | "setting_up"
  | "ready"
  | "active"
  | "offline"
  | "failed";

type CustomDomain = {
  id: string;
  domain: string;
  status: DomainStatus;
  verification_token: string;
  dns_target: string;
  is_primary: boolean;
  last_checked_at: string | null;
  verified_at: string | null;
  created_at: string;
};

async function doh(type: "A" | "TXT", name: string) {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    {
      headers: { accept: "application/dns-json" },
    },
  );
  if (!res.ok) return [] as string[];
  const json = (await res.json()) as { Answer?: { data: string }[] };
  return (json.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
}

export const listCustomDomains = createServerFn({ method: "GET" })
  .middleware([requireSelfHostedAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("custom_domains")
      .select(
        "id,domain,status,verification_token,dns_target,is_primary,last_checked_at,verified_at,created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomDomain[];
  });

export const addCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input: unknown) => DomainSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any).from("custom_domains").insert({
      user_id: userId,
      domain: data.domain.replace(/^www\./, ""),
      status: "action_required",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input: unknown) => IdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await (supabase as any)
      .from("custom_domains")
      .select("id,domain,verification_token,dns_target")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Domain not found");

    const [rootA, wwwA, txt] = await Promise.all([
      doh("A", row.domain),
      doh("A", `www.${row.domain}`),
      doh("TXT", `_lovable.${row.domain}`),
    ]);

    const rootOk = rootA.includes(row.dns_target);
    const wwwOk = wwwA.includes(row.dns_target);
    const txtOk = txt.some((v) => v.includes(row.verification_token));
    const status: DomainStatus =
      rootOk && wwwOk && txtOk
        ? "ready"
        : rootOk || wwwOk || txtOk
          ? "verifying"
          : "action_required";

    const { error: updateError } = await (supabase as any)
      .from("custom_domains")
      .update({
        status,
        last_checked_at: new Date().toISOString(),
        verified_at: status === "ready" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
    return { status, checks: { rootA: rootOk, wwwA: wwwOk, txt: txtOk } };
  });

export const deleteCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input: unknown) => IdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any).from("custom_domains").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
