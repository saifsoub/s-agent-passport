import { describe, expect, it } from "vitest";
import {
  AGENT_TYPES,
  TOOL_CATALOG,
  computeChecksum,
  decryptSecret,
  encryptSecret,
  maskSecret,
  mintPassport,
  signPassport,
  verifySignature,
} from "./passport";

const baseInput = {
  agentName: "test_agent",
  agentType: "researcher" as (typeof AGENT_TYPES)[number],
  toolIds: ["web_search", "pdf_parse"],
  secretKeys: ["OPENAI_API_KEY"],
  ttlHours: 24,
  purpose: "unit testing",
  ownerName: "42",
  ownerOpenId: "",
  approvedBy: "Inspector",
};

describe("mintPassport", () => {
  it("mints a well-formed passport", () => {
    const p = mintPassport(baseInput);
    expect(p.passport_id).toMatch(/^S-PASS-[0-9A-F]{12}$/);
    expect(p.agent_name).toBe("test_agent");
    expect(p.agent_type).toBe("researcher");
    expect(p.status).toBe("active");
    expect(p.checksum).toHaveLength(16);
    expect(p.signature).toBeTruthy();
    expect(p.expires_at).toBeTruthy();
  });

  it("maps tool ids to capabilities and permissions", () => {
    const p = mintPassport({ ...baseInput, toolIds: ["web_search", "deploy_trigger"] });
    const deployTool = TOOL_CATALOG.find((t) => t.id === "deploy_trigger")!;
    expect(p.capabilities).toContain("web_search");
    expect(p.capabilities).toContain(deployTool.capability);
    if (deployTool.permission) {
      expect(p.permissions[deployTool.permission]).toBe(true);
    }
  });

  it("stores vault refs by name only (no values)", () => {
    const p = mintPassport(baseInput);
    const refs = p.metadata.vault_secret_refs as string[];
    expect(refs).toEqual(["OPENAI_API_KEY"]);
    expect(JSON.stringify(p)).not.toContain("sk-");
  });

  it("respects null TTL (no expiry)", () => {
    const p = mintPassport({ ...baseInput, ttlHours: null });
    expect(p.expires_at).toBeNull();
  });

  it("writes a provenance trail with requested/approved/issued", () => {
    const p = mintPassport(baseInput);
    const events = p.provenance.map((e) => e.event);
    expect(events).toContain("requested");
    expect(events).toContain("approved");
    expect(events).toContain("issued");
  });
});

describe("checksum integrity", () => {
  it("checksum changes if identity core is tampered", () => {
    const p = mintPassport(baseInput);
    const original = computeChecksum({
      passport_id: p.passport_id,
      agent_name: p.agent_name,
      agent_type: p.agent_type,
      creator: p.creator,
      issued_at: p.issued_at,
    });
    expect(original).toBe(p.checksum);
    const tampered = computeChecksum({
      passport_id: p.passport_id,
      agent_name: p.agent_name + "_forged",
      agent_type: p.agent_type,
      creator: p.creator,
      issued_at: p.issued_at,
    });
    expect(tampered).not.toBe(p.checksum);
  });
});

describe("signature", () => {
  it("verifies a valid signature and rejects a forged payload", () => {
    const p = mintPassport(baseInput);
    expect(verifySignature(p)).toBe(true);
    const forged = { ...p, agent_name: "evil_twin" };
    expect(verifySignature(forged)).toBe(false);
  });

  it("signPassport is deterministic for same payload", () => {
    const p = mintPassport(baseInput);
    expect(signPassport(p)).toBe(signPassport({ ...p }));
  });
});

describe("vault crypto", () => {
  it("round-trips a secret through AES-256-GCM", () => {
    const stored = encryptSecret("sk-super-secret-123");
    expect(stored).not.toContain("sk-super-secret-123");
    expect(decryptSecret(stored)).toBe("sk-super-secret-123");
  });

  it("fails to decrypt tampered ciphertext", () => {
    const stored = encryptSecret("value");
    const [iv, tag, data] = stored.split(".");
    const tamperedData = Buffer.from(data, "base64");
    tamperedData[0] ^= 0xff;
    const tampered = [iv, tag, tamperedData.toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("masks secrets for display", () => {
    const masked = maskSecret("sk-abcdefghijklmnop");
    expect(masked).toContain("•");
    expect(masked).not.toBe("sk-abcdefghijklmnop");
    expect(masked.length).toBeLessThanOrEqual("sk-abcdefghijklmnop".length + 4);
  });
});

describe("tool catalog", () => {
  it("has unique ids and sensitive tools carry permission flags", () => {
    const ids = TOOL_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOOL_CATALOG.filter((t) => t.sensitive)) {
      expect(t.permission, `${t.id} should have a permission flag`).toBeTruthy();
    }
  });
});
