import "dotenv/config";
import { runSBinanceRelayLoop } from "./sBinanceSocket";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const listenToken = requireEnv("S_BINANCE_LISTEN_TOKEN");
  const receiverUrl = requireEnv("S_BINANCE_RECEIVER_URL");
  const webhookSecret = requireEnv("S_BINANCE_WEBHOOK_SECRET");

  if (!/^https:\/\//i.test(receiverUrl)) {
    throw new Error("S_BINANCE_RECEIVER_URL must use HTTPS");
  }

  // Deliberately log no token, secret, private event payload, account identifier,
  // order content, balance content, or destination credentials.
  console.log("S/Binance read-only relay starting");
  const result = await runSBinanceRelayLoop({
    listenToken,
    receiverUrl,
    webhookSecret,
    signal: controller.signal,
  });
  console.log(`S/Binance relay stopped after ${result.sessions} session(s); ${result.deliveries.length} safe delivery receipt(s)`);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : "unknown relay failure";
  console.error(`S/Binance relay failed: ${message}`);
  process.exitCode = 1;
});
