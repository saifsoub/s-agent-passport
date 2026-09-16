import { describe, expect, it } from "vitest";
import {
  buildListenTokenSubscribeRequest,
  postSignedSBinanceRequest,
  reconnectDelayMs,
  relaySBinanceUserDataPayload,
  shouldRotateSBinanceConnection,
  type FetchLike,
} from "./sBinanceRuntime";
import { buildSBinanceEnvelope, buildSignedSBinanceRequest } from "./sBinanceRelay";

const secret = "test-only-secret";

function fetchSequence(statuses: number[]): FetchLike {
  let index = 0;
  return async () => {
    const status = statuses[Math.min(index, statuses.length - 1)];
    index += 1;
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() {
        return status >= 200 && status < 300 ? "ok" : "synthetic failure";
      },
    };
  };
}

describe("S/Binance runtime helpers", () => {
  it("forces connection rotation before the 24-hour lifetime", () => {
    expect(
      shouldRotateSBinanceConnection({
        openedAtMs: 0,
        nowMs: 23 * 60 * 60 * 1000,
      }),
    ).toBe(false);
    expect(
      shouldRotateSBinanceConnection({
        openedAtMs: 0,
        nowMs: 23 * 60 * 60 * 1000 + 45 * 60 * 1000,
      }),
    ).toBe(true);
  });

  it("caps reconnect backoff", () => {
    expect(reconnectDelayMs(0)).toBe(500);
    expect(reconnectDelayMs(3)).toBe(4_000);
    expect(reconnectDelayMs(20)).toBe(30_000);
  });

  it("retries bounded receiver failures and succeeds", async () => {
    const request = buildSignedSBinanceRequest(
      buildSBinanceEnvelope({
        deliveryId: "delivery-runtime-1",
        event: { e: "balanceUpdate", E: 1_789_000_000_010 },
      }),
      secret,
    );
    const sleeps: number[] = [];
    const result = await postSignedSBinanceRequest({
      receiverUrl: "https://receiver.example.test/binance",
      request,
      fetchImpl: fetchSequence([503, 429, 200]),
      sleep: async ms => {
        sleeps.push(ms);
      },
    });

    expect(result).toEqual({ attempts: 3, status: 200 });
    expect(sleeps).toEqual([250, 500]);
  });

  it("does not retry non-retryable receiver rejection", async () => {
    const request = buildSignedSBinanceRequest(
      buildSBinanceEnvelope({
        deliveryId: "delivery-runtime-2",
        event: { e: "balanceUpdate", E: 1_789_000_000_011 },
      }),
      secret,
    );
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return {
        ok: false,
        status: 401,
        async text() {
          return "unauthorized";
        },
      };
    };

    await expect(
      postSignedSBinanceRequest({
        receiverUrl: "https://receiver.example.test/binance",
        request,
        fetchImpl,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/HTTP 401/);
    expect(calls).toBe(1);
  });

  it("relays wrapped user-data payloads and marks termination for reconnect", async () => {
    const receivedAt = new Date("2026-09-12T09:40:00.000Z");
    const output = await relaySBinanceUserDataPayload({
      rawPayload: JSON.stringify({
        subscriptionId: 4,
        event: { e: "eventStreamTerminated", E: 1_789_000_000_012 },
      }),
      receiverUrl: "https://receiver.example.test/binance",
      webhookSecret: secret,
      receivedAt,
      fetchImpl: fetchSequence([200]),
      sleep: async () => undefined,
    });

    expect(output.reconnectRequired).toBe(true);
    expect(output.evidence).toMatchObject({
      eventType: "eventStreamTerminated",
      eventTime: 1_789_000_000_012,
      subscriptionId: 4,
      attempts: 1,
      httpStatus: 200,
      deliveredAt: "2026-09-12T09:40:00.000Z",
    });
    expect(output.evidence.deliveryId).toMatch(/^sbin-eventStreamTerminated-/);
  });

  it("builds the current listen-token subscription request without logging credentials", () => {
    expect(
      buildListenTokenSubscribeRequest({ requestId: "req-1", listenToken: "secret-token" }),
    ).toBe(
      JSON.stringify({
        id: "req-1",
        method: "userDataStream.subscribe.listenToken",
        params: { listenToken: "secret-token" },
      }),
    );
  });
});
