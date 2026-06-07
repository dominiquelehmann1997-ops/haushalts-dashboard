// GET /api/auth/google — starts the Google OAuth consent flow: redirects the
// user to Google's consent screen for the read-only Calendar scope. See
// `@/integrations/calendar/googleAuth` and `docs/setup/google-calendar.md`.

import { NextResponse } from "next/server";

import { getAuthUrl } from "@/integrations/calendar/googleAuth";

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build the Google consent URL" },
      { status: 500 },
    );
  }
}
