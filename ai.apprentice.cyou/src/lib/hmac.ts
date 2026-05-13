import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const sha256Hex = (data: Buffer | string) =>
  createHash("sha256").update(typeof data === "string" ? Buffer.from(data, "utf8") : data).digest("hex");

export const signHmacHex = (secret: string, message: string) =>
  createHmac("sha256", Buffer.from(secret, "utf8")).update(message, "utf8").digest("hex");

export const safeEqualHex = (a: string, b: string) => {
  try {
    const aa = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (aa.length !== bb.length) return false;
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
};
