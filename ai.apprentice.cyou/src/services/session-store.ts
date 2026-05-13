import { config } from "../config.js";
import { q } from "../db.js";

const revoked = new Map<string, number>();

const nowSec = () => Math.floor(Date.now() / 1000);

const sweep = () => {
  const now = nowSec();
  for (const [jti, exp] of revoked.entries()) {
    if (exp <= now) revoked.delete(jti);
  }
};

const persistRevocation = async (jti: string, expUnix: number) => {
  if (!config.revokeTokensInDb || !config.databaseUrl) return;
  try {
    await q(
      `insert into public.revoked_tokens (jti, exp)
       values ($1, to_timestamp($2::double precision))
       on conflict (jti) do update set exp = greatest(public.revoked_tokens.exp, excluded.exp)`,
      [jti, expUnix]
    );
  } catch {
    /* tabel belum ada / DB down — fallback hanya memori */
  }
};

export const revokeToken = async (jti: string, exp: number) => {
  if (!jti || !Number.isFinite(exp)) return;
  sweep();
  revoked.set(jti, exp);
  await persistRevocation(jti, exp);
};

export const isTokenRevoked = async (jti: string) => {
  if (!jti) return false;
  sweep();
  const memExp = revoked.get(jti);
  if (memExp != null) {
    if (memExp > nowSec()) return true;
    revoked.delete(jti);
  }
  if (!config.revokeTokensInDb || !config.databaseUrl) return false;
  try {
    const rows = await q<{ one: number }>(
      `select 1 as one from public.revoked_tokens where jti = $1 and exp > now() limit 1`,
      [jti]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
};
