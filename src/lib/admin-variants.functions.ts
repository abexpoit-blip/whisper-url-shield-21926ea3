import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditAdminGate } from "./admin-audit.server";
import { z } from "zod";

async function assertAdmin(userId: string, action: string, metadata?: Record<string, unknown>) {
  await auditAdminGate({ userId, action, metadata });
}

const SectionSchema = z.object({
  heading: z.string().min(1).max(300),
  body: z.string().min(1).max(4000),
});

const VariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, "lowercase letters/numbers/_-"),
  category: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  subtitle: z.string().max(300).default(""),
  intro: z.string().max(4000).default(""),
  sections: z.array(SectionSchema).max(50).default([]),
  outro: z.string().max(4000).default(""),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(10000).default(0),
});

// ----- isAdmin (quick check for client gating) -----

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

// ----- Variants: list/upsert/delete -----

export const listVariantsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, "variants.list");

    const { data: variants } = await supabaseAdmin
      .from("prelander_variants")
      .select("*")
      .order("sort_order", { ascending: true });

    // Aggregate global stats per variant (verify rows only).
    const { data: rows } = await supabaseAdmin
      .from("clicks")
      .select("variant,is_bot")
      .like("bot_reason", "verify:%")
      .not("variant", "is", null)
      .limit(50000);

    const stats = new Map<string, { total: number; humans: number }>();
    for (const r of rows ?? []) {
      const slug = r.variant as string;
      const e = stats.get(slug) ?? { total: 0, humans: 0 };
      e.total += 1;
      if (!r.is_bot) e.humans += 1;
      stats.set(slug, e);
    }

    return {
      variants: (variants ?? []).map((v) => ({
        ...v,
        stats: stats.get(v.slug) ?? { total: 0, humans: 0 },
      })),
    };
  });

export const upsertVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VariantInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "variants.upsert", { slug: data.slug, id: data.id ?? null });

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("prelander_variants")
        .update({
          slug: data.slug, category: data.category, title: data.title,
          subtitle: data.subtitle, intro: data.intro,
          sections: data.sections, outro: data.outro,
          is_active: data.is_active, sort_order: data.sort_order,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("prelander_variants")
      .insert({
        slug: data.slug, category: data.category, title: data.title,
        subtitle: data.subtitle, intro: data.intro,
        sections: data.sections, outro: data.outro,
        is_active: data.is_active, sort_order: data.sort_order,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted.id };
  });

export const deleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "variants.delete", { id: data.id });
    const { error } = await supabaseAdmin
      .from("prelander_variants")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ----- Per-link overrides -----

export const listLinksWithOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(200).default("") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "links.overrides.list", { search: data.search });

    let q = supabaseAdmin
      .from("links")
      .select("id,short_code,destination_url,title,clicks_count,bot_clicks_count")
      .order("created_at", { ascending: false })
      .limit(200);

    const search = data.search.trim();
    if (search) {
      q = q.or(
        `short_code.ilike.%${search}%,destination_url.ilike.%${search}%,title.ilike.%${search}%`,
      );
    }

    const { data: links } = await q;
    const ids = (links ?? []).map((l) => l.id);

    let overrides: Record<string, string> = {};
    if (ids.length) {
      const { data: ovs } = await supabaseAdmin
        .from("link_variant_overrides")
        .select("link_id,variant_slug")
        .in("link_id", ids);
      for (const o of ovs ?? []) overrides[o.link_id] = o.variant_slug;
    }

    return {
      links: (links ?? []).map((l) => {
        let domain = l.destination_url;
        try { domain = new URL(l.destination_url).hostname; } catch { /* noop */ }
        return { ...l, domain, override_variant: overrides[l.id] ?? null };
      }),
    };
  });

export const setLinkOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      link_id: z.string().uuid(),
      variant_slug: z.string().min(1).max(64),
      note: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "links.override.set", { link_id: data.link_id, variant_slug: data.variant_slug });
    const { error } = await supabaseAdmin
      .from("link_variant_overrides")
      .upsert({
        link_id: data.link_id,
        variant_slug: data.variant_slug,
        note: data.note ?? null,
        created_by: context.userId,
      }, { onConflict: "link_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const clearLinkOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ link_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, "links.override.clear", { link_id: data.link_id });
    const { error } = await supabaseAdmin
      .from("link_variant_overrides")
      .delete()
      .eq("link_id", data.link_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
