# Latam Digest Backend

Node/Express backend for the Latam Digest iOS app.

## What it does

- Uses the OpenAI Responses API with built-in web search to curate country-specific LATAM news digests
- Returns iOS-friendly article payloads for the current app
- Keeps a simple in-memory cache to reduce repeated OpenAI calls
- Optionally refreshes digests on a cron schedule

## Endpoints

- `GET /health`
- `GET /countries`
- `GET /countries/:countryCode/top`
- `GET /countries/:countryCode/latest`
- `GET /countries/:countryCode/category/:category`
- `GET /digests/:countryCode`

## Local run

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Deploy

Render or Railway are the easiest first deployment targets.

Required environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)
- `CACHE_TTL_MINUTES` (optional)
- `ALLOWED_ORIGINS` (optional)
- `REFRESH_CRON` (optional)

## Notes

- The current cache is in-memory, which is fine for a first deployment but not ideal for multi-instance scaling.
- For now, the iOS app can keep using local notifications. Real push notifications would require APNs setup and a device token registration flow.
