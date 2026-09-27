/**
 * S/Passport governed-delegation evaluator.
 *
 * This is intentionally pure: a gate supplies a freshly verified Passport and
 * current revocation/quarantine status, then persists the returned receipt in
 * its append-only store. It never treats a browser payload as authorization.
 */
import crypto from "crypto";

export type ExecutionLane = "green" | "yellow" | "red";
export type Decision = "allow" | "require_validation" | "require_owner_approval" | "deny";

export interface AuthorityEnvelope {
  owner: { root_identity: string; controller: string };
  purpose: string;
  capabilities: string[];
  constraints: {
    action_limit: number;
    data_domains: string[];
    spend_limit: number;
    currency?: string;
    credential_ttl_seconds: number;
    allowed_external_systems?: string[];
    reversible_actions_only?: boolean;
  };
  delegation: {
    max_depth: number;
    may_delegate: boolean;
    child_capabilities_must_be_subset: true;
  };
  lifecycle: {
    expires_at: string;
    revocation_mode: "live" | "immediate";
    quarantine_mode: "automatic_on_anomaly" | "manual_only";
  };
}

export interface GatePassport {
  passport_id: string;
  status: "active" | "paused" | "archived" | "revoked" | "expired" | "quarantined" | "suspended";
  expires_at: string | null;
  capabilities: string[];
  authority: AuthorityEnvelope;
}

export interface ActionRequest {
  action_id: string;
  capability: string;
  purpose: string;
  data_domain?: string;
  external_system?: string;
  spend_amount?: number;
  currency?: string;
  delegation_depth: number;
  requests_delegation?: boolean;
  irreversible?: boolean;
  new_authority_class?: boolean;
}

/** Evidence is supplied by the trusted gate after checking the approval store. */
export interface GateEvidence {
  secondary_validation?: { passport_id: string; action_id: string; expires_at: string };
  owner_approval?: { passport_id: string; action_id: string; expires_at: string };
  actions_used: number;
}

export interface DecisionReceipt {
  receipt_id: string;
  passport_id: string;
  action_id: string;
  lane: ExecutionLane;
  decision: Decision;
  reasons: string[];
  evaluated_at: string;
  previous_receipt_hash: string | null;
  receipt_hash: string;
}

const RED_BOUNDARIES = new Set([
  "new_authority_class",
  "new_external_system",
  "new_data_domain",
  "delegation",
  "irreversible",
  "spend",
]);

export function classifyLane(request: ActionRequest, envelope: AuthorityEnvelope): ExecutionLane {
  const crossesRedBoundary =
    request.new_authority_class ||
    request.requests_delegation ||
    request.irreversible ||
    (request.spend_amount ?? 0) > 0 ||
    Boolean(request.external_system && !envelope.constraints.allowed_external_systems?.includes(request.external_system)) ||
    Boolean(request.data_domain && !envelope.constraints.data_domains.includes(request.data_domain));

  if (crossesRedBoundary) return "red";

  const unusual =
    request.capability.includes("write") ||
    request.capability.includes("deploy") ||
    request.capability.includes("spawn") ||
    request.capability.includes("trigger");

  return unusual ? "yellow" : "green";
}

