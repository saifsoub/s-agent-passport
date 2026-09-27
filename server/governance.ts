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
  status: "active" | "revoked" | "expired" | "quarantined" | "suspended";
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
  secondary_validation?: boolean;
  owner_approval?: boolean;
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
  now = new Date()
): DecisionReceipt {
  const reasons: string[] = [];
  const envelope = passport.authority;
  const nowMs = now.getTime();

  if (passport.status !== "active") reasons.push("PASSPORT_NOT_ACTIVE");
  if (passport.expires_at && new Date(passport.expires_at).getTime() <= nowMs) reasons.push("PASSPORT_EXPIRED");
  if (new Date(envelope.lifecycle.expires_at).getTime() <= nowMs) reasons.push("AUTHORITY_ENVELOPE_EXPIRED");
  if (!passport.capabilities.includes(request.capability) || !envelope.capabilities.includes(request.capability)) {
    reasons.push("CAPABILITY_NOT_GRANTED");
  }
  if (request.purpose !== envelope.purpose) reasons.push("PURPOSE_MISMATCH");
  if (request.delegation_depth > envelope.delegation.max_depth) reasons.push("DELEGATION_DEPTH_EXCEEDED");
  if (request.requests_delegation && !envelope.delegation.may_delegate) reasons.push("DELEGATION_NOT_GRANTED");
  if (request.spend_amount && request.spend_amount > envelope.constraints.spend_limit) reasons.push("SPEND_LIMIT_EXCEEDED");
  if (request.spend_amount && envelope.constraints.currency && request.currency !== envelope.constraints.currency) {
    reasons.push("SPEND_CURRENCY_MISMATCH");
  }
  if (request.irreversible && envelope.constraints.reversible_actions_only) reasons.push("IRREVERSIBLE_ACTION_FORBIDDEN");

  const lane = classifyLane(request, envelope);
  let decision: Decision = "allow";

  if (reasons.length) {
    decision = "deny";
  } else if (lane === "red") {
    decision = request.owner_approval ? "allow" : "require_owner_approval";
  } else if (lane === "yellow") {
    decision = request.secondary_validation ? "allow" : "require_validation";
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

export function isPrivilegeExpansion(parent: AuthorityEnvelope, child: AuthorityEnvelope): boolean {
  if (child.delegation.max_depth > Math.max(parent.delegation.max_depth - 1, 0)) return true;
  if (child.constraints.spend_limit > parent.constraints.spend_limit) return true;
  if (child.constraints.credential_ttl_seconds > parent.constraints.credential_ttl_seconds) return true;
  if (child.capabilities.some((capability) => !parent.capabilities.includes(capability))) return true;
  if (child.constraints.data_domains.some((domain) => !parent.constraints.data_domains.includes(domain))) return true;
  return false;
}

export { RED_BOUNDARIES };
