# Google Calendar Setup (Phase 4 — read-only sync)

This guide walks through connecting the dashboard to Google Calendar so that
Dome's, Emely's and the family's appointments show up in the "Termine" tile
automatically (synced into the local `CalendarEvent` table).

The integration is **read-only**: it only ever calls `events.list`, never
writes anything back to Google.

## 1. Create a Google Cloud project + enable the Calendar API

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a new project (or reuse an existing one).
2. In the left sidebar go to **APIs & Services → Library**, search for
   **"Google Calendar API"**, open it and click **Enable**.

## 2. Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** as the user type (a personal/household project doesn't
   qualify for "Internal").
3. Fill in the required app info (app name, support email, developer contact).
   You don't need to submit for verification — the app will run in "Testing"
   mode, which is fine for personal use.
4. Add the scope `https://www.googleapis.com/auth/calendar.readonly` (Calendar
   API — "See your calendars").
5. Under **Test users**, add **both of your Google accounts** (Dome's and
   Emely's email addresses). Only test users can complete the consent flow
   while the app is in Testing mode.

## 3. Create an OAuth Client ID

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
   (Adjust the host/port if you run the dashboard elsewhere.)
4. Click **Create**. Copy the generated **Client ID** and **Client secret**.

## 4. Fill in `web/.env`

Copy `web/.env.example` to `web/.env` if you haven't already, then set:

```env
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

`GOOGLE_REDIRECT_URI` must exactly match the redirect URI you registered in
step 3 (including protocol, host, port and path).

## 5. Connect the dashboard to Google

With the dev server running (`npm run dev`), open:

```
http://localhost:3000/api/auth/google
```

This redirects you to Google's consent screen. **Sign in with the Google
account whose calendar you want to read** (do this once per account you want
to connect — Dome's and/or Emely's; the app stores a single Google connection
under `provider: "google"`, so if both of you use separate Google accounts for
your personal calendars, connect with whichever account also has access to all
the relevant calendars, e.g. via "Other calendars" sharing — see step 6).

Grant the read-only Calendar permission. You'll be redirected back to the
dashboard (`/?google=connected` on success, `/?google=error` if something went
wrong — check the server logs for details).

> **Note:** Google only returns a refresh token on the *first* consent (or
> when `prompt=consent` forces re-consent, which this flow always does). If
> you ever need to reconnect with a different account, first revoke the app's
> access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions),
> then visit `/api/auth/google` again.

## 6. Find your calendar IDs

For each calendar you want to sync (Dome's personal calendar, Emely's personal
calendar, the shared family calendar):

1. Open [Google Calendar](https://calendar.google.com/) in the browser.
2. In the left sidebar, hover over the calendar, click the **⋮** (three-dot
   menu) → **Settings and sharing**.
3. Scroll to **Integrate calendar** and copy the **Calendar ID**. For your
   primary/personal calendar this is usually your email address
   (`name@gmail.com`); for secondary calendars it looks like
   `xxxxxxxx@group.calendar.google.com`.

> If the calendar belongs to a different Google account than the one you
> connected in step 5, make sure that account has shared the calendar with
> (or made it visible to) the connected account — otherwise `events.list`
> will return a 404/403 for that calendar ID.

## 7. Fill in the calendar IDs in `web/.env`

```env
GOOGLE_CALENDAR_DOME=<Dome's calendar ID>
GOOGLE_CALENDAR_EMELY=<Emely's calendar ID>
GOOGLE_CALENDAR_FAMILY=<family calendar ID>
```

You can leave any of these empty — the sync skips calendars whose env var
isn't set.

## 8. Trigger the sync

With `web/.env` filled in (restart the dev server so the new env vars are
picked up) and the connection established (step 5), trigger a sync:

```
http://localhost:3000/api/sync/calendar
```

(GET or POST both work — e.g. `curl -X POST http://localhost:3000/api/sync/calendar`.)

This fetches the next 14 days of events from each configured calendar and
upserts them into the local `CalendarEvent` table. The response is a small
JSON summary, e.g. `{ "synced": 7 }`.

Once synced, today's events show up automatically in the dashboard's
"Termine" tile (it reads `CalendarEvent` via `getTodaysEvents` — no further
wiring needed), and `getBusyWindows` makes them available to the planning
engine as busy windows for Dome/Emely.

### Re-syncing

Run the sync endpoint again any time (e.g. on a schedule, or manually after
adding events to Google Calendar) — it's idempotent: events are upserted by
their Google event ID, so re-running never creates duplicates, it just
refreshes titles/times/locations that changed.

## Troubleshooting

- **`/api/sync/calendar` returns `"Google Calendar is not connected"`** — you
  haven't completed step 5 yet, or the stored refresh token was revoked.
  Visit `/api/auth/google` again.
- **`/api/sync/calendar` returns `"No calendars configured"`** — none of
  `GOOGLE_CALENDAR_DOME/EMELY/FAMILY` are set in `web/.env`.
- **Google Calendar request failed: 404 / 403** — the calendar ID is wrong,
  or the connected Google account doesn't have access to that calendar (see
  the note in step 6 about sharing across accounts).
- **`Google did not return a refresh token`** — Google only issues a refresh
  token on first consent (or forced re-consent). Revoke the app's access at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and reconnect via `/api/auth/google`.
