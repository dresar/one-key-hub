import { q } from "../db.js";
import { reactivateExpiredCredentialCooldowns } from "../services/observability.js";

function validitySql(provider: string): string | null {
  const p = (provider || "").toLowerCase();
  if (p === "gemini" || p === "groq") {
    return "coalesce(credentials->>'api_key', credentials->>'apiKey', '') not in ('', 'dummy_gemini_key', 'dummy_groq_key')";
  }
  if (p === "apify") return "coalesce(credentials->>'api_token', credentials->>'apiToken', '') <> ''";
  if (p === "cloudinary") {
    return [
      "coalesce(credentials->>'cloud_name', credentials->>'cloudName', '') <> ''",
      "coalesce(credentials->>'api_key', credentials->>'apiKey', '') <> ''",
      "coalesce(credentials->>'api_secret', credentials->>'apiSecret', '') <> ''",
    ].join(" and ");
  }
  if (p === "imagekit") {
    return [
      "coalesce(credentials->>'public_key', credentials->>'publicKey', '') <> ''",
      "coalesce(credentials->>'private_key', credentials->>'privateKey', '') <> ''",
      "coalesce(credentials->>'url_endpoint', credentials->>'urlEndpoint', '') <> ''",
    ].join(" and ");
  }
  if (p === "newsapi") return "coalesce(credentials->>'api_key', credentials->>'apiKey', '') <> ''";
  if (p === "gnews") {
    return "coalesce(credentials->>'api_key', credentials->>'apiKey', credentials->>'token', '') <> ''";
  }
  if (p === "mediastack") return "coalesce(credentials->>'access_key', credentials->>'accessKey', '') <> ''";
  if (p === "openweather") return "coalesce(credentials->>'appid', credentials->>'appId', '') <> ''";
  if (p === "alphavantage") return "coalesce(credentials->>'api_key', credentials->>'apiKey', '') <> ''";
  if (p === "huggingface") return "coalesce(credentials->>'api_key', credentials->>'apiKey', '') <> ''";
  if (p === "rapidapi") {
    return [
      "coalesce(credentials->>'api_key', credentials->>'apiKey', '') <> ''",
      "coalesce(credentials->>'rapidapi_host', credentials->>'rapidapiHost', '') <> ''",
    ].join(" and ");
  }
  return null;
}

export async function findLatestActiveCredential(userId: string, provider: string): Promise<Record<string, unknown> | null> {
  const vs = validitySql(provider);
  if (!vs) return null;
  await reactivateExpiredCredentialCooldowns(userId, provider);
  const rows = await q<Record<string, unknown>>(
    `select id, credentials from public.provider_credentials
      where user_id = $1 and provider_name = $2 and status = 'active'
        and (${vs})
      order by created_at desc limit 1`,
    [userId, provider]
  );
  return rows[0] ?? null;
}
