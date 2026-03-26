# MigrateBot — API Reference

Base URL (production): `https://api.migratebot.io`  
Base URL (local dev): `http://localhost:3001`

All endpoints under `/api/*` (except `/api/auth/*` and `/api/health`) require:
```
Authorization: Bearer <jwt>
```

All request/response bodies are `application/json` unless noted.

---

## Authentication

### POST `/api/auth/register`
Create a new account.

**Body**
```json
{ "email": "user@example.com", "password": "min8chars", "name": "Alice" }
```
**Response 201**
```json
{ "token": "<jwt>", "user": { "id": "uuid", "email": "...", "name": "..." } }
```

### POST `/api/auth/login`
**Body** `{ "email", "password" }`  
**Response 200** `{ "token": "<jwt>", "user": { ... } }`

### GET `/api/auth/me`
Returns the authenticated user object.

### POST `/api/auth/logout`
Invalidates the current JWT server-side.

---

## Migrations

### GET `/api/migrations`
List all migrations for the authenticated user, newest first.

**Response 200**
```json
{ "migrations": [ { "id": "uuid", "repourl": "...", "status": "pending", ... } ] }
```

### GET `/api/migrations/:id`
Get a single migration by ID (must belong to the authenticated user).

**Response 404** `{ "error": "Migration not found" }` if not found or not owned.

### POST `/api/migrations`
Create a new migration record.

**Body**
```json
{
  "repourl": "https://github.com/user/repo",
  "branch": "main",
  "source_platform": "github",
  "tier": "standard"
}
```
| Field | Required | Values |
|---|---|---|
| `repourl` | ✅ | Any valid URL |
| `source_platform` | no | `github` \| `replit` \| `emergent` \| `url` (default: `github`) |
| `branch` | no | default `main` |
| `tier` | no | `standard` \| `pro` (default: `standard`) |

**Response 201** `{ "migration": { ... } }`

### POST `/api/migrations/:id/analyze`
Run Claude AI analysis on the migration’s source repo.  
Sets status to `analyzing`, then `analyzed` on completion.

**Response 200** `{ "migration": { ... }, "analysis": { ... } }`

### POST `/api/migrations/:id/start`
Enqueue the migration job. Requires `status === 'paid'`.

**Body (Replit only)** `{ "replit_token": "..." }`  
**Response 200** `{ "message": "Migration job queued", "migrationId": "uuid" }`  
**Response 400** `{ "error": "Migration must be paid before starting" }`

### DELETE `/api/migrations/:id`
Delete a migration record.

---

## Credentials

All credential data is AES-256-GCM encrypted at rest. Decrypted values are **never** returned to the client.

### POST `/api/credentials`
Store encrypted credentials for a migration.

**Body**
```json
{
  "migration_id": "uuid",
  "platform": "github",
  "credentials": { "token": "ghp_..." }
}
```
**Response 201** `{ "id": "uuid", "platform": "github", "message": "Credentials stored securely" }`

### GET `/api/credentials/:migration_id`
List stored credential records (platform + ID only, no secret data).

### DELETE `/api/credentials/:id`
Delete a stored credential.

### POST `/api/credentials/validate`
Live-validate a token for a platform **without storing it**.

**Body** `{ "platform": "github" | "replit" | "supabase" | "vercel" | "railway", "token": "..." }`  
**Response 200** `{ "valid": true, "meta": { "username": "...", ... } }`  
**Response 400** `{ "valid": false, "error": "..." }`

---

## Notifications

### GET `/api/notifications/prefs`
Get notification preferences and Slack connection status.

**Response 200**
```json
{
  "prefs": {
    "migration_completed": true,
    "migration_failed": true,
    "health_check_alerts": true,
    "product_updates": false,
    "billing_receipts": true
  },
  "slackConnected": false
}
```

### PUT `/api/notifications/prefs`
Update one or more notification preferences.

