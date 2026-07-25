import { base64UrlToBuffer, bufferToBase64Url, randomBytes } from "@/lib/app-lock/crypto";

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    return false;
  }
  return false;
}

function rpId(): string {
  return window.location.hostname;
}

/** Enroll a device-bound platform credential for app unlock (Face ID / fingerprint). */
export async function enrollBiometricCredential(userId: string): Promise<string> {
  const challenge = randomBytes(32);
  const userHandle = new TextEncoder().encode(`pocketa-lock:${userId}`);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as BufferSource,
      rp: {
        name: "Pocketa",
        id: rpId(),
      },
      user: {
        id: userHandle,
        name: "pocketa-app-lock",
        displayName: "قفل Pocketa",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: 90_000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
        requireResidentKey: false,
      },
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("ثبت بیومتریک لغو شد یا پشتیبانی نمی‌شود");
  }

  return bufferToBase64Url(credential.rawId);
}

/** Prompt platform authenticator; success means the OS verified the user. */
export async function assertBiometricCredential(credentialId: string): Promise<void> {
  const challenge = randomBytes(32);
  const id = base64UrlToBuffer(credentialId);

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: challenge as BufferSource,
      timeout: 90_000,
      userVerification: "required",
      allowCredentials: [
        {
          type: "public-key",
          id: id as BufferSource,
          transports: ["internal"],
        },
      ],
    },
  });

  if (!credential) {
    throw new Error("احراز هویت بیومتریک ناموفق بود");
  }
}

export function webAuthnErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "احراز هویت لغو شد یا زمان آن تمام شد";
    if (err.name === "InvalidStateError") return "این بیومتریک از قبل ثبت شده است";
    if (err.name === "NotSupportedError") return "بیومتریک روی این دستگاه پشتیبانی نمی‌شود";
    if (err.name === "SecurityError") return "برای بیومتریک به اتصال امن (HTTPS) نیاز است";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
