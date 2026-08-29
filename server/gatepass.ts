import crypto from "crypto";
import { verifySignature, type PassportPayload } from "./passport";

export type ApprovalMode = "standing" | "owner_presence" | "one_time" | "forbidden";

export interface GatePolicy {
  gateId: string;
  allowedPassportIds: string[];
  allowedScopes: string[];
  environments: string[];
  approvalMode: ApprovalMode;
  maxTtlSeconds: number;
}

export interface SessionAdapter {
  establishSession(input: {
    gateId: string;
    passportId: string;
    scopes: string[];
  }): Promise<{ sessionHandle: string; internalCredential?: string }>;
}

export interface GateRequest {
  passport: PassportPayload;
  gateId: string;
  scopes: string[];
  environment: string;
  purpose: string;
  nonce: string;
  requestedTtlSeconds: number;
  issuedAt: string;
  ownerPresence?: { verifiedAt: string; requestNonce: string };
}

export interface GateReceipt {
  timestamp: string;
  receiptId: string;
  passportId: string;
  gateId: string;
  requestedScopes: string[];
  approvedScopes: string[];
  decision: "allow" | "deny";
  reasonCode?: string;
  approvalMode?: ApprovalMode;
  passIdHash?: string;
  expiresAt?: string;
}

export type GateResult =
  | { decision: "allow"; passId: string; sessionHandle: string; approvedScopes: string[]; expiresAt: string; receiptId: string }
  | { decision: "deny"; reasonCode: string; receiptId: string };

type ReceiptSink = (receipt: GateReceipt) => void | Promise<void>;

export class GatePassEngine {
  private readonly policies: Map<string, GatePolicy>;
  private readonly adapter: SessionAdapter;
  private readonly receiptSink: ReceiptSink;
  private readonly now: () => Date;
  private readonly usedNonces = new Set<string>();

  constructor(input: { policies: GatePolicy[]; adapter: SessionAdapter; receiptSink?: ReceiptSink; now?: () => Date }) {
    this.policies = new Map(input.policies.map((policy) => [policy.gateId, policy]));
    this.adapter = input.adapter;
    this.receiptSink = input.receiptSink ?? (() => undefined);
    this.now = input.now ?? (() => new Date());
  }

  async request(input: GateRequest): Promise<GateResult> {
    const policy = this.policies.get(input.gateId);
    if (!policy) return this.deny(input, "GATE_NOT_FOUND");
    if (!verifySignature(input.passport)) return this.deny(input, "PASSPORT_SIGNATURE_INVALID", policy);
    if (input.passport.status !== "active") return this.deny(input, "PASSPORT_INACTIVE", policy);
    if (input.passport.expires_at && new Date(input.passport.expires_at).getTime() <= this.now().getTime()) return this.deny(input, "PASSPORT_EXPIRED", policy);
    if (!policy.allowedPassportIds.includes(input.passport.passport_id)) return this.deny(input, "PASSPORT_NOT_ALLOWED", policy);
    if (!input.scopes.length || input.scopes.some((scope) => !policy.allowedScopes.includes(scope))) return this.deny(input, "SCOPE_NOT_ALLOWED", policy);
    if (!policy.environments.includes(input.environment)) return this.deny(input, "ENVIRONMENT_NOT_ALLOWED", policy);
    if (!input.nonce || input.nonce.length < 8) return this.deny(input, "NONCE_INVALID", policy);
    if (this.usedNonces.has(input.nonce)) return this.deny(input, "NONCE_REPLAY", policy);

    const issuedAt = new Date(input.issuedAt).getTime();
    const ageMs = this.now().getTime() - issuedAt;
    if (!Number.isFinite(issuedAt) || ageMs < -30_000 || ageMs > 300_000) return this.deny(input, "REQUEST_EXPIRED", policy);
    if (!Number.isInteger(input.requestedTtlSeconds) || input.requestedTtlSeconds < 30 || input.requestedTtlSeconds > policy.maxTtlSeconds) return this.deny(input, "TTL_NOT_ALLOWED", policy);

    this.usedNonces.add(input.nonce);
    if (policy.approvalMode === "forbidden") return this.deny(input, "GATE_FORBIDDEN", policy);
    if (policy.approvalMode === "owner_presence" || policy.approvalMode === "one_time") {
      const verifiedAt = input.ownerPresence ? new Date(input.ownerPresence.verifiedAt).getTime() : Number.NaN;
      const isVerified = input.ownerPresence?.requestNonce === input.nonce && Number.isFinite(verifiedAt) && Math.abs(this.now().getTime() - verifiedAt) <= 120_000;
      if (!isVerified) return this.deny(input, "OWNER_PRESENCE_REQUIRED", policy);
    }

    const session = await this.adapter.establishSession({ gateId: input.gateId, passportId: input.passport.passport_id, scopes: [...input.scopes] });
    const passId = `gp_${crypto.randomBytes(18).toString("hex")}`;
    const receiptId = `gpr_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(this.now().getTime() + input.requestedTtlSeconds * 1000).toISOString();
    await this.receiptSink({ timestamp: this.now().toISOString(), receiptId, passportId: input.passport.passport_id, gateId: input.gateId, requestedScopes: [...input.scopes], approvedScopes: [...input.scopes], decision: "allow", approvalMode: policy.approvalMode, passIdHash: crypto.createHash("sha256").update(passId).digest("hex"), expiresAt });
    return { decision: "allow", passId, sessionHandle: session.sessionHandle, approvedScopes: [...input.scopes], expiresAt, receiptId };
  }

  private async deny(input: GateRequest, reasonCode: string, policy?: GatePolicy): Promise<GateResult> {
    const receiptId = `gpr_${crypto.randomBytes(16).toString("hex")}`;
    await this.receiptSink({ timestamp: this.now().toISOString(), receiptId, passportId: input.passport.passport_id, gateId: input.gateId, requestedScopes: [...input.scopes], approvedScopes: [], decision: "deny", reasonCode, approvalMode: policy?.approvalMode });
    return { decision: "deny", reasonCode, receiptId };
  }
}
