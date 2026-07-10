/*
 * Server-side S/ Agent Passport minting + vault crypto.
 * Mirrors the Python package semantics: identity-core checksum (sha256[:16]),
 * S-PASS-{12 hex} ids, provenance trail, TTL expiry, issuer signing.
 * Vault secrets are encrypted at rest with AES-256-GCM.
 */
import crypto from "crypto";

export const PASSPORT_VERSION = "0.1";
export const CREATOR = "Seif Alsoub / S/";

/* ===== Tool catalog (server-side source of truth) ===== */
export interface ToolDef {
  id: string;
  label: string;
  group: "research" | "data" | "content" | "execution" | "memory";
  capability: string;
  permission?: string;
  sensitive?: boolean;
  blurb: string;
}

export const TOOL_CATALOG: ToolDef[] = [
  { id: "web_search", label: "Web Search", group: "research", capability: "web_search", blurb: "Query the open web for information." },
  { id: "pdf_parse", label: "PDF Parsing", group: "research", capability: "pdf_parse", blurb: "Extract text and tables from documents." },
  { id: "trend_analysis", label: "Trend Analysis", group: "research", capability: "trend_analysis", blurb: "Detect patterns across sources over time." },
  { id: "supabase_query", label: "Supabase Query", group: "data", capability: "supabase_query", blurb: "Read from the registry database." },
  { id: "supabase_write", label: "Supabase Write", group: "data", capability: "supabase_write", permission: "can_write_database", sensitive: true, blurb: "Write rows — requires permission flag." },
  { id: "data_pipeline_analyze", label: "Pipeline Analysis", group: "data", capability: "data_pipeline_analyze", blurb: "Inspect and analyze data pipelines." },
  { id: "report_generation", label: "Report Generation", group: "content", capability: "report_generation", blurb: "Assemble structured reports." },
  { id: "copywriting", label: "Copywriting", group: "content", capability: "copywriting", blurb: "Draft brand-aligned copy." },
  { id: "image_prompt_gen", label: "Image Prompts", group: "content", capability: "image_prompt_gen", blurb: "Generate prompts for visual assets." },
  { id: "task_execution", label: "Task Execution", group: "execution", capability: "task_execution", blurb: "Run queued swarm tasks." },
  { id: "agent_spawn", label: "Agent Spawning", group: "execution", capability: "agent_spawn", permission: "can_spawn_children", sensitive: true, blurb: "Spawn scoped child agents." },
  { id: "deploy_trigger", label: "Deploy Trigger", group: "execution", capability: "deploy_trigger", permission: "can_trigger_deploy", sensitive: true, blurb: "Trigger deployments — highest scrutiny." },
  { id: "memory_read", label: "Memory Read", group: "memory", capability: "memory_read", blurb: "Read from the calibration memory bridge." },
  { id: "memory_write", label: "Memory Write", group: "memory", capability: "memory_write", permission: "can_write_memory", sensitive: true, blurb: "Write to persistent memory." },
];

