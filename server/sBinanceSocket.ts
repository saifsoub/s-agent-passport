import {
  buildListenTokenSubscribeRequest,
  reconnectDelayMs,
  relaySBinanceUserDataPayload,
  S_BINANCE_ROTATE_AFTER_MS,
  S_BINANCE_WS_API_URL,
  type FetchLike,
  type RelayEvidence,
} from "./sBinanceRuntime";

export type SocketMessageData = string | ArrayBuffer | ArrayBufferView;

export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: SocketMessageData }) => void): void;
  addEventListener(type: "close", listener: (event: { code?: number; reason?: string }) => void): void;
  addEventListener(type: "error", listener: () => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

function defaultWebSocketFactory(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike;
}

function messageToUtf8(data: SocketMessageData): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
}

function looksLikeSubscriptionResponse(raw: string): boolean {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return "id" in value && ("status" in value || "result" in value) && !("event" in value);
  } catch {
    return false;
  }
}

export type SBinanceSessionExit = {
  reason: "provider_signal" | "rotation" | "closed" | "error" | "aborted";
  deliveries: RelayEvidence[];
};

export function runSBinanceListenTokenSession(input: {
  listenToken: string;
  receiverUrl: string;
  webhookSecret: string;
  requestId?: string;
  webSocketUrl?: string;
  wsFactory?: WebSocketFactory;
  fetchImpl?: FetchLike;
  rotateAfterMs?: number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  signal?: AbortSignal;
}): Promise<SBinanceSessionExit> {
  if (!input.listenToken.trim()) throw new Error("listenToken is required");
  if (!input.webhookSecret) throw new Error("webhookSecret is required");
  if (!/^https:\/\//i.test(input.receiverUrl)) throw new Error("receiverUrl must use HTTPS");

  const ws = (input.wsFactory ?? defaultWebSocketFactory)(input.webSocketUrl ?? S_BINANCE_WS_API_URL);
  const deliveries: RelayEvidence[] = [];
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  const rotateAfterMs = input.rotateAfterMs ?? S_BINANCE_ROTATE_AFTER_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    let rotateTimer: ReturnType<typeof setTimeout> | undefined;
    let serial = Promise.resolve();

    const finish = (reason: SBinanceSessionExit["reason"]) => {
      if (settled) return;
      settled = true;
      if (rotateTimer) clearTimer(rotateTimer);
      input.signal?.removeEventListener("abort", onAbort);
      resolve({ reason, deliveries });
    };

    const onAbort = () => {
      ws.close(1000, "aborted");
      finish("aborted");
    };

    if (input.signal?.aborted) {
      onAbort();
      return;
    }
    input.signal?.addEventListener("abort", onAbort, { once: true });

    ws.addEventListener("open", () => {
      ws.send(
        buildListenTokenSubscribeRequest({
          requestId: input.requestId ?? `s-binance-${Date.now()}`,
          listenToken: input.listenToken,
        }),
      );
      rotateTimer = setTimer(() => {
        ws.close(1000, "proactive rotation before Binance connection lifetime");
        finish("rotation");
      }, rotateAfterMs);
    });

    ws.addEventListener("message", event => {
      const raw = messageToUtf8(event.data);
      if (looksLikeSubscriptionResponse(raw)) return;

      serial = serial
        .then(async () => {
          const result = await relaySBinanceUserDataPayload({
            rawPayload: raw,
            receiverUrl: input.receiverUrl,
            webhookSecret: input.webhookSecret,
            fetchImpl: input.fetchImpl,
            signal: input.signal,
          });
          deliveries.push(result.evidence);
          if (result.reconnectRequired) {
            ws.close(1000, "provider requested reconnect");
            finish("provider_signal");
          }
        })
        .catch(error => {
          ws.close(1011, "relay failure");
          if (!settled) {
            settled = true;
            if (rotateTimer) clearTimer(rotateTimer);
            reject(error);
          }
        });
    });

    ws.addEventListener("close", () => finish("closed"));
    ws.addEventListener("error", () => {
      if (!settled) finish("error");
    });
  });
}

export async function runSBinanceRelayLoop(input: {
  listenToken: string;
  receiverUrl: string;
  webhookSecret: string;
  wsFactory?: WebSocketFactory;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  maxSessions?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ sessions: number; deliveries: RelayEvidence[] }> {
  const sleep = input.sleep ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  const maxSessions = input.maxSessions ?? Number.POSITIVE_INFINITY;
  const deliveries: RelayEvidence[] = [];
  let sessions = 0;

  while (!input.signal?.aborted && sessions < maxSessions) {
    const result = await runSBinanceListenTokenSession({
      listenToken: input.listenToken,
      receiverUrl: input.receiverUrl,
      webhookSecret: input.webhookSecret,
      wsFactory: input.wsFactory,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
    });
    sessions += 1;
    deliveries.push(...result.deliveries);
    if (result.reason === "aborted") break;
    await sleep(reconnectDelayMs(Math.min(sessions - 1, 6)));
  }

  return { sessions, deliveries };
}
