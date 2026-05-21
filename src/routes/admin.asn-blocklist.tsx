import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  listFbBlocklist,
  addFbBlocklistEntry,
  toggleFbBlocklistEntry,
  deleteFbBlocklistEntry,
} from "@/lib/admin-defense.functions";

export const Route = createFileRoute("/admin/asn-blocklist")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AdminAsnBlocklistPage,
});

type Row = {
  id: string;
  asn: number | null;
  ip_cidr: string | null;
  label: string;
  is_active: boolean;
  created_at: string;
};

function AdminAsnBlocklistPage() {
  const fetchBlocklist = useServerFn(listFbBlocklist);
  const addBlocklistEntry = useServerFn(addFbBlocklistEntry);
  const toggleBlocklistEntry = useServerFn(toggleFbBlocklistEntry);
  const removeBlocklistEntry = useServerFn(deleteFbBlocklistEntry);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [asn, setAsn] = useState("");
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchBlocklist();
      setRows(res.rows as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!label.trim()) return toast.error("Label দিন");
    if (!asn && !cidr) return toast.error("ASN অথবা CIDR যেকোনো একটা দিন");
    const asnNum = asn ? Number(asn) : null;
    if (asn && (!Number.isInteger(asnNum) || asnNum! <= 0)) {
      return toast.error("ASN positive integer হতে হবে");
    }
    setAdding(true);
    try {
      await addBlocklistEntry({
        data: {
          asn: asnNum,
          ip_cidr: cidr.trim() || null,
          label: label.trim(),
        },
      });
      toast.success("Added");
      setAsn("");
      setCidr("");
      setLabel("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, next: boolean) => {
    try {
      await toggleBlocklistEntry({ data: { id, is_active: next } });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("এই entry delete করবেন?")) return;
    try {
      await removeBlocklistEntry({ data: { id } });
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Facebook ASN / IP Blocklist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            এই ASN বা IP range থেকে আসা traffic-কে কখনো Adsterra-তে redirect করা হবে না — তারা শুধু safe article দেখবে। FB reviewer/crawler থেকে account রক্ষা পায়।
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add new entry</CardTitle>
            <CardDescription>ASN (যেমন Meta = 32934) অথবা IP CIDR (যেমন 31.13.24.0/21)। যেকোনো একটি বাধ্যতামূলক।</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs">ASN</Label>
                <Input
                  type="number"
                  value={asn}
                  onChange={(e) => setAsn(e.target.value)}
                  placeholder="32934"
                />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">IP CIDR</Label>
                <Input
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  placeholder="31.13.24.0/21"
                />
              </div>
              <div className="md:col-span-5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Meta / Facebook crawler"
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={handleAdd} disabled={adding} className="w-full">
                  <Plus className="w-4 h-4 mr-1" /> {adding ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entries ({rows.length})</CardTitle>
            <CardDescription>Switch off করলে rule temporarily disable হবে।</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">কোনো entry নেই।</p>
            ) : (
              <div className="divide-y">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {r.asn ? `ASN ${r.asn}` : null}
                        {r.asn && r.ip_cidr ? " · " : null}
                        {r.ip_cidr ?? null}
                      </p>
                    </div>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => handleToggle(r.id, v)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(r.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
