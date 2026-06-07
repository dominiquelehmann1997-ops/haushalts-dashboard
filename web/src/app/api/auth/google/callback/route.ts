// GET /api/auth/google/callback — Google OAuth redirect target: reads the
// `code` query param, exchanges it for tokens (persisting the refresh token
// to `OAuthToken`), then redirects back to the dashboard with a small
// success/error indication (`?google=connected` / `?google=error`). See
// `@/integrations/calendar/googleAuth` and `docs/setup/google-calendar.md`.

import { NextRequest, NextResponse } from "next/server";

import { exchangeCode } from "@/integrations/calendar/googleAuth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/?google=error`, request.url));
  }

  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL(`/?google=connected`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/?google=error`, request.url));
  }
}
