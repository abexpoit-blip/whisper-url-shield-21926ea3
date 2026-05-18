import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, ArrowLeft, Plus, Trash2, Save, X, Lock, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  isAdmin as isAdminFn,
  listVariantsAdmin,
  upsertVariant,
  deleteVariant,
  listLinksWithOverrides,
  setLinkOverride,
  clearLinkOverride,
} from "@/lib/admin-variants.functions";

export const Route = createFileRoute("/admin/variants")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AdminVariantsPage,
});

type VariantSection = { heading: string; body: string };
type VariantRow = {
  id: string;
  slug: string;
  category: string;
  title: string;
  subtitle: string;
  intro: string;
  sections: VariantSection[];
  outro: string;
  is_active: boolean;
  sort_order: number;
  stats: { total: number; humans: number };
};
type LinkRow = {
  id: string;
  short_code: string;
  destination_url: string;
  title: string | null;
  clicks_count: number;
  bot_clicks_count: number;
  domain: string;
  override_variant: string | null;
};

const EMPTY_VARIANT: Omit<VariantRow, "stats"> = {
  id: "",
  slug: "",
  category: "",
  title: "",
  subtitle: "",
  intro: "",
  sections: [{ heading: "", body: "" }],
  outro: "",
  is_active: true,
  sort_order: 100,
};

function AdminVariantsPage() {
  const checkAdmin = useServerFn(isAdminFn);
  const listVariants = useServerFn(listVariantsAdmin);
  const upsert = useServerFn(upsertVariant);
  const del = useServerFn(deleteVariant);
  const listLinks = useServerFn(listLinksWithOverrides);
  const setOv = useServerFn(setLinkOverride);
  const clearOv = useServerFn(clearLinkOverride);

  const [admin, setAdmin] = useState<boolean | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<(Omit<VariantRow, "stats"> & { stats?: VariantRow["stats"] }) | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [v, l] = await Promise.all([listVariants(), listLinks({ data: { search } })]);
    setVariants(v.variants as unknown as VariantRow[]);
    setLinks(l.links as LinkRow[]);
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await checkAdmin();
        setAdmin(r.isAdmin);
        if (r.isAdmin) await refresh();
      } catch {
        setAdmin(false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = async () => {
    const l = await listLinks({ data: { search } });
    setLinks(l.links as LinkRow[]);
  };

  const save = async () => {
    if (!editing) return;
    try {
      await upsert({
        data: {
          id: editing.id || undefined,
          slug: editing.slug,
          category: editing.category,
          title: editing.title,
          subtitle: editing.subtitle,
          intro: editing.intro,
          sections: editing.sections,
          outro: editing.outro,
          is_active: editing.is_active,
          sort_order: editing.sort_order,
        },
      });
      toast.success("Variant saved");
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this variant? Existing clicks will be kept.")) return;
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyOverride = async (link_id: string, variant_slug: string) => {
    if (!variant_slug) {
      await clearOv({ data: { link_id } });
      toast.success("Override cleared");
    } else {
      await setOv({ data: { link_id, variant_slug } });
      toast.success(`Forced variant: ${variant_slug}`);
    }
    await refresh();
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  }
  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need the admin role to access this page.
          </p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-sidebar">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold">Admin · Variants</span>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* VARIANTS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Pre-lander variants</h2>
            <Button onClick={() => setEditing({ ...EMPTY_VARIANT })} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New variant
            </Button>
          </div>

          <div className="grid gap-3">
            {variants.map((v) => {
              const cr = v.stats.total ? (v.stats.humans / v.stats.total) * 100 : 0;
              return (
                <div key={v.id} className="border rounded-lg p-4 bg-card flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{v.slug}</code>
                      {v.is_active
                        ? <Badge variant="default">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                      <span className="text-xs text-muted-foreground">{v.category}</span>
                    </div>
                    <h3 className="font-semibold mt-1 truncate">{v.title}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      {v.sections.length} sections · {v.stats.humans}/{v.stats.total} verified
                      {" · "}<span className="font-medium text-foreground">{cr.toFixed(1)}% conv</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setEditing(v)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {variants.length === 0 && (
              <p className="text-sm text-muted-foreground">No variants yet.</p>
            )}
          </div>
        </section>

        {/* OVERRIDES */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Per-link winner override</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Force a specific variant for a link, bypassing the automatic A/B bandit.
            Leave empty to let the bandit pick.
          </p>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by short code, URL or title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
            />
            <Button onClick={onSearch} variant="outline">Search</Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Link</th>
                  <th className="text-left p-3">Domain</th>
                  <th className="text-right p-3">Clicks</th>
                  <th className="text-left p-3 w-64">Forced variant</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3">
                      <div className="font-mono text-xs">/r/{l.short_code}</div>
                      {l.title && <div className="text-xs text-muted-foreground">{l.title}</div>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">
                      {l.domain}
                    </td>
                    <td className="p-3 text-right">
                      {l.clicks_count}
                      <span className="text-xs text-muted-foreground"> · {l.bot_clicks_count} bots</span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 items-center">
                        <select
                          className="border rounded px-2 py-1 bg-background text-sm flex-1"
                          value={l.override_variant ?? ""}
                          onChange={(e) => applyOverride(l.id, e.target.value)}
                        >
                          <option value="">Auto (bandit)</option>
                          {variants.filter((v) => v.is_active).map((v) => (
                            <option key={v.slug} value={v.slug}>{v.slug}</option>
                          ))}
                        </select>
                        {l.override_variant && (
                          <Button size="sm" variant="ghost" onClick={() => applyOverride(l.id, "")}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {links.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No links found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4">
            <div className="bg-card border rounded-lg w-full max-w-3xl my-8 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {editing.id ? "Edit variant" : "New variant"}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Slug (unique id)</Label>
                  <Input
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    placeholder="wellness"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                </div>
              </div>

              <div className="mb-3">
                <Label>Title</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>

              <div className="mb-3">
                <Label>Subtitle</Label>
                <Input
                  value={editing.subtitle}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                />
              </div>

              <div className="mb-3">
                <Label>Intro paragraph</Label>
                <Textarea
                  rows={3}
                  value={editing.intro}
                  onChange={(e) => setEditing({ ...editing, intro: e.target.value })}
                />
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <Label>Sections</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        sections: [...editing.sections, { heading: "", body: "" }],
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {editing.sections.map((s, i) => (
                    <div key={i} className="border rounded p-3 bg-background space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Heading"
                          value={s.heading}
                          onChange={(e) => {
                            const next = [...editing.sections];
                            next[i] = { ...next[i], heading: e.target.value };
                            setEditing({ ...editing, sections: next });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              sections: editing.sections.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Body"
                        rows={3}
                        value={s.body}
                        onChange={(e) => {
                          const next = [...editing.sections];
                          next[i] = { ...next[i], body: e.target.value };
                          setEditing({ ...editing, sections: next });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <Label>Outro paragraph</Label>
                <Textarea
                  rows={2}
                  value={editing.outro}
                  onChange={(e) => setEditing({ ...editing, outro: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.is_active}
                      onChange={(e) =>
                        setEditing({ ...editing, is_active: e.target.checked })
                      }
                    />
                    Active (served to traffic)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save} className="gap-2">
                  <Save className="h-4 w-4" /> Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