**Body** `{ "migration_completed": false, "product_updates": true }` (any subset of the 5 keys, boolean values only)  
**Response 200** `{ "success": true, "prefs": { ... merged result ... } }`  
**Response 400** `{ "error": "No valid preference keys provided", "allowed": [...] }`

### POST `/api/notifications/slack`
Save a Slack incoming webhook URL.

**Body** `{ "webhookUrl": "https://hooks.slack.com/services/..." }`  
**Response 200** `{ "success": true }`  
**Response 400** `{ "error": "Invalid Slack webhook URL" }`

### POST `/api/notifications/slack/test`
Send a test message to the configured Slack webhook.

**Response 200** `{ "success": true }`  
**Response 400** `{ "error": "No Slack webhook configured" }`

### DELETE `/api/notifications/slack`
Remove the configured Slack webhook.

---

## Billing

### POST `/api/billing/payment-intent`
Create a Stripe PaymentIntent for a migration tier.

**Body** `{ "migration_id": "uuid", "tier": "standard" | "pro" }`  
**Response 200** `{ "clientSecret": "pi_..._secret_...", "amount": 10000 }`

### GET `/api/billing/history`
List past payments for the authenticated user.

### POST `/api/billing/webhook`
Stripe webhook endpoint. Requires raw body + valid `Stripe-Signature` header.  
Must be excluded from JSON body-parser middleware.  
**Do not call this endpoint directly.**

---

## Two-Factor Authentication (TOTP)

### POST `/api/2fa/setup`
Generate a TOTP secret and QR code URI. Does not activate 2FA yet.

**Response 200** `{ "secret": "BASE32SECRET", "otpauthUrl": "otpauth://..." }`

### POST `/api/2fa/verify`
Verify a TOTP code and activate 2FA on the account.

**Body** `{ "token": "123456", "secret": "BASE32SECRET" }`  
**Response 200** `{ "success": true }`

### POST `/api/2fa/disable`
Disable 2FA (requires current TOTP code for confirmation).

**Body** `{ "token": "123456" }`

---

## Email Verification

### POST `/api/email-verification/send`
Send (or resend) the verification email.

### POST `/api/email-verification/verify`
Verify the email token from the link.

**Body** `{ "token": "..." }`

---

## Password Reset

### POST `/api/password-reset/request`
**Body** `{ "email": "user@example.com" }`

### POST `/api/password-reset/reset`
**Body** `{ "token": "...", "password": "newpassword" }`

---

## App Health

### GET `/api/app-health/:migration_id`
Run live health checks on a deployed migration’s endpoints.

### POST `/api/app-health/:migration_id/check`
Force a fresh health check run.

---

## Health (system)

### GET `/api/health`
No auth required. Returns API + DB + Redis status.

**Response 200**
```json
{ "status": "ok", "db": "connected", "redis": "connected", "uptime": 3600 }
```

---

## Error responses

All errors follow the shape:
```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthenticated — missing or expired JWT |
| 403 | Forbidden — resource belongs to another user |
| 404 | Resource not found |
| 500 | Internal server error |

---

## WebSocket events (Socket.io)

Connect to the backend Socket.io server with:
```js
const socket = io(process.env.NEXT_PUBLIC_API_URL, {
  auth: { token: localStorage.getItem('token') }
});
```

| Event (server → client) | Payload | Description |
|---|---|---|
| `log` | `{ message: string, level: string }` | Migration log line |
| `status` | `{ migrationId, status }` | Status change |
| `progress` | `{ migrationId, percent }` | Progress update |
| `migration:complete` | `{ migrationId, urls: {} }` | Deploy finished |
| `migration:failed` | `{ migrationId, error }` | Deploy failed |
| `agent:question` | `{ migrationId, question }` | AI needs user input |

| Event (client → server) | Payload | Description |
|---|---|---|
| `agent:answer` | `{ migrationId, answer }` | User reply to AI |
| `join:migration` | `{ migrationId }` | Subscribe to a migration room |
