import { createHash, createPublicKey, verify } from 'node:crypto';
import type { NextFunction, Request, Response, RequestHandler } from 'express';

export type PassportGrant = 'premium_context' | 'course_generate' | 'mcp_connect' | string;
export interface PassportRecord { passportId: string; publicKeyPem: string; grants: PassportGrant[]; revoked?: boolean; }
export interface PassportResolver { get(passportId: string): Promise<PassportRecord | null>; }
export interface PassportPrincipal { passportId: string; grants: PassportGrant[]; }

declare global { namespace Express { interface Request { passportPrincipal?: PassportPrincipal; } } }

export function derivePassportId(publicKeyPem: string): string {
  const normalized = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return `sp_${createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`;
}

export function canonicalPayload(method: string, path: string, timestamp: string, body: unknown): Buffer {
  const serializedBody = body == null ? '' : JSON.stringify(body);
  return Buffer.from(`${method.toUpperCase()}\n${path}\n${timestamp}\n${serializedBody}`, 'utf8');
}

export function passportSignatureMiddleware(resolver: PassportResolver, requiredGrant?: PassportGrant, maxClockSkewMs = 300000): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const passportId = req.header('x-passport-id');
      const signatureB64 = req.header('x-passport-signature');
      const timestamp = req.header('x-passport-timestamp');
      if (!passportId || !signatureB64 || !timestamp) return void res.status(401).json({ error: 'passport_signature_required' });
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxClockSkewMs) return void res.status(401).json({ error: 'passport_timestamp_invalid' });
      const record = await resolver.get(passportId);
      if (!record || record.revoked || derivePassportId(record.publicKeyPem) !== passportId) return void res.status(403).json({ error: 'passport_not_verified' });
      const valid = verify('sha256', canonicalPayload(req.method, req.originalUrl.split('?')[0], timestamp, req.body), createPublicKey(record.publicKeyPem), Buffer.from(signatureB64, 'base64'));
      if (!valid) return void res.status(403).json({ error: 'passport_signature_invalid' });
      if (requiredGrant && !record.grants.includes(requiredGrant)) return void res.status(403).json({ error: 'grant_required', grant: requiredGrant });
      req.passportPrincipal = { passportId, grants: record.grants };
      next();
    } catch {
      res.status(403).json({ error: 'passport_verification_failed' });
    }
  };
}
