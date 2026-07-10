/*
 * Border Control Terminal · Owner Console page
 * Style: navy sovereign field, soft copper stamp ink, MRZ strips, rubber stamps,
 * Space Grotesk display + IBM Plex Mono data. Ledger-rail sections.
 * Owner identity → private secrets vault → passport request desk → issued documents
 * with dual downloads (owner PDF document + embeddable code bundle).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MrzStrip,
  PassportCard,
  Perforation,
  Section,
  Stamp,
} from "@/components/passport-ui";
import { AGENT_TYPES, type AgentType } from "@/lib/passport";
import {
  TOOL_CATALOG,
  type OwnerProfile,
  type VaultSecret,
  type PassportRequest,
  loadOwner,
  createOwner,
  loadVault,
  saveVault,
  maskSecret,
  loadRequests,
  submitRequest,
  deleteRequest,
  buildEmbedBundle,
  openOwnerPdf,
  downloadText,
} from "@/lib/ownerConsole";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  FileText,
  FileCode2,
  KeyRound,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  UserRound,
  Vault,
} from "lucide-react";

const LOGO = "/manus-storage/s-slash-logo_80b146d9.png";

const GROUP_LABELS: Record<string, string> = {
  research: "Research",
  data: "Data",
  content: "Content",
  execution: "Execution",
  memory: "Memory",
};

export default function OwnerConsole() {
  /* ===== Owner identity ===== */
  const [owner, setOwner] = useState<OwnerProfile | null>(() => loadOwner());
  const [nameInput, setNameInput] = useState("");

  /* ===== Vault ===== */
  const [vault, setVault] = useState<VaultSecret[]>(() => loadVault());
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  /* ===== Request form ===== */
  const [agentName, setAgentName] = useState("my_agent_v1");
  const [agentType, setAgentType] = useState<AgentType>("researcher");
  const [purpose, setPurpose] = useState("");
  const [ttl, setTtl] = useState<string>("");
  const [toolIds, setToolIds] = useState<Set<string>>(new Set());
  const [grantKeys, setGrantKeys] = useState<Set<string>>(new Set());

  /* ===== Issued requests ===== */
  const [requests, setRequests] = useState<PassportRequest[]>(() => loadRequests());

  const groups = useMemo(() => {
    const g: Record<string, typeof TOOL_CATALOG> = {};
    for (const t of TOOL_CATALOG) (g[t.group] ??= []).push(t);
    return g;
  }, []);

  const sensitiveCount = useMemo(
    () => TOOL_CATALOG.filter((t) => toolIds.has(t.id) && t.sensitive).length,
    [toolIds],
  );

  const registerOwner = () => {
    if (!nameInput.trim()) {
      toast.error("Enter your name to register as an owner.");
      return;
    }
    const o = createOwner(nameInput);
    setOwner(o);
    toast.success(`Owner file opened · ${o.owner_id}`);
  };

  const addSecret = () => {
    const key = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!key || !newVal.trim()) {
      toast.error("Both key name and value are required.");
      return;
    }
    if (vault.some((s) => s.key === key)) {
      toast.error(`${key} already exists in your vault.`);
      return;
    }
    const next = [...vault, { key, value: newVal, added_at: new Date().toISOString() }];
    setVault(next);
    saveVault(next);
    setNewKey("");
    setNewVal("");
    toast.success(`${key} sealed in your vault.`);
  };

  const removeSecret = (key: string) => {
    const next = vault.filter((s) => s.key !== key);
    setVault(next);
    saveVault(next);
    setGrantKeys((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });
    toast(`${key} destroyed.`);
  };

  const toggleTool = (id: string) =>
    setToolIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleGrant = (key: string) =>
    setGrantKeys((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const submit = () => {
    if (!owner) return;
    if (!agentName.trim()) {
      toast.error("Agent name is required.");
      return;
    }
    if (toolIds.size === 0) {
      toast.error("Select at least one tool for your agent.");
      return;
    }
    const req = submitRequest({
      owner,
      agent_name: agentName.trim().toLowerCase().replace(/\s+/g, "_"),
      agent_type: agentType,
      tool_ids: Array.from(toolIds),
      secret_keys: Array.from(grantKeys),
      ttl_hours: ttl ? Number(ttl) : null,
      purpose: purpose.trim(),
    });
    setRequests(loadRequests());
    setToolIds(new Set());
    setGrantKeys(new Set());
    setPurpose("");
    toast.success(`APPROVED · ${req.passport.passport_id} issued.`);
  };

  const removeRequest = (id: string) => {
    deleteRequest(id);
    setRequests(loadRequests());
    toast("Request removed from your file.");
  };

  const downloadEmbed = (req: PassportRequest) => {
    downloadText(`${req.passport.passport_id.toLowerCase()}_passport.py`, buildEmbedBundle(req), "text/x-python");
    toast.success("Embed bundle downloaded — drop it next to your agent code.");
  };

  const downloadPdf = (req: PassportRequest) => {
    const ok = openOwnerPdf(req);
    if (ok) toast.success("Document opened — use the print dialog to save as PDF.");
    else toast.error("Popup blocked — allow popups for this site and retry.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== NAV ===== */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/70">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold tracking-tight">Agent Passport</span>
            <span className="label-mono text-primary hidden sm:inline">Owner Console</span>
          </Link>
          <Link href="/" className="label-mono inline-flex items-center gap-2 hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to checkpoint
          </Link>
        </div>
      </header>

      {/* ===== HERO strip ===== */}
      <div className="border-b border-border/70 relative overflow-hidden">
        <div className="container py-14 sm:py-20 relative">
          <span className="slash-watermark top-2 right-4 text-[9rem] hidden md:block" aria-hidden>S/</span>
          <p className="label-mono text-primary mb-3">S-OS · Owner services desk</p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight uppercase leading-[1.02] max-w-3xl">
            Your file. Your vault. <br className="hidden sm:block" />Your agents' papers.
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-5 max-w-xl leading-relaxed">
            Open an owner file, seal secret keys in a private vault, and request
            passports scoped to exactly the tools your agents need — nothing more.
          </p>
        </div>
        <MrzStrip text="P<SPASS<<OWNER<CONSOLE<<<VAULT<SEALED<<<REQUEST<DESK<OPEN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<" />
      </div>

      {/* ===== 01 · OWNER FILE ===== */}
      <Section id="identity" index="01" code="FILE·01/04" kicker="Owner identity" title="Open your owner file.">
        {owner ? (
          <div className="panel doc-corners rounded-sm p-5 sm:p-6 max-w-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-12 w-12 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                  <UserRound className="h-6 w-6 text-primary" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold truncate">{owner.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {owner.owner_id} · on file since {new Date(owner.created_at).toISOString().slice(0, 10)}
                  </div>
                </div>
              </div>
              <Stamp className="text-[10px] shrink-0">ON FILE</Stamp>
            </div>
          </div>
        ) : (
          <div className="panel doc-corners rounded-sm p-5 sm:p-6 max-w-xl space-y-4">
            <p className="font-mono text-sm text-muted-foreground">
              No owner file found on this device. Register to unlock the vault and request desk.
            </p>
            <div className="flex gap-2.5 flex-wrap">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your full name"
                className="font-mono rounded-[3px] max-w-xs"
                onKeyDown={(e) => e.key === "Enter" && registerOwner()}
              />
              <Button onClick={registerOwner} className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px]">
                Open owner file
              </Button>
            </div>
          </div>
        )}
      </Section>

      <MrzStrip text="P<SPASS<<PRIVATE<VAULT<<<SECRETS<SEALED<LOCALLY<<<NEVER<PRINTED<IN<DOCUMENTS<<<<<<<<<<<" />

      {/* ===== 02 · VAULT ===== */}
      <Section id="vault" index="02" code="VAULT·02/04" kicker="Private space · secret keys" title="Seal your secret keys.">
        <div className={`grid lg:grid-cols-[420px_1fr] gap-10 items-start ${!owner ? "opacity-40 pointer-events-none select-none" : ""}`}>
          <div className="panel doc-corners rounded-sm p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Vault className="h-4 w-4 text-primary" />
              <span className="label-mono text-foreground/90">Add a secret</span>
            </div>
            <div className="space-y-2.5">
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="KEY_NAME · e.g. OPENAI_API_KEY"
                className="font-mono rounded-[3px] uppercase"
              />
              <Input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="secret value"
                type="password"
                className="font-mono rounded-[3px]"
                onKeyDown={(e) => e.key === "Enter" && addSecret()}
              />
              <Button onClick={addSecret} className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px]">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Seal in vault
              </Button>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              <Lock className="h-3 w-3 inline mr-1 -mt-0.5" />
              Values live only in this browser's storage. Passport documents and embed
              bundles carry key <em>names</em> — never values. Agents receive them as
              environment variables at runtime.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="label-mono mb-1">Vault contents · {vault.length}</div>
            {vault.length === 0 && (
              <div className="panel rounded-sm min-h-[140px] flex items-center justify-center border-dashed">
                <p className="font-mono text-sm text-muted-foreground">Vault is empty. Seal your first key.</p>
              </div>
            )}
            {vault.map((s) => (
              <div key={s.key} className="panel rounded-sm px-4 py-3 flex items-center gap-3 flex-wrap">
                <KeyRound className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono text-sm font-semibold text-foreground">{s.key}</span>
                <span className="font-mono text-xs text-muted-foreground flex-1 min-w-[120px] truncate">
                  {revealed[s.key] ? s.value : maskSecret(s.value)}
                </span>
                <button
                  onClick={() => setRevealed((r) => ({ ...r, [s.key]: !r[s.key] }))}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="toggle reveal"
                >
                  {revealed[s.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => removeSecret(s.key)}
                  className="text-muted-foreground hover:text-[oklch(0.66_0.2_22)] transition-colors"
                  aria-label="delete secret"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Perforation />

      {/* ===== 03 · REQUEST DESK ===== */}
      <Section id="request" index="03" code="DESK·03/04" kicker="Request desk" title="Request a passport. Scope the tools.">
        <div className={`grid lg:grid-cols-[1fr_420px] gap-10 items-start ${!owner ? "opacity-40 pointer-events-none select-none" : ""}`}>
          {/* tools */}
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
              {Object.entries(groups).map(([g, tools]) => (
                <div key={g}>
                  <div className="label-mono text-primary mb-2.5">{GROUP_LABELS[g]} tools</div>
                  <div className="space-y-2">
                    {tools.map((t) => (
                      <label
                        key={t.id}
                        className={`flex items-start gap-2.5 p-2.5 border rounded-[3px] transition-colors cursor-pointer ${
                          toolIds.has(t.id) ? "border-primary/60 bg-primary/5" : "border-border/70 hover:border-primary/30"
                        }`}
                      >
                        <Checkbox
                          checked={toolIds.has(t.id)}
                          onCheckedChange={() => toggleTool(t.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="font-mono text-[13px] text-foreground flex items-center gap-1.5 flex-wrap">
                            {t.label}
                            {t.sensitive && (
                              <span className="label-mono text-[9px] text-[oklch(0.7_0.15_45)] border border-[oklch(0.7_0.15_45)]/40 px-1 py-px rounded-[2px]">
                                SENSITIVE
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground block">{t.blurb}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* vault grants */}
            <div className="panel rounded-sm p-4">
              <div className="label-mono text-primary mb-2.5 flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" /> Grant vault secrets to this agent
              </div>
              {vault.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground">
                  Vault is empty — seal keys above to make them grantable.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {vault.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggleGrant(s.key)}
                      className={`btn-press font-mono text-[11px] px-2.5 py-1.5 border rounded-[3px] transition-colors ${
                        grantKeys.has(s.key)
                          ? "border-primary text-primary bg-primary/10"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {s.key}
                    </button>
                  ))}
                </div>
              )}
              <p className="font-mono text-[11px] text-muted-foreground mt-2.5">
                Granted names are listed in the passport metadata; values are provisioned
                as env vars at runtime, on top of the regular tools.
              </p>
            </div>
          </div>

          {/* form */}
          <div className="panel doc-corners rounded-sm p-5 space-y-4 lg:sticky lg:top-24">
            <div className="label-mono text-foreground/90">Application form</div>
            <div className="space-y-2.5">
              <div>
                <div className="label-mono mb-1">Agent name</div>
                <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="font-mono rounded-[3px]" />
              </div>
              <div>
                <div className="label-mono mb-1">Agent type</div>
                <Select value={agentType} onValueChange={(v) => setAgentType(v as AgentType)}>
                  <SelectTrigger className="font-mono rounded-[3px] w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="font-mono">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="label-mono mb-1">Purpose (goes on the document)</div>
                <Textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What will this agent do for you?"
                  className="font-mono rounded-[3px] min-h-[70px]"
                />
              </div>
              <div>
                <div className="label-mono mb-1">TTL hours (blank = never expires)</div>
                <Input
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 24"
                  className="font-mono rounded-[3px]"
                />
              </div>
            </div>

            <div className="cutline" />
            <div className="font-mono text-[12px] text-muted-foreground space-y-1">
              <div>tools selected · <span className="text-foreground">{toolIds.size}</span></div>
              <div>vault secrets granted · <span className="text-foreground">{grantKeys.size}</span></div>
              {sensitiveCount > 0 && (
                <div className="flex items-center gap-1.5 text-[oklch(0.7_0.15_45)]">
                  <ShieldAlert className="h-3.5 w-3.5" /> {sensitiveCount} sensitive tool
                  {sensitiveCount > 1 ? "s" : ""} → permission flags required
                </div>
              )}
            </div>
            <Button onClick={submit} className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px]">
              Submit application
            </Button>
          </div>
        </div>
      </Section>

      <MrzStrip text="P<SPASS<<ISSUED<DOCUMENTS<<<PDF<FOR<THE<OWNER<<<EMBED<BUNDLE<FOR<THE<AGENT<<<<<<<<<<<<" />

      {/* ===== 04 · ISSUED PAPERS ===== */}
      <Section id="papers" index="04" code="DOCS·04/04" kicker="Issued papers" title="Two documents. One credential.">
        <p className="font-mono text-[13px] text-muted-foreground leading-relaxed max-w-2xl -mt-4 mb-8">
          Every approved application yields the same credential in two forms: a{" "}
          <span className="text-foreground">PDF document</span> giving you the full
          picture of what is inside the passport, and an{" "}
          <span className="text-foreground">embed bundle</span> — a Python module you
          drop into the agent's code so it carries its papers everywhere.
        </p>

        {requests.length === 0 ? (
          <div className="panel rounded-sm min-h-[180px] flex flex-col items-center justify-center gap-3 border-dashed">
            <FileText className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
            <p className="font-mono text-sm text-muted-foreground">No papers issued yet. Submit an application above.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {requests.map((req) => (
              <div key={req.request_id} className="space-y-3 min-w-0">
                <PassportCard passport={req.passport} compact />
                <div className="flex gap-2.5 flex-wrap">
                  <Button
                    onClick={() => downloadPdf(req)}
                    variant="outline"
                    className="btn-press flex-1 min-w-[180px] font-mono uppercase tracking-widest text-[11px] rounded-[3px] border-primary/50 text-primary hover:bg-primary/10"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Owner document · PDF
                  </Button>
                  <Button
                    onClick={() => downloadEmbed(req)}
                    variant="outline"
                    className="btn-press flex-1 min-w-[180px] font-mono uppercase tracking-widest text-[11px] rounded-[3px]"
                  >
                    <FileCode2 className="h-3.5 w-3.5 mr-1.5" /> Embed bundle · .py
                  </Button>
                  <Button
                    onClick={() => removeRequest(req.request_id)}
                    variant="outline"
                    className="btn-press font-mono uppercase tracking-widest text-[11px] rounded-[3px] text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {req.request_id} · {req.tool_ids.length} tools · {req.secret_keys.length} secrets granted ·{" "}
                  {new Date(req.submitted_at).toISOString().slice(0, 16).replace("T", " ")}Z
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border/70">
        <MrzStrip />
        <div className="container py-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <img src={LOGO} alt="S/" className="h-6 w-6 object-contain" />
            <span className="font-display font-bold">S/ Agent Passport</span>
            <span className="label-mono">Owner Console</span>
          </div>
          <Link href="/" className="label-mono hover:text-primary transition-colors">
            ← Back to the checkpoint
          </Link>
        </div>
      </footer>
    </div>
  );
}
