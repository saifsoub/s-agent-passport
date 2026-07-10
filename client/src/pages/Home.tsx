/*
 * Border Control Terminal · S/ Agent Passport demo page
 * Inspection route: hero checkpoint → booklet → issuance desk → border gate
 * → lineage wall → lifecycle strip → integration annex.
 * Navy #0A1628 field, orange #FF4F00 stamp ink, Space Grotesk + IBM Plex Mono.
 */
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AGENT_TYPES,
  FACTORY_PRESETS,
  type AgentType,
  type GateResult,
  type Passport,
  PassportSimError,
  issuePassport,
  presentForHandoff,
  revoke,
  spawnChild,
  transition,
  validateHandoff,
} from "@/lib/passport";
import {
  CodeBlock,
  GateChecklist,
  MrzStrip,
  PassportCard,
  Perforation,
  Section,
  Stamp,
  statusTone,
} from "@/components/passport-ui";
import {
  ArrowDown,
  ArrowRight,
  GitBranch,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Stamp as StampIcon,
  Terminal,
  Database,
  Server,
  Boxes,
} from "lucide-react";

const HERO_BG = "/manus-storage/hero-checkpoint_653f00d7.png";
const BOOKLET_IMG = "/manus-storage/passport-booklet_d06db170.png";
const LOGO = "/manus-storage/s-slash-logo_80b146d9.png";

/* ============ 01 · Schema booklet data ============ */
const SCHEMA_FIELDS: { name: string; type: string; note: string }[] = [
  { name: "passport_id", type: "str", note: "S-PASS-{12 hex} · immutable" },
  { name: "agent_name / agent_type", type: "str / enum", note: "10 sovereign agent types" },
  { name: "creator", type: "str", note: '"Seif Alsoub / S/" · immutable' },
  { name: "issued_at / expires_at", type: "datetime", note: "UTC · optional TTL" },
  { name: "capabilities", type: "list[str]", note: "what the agent may DO" },
  { name: "permissions", type: "dict[str,bool]", note: "what the agent may TOUCH" },
  { name: "memory_bridge_ref", type: "str | None", note: "calibration memory link" },
  { name: "calibration_level", type: "int 0–7", note: "S-OS trust depth" },
  { name: "provenance", type: "list[event]", note: "append-only audit trail" },
  { name: "parent_passport_id", type: "str | None", note: "spawn lineage" },
  { name: "status", type: "enum", note: "active · paused · revoked · archived · expired" },
  { name: "checksum", type: "sha256[:16]", note: "identity-core integrity" },
  { name: "signature", type: "Ed25519", note: "opt-in sovereign signing" },
];

/* ============ Integration annex code samples ============ */
const CODE_QUICKSTART = `from s_agent_passport import issue_swarm_orchestrator
from s_agent_passport.crypto import sign_passport
from s_agent_passport.registry import get_registry

p = issue_swarm_orchestrator(project_codes=["automation_2026"])
sign_passport(p, key_name="issuer")        # Ed25519, local sovereign key
get_registry().issue(p)                    # → live Supabase table

payload = p.present_for_handoff({"task": "analyze_compliance"})`;

const CODE_GATE = `from s_agent_passport.gate import validate_handoff

res = validate_handoff(
    payload,
    required_capabilities=["data_pipeline_analyze"],
    required_permissions=["can_access_projects"],
    registry=get_registry(),
    require_signature=True,
)
if not res.ok:
    raise PermissionError(res.reason)   # no passport, no tools`;

const CODE_CREWAI = `class PassportGuardedTool(BaseTool):
    name = "secure_supabase_write"

    def _run(self, passport_payload: dict, data: dict) -> str:
        res = validate_handoff(
            passport_payload,
            required_capabilities=["supabase_write"],
            require_signature=True,
        )
        if not res.ok:
            return f"Access Denied: {res.reason}"
        ...  # perform the write`;

