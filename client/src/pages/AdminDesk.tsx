/*
 * S/ Agent Passport — Approval Desk (admin only).
 * Pending applications queue → APPROVE (mints real passport) / DENY (with reason).
 * Full passport registry with one-click revoke.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MrzStrip, Perforation, Stamp } from "@/components/passport-ui";
import {
  ArrowLeft,
  Check,
  Clock,
  Database,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Stamp as StampIcon,
  X,
} from "lucide-react";

const LOGO = "/manus-storage/s-slash-logo_80b146d9.png";

function tone(s: string): "ink" | "deny" | "steel" {
  if (s === "approved" || s === "active") return "ink";
  if (s === "denied" || s === "revoked" || s === "expired") return "deny";
  return "steel";
}

export default function AdminDesk() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const utils = trpc.useUtils();
  const pendingQ = trpc.admin.pending.useQuery(undefined, { enabled: isAdmin });
  const passportsQ = trpc.admin.allPassports.useQuery(undefined, { enabled: isAdmin });
  const toolsQ = trpc.catalog.tools.useQuery(undefined, { staleTime: Infinity });

  const approve = trpc.admin.approve.useMutation({
    onSuccess: (r) => {
      utils.admin.pending.invalidate();
      utils.admin.allPassports.invalidate();
      toast.success(`APPROVED — passport ${r.passportId} minted and signed.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const deny = trpc.admin.deny.useMutation({
    onSuccess: () => {
      utils.admin.pending.invalidate();
      setDenyFor(null);
      setDenyReason("");
      toast("Application DENIED.", { description: "The owner sees the reason in their portal." });
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = trpc.admin.revoke.useMutation({
    onSuccess: () => {
      utils.admin.allPassports.invalidate();
      setRevokeFor(null);
      setRevokeReason("");
      toast("Passport REVOKED.", { description: "Every gate refuses it from this moment." });
    },
    onError: (e) => toast.error(e.message),
  });

  const [denyFor, setDenyFor] = useState<number | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [revokeFor, setRevokeFor] = useState<number | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const toolLabel = (id: string) => toolsQ.data?.find((t) => t.id === id)?.label ?? id;
  const toolSensitive = (id: string) => !!toolsQ.data?.find((t) => t.id === id)?.sensitive;

  /* ===== gates ===== */
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="border-b border-border/60">
          <div className="container flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2.5">
              <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
              <span className="font-display font-bold tracking-tight">Approval Desk</span>
            </Link>
            <Link href="/" className="label-mono hover:text-primary transition-colors inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="panel doc-corners rounded-sm p-10 max-w-md w-full text-center">
            <ShieldAlert className="h-10 w-10 text-[oklch(0.66_0.2_22)] mx-auto mb-5" strokeWidth={1.25} />
            <div className="mb-4">
              <Stamp tone="deny" className="text-lg">Restricted area</Stamp>
            </div>
            <p className="font-mono text-[13px] text-muted-foreground leading-relaxed mb-7">
              {isAuthenticated
                ? "This desk is reserved for the registry inspector. Your file does not carry the admin seal."
                : "Inspector identification required to open the approval desk."}
            </p>
            {!isAuthenticated ? (
              <Button
                size="lg"
                className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] h-11"
                onClick={() => startLogin()}
              >
                <ShieldCheck className="h-4 w-4 mr-2" /> Identify yourself
              </Button>
            ) : (
              <Link href="/portal">
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] h-11"
                >
                  Go to your portal
                </Button>
              </Link>
            )}
          </div>
        </div>
        <MrzStrip text="P<SPASS<<RESTRICTED<<<INSPECTOR<SEAL<REQUIRED<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" />
      </div>
    );
  }

  const pending = (pendingQ.data ?? []).filter((r) => r.status === "pending");
  const decided = (pendingQ.data ?? []).filter((r) => r.status !== "pending");
  const passports = passportsQ.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 inset-x-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="container flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold tracking-tight">Approval Desk</span>
            <span className="label-mono text-primary hidden sm:inline">inspector · {user?.name}</span>
          </Link>
          <nav className="flex items-center gap-6 label-mono">
            <a href="#queue" className="hover:text-primary transition-colors">Queue</a>
            <a href="#registry" className="hover:text-primary transition-colors">Registry</a>
            <Link href="/portal" className="hover:text-primary transition-colors">Portal</Link>
          </nav>
        </div>
      </header>

      <div className="container pt-24 pb-16 space-y-14">
        {/* ===== queue ===== */}
        <section id="queue">
          <div className="flex items-center gap-2.5 mb-5">
            <StampIcon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Pending applications</h2>
            {pending.length > 0 && (
              <span className="font-mono text-[12px] text-primary">{pending.length} awaiting stamp</span>
            )}
          </div>

          {pendingQ.isLoading && (
            <div className="panel rounded-sm p-6 flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening the queue…
            </div>
          )}
          {!pendingQ.isLoading && pending.length === 0 && (
            <div className="panel rounded-sm p-8 text-center border-dashed">
              <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.25} />
              <p className="font-mono text-sm text-muted-foreground">The queue is clear. No applications await inspection.</p>
            </div>
          )}

          <div className="space-y-4">
            {pending.map((r) => (
              <div key={r.id} className="panel doc-corners rounded-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <span className="font-display font-semibold text-lg">{r.agentName}</span>
                      <span className="label-mono">{r.agentType}</span>
                      <Stamp tone="steel" className="text-[10px]">pending</Stamp>
                    </div>
                    <div className="font-mono text-[12px] text-muted-foreground">
                      applicant #{r.userId} · {r.ttlHours ? `TTL ${r.ttlHours}h` : "no expiry"} · filed{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.purpose && (
                      <div className="font-mono text-[12.5px] text-foreground/85 mt-2">
                        <span className="label-mono mr-2">purpose</span>
                        {r.purpose}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2.5">
                    <Button
                      onClick={() => approve.mutate({ requestId: r.id })}
                      disabled={approve.isPending}
                      className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px]"
                    >
                      {approve.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                      Approve &amp; mint
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDenyFor(r.id)}
                      className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px] border-[oklch(0.66_0.2_22)]/60 text-[oklch(0.66_0.2_22)] hover:bg-[oklch(0.66_0.2_22)]/10"
                    >
                      <X className="h-4 w-4 mr-1.5" /> Deny
                    </Button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-border/50">
                  <div>
                    <div className="label-mono mb-1.5">Tools requested</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(r.toolIds as string[]).map((id) => (
                        <span
                          key={id}
                          className={`font-mono text-[11px] px-2 py-1 border rounded-[3px] ${
                            toolSensitive(id)
                              ? "border-[oklch(0.66_0.2_22)]/50 text-[oklch(0.7_0.17_22)]"
                              : "border-border/70 text-muted-foreground"
                          }`}
                        >
                          {toolLabel(id)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label-mono mb-1.5">Vault keys granted</div>
                    {(r.secretKeys as string[]).length === 0 ? (
                      <span className="font-mono text-[12px] text-muted-foreground">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(r.secretKeys as string[]).map((k) => (
                          <span key={k} className="font-mono text-[11px] px-2 py-1 border border-primary/40 text-primary rounded-[3px]">
                            <KeyRound className="h-3 w-3 inline mr-1 -mt-0.5" />
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {decided.length > 0 && (
            <div className="mt-8">
              <div className="label-mono mb-2">Recent decisions</div>
              <div className="panel rounded-sm divide-y divide-border/50">
                {decided.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 font-mono text-[12px]">
                    <span className="text-foreground">{r.agentName}</span>
                    <span className="text-muted-foreground">{r.agentType}</span>
                    <span className="flex-1" />
                    {r.decidedBy && <span className="text-muted-foreground hidden sm:inline">by {r.decidedBy}</span>}
                    <Stamp tone={tone(r.status)} className="text-[9px] !px-1.5 !py-0.5">{r.status}</Stamp>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <Perforation />

        {/* ===== registry ===== */}
        <section id="registry">
          <div className="flex items-center gap-2.5 mb-5">
            <Database className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Passport registry</h2>
            <span className="font-mono text-[12px] text-muted-foreground">{passports.length} on file</span>
          </div>
          {passportsQ.isLoading && (
            <div className="panel rounded-sm p-6 flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the registry…
            </div>
          )}
          {!passportsQ.isLoading && passports.length === 0 && (
            <div className="panel rounded-sm p-8 text-center border-dashed">
              <p className="font-mono text-sm text-muted-foreground">No passports minted yet. Approve an application to mint the first.</p>
            </div>
          )}
          {passports.length > 0 && (
            <div className="panel rounded-sm overflow-x-auto">
              <table className="w-full font-mono text-[12px]">
                <thead>
                  <tr className="border-b border-border/70 text-left">
                    <th className="label-mono font-normal px-4 py-2.5">Passport</th>
                    <th className="label-mono font-normal px-4 py-2.5">Agent</th>
                    <th className="label-mono font-normal px-4 py-2.5 hidden sm:table-cell">Checksum</th>
                    <th className="label-mono font-normal px-4 py-2.5 hidden md:table-cell">Issued</th>
                    <th className="label-mono font-normal px-4 py-2.5 hidden md:table-cell">Expires</th>
                    <th className="label-mono font-normal px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {passports.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-2.5 text-primary whitespace-nowrap">{p.passportId}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-foreground">{p.agentName}</div>
                        <div className="text-muted-foreground text-[11px]">{p.agentType}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.checksum}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {new Date(p.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Stamp tone={tone(p.status)} className="text-[9px] !px-1.5 !py-0.5">{p.status}</Stamp>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {p.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRevokeFor(p.id)}
                            className="btn-press font-mono text-[11px] uppercase tracking-wider text-[oklch(0.7_0.17_22)] hover:text-[oklch(0.66_0.2_22)]"
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ===== deny dialog ===== */}
      <Dialog open={denyFor !== null} onOpenChange={(o) => !o && setDenyFor(null)}>
        <DialogContent className="panel rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Deny application</DialogTitle>
            <DialogDescription className="font-mono text-[13px]">
              State the reason for refusal. The owner will see it in their portal.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="e.g. sensitive tools without justified purpose"
            className="font-mono text-sm rounded-[3px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyFor(null)} className="btn-press font-mono text-xs uppercase tracking-wider rounded-[3px]">
              Cancel
            </Button>
            <Button
              disabled={deny.isPending || denyReason.trim().length < 2}
              onClick={() => denyFor !== null && deny.mutate({ requestId: denyFor, reason: denyReason.trim() })}
              className="btn-press font-mono text-xs uppercase tracking-wider rounded-[3px] bg-[oklch(0.66_0.2_22)] hover:bg-[oklch(0.6_0.19_22)] text-white"
            >
              {deny.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <X className="h-4 w-4 mr-1.5" />}
              Stamp DENIED
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== revoke dialog ===== */}
      <Dialog open={revokeFor !== null} onOpenChange={(o) => !o && setRevokeFor(null)}>
        <DialogContent className="panel rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Revoke passport</DialogTitle>
            <DialogDescription className="font-mono text-[13px]">
              Revocation is terminal. Every gate refuses this credential immediately.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="e.g. key rotation / agent decommissioned"
            className="font-mono text-sm rounded-[3px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeFor(null)} className="btn-press font-mono text-xs uppercase tracking-wider rounded-[3px]">
              Cancel
            </Button>
            <Button
              disabled={revoke.isPending || revokeReason.trim().length < 2}
              onClick={() => revokeFor !== null && revoke.mutate({ passportId: revokeFor, reason: revokeReason.trim() })}
              className="btn-press font-mono text-xs uppercase tracking-wider rounded-[3px] bg-[oklch(0.66_0.2_22)] hover:bg-[oklch(0.6_0.19_22)] text-white"
            >
              {revoke.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <X className="h-4 w-4 mr-1.5" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MrzStrip text="P<SPASS<<APPROVAL<DESK<<<INSPECT<STAMP<MINT<REVOKE<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" />
    </div>
  );
}
