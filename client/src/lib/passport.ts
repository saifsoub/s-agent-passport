/*
 * Border Control Terminal · S/ Agent Passport
 * In-browser TypeScript simulator that faithfully mirrors the Python package
 * semantics (s_agent_passport): issuance, checksum, least-privilege spawn,
 * lifecycle state machine, handoff payloads, and the orchestrator gate.
 */

export const AGENT_TYPES = [
  "orchestrator", "researcher", "coder", "executor", "analyst",
  "content_engine", "fta_specialist", "swarm_node", "memory_bridge", "custom",
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];
export type PassportStatus = "active" | "paused" | "revoked" | "archived" | "expired";

export interface ProvenanceEvent {
  event: string;
  actor: string;
  timestamp: string;
  detail?: Record<string, unknown>;
}

export interface Passport {
  passport_id: string;
  agent_name: string;
  agent_type: AgentType;
  version: string;
  creator: string;
  issued_at: string;
  expires_at: string | null;
  capabilities: string[];
  permissions: Record<string, boolean>;
  memory_bridge_ref: string | null;
  calibration_level: number | null;
  provenance: ProvenanceEvent[];
  parent_passport_id: string | null;
  status: PassportStatus;
  branding: Record<string, string>;
  metadata: Record<string, unknown>;
  checksum: string;
  signature: string | null;
  signer_public_key: string | null;
  /** internal flag for tamper demo — not part of the Python model */
  _tampered?: boolean;
}

const VALID_TRANSITIONS: Record<PassportStatus, PassportStatus[]> = {
  active: ["paused", "revoked", "archived", "expired"],
  paused: ["active", "revoked", "archived", "expired"],
  expired: ["archived"],
  revoked: [],
  archived: [],
};

const HEX = "0123456789ABCDEF";

