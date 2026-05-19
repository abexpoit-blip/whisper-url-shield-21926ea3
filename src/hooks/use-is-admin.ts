import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getIsAdmin } from "@/lib/admin-stats.functions";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_CACHE_KEY = "linkshield:is-admin";
const ADMIN_CACHE_TTL_MS = 5 * 60_000;
let memoryCache: { userId: string; value: boolean; at: number } | null = null;

function readCached(userId: string) {
  if (memoryCache?.userId === userId && Date.now() - memoryCache.at < ADMIN_CACHE_TTL_MS) return memoryCache.value;
  try {
    const raw = sessionStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { userId: string; value: boolean; at: number };
    if (cached.userId !== userId || Date.now() - cached.at > ADMIN_CACHE_TTL_MS) return null;
    memoryCache = cached;
    return cached.value;
  } catch {
    return null;
  }
}

function writeCached(userId: string, value: boolean) {
  memoryCache = { userId, value, at: Date.now() };
  try { sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(memoryCache)); } catch { /* ignore */ }
}

export function useIsAdmin(initialValue: boolean | null = null) {
  const fn = useServerFn(getIsAdmin);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(initialValue);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const cached = readCached(data.session.user.id);
      if (cached !== null) {
        if (mounted) setIsAdmin(cached);
        return;
      }
      try {
        const r = await fn();
        writeCached(data.session.user.id, r.isAdmin);
        if (mounted) setIsAdmin(r.isAdmin);
      } catch {
        if (mounted) setIsAdmin(false);
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [fn]);

  return isAdmin;
}
