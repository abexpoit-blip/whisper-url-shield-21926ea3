import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/control-panel")({
  head: () => ({
    meta: [
      { title: "Restricted" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ControlPanelLogin,
});

function ControlPanelLogin() {
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If already signed in as admin, redirect; otherwise stay on this page silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      if (!cancelled) navigate({ to: "/admin" });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      setErr("Invalid credentials.");
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!data.session || userError || !userData.user) {
      setLoading(false);
      setErr("Login session was not ready. Please try again.");
      return;
    }

    await router.invalidate();
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight">Restricted Access</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Authorized personnel only.
          </p>
        </div>

        {err && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-email" className="text-xs">Identifier</Label>
            <Input
              id="cp-email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-pw" className="text-xs">Passphrase</Label>
            <Input
              id="cp-pw"
              type="password"
              autoComplete="off"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-10 gap-2">
            <ShieldCheck className="h-4 w-4" />
            {loading ? "Verifying…" : "Authenticate"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[10px] text-muted-foreground/60">
          All access attempts are logged.
        </p>
      </div>
    </div>
  );
}
