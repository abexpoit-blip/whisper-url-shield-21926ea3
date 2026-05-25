import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Globe, Plus, Check, X, Copy, Trash2, ShieldCheck, AlertCircle, Crown, RefreshCw } from "lucide-react";
import {
  listCustomDomains,
  addCustomDomain,
  verifyCustomDomain,
  deleteCustomDomain,
} from "@/lib/custom-domains.functions";

export const Route = createFileRoute("/_authenticated/domains")({
  head: () => ({ meta: [{ title: "Custom Domains — Sleepox" }] }),
  component: DomainsPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

function DomainsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomDomains);
  const addFn = useServerFn(addCustomDomain);
  const verifyFn = useServerFn(verifyCustomDomain);
  const deleteFn = useServerFn(deleteCustomDomain);

  const q = useQuery({
    queryKey: ["custom-domains"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const [newDomain, setNewDomain] = useState("");
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const add = useMutation({
    mutationFn: (domain: string) => addFn({ data: { domain } }),
    onSuccess: () => {
      setNewDomain("");
      setActionMsg({ type: "ok", text: "Domain added. Now add the DNS records below and verify." });
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
    },
    onError: (e: any) => setActionMsg({ type: "err", text: e?.message ?? "Failed to add domain" }),
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: (res: any) => {
      setActionMsg({ type: res.ok ? "ok" : "err", text: res.message });
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
    },
    onError: (e: any) => setActionMsg({ type: "err", text: e?.message ?? "Verification failed" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-domains"] }),
  });

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[#7D6452]">Loading…</div>;
  }

  if (q.isError) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700">
          <h2 className="font-bold mb-2">Could not load domains</h2>
          <p className="text-sm">{(q.error as Error)?.message ?? "Unknown error"}</p>
          <button onClick={() => q.refetch()} className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold">Retry</button>
        </div>
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;

  if (!data.isPaid) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="p-10 rounded-3xl bg-white/85 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.12)] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white shadow-lg shadow-orange-500/30 mb-5">
            <Crown className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold text-[#2D1B0D]" style={display}>
            Custom Domains — Pro feature
          </h1>
          <p className="text-[#5D4538] mt-3 max-w-md mx-auto">
            Use your own domain (e.g. <span className="font-mono text-[#2D1B0D]">links.yoursite.com</span>) for every smart link. Available on all paid plans.
          </p>
          <Link
            to="/upgrade"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform"
          >
            <Crown className="w-4 h-4" /> Upgrade now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1200px] mx-auto">
      <header>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#FF7E5F] font-bold mb-2">Branded Links</p>
        <h1 className="text-3xl lg:text-4xl font-bold text-[#2D1B0D] tracking-tight" style={display}>
          Custom Domains
        </h1>
        <p className="text-[#5D4538] text-sm mt-2 max-w-2xl">
          Serve your smart links from your own domain. Add a subdomain (recommended) like <span className="font-mono text-[#2D1B0D]">go.yoursite.com</span> and verify ownership via DNS.
        </p>
      </header>

      {/* Add domain */}
      <section className="p-6 rounded-3xl bg-white/85 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)]">
        <h2 className="text-sm font-bold text-[#2D1B0D] uppercase tracking-wider mb-4" style={display}>Add a new domain</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-[#FFEDD5] focus-within:border-[#FF7E5F]/50 transition">
            <Globe className="w-4 h-4 text-[#7D6452] shrink-0" />
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="go.yoursite.com"
              className="bg-transparent flex-1 outline-none text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] font-mono"
            />
          </div>
          <button
            onClick={() => add.mutate(newDomain)}
            disabled={!newDomain.trim() || add.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" /> {add.isPending ? "Adding…" : "Add domain"}
          </button>
        </div>
        {actionMsg && (
          <div
            className={`mt-4 flex items-start gap-2 p-3 rounded-xl text-sm ${
              actionMsg.type === "ok"
                ? "bg-emerald-500/10 border border-emerald-400/40 text-emerald-700"
                : "bg-rose-500/10 border border-rose-400/40 text-rose-700"
            }`}
          >
            {actionMsg.type === "ok" ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{actionMsg.text}</span>
          </div>
        )}
      </section>

      {/* List */}
      <section className="space-y-4">
        {data.domains.length === 0 ? (
          <div className="p-10 rounded-3xl bg-white/70 border border-dashed border-[#FFD9C4] text-center">
            <Globe className="w-10 h-10 text-[#FEB47B] mx-auto mb-3" />
            <p className="text-[#5D4538]">No domains yet. Add your first one above to get started.</p>
          </div>
        ) : (
          data.domains.map((dom: any) => (
            <DomainCard
              key={dom.id}
              dom={dom}
              onVerify={() => verify.mutate(dom.id)}
              onDelete={() => {
                if (confirm(`Delete ${dom.domain}? Links using this domain will stop working.`)) del.mutate(dom.id);
              }}
              verifying={verify.isPending}
            />
          ))
        )}
      </section>
    </div>
  );
}

function DomainCard({
  dom,
  onVerify,
  onDelete,
  verifying,
}: {
  dom: any;
  onVerify: () => void;
  onDelete: () => void;
  verifying: boolean;
}) {
  const [open, setOpen] = useState(!dom.verified);

  return (
    <div className="p-6 rounded-3xl bg-white/85 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF7E5F]/20 to-[#FEB47B]/20 border border-[#FFEDD5] flex items-center justify-center shrink-0">
          <Globe className="w-5 h-5 text-[#FF7E5F]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-[#2D1B0D] font-mono truncate" style={display}>{dom.domain}</p>
          <p className="text-xs text-[#7D6452] mt-0.5">
            Added {new Date(dom.created_at).toLocaleDateString()}
            {dom.verified_at && <> · Verified {new Date(dom.verified_at).toLocaleDateString()}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dom.verified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-700 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-700 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" /> Pending DNS
            </span>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#5D4538] hover:bg-[#FFEDD5]/60 transition"
          >
            {open ? "Hide" : "Setup"}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl text-rose-600 hover:bg-rose-500/10 transition"
            title="Delete domain"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-6 pt-6 border-t border-[#FFEDD5] space-y-5">
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-[#7D6452] font-bold mb-3">DNS Records (add at your registrar)</h4>
            <div className="space-y-3">
              <DnsRow type="CNAME" name={dom.domain} value="sleepox.com" />
              <DnsRow type="TXT" name={`_sleepox-verify.${dom.domain}`} value={dom.verification_token} />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#FFF5EC] border border-[#FFEDD5]">
            <p className="text-xs text-[#5D4538] leading-relaxed">
              <strong className="text-[#2D1B0D]">How it works:</strong> Point a CNAME from your domain to <span className="font-mono">sleepox.com</span>, then add the TXT record above to prove ownership. DNS changes can take a few minutes (up to 24h on some providers).
            </p>
          </div>
          <button
            onClick={onVerify}
            disabled={verifying}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2D1B0D] text-white text-sm font-bold hover:bg-[#3D2818] disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? "animate-spin" : ""}`} />
            {verifying ? "Checking DNS…" : dom.verified ? "Re-check" : "Verify DNS"}
          </button>
        </div>
      )}
    </div>
  );
}

function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-white border border-[#FFEDD5] text-xs">
      <span className="col-span-2 inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#FF7E5F]/15 text-[#FF7E5F] font-bold font-mono">{type}</span>
      <div className="col-span-5 min-w-0 flex items-center gap-2">
        <span className="text-[10px] uppercase text-[#7D6452] shrink-0">Name</span>
        <code className="text-[#2D1B0D] font-mono truncate" title={name}>{name}</code>
        <button onClick={() => copy("n", name)} className="ml-auto p-1 text-[#7D6452] hover:text-[#FF7E5F]" title="Copy">
          {copied === "n" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="col-span-5 min-w-0 flex items-center gap-2">
        <span className="text-[10px] uppercase text-[#7D6452] shrink-0">Value</span>
        <code className="text-[#2D1B0D] font-mono truncate" title={value}>{value}</code>
        <button onClick={() => copy("v", value)} className="ml-auto p-1 text-[#7D6452] hover:text-[#FF7E5F]" title="Copy">
          {copied === "v" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
