import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Globe2, FlaskConical, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  listGeoOffers, upsertGeoOffer, deleteGeoOffer,
  listAbVariants, upsertAbVariant, deleteAbVariant,
} from "@/lib/link-targeting.functions";

const fld = "w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl px-3 py-2.5 text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white";

type Props = { linkId: string; linkTitle: string; open: boolean; onClose: () => void };

export function LinkTargetingDrawer({ linkId, linkTitle, open, onClose }: Props) {
  const [tab, setTab] = useState<"geo" | "ab">("geo");
  useEffect(() => { if (open) setTab("geo"); }, [open, linkId]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#2D1B0D]/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-2xl bg-[#FFF9F5] shadow-2xl flex flex-col overflow-hidden">
        <header className="px-6 py-5 border-b border-[#FFEDD5] flex items-center justify-between bg-white/80 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A38D7D]">Smart targeting</p>
            <h2 className="text-lg font-bold text-[#2D1B0D] truncate">{linkTitle}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FFEDD5]/60 text-[#7D6452]"><X className="w-5 h-5" /></button>
        </header>

        <div className="px-6 pt-4 flex gap-2 border-b border-[#FFEDD5] bg-white/40">
          {([
            { k: "geo", label: "Geo Offers", icon: Globe2 },
            { k: "ab", label: "A/B Variants", icon: FlaskConical },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${
                tab === t.k ? "bg-[#FFF9F5] text-[#FF7E5F] border border-b-0 border-[#FFEDD5]" : "text-[#7D6452] hover:text-[#2D1B0D]"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "geo" ? <GeoTab linkId={linkId} /> : <AbTab linkId={linkId} />}
        </div>
      </aside>
    </>
  );
}

/* ============== GEO OFFERS ============== */
function GeoTab({ linkId }: { linkId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listGeoOffers);
  const upsert = useServerFn(upsertGeoOffer);
  const del = useServerFn(deleteGeoOffer);

  const q = useQuery({
    queryKey: ["geo-offers", linkId],
    queryFn: () => list({ data: { link_id: linkId } }),
  });

  const [offerUrl, setOfferUrl] = useState("");
  const [tier, setTier] = useState<string>("");
  const [codes, setCodes] = useState("");
  const [weight, setWeight] = useState("100");

  const addMut = useMutation({
    mutationFn: (v: { offer_url: string; tier?: number | null; country_codes?: string[]; weight: number }) =>
      upsert({ data: { link_id: linkId, ...v, is_active: true } }),
    onSuccess: () => {
      toast.success("Geo offer added");
      setOfferUrl(""); setCodes(""); setTier(""); setWeight("100");
      qc.invalidateQueries({ queryKey: ["geo-offers", linkId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (r: { id: string; is_active: boolean; offer_url: string; weight: number; tier: number | null; country_codes: string[] | null }) =>
      upsert({ data: { id: r.id, link_id: linkId, offer_url: r.offer_url, weight: r.weight, tier: r.tier ?? undefined, country_codes: r.country_codes ?? undefined, is_active: r.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["geo-offers", linkId] }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id, link_id: linkId } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["geo-offers", linkId] }); },
  });

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const codesArr = codes.split(/[,\s]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
    addMut.mutate({
      offer_url: offerUrl,
      tier: tier ? Number(tier) : null,
      country_codes: codesArr.length ? codesArr : undefined,
      weight: Number(weight) || 100,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#FFEDD5] bg-white p-5">
        <h3 className="text-sm font-bold text-[#2D1B0D] mb-1">How geo routing works</h3>
        <p className="text-xs text-[#7D6452] leading-relaxed">
          Visitor's country is matched against rules below. Specific country codes win first, then tier (1=top, 3=cheapest), then weight. If no rule matches, the link's main offer URL is used.
        </p>
      </div>

      <form onSubmit={onAdd} className="rounded-2xl border border-[#FFEDD5] bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#2D1B0D]">Add new geo offer</h3>
        <input className={fld} placeholder="Offer URL (https://...)" type="url" required value={offerUrl} onChange={e => setOfferUrl(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <select className={fld} value={tier} onChange={e => setTier(e.target.value)}>
            <option value="">Any tier</option>
            <option value="1">Tier 1 (top GEO)</option>
            <option value="2">Tier 2 (mid GEO)</option>
            <option value="3">Tier 3 (low GEO)</option>
          </select>
          <input className={fld + " col-span-2"} placeholder="Country codes (US, GB, DE) — optional" value={codes} onChange={e => setCodes(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <input className={fld + " w-32"} type="number" min={1} max={10000} placeholder="Weight" value={weight} onChange={e => setWeight(e.target.value)} />
          <button type="submit" disabled={addMut.isPending}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-md hover:scale-[1.02] transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> {addMut.isPending ? "Adding…" : "Add offer"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-[#FFEDD5] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#FFEDD5] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D1B0D]">Active rules</h3>
          <span className="text-[11px] text-[#A38D7D]">{q.data?.length ?? 0}</span>
        </div>
        {q.isLoading && <div className="p-6 text-center text-sm text-[#A38D7D]">Loading…</div>}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <div className="p-6 text-center text-sm text-[#7D6452]">No geo rules yet — add one above.</div>
        )}
        <ul className="divide-y divide-[#FFEDD5]">
          {q.data?.map(r => (
            <li key={r.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[#FFF9F5]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.tier && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF7E5F]/10 text-[#FF7E5F]">T{r.tier}</span>}
                  {r.country_codes?.length ? (
                    <span className="text-[11px] font-mono text-[#2D1B0D] truncate">{r.country_codes.join(", ")}</span>
                  ) : <span className="text-[11px] text-[#A38D7D] italic">all countries</span>}
                  <span className="text-[11px] text-[#A38D7D]">weight {r.weight}</span>
                </div>
                <p className="text-xs text-[#7D6452] truncate font-mono mt-0.5">{r.offer_url}</p>
              </div>
              <button onClick={() => toggleMut.mutate({ ...r, is_active: !r.is_active })} className="p-1 text-[#7D6452] hover:text-[#FF7E5F]" title="Toggle">
                {r.is_active ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => { if (confirm("Remove this rule?")) delMut.mutate(r.id); }} className="p-1 text-[#7D6452] hover:text-rose-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ============== A/B VARIANTS ============== */
function AbTab({ linkId }: { linkId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listAbVariants);
  const upsert = useServerFn(upsertAbVariant);
  const del = useServerFn(deleteAbVariant);

  const q = useQuery({
    queryKey: ["ab-variants", linkId],
    queryFn: () => list({ data: { link_id: linkId } }),
  });

  const [label, setLabel] = useState("");
  const [offerUrl, setOfferUrl] = useState("");
  const [weight, setWeight] = useState("50");

  const addMut = useMutation({
    mutationFn: (v: { variant_label: string; offer_url: string; weight_pct: number }) =>
      upsert({ data: { link_id: linkId, ...v, is_active: true } }),
    onSuccess: () => {
      toast.success("Variant added");
      setLabel(""); setOfferUrl(""); setWeight("50");
      qc.invalidateQueries({ queryKey: ["ab-variants", linkId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (r: { id: string; variant_label: string; offer_url: string; weight_pct: number; is_active: boolean }) =>
      upsert({ data: { id: r.id, link_id: linkId, variant_label: r.variant_label, offer_url: r.offer_url, weight_pct: r.weight_pct, is_active: r.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ab-variants", linkId] }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id, link_id: linkId } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["ab-variants", linkId] }); },
  });

  const totalWeight = (q.data ?? []).filter(v => v.is_active).reduce((s, v) => s + v.weight_pct, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#FFEDD5] bg-white p-5">
        <h3 className="text-sm font-bold text-[#2D1B0D] mb-1">How split-testing works</h3>
        <p className="text-xs text-[#7D6452] leading-relaxed">
          Each visitor gets a sticky variant (24h cookie). Weights are relative — current active total: <b>{totalWeight}</b>. CTR is tracked per variant.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); addMut.mutate({ variant_label: label, offer_url: offerUrl, weight_pct: Number(weight) || 50 }); }}
        className="rounded-2xl border border-[#FFEDD5] bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#2D1B0D]">Add variant</h3>
        <div className="grid grid-cols-4 gap-2">
          <input className={fld} placeholder="A" required maxLength={20} value={label} onChange={e => setLabel(e.target.value)} />
          <input className={fld + " col-span-3"} placeholder="Offer URL (https://...)" type="url" required value={offerUrl} onChange={e => setOfferUrl(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#7D6452]">Weight</label>
          <input className={fld + " w-24"} type="number" min={1} max={100} value={weight} onChange={e => setWeight(e.target.value)} />
          <span className="text-xs text-[#A38D7D]">%</span>
          <button type="submit" disabled={addMut.isPending}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-md hover:scale-[1.02] transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> {addMut.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-[#FFEDD5] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#FFEDD5] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D1B0D]">Variants</h3>
          <span className="text-[11px] text-[#A38D7D]">{q.data?.length ?? 0}</span>
        </div>
        {q.isLoading && <div className="p-6 text-center text-sm text-[#A38D7D]">Loading…</div>}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <div className="p-6 text-center text-sm text-[#7D6452]">No variants — uses main offer URL.</div>
        )}
        <ul className="divide-y divide-[#FFEDD5]">
          {q.data?.map(v => {
            const ctr = v.clicks_count ? Math.round((v.conversions_count / v.clicks_count) * 1000) / 10 : 0;
            return (
              <li key={v.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[#FFF9F5]">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {v.variant_label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-[#2D1B0D]">{v.weight_pct}% weight</span>
                    <span className="text-[11px] text-[#A38D7D]">·</span>
                    <span className="text-[11px] text-[#7D6452]">{Number(v.clicks_count).toLocaleString()} clicks</span>
                    <span className="text-[11px] text-[#A38D7D]">·</span>
                    <span className="text-[11px] text-emerald-600 font-bold">{ctr}% CTR</span>
                  </div>
                  <p className="text-xs text-[#7D6452] truncate font-mono mt-0.5">{v.offer_url}</p>
                </div>
                <button onClick={() => toggleMut.mutate({ ...v, is_active: !v.is_active })} className="p-1 text-[#7D6452] hover:text-[#FF7E5F]">
                  {v.is_active ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => { if (confirm("Remove variant?")) delMut.mutate(v.id); }} className="p-1 text-[#7D6452] hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
