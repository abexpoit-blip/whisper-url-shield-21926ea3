import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getIsAdmin } from "@/lib/admin-stats.functions";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const fn = useServerFn(getIsAdmin);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (mounted) setIsAdmin(false);
        return;
      }
      try {
        const r = await fn();
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
