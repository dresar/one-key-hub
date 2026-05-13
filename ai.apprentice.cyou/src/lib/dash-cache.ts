import { cacheDel, cacheDelByPrefix } from "./cache.js";

const dashKey = (kind: string, tenantId: string, suffix?: string) =>
  suffix ? `dash:${kind}:${tenantId}:${suffix}` : `dash:${kind}:${tenantId}`;

export const invalidateDashboardCache = (tenantId: string) => {
  cacheDel(dashKey("stats", tenantId));
  cacheDel(dashKey("usage", tenantId, "days:7"));
  cacheDel(dashKey("keys", tenantId));
  cacheDel(dashKey("monitoring", tenantId));
  cacheDelByPrefix(`dash:api_keys_list:${tenantId}`);
  cacheDelByPrefix(`dash:credentials_list:${tenantId}`);
  cacheDelByPrefix(`dash:clients_list:${tenantId}`);
  cacheDel(dashKey("settings", tenantId));
  cacheDel(dashKey("alerts", tenantId, "status:active|limit:25"));
  cacheDelByPrefix(`dash:logs:${tenantId}`);
};

export const invalidateKeyDetailCache = (tenantId: string, keyId: string) => {
  cacheDel(dashKey("key_health", tenantId, keyId));
  cacheDel(dashKey("key_stats", tenantId, keyId));
  cacheDel(dashKey("key_analytics", tenantId, keyId));
  cacheDel(dashKey("key_domains", tenantId, keyId));
};

export { dashKey };
