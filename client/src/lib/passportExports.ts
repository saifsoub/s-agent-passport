/*
 * Dual passport exports driven by REAL registry records (via trpc.passports.exportData).
 * Export 1: embeddable Python bundle for the agent's code.
 * Export 2: owner dossier — printable HTML document (browser print → PDF).
 */

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
  status: string;
  provenance: ProvenanceEvent[];
  checksum: string;
  signature: string | null;
  signer_public_key: string | null;
  metadata: Record<string, unknown>;
}

export interface ExportData {
  passport: PassportPayload;
  status: string;
  issuedAt: Date | string;
  expiresAt: Date | string | null;
  secretEnv: { key: string; value: string }[];
}

/* ===== Export 1 · embeddable code bundle ===== */
export function buildEmbedBundle(data: ExportData): string {
  const p = data.passport;
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
      status: data.status,
      checksum: p.checksum,
      signature: p.signature,
      signer_public_key: p.signer_public_key,
      metadata: p.metadata,
    },
    null,
    2,
  );

  const refs = (p.metadata?.vault_secret_refs as string[]) ?? [];
  const secretLines =
    refs.length > 0
      ? refs.map((k) => `#   export ${k}=<value sealed in your S/ vault — provision at runtime>`).join("\n")
      : "#   (no vault secrets granted to this agent)";

  return `# ============================================================
# S/ AGENT PASSPORT · EMBED BUNDLE
# Agent  : ${p.agent_name}
# ID     : ${p.passport_id}
# Issued : ${p.issued_at}
# ============================================================
# Drop this file next to your agent code, or paste the constant
# into the module. The gate validates it before any tool call.

import os
from s_agent_passport import AgentPassport
from s_agent_passport.gate import validate_handoff

AGENT_PASSPORT = AgentPassport.model_validate('''${passportJson}''')

# --- Vault secrets granted to this agent ---
# Provision them as environment variables before starting the agent
# (values stay sealed in your S/ vault; use the .env download for local runs):
${secretLines}

def present(context: dict | None = None) -> dict:
    """Attach this to every handoff so downstream gates can inspect it."""
    return AGENT_PASSPORT.present_for_handoff(context or {})
`;
}

/* ===== Optional .env download with real vault values ===== */
export function buildEnvFile(data: ExportData): string {
  const header = `# S/ vault provisioning for ${data.passport.agent_name} (${data.passport.passport_id})
# KEEP THIS FILE PRIVATE. Values are pulled live from your sealed vault.
`;
  if (data.secretEnv.length === 0) return header + "# (no vault secrets granted)\n";
  return header + data.secretEnv.map((s) => `${s.key}=${s.value}`).join("\n") + "\n";
}

/* ===== Export 2 · owner dossier (printable HTML → PDF) ===== */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildOwnerDocumentHtml(data: ExportData, toolLabels: { label: string; capability: string; permission?: string; sensitive?: boolean }[]): string {
  const p = data.passport;
  const fmt = (iso: string | Date | null) =>
    iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "Never";

  const toolRows = toolLabels
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

  const refs = (p.metadata?.vault_secret_refs as string[]) ?? [];
  const secretRows =
    refs.length > 0
      ? refs
          .map((k) => `<tr><td class="mono">${esc(k)}</td><td class="mono">value sealed in owner vault — provisioned as env var at runtime</td></tr>`)
          .join("")
      : `<tr><td colspan="2" class="mono muted">No vault secrets granted to this agent.</td></tr>`;

  const provRows = p.provenance
    .map((e) => `<tr><td class="mono">${esc(e.event)}</td><td class="mono">${esc(e.actor)}</td><td class="mono">${fmt(e.timestamp)}</td></tr>`)
    .join("");

  const purpose = (p.metadata?.purpose as string) || "—";
  const mrzName = p.agent_name.toUpperCase().replace(/[^A-Z0-9]/g, "<");
  const mrzId = p.passport_id.replace(/-/g, "<");

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
      <div class="sub">S/ · Sovereign Identity Layer</div>
      <h1>AGENT PASSPORT DOCUMENT</h1>
      <div class="mono">${esc(p.passport_id)}</div>
    </div>
    <div style="text-align:right">
      <div class="slash">S/</div>
      <div class="stamp">${esc(data.status)}</div>
    </div>
  </div>

  <div class="mrz">P&lt;SPASS&lt;&lt;${mrzName}&lt;&lt;&lt;${mrzId}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>

  <h2>1 · Identity Core</h2>
  <div class="kv">
    <div class="cell"><div class="lbl">Agent name</div><div class="val">${esc(p.agent_name)}</div></div>
    <div class="cell"><div class="lbl">Agent type</div><div class="val">${esc(p.agent_type)}</div></div>
    <div class="cell"><div class="lbl">Version</div><div class="val">${esc(p.version)}</div></div>
    <div class="cell"><div class="lbl">Creator</div><div class="val">${esc(p.creator)}</div></div>
    <div class="cell"><div class="lbl">Issued</div><div class="val">${fmt(p.issued_at)}</div></div>
    <div class="cell"><div class="lbl">Expires</div><div class="val">${fmt(p.expires_at)}</div></div>
    <div class="cell"><div class="lbl">Calibration</div><div class="val">${p.calibration_level !== null ? "L" + p.calibration_level : "—"}</div></div>
    <div class="cell"><div class="lbl">Status</div><div class="val">${esc(data.status)}</div></div>
    <div class="cell"><div class="lbl">Checksum</div><div class="val">${esc(p.checksum)}</div></div>
  </div>
  <div class="notice"><strong>Purpose declared by owner:</strong> ${esc(purpose)}</div>

  <h2>2 · Granted Tools &amp; Capabilities</h2>
  <table>
    <tr><th>Tool</th><th>Capability granted</th><th>Permission flag</th><th>Class</th></tr>
    ${toolRows || '<tr><td colspan="4" class="mono muted">No tools granted.</td></tr>'}
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
    <tr><td class="mono">signer</td><td class="mono">${p.signer_public_key ? esc(p.signer_public_key) : "—"}</td></tr>
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

export function openPrintableDoc(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
