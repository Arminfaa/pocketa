const textEncoder = new TextEncoder();

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBuffer(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** PBKDF2-SHA-256 hash of PIN; returns base64url digest. */
export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 120_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufferToBase64Url(bits);
}

export async function createPinRecord(pin: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16);
  const hash = await hashPin(pin, salt);
  return { salt: bufferToBase64Url(salt), hash };
}

export async function verifyPin(
  pin: string,
  saltBase64: string,
  hashBase64: string
): Promise<boolean> {
  if (!saltBase64 || !hashBase64) return false;
  const salt = base64UrlToBuffer(saltBase64);
  const next = await hashPin(pin, salt);
  return timingSafeEqual(next, hashBase64);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  }
  return diff === 0;
}

export function isValidPinFormat(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin);
}
