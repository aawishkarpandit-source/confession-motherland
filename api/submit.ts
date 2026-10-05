// Vercel Serverless Function: POST /api/submit
// Encrypts the confession with AES-256-GCM (server-side only)
// and stores ONLY ciphertext in Supabase. No IP, no name, no metadata.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createCipheriv } from 'node:crypto';

const MAX_LEN = 5000;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  // Accept base64 (44 chars for 32 bytes) or hex (64 chars) or raw utf8
  try {
    const b64 = Buffer.from(secret, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  const hex = Buffer.from(secret, 'hex');
  if (hex.length === 32) return hex;
  const raw = Buffer.from(secret, 'utf8');
  if (raw.length === 32) return raw;
  throw new Error('ENCRYPTION_SECRET must decode to 32 bytes (base64 of 32 random bytes)');
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cipher = createCipheriv('aes-256-gcm', key as unknown as any, iv as unknown as any);
  const ciphertext = Buffer.concat([
    Buffer.from(cipher.update(plaintext, 'utf8')),
    Buffer.from(cipher.final())
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS — allow only POST from anywhere (public drop box).
  // Lock down further with `Access-Control-Allow-Origin: https://confession-motherland.vercel.app` if desired.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (text.length < 2) {
      res.status(400).json({ ok: false, error: 'Confession is too short.' });
      return;
    }
    if (text.length > MAX_LEN) {
      res.status(400).json({ ok: false, error: `Confession must be under ${MAX_LEN} characters.` });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase env vars are not set');
    }

    const encrypted = encrypt(text, getKey());
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.from('confessions').insert({ encrypted_data: encrypted });
    if (error) throw error;

    // Deliberately return nothing identifiable
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('submit error', err);
    // TEMPORARY debug: surface the real message so the owner can diagnose.
    // Revert to a generic message once fixed.
    const detail = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ ok: false, error: `DEBUG: ${detail}` });
  }
}
