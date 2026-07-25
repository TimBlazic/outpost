import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function generatePortalToken() {
  return randomBytes(18).toString("base64url");
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizePin(pin), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(normalizePin(pin), salt, 32).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch {
    return false;
  }
}

export function normalizePin(pin: string) {
  return pin.trim();
}

/** Lightweight HMAC for portal session cookies. */
export function signPayload(payload: string, secret: string) {
  return createHash("sha256").update(`${secret}:${payload}`).digest("base64url");
}
