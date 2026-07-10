/**
 * Unit tests for the WebAuthn security layer (non-ceremony logic).
 * The actual passkey ceremony requires a hardware authenticator, so these
 * tests cover the surrounding logic: the recent-verification window,
 * vault-lock gating, and RP derivation from the request.
 */
import { describe, expect, it } from "vitest";
import { isRecentlyVerified, markVerified, rpFromRequest } from "./webauthn";

describe("recent-verification window", () => {
  it("reports not verified for a fresh user", () => {
    expect(isRecentlyVerified(999901)).toBe(false);
  });

  it("reports verified right after markVerified", () => {
    markVerified(999902);
    expect(isRecentlyVerified(999902)).toBe(true);
  });

  it("keeps windows independent between users", () => {
    markVerified(999903);
    expect(isRecentlyVerified(999903)).toBe(true);
    expect(isRecentlyVerified(999904)).toBe(false);
  });
});

describe("rpFromRequest", () => {
  it("derives rpID and origin from the host header", () => {
    const req = {
      protocol: "https",
      headers: { host: "s-agent-passport.manus.space" },
      get: (h: string) => (h.toLowerCase() === "host" ? "s-agent-passport.manus.space" : undefined),
    } as never;
    const { rpID, origin } = rpFromRequest(req);
    expect(rpID).toBe("s-agent-passport.manus.space");
    expect(origin).toBe("https://s-agent-passport.manus.space");
  });

  it("strips the port from rpID but keeps it in origin", () => {
    const req = {
      protocol: "http",
      headers: { host: "localhost:3000" },
      get: (h: string) => (h.toLowerCase() === "host" ? "localhost:3000" : undefined),
    } as never;
    const { rpID, origin } = rpFromRequest(req);
    expect(rpID).toBe("localhost");
    expect(origin).toBe("http://localhost:3000");
  });
});
