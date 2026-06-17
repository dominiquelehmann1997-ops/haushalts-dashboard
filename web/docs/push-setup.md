# Web Push / VAPID — Setup & Operations

## Overview

The dashboard sends Web Push notifications via the [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030) using the `web-push` npm library. Authentication between the server and push services (FCM, Mozilla, etc.) is handled by a VAPID key pair.

---

## Generating a VAPID Key Pair

Run once per environment (dev, prod). **Never reuse keys across environments.**

```bash
npx web-push generate-vapid-keys
```

Output:

```
Public Key:
BExamplePublicKey...

Private Key:
ExamplePrivateKey...
```

Copy both values into your `.env` file (see below). The key pair is a permanent identity for your push subscription endpoint — changing keys invalidates all existing subscriptions.

---

## Environment Variables

Set these four variables in `web/.env` (never committed; gitignored via `.env.*`):

| Variable | Value | Notes |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Output of key generation | Used server-side when calling `web-push.sendNotification` |
| `VAPID_PRIVATE_KEY` | Output of key generation | **Secret** — never commit, never log |
| `VAPID_SUBJECT` | `mailto:your@email.com` | Contact address sent to push services for abuse reporting |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Same as `VAPID_PUBLIC_KEY` | Embedded in the client bundle; used by the Service Worker's `subscribe()` call |

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` **must match** `VAPID_PUBLIC_KEY` exactly — they are the same public key, one exposed to the browser, one used server-side.

### Example `.env` block

```env
VAPID_PUBLIC_KEY=BDXNRmPEe1iZ_FVOvkWRscfEOS6VUGHI8NImHMVnnOi9JzD4lvgPcCrIkgj91feqrsg6cRZACSPymzq7HQnBems
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:dominique.lehmann1997@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDXNRmPEe1iZ_FVOvkWRscfEOS6VUGHI8NImHMVnnOi9JzD4lvgPcCrIkgj91feqrsg6cRZACSPymzq7HQnBems
```

---

## Production Deployment (Railway / Vercel)

Add the same four variables in the Railway (or Vercel) project settings under **Environment Variables**. Do not put the private key in source control or Docker images.

---

## Localhost vs. Cloudflare Tunnel

| Scenario | Subscribe | Deliver |
|---|---|---|
| `http://localhost:3000` | Works (browser registers subscription) | May fail — push services reject non-HTTPS origins for delivery |
| Cloudflare Tunnel (`https://your-tunnel.trycloudflare.com`) | Works | Works — public HTTPS required for real push delivery |

**For end-to-end testing**, you must use the Cloudflare Tunnel URL. Start a tunnel with:

```bash
cloudflared tunnel --url http://localhost:3000
```

Then open the tunnel URL in the browser (not localhost) to test the full subscribe → notify cycle.

---

## iOS Note

Web Push is only delivered to iOS devices when the app is installed as a PWA (Add to Home Screen) **and** the device runs iOS 16.4 or later. Notifications to Safari on the web (non-installed) are not supported on iOS.

**This household uses Android**, so iOS restrictions are not a practical concern. The feature works as a standard Progressive Web App on Android Chrome without any additional configuration.

---

## Revoking / Rotating Keys

If the private key is compromised:

1. Generate a new key pair: `npx web-push generate-vapid-keys`
2. Update `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in all environments.
3. All existing `PushSubscription` records in the database are now invalid — users must re-subscribe. You can truncate the `PushSubscription` table to force fresh subscriptions.
4. Redeploy the app so the new public key is embedded in the client bundle.
