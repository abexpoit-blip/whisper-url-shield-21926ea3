import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Shield, Zap, BarChart3, Bot, Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — LinkShield" },
      { name: "description", content: "Sign in to your LinkShield account to manage bot-filtered short links and ad-campaign analytics." },
      { property: "og:title", content: "Sign in — LinkShield" },
      { property: "og:description", content: "Access your LinkShield dashboard to manage short links and ad analytics." },
      { property: "og:url", content: "https://sleepox.com/login" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: redirect });
    })();
  }, [navigate, redirect]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading) return;
    setErrorMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setErrorMessage(error.message);
      return toast.error(error.message);
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      const message = "Login session was not saved. Please try again.";
      setErrorMessage(message);
      return toast.error(message);
    }
    // Admin sign-in is handled at /control-panel only.
    toast.success("Welcome back!");
    navigate({ to: redirect });
  };

  const onGoogle = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirect}`,
    });
    if (result.error) {
      setGoogleLoading(false);
      setErrorMessage(result.error.message ?? "Google sign-in failed");
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
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

          <Button
            type="button"
            variant="outline"
            onClick={onGoogle}
            disabled={googleLoading || loading}
            className="mt-8 w-full h-11 gap-3 font-medium"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </div>

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
              disabled={loading || googleLoading}
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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.96l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