export function evaluateAuthority(
  passport: GatePassport,
  request: ActionRequest,
  previousReceiptHash: string | null = null,
  now = new Date(),
  evidence: GateEvidence = { actions_used: NaN }
): DecisionReceipt {
  const reasons: string[] = [];
  const envelope = passport.authority;
  const nowMs = now.getTime();

  if (passport.status !== "active") reasons.push("PASSPORT_NOT_ACTIVE");
  if (!passport.expires_at || !Number.isFinite(Date.parse(passport.expires_at)) || Date.parse(passport.expires_at) <= nowMs) reasons.push("PASSPORT_EXPIRED");
  if (!Number.isFinite(Date.parse(envelope.lifecycle.expires_at)) || Date.parse(envelope.lifecycle.expires_at) <= nowMs) reasons.push("AUTHORITY_ENVELOPE_EXPIRED");
  if (!passport.capabilities.includes(request.capability) || !envelope.capabilities.includes(request.capability)) {
    reasons.push("CAPABILITY_NOT_GRANTED");
  }
  if (request.purpose !== envelope.purpose) reasons.push("PURPOSE_MISMATCH");
  if (!Number.isInteger(request.delegation_depth) || request.delegation_depth < 0 || request.delegation_depth > envelope.delegation.max_depth) reasons.push("DELEGATION_DEPTH_EXCEEDED");
  if (request.requests_delegation && !envelope.delegation.may_delegate) reasons.push("DELEGATION_NOT_GRANTED");
  if (request.data_domain && !envelope.constraints.data_domains.includes(request.data_domain)) reasons.push("DATA_DOMAIN_NOT_GRANTED");
  if (request.external_system && !envelope.constraints.allowed_external_systems?.includes(request.external_system)) reasons.push("EXTERNAL_SYSTEM_NOT_GRANTED");
  if (request.spend_amount !== undefined && (!Number.isFinite(request.spend_amount) || request.spend_amount < 0 || request.spend_amount > envelope.constraints.spend_limit)) reasons.push("SPEND_LIMIT_EXCEEDED");
  if ((request.spend_amount ?? 0) > 0 && (!envelope.constraints.currency || request.currency !== envelope.constraints.currency)) {
    reasons.push("SPEND_CURRENCY_MISMATCH");
  }
  if (!Number.isInteger(evidence.actions_used) || evidence.actions_used >= envelope.constraints.action_limit || evidence.actions_used < 0) reasons.push("ACTION_LIMIT_EXCEEDED");
  if (request.irreversible && envelope.constraints.reversible_actions_only) reasons.push("IRREVERSIBLE_ACTION_FORBIDDEN");

  const lane = classifyLane(request, envelope);
  let decision: Decision = "allow";

  if (reasons.length) {
    decision = "deny";
  } else if (lane === "red") {
    decision = validEvidence(evidence.owner_approval, passport.passport_id, request.action_id, nowMs) ? "allow" : "require_owner_approval";
  } else if (lane === "yellow") {
    decision = validEvidence(evidence.secondary_validation, passport.passport_id, request.action_id, nowMs) ? "allow" : "require_validation";
  }

  const evaluated_at = now.toISOString();
  const receipt_id = "spr_" + crypto.randomBytes(12).toString("hex");
  const receiptCore = JSON.stringify({
    receipt_id,
    passport_id: passport.passport_id,
    action_id: request.action_id,
    lane,
    decision,
    reasons,
    evaluated_at,
    previous_receipt_hash: previousReceiptHash,
  });
  const receipt_hash = crypto.createHash("sha256").update(receiptCore).digest("hex");

  return {
    receipt_id,
    passport_id: passport.passport_id,
    action_id: request.action_id,
    lane,
    decision,
    reasons,
    evaluated_at,
    previous_receipt_hash: previousReceiptHash,
    receipt_hash,
  };
}

function validEvidence(proof: GateEvidence["owner_approval"], passportId: string, actionId: string, nowMs: number): boolean {
  return Boolean(proof && proof.passport_id === passportId && proof.action_id === actionId && Number.isFinite(Date.parse(proof.expires_at)) && Date.parse(proof.expires_at) > nowMs);
}

export function isPrivilegeExpansion(parent: AuthorityEnvelope, child: AuthorityEnvelope): boolean {
  if (child.owner.root_identity !== parent.owner.root_identity || child.owner.controller !== parent.owner.controller) return true;
  if (child.purpose !== parent.purpose) return true;
  if (!Number.isFinite(Date.parse(child.lifecycle.expires_at)) || Date.parse(child.lifecycle.expires_at) > Date.parse(parent.lifecycle.expires_at)) return true;
  if (child.constraints.action_limit > parent.constraints.action_limit) return true;
  if (child.delegation.may_delegate && !parent.delegation.may_delegate) return true;
  if (child.delegation.max_depth > Math.max(parent.delegation.max_depth - 1, 0)) return true;
  if (child.constraints.spend_limit > parent.constraints.spend_limit) return true;
  if (child.constraints.currency !== parent.constraints.currency && child.constraints.spend_limit > 0) return true;
  if (parent.constraints.reversible_actions_only !== false && child.constraints.reversible_actions_only === false) return true;
  if (child.constraints.credential_ttl_seconds > parent.constraints.credential_ttl_seconds) return true;
  if (child.capabilities.some((capability) => !parent.capabilities.includes(capability))) return true;
  if (child.constraints.data_domains.some((domain) => !parent.constraints.data_domains.includes(domain))) return true;
  if (child.constraints.allowed_external_systems?.some((system) => !parent.constraints.allowed_external_systems?.includes(system))) return true;
  return false;
}

export { RED_BOUNDARIES };
