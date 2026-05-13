import { Registry, collectDefaultMetrics } from "prom-client";
import { config } from "../config.js";

const registry = new Registry();

export function initMetrics() {
  if (!config.exposeMetrics || config.isServerless) return;
  collectDefaultMetrics({ register: registry });
}

export async function metricsText(): Promise<string> {
  if (!config.exposeMetrics || config.isServerless) return "";
  return registry.metrics();
}
