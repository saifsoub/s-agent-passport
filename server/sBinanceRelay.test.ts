import { describe, expect, it } from "vitest";
import {
  buildSBinanceEnvelope,
  buildSignedSBinanceRequest,
  DeliveryReplayGuard,
  deliveryIdForSBinanceEvent,
  parseSBinanceUserDataMessage,
  signSBinanceBody,
  verifySBinanceSignature,
  verifySignedSBinanceRequest,
} from "./sBinanceRelay";

const secret = "test-only-secret";

function sampleEvent() {
  return {
    e: "balanceUpdate",
    E: 1_789_000_000_000,
    a: "USDT",
    d: "12.34",
  };
}

describe("S/Binance signed relay", () => {
  it("parses the current WebSocket API wrapped user-data event", () => {
    const parsed = parseSBinanceUserDataMessage(
      JSON.stringify({ subscriptionId: 7, event: sampleEvent() }),
    );
    expect(parsed.subscriptionId).toBe(7);
    expect(parsed.event).toEqual(sampleEvent());
  });

  it("builds a stable deterministic delivery ID for the same provider payload", () => {
    const a = deliveryIdForSBinanceEvent({ event: sampleEvent(), subscriptionId: 7 });
    const b = deliveryIdForSBinanceEvent({ event: sampleEvent(), subscriptionId: 7 });
    const c = deliveryIdForSBinanceEvent({ event: sampleEvent(), subscriptionId: 8 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^sbin-balanceUpdate-1789000000000-[0-9a-f]{24}$/);
  });

  it("builds a read-only envelope matching the connector contract", () => {
    const envelope = buildSBinanceEnvelope({
      deliveryId: "delivery-001",
      event: sampleEvent(),
      receivedAt: new Date("2026-09-12T09:00:00.000Z"),
      subscriptionId: 42,
    });

    expect(envelope).toMatchObject({
      delivery_id: "delivery-001",
      connector: "S/Binance",
      mode: "read_only",
      received_at: "2026-09-12T09:00:00.000Z",
      subscription_id: 42,
      event: sampleEvent(),
    });
  });

  it("rejects event types outside the read-only allowlist", () => {
    expect(() =>
      buildSBinanceEnvelope({
        deliveryId: "delivery-002",
        event: { e: "newOrder", E: 1_789_000_000_001 },
      }),
    ).toThrow(/unsupported Binance event type/);
  });

  it("signs the exact UTF-8 body with HMAC-SHA256", () => {
    const body = '{"hello":"world"}';
    const signature = signSBinanceBody(body, secret);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifySBinanceSignature(body, signature, secret)).toBe(true);
    expect(verifySBinanceSignature(`${body} `, signature, secret)).toBe(false);
  });

  it("emits delivery and signature headers bound to the body", () => {
    const envelope = buildSBinanceEnvelope({
      deliveryId: "delivery-003",
      event: sampleEvent(),
      receivedAt: new Date("2026-09-12T09:00:00.000Z"),
    });
    const request = buildSignedSBinanceRequest(envelope, secret);

    expect(request.headers["x-s-binance-delivery"]).toBe("delivery-003");
    expect(verifySBinanceSignature(request.body, request.headers["x-s-binance-signature"], secret)).toBe(true);
  });

  it("suppresses duplicate downstream work through the replay guard", () => {
    const envelope = buildSBinanceEnvelope({
      deliveryId: "delivery-004",
      event: sampleEvent(),
      receivedAt: new Date("2026-09-12T09:00:00.000Z"),
    });
    const request = buildSignedSBinanceRequest(envelope, secret);
    const replayGuard = new DeliveryReplayGuard();

    expect(
      verifySignedSBinanceRequest({
        body: request.body,
        deliveryHeader: request.headers["x-s-binance-delivery"],
        signatureHeader: request.headers["x-s-binance-signature"],
        secret,
        replayGuard,
      }).status,
    ).toBe("accepted");

    expect(
      verifySignedSBinanceRequest({
        body: request.body,
        deliveryHeader: request.headers["x-s-binance-delivery"],
        signatureHeader: request.headers["x-s-binance-signature"],
        secret,
        replayGuard,
      }).status,
    ).toBe("duplicate");
  });

  it("rejects a mismatched delivery header", () => {
    const envelope = buildSBinanceEnvelope({
      deliveryId: "delivery-005",
      event: sampleEvent(),
    });
    const request = buildSignedSBinanceRequest(envelope, secret);

    expect(() =>
      verifySignedSBinanceRequest({
        body: request.body,
        deliveryHeader: "another-delivery",
        signatureHeader: request.headers["x-s-binance-signature"],
        secret,
        replayGuard: new DeliveryReplayGuard(),
      }),
    ).toThrow(/delivery header does not match/);
  });
});
