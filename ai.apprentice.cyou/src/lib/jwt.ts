import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const secret = new TextEncoder().encode(config.jwtSecret);
const issuer = "unified-ai-gateway";
const audience = "unified-ai-gateway";

export type JwtUser = {
  sub: string;
  email: string;
  displayName: string | null;
  jti: string;
  exp: number;
};

export const signUserJwt = async (u: { id: string; email: string; displayName: string | null }) => {
  const jti = crypto.randomUUID();
  return new SignJWT({
    email: u.email,
    displayName: u.displayName,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(u.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
};

export const verifyUserJwt = async (token: string): Promise<JwtUser> => {
  const { payload } = await jwtVerify(token, secret, {
    issuer,
    audience,
  });
  return {
    sub: String(payload.sub || ""),
    email: String(payload.email || ""),
    displayName: payload.displayName == null ? null : String(payload.displayName),
    jti: String(payload.jti || ""),
    exp: Number(payload.exp || 0),
  };
};

