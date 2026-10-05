// Vercel Serverless Function: GET /api/health
// Diagnostic only — reports WHETHER required env vars are set (never their values)
// plus a live Supabase connectivity check.
// Visit https://confession-motherland.vercel.app/api/health to see what's missing.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const secret = process.env.ENCRYPTION_SECRET;
  let secretBytes: number | null = null;
  if (secret) {
    const b64 = Buffer.from(secret, 'base64');
    secretBytes = b64.length; // must be 32
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Live DB check: can we reach Supabase and see the confessions table?
  let dbOk = false;
  let dbError: string | null = 'skipped (env missing)';
  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { error } = await supabase.from('confessions').select('id', { count: 'exact', head: true });
      if (error) {
        dbError = error.message;
      } else {
        dbOk = true;
        dbError = null;
      }
    } catch (err) {
      dbError = err instanceof Error ? err.message : 'unknown error';
    }
  }

  const checks = {
    SUPABASE_URL: Boolean(supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
    ENCRYPTION_SECRET: Boolean(secret),
    ENCRYPTION_SECRET_BYTES: secretBytes,
    DB_REACHABLE: dbOk,
    DB_ERROR: dbError
  };

  const ok = checks.SUPABASE_URL && checks.SUPABASE_SERVICE_ROLE_KEY && secretBytes === 32 && dbOk;
  res.status(200).json({ ok, checks });
}
