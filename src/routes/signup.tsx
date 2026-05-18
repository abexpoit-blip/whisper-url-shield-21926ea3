import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Shield, Check, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — LinkShield" }] }),
  component: SignupPage,
});

const PERKS = [
  "Unlimited bot filtering on every short link",
  "Pre-lander variant rotation & winner promotion",
  "Per-link analytics with conversion & lift",
  "No credit card required to start",
];

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Welcome.");
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error(result.error.message ?? "Google sign-up failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      <aside className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />

        <Link to="/" className="relative z-10 inline-flex items-center gap-2 font-display font-bold text-xl">
          <Shield className="h-7 w-7 text-primary" />
          LinkShield
        </Link>

        <div className="relative z-10 space-y-8 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Free forever for your first 50 links
          </div>
          <h2 className="text-4xl font-display font-bold leading-tight">
            Launch links that <span className="text-gradient">protect your ad spend</span> in under 60 seconds.
          </h2>
          <ul className="space-y-3 pt-2">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-foreground/90">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">
          Trusted by advertisers running Meta, TikTok & Google campaigns.
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-0 lg:hidden grid-pattern opacity-20" />
        <div className="relative w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-8 flex items-center gap-2 font-display font-bold">
            <Shield className="h-6 w-6 text-primary" /> LinkShield
          </Link>

          <h1 className="font-display text-3xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start protecting your traffic today. No credit card required.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={onGoogle}
            disabled={googleLoading || loading}
            className="mt-8 w-full h-11 gap-3 font-medium"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Sign up with Google"}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="h-11" />
            </div>
            <Button type="submit" disabled={loading || googleLoading} className="w-full h-11 shadow-glow group">
              {loading ? "Creating…" : (<>Create account <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By signing up you agree to our terms and privacy policy.
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
