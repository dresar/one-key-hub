export function getOpenApiDocument(serverBase?: string) {
  const servers = serverBase ? [{ url: serverBase }] : [{ url: "/" }];
  return {
    openapi: "3.0.3",
    info: {
      title: "Unified Gateway API",
      version: "1.0.0",
      description:
        "Dokumentasi lengkap API untuk auth dashboard, manajemen keys/credentials/clients, observability, playground, dan gateway proxy multi-provider. UI Swagger interaktif: GET /swagger (bukan /docs — itu halaman dokumentasi SPA).",
    },
    servers,
    tags: [
      { name: "Auth" },
      { name: "Profile" },
      { name: "Stats & Monitoring" },
      { name: "Keys" },
      { name: "Credentials" },
      { name: "Clients" },
      { name: "Logs & Alerts" },
      { name: "Settings" },
      { name: "Playground" },
      { name: "Gateway" },
      { name: "System" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
        BasicAuth: { type: "http", scheme: "basic" },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: { error: { type: "string" } },
          required: ["error"],
        },
        LoginRequest: {
          type: "object",
          properties: { email: { type: "string" }, password: { type: "string" } },
          required: ["email", "password"],
        },
        TokenResponse: {
          type: "object",
          properties: { token: { type: "string" }, user: { type: "object" } },
        },
        PagedMeta: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
    paths: {
      "/": {
        get: {
          tags: ["System"],
          summary: "Root status",
          responses: { "200": { description: "OK" } },
        },
      },
      "/ping": {
        get: {
          tags: ["System"],
          summary: "Liveness check",
          responses: { "200": { description: "OK" } },
        },
      },
      "/healthz": {
        get: {
          tags: ["System"],
          summary: "Health check + DB",
          responses: { "200": { description: "Healthy" }, "503": { description: "Unhealthy" } },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login user",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
          },
          responses: {
            "200": { description: "Success", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register user",
          responses: { "200": { description: "Success" }, "400": { description: "Validation error" } },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current user",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Success" }, "401": { description: "Unauthorized" } },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh JWT",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout and revoke token",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/profile": {
        patch: {
          tags: ["Profile"],
          summary: "Update profile",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/auth/change-password": {
        post: {
          tags: ["Profile"],
          summary: "Change password",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/stats": {
        get: { tags: ["Stats & Monitoring"], security: [{ BearerAuth: [] }], summary: "Dashboard summary", responses: { "200": { description: "Success" } } },
      },
      "/api/stats/usage": {
        get: { tags: ["Stats & Monitoring"], security: [{ BearerAuth: [] }], summary: "Usage timeline", responses: { "200": { description: "Success" } } },
      },
      "/api/monitoring/overview": {
        get: { tags: ["Stats & Monitoring"], security: [{ BearerAuth: [] }], summary: "Monitoring overview", responses: { "200": { description: "Success" } } },
      },
      "/api/bootstrap": {
        get: {
          tags: ["Stats & Monitoring"],
          security: [{ BearerAuth: [] }],
          summary: "Bootstrap payload (tier=critical|full)",
          parameters: [{ name: "tier", in: "query", schema: { type: "string", enum: ["critical", "full"] } }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/keys": {
        get: {
          tags: ["Keys"],
          security: [{ BearerAuth: [] }],
          summary: "List gateway keys",
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { items: { type: "array", items: { type: "object" } }, meta: { $ref: "#/components/schemas/PagedMeta" } },
                  },
                },
              },
            },
          },
        },
        post: { tags: ["Keys"], security: [{ BearerAuth: [] }], summary: "Create gateway key", responses: { "200": { description: "Created" } } },
      },
      "/api/keys/{id}/rotate": {
        post: {
          tags: ["Keys"],
          security: [{ BearerAuth: [] }],
          summary: "Rotate key and return new secret",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Rotated" } },
        },
      },
      "/api/keys/{id}/health": {
        get: {
          tags: ["Keys"],
          security: [{ BearerAuth: [] }],
          summary: "Key health",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/keys/{id}/stats": {
        get: {
          tags: ["Keys"],
          security: [{ BearerAuth: [] }],
          summary: "Key usage stats",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/keys/{id}/analytics": {
        get: {
          tags: ["Keys"],
          security: [{ BearerAuth: [] }],
          summary: "Key analytics",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/keys/{id}/domains": {
        get: {
          tags: ["Keys"],
          security: [{ BearerAuth: [] }],
          summary: "Key domains",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/api/keys/{id}": {
        patch: { tags: ["Keys"], security: [{ BearerAuth: [] }], summary: "Update key", responses: { "200": { description: "Updated" } } },
        delete: { tags: ["Keys"], security: [{ BearerAuth: [] }], summary: "Delete key", responses: { "204": { description: "Deleted" } } },
      },
      "/api/credentials": {
        get: { tags: ["Credentials"], security: [{ BearerAuth: [] }], summary: "List credentials", responses: { "200": { description: "Success" } } },
        post: { tags: ["Credentials"], security: [{ BearerAuth: [] }], summary: "Create credential", responses: { "200": { description: "Created" } } },
      },
      "/api/credentials/export": {
        get: { tags: ["Credentials"], security: [{ BearerAuth: [] }], summary: "Export credentials", responses: { "200": { description: "Success" } } },
      },
      "/api/credentials/import": {
        post: { tags: ["Credentials"], security: [{ BearerAuth: [] }], summary: "Import credentials", responses: { "200": { description: "Imported" } } },
      },
      "/api/credentials/{id}": {
        get: {
          tags: ["Credentials"],
          security: [{ BearerAuth: [] }],
          summary: "Get credential detail",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Success" } },
        },
        patch: {
          tags: ["Credentials"],
          security: [{ BearerAuth: [] }],
          summary: "Update credential",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Credentials"],
          security: [{ BearerAuth: [] }],
          summary: "Delete credential",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/api/credentials/{id}/reactivate": {
        post: {
          tags: ["Credentials"],
          security: [{ BearerAuth: [] }],
          summary: "Reactivate credential",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Reactivated" } },
        },
      },
      "/api/clients": {
        get: { tags: ["Clients"], security: [{ BearerAuth: [] }], summary: "List api_clients", responses: { "200": { description: "Success" } } },
        post: { tags: ["Clients"], security: [{ BearerAuth: [] }], summary: "Create api_client", responses: { "200": { description: "Created" } } },
      },
      "/api/clients/{id}": {
        patch: {
          tags: ["Clients"],
          security: [{ BearerAuth: [] }],
          summary: "Update api_client",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Clients"],
          security: [{ BearerAuth: [] }],
          summary: "Delete api_client",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/api/logs": {
        get: { tags: ["Logs & Alerts"], security: [{ BearerAuth: [] }], summary: "List request logs", responses: { "200": { description: "Success" } } },
      },
      "/api/alerts": {
        get: { tags: ["Logs & Alerts"], security: [{ BearerAuth: [] }], summary: "List alerts", responses: { "200": { description: "Success" } } },
      },
      "/api/alerts/{id}/ack": {
        patch: {
          tags: ["Logs & Alerts"],
          security: [{ BearerAuth: [] }],
          summary: "Acknowledge alert",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Acked" } },
        },
      },
      "/api/settings": {
        get: { tags: ["Settings"], security: [{ BearerAuth: [] }], summary: "Get settings", responses: { "200": { description: "Success" } } },
        put: { tags: ["Settings"], security: [{ BearerAuth: [] }], summary: "Save settings", responses: { "200": { description: "Saved" } } },
      },
      "/api/playground/models": {
        get: { tags: ["Playground"], summary: "List AI models by provider", responses: { "200": { description: "Success" } } },
        post: { tags: ["Playground"], summary: "Create AI model", responses: { "201": { description: "Created" } } },
      },
      "/api/playground/models/{id}": {
        patch: {
          tags: ["Playground"],
          summary: "Update AI model",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Playground"],
          summary: "Delete AI model",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/api/playground/chat": {
        post: { tags: ["Playground"], security: [{ BearerAuth: [] }], summary: "Dashboard playground chat", responses: { "200": { description: "Success" } } },
      },
      "/api/playground/upload": {
        post: { tags: ["Playground"], security: [{ BearerAuth: [] }], summary: "Dashboard playground upload", responses: { "200": { description: "Success" } } },
      },
      "/api/playground/proxy": {
        post: { tags: ["Playground"], security: [{ BearerAuth: [] }], summary: "Dashboard playground proxy for all providers", responses: { "200": { description: "Success" } } },
      },
      "/gateway/verify": {
        get: {
          tags: ["Gateway"],
          summary: "Verify gateway API key",
          security: [{ ApiKeyAuth: [] }, { BasicAuth: [] }],
          responses: { "200": { description: "Valid key" }, "401": { description: "Invalid key" } },
        },
      },
      "/gateway/gemini/chat": {
        post: {
          tags: ["Gateway"],
          summary: "Gateway chat via Gemini",
          security: [{ ApiKeyAuth: [] }, { BasicAuth: [] }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/gateway/groq/chat": {
        post: {
          tags: ["Gateway"],
          summary: "Gateway chat via Groq",
          security: [{ ApiKeyAuth: [] }, { BasicAuth: [] }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/gateway/cloudinary/upload": {
        post: {
          tags: ["Gateway"],
          summary: "Gateway upload Cloudinary",
          security: [{ ApiKeyAuth: [] }, { BasicAuth: [] }],
          responses: { "200": { description: "Success" } },
        },
      },
      "/gateway/imagekit/upload": {
        post: {
          tags: ["Gateway"],
          summary: "Gateway upload ImageKit",
          security: [{ ApiKeyAuth: [] }, { BasicAuth: [] }],
          responses: { "200": { description: "Success" } },
        },
      },
    },
  };
}
