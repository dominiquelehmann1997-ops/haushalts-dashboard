// Google OAuth 2.0 (auth-code flow, offline access) — scaffolding for Phase 4's
// live Google Calendar sync. NOT unit-tested (network + persisted secrets);
// kept small and isolated so the pure mapper (`google.ts`'s `mapGoogleEvents`)
// stays network/env-free and testable.
//
// Verified against the current `google-auth-library` docs (OAuth2Client):
// `generateAuthUrl({ access_type: "offline", scope, prompt: "consent" })` to
// build the consent URL, `getToken(code)` to exchange the auth code,
// `setCredentials`/`refreshAccessToken` to refresh from a stored refresh
// token. We persist only the `refreshToken` (plus a cached access token) in
// the `OAuthToken` table (`provider: "google"`) — refresh tokens don't expire
// under normal use, so storing just that (and refreshing on demand) is the
// minimal durable state needed to stay "connected" across restarts.

import { OAuth2Client } from "google-auth-library";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

const GOOGLE_PROVIDER = "google";
const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/** Builds an `OAuth2Client` from the `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` env vars. */
function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI (see docs/setup/google-calendar.md).",
    );
  }

  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

/**
 * Builds the consent-screen URL for the read-only Calendar scope, requesting
 * offline access (so Google returns a refresh token) and forcing the consent
 * prompt (so a refresh token is returned even on re-authorization).
 */
export function getAuthUrl(): string {
  const client = createOAuth2Client();

  return client.generateAuthUrl({
    access_type: "offline",
    scope: [CALENDAR_READONLY_SCOPE],
    prompt: "consent",
  });
}

/**
 * Exchanges an authorization `code` (from the OAuth callback's `?code=`) for
 * tokens, and persists the refresh token (+ cached access token/expiry) to
 * the `OAuthToken` table under `provider: "google"` — upserted, so
 * reconnecting overwrites the stored credentials.
 *
 * Throws if Google doesn't return a `refresh_token` (e.g. the user has
 * already granted offline access and `prompt: "consent"` was somehow skipped)
 * — without it we can't stay connected across restarts.
 */
export async function exchangeCode(code: string, client: PrismaClient = prisma): Promise<void> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token — revoke the app's access at https://myaccount.google.com/permissions and reconnect via /api/auth/google.",
    );
  }

  await client.oAuthToken.upsert({
    where: { provider: GOOGLE_PROVIDER },
    create: {
      provider: GOOGLE_PROVIDER,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

/**
 * Loads the stored Google refresh token, refreshes the access token (Google
 * access tokens are short-lived), persists the refreshed credentials, and
 * returns a valid access token for use as a Calendar API `Bearer` token.
 *
 * Throws a clear "not connected" error if no token has been stored yet — the
 * caller (the sync route) turns that into a clean JSON error response rather
 * than crashing.
 */
export async function getAccessToken(client: PrismaClient = prisma): Promise<string> {
  const stored = await client.oAuthToken.findUnique({ where: { provider: GOOGLE_PROVIDER } });

  if (!stored) {
    throw new Error(
      "Google Calendar is not connected — visit /api/auth/google to authorize (see docs/setup/google-calendar.md).",
    );
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: stored.refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Google did not return an access token while refreshing — try reconnecting via /api/auth/google.");
  }

  await client.oAuthToken.update({
    where: { provider: GOOGLE_PROVIDER },
    data: {
      accessToken: credentials.access_token,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      // Google may rotate the refresh token on refresh; persist it if it did.
      refreshToken: credentials.refresh_token ?? stored.refreshToken,
    },
  });

  return credentials.access_token;
}
