import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, Lock, User, Send, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — Sleepox" }] }),
  component: SignupPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const tg = telegram.trim().replace(/^@/, "");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName.trim(), telegram: tg },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      toast.success("Account created. Please login.");
      navigate({ to: "/login" });
      return;
    }
    toast.success("Welcome to Sleepox!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050B1F] text-white overflow-hidden grid lg:grid-cols-2">
      {/* Ambient glow blobs */}
      <div className="fixed top-[-15%] right-[-10%] w-[55%] h-[55%] bg-sky-500/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[50%] h-[55%] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(#38BDF8 0.5px, transparent 0.5px)", backgroundSize: "32px 32px" }}
      />

      {/* LEFT — signup form */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-8 z-10 order-2 lg:order-1">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 shadow-[0_0_15px_rgba(56,189,248,0.4)] flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45" />
            </div>
            <span className="text-xl font-bold" style={display}>SLEEP OX</span>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-sky-500/15 via-indigo-500/10 to-transparent blur-2xl rounded-full pointer-events-none" />
            <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-8 sm:p-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-[10px] font-bold uppercase tracking-widest mb-4">
                Free forever plan · No card
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={display}>Create your account.</h2>
              <p className="mt-2 text-sm text-white/40">Launch your first cloaked link in under 60 seconds.</p>

              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <FormField label="Full name" icon={<User className="w-4 h-4" />}>
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className={inputCls} />
                </FormField>
                <FormField label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                </FormField>
                <FormField label="Telegram username" icon={<Send className="w-4 h-4" />}>
                  <input required value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@yourhandle" className={inputCls} />
                </FormField>
                <FormField label="Password" icon={<Lock className="w-4 h-4" />}>
                  <input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputCls} />
                </FormField>

                <button
                  type="submit" disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all shadow-[0_0_28px_rgba(56,189,248,0.4)] hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Creating…" : <>Create account <ArrowRight className="w-4 h-4" /></>}
                </button>

                <p className="text-[11px] text-white/30 text-center">
                  By signing up you agree to our Terms &amp; Privacy Policy.
                </p>
              </form>

              <p className="mt-6 text-center text-sm text-white/40">
                Already have an account?{" "}
                <Link to="/login" className="font-bold text-sky-300 hover:text-sky-200">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — data-dense brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-l border-white/5 backdrop-blur-2xl bg-white/[0.01] z-10 order-1 lg:order-2">
        <Link to="/" className="flex items-center gap-3 w-fit">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-indigo-600 shadow-[0_0_25px_rgba(56,189,248,0.45)] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white rounded-sm rotate-45" />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-sky-200 to-indigo-300 bg-clip-text text-transparent" style={display}>
            SLEEP OX
          </span>
        </Link>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
            <span className="live-dot" /> 2,418 users joined this month
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.05]" style={display}>
            Built for the<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-sky-400 to-indigo-400">serious affiliates.</span>
          </h1>

          {/* Mock KPI tiles */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <KpiTile label="Avg clicks / user" value="184k" delta="+22%" />
            <KpiTile label="Bot block rate" value="98.2%" delta="↑ 5-layer" />
            <KpiTile label="Activation time" value="< 60s" delta="No KYC" />
            <KpiTile label="Lifetime price" value="$50" delta="One-time" />
          </div>

          {/* Bullet checklist */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl p-5 space-y-3">
            {[
              "Free 10K clicks / month, no credit card",
              "Crypto checkout via Plisio · USDT, BTC, LTC",
              "Geo + device routing on every plan",
              "Telegram support — 24h response",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-white/70">
                <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} Sleepox · Smart links &amp; analytics</p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-sky-400/50 focus:bg-white/[0.05] transition-all text-white placeholder:text-white/30";

function FormField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2 block">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function KpiTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">{label}</div>
      <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-indigo-400" style={display}>{value}</div>
      <div className="text-[10px] text-sky-300/70 mt-1 font-bold">{delta}</div>
    </div>
  );
}
