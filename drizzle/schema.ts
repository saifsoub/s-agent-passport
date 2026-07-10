import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Opt-in biometric vault lock: when 1, sensitive actions require a recent passkey verification. */
  vaultLockEnabled: int("vaultLockEnabled").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Private vault: per-owner secret keys, encrypted at rest (AES-256-GCM).
 * Values never leave the server unmasked except at passport-bundle download time.
 */
export const vaultSecrets = mysqlTable("vault_secrets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  keyName: varchar("keyName", { length: 128 }).notNull(),
  /** AES-256-GCM ciphertext: iv.tag.data (base64, dot-separated) */
  valueEncrypted: text("valueEncrypted").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VaultSecret = typeof vaultSecrets.$inferSelect;
export type InsertVaultSecret = typeof vaultSecrets.$inferInsert;

/**
 * Passport applications submitted from the portal.
 * They sit pending until an admin stamps APPROVED or DENIED at the approval desk.
 */
export const passportRequests = mysqlTable("passport_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentName: varchar("agentName", { length: 128 }).notNull(),
  agentType: varchar("agentType", { length: 64 }).notNull(),
  /** Selected tool ids (string[]) */
  toolIds: json("toolIds").$type<string[]>().notNull(),
  /** Vault key names granted to this agent (string[]) */
  secretKeys: json("secretKeys").$type<string[]>().notNull(),
  ttlHours: int("ttlHours"),
  purpose: text("purpose"),
  status: mysqlEnum("status", ["pending", "approved", "denied"]).default("pending").notNull(),
  decidedBy: varchar("decidedBy", { length: 128 }),
  decidedAt: timestamp("decidedAt"),
  denialReason: text("denialReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PassportRequest = typeof passportRequests.$inferSelect;
export type InsertPassportRequest = typeof passportRequests.$inferInsert;

/**
 * Minted passports — created only when an admin approves a request.
 * payload holds the full canonical passport document (same shape as the Python package).
 */
export const passports = mysqlTable("passports", {
  id: int("id").autoincrement().primaryKey(),
  /** S-PASS-{12 hex} public identifier */
  passportId: varchar("passportId", { length: 32 }).notNull().unique(),
  requestId: int("requestId").notNull(),
  userId: int("userId").notNull(),
  agentName: varchar("agentName", { length: 128 }).notNull(),
  agentType: varchar("agentType", { length: 64 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  checksum: varchar("checksum", { length: 32 }).notNull(),
  signature: text("signature"),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  revokeReason: text("revokeReason"),
});

export type PassportRow = typeof passports.$inferSelect;
export type InsertPassportRow = typeof passports.$inferInsert;

/**
 * WebAuthn passkeys (Face ID / fingerprint / security key) enrolled by owners.
 * Used as an optional second factor ("vault lock") gating sensitive actions:
 * vault value export (.env), embed bundle download, and owner dossier.
 */
export const passkeys = mysqlTable("passkeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Base64URL credential ID from the authenticator. */
  credentialId: varchar("credentialId", { length: 255 }).notNull().unique(),
  /** Base64URL-encoded COSE public key. */
  publicKey: text("publicKey").notNull(),
  counter: int("counter").notNull().default(0),
  /** Comma-separated authenticator transports (internal, hybrid, usb, ble, nfc). */
  transports: varchar("transports", { length: 255 }),
  /** singleDevice | multiDevice */
  deviceType: varchar("deviceType", { length: 32 }),
  backedUp: int("backedUp").notNull().default(0),
  /** Friendly label, e.g. "MacBook Touch ID". */
  label: varchar("label", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

export type Passkey = typeof passkeys.$inferSelect;
export type InsertPasskey = typeof passkeys.$inferInsert;