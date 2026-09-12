import {
  buildSBinanceEnvelope,
  buildSignedSBinanceRequest,
  parseSBinanceUserDataMessage,
  type SignedRelayRequest,
} from "./sBinanceRelay";

export type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type RelayEvidence = {
  eventType: string;
  eventTime: number;
  subscriptionId: number | null;
  deliveryId: string;
  attempts: number;
  httpStatus: number;
  deliveredAt: string;
};

export const S_BINANCE_WS_API_URL = "wss://ws-api.binance.com:443/ws-api/v3";
export const S_BINANCE_ROTATE_AFTER_MS = 23 * 60 * 60 * 1000 + 45 * 60 * 1000;

export function shouldRotateSBinanceConnection(input: {
  openedAtMs: number;
  nowMs: number;
  rotateAfterMs?: number;
}): boolean {
  return input.nowMs - input.openedAtMs >= (input.rotateAfterMs ?? S_BINANCE_ROTATE_AFTER_MS);
}

export function reconnectDelayMs(attempt: number, baseMs = 500, maxMs = 30_000): number {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("attempt must be a non-negative integer");
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function postSignedSBinanceRequest(input: {
  receiverUrl: string;
  request: SignedRelayRequest;
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}): Promise<{ attempts: number; status: number }> {
  const fetchImpl = input.fetchImpl ?? (fetch as unknown as FetchLike);
  const maxAttempts = input.maxAttempts ?? 4;
  const sleep = input.sleep ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  if (!/^https:\/\//i.test(input.receiverUrl)) throw new Error("receiverUrl must use HTTPS");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 8) {
    throw new Error("maxAttempts must be an integer between 1 and 8");
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(input.receiverUrl, {
        method: "POST",
        headers: input.request.headers,
        body: input.request.body,
        signal: input.signal,
      });
      if (response.ok) return { attempts: attempt, status: response.status };
      if (!isRetryableHttpStatus(response.status) || attempt === maxAttempts) {
        const detail = (await response.text()).slice(0, 200);
        throw new Error(`receiver rejected relay: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
      }
      lastError = new Error(`retryable receiver response: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
    }

    await sleep(reconnectDelayMs(attempt - 1, 250, 4_000));
  }

  throw lastError instanceof Error ? lastError : new Error("relay delivery failed");
}

export async function relaySBinanceUserDataPayload(input: {
  rawPayload: string;
  receiverUrl: string;
  webhookSecret: string;
  receivedAt?: Date;
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}): Promise<{ evidence: RelayEvidence; reconnectRequired: boolean }> {
  const parsed = parseSBinanceUserDataMessage(input.rawPayload);
  const envelope = buildSBinanceEnvelope({
    event: parsed.event,
    subscriptionId: parsed.subscriptionId,
    receivedAt: input.receivedAt,
  });
  const request = buildSignedSBinanceRequest(envelope, input.webhookSecret);
  const delivery = await postSignedSBinanceRequest({
    receiverUrl: input.receiverUrl,
    request,
    fetchImpl: input.fetchImpl,
    maxAttempts: input.maxAttempts,
    sleep: input.sleep,
    signal: input.signal,
  });

  return {
    evidence: {
      eventType: envelope.event.e,
      eventTime: envelope.event.E,
      subscriptionId: envelope.subscription_id ?? null,
      deliveryId: envelope.delivery_id,
      attempts: delivery.attempts,
      httpStatus: delivery.status,
      deliveredAt: (input.receivedAt ?? new Date()).toISOString(),
    },
    reconnectRequired:
      envelope.event.e === "eventStreamTerminated" || envelope.event.e === "serverShutdown",
  };
}

export function buildListenTokenSubscribeRequest(input: {
  requestId: string;
  listenToken: string;
}): string {
  if (!input.requestId.trim()) throw new Error("requestId is required");
  if (!input.listenToken.trim()) throw new Error("listenToken is required");
  return JSON.stringify({
    id: input.requestId,
    method: "userDataStream.subscribe.listenToken",
    params: { listenToken: input.listenToken },
  });
}
