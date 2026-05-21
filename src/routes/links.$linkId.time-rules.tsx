import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listTimeRules, addTimeRule, toggleTimeRule, deleteTimeRule,
} from "@/lib/time-rules.functions";

export const Route = createFileRoute("/links/$linkId/time-rules")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: TimeRulesPage,
});

type Action = "safe" | "cloak" | "pass";
type Row = {
  id: string;
  days_mask: number;
  start_minute: number;
  end_minute: number;
  action: Action;
  timezone: string;
  priority: number;
  is_active: boolean;
  note: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ACTION_LABEL: Record<Action, { label: string; tone: string }> = {
  safe: { label: "Safe (no redirect)", tone: "bg-emerald-500/15 text-emerald-600" },
  cloak: { label: "Silent cloak", tone: "bg-amber-500/15 text-amber-600" },
  pass: { label: "Pass through", tone: "bg-blue-500/15 text-blue-600" },
};

function minToHHMM(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function hhmmToMin(s: string) {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}
function daysFromMask(mask: number) {
  return DAYS.filter((_, i) => (mask >> i) & 1).join(", ");
}

function TimeRulesPage() {
  const { linkId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, true, true]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [action, setAction] = useState<Action>("cloak");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [priority, setPriority] = useState("100");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listTimeRules({ data: { linkId } });
      setRows(res.rows as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [linkId]);

  const handleAdd = async () => {
    const mask = days.reduce((acc, on, i) => (on ? acc | (1 << i) : acc), 0);
    if (mask === 0) return toast.error("কমপক্ষে একটা day select করুন");
    setAdding(true);
    try {
      await addTimeRule({
        data: {
          linkId,
          days_mask: mask,
          start_minute: hhmmToMin(start),
          end_minute: hhmmToMin(end),
          action,
          timezone,
          priority: parseInt(priority, 10) || 100,
          note: note || undefined,
        },
      });
      toast.success("Rule added");
      setNote("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6" /> Time-based Cloaking
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          নির্দিষ্ট দিন/সময়ে link কে safe/cloak/pass করে FB review peak-hour এ ad disapproval এড়ান।
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Add a rule</CardTitle>
          <CardDescription>যেমন: সকাল ৯টা–সন্ধ্যা ৬টা UTC তে cloak (FB reviewer active window).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Days</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays((arr) => arr.map((v, j) => (j === i ? !v : v)))}
                  className={`px-3 py-1 rounded-md text-sm border ${
                    days[i] ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}
                >{d}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Start time</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End time</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Action</Label>
              <Select value={action} onValueChange={(v) => setAction(v as Action)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">Safe (no redirect)</SelectItem>
                  <SelectItem value="cloak">Silent cloak</SelectItem>
                  <SelectItem value="pass">Pass through</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
            </div>
            <div>
              <Label>Priority</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="FB review peak hours" />
          </div>

          <Button onClick={handleAdd} disabled={adding} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> {adding ? "Adding..." : "Add rule"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active rules</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">এখনো কোনো time rule নেই।</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={ACTION_LABEL[r.action].tone}>{ACTION_LABEL[r.action].label}</Badge>
                      <span className="text-sm font-medium">
                        {minToHHMM(r.start_minute)}–{minToHHMM(r.end_minute)} ({r.timezone})
                      </span>
                      <span className="text-xs text-muted-foreground">P{r.priority}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {daysFromMask(r.days_mask)} {r.note ? `· ${r.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={async (v) => {
                        await toggleTimeRule({ data: { id: r.id, is_active: v } });
                        load();
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (!confirm("Delete this rule?")) return;
                      await deleteTimeRule({ data: { id: r.id } });
                      load();
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
