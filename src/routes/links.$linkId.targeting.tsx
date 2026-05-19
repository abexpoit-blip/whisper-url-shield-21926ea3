import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Globe, Smartphone, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  getTargetingState,
  upsertGeoRule,
  deleteGeoRule,
  upsertDeviceRule,
  deleteDeviceRule,
  setDuplicateProtection,
} from "@/lib/targeting.functions";

export const Route = createFileRoute("/links/$linkId/targeting")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: TargetingPage,
});

type GeoRule = {
  id: string;
  country_code: string;
  adsterra_url: string;
  priority: number;
  is_active: boolean;
};
type DeviceRule = {
  id: string;
  device: string;
  os: string;
  adsterra_url: string;
  priority: number;
  is_active: boolean;
};
type LinkInfo = {
  id: string;
  short_code: string;
  title: string | null;
  duplicate_protection: boolean;
  duplicate_window_minutes: number;
};

function TargetingPage() {
  const { linkId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [geoRules, setGeoRules] = useState<GeoRule[]>([]);
  const [deviceRules, setDeviceRules] = useState<DeviceRule[]>([]);

  // Geo form
  const [geoCountry, setGeoCountry] = useState("");
  const [geoUrl, setGeoUrl] = useState("");
  const [geoPriority, setGeoPriority] = useState("100");

  // Device form
  const [devDevice, setDevDevice] = useState<"mobile" | "tablet" | "desktop" | "any">("mobile");
  const [devOs, setDevOs] = useState("any");
  const [devUrl, setDevUrl] = useState("");
  const [devPriority, setDevPriority] = useState("100");

  // Duplicate
  const [dupEnabled, setDupEnabled] = useState(true);
  const [dupWindow, setDupWindow] = useState("30");
  const [savingDup, setSavingDup] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTargetingState({ data: { linkId } });
      setLink(res.link);
      setGeoRules(res.geoRules);
      setDeviceRules(res.deviceRules);
      setDupEnabled(res.link.duplicate_protection);
      setDupWindow(String(res.link.duplicate_window_minutes));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  const addGeo = async () => {
    if (!geoCountry || !geoUrl) {
      toast.error("Country code এবং Adsterra URL দিন");
      return;
    }
    try {
      await upsertGeoRule({
        data: {
          linkId,
          country_code: geoCountry.toUpperCase(),
          adsterra_url: geoUrl,
          priority: Number(geoPriority) || 100,
        },
      });
      toast.success("Geo rule saved");
      setGeoCountry("");
      setGeoUrl("");
      setGeoPriority("100");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const removeGeo = async (ruleId: string) => {
    try {
      await deleteGeoRule({ data: { linkId, ruleId } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const addDevice = async () => {
    if (!devUrl) {
      toast.error("Adsterra URL দিন");
      return;
    }
    try {
      await upsertDeviceRule({
        data: {
          linkId,
          device: devDevice,
          os: devOs,
          adsterra_url: devUrl,
          priority: Number(devPriority) || 100,
        },
      });
      toast.success("Device rule saved");
      setDevUrl("");
      setDevPriority("100");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const removeDevice = async (ruleId: string) => {
    try {
      await deleteDeviceRule({ data: { linkId, ruleId } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const saveDuplicate = async () => {
    setSavingDup(true);
    try {
      await setDuplicateProtection({
        data: {
          linkId,
          enabled: dupEnabled,
          window_minutes: Math.min(1440, Math.max(1, Number(dupWindow) || 30)),
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingDup(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-2xl font-semibold">Smart Targeting</h1>
            <p className="text-sm text-muted-foreground">
              /{link?.short_code} — {link?.title ?? "Untitled link"}
            </p>
          </div>
          <Link
            to="/links/$linkId/settings"
            params={{ linkId }}
            className="text-sm text-primary hover:underline"
          >
            ← Settings
          </Link>
        </div>

        {/* GEO RULES */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Geo Smart Redirect</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            দেশ অনুযায়ী আলাদা Adsterra link। যেমন US/UK = premium link, BD/IN = standard.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Country (2-letter)</Label>
              <Input
                value={geoCountry}
                onChange={(e) => setGeoCountry(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="US"
              />
            </div>
            <div className="md:col-span-7">
              <Label className="text-xs">Adsterra URL</Label>
              <Input
                value={geoUrl}
                onChange={(e) => setGeoUrl(e.target.value)}
                placeholder="https://...adsterra..."
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={geoPriority}
                onChange={(e) => setGeoPriority(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Button onClick={addGeo} className="w-full">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="divide-y border-t">
            {geoRules.length === 0 && (
              <p className="text-sm text-muted-foreground py-3">No geo rules yet.</p>
            )}
            {geoRules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-mono font-semibold w-10">{r.country_code}</span>
                <span className="flex-1 truncate text-muted-foreground">{r.adsterra_url}</span>
                <span className="text-xs text-muted-foreground">p{r.priority}</span>
                <Button size="sm" variant="ghost" onClick={() => removeGeo(r.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* DEVICE RULES */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Device + OS Targeting</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Device/OS অনুযায়ী আলাদা Adsterra offer। Mobile Android-এর জন্য আলাদা, Desktop-এর জন্য আলাদা।
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Device</Label>
              <Select value={devDevice} onValueChange={(v) => setDevDevice(v as typeof devDevice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">OS</Label>
              <Select value={devOs} onValueChange={setDevOs}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="macos">macOS</SelectItem>
                  <SelectItem value="linux">Linux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5">
              <Label className="text-xs">Adsterra URL</Label>
              <Input
                value={devUrl}
                onChange={(e) => setDevUrl(e.target.value)}
                placeholder="https://...adsterra..."
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={devPriority}
                onChange={(e) => setDevPriority(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Button onClick={addDevice} className="w-full">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="divide-y border-t">
            {deviceRules.length === 0 && (
              <p className="text-sm text-muted-foreground py-3">No device rules yet.</p>
            )}
            {deviceRules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-mono w-20">{r.device}</span>
                <span className="font-mono w-20 text-muted-foreground">{r.os}</span>
                <span className="flex-1 truncate text-muted-foreground">{r.adsterra_url}</span>
                <span className="text-xs text-muted-foreground">p{r.priority}</span>
                <Button size="sm" variant="ghost" onClick={() => removeDevice(r.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* DUPLICATE PROTECTION */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Duplicate Click Protection</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            একই IP নির্দিষ্ট সময়ে আবার click করলে Adsterra-তে redirect হবে না — fake impression থেকে Adsterra account safe থাকবে।
          </p>

          <div className="flex items-center justify-between gap-4 rounded border p-4">
            <div>
              <p className="font-medium">Enable duplicate protection</p>
              <p className="text-xs text-muted-foreground">Repeat clicker-কে safe page দেখানো হবে।</p>
            </div>
            <Switch checked={dupEnabled} onCheckedChange={setDupEnabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Window (minutes) — 1 to 1440</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={dupWindow}
                onChange={(e) => setDupWindow(e.target.value)}
              />
            </div>
            <Button onClick={saveDuplicate} disabled={savingDup}>
              {savingDup ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
