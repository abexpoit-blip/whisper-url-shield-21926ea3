import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DomainRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const IpRe = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const CreateSchema = z.object({
  domain: z.string().trim().toLowerCase().min(4).max(253).regex(DomainRe),
  ip_address: z.string().trim().min(7).max(45).regex(IpRe),
  label: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  ip_address: z.string().trim().min(7).max(45).regex(IpRe).optional(),
  label: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

const IdSchema = z.object({ id: z.string().uuid() });

export type SharedDomain = {
  id: string;
  domain: string;
  ip_address: string;
  label: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const listSharedDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("shared_domains")
      .select("id,domain,ip_address,label,notes,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SharedDomain[];
  });

export const addSharedDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any).from("shared_domains").insert({
      domain: data.domain.replace(/^www\./, ""),
      ip_address: data.ip_address,
      label: data.label ?? null,
      notes: data.notes ?? null,
      added_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSharedDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await (supabase as any)
      .from("shared_domains")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSharedDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any)
      .from("shared_domains")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
