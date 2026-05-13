import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { dashboardRateLimit } from "../middleware/dashboard-rate-limit.js";
import type { AppEnv } from "../types.js";
import * as apify from "../services/apify.js";
import { findLatestActiveCredential } from "../gateway/credentials.js";
import { logGatewayRequest } from "../services/observability.js";

export const apifyTestRoutes = new Hono<AppEnv>();

apifyTestRoutes.use("/api/apify/*", requireAuth, dashboardRateLimit);

apifyTestRoutes.post("/api/apify/test/verify", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const apiKeyId = String(body.api_key_id ?? body.apiKeyId ?? "");
  if (!apiKeyId) return c.json({ error: "api_key_id wajib" }, 400);
  const apiKey = await apify.getOwnedGatewayKeyForProvider(user.id, apiKeyId, "apify");
  if (!apiKey) return c.json({ error: "Gateway API key Apify tidak ditemukan atau tidak diizinkan." }, 404);
  const credential = await findLatestActiveCredential(user.id, "apify");
  const token = apify.getApifyTokenFromCredential(credential);
  await logGatewayRequest({
    tenantId: user.id,
    apiKeyId: String(apiKey.id),
    provider: "apify",
    method: "GET",
    statusCode: credential && token ? 200 : 404,
    responseTimeMs: 1,
    originDomain: "dashboard-internal",
    requestPath: "/verify",
    errorMessage: credential && token ? undefined : "Credential Apify aktif tidak ditemukan",
    credentialId: credential ? String(credential.id) : null,
    clientAuthUsed: Boolean(apiKey.client_username),
    upstreamStatus: credential && token ? 200 : 404,
    metadata: { helper_test: true, verify_only: true },
  });
  if (!credential || !token) {
    return c.json({ error: "Credential Apify aktif tidak ditemukan atau api_token kosong." }, 404);
  }
  return c.json({
    ok: true,
    provider: "apify",
    apiKey: { id: apiKey.id, name: apiKey.name || "Unnamed" },
    credential: { id: credential.id },
    defaults: {
      listActorsPath: "/acts?limit=10",
      listTasksPath: "/actor-tasks?limit=10",
      runActorPath: "/acts/:actorId/runs?waitForFinish=30",
      runTaskPath: "/actor-tasks/:taskId/runs?waitForFinish=30",
    },
  });
});

apifyTestRoutes.get("/api/apify/test/actors", async (c) => {
  const user = c.get("user");
  const apiKeyId = c.req.query("apiKeyId");
  const limit = Number(c.req.query("limit") || 10);
  const offset = Number(c.req.query("offset") || 0);
  if (!apiKeyId) return c.json({ error: "apiKeyId wajib" }, 400);
  const apiKey = await apify.getOwnedGatewayKeyForProvider(user.id, apiKeyId, "apify");
  if (!apiKey) return c.json({ error: "Gateway API key Apify tidak ditemukan atau tidak diizinkan." }, 404);
  const result = await apify.callApifyHelper({
    tenantId: user.id,
    apiKey,
    path: "/acts",
    query: { limit, offset },
    requestPath: "/acts",
  });
  if (!result.ok) return c.json(result, result.status as 400);
  return c.json(apify.normalizeApifyCollection(result.payload));
});

apifyTestRoutes.get("/api/apify/test/tasks", async (c) => {
  const user = c.get("user");
  const apiKeyId = c.req.query("apiKeyId");
  const limit = Number(c.req.query("limit") || 10);
  const offset = Number(c.req.query("offset") || 0);
  if (!apiKeyId) return c.json({ error: "apiKeyId wajib" }, 400);
  const apiKey = await apify.getOwnedGatewayKeyForProvider(user.id, apiKeyId, "apify");
  if (!apiKey) return c.json({ error: "Gateway API key Apify tidak ditemukan atau tidak diizinkan." }, 404);
  const result = await apify.callApifyHelper({
    tenantId: user.id,
    apiKey,
    path: "/actor-tasks",
    query: { limit, offset },
    requestPath: "/actor-tasks",
  });
  if (!result.ok) return c.json(result, result.status as 400);
  return c.json(apify.normalizeApifyCollection(result.payload));
});

apifyTestRoutes.post("/api/apify/test/run", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const apiKeyId = String(body.api_key_id ?? body.apiKeyId ?? "");
  const mode = body.mode === "task" ? "task" : "actor";
  const targetId = String(body.target_id ?? body.targetId ?? "").trim();
  const wait = Number(body.wait_for_finish ?? body.waitForFinish ?? 30) || 30;
  const inp = body.input && typeof body.input === "object" ? body.input : {};
  if (!apiKeyId) return c.json({ error: "api_key_id wajib" }, 400);
  if (!targetId) return c.json({ error: "target_id wajib" }, 400);
  const apiKey = await apify.getOwnedGatewayKeyForProvider(user.id, apiKeyId, "apify");
  if (!apiKey) return c.json({ error: "Gateway API key Apify tidak ditemukan atau tidak diizinkan." }, 404);
  const path =
    mode === "task"
      ? `/actor-tasks/${encodeURIComponent(targetId)}/runs`
      : `/acts/${encodeURIComponent(targetId)}/runs`;
  const w = Number.isFinite(wait) && wait > 0 ? wait : 30;
  const result = await apify.callApifyHelper({
    tenantId: user.id,
    apiKey,
    path,
    method: "POST",
    query: { waitForFinish: w },
    body: inp,
    requestPath: path,
  });
  if (!result.ok) return c.json(result, result.status as 400);
  return c.json(apify.normalizeApifyRun(result.payload));
});

apifyTestRoutes.get("/api/apify/test/runs/:runId", async (c) => {
  const user = c.get("user");
  const runId = c.req.param("runId");
  const apiKeyId = c.req.query("apiKeyId");
  if (!apiKeyId) return c.json({ error: "apiKeyId wajib" }, 400);
  const apiKey = await apify.getOwnedGatewayKeyForProvider(user.id, apiKeyId, "apify");
  if (!apiKey) return c.json({ error: "Gateway API key Apify tidak ditemukan atau tidak diizinkan." }, 404);
  const result = await apify.callApifyHelper({
    tenantId: user.id,
    apiKey,
    path: `/actor-runs/${encodeURIComponent(runId)}`,
    requestPath: `/actor-runs/${runId}`,
  });
  if (!result.ok) return c.json(result, result.status as 400);
  return c.json(apify.normalizeApifyRun(result.payload));
});

apifyTestRoutes.get("/api/apify/test/datasets/:datasetId/items", async (c) => {
  const user = c.get("user");
  const datasetId = c.req.param("datasetId");
  const apiKeyId = c.req.query("apiKeyId");
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");
  const clean = c.req.query("clean");
  if (!apiKeyId) return c.json({ error: "apiKeyId wajib" }, 400);
  const apiKey = await apify.getOwnedGatewayKeyForProvider(user.id, apiKeyId, "apify");
  if (!apiKey) return c.json({ error: "Gateway API key Apify tidak ditemukan atau tidak diizinkan." }, 404);
  const result = await apify.callApifyHelper({
    tenantId: user.id,
    apiKey,
    path: `/datasets/${encodeURIComponent(datasetId)}/items`,
    query: {
      limit: limit != null ? Number(limit) : 10,
      offset: offset != null ? Number(offset) : 0,
      clean: clean != null ? Number(clean) : 1,
    },
    requestPath: `/datasets/${datasetId}/items`,
  });
  if (!result.ok) return c.json(result, result.status as 400);
  return c.json(apify.normalizeApifyCollection(result.payload));
});
