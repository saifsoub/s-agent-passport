/**
 * WebAuthn (passkey) support for the S/ Agent Passport portal.
 *
 * Owners may enroll Face ID / fingerprint / security-key passkeys and enable
 * the "vault lock": once enabled, sensitive actions (vault .env export,
 * embed bundle, owner dossier export) require a passkey verification within
 * the last VERIFY_WINDOW_MS.
 *
 * Challenges and recent verifications are kept in in-process maps — fine for
 * a single-instance deployment; they are short-lived and safe to lose on
 * restart (the user simply re-verifies).
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { passkeys, users, type Passkey } from "../drizzle/schema";
import { getDb } from "./db";

const RP_NAME = "S/ Agent Passport";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** How long a passkey verification unlocks sensitive actions. */
export const VERIFY_WINDOW_MS = 5 * 60 * 1000;

type ChallengeEntry = { challenge: string; expires: number };
const regChallenges = new Map<number, ChallengeEntry>();
const authChallenges = new Map<number, ChallengeEntry>();
const recentVerifications = new Map<number, number>(); // userId → verifiedAt ms

function putChallenge(map: Map<number, ChallengeEntry>, userId: number, challenge: string) {
  map.set(userId, { challenge, expires: Date.now() + CHALLENGE_TTL_MS });
}

function takeChallenge(map: Map<number, ChallengeEntry>, userId: number): string | null {
  const entry = map.get(userId);
  map.delete(userId);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.challenge;
}

/** Derive RP ID (domain, no port/scheme) and expected origin from the request. */
export function rpFromRequest(req: { protocol?: string; headers: Record<string, unknown> }): {
  rpID: string;
  origin: string;
} {
  const host =
    (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const rpID = host.split(":")[0];
  return { rpID, origin: `${proto}://${host}` };
}

/* ============ registration ============ */

export async function startRegistration(
  user: { id: number; name: string | null; email: string | null },
  rpID: string,
) {
  const db = await getDb();
  const existing: Passkey[] = db
    ? await db.select().from(passkeys).where(eq(passkeys.userId, user.id))
    : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email || user.name || `owner-${user.id}`,
    userDisplayName: user.name || "Owner",
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: (p.transports?.split(",") ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
  putChallenge(regChallenges, user.id, options.challenge);
  return options;
}

export async function finishRegistration(
  userId: number,
  response: RegistrationResponseJSON,
  rpID: string,
  origin: string,
  label: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  const expectedChallenge = takeChallenge(regChallenges, userId);
  if (!expectedChallenge) return { ok: false, reason: "Challenge expired — try again." };

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, reason: "Registration could not be verified." };
  }

  const info = verification.registrationInfo;
  const db = await getDb();
  if (!db) return { ok: false, reason: "Database unavailable." };

  await db.insert(passkeys).values({
    userId,
    credentialId: info.credential.id,
    publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
    counter: info.credential.counter,
    transports: (info.credential.transports ?? []).join(",") || null,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp ? 1 : 0,
    label,
  });
  // Enrolling counts as a fresh verification.
  recentVerifications.set(userId, Date.now());
  return { ok: true };
}

/* ============ authentication (unlock) ============ */

export async function startAuthentication(userId: number, rpID: string) {
  const db = await getDb();
  const creds: Passkey[] = db
    ? await db.select().from(passkeys).where(eq(passkeys.userId, userId))
    : [];
  if (creds.length === 0) return null;

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((p) => ({
      id: p.credentialId,
      transports: (p.transports?.split(",") ?? []) as AuthenticatorTransportFuture[],
    })),
  });
  putChallenge(authChallenges, userId, options.challenge);
  return options;
}

export async function finishAuthentication(
  userId: number,
  response: AuthenticationResponseJSON,
  rpID: string,
  origin: string,
): Promise<{ ok: boolean; reason?: string }> {
  const expectedChallenge = takeChallenge(authChallenges, userId);
  if (!expectedChallenge) return { ok: false, reason: "Challenge expired — try again." };

  const db = await getDb();
  if (!db) return { ok: false, reason: "Database unavailable." };

  const rows = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, response.id))
    .limit(1);
  const cred = rows[0];
  if (!cred || cred.userId !== userId) {
    return { ok: false, reason: "Unknown credential." };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: cred.credentialId,
      publicKey: Buffer.from(cred.publicKey, "base64url"),
      counter: cred.counter,
      transports: (cred.transports?.split(",") ?? []) as AuthenticatorTransportFuture[],
    },
  });
  if (!verification.verified) return { ok: false, reason: "Verification failed." };

  await db
    .update(passkeys)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(eq(passkeys.id, cred.id));
  recentVerifications.set(userId, Date.now());
  return { ok: true };
}

/* ============ vault-lock gate ============ */

export function markVerified(userId: number) {
  recentVerifications.set(userId, Date.now());
}

export function isRecentlyVerified(userId: number): boolean {
  const at = recentVerifications.get(userId);
  return !!at && Date.now() - at < VERIFY_WINDOW_MS;
}

/**
 * Throws-free gate check used by sensitive procedures.
 * Returns null when access is allowed, otherwise a human-readable reason.
 */
export async function vaultLockBlockReason(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null; // fail open only if DB is down (auth already required)
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0];
  if (!u || !u.vaultLockEnabled) return null;
  if (isRecentlyVerified(userId)) return null;
  return "Vault lock is on — verify with your passkey (Face ID / fingerprint) first.";
}

/* ============ management ============ */

export async function listPasskeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(passkeys).where(eq(passkeys.userId, userId));
  return rows.map((p) => ({
    id: p.id,
    label: p.label,
    deviceType: p.deviceType,
    backedUp: !!p.backedUp,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
  }));
}

export async function removePasskey(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(passkeys).where(eq(passkeys.id, id)).limit(1);
  if (!rows[0] || rows[0].userId !== userId) return false;
  await db.delete(passkeys).where(eq(passkeys.id, id));

  // If that was the last passkey, disable the vault lock so the owner is not locked out.
  const remaining = await db.select().from(passkeys).where(eq(passkeys.userId, userId));
  if (remaining.length === 0) {
    await db.update(users).set({ vaultLockEnabled: 0 }).where(eq(users.id, userId));
  }
  return true;
}

export async function setVaultLock(userId: number, enabled: boolean): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "Database unavailable." };
  if (enabled) {
    const creds = await db.select().from(passkeys).where(eq(passkeys.userId, userId));
    if (creds.length === 0) {
      return { ok: false, reason: "Enroll a passkey first — otherwise you would lock yourself out." };
    }
  }
  await db.update(users).set({ vaultLockEnabled: enabled ? 1 : 0 }).where(eq(users.id, userId));
  return { ok: true };
}
