<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/26f2d1e6-0f23-429d-bff6-19f4e58cf589

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Preview The Built App

1. Build the app:
   `npm run build`
2. Run preview server:
   `npm run preview`
3. Open the URL shown in terminal (default is usually `http://127.0.0.1:4173`).

## Seed Demo Data

This project includes a Firestore demo seeding utility at `tools/seed-demo.ts`.

1. Ensure `firebase-applet-config.json` has valid project details.
2. Run:
   `npm run seed:demo`
3. The script upserts sample documents for:
   - `users`
   - `games`
   - `slides`
   - `tournaments`

Seed IDs created/updated include:
- `demo-slide-1`
- `demo-tournament-upcoming`
- `demo-tournament-completed`
- `free-fire`
- `pubg-mobile`

## Deploy To Firebase Hosting

1. Install Firebase CLI (if not installed yet):
   `npm install -g firebase-tools`
2. Login:
   `firebase login`
3. Select project:
   `firebase use <your-project-id>`
4. Deploy hosting:
   `npm run deploy:hosting`
5. Deploy Firestore rules when needed:
   `npm run deploy:firestore-rules`
