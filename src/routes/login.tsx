import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Shield, Zap, BarChart3, Bot, Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getVerifiedClientSession } from "@/lib/auth-guard";
import { waitForStoredSession } from "@/lib/auth-session";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — LinkShield" },
      {
        name: "description",
        content:
          "Sign in to your LinkShield account to manage bot-filtered short links and ad-campaign analytics.",
      },
      { property: "og:title", content: "Sign in — LinkShield" },
      {
        property: "og:description",
        content: "Access your LinkShield dashboard to manage short links and ad analytics.",
      },
      { property: "og:url", content: "https://sleepox.com/login" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      await waitForStoredSession(null, 1_500);
    const verified = await getVerifiedClientSession();
      if (active && verified) navigate({ to: redirect });
    })();
    return () => {
      active = false;
    };
  }, [navigate, redirect]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setErrorMessage(error.message);
      return toast.error(error.message);
    }
    await waitForStoredSession(null, 1_500);
    const verified = await getVerifiedClientSession();
    if (!verified) {
      setLoading(false);
      const message = "Login session was not saved. Please try again.";
      setErrorMessage(message);
      return toast.error(message);
    }
    // Admin sign-in is handled at /control-panel only.
    toast.success("Welcome back!");
    await router.invalidate();
    navigate({ to: redirect });
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      {/* Showcase pane */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />

        <Link
          to="/"
          className="relative z-10 inline-flex items-center gap-2 font-display font-bold text-xl"
        >
          <Shield className="h-7 w-7 text-primary" />
          LinkShield
        </Link>

        <div className="relative z-10 space-y-8 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Smart short-links for Meta ads
          </div>
          <h2 className="text-4xl font-display font-bold leading-tight">
            Stop wasting ad spend on <span className="text-gradient">bot clicks.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            LinkShield filters fake traffic, protects your ad accounts, and turns real visitors into
            customers.
          </p>

          <ul className="space-y-3 pt-2">
            {[
              { icon: Bot, label: "AI-powered bot detection on every click" },
              { icon: BarChart3, label: "Per-link analytics, conversion & lift tracking" },
              { icon: Zap, label: "Pre-lander rotation that finds your winner" },
            ].map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-foreground/90">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} LinkShield. Built for advertisers.
        </p>
      </aside>

      {/* Form pane */}
      <main className="flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-0 lg:hidden grid-pattern opacity-20" />
        <div className="relative w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-8 flex items-center gap-2 font-display font-bold">
            <Shield className="h-6 w-6 text-primary" /> LinkShield
          </Link>

          <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your dashboard to manage links and traffic.
          </p>

          {errorMessage && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="mt-8" />


          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 shadow-glow group"
            >
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in{" "}
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Create one — it's free
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