const CODE_CLI = `$ s-pass issue --name researcher_01 --type researcher \\
    --cap web_search --sign
$ s-pass verify S-PASS-62689D1F2D09 --cap web_search \\
    --require-signature
$ s-pass card S-PASS-62689D1F2D09 -o card.png
$ s-pass revoke S-PASS-62689D1F2D09 --reason end_of_shift`;

export default function Home() {
  /* ---- shared registry state ---- */
  const [registry, setRegistry] = useState<Map<string, Passport>>(new Map());

  const upsert = (p: Passport) =>
    setRegistry((prev) => {
      const next = new Map(prev);
      next.set(p.passport_id, p);
      return next;
    });

  /* ============ 02 · Issuance desk state ============ */
  const [presetKey, setPresetKey] = useState<string>("swarm_orchestrator");
  const [agentName, setAgentName] = useState("s_orchestrator_v3");
  const [agentType, setAgentType] = useState<AgentType>("orchestrator");
  const [capsInput, setCapsInput] = useState(FACTORY_PRESETS.swarm_orchestrator.capabilities!.join(", "));
  const [permSpawn, setPermSpawn] = useState(true);
  const [permMemory, setPermMemory] = useState(true);
  const [permDeploy, setPermDeploy] = useState(false);
  const [ttl, setTtl] = useState<string>("");
  const [signIt, setSignIt] = useState(true);
  const [issued, setIssued] = useState<Passport | null>(null);
  const [issueAnim, setIssueAnim] = useState(0);

  const applyPreset = (key: string) => {
    const f = FACTORY_PRESETS[key];
    setPresetKey(key);
    setAgentName(f.agent_name);
    setAgentType(f.agent_type);
    setCapsInput((f.capabilities ?? []).join(", "));
    setPermSpawn(!!f.permissions?.["can_spawn_children"]);
    setPermMemory(!!f.permissions?.["can_write_memory"]);
    setPermDeploy(!!f.permissions?.["can_trigger_deploy"]);
    setTtl(f.ttl_hours ? String(f.ttl_hours) : "");
    setSignIt(!!f.sign);
  };

  const doIssue = () => {
    if (!agentName.trim()) {
      toast.error("Agent name is required at this desk.");
      return;
    }
    const preset = FACTORY_PRESETS[presetKey];
    const p = issuePassport({
      agent_name: agentName.trim(),
      agent_type: agentType,
      capabilities: capsInput.split(",").map((s) => s.trim()).filter(Boolean),
      permissions: {
        ...(preset?.permissions ?? {}),
        can_spawn_children: permSpawn,
        can_write_memory: permMemory,
        can_trigger_deploy: permDeploy,
      },
      memory_bridge_ref: preset?.memory_bridge_ref ?? null,
      calibration_level: preset?.calibration_level ?? null,
      ttl_hours: ttl ? Number(ttl) : null,
      metadata: preset?.metadata ?? {},
      sign: signIt,
    });
    upsert(p);
    setIssued(p);
    setIssueAnim((n) => n + 1);
    toast.success(`Passport ${p.passport_id} issued and registered.`);
  };

  /* ============ 03 · Border gate state ============ */
  const gatePassport = issued;
  const [gateResult, setGateResult] = useState<GateResult | null>(null);
  const [gateAnim, setGateAnim] = useState(0);
  const [reqCaps, setReqCaps] = useState("supabase_query, report_generation");
  const [reqSig, setReqSig] = useState(true);
  const gateRef = useRef<HTMLDivElement>(null);

  const runGate = (override?: Passport) => {
    const p = override ?? gatePassport;
    if (!p) {
      toast.error("Issue a passport at Desk 02 first.");
      return;
    }
    const live = registry.get(p.passport_id) ?? p;
    const payload = presentForHandoff(live, { task: "border_inspection_demo" });
    const res = validateHandoff(
      payload,
      registry,
      reqCaps.split(",").map((s) => s.trim()).filter(Boolean),
      [],
      reqSig,
    );
    setGateResult(res);
    setGateAnim((n) => n + 1);
  };

  const tamper = () => {
    if (!gatePassport) return toast.error("Nothing to tamper with yet.");
    const live = registry.get(gatePassport.passport_id);
    if (!live) return;
    const bad: Passport = { ...live, agent_name: live.agent_name + "_forged", _tampered: true };
    upsert(bad);
    setIssued(bad);
    toast.warning("Identity core altered. Checksum will no longer match.");
    runGate(bad);
  };

  const revokeCurrent = () => {
    if (!gatePassport) return toast.error("Nothing to revoke yet.");
    const live = registry.get(gatePassport.passport_id);
    if (!live) return;
    try {
      const r = revoke(live, "border_demo", "Seif Alsoub / S-OS");
      upsert(r);
      setIssued(r);
      toast("Passport revoked.", { description: "Every future gate check now fails instantly." });
      runGate(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /* ============ 04 · Spawn lineage state ============ */
  const [parentP, setParentP] = useState<Passport | null>(null);
  const [children, setChildren] = useState<Passport[]>([]);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnAnim, setSpawnAnim] = useState(0);

  const makeParent = () => {
    const f = FACTORY_PRESETS.swarm_orchestrator;
    const p = issuePassport({ ...f });
    upsert(p);
    setParentP(p);
    setChildren([]);
    setSpawnError(null);
    setSpawnAnim((n) => n + 1);
    toast.success(`Orchestrator ${p.passport_id} ready to delegate.`);
  };

  const spawnScoped = () => {
    if (!parentP) return toast.error("Issue the orchestrator first.");
    try {
      const c = spawnChild(parentP, {
        child_name: `analyst_child_${children.length + 1}`,
        child_type: "analyst",
        child_capabilities: ["supabase_query", "report_generation"],
        child_permissions: { can_write_memory: true, can_spawn_children: false },
      });
      upsert(c);
      setChildren((prev) => [...prev, c]);
      setSpawnError(null);
      setSpawnAnim((n) => n + 1);
      toast.success(`Child ${c.passport_id} spawned within parent scope.`);
    } catch (e) {
      setSpawnError((e as PassportSimError).message);
    }
  };

  const spawnEscalated = () => {
    if (!parentP) return toast.error("Issue the orchestrator first.");
    try {
      spawnChild(parentP, {
        child_name: "rogue_deployer",
        child_type: "executor",
        child_capabilities: ["production_deploy", "billing_write"],
        child_permissions: { can_trigger_deploy: true },
      });
    } catch (e) {
      const err = e as PassportSimError;
      setSpawnError(`${err.kind}: ${err.message}`);
      setSpawnAnim((n) => n + 1);
      toast.error("PrivilegeEscalationError — spawn refused.");
    }
  };

  /* ============ 05 · Lifecycle state ============ */
  const [lifeP, setLifeP] = useState<Passport | null>(null);
  const [lifeLog, setLifeLog] = useState<string[]>([]);

  const lifeIssue = () => {
    const p = issuePassport({
      agent_name: "lifecycle_subject",
      agent_type: "swarm_node",
      capabilities: ["task_execution"],
      permissions: {},
      ttl_hours: 6,
    });
    upsert(p);
    setLifeP(p);
    setLifeLog([`issued → ACTIVE (${p.passport_id})`]);
  };

  const lifeMove = (to: Passport["status"]) => {
    if (!lifeP) return toast.error("Issue the subject first.");
    try {
      const next = transition(lifeP, to, "Seif Alsoub / S-OS", "lifecycle_demo");
      upsert(next);
      setLifeP(next);
      setLifeLog((l) => [...l, `${lifeP.status} → ${to.toUpperCase()} ✓`]);
    } catch (e) {
      const err = e as PassportSimError;
      setLifeLog((l) => [...l, `✗ ${err.kind}: ${lifeP.status} → ${to} refused`]);
      toast.error(err.message);
    }
  };

  const registryRows = useMemo(() => Array.from(registry.values()).reverse().slice(0, 6), [registry]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ================= NAV ================= */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="container flex items-center justify-between h-14">
          <a href="#top" className="flex items-center gap-2.5">
            <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold tracking-tight">Agent Passport</span>
            <span className="label-mono text-primary hidden sm:inline">v0.1</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 label-mono">
            <a href="#schema" className="hover:text-primary transition-colors">Schema</a>
            <a href="#issue" className="hover:text-primary transition-colors">Issue</a>
            <a href="#gate" className="hover:text-primary transition-colors">Gate</a>
            <a href="#lineage" className="hover:text-primary transition-colors">Lineage</a>
            <a href="#annex" className="hover:text-primary transition-colors">Annex</a>
          </nav>
          <Button
            size="sm"
            className="btn-press font-mono text-xs tracking-wider uppercase rounded-[3px]"
            onClick={() => document.getElementById("issue")?.scrollIntoView({ behavior: "smooth" })}
          >
            <StampIcon className="h-3.5 w-3.5 mr-1.5" /> Issue a passport
          </Button>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section id="top" className="relative min-h-[92vh] flex items-end overflow-hidden pt-14">
        <img
          src={HERO_BG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

        <span className="slash-watermark top-16 -right-10 text-[22rem] lg:text-[30rem] hidden md:block z-[5]" aria-hidden>
          S/
        </span>

        <div className="container relative z-10 pb-16 sm:pb-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6 rise-in">
              <img src={LOGO} alt="S/" className="h-10 w-10 object-contain" />
              <span className="label-mono text-primary">S-OS · Sovereign Identity Layer</span>
              <span className="h-px flex-1 max-w-24 bg-primary/50" />
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight uppercase leading-[1.02] mb-4 rise-in" style={{ animationDelay: "60ms" }}>
              Present your
              <br />
              passport<span className="text-primary">.</span>
            </h1>
            <div className="mb-6 rise-in" style={{ animationDelay: "90ms" }}>
              <Stamp tone="ink" className="text-base sm:text-lg">Inspection required</Stamp>
            </div>
            <p className="font-mono text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed mb-8 rise-in" style={{ animationDelay: "120ms" }}>
              Every agent in the swarm carries a verifiable credential — capabilities,
              permissions, lineage, Ed25519 signature. The orchestrator gate inspects it
              before any tool or memory is touched.
            </p>
            <div className="flex flex-wrap items-center gap-4 rise-in" style={{ animationDelay: "180ms" }}>
              <Button
                size="lg"
                className="btn-press font-mono tracking-widest uppercase text-xs rounded-[3px] h-11 px-6"
                onClick={() => document.getElementById("issue")?.scrollIntoView({ behavior: "smooth" })}
              >
                Enter the checkpoint <ArrowDown className="h-4 w-4 ml-2" />
              </Button>
              <Stamp tone="ink" className="text-xs">No passport · no tools</Stamp>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 rise-in" style={{ animationDelay: "240ms" }}>
              {[
                ["41", "tests green"],
                ["Ed25519", "sovereign signing"],
                ["Supabase", "live registry"],
                ["US/SRV", "systemd deployed"],
              ].map(([v, k]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <span className="font-display font-bold text-lg text-foreground">{v}</span>
                  <span className="label-mono">{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MrzStrip />

      {/* ================= 01 · SCHEMA ================= */}
      <Section
        id="schema"
        index="01"
        code="PAGE·01/06"
        kicker="The document"
        title="One credential. Thirteen sovereign fields."
      >
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start">
          <div className="panel doc-corners rounded-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/70 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <span className="label-mono text-foreground/90">class AgentPassport(BaseModel)</span>
            </div>
            <div className="divide-y divide-border/50">
              {SCHEMA_FIELDS.map((f) => (
                <div key={f.name} className="grid grid-cols-[1fr_auto] sm:grid-cols-[240px_120px_1fr] gap-x-4 gap-y-0.5 px-4 py-2.5 hover:bg-secondary/40 transition-colors">
                  <span className="font-mono text-[13px] text-foreground">{f.name}</span>
                  <span className="font-mono text-[12px] text-primary/90">{f.type}</span>
                  <span className="font-mono text-[12px] text-muted-foreground col-span-2 sm:col-span-1">{f.note}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <img
              src={BOOKLET_IMG}
              alt="S/ Agent Passport booklet"
              className="w-full rounded-sm border border-border/60"
            />
            <p className="font-mono text-[13px] text-muted-foreground leading-relaxed">
              Identity core — <span className="text-foreground">passport_id, name, type, creator, issued_at</span> —
              is hashed into a checksum at issuance. Alter one byte and every gate in the
              swarm refuses the document.
            </p>
          </div>
        </div>
      </Section>

      <Perforation />

      {/* ================= 02 · ISSUANCE DESK ================= */}
      <Section
        id="issue"
        index="02"
        code="DESK·02/06"
        kicker="Interactive · issuance desk"
        title="Issue a passport. Watch it materialize."
      >
        <div className="grid lg:grid-cols-[420px_1fr] gap-10 items-start">
          {/* form */}
          <div className="panel rounded-sm p-5 space-y-5">
            <div>
              <div className="label-mono mb-2">Factory preset</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(FACTORY_PRESETS).map(([k, f]) => (
                  <button
                    key={k}
                    onClick={() => applyPreset(k)}
                    className={`btn-press font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 border rounded-[3px] transition-colors ${
                      presetKey === k
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground mt-2">{FACTORY_PRESETS[presetKey]?.blurb}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <div className="label-mono mb-1.5">Agent name</div>
                <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="font-mono text-sm rounded-[3px]" />
              </div>
              <div>
                <div className="label-mono mb-1.5">Agent type</div>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value as AgentType)}
                  className="w-full h-9 bg-transparent border border-input rounded-[3px] font-mono text-sm px-2.5 text-foreground"
                >
                  {AGENT_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-background">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="label-mono mb-1.5">TTL hours (optional)</div>
                <Input value={ttl} onChange={(e) => setTtl(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="∞" className="font-mono text-sm rounded-[3px]" />
              </div>
              <div className="col-span-2">
                <div className="label-mono mb-1.5">Capabilities · comma-separated</div>
                <Input value={capsInput} onChange={(e) => setCapsInput(e.target.value)} className="font-mono text-xs rounded-[3px]" />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="label-mono">Permissions</div>
              {[
                ["can_spawn_children", permSpawn, setPermSpawn],
                ["can_write_memory", permMemory, setPermMemory],
                ["can_trigger_deploy", permDeploy, setPermDeploy],
              ].map(([k, v, set]) => (
                <label key={k as string} className="flex items-center gap-2.5 font-mono text-[13px]">
                  <Checkbox checked={v as boolean} onCheckedChange={(c) => (set as (b: boolean) => void)(!!c)} />
                  {k as string}
                </label>
              ))}
              <label className="flex items-center gap-2.5 font-mono text-[13px] pt-1 border-t border-border/50 mt-3">
                <Checkbox checked={signIt} onCheckedChange={(c) => setSignIt(!!c)} />
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> Sign with Ed25519 issuer key
                </span>
              </label>
            </div>

            <Button onClick={doIssue} className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] h-11">
              <StampIcon className="h-4 w-4 mr-2" /> Issue &amp; register
            </Button>
          </div>

          {/* result */}
          <div className="min-w-0">
            {issued ? (
              <PassportCard key={issueAnim} passport={registry.get(issued.passport_id) ?? issued} animate />
            ) : (
              <div className="panel rounded-sm h-full min-h-[320px] flex flex-col items-center justify-center gap-3 border-dashed">
                <Boxes className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                <p className="font-mono text-sm text-muted-foreground">The desk is open. Submit the form to mint a credential.</p>
              </div>
            )}
            {registryRows.length > 0 && (
              <div className="mt-6">
                <div className="label-mono mb-2 flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-primary" /> Registry · latest entries
                </div>
                <div className="panel rounded-sm divide-y divide-border/50">
                  {registryRows.map((r) => (
                    <div key={r.passport_id} className="flex items-center gap-3 px-4 py-2 font-mono text-[12px]">
                      <span className="text-primary">{r.passport_id}</span>
                      <span className="text-muted-foreground truncate">{r.agent_name}</span>
                      <span className="flex-1" />
                      <Stamp tone={statusTone(r.status)} className="text-[9px] !px-1.5 !py-0.5">{r.status}</Stamp>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <MrzStrip text="P<SPASS<<BORDER<GATE<<<VALIDATE<HANDOFF<<<STATUS<CHECKSUM<SIGNATURE<CAPABILITY<<<<<<<<" />

      {/* ================= 03 · BORDER GATE ================= */}
      <Section
        id="gate"
        index="03"
        code="GATE·03/06"
        kicker="Interactive · border control"
        title="The gate runs eight checks. One failure denies entry."
      >
        <div className="grid lg:grid-cols-2 gap-10 items-start" ref={gateRef}>
          <div className="space-y-5">
            <div className="panel rounded-sm p-5 space-y-4">
              <div>
                <div className="label-mono mb-1.5">Required capabilities</div>
                <Input value={reqCaps} onChange={(e) => setReqCaps(e.target.value)} className="font-mono text-xs rounded-[3px]" />
              </div>
              <label className="flex items-center gap-2.5 font-mono text-[13px]">
                <Checkbox checked={reqSig} onCheckedChange={(c) => setReqSig(!!c)} />
                require_signature=True
              </label>
              <div className="flex flex-wrap gap-2.5">
                <Button onClick={() => runGate()} className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px]">
                  <ShieldCheck className="h-4 w-4 mr-1.5" /> Present at gate
                </Button>
                <Button onClick={tamper} variant="outline" className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px] border-[oklch(0.66_0.2_22)]/60 text-[oklch(0.66_0.2_22)] hover:bg-[oklch(0.66_0.2_22)]/10">
                  <ShieldAlert className="h-4 w-4 mr-1.5" /> Tamper with it
                </Button>
                <Button onClick={revokeCurrent} variant="outline" className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px]">
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Revoke
                </Button>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                Uses the passport issued at Desk 02. Tampering flips one byte of the identity
                core; revocation kills it registry-wide. Both are caught instantly.
              </p>
            </div>
            {gatePassport && (
              <PassportCard passport={registry.get(gatePassport.passport_id) ?? gatePassport} compact />
            )}
          </div>

          <div className="panel doc-corners rounded-sm p-5 min-h-[320px] flex flex-col relative overflow-hidden">
            {gateResult && (
              <span
                key={`wm-${gateAnim}`}
                className={`stamp stamp-in absolute right-4 bottom-16 text-4xl sm:text-5xl opacity-20 z-0 ${
                  gateResult.ok ? "text-primary" : "text-[oklch(0.66_0.2_22)]"
                }`}
                aria-hidden
              >
                {gateResult.ok ? "PASS" : "DENIED"}
              </span>
            )}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="label-mono text-foreground/90">validate_handoff() · inspection log</span>
              {gateResult && (
                <Stamp key={gateAnim} tone={gateResult.ok ? "ink" : "deny"} animate className="text-lg sm:text-xl">
                  {gateResult.ok ? "PASS" : "DENIED"}
                </Stamp>
              )}
            </div>
            <div key={`checks-${gateAnim}`} className="flex-1 relative z-10">
              <GateChecklist checks={gateResult?.checks ?? []} done={!!gateResult} />
            </div>
            {gateResult && (
              <div className="mt-4 pt-3 border-t border-border/60 font-mono text-[12px]">
                <span className="label-mono mr-2">reason</span>
                <span className={gateResult.ok ? "text-primary" : "text-[oklch(0.66_0.2_22)]"}>
                  {gateResult.reason}
                </span>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Perforation />

      {/* ================= 04 · LINEAGE ================= */}
      <Section
        id="lineage"
        index="04"
        code="WALL·04/06"
        kicker="Interactive · spawn lineage"
        title="Children inherit less. Never more."
      >
        <div className="grid lg:grid-cols-[380px_1fr] gap-10 items-start">
          <div className="space-y-4">
            <div className="panel rounded-sm p-5 space-y-3">
              <Button onClick={makeParent} className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px]">
                <GitBranch className="h-4 w-4 mr-1.5" /> 1 · Issue orchestrator
              </Button>
              <Button onClick={spawnScoped} variant="outline" className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] border-primary/50 text-primary hover:bg-primary/10">
                2 · spawn_child() within scope
              </Button>
              <Button onClick={spawnEscalated} variant="outline" className="btn-press w-full font-mono uppercase tracking-widest text-xs rounded-[3px] border-[oklch(0.66_0.2_22)]/60 text-[oklch(0.66_0.2_22)] hover:bg-[oklch(0.66_0.2_22)]/10">
                3 · attempt privilege escalation
              </Button>
            </div>
            {spawnError && (
              <div key={spawnAnim} className="panel rounded-sm p-4 border-[oklch(0.66_0.2_22)]/50 rise-in">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-[oklch(0.66_0.2_22)] shrink-0 mt-0.5" />
                  <p className="font-mono text-[12px] text-[oklch(0.75_0.15_22)] leading-relaxed break-words">{spawnError}</p>
                </div>
                <div className="mt-3">
                  <Stamp tone="deny" animate className="text-[10px]">Spawn refused</Stamp>
                </div>
              </div>
            )}
            <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">
              The rogue child requests <span className="text-foreground">production_deploy</span> and{" "}
              <span className="text-foreground">billing_write</span> — capabilities the parent never held.
              The package raises <span className="text-primary">PrivilegeEscalationError</span> before the
              agent even exists.
            </p>
          </div>

          <div className="space-y-4 min-w-0">
            {parentP ? (
              <>
                <PassportCard key={`p-${spawnAnim}`} passport={registry.get(parentP.passport_id) ?? parentP} compact animate />
                {children.length > 0 && (
                  <div className="pl-6 sm:pl-10 space-y-4 border-l-2 border-dashed border-primary/40 ml-4">
                    {children.map((c) => (
                      <div key={c.passport_id} className="relative">
                        <span className="absolute -left-[34px] sm:-left-[50px] top-6 w-6 sm:w-10 border-t-2 border-dashed border-primary/40" aria-hidden />
                        <PassportCard passport={c} compact animate />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="panel rounded-sm min-h-[280px] flex flex-col items-center justify-center gap-3 border-dashed">
                <GitBranch className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                <p className="font-mono text-sm text-muted-foreground">Lineage wall empty. Issue the orchestrator to begin.</p>
              </div>
            )}
          </div>
        </div>
      </Section>

      <MrzStrip text="P<SPASS<<LIFECYCLE<<<ACTIVE<PAUSED<REVOKED<ARCHIVED<EXPIRED<<<STATE<MACHINE<<<<<<<<<<<" />

      {/* ================= 05 · LIFECYCLE ================= */}
      <Section
        id="lifecycle"
        index="05"
        code="STRIP·05/06"
        kicker="Interactive · state machine"
        title="Five states. Illegal moves are refused."
      >
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start">
          <div className="space-y-6">
            {/* state diagram strip */}
            <div className="panel rounded-sm p-5 overflow-x-auto">
              <div className="flex items-center gap-3 min-w-[560px]">
                {(["active", "paused", "revoked", "archived", "expired"] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-3">
                    {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground/50" />}
                    <div
                      className={`font-mono text-[12px] uppercase tracking-wider px-3.5 py-2 border-2 rounded-[3px] transition-all ${
                        lifeP?.status === s
                          ? s === "active"
                            ? "border-primary text-primary bg-primary/10 shadow-[0_0_20px_-4px] shadow-primary/40"
                            : s === "revoked" || s === "expired"
                              ? "border-[oklch(0.66_0.2_22)] text-[oklch(0.66_0.2_22)] bg-[oklch(0.66_0.2_22)]/10"
                              : "border-foreground/70 text-foreground bg-secondary"
                          : "border-border/70 text-muted-foreground"
                      }`}
                    >
                      {s}
                    </div>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground mt-4">
                transition() enforces the matrix: revoked and archived are terminal ·
                expired can only be archived · every move appends provenance.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button onClick={lifeIssue} className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px]">
                Issue subject
              </Button>
              {(["paused", "active", "revoked", "archived"] as const).map((s) => (
                <Button
                  key={s}
                  onClick={() => lifeMove(s)}
                  variant="outline"
                  className="btn-press font-mono uppercase tracking-widest text-xs rounded-[3px]"
                >
                  → {s}
                </Button>
              ))}
            </div>

            <div className="panel rounded-sm p-4 min-h-[120px]">
              <div className="label-mono mb-2">Provenance log</div>
              <div className="space-y-1 font-mono text-[12px]">
                {lifeLog.length === 0 && <span className="text-muted-foreground">No subject issued yet.</span>}
                {lifeLog.map((l, i) => (
                  <div key={i} className={`check-in ${l.startsWith("✗") ? "text-[oklch(0.7_0.17_22)]" : "text-foreground/85"}`}>
                    <span className="text-muted-foreground mr-2">{String(i + 1).padStart(2, "0")}</span>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            {lifeP ? (
              <PassportCard passport={registry.get(lifeP.passport_id) ?? lifeP} compact />
            ) : (
              <div className="panel rounded-sm min-h-[240px] flex items-center justify-center border-dashed">
                <p className="font-mono text-sm text-muted-foreground px-6 text-center">
                  Issue a 6-hour-TTL swarm node and walk it through its life.
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Perforation />

      {/* ================= 06 · ANNEX ================= */}
      <Section
        id="annex"
        index="06"
        code="ANNEX·06/06"
        kicker="Integration annex"
        title="Wired into the real stack."
      >
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div>
            <div className="label-mono mb-2 text-primary">Quickstart · issue &amp; sign</div>
            <CodeBlock code={CODE_QUICKSTART} />
          </div>
          <div>
            <div className="label-mono mb-2 text-primary">Orchestrator gate</div>
            <CodeBlock code={CODE_GATE} />
          </div>
          <div>
            <div className="label-mono mb-2 text-primary">CrewAI tool guard</div>
            <CodeBlock code={CODE_CREWAI} />
          </div>
          <div>
            <div className="label-mono mb-2 text-primary">s-pass CLI</div>
            <CodeBlock code={CODE_CLI} lang="shell" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Database,
              title: "Live Supabase registry",
              body: "agent_passports table in the DoneAi project — single source of truth for status and revocation.",
            },
            {
              icon: Server,
              title: "US/SRV deployment",
              body: "systemd service s-pass-registry on 127.0.0.1:8433, bearer-token FastAPI, hourly TTL sweep cron.",
            },
            {
              icon: KeyRound,
              title: "Ed25519 sovereign keys",
              body: "Local issuer keypair at ~/.s-pass/keys — no external CA. Signatures verified at every gate.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="panel rounded-sm p-5">
              <Icon className="h-5 w-5 text-primary mb-3" strokeWidth={1.5} />
              <div className="font-display font-semibold mb-1.5">{title}</div>
              <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-border/60">
        <MrzStrip text="P<SPASS<<SEIF<ALSOUB<<<S<OS<PERSONAL<EMPIRE<<<SOVEREIGN<CALIBRATED<ACCOUNTABLE<<<<<<<<" />
        <div className="container py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="S/" className="h-9 w-9 object-contain" />
            <div>
              <div className="font-display font-bold">S/ Agent Passport</div>
              <div className="label-mono">Sovereign · Calibrated · Accountable</div>
            </div>
          </div>
          <div className="font-mono text-[12px] text-muted-foreground">
            v0.1 · Python 3.10+ · pydantic v2 · built for Seif Alsoub / S-OS
          </div>
        </div>
      </footer>
    </div>
  );
}
