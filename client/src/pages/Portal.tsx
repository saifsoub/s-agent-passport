/*
 * S/ Agent Passport — Owner Portal (real backend).
 * Manus OAuth login → owner file, sealed vault (trpc.vault), passport
 * applications (trpc.requests), issued passports (trpc.passports) with
 * dual downloads (owner PDF dossier + embeddable code bundle + .env).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MrzStrip, Perforation, Stamp } from "@/components/passport-ui";
import {
  buildEmbedBundle,
  buildEnvFile,
  buildOwnerDocumentHtml,
  downloadText,
  openPrintableDoc,
} from "@/lib/passportExports";
import {
  ArrowLeft,
  FileDown,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  ScanFace,
  Send,
  ShieldCheck,
  Stamp as StampIcon,
  Trash2,
  Vault,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  startRegistration as webauthnRegister,
  startAuthentication as webauthnAuthenticate,
} from "@simplewebauthn/browser";

const LOGO = "/manus-storage/s-slash-logo_80b146d9.png";

function statusStampTone(s: string): "ink" | "deny" | "steel" {
  if (s === "approved" || s === "active") return "ink";
  if (s === "denied" || s === "revoked" || s === "expired") return "deny";
  return "steel";
}

export default function Portal() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  /* ===== queries ===== */
  const utils = trpc.useUtils();
  const toolsQ = trpc.catalog.tools.useQuery(undefined, { staleTime: Infinity });
  const typesQ = trpc.catalog.agentTypes.useQuery(undefined, { staleTime: Infinity });
  const vaultQ = trpc.vault.list.useQuery(undefined, { enabled: isAuthenticated });
  const requestsQ = trpc.requests.mine.useQuery(undefined, { enabled: isAuthenticated });
  const securityQ = trpc.security.status.useQuery(undefined, { enabled: isAuthenticated });

  /* ===== vault state ===== */
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const addSecret = trpc.vault.add.useMutation({
    onSuccess: () => {
      utils.vault.list.invalidate();
      setNewKey("");
      setNewVal("");
      toast.success("Secret sealed in your vault.");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeSecret = trpc.vault.remove.useMutation({
    onSuccess: () => utils.vault.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  /* ===== request form state ===== */
  const [agentName, setAgentName] = useState("");
  const [agentType, setAgentType] = useState("researcher");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [grantedKeys, setGrantedKeys] = useState<string[]>([]);
  const [ttl, setTtl] = useState("");
  const [purpose, setPurpose] = useState("");
  const submitReq = trpc.requests.submit.useMutation({
    onSuccess: () => {
      utils.requests.mine.invalidate();
      setAgentName("");
      setSelectedTools([]);
      setGrantedKeys([]);
      setTtl("");
      setPurpose("");
      toast.success("Application submitted. It now awaits a stamp at the approval desk.");
    },
    onError: (e) => toast.error(e.message),
  });

  const toolGroups = useMemo(() => {
    const groups: Record<string, NonNullable<typeof toolsQ.data>> = {};
    for (const t of toolsQ.data ?? []) {
      (groups[t.group] ??= []).push(t);
    }
    return groups;
  }, [toolsQ.data]);

  const toggleTool = (id: string) =>
    setSelectedTools((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleKey = (k: string) =>
    setGrantedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const doSubmit = () => {
    if (agentName.trim().length < 2) return toast.error("Give your agent a name (min 2 characters).");
    if (selectedTools.length === 0) return toast.error("Select at least one tool.");
    submitReq.mutate({
      agentName: agentName.trim(),
      agentType: agentType as never,
      toolIds: selectedTools,
      secretKeys: grantedKeys,
      ttlHours: ttl ? Number(ttl) : null,
      purpose,
    });
  };

  /* ===== security: passkeys + vault lock ===== */
  const [passkeyLabel, setPasskeyLabel] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const registerOptions = trpc.security.registerOptions.useMutation();
  const registerVerify = trpc.security.registerVerify.useMutation();
  const authOptions = trpc.security.authOptions.useMutation();
  const authVerify = trpc.security.authVerify.useMutation();
  const removeKey = trpc.security.removePasskey.useMutation({
    onSuccess: () => {
      utils.security.status.invalidate();
      toast.success("Passkey removed.");
    },
    onError: (e) => toast.error(e.message),
  });
  const setLock = trpc.security.setVaultLock.useMutation({
    onSuccess: (r) => {
      utils.security.status.invalidate();
      toast.success(r.enabled ? "Vault lock armed — passkey required for exports." : "Vault lock disabled.");
    },
    onError: (e) => toast.error(e.message),
  });

  const enrollPasskey = async () => {
    setEnrolling(true);
    try {
      const options = await registerOptions.mutateAsync();
      const attResp = await webauthnRegister({ optionsJSON: options as never });
      await registerVerify.mutateAsync({ response: attResp, label: passkeyLabel.trim() || null });
      setPasskeyLabel("");
      utils.security.status.invalidate();
      toast.success("Passkey enrolled — Face ID / fingerprint is now available.");
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg.includes("NotAllowedError") || (e as Error).name === "NotAllowedError") {
        toast.error("Enrollment cancelled.");
      } else {
        toast.error(msg || "Could not enroll passkey on this device.");
      }
    } finally {
      setEnrolling(false);
    }
  };

  const verifyPasskey = async (): Promise<boolean> => {
    setUnlocking(true);
    try {
      const options = await authOptions.mutateAsync();
      const asseResp = await webauthnAuthenticate({ optionsJSON: options as never });
      await authVerify.mutateAsync({ response: asseResp });
      utils.security.status.invalidate();
      toast.success("Identity verified — vault unlocked for 5 minutes.");
      return true;
    } catch (e) {
      const err = e as Error;
      toast.error(err.name === "NotAllowedError" ? "Verification cancelled." : err.message || "Verification failed.");
      return false;
    } finally {
      setUnlocking(false);
    }
  };

  /* ===== downloads ===== */
  const [exportingId, setExportingId] = useState<number | null>(null);
  const fetchExportWithUnlock = async (passportRowId: number) => {
    try {
      return await utils.passports.exportData.fetch({ id: passportRowId });
    } catch (e) {
      // Vault lock engaged → run the biometric ceremony, then retry once.
      if ((e as Error).message.includes("Vault lock")) {
        toast("Vault lock is on", { description: "Verify with Face ID / fingerprint to continue." });
        const ok = await verifyPasskey();
        if (!ok) throw new Error("Passkey verification required to export.");
        return await utils.passports.exportData.fetch({ id: passportRowId });
      }
      throw e;
    }
  };
  const doDownload = async (passportRowId: number, kind: "pdf" | "embed" | "env") => {
    setExportingId(passportRowId);
    try {
      const data = await fetchExportWithUnlock(passportRowId);
      const tools = (toolsQ.data ?? []).filter((t) =>
        (data.passport.capabilities ?? []).includes(t.capability),
      );
      if (kind === "pdf") {
        const ok = openPrintableDoc(buildOwnerDocumentHtml(data, tools));
        if (!ok) toast.error("Popup blocked — allow popups to open the document.");
      } else if (kind === "embed") {
        downloadText(`${data.passport.passport_id.toLowerCase()}_passport.py`, buildEmbedBundle(data), "text/x-python");
        toast.success("Embed bundle downloaded.");
      } else {
        downloadText(`${data.passport.passport_id.toLowerCase()}.env`, buildEnvFile(data));
        toast.success(".env with sealed vault values downloaded — keep it private.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  /* ===== render ===== */
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="border-b border-border/60">
          <div className="container flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2.5">
              <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
              <span className="font-display font-bold tracking-tight">Agent Passport</span>
            </Link>
            <Link href="/" className="label-mono hover:text-primary transition-colors inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="panel doc-corners rounded-sm p-10 max-w-md w-full text-center">
            <img src={LOGO} alt="S/" className="h-12 w-12 object-contain mx-auto mb-5" />
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-3">Owner identification</h1>
            <p className="font-mono text-[13px] text-muted-foreground leading-relaxed mb-7">
              The portal is a controlled area. Present your identity to open your
              owner file, seal secrets, and apply for agent passports.
            </p>
            <Button
              size="lg"
              className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] h-11"
              onClick={() => startLogin()}
            >
              <ShieldCheck className="h-4 w-4 mr-2" /> Identify yourself
            </Button>
          </div>
        </div>
        <MrzStrip text="P<SPASS<<OWNER<IDENTIFICATION<REQUIRED<<<CONTROLLED<AREA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" />
      </div>
    );
  }

  const secrets = vaultQ.data ?? [];
  const requests = requestsQ.data ?? [];
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const activePassports = requests.filter((r) => r.passport?.status === "active").length;
  const deniedCount = requests.filter((r) => r.status === "denied").length;
  const recentActivity = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== header ===== */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="container flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold tracking-tight">Owner Portal</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 label-mono">
            <a href="#dashboard" className="hover:text-primary transition-colors">Dashboard</a>
            <a href="#vault" className="hover:text-primary transition-colors">Vault</a>
            <a href="#apply" className="hover:text-primary transition-colors">Apply</a>
            <a href="#applications" className="hover:text-primary transition-colors">Applications</a>
            <a href="#security" className="hover:text-primary transition-colors">Security</a>
            {user?.role === "admin" && (
              <Link href="/admin" className="text-primary hover:text-primary/80 transition-colors">Approval desk</Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="label-mono hidden sm:inline">{user?.name}</span>
            <Button
              size="sm"
              variant="outline"
              className="btn-press font-mono text-xs uppercase tracking-wider rounded-[3px]"
              onClick={() => logout()}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="container pt-24 pb-16 space-y-14">
        {/* ===== owner dashboard / command deck ===== */}
        <section id="dashboard" className="space-y-5">
          <div className="panel doc-corners rounded-sm p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1">
              <div className="label-mono mb-1">Owner file</div>
              <div className="font-display text-2xl font-bold tracking-tight">{user?.name || "Owner"}</div>
              <div className="font-mono text-[12px] text-muted-foreground mt-1">
                Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                {pendingCount > 0 && <span className="text-primary"> · {pendingCount} awaiting stamp</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="btn-press font-mono text-[11px] uppercase tracking-wider rounded-[3px]"
                onClick={() => document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" })}
              >
                <StampIcon className="h-3.5 w-3.5 mr-1.5" /> New application
              </Button>
              <Stamp tone="ink" className="text-sm">File open</Stamp>
            </div>
          </div>

          {/* stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Active passports",
                value: activePassports,
                icon: ShieldCheck,
                tone: activePassports > 0 ? "text-primary" : "text-muted-foreground",
                href: "#applications",
              },
              {
                label: "Sealed secrets",
                value: secrets.length,
                icon: Vault,
                tone: "text-foreground",
                href: "#vault",
              },
              {
                label: "Awaiting stamp",
                value: pendingCount,
                icon: Clock,
                tone: pendingCount > 0 ? "text-primary" : "text-muted-foreground",
                href: "#applications",
              },
              {
                label: "Denied",
                value: deniedCount,
                icon: FileText,
                tone: deniedCount > 0 ? "text-[oklch(0.7_0.17_22)]" : "text-muted-foreground",
                href: "#applications",
              },
            ].map(({ label, value, icon: Icon, tone, href }) => (
              <a
                key={label}
                href={href}
                className="panel rounded-sm p-4 flex items-center gap-4 hover:border-primary/50 transition-colors"
              >
                <Icon className={`h-5 w-5 shrink-0 ${tone}`} strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className={`font-display text-2xl font-bold leading-none ${tone}`}>{value}</div>
                  <div className="label-mono mt-1">{label}</div>
                </div>
              </a>
            ))}
          </div>

          {/* recent activity */}
          {recentActivity.length > 0 && (
            <div className="panel rounded-sm">
              <div className="px-4 py-2.5 border-b border-border/60 label-mono">Recent activity</div>
              <div className="divide-y divide-border/50">
                {recentActivity.map((r) => (
                  <a
                    key={r.id}
                    href="#applications"
                    className="flex items-center gap-3 px-4 py-2.5 font-mono text-[12px] hover:bg-secondary/40 transition-colors"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-foreground truncate">{r.agentName}</span>
                    {r.passport && <span className="text-primary truncate hidden sm:inline">{r.passport.passportId}</span>}
                    <span className="flex-1" />
                    <Stamp tone={statusStampTone(r.status)} className="text-[9px] !px-1.5 !py-0.5">
                      {r.status}
                    </Stamp>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ===== vault ===== */}
        <section id="vault">
          <div className="flex items-center gap-2.5 mb-5">
            <Vault className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Private vault</h2>
          </div>
          <div className="grid lg:grid-cols-[400px_1fr] gap-8 items-start">
            <div className="panel rounded-sm p-5 space-y-4">
              <div>
                <div className="label-mono mb-1.5">Key name</div>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                  placeholder="OPENAI_API_KEY"
                  className="font-mono text-sm rounded-[3px]"
                />
              </div>
              <div>
                <div className="label-mono mb-1.5">Secret value</div>
                <Input
                  type="password"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder="sk-…"
                  className="font-mono text-sm rounded-[3px]"
                />
              </div>
              <Button
                onClick={() => {
                  if (!newKey || !newVal) return toast.error("Both key name and value are required.");
                  addSecret.mutate({ keyName: newKey, value: newVal });
                }}
                disabled={addSecret.isPending}
                className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] h-10"
              >
                {addSecret.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Seal in vault
              </Button>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                Values are encrypted at rest (AES-256-GCM) and never printed in any
                passport document. Agents receive them as environment variables.
              </p>
            </div>
            <div className="panel rounded-sm divide-y divide-border/50 min-h-[120px]">
              {vaultQ.isLoading && (
                <div className="p-5 flex items-center gap-2 font-mono text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening vault…
                </div>
              )}
              {!vaultQ.isLoading && secrets.length === 0 && (
                <div className="p-5 font-mono text-sm text-muted-foreground">
                  Vault is empty. Seal your first secret — you'll never paste it again.
                </div>
              )}
              {secrets.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <KeyRound className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px] text-foreground">{s.keyName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate">{s.masked}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-press text-muted-foreground hover:text-[oklch(0.66_0.2_22)]"
                    onClick={() => removeSecret.mutate({ id: s.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Perforation />

        {/* ===== apply ===== */}
        <section id="apply">
          <div className="flex items-center gap-2.5 mb-5">
            <StampIcon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Passport application</h2>
          </div>
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
            <div className="panel rounded-sm p-5 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="label-mono mb-1.5">Agent name</div>
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="research_agent_01"
                    className="font-mono text-sm rounded-[3px]"
                  />
                </div>
                <div>
                  <div className="label-mono mb-1.5">Agent type</div>
                  <select
                    value={agentType}
                    onChange={(e) => setAgentType(e.target.value)}
                    className="w-full h-9 bg-transparent border border-input rounded-[3px] font-mono text-sm px-2.5 text-foreground"
                  >
                    {(typesQ.data ?? []).map((t) => (
                      <option key={t} value={t} className="bg-background">{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="label-mono mb-2">Tools requested</div>
                <div className="space-y-4">
                  {Object.entries(toolGroups).map(([group, tools]) => (
                    <div key={group}>
                      <div className="font-mono text-[11px] uppercase tracking-widest text-primary/80 mb-1.5">{group}</div>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {tools.map((t) => (
                          <label
                            key={t.id}
                            className={`flex items-start gap-2.5 font-mono text-[12.5px] px-3 py-2 border rounded-[3px] cursor-pointer transition-colors ${
                              selectedTools.includes(t.id)
                                ? "border-primary/60 bg-primary/8 text-foreground"
                                : "border-border/60 text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <Checkbox
                              checked={selectedTools.includes(t.id)}
                              onCheckedChange={() => toggleTool(t.id)}
                              className="mt-0.5"
                            />
                            <span>
                              {t.label}
                              {t.sensitive && <span className="text-[oklch(0.7_0.17_22)] ml-1.5 text-[10px] uppercase">sensitive</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="label-mono mb-2">Vault keys granted (names only)</div>
                {secrets.length === 0 ? (
                  <p className="font-mono text-[12px] text-muted-foreground">No secrets in your vault yet — seal one above to grant it here.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {secrets.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleKey(s.keyName)}
                        className={`btn-press font-mono text-[11px] px-3 py-1.5 border rounded-[3px] transition-colors ${
                          grantedKeys.includes(s.keyName)
                            ? "border-primary text-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <KeyRound className="h-3 w-3 inline mr-1.5 -mt-0.5" />
                        {s.keyName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="label-mono mb-1.5">TTL hours (optional)</div>
                  <Input
                    value={ttl}
                    onChange={(e) => setTtl(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="∞"
                    className="font-mono text-sm rounded-[3px]"
                  />
                </div>
                <div>
                  <div className="label-mono mb-1.5">Purpose</div>
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="What will this agent do?"
                    className="font-mono text-sm rounded-[3px]"
                  />
                </div>
              </div>

              <Button
                onClick={doSubmit}
                disabled={submitReq.isPending}
                className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] h-11"
              >
                {submitReq.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Submit application
              </Button>
            </div>

            <div className="panel doc-corners rounded-sm p-5">
              <div className="label-mono mb-3">What happens next</div>
              <ol className="space-y-3 font-mono text-[12.5px] text-muted-foreground leading-relaxed list-none">
                <li><span className="text-primary mr-2">01</span>Your application lands at the approval desk as <span className="text-foreground">PENDING</span>.</li>
                <li><span className="text-primary mr-2">02</span>An inspector reviews the tools, flags, and vault grants.</li>
                <li><span className="text-primary mr-2">03</span>On <span className="text-primary">APPROVED</span>, the passport is minted, checksummed, and signed by the registry.</li>
                <li><span className="text-primary mr-2">04</span>Download the owner dossier (PDF) and the embed bundle for your agent's code below.</li>
              </ol>
            </div>
          </div>
        </section>

        <Perforation />

        {/* ===== applications & passports ===== */}
        <section id="applications">
          <div className="flex items-center gap-2.5 mb-5">
            <FileText className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Applications &amp; passports</h2>
          </div>
          {requestsQ.isLoading && (
            <div className="panel rounded-sm p-6 flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pulling your file…
            </div>
          )}
          {!requestsQ.isLoading && requests.length === 0 && (
            <div className="panel rounded-sm p-8 text-center border-dashed">
              <p className="font-mono text-sm text-muted-foreground">No applications on file yet. Submit your first above.</p>
            </div>
          )}
          <div className="space-y-4">
            {requests.map((r) => (
              <div key={r.id} className="panel rounded-sm p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-1.5">
                      <span className="font-display font-semibold text-lg">{r.agentName}</span>
                      <span className="label-mono">{r.agentType}</span>
                      {r.passport && <span className="font-mono text-[12px] text-primary">{r.passport.passportId}</span>}
                    </div>
                    <div className="font-mono text-[12px] text-muted-foreground">
                      {(r.toolIds as string[]).length} tool{(r.toolIds as string[]).length === 1 ? "" : "s"} ·{" "}
                      {(r.secretKeys as string[]).length} vault key{(r.secretKeys as string[]).length === 1 ? "" : "s"} ·{" "}
                      {r.ttlHours ? `TTL ${r.ttlHours}h` : "no expiry"} · submitted{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.status === "denied" && r.denialReason && (
                      <div className="mt-2 font-mono text-[12px] text-[oklch(0.7_0.17_22)]">
                        Denial reason: {r.denialReason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {r.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                    <Stamp tone={statusStampTone(r.status)} className="text-xs">
                      {r.status}
                    </Stamp>
                  </div>
                </div>

                {r.passport && (
                  <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-2.5">
                    <span className="label-mono mr-1">Downloads</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={exportingId === r.passport.id}
                      onClick={() => doDownload(r.passport!.id, "pdf")}
                      className="btn-press font-mono text-[11px] uppercase tracking-wider rounded-[3px]"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> Owner dossier (PDF)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={exportingId === r.passport.id}
                      onClick={() => doDownload(r.passport!.id, "embed")}
                      className="btn-press font-mono text-[11px] uppercase tracking-wider rounded-[3px]"
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> Embed bundle (.py)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={exportingId === r.passport.id}
                      onClick={() => doDownload(r.passport!.id, "env")}
                      className="btn-press font-mono text-[11px] uppercase tracking-wider rounded-[3px]"
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Vault .env
                    </Button>
                    {r.passport.status !== "active" && (
                      <Stamp tone="deny" className="text-[10px]">{r.passport.status}</Stamp>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <Perforation />

        {/* ===== security: passkeys + vault lock ===== */}
        <section id="security">
          <div className="flex items-center gap-2.5 mb-5">
            <Fingerprint className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Security &amp; biometrics</h2>
            {securityQ.data?.vaultLockEnabled && (
              <Stamp tone={securityQ.data.unlocked ? "ink" : "steel"} className="text-[10px]">
                {securityQ.data.unlocked ? "unlocked" : "lock armed"}
              </Stamp>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* enroll + list */}
            <div className="panel rounded-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ScanFace className="h-4 w-4 text-primary" />
                <span className="label-mono text-foreground/90">Passkeys · Face ID / fingerprint / security key</span>
              </div>
              <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">
                Enroll this device's biometrics as a passkey. Nothing biometric leaves your device —
                the portal only receives a cryptographic signature.
              </p>
              <div className="flex gap-2.5">
                <Input
                  value={passkeyLabel}
                  onChange={(e) => setPasskeyLabel(e.target.value)}
                  placeholder="Label, e.g. MacBook Touch ID"
                  className="font-mono text-sm rounded-[3px]"
                />
                <Button
                  onClick={enrollPasskey}
                  disabled={enrolling}
                  className="btn-press font-mono uppercase tracking-wider text-[11px] rounded-[3px] shrink-0"
                >
                  {enrolling ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Enroll
                </Button>
              </div>

              <div className="space-y-2">
                {(securityQ.data?.passkeys ?? []).length === 0 && (
                  <p className="font-mono text-[12px] text-muted-foreground border border-dashed border-border/60 rounded-[3px] p-3">
                    No passkeys enrolled yet.
                  </p>
                )}
                {(securityQ.data?.passkeys ?? []).map((k) => (
                  <div key={k.id} className="flex items-center gap-3 border border-border/60 rounded-[3px] px-3 py-2">
                    <Fingerprint className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] truncate">{k.label || "Unnamed passkey"}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {k.deviceType === "multiDevice" ? "synced" : "device-bound"} · enrolled{" "}
                        {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeKey.mutate({ id: k.id })}
                      className="btn-press text-muted-foreground hover:text-[oklch(0.66_0.2_22)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* vault lock */}
            <div className="panel rounded-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="label-mono text-foreground/90">Vault lock</span>
              </div>
              <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">
                When armed, exporting anything that carries real secret values — the vault{" "}
                <span className="text-foreground">.env</span>, the embed bundle, or the owner dossier —
                first requires a passkey verification on this device. The unlock lasts 5 minutes.
              </p>
              <div className="flex items-center justify-between border border-border/60 rounded-[3px] px-4 py-3">
                <div className="font-mono text-[13px]">
                  Require Face ID / fingerprint for exports
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    {securityQ.data?.passkeyCount
                      ? `${securityQ.data.passkeyCount} passkey${securityQ.data.passkeyCount === 1 ? "" : "s"} enrolled`
                      : "Enroll a passkey first"}
                  </div>
                </div>
                <Switch
                  checked={!!securityQ.data?.vaultLockEnabled}
                  disabled={setLock.isPending || !securityQ.data}
                  onCheckedChange={(v) => setLock.mutate({ enabled: v })}
                />
              </div>
              {securityQ.data?.vaultLockEnabled && !securityQ.data.unlocked && (
                <Button
                  onClick={verifyPasskey}
                  disabled={unlocking}
                  variant="outline"
                  className="btn-press w-full font-mono uppercase tracking-wider text-[11px] rounded-[3px] border-primary/50 text-primary hover:bg-primary/10"
                >
                  {unlocking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ScanFace className="h-3.5 w-3.5 mr-1.5" />}
                  Verify now &amp; unlock
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <MrzStrip text="P<SPASS<<OWNER<PORTAL<<<VAULT<SEALED<<<PASSKEY<ARMED<<<APPLICATIONS<ON<FILE<<<<<<<<<<<<<" />
    </div>
  );
}
