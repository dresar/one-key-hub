import { Hono } from "hono";
import * as aiModels from "../services/ai-models.js";

/** Mirror Python: /api/playground/models* tanpa JWT. */
export const playgroundPublicRoutes = new Hono();

playgroundPublicRoutes.get("/api/playground/models", async (c) => {
  const provider = c.req.query("provider");
  if (!provider || (provider !== "gemini" && provider !== "groq")) {
    return c.json({ error: "provider required (gemini or groq)" }, 400);
  }
  const models = await aiModels.listModels(provider);
  return c.json({ models });
});

playgroundPublicRoutes.post("/api/playground/models", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const created = await aiModels.createModel({
      provider: String(body.provider || ""),
      model_id: String(body.model_id || body.modelId || ""),
      display_name: (body.display_name ?? body.displayName) as string | undefined,
      is_default: Boolean(body.is_default ?? body.isDefault),
      supports_vision: Boolean(body.supports_vision ?? body.supportsVision),
      sort_order: Number(body.sort_order ?? body.sortOrder ?? 0),
    });
    return c.json(created, 201);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

playgroundPublicRoutes.delete("/api/playground/models/:id", async (c) => {
  try {
    const res = await aiModels.deleteModelById(c.req.param("id"));
    if (!res.deleted) return c.json({ error: "Not found" }, 404);
    return c.body(null, 204);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

playgroundPublicRoutes.patch("/api/playground/models/:id", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const updated = await aiModels.updateModel(c.req.param("id"), {
      display_name: (body.display_name ?? body.displayName) as string | undefined,
      supports_vision: (body.supports_vision ?? body.supportsVision) as boolean | undefined,
      is_default: (body.is_default ?? body.isDefault) as boolean | undefined,
    });
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});
