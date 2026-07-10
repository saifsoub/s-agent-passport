import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  AGENT_TYPES,
  TOOL_CATALOG,
  decryptSecret,
  encryptSecret,
  maskSecret,
  mintPassport,
  type PassportPayload,
} from "./passport";
import * as pdb from "./passportDb";
import {
  finishAuthentication,
  finishRegistration,
  isRecentlyVerified,
  listPasskeys,
  removePasskey,
  rpFromRequest,
  setVaultLock,
  startAuthentication,
  startRegistration,
  vaultLockBlockReason,
} from "./webauthn";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

const KEY_NAME_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

function safeDecrypt(stored: string): string {
  try {
    return decryptSecret(stored);
  } catch {
    return "";
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /* ===== Public catalog ===== */
  catalog: router({
    tools: publicProcedure.query(() => TOOL_CATALOG),
    agentTypes: publicProcedure.query(() => AGENT_TYPES),
  }),

  /* ===== Private vault ===== */
  vault: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await pdb.listVaultSecrets(ctx.user.id);
      return rows.map((r) => ({
        id: r.id,
        keyName: r.keyName,
        masked: maskSecret(safeDecrypt(r.valueEncrypted)),
        createdAt: r.createdAt,
      }));
    }),
    add: protectedProcedure
      .input(z.object({ keyName: z.string().regex(KEY_NAME_RE, "Use UPPER_SNAKE_CASE, e.g. OPENAI_API_KEY"), value: z.string().min(1).max(4096) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await pdb.listVaultSecrets(ctx.user.id);
        if (existing.some((s) => s.keyName === input.keyName)) {
          throw new TRPCError({ code: "CONFLICT", message: "A secret with this key name is already sealed in your vault." });
        }
        if (existing.length >= 50) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Vault limit reached (50 secrets)." });
        }
        await pdb.addVaultSecret(ctx.user.id, input.keyName, encryptSecret(input.value));
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await pdb.deleteVaultSecret(ctx.user.id, input.id);
        return { success: true } as const;
      }),
  }),

  /* ===== Passport requests (owner side) ===== */
  requests: router({
    submit: protectedProcedure
      .input(
        z.object({
          agentName: z.string().min(2).max(128).regex(/^[a-zA-Z0-9_\-. ]+$/, "Letters, digits, _ - . only"),
          agentType: z.enum(AGENT_TYPES),
          toolIds: z.array(z.string()).min(1, "Select at least one tool").max(TOOL_CATALOG.length),
          secretKeys: z.array(z.string()).max(50),
          ttlHours: z.number().int().positive().max(24 * 365).nullable(),
          purpose: z.string().max(2000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const validTools = input.toolIds.filter((id) => TOOL_CATALOG.some((t) => t.id === id));
        if (validTools.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No valid tools selected." });
        // only grant vault keys the owner actually holds
        const owned = await pdb.listVaultSecrets(ctx.user.id);
        const grantable = input.secretKeys.filter((k) => owned.some((s) => s.keyName === k));
        await pdb.createRequest({
          userId: ctx.user.id,
          agentName: input.agentName.trim(),
          agentType: input.agentType,
          toolIds: validTools,
          secretKeys: grantable,
          ttlHours: input.ttlHours,
          purpose: input.purpose.trim(),
        });
        return { success: true } as const;
      }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const reqs = await pdb.listMyRequests(ctx.user.id);
      const out = [];
      for (const r of reqs) {
        const passport = r.status === "approved" ? await pdb.getPassportByRequestId(r.id) : undefined;
        out.push({ ...r, passport: passport ?? null });
      }
      return out;
    }),
  }),

  /* ===== Admin approval desk ===== */
  admin: router({
    pending: adminProcedure.query(() => pdb.listAllRequests()),
    approve: adminProcedure
      .input(z.object({ requestId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const req = await pdb.getRequestById(input.requestId);
        if (!req) throw new TRPCError({ code: "NOT_FOUND" });
        if (req.status !== "pending") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Request already decided." });

        const payload = mintPassport({
          agentName: req.agentName,
          agentType: req.agentType,
          toolIds: req.toolIds,
          secretKeys: req.secretKeys,
          ttlHours: req.ttlHours,
          purpose: req.purpose ?? "",
          ownerName: String(req.userId),
          ownerOpenId: "",
          approvedBy: ctx.user.name || "S/ Admin",
        });

        await pdb.decideRequest(input.requestId, "approved", ctx.user.name || "S/ Admin");
        await pdb.insertPassport({
          passportId: payload.passport_id,
          requestId: req.id,
          userId: req.userId,
          agentName: req.agentName,
          agentType: req.agentType,
          payload: payload as unknown as Record<string, unknown>,
          checksum: payload.checksum,
          signature: payload.signature,
          status: "active",
          expiresAt: payload.expires_at ? new Date(payload.expires_at) : null,
        });
        return { success: true, passportId: payload.passport_id } as const;
      }),
    deny: adminProcedure
      .input(z.object({ requestId: z.number().int(), reason: z.string().min(2).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const req = await pdb.getRequestById(input.requestId);
        if (!req) throw new TRPCError({ code: "NOT_FOUND" });
        if (req.status !== "pending") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Request already decided." });
        await pdb.decideRequest(input.requestId, "denied", ctx.user.name || "S/ Admin", input.reason);
        return { success: true } as const;
      }),
    allPassports: adminProcedure.query(() => pdb.listAllPassports()),
    revoke: adminProcedure
      .input(z.object({ passportId: z.number().int(), reason: z.string().min(2).max(500) }))
      .mutation(async ({ input }) => {
        const p = await pdb.getPassportById(input.passportId);
        if (!p) throw new TRPCError({ code: "NOT_FOUND" });
        if (p.status !== "active") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Passport is not active." });
        await pdb.revokePassport(input.passportId, input.reason);
        return { success: true } as const;
      }),
  }),

  /* ===== Security: passkeys + vault lock ===== */
  security: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const keys = await listPasskeys(ctx.user.id);
      return {
        vaultLockEnabled: !!(ctx.user as { vaultLockEnabled?: number }).vaultLockEnabled,
        passkeyCount: keys.length,
        unlocked: isRecentlyVerified(ctx.user.id),
        passkeys: keys,
      };
    }),
    registerOptions: protectedProcedure.mutation(({ ctx }) => {
      const { rpID } = rpFromRequest(ctx.req);
      return startRegistration(
        { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
        rpID,
      );
    }),
    registerVerify: protectedProcedure
      .input(z.object({ response: z.any(), label: z.string().max(128).nullable() }))
      .mutation(async ({ ctx, input }) => {
        const { rpID, origin } = rpFromRequest(ctx.req);
        const res = await finishRegistration(ctx.user.id, input.response, rpID, origin, input.label);
        if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: res.reason });
        return { success: true } as const;
      }),
    authOptions: protectedProcedure.mutation(async ({ ctx }) => {
      const { rpID } = rpFromRequest(ctx.req);
      const options = await startAuthentication(ctx.user.id, rpID);
      if (!options) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No passkeys enrolled yet." });
      return options;
    }),
    authVerify: protectedProcedure
      .input(z.object({ response: z.any() }))
      .mutation(async ({ ctx, input }) => {
        const { rpID, origin } = rpFromRequest(ctx.req);
        const res = await finishAuthentication(ctx.user.id, input.response, rpID, origin);
        if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: res.reason });
        return { success: true } as const;
      }),
    removePasskey: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await removePasskey(ctx.user.id, input.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true } as const;
      }),
    setVaultLock: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const res = await setVaultLock(ctx.user.id, input.enabled);
        if (!res.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: res.reason });
        return { success: true, enabled: input.enabled } as const;
      }),
  }),

  /* ===== Issued passports (owner side) ===== */
  passports: router({
    mine: protectedProcedure.query(({ ctx }) => pdb.listMyPassports(ctx.user.id)),
    /** Full payload + decrypted vault values for the embed bundle download. */
    exportData: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const p = await pdb.getPassportById(input.id);
        if (!p || p.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        const blockReason = await vaultLockBlockReason(ctx.user.id);
        if (blockReason) throw new TRPCError({ code: "FORBIDDEN", message: blockReason });
        const payload = p.payload as unknown as PassportPayload;
        const refs = (payload.metadata?.vault_secret_refs as string[]) ?? [];
        const secrets = await pdb.getVaultSecretsByNames(ctx.user.id, refs);
        return {
          passport: payload,
          status: p.status,
          issuedAt: p.issuedAt,
          expiresAt: p.expiresAt,
          secretEnv: secrets.map((s) => ({ key: s.keyName, value: safeDecrypt(s.valueEncrypted) })),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
