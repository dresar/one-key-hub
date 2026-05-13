import { pool, q } from "../db.js";

export async function listModels(provider: string) {
  return q(
    `select id, provider, model_id, display_name, is_default, supports_vision, sort_order from public.ai_models
      where provider = $1 order by sort_order, model_id`,
    [provider]
  );
}

export async function createModel(body: {
  provider: string;
  model_id: string;
  display_name?: string | null;
  is_default?: boolean;
  supports_vision?: boolean;
  sort_order?: number;
}) {
  const prov = (body.provider || "").toLowerCase();
  if (prov !== "gemini" && prov !== "groq") throw new Error("provider harus 'gemini' atau 'groq'");
  const mid = String(body.model_id || "").trim();
  if (!mid) throw new Error("model_id wajib diisi");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (body.is_default) {
      await client.query("update public.ai_models set is_default = false where provider = $1", [prov]);
    }
    const r = await client.query(
      `insert into public.ai_models (provider, model_id, display_name, is_default, supports_vision, sort_order)
       values ($1, $2, $3, $4, $5, $6)
       returning id, provider, model_id, display_name, is_default, supports_vision, sort_order`,
      [
        prov,
        mid,
        body.display_name ?? null,
        Boolean(body.is_default),
        Boolean(body.supports_vision),
        Number(body.sort_order) || 0,
      ]
    );
    await client.query("COMMIT");
    const row = r.rows[0];
    return row ? { ...row, id: String(row.id) } : {};
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteModelById(mid: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query("select provider, is_default from public.ai_models where id = $1 limit 1", [mid]);
    if (!cur.rows[0]) {
      await client.query("ROLLBACK");
      return { deleted: false };
    }
    const prov = cur.rows[0].provider as string;
    const wasDef = cur.rows[0].is_default as boolean;
    await client.query("delete from public.ai_models where id = $1", [mid]);
    if (wasDef) {
      const other = await client.query(
        "select id from public.ai_models where provider = $1 order by sort_order, model_id limit 1",
        [prov]
      );
      if (other.rows[0]) {
        await client.query("update public.ai_models set is_default = true where id = $1", [other.rows[0].id]);
      }
    }
    await client.query("COMMIT");
    return { deleted: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateModel(
  mid: string,
  kw: { display_name?: string | null; supports_vision?: boolean | null; is_default?: boolean | null }
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ex = await client.query("select provider from public.ai_models where id = $1 limit 1", [mid]);
    if (!ex.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const prov = ex.rows[0].provider as string;
    if (kw.is_default === true) {
      await client.query("update public.ai_models set is_default = false where provider = $1", [prov]);
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if ("display_name" in kw && kw.display_name !== undefined) {
      sets.push(`display_name = $${i++}`);
      vals.push(kw.display_name);
    }
    if ("supports_vision" in kw && kw.supports_vision !== undefined) {
      sets.push(`supports_vision = $${i++}`);
      vals.push(kw.supports_vision);
    }
    if ("is_default" in kw && kw.is_default !== undefined) {
      sets.push(`is_default = $${i++}`);
      vals.push(kw.is_default);
    }
    if (sets.length) {
      vals.push(mid);
      await client.query(`update public.ai_models set ${sets.join(", ")} where id = $${i}`, vals);
    }
    const r = await client.query("select * from public.ai_models where id = $1", [mid]);
    await client.query("COMMIT");
    return r.rows[0] ?? null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
