// Server-only Firebase Admin SDK — verifies a caller's real ID token before
// /api/onboarding or /api/invite/[token]/accept ever trust a uid. Never
// import this from a "use client" file; it uses a private-key credential
// that must never reach the browser bundle.
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Same base64-PEM preference as schedurx-backend's server.js — immune to the
// literal-\n escaping some env-var loaders mangle.
function resolvePrivateKey(): string | null {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  if (process.env.FIREBASE_PRIVATE_KEY) {
    return process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  return null;
}

let app: App | null | undefined;

// Next.js re-evaluates route modules on every hot-reload in dev — guard
// against calling initializeApp() twice, which throws.
function getAdminApp(): App | null {
  if (app !== undefined) return app;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = resolvePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    app = null;
    return app;
  }

  const existing = getApps()[0];
  app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenVerificationError";
  }
}

// Verifies the bearer ID token from an Authorization header and returns the
// real, server-verified uid — the only uid that should ever be trusted for
// an authorization decision. Throws TokenVerificationError on any failure
// (missing config, missing/malformed header, expired/invalid token).
export async function verifyIdTokenFromHeader(authorizationHeader: string | null): Promise<string> {
  const adminApp = getAdminApp();
  if (!adminApp) throw new TokenVerificationError("Server is missing Firebase Admin credentials");

  const match = authorizationHeader?.match(/^Bearer (.+)$/);
  if (!match) throw new TokenVerificationError("Missing or malformed Authorization header");

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new TokenVerificationError("Invalid or expired ID token");
  }
}
