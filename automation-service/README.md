# image-to-3d-automation-service

A small Express service that drives **image-to-3d.ai** with a headless Chromium
browser (via Puppeteer) and returns the generated `.glb` file. This exists
because image-to-3d.ai has no public API — it's a browser-only playground.

## ⚠️ Before relying on this in production

I could not fully inspect the playground's live DOM through a static fetch
(it's rendered client-side). The selectors in `server.js` are best-effort
guesses based on common patterns (`input[type=file]`, buttons matching
"Convert"/"Generate"/"Download"/"Export"). **Run it locally first** with
`headless: false` in `server.js`, watch it drive the actual page, and fix any
selector that doesn't match — look for the three `TODO-VERIFY` comments.

Also worth doing before you rely on this long-term:
- Check `image-to-3d.ai`'s Terms of Service for automated/bot access.
- Expect it to break silently if they redesign the page — there's no
  contract with them like there would be with a real API.

## Local test run

```bash
npm install
node server.js
# in another terminal:
curl -X POST http://localhost:10000/convert \
  -F "image=@/path/to/isolated-subject.png" \
  -o result.glb
```

## Deploying to Render

This repo includes a `Dockerfile` (Puppeteer needs system Chromium deps that
Render's native Node runtime doesn't provide, so Docker is required).

Once pushed to a GitHub repo, deploy it as a **Docker web service** with:
- **Environment variable** `SERVICE_API_KEY` — set this to a long random
  string. The n8n workflow will send it back as the `x-api-key` header.
- Free plan works for testing; note Puppeteer + Chromium is memory-hungry,
  so bump to Starter if you see OOM kills under real load.

## API

`POST /convert` — multipart form-data, field `image` (the cropped/isolated
subject PNG). Returns the `.glb` binary on success, or `{ "error": "..." }`
with a `502` on failure.

`GET /health` — liveness check.
