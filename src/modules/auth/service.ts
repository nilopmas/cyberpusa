import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { AppError } from '../../core/http/errors';
import { users, sessions } from '../../infra/db/schema/index';
import type { AuthUser, SessionInfo, UserRole } from './schema';

type Db = ReturnType<typeof drizzle>;

// TODO: production hardening — move to Argon2id via WASM or external service.
// PBKDF2 with SHA-256 is Workers-compatible via Web Crypto API.
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt);
  const hash = await crypto.subtle.exportKey('raw', key);
  const saltHex = bufToHex(salt);
  const hashHex = bufToHex(new Uint8Array(hash));
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuf(parts[2]);
  const expectedHash = parts[3];
  const key = await deriveKey(password, salt, iterations);
  const hash = await crypto.subtle.exportKey('raw', key);
  return bufToHex(new Uint8Array(hash)) === expectedHash;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_BYTES * 8 },
    true,
    ['encrypt']
  );
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Session duration: 24 hours.
// TODO: production hardening — make configurable, add refresh token flow.
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  private db: Db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async createUser(email: string, password: string, role: UserRole = 'viewer'): Promise<AuthUser> {
    const existing = await this.db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      throw new AppError('Email already registered', { status: 409, code: 'EMAIL_EXISTS' });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    await this.db.insert(users).values({ id, email, passwordHash, role, createdAt: now, updatedAt: now });
    return { id, email, role };
  }

  async login(email: string, password: string): Promise<SessionInfo> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    if (!user) {
      // TODO: production hardening — constant-time comparison to prevent timing attacks.
      throw new AppError('Invalid credentials', { status: 401, code: 'INVALID_CREDENTIALS' });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid credentials', { status: 401, code: 'INVALID_CREDENTIALS' });
    }
    return this.createSession(user.id, user.email, user.role as UserRole);
  }

  async validateSession(token: string): Promise<AuthUser> {
    const [session] = await this.db.select().from(sessions).where(eq(sessions.token, token));
    if (!session) {
      throw new AppError('Invalid or expired session', { status: 401, code: 'INVALID_SESSION' });
    }
    if (new Date(session.expiresAt) < new Date()) {
      // Clean up expired session.
      await this.db.delete(sessions).where(eq(sessions.id, session.id));
      throw new AppError('Session expired', { status: 401, code: 'SESSION_EXPIRED' });
    }
    const [user] = await this.db.select().from(users).where(eq(users.id, session.userId));
    if (!user) {
      throw new AppError('User not found', { status: 401, code: 'INVALID_SESSION' });
    }
    return { id: user.id, email: user.email, role: user.role as UserRole };
  }

  private async createSession(userId: string, email: string, role: UserRole): Promise<SessionInfo> {
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    const now = new Date().toISOString();
    await this.db.insert(sessions).values({ id, userId, token, expiresAt, createdAt: now });
    return { token, expiresAt, user: { id: userId, email, role } };
  }
}
