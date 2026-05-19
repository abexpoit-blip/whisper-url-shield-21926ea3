import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserCog, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exitImpersonation, isImpersonating, readImpersonation } from "@/lib/impersonation";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [admin, setAdmin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const on = isImpersonating();
      setActive(on);
      if (on) {
        const s = readImpersonation();
        setTarget(s?.targetEmail ?? null);
        setAdmin(s?.adminEmail ?? null);
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const handleExit = async () => {
    setBusy(true);
    try {
      await exitImpersonation();
      toast.success("Returned to admin account");
      setActive(false);
      navigate({ to: "/admin/users" });
      // Hard reload to clear any cached user-scoped data
      setTimeout(() => window.location.reload(), 100);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!active) return null;

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 px-4 py-2 text-sm backdrop-blur">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
        <UserCog className="h-4 w-4" />
        <span>
          Viewing as <strong>{target ?? "user"}</strong>
          {admin ? <> · admin: {admin}</> : null}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={handleExit} disabled={busy}
        className="h-7 gap-1.5 border-amber-500/50 bg-background/60 text-xs">
        <LogOut className="h-3.5 w-3.5" /> Exit to admin
      </Button>
    </div>
  );
}
