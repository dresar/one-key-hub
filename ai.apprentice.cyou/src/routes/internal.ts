import { Hono } from "hono";
import { q } from "../db.js";
import { config } from "../config.js";
import { deleteFromCloud } from "../services/playground.js";

/** Cron: hapus upload playground kedaluwarsa (Vercel Cron). */
export const internalRoutes = new Hono();

internalRoutes.post("/internal/upload-expiry", async (c) => {
  const secret = c.req.header("x-cron-secret") || "";
  const expected = config.cronSecret || "";
  if (!expected || secret !== expected) return c.json({ error: "Unauthorized" }, 401);
  const rows = await q<{
    id: string;
    tenant_id: string;
    credential_id: string;
    provider: string;
    external_id: string;
  }>(
    `select id, tenant_id, credential_id, provider, external_id from public.upload_expiry
      where delete_at <= now() limit 50`
  );
  for (const row of rows) {
    try {
      await deleteFromCloud({
        credentialId: row.credential_id,
        userId: row.tenant_id,
        provider: row.provider,
        externalId: row.external_id,
      });
    } catch {
      /* */
    }
    await q("delete from public.upload_expiry where id = $1", [row.id]);
  }
  return c.json({ processed: rows.length });
});
