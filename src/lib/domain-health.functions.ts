import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

// Run a single domain check (DNS via Cloudflare DoH + HTTP probe to https://<domain>/)
async function probeDomain(domain: string, expectedTarget: string): Promise<{
  dns_ok: boolean; http_ok: boolean; http_status: number | null; observed: string | null; error: string | null;
}> {
  let dns_ok = false;
  let observed: string | null = null;
  let error: string | null = null;
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { accept: "application/dns-json" },
    });
    const j = await r.json() as { Answer?: Array<{ data: string; type: number }> };
    const ips = (j.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data);
    observed = ips.join(",") || null;
    if (expectedTarget) {
      dns_ok = ips.includes(expectedTarget);
    } else {
      dns_ok = ips.length > 0;
    }
  } catch (e) {
    error = `dns:${e instanceof Error ? e.message : String(e)}`;
  }

  let http_ok = false;
  let http_status: number | null = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`https://${domain}/`, { method: "HEAD", redirect: "manual", signal: ctl.signal });
    clearTimeout(t);
    http_status = res.status;
    http_ok = res.status > 0 && res.status < 500;
  } catch (e) {
    error = (error ? error + "|" : "") + `http:${e instanceof Error ? e.message : String(e)}`;
  }

  return { dns_ok, http_ok, http_status, observed, error };
}

export const runDomainHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ domainId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    let q = supabaseAdmin.from("custom_domains").select("id,domain,dns_target,user_id");
    if (data.domainId) q = q.eq("id", data.domainId);
    if (!admin) q = q.eq("user_id", context.userId);
    const { data: domains, error } = await q;
    if (error) throw new Error(error.message);

    let checked = 0;
    for (const d of domains ?? []) {
      const res = await probeDomain(d.domain, d.dns_target);
      await supabaseAdmin.from("domain_health_checks").insert({
        domain_id: d.id,
        dns_ok: res.dns_ok,
        http_ok: res.http_ok,
        http_status: res.http_status,
        dns_target_observed: res.observed,
        error: res.error,
      });
      await supabaseAdmin.from("custom_domains").update({
        last_checked_at: new Date().toISOString(),
        status: res.dns_ok && res.http_ok ? "verified" : "action_required",
      }).eq("id", d.id);
      checked += 1;
    }
    return { ok: true, checked };
  });

export const listDomainHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.userId);
    let q = supabaseAdmin
      .from("custom_domains")
      .select("id,domain,dns_target,status,last_checked_at,user_id,is_primary");
    if (!admin) q = q.eq("user_id", context.userId);
    const { data: domains, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!domains?.length) return { rows: [], admin };

    const ids = domains.map((d) => d.id);
    const { data: checks } = await supabaseAdmin
      .from("domain_health_checks")
      .select("domain_id,dns_ok,http_ok,http_status,dns_target_observed,error,checked_at")
      .in("domain_id", ids)
      .order("checked_at", { ascending: false })
      .limit(500);

    const latest = new Map<string, any>();
    for (const c of checks ?? []) {
      if (!latest.has(c.domain_id)) latest.set(c.domain_id, c);
    }

    return {
      admin,
      rows: domains.map((d) => ({ ...d, latest: latest.get(d.id) ?? null })),
    };
  });

// Used by cron hook (no auth)
export async function runAllDomainHealthChecks() {
  const { data: domains } = await supabaseAdmin
    .from("custom_domains").select("id,domain,dns_target");
  let checked = 0;
  for (const d of domains ?? []) {
    const res = await probeDomain(d.domain, d.dns_target);
    await supabaseAdmin.from("domain_health_checks").insert({
      domain_id: d.id,
      dns_ok: res.dns_ok, http_ok: res.http_ok, http_status: res.http_status,
      dns_target_observed: res.observed, error: res.error,
    });
    await supabaseAdmin.from("custom_domains").update({
      last_checked_at: new Date().toISOString(),
      status: res.dns_ok && res.http_ok ? "verified" : "action_required",
    }).eq("id", d.id);
    checked += 1;
  }
  return checked;
}
