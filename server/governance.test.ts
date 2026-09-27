import { describe, expect, it } from "vitest";
import { evaluateAuthority, isPrivilegeExpansion, type AuthorityEnvelope, type GatePassport } from "./governance";

const authority: AuthorityEnvelope = {
  owner: { root_identity: "seif-root", controller: "seif" },
  purpose: "research",
  capabilities: ["web_search", "report_generation"],
  constraints: {
    action_limit: 100,
    data_domains: ["public_web"],
    spend_limit: 0,
    credential_ttl_seconds: 3600,
    reversible_actions_only: true,
  },
  delegation: { max_depth: 1, may_delegate: true, child_capabilities_must_be_subset: true },
  lifecycle: { expires_at: "2030-01-01T00:00:00.000Z", revocation_mode: "immediate", quarantine_mode: "automatic_on_anomaly" },
};

const passport: GatePassport = {
  passport_id: "S-PASS-TEST",
  status: "active",
  expires_at: "2030-01-01T00:00:00.000Z",
  capabilities: authority.capabilities,
  authority,
};

describe("governed delegation", () => {
  it("allows a routine, bounded action in the green lane", () => {
    const receipt = evaluateAuthority(passport, {
      action_id: "a-1",
      capability: "web_search",
      purpose: "research",
      data_domain: "public_web",
      delegation_depth: 0,
    }, null, new Date("2029-01-01T00:00:00.000Z"), { actions_used: 0 });

    expect(receipt).toMatchObject({ lane: "green", decision: "allow", reasons: [] });
    expect(receipt.receipt_hash).toHaveLength(64);
  });

  it("requires owner approval at a new authority boundary", () => {
    const receipt = evaluateAuthority({ ...passport, authority: { ...authority, constraints: { ...authority.constraints, reversible_actions_only: false } } }, {
      action_id: "a-2",
      capability: "web_search",
      purpose: "research",
      irreversible: true,
      delegation_depth: 0,
    }, null, new Date("2029-01-01T00:00:00.000Z"), { actions_used: 0 });

    expect(receipt).toMatchObject({ lane: "red", decision: "require_owner_approval" });
  });

  it("denies an action outside the passport envelope", () => {
    const receipt = evaluateAuthority(passport, {
      action_id: "a-3",
      capability: "deploy_trigger",
      purpose: "research",
      delegation_depth: 0,
    }, null, new Date("2029-01-01T00:00:00.000Z"), { actions_used: 0 });

    expect(receipt.decision).toBe("deny");
    expect(receipt.reasons).toContain("CAPABILITY_NOT_GRANTED");
  });

  it("never permits a child envelope to expand parent authority", () => {
    expect(isPrivilegeExpansion(authority, {
      ...authority,
      capabilities: [...authority.capabilities, "deploy_trigger"],
    })).toBe(true);
  });

  it("does not accept an approval flag carried by the action request", () => {
    const request = { action_id: "a-4", capability: "web_search", purpose: "research", irreversible: true, delegation_depth: 0, owner_approval: true };
    const receipt = evaluateAuthority({ ...passport, authority: { ...authority, constraints: { ...authority.constraints, reversible_actions_only: false } } }, request, null, new Date("2029-01-01T00:00:00.000Z"), { actions_used: 0 });
    expect(receipt.decision).toBe("require_owner_approval");
  });

  it("denies an ungranted data domain or external system even with approval evidence", () => {
    const now = new Date("2029-01-01T00:00:00.000Z");
    const evidence = { actions_used: 0, owner_approval: { passport_id: passport.passport_id, action_id: "a-5", expires_at: "2029-01-02T00:00:00.000Z" } };
    const request = { action_id: "a-5", capability: "web_search", purpose: "research", data_domain: "private", external_system: "unknown", delegation_depth: 0 };
    expect(evaluateAuthority(passport, request, null, now, evidence)).toMatchObject({ decision: "deny", reasons: ["DATA_DOMAIN_NOT_GRANTED", "EXTERNAL_SYSTEM_NOT_GRANTED"] });
  });

  it("requires gate-supplied evidence tied to this action and a valid expiry", () => {
    const now = new Date("2029-01-01T00:00:00.000Z");
    const request = { action_id: "a-6", capability: "report_generation", purpose: "research", irreversible: true, delegation_depth: 0 };
    const allowed = { ...passport, authority: { ...authority, constraints: { ...authority.constraints, reversible_actions_only: false } } };
    expect(evaluateAuthority(allowed, request, null, now, { actions_used: 0, owner_approval: { passport_id: passport.passport_id, action_id: "other", expires_at: "2029-01-02T00:00:00.000Z" } }).decision).toBe("require_owner_approval");
    expect(evaluateAuthority(allowed, request, null, now, { actions_used: 0, owner_approval: { passport_id: passport.passport_id, action_id: "a-6", expires_at: "2029-01-02T00:00:00.000Z" } }).decision).toBe("allow");
  });

  it("denies an expired passport, invalid spend, and exhausted action budget", () => {
    const request = { action_id: "a-7", capability: "web_search", purpose: "research", spend_amount: -1, delegation_depth: 0 };
    const receipt = evaluateAuthority({ ...passport, expires_at: null }, request, null, new Date("2029-01-01T00:00:00.000Z"), { actions_used: 100 });
    expect(receipt.decision).toBe("deny");
    expect(receipt.reasons).toEqual(expect.arrayContaining(["PASSPORT_EXPIRED", "SPEND_LIMIT_EXCEEDED", "ACTION_LIMIT_EXCEEDED"]));
  });

  it("treats changes in owner, purpose, budget, and external systems as expansions", () => {
    expect(isPrivilegeExpansion(authority, { ...authority, purpose: "trading" })).toBe(true);
    expect(isPrivilegeExpansion(authority, { ...authority, owner: { ...authority.owner, controller: "other" } })).toBe(true);
    expect(isPrivilegeExpansion(authority, { ...authority, constraints: { ...authority.constraints, action_limit: 101 } })).toBe(true);
    expect(isPrivilegeExpansion(authority, { ...authority, constraints: { ...authority.constraints, allowed_external_systems: ["unknown"] } })).toBe(true);
  });
});
