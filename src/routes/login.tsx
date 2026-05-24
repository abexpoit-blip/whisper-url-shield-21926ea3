import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — Sleepox" }] }),
  component: LoginPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); toast.error(error.message); return; }
    navigate({ to: "/dashboard" });
    toast.success("Welcome back!");
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050B1F] text-white overflow-hidden grid lg:grid-cols-2">
      {/* Ambient glow blobs */}
      <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-sky-500/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[50%] h-[55%] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(#38BDF8 0.5px, transparent 0.5px)", backgroundSize: "32px 32px" }}
      />

      {/* LEFT — data-dense brand command panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-white/5 backdrop-blur-2xl bg-white/[0.01] z-10">
        <Link to="/" className="flex items-center gap-3 w-fit">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-indigo-600 shadow-[0_0_25px_rgba(56,189,248,0.45)] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white rounded-sm rotate-45" />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-sky-200 to-indigo-300 bg-clip-text text-transparent" style={display}>
            SLEEP OX
          </span>
        </Link>

        {/* Live ops ticker */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
            <span className="live-dot" /> Network online
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.05]" style={display}>
            Operate at the<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-sky-400 to-indigo-400">edge of every click.</span>
          </h1>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { v: "30ms", l: "Edge redirect" },
              { v: "99.9%", l: "Uptime SLA" },
              { v: "5M+", l: "Daily clicks" },
            ].map((s) => (
              <div key={s.l} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
                <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-indigo-400" style={display}>{s.v}</div>
                <div className="mt-1 text-[10px] text-white/40 uppercase tracking-widest">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Mini activity sparkline */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Last 12h clicks/sec</p>
              <span className="text-xs font-bold text-sky-300">+18.4%</span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {[30, 45, 38, 60, 52, 75, 68, 88, 72, 95, 80, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-sky-500/20 to-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30">© {new Date().getFullYear()} Sleepox · Smart links &amp; analytics</p>
      </div>

      {/* RIGHT — login form */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-8 z-10">
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
                Sign in
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={display}>Welcome back.</h2>
              <p className="mt-2 text-sm text-white/40">Pick up where you left off. Your dashboard is live.</p>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2 block">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-sky-400/50 focus:bg-white/[0.05] transition-all text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2 block">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-sky-400/50 focus:bg-white/[0.05] transition-all text-white placeholder:text-white/30"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all shadow-[0_0_28px_rgba(56,189,248,0.4)] hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-white/40">
                New here?{" "}
                <Link to="/signup" className="font-bold text-sky-300 hover:text-sky-200">Create an account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
