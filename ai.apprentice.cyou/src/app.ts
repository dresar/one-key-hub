import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { pool } from "./db.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { initMetrics } from "./lib/metrics.js";
import { authRoutes } from "./routes/auth.js";
import { keyRoutes } from "./routes/keys.js";
import { statsRoutes } from "./routes/stats.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { playgroundPublicRoutes } from "./routes/playground-public.js";
import { gatewayRoutes } from "./routes/gateway.js";
import { apifyTestRoutes } from "./routes/apify-test.js";
import { internalRoutes } from "./routes/internal.js";
import { getOpenApiDocument } from "./lib/openapi.js";

initMetrics();

const swaggerUiHtml = () => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unified Gateway API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true
      });
    </script>
  </body>
</html>`;

export function createApp() {
  const app = new Hono();

  app.use("*", securityHeaders);

  if (config.corsAllowAll) {
    app.use(
      "*",
      cors({
        origin: "*",
        allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Signature", "X-Timestamp", "X-Nonce"],
        credentials: false,
      })
    );
  } else {
    app.use(
      "*",
      cors({
        origin: (origin) => {
          if (!origin) return "";
          return config.corsOrigins.includes(origin) ? origin : "";
        },
        allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Signature", "X-Timestamp", "X-Nonce"],
        credentials: true,
      })
    );
  }

  app.get("/", (c) => c.text("Unified Hono API online"));

  const pingHandler = (c: Context) => c.json({ ok: true });
  app.get("/ping", pingHandler);
  app.on("HEAD", "/ping", (c) => c.body(null, 200));
  app.get("/api/ping", pingHandler);
  app.on("HEAD", "/api/ping", (c) => c.body(null, 200));

  const healthzHandler = async (c: Context) => {
    try {
      await pool.query("select 1");
      return c.json({
        ok: true,
        dbOk: true,
        checkedAt: Date.now(),
        sharedStateMode: config.revokeTokensInDb ? "db+memory" : "local-memory",
        cacheMode: "local-memory",
        rateLimitMode: "local-memory",
        observabilityMode: config.gatewayLogMode,
      });
    } catch {
      return c.json({ ok: false, dbOk: false }, 503);
    }
  };
  app.get("/healthz", healthzHandler);
  app.get("/api/healthz", healthzHandler);

  const metricsHandler = async (c: Context) => {
    if (!config.exposeMetrics || config.isServerless) return c.json({ error: "Not found" }, 404);
    const { metricsText } = await import("./lib/metrics.js");
    const text = await metricsText();
    return c.body(text, 200, { "Content-Type": "text/plain; version=0.0.4" });
  };
  app.get("/metrics", metricsHandler);
  app.get("/api/metrics", metricsHandler);

  const openApiHandler = (c: Context) => {
    if (!config.exposeOpenapi) return c.json({ error: "Not found" }, 404);
    const origin = c.req.header("origin") || "";
    const fallback = `${new URL(c.req.url).origin}`;
    const doc = getOpenApiDocument(origin || fallback);
    return c.json(doc);
  };
  app.get("/openapi.json", openApiHandler);
  app.get("/api/openapi.json", openApiHandler);

  const swaggerDocsHandler = (c: Context) => {
    if (!config.exposeOpenapi) return c.json({ error: "Not found" }, 404);
    return c.html(swaggerUiHtml());
  };
  /** Swagger UI — /swagger (bukan /docs) agar tidak bentrok dengan route React /docs di SPA. */
  app.get("/swagger", swaggerDocsHandler);
  app.get("/api/swagger", swaggerDocsHandler);

  app.route("/", playgroundPublicRoutes);
  app.route("/", authRoutes);
  app.route("/", keyRoutes);
  app.route("/", statsRoutes);
  app.route("/", dashboardRoutes);
  if (config.enableInternalTestRoutes) {
    app.route("/", apifyTestRoutes);
  }
  app.route("/", internalRoutes);

  app.route("/gateway", gatewayRoutes);
  app.route("/api/gateway", gatewayRoutes);

  app.notFound((c) => c.json({ error: "Rute tidak ditemukan." }, 404));

  return app;
}
