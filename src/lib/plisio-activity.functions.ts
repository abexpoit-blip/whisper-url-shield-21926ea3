import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListSchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  event_type: z.enum(["all", "invoice_create", "webhook_received"]).optional().default("all"),
  outcome: z.string().trim().max(40).optional().default("all"),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

export const listPlisioActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;

    // Admin gate
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    let q = (supabaseAdmin as any)
      .from("plisio_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.event_type !== "all") q = q.eq("event_type", data.event_type);
    if (data.outcome && data.outcome !== "all") q = q.eq("outcome", data.outcome);

    if (data.search) {
      const s = data.search.replace(/[%,()]/g, "");
      q = q.or(
        `request_id.ilike.%${s}%,correlation_id.ilike.%${s}%,txn_id.ilike.%${s}%,order_number.ilike.%${s}%,message.ilike.%${s}%,plisio_status.ilike.%${s}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });
