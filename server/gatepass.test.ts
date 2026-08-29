import { describe, expect, it } from "vitest";
import { mintPassport } from "./passport";
import { GatePassEngine, type GatePolicy, type SessionAdapter } from "./gatepass";

const passport = () => mintPassport({
  agentName: "S/Integrator",
  agentType: "orchestrator",
  toolIds: ["task_execution"],
  secretKeys: [],
  ttlHours: 24,
  purpose: "GatePass contract test",
  ownerName: "Seif Alsoub",
  ownerOpenId: "owner",
  approvedBy: "Seif Alsoub",
});

const policy: GatePolicy = {
  gateId: "gate_test_workspace",
  allowedPassportIds: [],
  allowedScopes: ["read"],
  environments: ["production"],
  approvalMode: "standing",
  maxTtlSeconds: 300,
};

function adapter(secret = "never-return-this-secret"): SessionAdapter {
  return {
    establishSession: async () => ({ sessionHandle: "opaque-session-1", internalCredential: secret }),
  };
}

describe("GatePassEngine", () => {
  it("allows a signed active Passport within exact policy and never returns adapter credentials", async () => {
    const p = passport();
    const engine = new GatePassEngine({ policies: [{ ...policy, allowedPassportIds: [p.passport_id] }], adapter: adapter(), now: () => new Date("2026-08-29T15:00:00Z") });
    const result = await engine.request({ passport: p, gateId: policy.gateId, scopes: ["read"], environment: "production", purpose: "inspect workspace", nonce: "nonce-123456", requestedTtlSeconds: 120, issuedAt: "2026-08-29T14:59:30Z" });
    expect(result.decision).toBe("allow");
    expect(result).toMatchObject({ approvedScopes: ["read"], sessionHandle: "opaque-session-1" });
    expect(JSON.stringify(result)).not.toContain("never-return-this-secret");
  });

  it.each([
    ["wrong scope", { scopes: ["write"] }, "SCOPE_NOT_ALLOWED"],
    ["wrong environment", { environment: "staging" }, "ENVIRONMENT_NOT_ALLOWED"],
    ["expired request", { issuedAt: "2026-08-29T14:50:00Z" }, "REQUEST_EXPIRED"],
  ])("denies %s", async (_name, override, reasonCode) => {
    const p = passport();
    const engine = new GatePassEngine({ policies: [{ ...policy, allowedPassportIds: [p.passport_id] }], adapter: adapter(), now: () => new Date("2026-08-29T15:00:00Z") });
    const result = await engine.request({ passport: p, gateId: policy.gateId, scopes: ["read"], environment: "production", purpose: "inspect workspace", nonce: "nonce-123456", requestedTtlSeconds: 120, issuedAt: "2026-08-29T14:59:30Z", ...override });
    expect(result).toMatchObject({ decision: "deny", reasonCode });
  });

  it("denies a replayed nonce and emits redacted receipts for both decisions", async () => {
    const p = passport();
    const receipts: unknown[] = [];
    const engine = new GatePassEngine({ policies: [{ ...policy, allowedPassportIds: [p.passport_id] }], adapter: adapter(), receiptSink: (receipt) => { receipts.push(receipt); }, now: () => new Date("2026-08-29T15:00:00Z") });
    const request = { passport: p, gateId: policy.gateId, scopes: ["read"], environment: "production", purpose: "inspect workspace", nonce: "nonce-123456", requestedTtlSeconds: 120, issuedAt: "2026-08-29T14:59:30Z" };
    expect((await engine.request(request)).decision).toBe("allow");
    expect(await engine.request(request)).toMatchObject({ decision: "deny", reasonCode: "NONCE_REPLAY" });
    expect(receipts).toHaveLength(2);
    expect(JSON.stringify(receipts)).not.toContain("never-return-this-secret");
  });

  it("requires a verified owner-presence approval when policy demands it", async () => {
    const p = passport();
    const engine = new GatePassEngine({ policies: [{ ...policy, allowedPassportIds: [p.passport_id], approvalMode: "owner_presence" }], adapter: adapter(), now: () => new Date("2026-08-29T15:00:00Z") });
    const result = await engine.request({ passport: p, gateId: policy.gateId, scopes: ["read"], environment: "production", purpose: "inspect workspace", nonce: "nonce-123456", requestedTtlSeconds: 120, issuedAt: "2026-08-29T14:59:30Z" });
    expect(result).toMatchObject({ decision: "deny", reasonCode: "OWNER_PRESENCE_REQUIRED" });
  });
});
