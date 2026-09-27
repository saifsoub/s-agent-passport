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
    }, null, new Date("2029-01-01T00:00:00.000Z"));

    expect(receipt).toMatchObject({ lane: "green", decision: "allow", reasons: [] });
    expect(receipt.receipt_hash).toHaveLength(64);
  });

  it("requires owner approval at a new authority boundary", () => {
    const receipt = evaluateAuthority(passport, {
      action_id: "a-2",
      capability: "web_search",
      purpose: "research",
      external_system: "new-provider",
      delegation_depth: 0,
    }, null, new Date("2029-01-01T00:00:00.000Z"));

    expect(receipt).toMatchObject({ lane: "red", decision: "require_owner_approval" });
  });

  it("denies an action outside the passport envelope", () => {
    const receipt = evaluateAuthority(passport, {
      action_id: "a-3",
      capability: "deploy_trigger",
      purpose: "research",
      delegation_depth: 0,
    }, null, new Date("2029-01-01T00:00:00.000Z"));

    expect(receipt.decision).toBe("deny");
    expect(receipt.reasons).toContain("CAPABILITY_NOT_GRANTED");
  });

  it("never permits a child envelope to expand parent authority", () => {
    expect(isPrivilegeExpansion(authority, {
      ...authority,
      capabilities: [...authority.capabilities, "deploy_trigger"],
    })).toBe(true);
  });
});
