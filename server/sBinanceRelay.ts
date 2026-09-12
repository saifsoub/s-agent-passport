import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const S_BINANCE_EVENT_TYPES = new Set([
  "outboundAccountPosition",
  "balanceUpdate",
  "executionReport",
  "externalLockUpdate",
  "eventStreamTerminated",
  "serverShutdown",
] as const);

export type SBinanceEvent = {
  e: string;
  E: number;
  [key: string]: unknown;
};

export type SBinanceEnvelope = {
  delivery_id: string;
  connector: "S/Binance";
  mode: "read_only";
  received_at: string;
  subscription_id?: number | null;
  event: SBinanceEvent;
};

export type SignedRelayRequest = {
  body: string;
  headers: {
    "content-type": "application/json";
    "x-s-binance-delivery": string;
    "x-s-binance-signature": string;
  };
};

function assertAllowedEvent(event: SBinanceEvent): void {
  if (!event || typeof event !== "object") throw new Error("event must be an object");
  if (!S_BINANCE_EVENT_TYPES.has(event.e as never)) {
    throw new Error(`unsupported Binance event type: ${String(event.e)}`);
  }
  if (!Number.isInteger(event.E) || event.E < 0) {
    throw new Error("event.E must be a non-negative integer timestamp");
  }
}

export function parseSBinanceUserDataMessage(raw: string): {
  event: SBinanceEvent;
  subscriptionId: number | null;
} {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const wrappedEvent = parsed.event;
  const event = (wrappedEvent && typeof wrappedEvent === "object" ? wrappedEvent : parsed) as SBinanceEvent;
  const subscriptionId =
    typeof parsed.subscriptionId === "number" && Number.isInteger(parsed.subscriptionId)
      ? parsed.subscriptionId
      : null;

  assertAllowedEvent(event);
  return { event, subscriptionId };
}

export function deliveryIdForSBinanceEvent(input: {
  event: SBinanceEvent;
  subscriptionId?: number | null;
}): string {
  assertAllowedEvent(input.event);
  const digest = createHash("sha256")
    .update(JSON.stringify({ subscriptionId: input.subscriptionId ?? null, event: input.event }), "utf8")
    .digest("hex")
    .slice(0, 24);
  return `sbin-${input.event.e}-${input.event.E}-${digest}`;
}

export function buildSBinanceEnvelope(input: {
  deliveryId?: string;
  event: SBinanceEvent;
  receivedAt?: Date;
  subscriptionId?: number | null;
}): SBinanceEnvelope {
  assertAllowedEvent(input.event);
  const deliveryId = input.deliveryId ??
    deliveryIdForSBinanceEvent({ event: input.event, subscriptionId: input.subscriptionId });
  if (!deliveryId.trim()) throw new Error("deliveryId is required");

  return {
    delivery_id: deliveryId,
    connector: "S/Binance",
    mode: "read_only",
    received_at: (input.receivedAt ?? new Date()).toISOString(),
    subscription_id: input.subscriptionId ?? null,
    event: input.event,
  };
}

export function signSBinanceBody(body: string, secret: string): string {
  if (!secret) throw new Error("webhook secret is required");
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function buildSignedSBinanceRequest(
  envelope: SBinanceEnvelope,
  secret: string,
): SignedRelayRequest {
  const body = JSON.stringify(envelope);
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-s-binance-delivery": envelope.delivery_id,
      "x-s-binance-signature": signSBinanceBody(body, secret),
    },
  };
}

export function verifySBinanceSignature(body: string, providedHex: string, secret: string): boolean {
  if (!providedHex || !/^[0-9a-f]{64}$/i.test(providedHex)) return false;
  const expected = Buffer.from(signSBinanceBody(body, secret), "hex");
  const provided = Buffer.from(providedHex, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export class DeliveryReplayGuard {
  private readonly seen = new Set<string>();

  accept(deliveryId: string): "accepted" | "duplicate" {
    if (!deliveryId.trim()) throw new Error("deliveryId is required");
    if (this.seen.has(deliveryId)) return "duplicate";
    this.seen.add(deliveryId);
    return "accepted";
  }

  clear(): void {
    this.seen.clear();
  }
}

export function verifySignedSBinanceRequest(input: {
  body: string;
  deliveryHeader: string;
  signatureHeader: string;
  secret: string;
  replayGuard: DeliveryReplayGuard;
}): { status: "accepted" | "duplicate"; envelope: SBinanceEnvelope } {
  if (!verifySBinanceSignature(input.body, input.signatureHeader, input.secret)) {
    throw new Error("invalid signature");
  }

  const parsed = JSON.parse(input.body) as SBinanceEnvelope;
  if (parsed.connector !== "S/Binance" || parsed.mode !== "read_only") {
    throw new Error("invalid connector or mode");
  }
  if (parsed.delivery_id !== input.deliveryHeader) {
    throw new Error("delivery header does not match body.delivery_id");
  }
  assertAllowedEvent(parsed.event);

  return {
    status: input.replayGuard.accept(parsed.delivery_id),
    envelope: parsed,
  };
}
