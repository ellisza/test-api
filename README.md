### Reviz Auth API (NestJS)

- Endpoints:
  - GET `/auth/tiktok` → exchanges `code` for tokens, fetches TikTok user, creates Firebase Custom Token, redirects to `reviz://tikTok_auth/<token>`
  - GET `/auth/connect/tiktok` → verifies `state` as Firebase ID token, links TikTok to that user, redirects to `reviz://tiktok_connected`

- Env:
  - `PUBLIC_APP_SCHEME` (default: `reviz`)
  - `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (escape newlines as `\n`)

- Redirect URIs expected by TikTok (Vercel):
  - `https://registry.stg.reviz.dev/api/auth/tiktok`
  - `https://registry.stg.reviz.dev/api/auth/connect/tiktok`

- Deploy on Vercel
  - Ensure `vercel.json` exists and maps `/api/*` to the Nest handler.
  - Set env vars in Vercel Project: `PUBLIC_APP_SCHEME`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `FIREBASE_*`.
  - Build command: `npm run build` (default OK). Output: uses serverless function at `api/index.ts`.

- Run locally:
  ```bash
  cp .env.example .env
  npm install
  npm run start:dev
  ```