export const AGENT_TYPES = [
  "orchestrator",
  "researcher",
  "analyst",
  "coder",
  "executor",
  "content_engine",
  "domain_specialist",
  "memory_bridge",
  "swarm_node",
  "custom",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

/* ===== Passport payload (canonical document) ===== */
export interface ProvenanceEvent {
  event: string;
  actor: string;
  timestamp: string;
  detail?: string;
}

export interface PassportPayload {
  passport_id: string;
  agent_name: string;
  agent_type: string;
  version: string;
  creator: string;
  issued_at: string;
  expires_at: string | null;
  capabilities: string[];
  permissions: Record<string, boolean>;
  memory_bridge_ref: string | null;
  calibration_level: number | null;
  parent_passport_id: string | null;
  status: "active" | "revoked" | "expired";
  provenance: ProvenanceEvent[];
  checksum: string;
  signature: string | null;
  signer_public_key: string | null;
  metadata: Record<string, unknown>;
}

/* ===== Identity-core checksum — mirrors the Python package ===== */
export function computeChecksum(p: Pick<PassportPayload, "passport_id" | "agent_name" | "agent_type" | "creator" | "issued_at">): string {
  const core = `${p.passport_id}|${p.agent_name}|${p.agent_type}|${p.creator}|${p.issued_at}`;
  return crypto.createHash("sha256").update(core, "utf8").digest("hex").slice(0, 16);
}

export function newPassportId(): string {
  return "S-PASS-" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

/* ===== Issuer signing =====
 * The web registry signs with HMAC-SHA256 over the canonical document using a
 * key derived from JWT_SECRET. (The Python package on US/SRV uses Ed25519 with
 * local sovereign keys; this web registry is a separate issuer authority.)
 */
function signingKey(): Buffer {
  const secret = process.env.JWT_SECRET || "s-pass-dev-secret";
  return crypto.createHash("sha256").update("s-pass-issuer:" + secret).digest();
}

export function canonicalString(p: PassportPayload): string {
  return [
    p.passport_id,
    p.agent_name,
    p.agent_type,
    p.version,
    p.creator,
    p.issued_at,
    p.expires_at ?? "",
    [...p.capabilities].sort().join(","),
    Object.keys(p.permissions).sort().map((k) => `${k}=${p.permissions[k]}`).join(","),
    p.checksum,
  ].join("|");
}

export function signPassport(p: PassportPayload): string {
  return crypto.createHmac("sha256", signingKey()).update(canonicalString(p), "utf8").digest("hex");
}

export function verifySignature(p: PassportPayload): boolean {
  if (!p.signature) return false;
  const expected = signPassport(p);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(p.signature, "hex"));
  } catch {
    return false;
  }
}

/* ===== Minting ===== */
export interface MintInput {
  agentName: string;
  agentType: string;
  toolIds: string[];
  secretKeys: string[];
  ttlHours: number | null;
  purpose: string;
  ownerName: string;
  ownerOpenId: string;
  approvedBy: string;
}

export function mintPassport(input: MintInput): PassportPayload {
  const tools = TOOL_CATALOG.filter((t) => input.toolIds.includes(t.id));
  const capabilities = tools.map((t) => t.capability);
  const permissions: Record<string, boolean> = {};
  for (const t of tools) if (t.permission) permissions[t.permission] = true;

  const issuedAt = new Date();
  const expiresAt = input.ttlHours ? new Date(issuedAt.getTime() + input.ttlHours * 3600_000) : null;

  const base = {
    passport_id: newPassportId(),
    agent_name: input.agentName,
    agent_type: input.agentType,
    creator: CREATOR,
    issued_at: issuedAt.toISOString(),
  };

  const payload: PassportPayload = {
    ...base,
    version: PASSPORT_VERSION,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    capabilities,
    permissions,
    memory_bridge_ref: null,
    calibration_level: 3,
    parent_passport_id: null,
    status: "active",
    provenance: [
      { event: "requested", actor: input.ownerName, timestamp: issuedAt.toISOString(), detail: input.purpose || undefined },
      { event: "approved", actor: input.approvedBy, timestamp: issuedAt.toISOString() },
      { event: "issued", actor: "S/ Passport Registry", timestamp: issuedAt.toISOString() },
    ],
    checksum: computeChecksum(base),
    signature: null,
    signer_public_key: null,
    metadata: {
      owner: input.ownerName,
      owner_open_id: input.ownerOpenId,
      purpose: input.purpose,
      vault_secret_refs: input.secretKeys,
    },
  };

  payload.signature = signPassport(payload);
  payload.signer_public_key = "hmac-sha256:s-pass-web-registry";
  return payload;
}

/* ===== Vault crypto — AES-256-GCM at rest ===== */
function vaultKey(): Buffer {
  const secret = process.env.JWT_SECRET || "s-pass-dev-secret";
  return crypto.createHash("sha256").update("s-pass-vault:" + secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(v: string): string {
  if (v.length <= 6) return "•".repeat(Math.max(v.length, 3));
  return v.slice(0, 3) + "•".repeat(Math.min(v.length - 6, 18)) + v.slice(-3);
}
