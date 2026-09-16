import { describe, expect, it } from "vitest";
import {
  runSBinanceListenTokenSession,
  runSBinanceRelayLoop,
  type SocketMessageData,
  type WebSocketFactory,
  type WebSocketLike,
} from "./sBinanceSocket";
import type { FetchLike } from "./sBinanceRuntime";

class FakeSocket implements WebSocketLike {
  sent: string[] = [];
  closed: { code?: number; reason?: string }[] = [];
  private openListeners: Array<() => void> = [];
  private messageListeners: Array<(event: { data: SocketMessageData }) => void> = [];
  private closeListeners: Array<(event: { code?: number; reason?: string }) => void> = [];
  private errorListeners: Array<() => void> = [];

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closed.push({ code, reason });
    for (const listener of this.closeListeners) listener({ code, reason });
  }

  addEventListener(type: "open" | "message" | "close" | "error", listener: any) {
    if (type === "open") this.openListeners.push(listener);
    if (type === "message") this.messageListeners.push(listener);
    if (type === "close") this.closeListeners.push(listener);
    if (type === "error") this.errorListeners.push(listener);
  }

  open() {
    for (const listener of this.openListeners) listener();
  }

  message(data: SocketMessageData) {
    for (const listener of this.messageListeners) listener({ data });
  }

  error() {
    for (const listener of this.errorListeners) listener();
  }
}

function successfulFetch(calls: Array<{ url: string; body: string; headers: Record<string, string> }>): FetchLike {
  return async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
    return { ok: true, status: 202, async text() { return "accepted"; } };
  };
}

describe("S/Binance WebSocket relay session", () => {
  it("subscribes with a listen token and forwards allowed wrapped events", async () => {
    const socket = new FakeSocket();
    const factory: WebSocketFactory = () => socket;
    const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
    const timers: Array<() => void> = [];

    const session = runSBinanceListenTokenSession({
      listenToken: "listen-token",
      receiverUrl: "https://receiver.example.test/binance",
      webhookSecret: "webhook-secret",
      requestId: "req-1",
      wsFactory: factory,
      fetchImpl: successfulFetch(calls),
      setTimer: fn => {
        timers.push(fn);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });

    socket.open();
    expect(JSON.parse(socket.sent[0])).toEqual({
      id: "req-1",
      method: "userDataStream.subscribe.listenToken",
      params: { listenToken: "listen-token" },
    });

    socket.message(JSON.stringify({ id: "req-1", status: 200, result: { subscriptionId: 2 } }));
    socket.message(JSON.stringify({
      subscriptionId: 2,
      event: { e: "balanceUpdate", E: 1_789_000_000_200, a: "USDT", d: "1" },
    }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://receiver.example.test/binance");
    expect(calls[0].headers["x-s-binance-signature"]).toMatch(/^[0-9a-f]{64}$/);

    timers[0]();
    const result = await session;
    expect(result.reason).toBe("rotation");
    expect(result.deliveries).toHaveLength(1);
  });

  it("closes and requests reconnect when Binance terminates the stream", async () => {
    const socket = new FakeSocket();
    const session = runSBinanceListenTokenSession({
      listenToken: "listen-token",
      receiverUrl: "https://receiver.example.test/binance",
      webhookSecret: "webhook-secret",
      wsFactory: () => socket,
      fetchImpl: successfulFetch([]),
      setTimer: () => 1 as unknown as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    socket.open();
    socket.message(JSON.stringify({
      subscriptionId: 3,
      event: { e: "eventStreamTerminated", E: 1_789_000_000_201 },
    }));

    const result = await session;
    expect(result.reason).toBe("provider_signal");
    expect(socket.closed[0]?.reason).toMatch(/provider requested reconnect/);
  });

  it("runs multiple sessions with bounded reconnect sleeps", async () => {
    const sockets = [new FakeSocket(), new FakeSocket()];
    let factoryIndex = 0;
    const sleeps: number[] = [];
    const loop = runSBinanceRelayLoop({
      listenToken: "listen-token",
      receiverUrl: "https://receiver.example.test/binance",
      webhookSecret: "webhook-secret",
      wsFactory: () => sockets[factoryIndex++],
      fetchImpl: successfulFetch([]),
      maxSessions: 2,
      sleep: async ms => { sleeps.push(ms); },
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    sockets[0].open();
    sockets[0].close(1006, "network");
    await new Promise(resolve => setTimeout(resolve, 0));
    sockets[1].open();
    sockets[1].close(1006, "network");

    const result = await loop;
    expect(result.sessions).toBe(2);
    expect(sleeps).toEqual([500]);
  });
});
