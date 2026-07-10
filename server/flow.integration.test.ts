/*
 * Integration test — exercises the full product flow through the real tRPC
 * routers against the live dev database:
 *   vault seal → request submit → admin approve (mints passport) →
 *   export data → deny path → revoke path → cleanup.
 */
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { passportRequests, passports, users, vaultSecrets } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const RUN = `itest_${Date.now()}`;
const OWNER_OPEN_ID = `${RUN}_owner`;
const ADMIN_OPEN_ID = `${RUN}_admin`;
const KEY_NAME = "ITEST_SECRET_KEY";

function ctxFor(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

async function createDbUser(openId: string, role: "user" | "admin") {
  const db = (await getDb())!;
  await db.insert(users).values({ openId, name: openId, role });
  const [row] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return row!;
}

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  const testUsers = await db.select().from(users).where(like(users.openId, `${RUN}%`));
  for (const u of testUsers) {
    await db.delete(passports).where(eq(passports.userId, u.id));
    await db.delete(passportRequests).where(eq(passportRequests.userId, u.id));
    await db.delete(vaultSecrets).where(eq(vaultSecrets.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
}

afterAll(cleanup);

describe("full product flow (integration)", () => {
  it("runs vault → request → approve → export → deny → revoke end to end", async () => {
    const db = await getDb();
    expect(db, "database must be reachable for integration test").toBeTruthy();

    const owner = await createDbUser(OWNER_OPEN_ID, "user");
    const admin = await createDbUser(ADMIN_OPEN_ID, "admin");
    const ownerCaller = appRouter.createCaller(ctxFor(owner));
    const adminCaller = appRouter.createCaller(ctxFor(admin));

    /* 1 — seal a secret in the vault */
    await ownerCaller.vault.add({ keyName: KEY_NAME, value: "sk-integration-secret-42" });
    const vault = await ownerCaller.vault.list();
    expect(vault.map((v) => v.keyName)).toContain(KEY_NAME);
    expect(vault.find((v) => v.keyName === KEY_NAME)!.masked).not.toContain("integration-secret");

    // duplicate key is refused
    await expect(
      ownerCaller.vault.add({ keyName: KEY_NAME, value: "other" }),
    ).rejects.toThrow(/already sealed/i);

    /* 2 — submit a passport application */
    await ownerCaller.requests.submit({
      agentName: `${RUN}_agent`,
      agentType: "researcher",
      toolIds: ["web_search", "memory_write"],
      secretKeys: [KEY_NAME, "NOT_OWNED_KEY"],
      ttlHours: 24,
      purpose: "integration test flight",
    });
    const mine1 = await ownerCaller.requests.mine();
    const req = mine1.find((r) => r.agentName === `${RUN}_agent`)!;
    expect(req.status).toBe("pending");
    // unowned keys must be stripped
    expect(req.secretKeys).toEqual([KEY_NAME]);

    /* 3 — admin gating: owner cannot access the desk */
    await expect(ownerCaller.admin.pending()).rejects.toThrow();

    /* 4 — admin approves → passport minted */
    const pending = await adminCaller.admin.pending();
    expect(pending.some((r) => r.id === req.id)).toBe(true);
    const approved = await adminCaller.admin.approve({ requestId: req.id });
    expect(approved.passportId).toMatch(/^S-PASS-[0-9A-F]{12}$/);

    // double-approve refused
    await expect(adminCaller.admin.approve({ requestId: req.id })).rejects.toThrow(/already decided/i);

    /* 5 — owner sees the minted passport and exports it */
    const minted = (await ownerCaller.passports.mine()).find((p) => p.passportId === approved.passportId)!;
    expect(minted.status).toBe("active");
    expect(minted.checksum).toHaveLength(16);

    const exported = await ownerCaller.passports.exportData({ id: minted.id });
    expect(exported.passport.passport_id).toBe(approved.passportId);
    expect(exported.passport.capabilities).toContain("web_search");
    expect(exported.passport.permissions["can_write_memory"]).toBe(true);
    expect(exported.secretEnv).toEqual([{ key: KEY_NAME, value: "sk-integration-secret-42" }]);

    // another user cannot export it
    await expect(adminCaller.passports.exportData({ id: minted.id })).rejects.toThrow();

    /* 6 — deny path with stored reason */
    await ownerCaller.requests.submit({
      agentName: `${RUN}_denied_agent`,
      agentType: "executor",
      toolIds: ["deploy_trigger"],
      secretKeys: [],
      ttlHours: null,
      purpose: "should be denied",
    });
    const mine2 = await ownerCaller.requests.mine();
    const denyReq = mine2.find((r) => r.agentName === `${RUN}_denied_agent`)!;
    await adminCaller.admin.deny({ requestId: denyReq.id, reason: "sensitive tool without justification" });
    const mine3 = await ownerCaller.requests.mine();
    const denied = mine3.find((r) => r.id === denyReq.id)!;
    expect(denied.status).toBe("denied");
    expect(denied.denialReason).toBe("sensitive tool without justification");

    /* 7 — revoke path */
    await adminCaller.admin.revoke({ passportId: minted.id, reason: "integration teardown" });
    const afterRevoke = (await ownerCaller.passports.mine()).find((p) => p.id === minted.id)!;
    expect(afterRevoke.status).toBe("revoked");
    // double revoke refused
    await expect(adminCaller.admin.revoke({ passportId: minted.id, reason: "again" })).rejects.toThrow(/not active/i);

    /* 8 — vault remove */
    const v = (await ownerCaller.vault.list()).find((s) => s.keyName === KEY_NAME)!;
    await ownerCaller.vault.remove({ id: v.id });
    expect((await ownerCaller.vault.list()).some((s) => s.keyName === KEY_NAME)).toBe(false);
  }, 60_000);
});
