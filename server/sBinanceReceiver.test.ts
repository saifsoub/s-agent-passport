import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSBinanceEnvelope, buildSignedSBinanceRequest } from "./sBinanceRelay";
import { acceptSBinanceWebhook, FileDeliveryReplayStore } from "./sBinanceReceiver";

const secret = "test-only-secret";
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function tempStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "s-binance-replay-"));
  cleanup.push(dir);
  const file = path.join(dir, "seen.log");
  return { file, store: new FileDeliveryReplayStore(file) };
}

describe("S/Binance receiver", () => {
  it("accepts a valid signed event and persists its delivery ID", async () => {
    const { file, store } = await tempStore();
    const request = buildSignedSBinanceRequest(
      buildSBinanceEnvelope({
        deliveryId: "receiver-001",
        event: { e: "outboundAccountPosition", E: 1_789_000_000_100 },
      }),
      secret,
    );

    const result = await acceptSBinanceWebhook({
      body: request.body,
      deliveryHeader: request.headers["x-s-binance-delivery"],
      signatureHeader: request.headers["x-s-binance-signature"],
      secret,
      replayStore: store,
    });

    expect(result.status).toBe("accepted");
    expect(await readFile(file, "utf8")).toBe("receiver-001\n");
  });

  it("detects duplicates after a new replay-store instance is created", async () => {
    const { file, store } = await tempStore();
    const request = buildSignedSBinanceRequest(
      buildSBinanceEnvelope({
        deliveryId: "receiver-002",
        event: { e: "executionReport", E: 1_789_000_000_101 },
      }),
      secret,
    );

    await acceptSBinanceWebhook({
      body: request.body,
      deliveryHeader: request.headers["x-s-binance-delivery"],
      signatureHeader: request.headers["x-s-binance-signature"],
      secret,
      replayStore: store,
    });

    const restartedStore = new FileDeliveryReplayStore(file);
    const duplicate = await acceptSBinanceWebhook({
      body: request.body,
      deliveryHeader: request.headers["x-s-binance-delivery"],
      signatureHeader: request.headers["x-s-binance-signature"],
      secret,
      replayStore: restartedStore,
    });
    expect(duplicate.status).toBe("duplicate");
  });

  it("rejects tampered request bodies", async () => {
    const { store } = await tempStore();
    const request = buildSignedSBinanceRequest(
      buildSBinanceEnvelope({
        deliveryId: "receiver-003",
        event: { e: "balanceUpdate", E: 1_789_000_000_102 },
      }),
      secret,
    );

    await expect(
      acceptSBinanceWebhook({
        body: request.body.replace("balanceUpdate", "serverShutdown"),
        deliveryHeader: request.headers["x-s-binance-delivery"],
        signatureHeader: request.headers["x-s-binance-signature"],
        secret,
        replayStore: store,
      }),
    ).rejects.toThrow(/invalid signature/);
  });

  it("rejects non-read-only envelopes even with a valid signature", async () => {
    const { store } = await tempStore();
    const envelope = buildSBinanceEnvelope({
      deliveryId: "receiver-004",
      event: { e: "balanceUpdate", E: 1_789_000_000_103 },
    });
    const unsafeBody = JSON.stringify({ ...envelope, mode: "trade" });
    const { signSBinanceBody } = await import("./sBinanceRelay");

    await expect(
      acceptSBinanceWebhook({
        body: unsafeBody,
        deliveryHeader: envelope.delivery_id,
        signatureHeader: signSBinanceBody(unsafeBody, secret),
        secret,
        replayStore: store,
      }),
    ).rejects.toThrow(/invalid mode/);
  });
});
