/*
 * Border Control Terminal · Owner Console library
 * Owner profile, passport requests with tool selection, private secrets vault,
 * and dual passport exports (owner PDF document + embeddable code bundle).
 * Everything persists to localStorage — in-browser demo, no server involved.
 */
import {
  type AgentType,
  type Passport,
  type IssueOptions,
  issuePassport,
} from "@/lib/passport";

/* ===== Tool catalog the owner can request ===== */
export interface ToolDef {
  id: string;
  label: string;
  group: "research" | "data" | "content" | "execution" | "memory";
  capability: string;
  permission?: string; // sensitive tools also require a permission flag
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

/* ===== Owner profile ===== */
export interface OwnerProfile {
  owner_id: string;
  name: string;
  created_at: string;
}

/* ===== Secret vault entry (value stored locally only) ===== */
export interface VaultSecret {
  key: string; // e.g. OPENAI_API_KEY
  value: string; // stored in localStorage only, never exported in full
  added_at: string;
}

/* ===== Passport request ===== */
export interface PassportRequest {
  request_id: string;
  owner_id: string;
  agent_name: string;
  agent_type: AgentType;
  tool_ids: string[];
  secret_keys: string[]; // vault key NAMES granted to this agent (never values)
  ttl_hours: number | null;
  purpose: string;
  status: "approved";
  submitted_at: string;
  passport: Passport;
}

const LS_OWNER = "s_pass_owner";
const LS_VAULT = "s_pass_vault";
const LS_REQUESTS = "s_pass_requests";

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* ===== Owner ===== */
export function loadOwner(): OwnerProfile | null {
  return readLS<OwnerProfile | null>(LS_OWNER, null);
}

export function createOwner(name: string): OwnerProfile {
  const o: OwnerProfile = {
    owner_id: "S-OWNER-" + Math.random().toString(16).slice(2, 10).toUpperCase(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  };
  writeLS(LS_OWNER, o);
  return o;
}

/* ===== Vault ===== */
export function loadVault(): VaultSecret[] {
  return readLS<VaultSecret[]>(LS_VAULT, []);
}

export function saveVault(secrets: VaultSecret[]) {
  writeLS(LS_VAULT, secrets);
}

export function maskSecret(v: string): string {
  if (v.length <= 6) return "•".repeat(Math.max(v.length, 3));
  return v.slice(0, 3) + "•".repeat(Math.min(v.length - 6, 18)) + v.slice(-3);
}

/* ===== Requests ===== */
export function loadRequests(): PassportRequest[] {
  return readLS<PassportRequest[]>(LS_REQUESTS, []);
}

export function saveRequests(reqs: PassportRequest[]) {
  writeLS(LS_REQUESTS, reqs);
}

export interface SubmitRequestInput {
  owner: OwnerProfile;
  agent_name: string;
  agent_type: AgentType;
  tool_ids: string[];
  secret_keys: string[];
  ttl_hours: number | null;
  purpose: string;
}

/** Submit a request — instantly approved in this demo and a passport is minted. */
export function submitRequest(input: SubmitRequestInput): PassportRequest {
  const tools = TOOL_CATALOG.filter((t) => input.tool_ids.includes(t.id));
  const capabilities = tools.map((t) => t.capability);
  const permissions: Record<string, boolean> = {};
  for (const t of tools) if (t.permission) permissions[t.permission] = true;

  const opts: IssueOptions = {
    agent_name: input.agent_name,
    agent_type: input.agent_type,
    capabilities,
    permissions,
    ttl_hours: input.ttl_hours,
    calibration_level: 3,
    metadata: {
      owner: input.owner.name,
      owner_id: input.owner.owner_id,
      purpose: input.purpose,
      vault_secret_refs: input.secret_keys, // names only — values never leave the vault
    },
    sign: true,
  };
  const passport = issuePassport(opts);
  const req: PassportRequest = {
    request_id: "REQ-" + Math.random().toString(16).slice(2, 8).toUpperCase(),
    owner_id: input.owner.owner_id,
    agent_name: input.agent_name,
    agent_type: input.agent_type,
    tool_ids: input.tool_ids,
    secret_keys: input.secret_keys,
    ttl_hours: input.ttl_hours,
    purpose: input.purpose,
    status: "approved",
    submitted_at: new Date().toISOString(),
    passport,
  };
  const all = loadRequests();
  all.unshift(req);
  saveRequests(all);
  return req;
}

export function deleteRequest(request_id: string) {
  saveRequests(loadRequests().filter((r) => r.request_id !== request_id));
}

/* ===== Export 1 · embeddable code bundle ===== */
export function buildEmbedBundle(req: PassportRequest): string {
  const p = req.passport;
  const passportJson = JSON.stringify(
    {
      passport_id: p.passport_id,
      agent_name: p.agent_name,
      agent_type: p.agent_type,
      version: p.version,
      creator: p.creator,
      issued_at: p.issued_at,
      expires_at: p.expires_at,
      capabilities: p.capabilities,
      permissions: p.permissions,
      calibration_level: p.calibration_level,
      status: p.status,
      checksum: p.checksum,
      signature: p.signature,
      signer_public_key: p.signer_public_key,
      metadata: p.metadata,
    },
    null,
    2,
  );

  const secretLines =
    req.secret_keys.length > 0
      ? req.secret_keys.map((k) => `#   ${k} = os.environ["${k}"]  # provisioned from your S/ vault`).join("\n")
      : "#   (no vault secrets granted to this agent)";

  return `# ============================================================
# S/ AGENT PASSPORT · EMBED BUNDLE
# Agent  : ${p.agent_name}
# Owner  : ${req.owner_id}
# Issued : ${p.issued_at}
# ============================================================
# Drop this file next to your agent code, or paste the constant
# into the module. The gate validates it before any tool call.

import os
from s_agent_passport import AgentPassport
from s_agent_passport.gate import validate_handoff

AGENT_PASSPORT = AgentPassport.model_validate(${"'''"}${passportJson}${"'''"})

# --- Vault secrets granted to this agent (values stay in your vault) ---
# Export them as environment variables before starting the agent:
${secretLines}

def present(context: dict | None = None) -> dict:
    """Attach this to every handoff so downstream gates can inspect it."""
    return AGENT_PASSPORT.present_for_handoff(context or {})
`;
}

/* ===== Export 2 · owner PDF document ===== */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildOwnerDocumentHtml(req: PassportRequest): string {
  const p = req.passport;
  const tools = TOOL_CATALOG.filter((t) => req.tool_ids.includes(t.id));
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "Never";

  const toolRows = tools
    .map(
      (t) => `<tr>
        <td class="mono">${esc(t.label)}</td>
        <td class="mono">${esc(t.capability)}</td>
        <td class="mono">${t.permission ? esc(t.permission) : "—"}</td>
        <td>${t.sensitive ? '<span class="flag">SENSITIVE</span>' : "standard"}</td>
      </tr>`,
    )
    .join("");

  const permRows = Object.entries(p.permissions)
    .map(
      ([k, v]) => `<tr><td class="mono">${esc(k)}</td><td class="mono ${v ? "ok" : "no"}">${v ? "GRANTED" : "DENIED"}</td></tr>`,
    )
    .join("");

  const secretRows =
    req.secret_keys.length > 0
      ? req.secret_keys
          .map((k) => `<tr><td class="mono">${esc(k)}</td><td class="mono">value sealed in owner vault — provisioned as env var at runtime</td></tr>`)
          .join("")
      : `<tr><td colspan="2" class="mono muted">No vault secrets granted to this agent.</td></tr>`;

  const provRows = p.provenance
    .map((e) => `<tr><td class="mono">${esc(e.event)}</td><td class="mono">${esc(e.actor)}</td><td class="mono">${fmt(e.timestamp)}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(p.passport_id)} — S/ Agent Passport Document</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #14213d; margin: 0; padding: 24px; background: #fff; }
  .doc { max-width: 760px; margin: 0 auto; }
  .head { border: 2px solid #14213d; padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .head h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.06em; }
  .head .sub { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #5a6b85; }
  .slash { font-size: 34px; font-weight: 800; color: #D97742; }
  .stamp { display: inline-block; border: 3px double #D97742; color: #D97742; font-weight: 700; letter-spacing: 0.25em;
           padding: 4px 12px; transform: rotate(-4deg); font-size: 13px; border-radius: 3px; text-transform: uppercase; }
  .mrz { font-family: "Courier New", monospace; background: #14213d; color: #cfd8e8; padding: 8px 12px; font-size: 10px;
         letter-spacing: 0.15em; overflow: hidden; white-space: nowrap; margin: 14px 0 22px; }
  h2 { font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; border-top: 2px solid #D97742;
       padding-top: 8px; margin: 26px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #5a6b85;
       border-bottom: 1px solid #c9d2e0; padding: 6px 8px; }
  td { border-bottom: 1px solid #e4e9f1; padding: 6px 8px; vertical-align: top; }
  .mono { font-family: "Courier New", monospace; font-size: 11.5px; }
  .ok { color: #1a7f4e; font-weight: 700; }
  .no { color: #b3341f; font-weight: 700; }
  .muted { color: #8a97ab; }
  .flag { color: #b3341f; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; }
  .kv { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 18px; margin-top: 10px; }
  .kv .cell { border: 1px solid #e4e9f1; padding: 8px 10px; }
  .kv .lbl { font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #5a6b85; margin-bottom: 3px; }
  .kv .val { font-family: "Courier New", monospace; font-size: 12px; word-break: break-all; }
  .foot { margin-top: 30px; border-top: 1px solid #c9d2e0; padding-top: 12px; font-size: 10px; color: #5a6b85;
          display: flex; justify-content: space-between; }
  .notice { background: #f6f2ec; border-left: 4px solid #D97742; padding: 10px 14px; font-size: 11.5px; margin-top: 8px; }
</style>
</head>
<body>
<div class="doc">
  <div class="head">
    <div>
      <div class="sub">S-OS · Sovereign Identity Layer</div>
      <h1>AGENT PASSPORT DOCUMENT</h1>
      <div class="mono">${esc(p.passport_id)}</div>
    </div>
    <div style="text-align:right">
      <div class="slash">S/</div>
      <div class="stamp">${esc(p.status)}</div>
    </div>
  </div>

  <div class="mrz">P&lt;SPASS&lt;&lt;${esc(p.agent_name.toUpperCase().replace(/[^A-Z0-9]/g, "&lt;"))}&lt;&lt;&lt;${esc(p.passport_id.replace(/-/g, "&lt;"))}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>

  <h2>1 · Identity Core</h2>
  <div class="kv">
    <div class="cell"><div class="lbl">Agent name</div><div class="val">${esc(p.agent_name)}</div></div>
    <div class="cell"><div class="lbl">Agent type</div><div class="val">${esc(p.agent_type)}</div></div>
    <div class="cell"><div class="lbl">Version</div><div class="val">${esc(p.version)}</div></div>
    <div class="cell"><div class="lbl">Creator</div><div class="val">${esc(p.creator)}</div></div>
    <div class="cell"><div class="lbl">Issued</div><div class="val">${fmt(p.issued_at)}</div></div>
    <div class="cell"><div class="lbl">Expires</div><div class="val">${fmt(p.expires_at)}</div></div>
    <div class="cell"><div class="lbl">Calibration</div><div class="val">${p.calibration_level !== null ? "L" + p.calibration_level : "—"}</div></div>
    <div class="cell"><div class="lbl">Owner</div><div class="val">${esc(req.owner_id)}</div></div>
    <div class="cell"><div class="lbl">Checksum</div><div class="val">${esc(p.checksum)}</div></div>
  </div>
  <div class="notice"><strong>Purpose declared by owner:</strong> ${esc(req.purpose || "—")}</div>

  <h2>2 · Requested Tools &amp; Capabilities</h2>
  <table>
    <tr><th>Tool</th><th>Capability granted</th><th>Permission flag</th><th>Class</th></tr>
    ${toolRows || '<tr><td colspan="4" class="mono muted">No tools requested.</td></tr>'}
  </table>

  <h2>3 · Permission Flags</h2>
  <table>
    <tr><th>Flag</th><th>State</th></tr>
    ${permRows || '<tr><td colspan="2" class="mono muted">No permission flags set.</td></tr>'}
  </table>

  <h2>4 · Vault Secrets Granted (names only)</h2>
  <table>
    <tr><th>Secret key</th><th>Handling</th></tr>
    ${secretRows}
  </table>

  <h2>5 · Cryptographic Attestation</h2>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td class="mono">signature</td><td class="mono">${p.signature ? esc(p.signature) : "unsigned"}</td></tr>
    <tr><td class="mono">signer_public_key</td><td class="mono">${p.signer_public_key ? esc(p.signer_public_key) : "—"}</td></tr>
    <tr><td class="mono">integrity checksum</td><td class="mono">${esc(p.checksum)}</td></tr>
  </table>

  <h2>6 · Provenance Trail</h2>
  <table>
    <tr><th>Event</th><th>Actor</th><th>Timestamp</th></tr>
    ${provRows}
  </table>

  <div class="foot">
    <span>S/ Agent Passport v0.1 · Sovereign. Calibrated. Accountable.</span>
    <span>Generated ${fmt(new Date().toISOString())}</span>
  </div>
</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script>
</body>
</html>`;
}

/* ===== Download helpers ===== */
export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function openOwnerPdf(req: PassportRequest) {
  const html = buildOwnerDocumentHtml(req);
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
