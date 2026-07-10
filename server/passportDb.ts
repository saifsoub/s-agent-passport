/*
 * Query helpers for the S/ Agent Passport product tables.
 */
import { and, desc, eq } from "drizzle-orm";
import {
  passportRequests,
  passports,
  vaultSecrets,
  type InsertPassportRequest,
  type InsertPassportRow,
} from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/* ===== Vault ===== */
export async function listVaultSecrets(userId: number) {
  const db = await requireDb();
  return db.select().from(vaultSecrets).where(eq(vaultSecrets.userId, userId)).orderBy(desc(vaultSecrets.createdAt));
}

export async function addVaultSecret(userId: number, keyName: string, valueEncrypted: string) {
  const db = await requireDb();
  await db.insert(vaultSecrets).values({ userId, keyName, valueEncrypted });
}

export async function deleteVaultSecret(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(vaultSecrets).where(and(eq(vaultSecrets.id, id), eq(vaultSecrets.userId, userId)));
}

export async function getVaultSecretsByNames(userId: number, names: string[]) {
  const db = await requireDb();
  const all = await db.select().from(vaultSecrets).where(eq(vaultSecrets.userId, userId));
  return all.filter((s) => names.includes(s.keyName));
}

/* ===== Requests ===== */
export async function createRequest(values: InsertPassportRequest) {
  const db = await requireDb();
  const res = await db.insert(passportRequests).values(values);
  return res;
}

export async function listMyRequests(userId: number) {
  const db = await requireDb();
  return db.select().from(passportRequests).where(eq(passportRequests.userId, userId)).orderBy(desc(passportRequests.createdAt));
}

export async function listAllRequests() {
  const db = await requireDb();
  return db.select().from(passportRequests).orderBy(desc(passportRequests.createdAt));
}

export async function getRequestById(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(passportRequests).where(eq(passportRequests.id, id)).limit(1);
  return rows[0];
}

export async function decideRequest(
  id: number,
  status: "approved" | "denied",
  decidedBy: string,
  denialReason?: string,
) {
  const db = await requireDb();
  await db
    .update(passportRequests)
    .set({ status, decidedBy, decidedAt: new Date(), denialReason: denialReason ?? null })
    .where(eq(passportRequests.id, id));
}

/* ===== Passports ===== */
export async function insertPassport(values: InsertPassportRow) {
  const db = await requireDb();
  await db.insert(passports).values(values);
}

export async function listMyPassports(userId: number) {
  const db = await requireDb();
  return db.select().from(passports).where(eq(passports.userId, userId)).orderBy(desc(passports.issuedAt));
}

export async function listAllPassports() {
  const db = await requireDb();
  return db.select().from(passports).orderBy(desc(passports.issuedAt));
}

export async function getPassportByRequestId(requestId: number) {
  const db = await requireDb();
  const rows = await db.select().from(passports).where(eq(passports.requestId, requestId)).limit(1);
  return rows[0];
}

export async function getPassportById(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(passports).where(eq(passports.id, id)).limit(1);
  return rows[0];
}

export async function revokePassport(id: number, reason: string) {
  const db = await requireDb();
  await db.update(passports).set({ status: "revoked", revokedAt: new Date(), revokeReason: reason }).where(eq(passports.id, id));
}
