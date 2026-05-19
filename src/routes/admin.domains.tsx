import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Plus, Trash2, Server } from "lucide-react";
import {
  addSharedDomain,
  deleteSharedDomain,
  listSharedDomains,
  updateSharedDomain,
} from "@/lib/shared-domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/domains")({
  component: AdminDomainsPage,
});

function AdminDomainsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSharedDomains);
  const add = useServerFn(addSharedDomain);
  const update = useServerFn(updateSharedDomain);
  const remove = useServerFn(deleteSharedDomain);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["admin", "shared-domains"],
    queryFn: () => list(),
  });

  const [form, setForm] = useState({
    domain: "",
    ip_address: "",
    label: "",
    notes: "",
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "shared-domains"] });

  const addMut = useMutation({
    mutationFn: () =>
      add({
        data: {
          domain: form.domain.trim().toLowerCase(),
          ip_address: form.ip_address.trim(),
          label: form.label.trim() || null,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Domain added to pool");
      setForm({ domain: "", ip_address: "", label: "", notes: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add domain"),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) =>
      update({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Failed to toggle"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Domain removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Globe2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shared Domain Pool</h1>
          <p className="text-sm text-muted-foreground">
            Add backup domains so users can keep shortening links if a domain
            gets banned. Point each domain's A record to the listed IP.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4" /> Add new domain
          </CardTitle>
          <CardDescription>
            Configure the domain at registrar: A record → IP shown below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.domain || !form.ip_address) {
                toast.error("Domain and IP are required");
                return;
              }
              addMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="short.example.com"
                value={form.domain}
                onChange={(e) =>
                  setForm((f) => ({ ...f, domain: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">Server IP</Label>
              <Input
                id="ip"
                placeholder="185.158.133.1"
                value={form.ip_address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ip_address: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                placeholder="Primary, Backup-1, VPS-Sleepox"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Registrar, expiry date, owner..."
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={addMut.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {addMut.isPending ? "Adding..." : "Add domain"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-4 w-4" /> Domain pool ({domains.length})
          </CardTitle>
          <CardDescription>
            Toggle off to hide a banned domain from users without deleting it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No domains yet. Add your first one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">
                      {d.domain}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.ip_address}
                    </TableCell>
                    <TableCell>
                      {d.label ? (
                        <Badge variant="outline">{d.label}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={d.is_active}
                          onCheckedChange={(v) =>
                            toggleMut.mutate({ id: d.id, is_active: v })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {d.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${d.domain}?`)) {
                            deleteMut.mutate(d.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