function randHex(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

/** FNV-1a-based 16-hex checksum (stand-in for Python's sha256[:16]) */
export function computeChecksum(p: Pick<Passport, "passport_id" | "agent_name" | "agent_type" | "version" | "issued_at" | "creator">): string {
  const core = JSON.stringify({
    agent_name: p.agent_name,
    agent_type: p.agent_type,
    creator: p.creator,
    issued_at: p.issued_at,
    passport_id: p.passport_id,
    version: p.version,
  });
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < core.length; i++) {
    h1 = Math.imul(h1 ^ core.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ core.charCodeAt(core.length - 1 - i), 0x01000193) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
}

export interface IssueOptions {
  agent_name: string;
  agent_type: AgentType;
  capabilities?: string[];
  permissions?: Record<string, boolean>;
  memory_bridge_ref?: string | null;
  calibration_level?: number | null;
  ttl_hours?: number | null;
  metadata?: Record<string, unknown>;
  parent_passport_id?: string | null;
  provenance?: ProvenanceEvent[];
  sign?: boolean;
}

export function issuePassport(opts: IssueOptions): Passport {
  const now = new Date();
  const p: Passport = {
    passport_id: `S-PASS-${randHex(12)}`,
    agent_name: opts.agent_name,
    agent_type: opts.agent_type,
    version: "1.0.0",
    creator: "Seif Alsoub / S/",
    issued_at: now.toISOString(),
    expires_at: opts.ttl_hours ? new Date(now.getTime() + opts.ttl_hours * 3600_000).toISOString() : null,
    capabilities: Array.from(new Set((opts.capabilities ?? []).map((c) => c.trim()).filter(Boolean))),
    permissions: opts.permissions ?? {},
    memory_bridge_ref: opts.memory_bridge_ref ?? null,
    calibration_level: opts.calibration_level ?? null,
    provenance: opts.provenance ?? [
      { event: "issued", actor: "Seif Alsoub / S-OS", timestamp: now.toISOString(), detail: {} },
    ],
    parent_passport_id: opts.parent_passport_id ?? null,
    status: "active",
    branding: {
      primary_color: "#0A1628",
      accent_color: "#FF4F00",
      logo_ref: "s_logo_dark.png",
      tagline: "Sovereign. Calibrated. Accountable.",
    },
    metadata: opts.metadata ?? {},
    checksum: "",
    signature: null,
    signer_public_key: null,
  };
  p.checksum = computeChecksum(p);
  if (opts.sign) {
    p.signature = randHex(64).toLowerCase() + randHex(64).toLowerCase();
    p.signer_public_key = randHex(64).toLowerCase();
  }
  return p;
}

export function isExpired(p: Passport): boolean {
  return !!p.expires_at && new Date(p.expires_at) < new Date();
}

export function verifyChecksum(p: Passport): boolean {
  return !p._tampered && p.checksum === computeChecksum(p);
}

export function isValid(p: Passport): boolean {
  return p.status === "active" && !isExpired(p) && verifyChecksum(p);
}

export class PassportSimError extends Error {
  kind: string;
  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function transition(p: Passport, to: PassportStatus, actor = "system", reason = ""): Passport {
  if (p.status === to) return p;
  if (!VALID_TRANSITIONS[p.status].includes(to)) {
    throw new PassportSimError(
      "InvalidTransitionError",
      `Illegal transition ${p.status} → ${to} for ${p.passport_id}`,
    );
  }
  return {
    ...p,
    status: to,
    provenance: [
      ...p.provenance,
      {
        event: "status_change",
        actor,
        timestamp: new Date().toISOString(),
        detail: { from_status: p.status, to_status: to, reason },
      },
    ],
  };
}

export function revoke(p: Passport, reason = "manual", actor = "system"): Passport {
  return transition(p, "revoked", actor, reason);
}

export interface HandoffPayload {
  passport_id: string;
  agent_name: string;
  agent_type: AgentType;
  capabilities: string[];
  permissions: Record<string, boolean>;
  memory_bridge_ref: string | null;
  status: PassportStatus;
  checksum: string;
  task_context: Record<string, unknown>;
  presented_at: string;
  signature?: string;
  signer_public_key?: string;
}

export function presentForHandoff(p: Passport, taskContext: Record<string, unknown> = {}): HandoffPayload {
  const payload: HandoffPayload = {
    passport_id: p.passport_id,
    agent_name: p.agent_name,
    agent_type: p.agent_type,
    capabilities: p.capabilities,
    permissions: p.permissions,
    memory_bridge_ref: p.memory_bridge_ref,
    status: p.status,
    checksum: p.checksum,
    task_context: taskContext,
    presented_at: new Date().toISOString(),
  };
  if (p.signature) {
    payload.signature = p.signature;
    payload.signer_public_key = p.signer_public_key ?? undefined;
  }
  return payload;
}

export interface SpawnOptions {
  child_name: string;
  child_type: AgentType;
  child_capabilities: string[];
  child_permissions: Record<string, boolean>;
  allow_escalation?: boolean;
}

export function spawnChild(parent: Passport, opts: SpawnOptions): Passport {
  if (!isValid(parent)) {
    throw new PassportSimError("PassportError", `Cannot spawn from non-valid passport ${parent.passport_id}`);
  }
  if (!parent.permissions["can_spawn_children"]) {
    throw new PassportSimError(
      "PrivilegeEscalationError",
      `Passport ${parent.passport_id} lacks permission 'can_spawn_children'`,
    );
  }
  if (!opts.allow_escalation) {
    const extraCaps = opts.child_capabilities.filter((c) => !parent.capabilities.includes(c));
    if (extraCaps.length) {
      throw new PassportSimError(
        "PrivilegeEscalationError",
        `Child capabilities exceed parent's: [${extraCaps.join(", ")}] (pass allow_escalation=True to override)`,
      );
    }
    const escPerms = Object.entries(opts.child_permissions)
      .filter(([k, v]) => v && !parent.permissions[k])
      .map(([k]) => k);
    if (escPerms.length) {
      throw new PassportSimError(
        "PrivilegeEscalationError",
        `Child permissions exceed parent's: [${escPerms.join(", ")}] (pass allow_escalation=True to override)`,
      );
    }
  }
  const child = issuePassport({
    agent_name: opts.child_name,
    agent_type: opts.child_type,
    capabilities: opts.child_capabilities,
    permissions: opts.child_permissions,
    memory_bridge_ref: parent.memory_bridge_ref,
    parent_passport_id: parent.passport_id,
    metadata: { ...parent.metadata, spawned_from: parent.passport_id },
    provenance: [
      ...parent.provenance,
      {
        event: "spawned_by",
        actor: "system",
        timestamp: new Date().toISOString(),
        detail: {
          parent_passport_id: parent.passport_id,
          parent_agent_name: parent.agent_name,
          escalation_override: !!opts.allow_escalation,
        },
      },
    ],
  });
  return child;
}

/* ===== Orchestrator gate ===== */

export interface GateCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface GateResult {
  ok: boolean;
  reason: string;
  checks: GateCheck[];
}

export function validateHandoff(
  payload: HandoffPayload | null,
  registry: Map<string, Passport>,
  requiredCapabilities: string[] = [],
  requiredPermissions: string[] = [],
  requireSignature = false,
): GateResult {
  const checks: GateCheck[] = [];
  const fail = (reason: string): GateResult => ({ ok: false, reason, checks });

  const pid = payload?.passport_id;
  checks.push({ key: "payload_shape", label: "Payload shape", ok: !!pid });
  if (!pid) return fail("missing passport_id in payload");

  const passport = registry.get(pid) ?? null;
  checks.push({ key: "registry_lookup", label: "Registry lookup", ok: !!passport });
  if (!passport) return fail(`passport ${pid} not found in registry`);

  const active = passport.status === "active";
  checks.push({ key: "status_active", label: "Status is ACTIVE", ok: active });
  if (!active) return fail(`passport status is '${passport.status}'`);

  const notExpired = !isExpired(passport);
  checks.push({ key: "not_expired", label: "Not expired (TTL)", ok: notExpired });
  if (!notExpired) return fail("passport is expired");

  const sumOk = verifyChecksum(passport);
  checks.push({ key: "checksum", label: "Checksum integrity", ok: sumOk });
  if (!sumOk) return fail("checksum mismatch — identity core tampered");

  if (requireSignature || passport.signature) {
    const sigOk = !!passport.signature && !passport._tampered;
    checks.push({ key: "signature", label: "Ed25519 signature", ok: sigOk });
    if (!sigOk) return fail(requireSignature ? "signature required but invalid or missing" : "passport signature invalid");
  }

  for (const cap of requiredCapabilities) {
    const ok = passport.capabilities.includes(cap);
    checks.push({ key: `capability:${cap}`, label: `Capability · ${cap}`, ok });
    if (!ok) return fail(`missing required capability '${cap}'`);
  }

  for (const perm of requiredPermissions) {
    const ok = !!passport.permissions[perm];
    checks.push({ key: `permission:${perm}`, label: `Permission · ${perm}`, ok });
    if (!ok) return fail(`permission '${perm}' not granted`);
  }

  return { ok: true, reason: "ok", checks };
}

/* ===== Factory presets (mirror Python factories) ===== */

export const FACTORY_PRESETS: Record<string, IssueOptions & { label: string; blurb: string }> = {
  fta_orchestrator: {
    label: "FTA Orchestrator",
    blurb: "issue_fta_orchestrator() — calibration L5, can spawn children, deploy escalates.",
    agent_name: "fta_orchestrator_v3",
    agent_type: "orchestrator",
    capabilities: [
      "fta_project_read", "fta_einvoicing_analyze", "zero_bureaucracy_scan",
      "supabase_query", "report_generation", "agent_spawn",
      "web_search", "pdf_parse", "trend_analysis",
    ],
    permissions: {
      can_access_fta_projects: true,
      can_write_memory: true,
      can_spawn_children: true,
      can_trigger_deploy: false,
    },
    memory_bridge_ref: "s_agent_calib_2026-07-08_fta",
    calibration_level: 5,
    metadata: { fta_projects: ["e_invoicing_2026", "institutional_performance"], owner: "Seif Alsoub" },
    sign: true,
  },
  content_engine: {
    label: "Content Engine",
    blurb: "issue_content_engine() — calibration L4, cannot publish externally.",
    agent_name: "s_content_engine_v2",
    agent_type: "content_engine",
    capabilities: ["web_research", "copywriting", "image_prompt_gen", "pdf_assembly", "brand_compliance_check"],
    permissions: {
      can_access_fta_projects: false,
      can_write_memory: true,
      can_publish_external: false,
    },
    calibration_level: 4,
    sign: true,
  },
  swarm_node: {
    label: "Swarm Node",
    blurb: "issue_swarm_node() — 6-hour TTL, calibration L2, minimal surface.",
    agent_name: "swarm_node_scraper",
    agent_type: "swarm_node",
    capabilities: ["task_execution", "result_return"],
    permissions: { can_write_memory: false, can_spawn_children: false },
    calibration_level: 2,
    ttl_hours: 6,
    sign: false,
  },
};

/** MRZ-style line for a passport, ICAO-flavored */
export function mrzLine(p: Passport): string {
  const name = p.agent_name.toUpperCase().replace(/[^A-Z0-9]/g, "<");
  const type = p.agent_type.toUpperCase().replace(/[^A-Z0-9]/g, "<");
  return `P<SPASS<<${name}<<<${type}<<<${p.passport_id.replace(/-/g, "<")}<<<${p.checksum.toUpperCase()}`
    .padEnd(88, "<")
    .slice(0, 88);
}
