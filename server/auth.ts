/**
 * Authentication + user store (dependency-free, Node crypto).
 *
 * - Passwords hashed with scrypt + per-user salt.
 * - Sessions are stateless HMAC-signed tokens (JWT-like) with a 7-day expiry.
 * - Users persist to <DATA_DIR>/users.json; the signing secret to
 *   <DATA_DIR>/auth-secret (or set AUTH_SECRET to pin it across machines).
 * - A default admin is seeded on first boot. Override via env:
 *     DEFAULT_ADMIN_USERNAME (default "admin")
 *     DEFAULT_ADMIN_PASSWORD (default "flextron-admin")
 */

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
  salt: string;
  hash: string;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  createdAt: number;
}

const DATA_DIR = process.env.FLEET_DATA_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const SECRET_FILE = join(DATA_DIR, 'auth-secret');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const users = new Map<string, User>();
let secret = '';

// ── helpers ──────────────────────────────────────────────
function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

export function toPublic(u: User): PublicUser {
  return { id: u.id, username: u.username, role: u.role, createdAt: u.createdAt };
}

function persist() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USERS_FILE, JSON.stringify([...users.values()], null, 2), 'utf8');
}

function loadSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, 'utf8').trim();
  } catch { /* ignore */ }
  const s = randomBytes(48).toString('hex');
  try { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(SECRET_FILE, s, 'utf8'); } catch { /* ignore */ }
  return s;
}

// ── init ─────────────────────────────────────────────────
let started = false;
export function initAuth() {
  if (started) return;
  started = true;
  secret = loadSecret();

  try {
    if (existsSync(USERS_FILE)) {
      const arr = JSON.parse(readFileSync(USERS_FILE, 'utf8')) as User[];
      for (const u of arr) users.set(u.id, u);
    }
  } catch (e) {
    console.warn('[auth] failed to load users:', (e as Error).message);
  }

  // Seed default admin if none exists.
  if (![...users.values()].some(u => u.role === 'admin')) {
    const username = process.env.DEFAULT_ADMIN_USERNAME ?? 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD ?? 'flextron-admin';
    createUser(username, password, 'admin');
    console.log(`[auth] seeded default admin → username: "${username}" password: "${password}"`);
    console.log('[auth] change this password after first login.');
  }
}

// ── user CRUD ────────────────────────────────────────────
export function listUsers(): PublicUser[] {
  return [...users.values()].sort((a, b) => a.createdAt - b.createdAt).map(toPublic);
}

export function findByUsername(username: string): User | undefined {
  return [...users.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function createUser(username: string, password: string, role: Role): PublicUser {
  username = username.trim();
  if (!username || !password) throw new Error('username and password are required');
  if (password.length < 6) throw new Error('password must be at least 6 characters');
  if (findByUsername(username)) throw new Error('username already exists');
  const salt = randomBytes(16).toString('hex');
  const user: User = {
    id: randomBytes(8).toString('hex'),
    username,
    role,
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
  };
  users.set(user.id, user);
  persist();
  return toPublic(user);
}

export function deleteUser(id: string): void {
  const u = users.get(id);
  if (!u) throw new Error('user not found');
  const admins = [...users.values()].filter(x => x.role === 'admin');
  if (u.role === 'admin' && admins.length <= 1) throw new Error('cannot delete the last admin');
  users.delete(id);
  persist();
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

// ── login + tokens ───────────────────────────────────────
export function verifyCredentials(username: string, password: string): User | null {
  const u = findByUsername(username);
  if (!u) return null;
  const candidate = Buffer.from(hashPassword(password, u.salt), 'hex');
  const expected = Buffer.from(u.hash, 'hex');
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return null;
  return u;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

export function signToken(user: User): string {
  const payload = b64url(JSON.stringify({ uid: user.id, role: user.role, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): User | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { uid: string; exp: number };
    if (Date.now() > data.exp) return null;
    return users.get(data.uid) ?? null;
  } catch {
    return null;
  }
}
