import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";
import { memoryEval } from "../services/memory-store.js";
import type { AppEnv } from "../types.js";

/** Mirror Python rate_limit_default: per-user per-route window. */
export const dashboardRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  const key = `rl:${user.id}:${c.req.path}`;
  const res = memoryEval("rl", 1, key, String(Date.now()), String(config.rateLimitWindowMs), String(config.rateLimitDefault));
  if (Number(res[0]) > config.rateLimitDefault) {
    return c.json({ error: "Rate limited" }, 429);
  }
  await next();
};
