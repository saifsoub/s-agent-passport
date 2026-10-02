import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serviceRoleRequest(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!serviceRoleRequest(request)) return json({ error: "SERVER_GATE_CREDENTIAL_REQUIRED" }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "GATE_CONFIGURATION_UNAVAILABLE" }, 503);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = asObject(await request.json().catch(() => null));
  const passportId = typeof body.passport_id === "string" ? body.passport_id : "";
  const actionId = typeof body.action_id === "string" ? body.action_id : "";

  if (!passportId || !actionId) return json({ error: "PASSPORT_ID_AND_ACTION_ID_REQUIRED" }, 400);

  const { data: passport, error: passportError } = await db
    .from("agent_passports")
    .select("passport_id,status,expires_at,capabilities")
    .eq("passport_id", passportId)
    .maybeSingle();

  if (passportError) return json({ error: "PASSPORT_LOOKUP_FAILED" }, 503);

  const { data: control, error: controlError } = await db
    .from("passport_authority_controls")
    .select("authority_envelope,enforcement_state")
    .eq("passport_id", passportId)
    .maybeSingle();

  if (controlError) return json({ error: "CONTROL_LOOKUP_FAILED" }, 503);

  const requestCapability = typeof body.capability === "string" ? body.capability : "";
  const requestPurpose = typeof body.purpose === "string" ? body.purpose : "";
  const now = new Date();
  const reasons: string[] = [];
  const envelope = asObject(control?.authority_envelope);
  const constraints = asObject(envelope.constraints);
  const delegation = asObject(envelope.delegation);

  if (!passport) reasons.push("PASSPORT_NOT_FOUND");
  if (passport && passport.status !== "active") reasons.push("PASSPORT_NOT_ACTIVE");
  if (passport?.expires_at && new Date(passport.expires_at).getTime() <= now.getTime()) reasons.push("PASSPORT_EXPIRED");
  if (!control) reasons.push("AUTHORITY_ENVELOPE_NOT_CONFIGURED");
  if (control && control.enforcement_state !== "active") reasons.push("PASSPORT_" + String(control.enforcement_state).toUpperCase());

  const passportCapabilities = asStrings(passport?.capabilities);
  const envelopeCapabilities = asStrings(envelope.capabilities);
  if (!requestCapability || !passportCapabilities.includes(requestCapability) || !envelopeCapabilities.includes(requestCapability)) {
    reasons.push("CAPABILITY_NOT_GRANTED");
  }
  if (!requestPurpose || requestPurpose !== envelope.purpose) reasons.push("PURPOSE_MISMATCH");
  if (typeof envelope.lifecycle === "object") {
    const lifecycle = asObject(envelope.lifecycle);
    if (typeof lifecycle.expires_at === "string" && new Date(lifecycle.expires_at).getTime() <= now.getTime()) {
      reasons.push("AUTHORITY_ENVELOPE_EXPIRED");
    }
  }

  const delegationDepth = typeof body.delegation_depth === "number" ? body.delegation_depth : 0;
  if (delegationDepth > Number(delegation.max_depth ?? 0)) reasons.push("DELEGATION_DEPTH_EXCEEDED");
  if (body.requests_delegation === true && delegation.may_delegate !== true) reasons.push("DELEGATION_NOT_GRANTED");

  const spend = typeof body.spend_amount === "number" ? body.spend_amount : 0;
  if (spend > Number(constraints.spend_limit ?? 0)) reasons.push("SPEND_LIMIT_EXCEEDED");
  if (body.irreversible === true && constraints.reversible_actions_only === true) reasons.push("IRREVERSIBLE_ACTION_FORBIDDEN");

  const allowedSystems = asStrings(constraints.allowed_external_systems);
  const allowedDomains = asStrings(constraints.data_domains);
  const externalSystem = typeof body.external_system === "string" ? body.external_system : "";
  const dataDomain = typeof body.data_domain === "string" ? body.data_domain : "";
  const red =
    body.new_authority_class === true ||
    body.requests_delegation === true ||
    body.irreversible === true ||
    spend > 0 ||
    (externalSystem && !allowedSystems.includes(externalSystem)) ||
    (dataDomain && !allowedDomains.includes(dataDomain));

  const yellow = !red && /write|deploy|spawn|trigger/.test(requestCapability);
  const lane = red ? "red" : yellow ? "yellow" : "green";
  const decision =
    reasons.length ? "deny" :
    lane === "red" ? "require_owner_approval" :
    lane === "yellow" && body.secondary_validation !== true ? "require_validation" :
    "allow";

  const { data: previous } = await db
    .from("passport_decision_receipts")
    .select("receipt_hash")
    .eq("passport_id", passportId)
    .order("sequence_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const receiptId = "spr_" + crypto.randomUUID().replaceAll("-", "");
  const evaluatedAt = now.toISOString();
  const receiptHash = await digest({
    receipt_id: receiptId,
    passport_id: passportId,
    action_id: actionId,
    lane,
    decision,
    reasons,
    evaluated_at: evaluatedAt,
    previous_receipt_hash: previous?.receipt_hash ?? null,
  });

  const { error: receiptError } = await db.from("passport_decision_receipts").insert({
    receipt_id: receiptId,
    passport_id: passportId,
    action_id: actionId,
    lane,
    decision,
    reasons,
    evaluated_at: evaluatedAt,
    previous_receipt_hash: previous?.receipt_hash ?? null,
    receipt_hash: receiptHash,
  });

  if (receiptError) return json({ error: "RECEIPT_WRITE_FAILED" }, 503);

  return json({
    receipt_id: receiptId,
    passport_id: passportId,
    action_id: actionId,
    lane,
    decision,
    reasons,
    evaluated_at: evaluatedAt,
    receipt_hash: receiptHash,
  }, decision === "deny" ? 403 : 200);
});
