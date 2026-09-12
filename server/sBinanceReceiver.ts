import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import {
  S_BINANCE_EVENT_TYPES,
  verifySBinanceSignature,
  type SBinanceEnvelope,
} from "./sBinanceRelay";

export interface DeliveryReplayStore {
  claim(deliveryId: string): Promise<"accepted" | "duplicate">;
}

export class FileDeliveryReplayStore implements DeliveryReplayStore {
  private loaded = false;
  private readonly seen = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const text = await fs.readFile(this.filePath, "utf8");
      for (const line of text.split("\n")) {
        const value = line.trim();
        if (value) this.seen.add(value);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
    this.loaded = true;
  }

  async claim(deliveryId: string): Promise<"accepted" | "duplicate"> {
    if (!deliveryId.trim()) throw new Error("deliveryId is required");
    let result: "accepted" | "duplicate" = "accepted";
    this.queue = this.queue.then(async () => {
      await this.load();
      if (this.seen.has(deliveryId)) {
        result = "duplicate";
        return;
      }
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.appendFile(this.filePath, `${deliveryId}\n`, { encoding: "utf8", mode: 0o600 });
      this.seen.add(deliveryId);
    });
    await this.queue;
    return result;
  }
}

function parseAndValidateEnvelope(body: string): SBinanceEnvelope {
  const parsed = JSON.parse(body) as SBinanceEnvelope;
  if (parsed.connector !== "S/Binance") throw new Error("invalid connector");
  if (parsed.mode !== "read_only") throw new Error("invalid mode");
  if (!parsed.delivery_id || typeof parsed.delivery_id !== "string") {
    throw new Error("missing delivery_id");
  }
  if (!parsed.event || !S_BINANCE_EVENT_TYPES.has(parsed.event.e as never)) {
    throw new Error("unsupported event type");
  }
  if (!Number.isInteger(parsed.event.E) || parsed.event.E < 0) {
    throw new Error("invalid event time");
  }
  return parsed;
}

export async function acceptSBinanceWebhook(input: {
  body: string;
  deliveryHeader: string | undefined;
  signatureHeader: string | undefined;
  secret: string;
  replayStore: DeliveryReplayStore;
}): Promise<{ status: "accepted" | "duplicate"; envelope: SBinanceEnvelope }> {
  if (!input.secret) throw new Error("receiver secret is not configured");
  if (!input.signatureHeader || !verifySBinanceSignature(input.body, input.signatureHeader, input.secret)) {
    throw new Error("invalid signature");
  }
  const envelope = parseAndValidateEnvelope(input.body);
  if (!input.deliveryHeader || input.deliveryHeader !== envelope.delivery_id) {
    throw new Error("delivery header does not match body.delivery_id");
  }
  const status = await input.replayStore.claim(envelope.delivery_id);
  return { status, envelope };
}

export function registerSBinanceReceiverRoute(
  app: Express,
  input: { secret: string; replayStore: DeliveryReplayStore },
): void {
  app.post(
    "/api/integrations/s-binance/events",
    // Exact raw bytes are required because the signature covers the exact UTF-8 request body.
    // This route must be registered before the app-wide express.json() middleware.
    (req: Request, res: Response, next) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", chunk => {
        body += chunk;
        if (Buffer.byteLength(body, "utf8") > 1024 * 1024) {
          req.destroy(new Error("S/Binance payload too large"));
        }
      });
      req.on("end", async () => {
        try {
          const result = await acceptSBinanceWebhook({
            body,
            deliveryHeader: req.header("x-s-binance-delivery") ?? undefined,
            signatureHeader: req.header("x-s-binance-signature") ?? undefined,
            secret: input.secret,
            replayStore: input.replayStore,
          });
          res.status(result.status === "accepted" ? 202 : 200).json({
            status: result.status,
            delivery_id: result.envelope.delivery_id,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "invalid S/Binance webhook";
          const authFailure = /signature/.test(message);
          res.status(authFailure ? 401 : 400).json({ error: message });
        }
      });
      req.on("error", next);
    },
  );
}
