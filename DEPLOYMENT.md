# NexPlay Production Deployment Checklist

## Pre-Deployment

### Environment Variables (.env)
- [ ] `JWT_SECRET` — generate a strong 64+ char random string
- [ ] `GEMINI_API_KEY` — Google AI Studio API key
- [ ] `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name
- [ ] `CLOUDINARY_API_KEY` — Cloudinary API key
- [ ] `CLOUDINARY_API_SECRET` — Cloudinary API secret
- [ ] `DISCORD_WEBHOOK_TOURNAMENTS` — Discord webhook URL (optional)
- [ ] `DISCORD_WEBHOOK_SCRIMS` — Discord webhook URL (optional)

### Firestore Rules
- [ ] Deploy updated rules: `npm run deploy:firestore-rules`
- [ ] Verify `tournamentEarnings` is NOT public read
- [ ] Verify `team_activity` requires auth

### Firestore Indexes
- [ ] Deploy composite indexes: `npm run deploy:indexes`
- [ ] Verify indexes are building in Firebase Console (may take a few minutes)

### Custom Claims Migration
- [ ] Run `node scripts/migrate-custom-claims.js` (requires `GOOGLE_APPLICATION_CREDENTIALS`)
- [ ] Verify admins/organizers have custom claims set
- [ ] Test that `authenticateToken` reads role from claims (not Firestore fallback)

### Build
- [ ] `npm run lint` — 0 TypeScript errors
- [ ] `npm run build` — Vite build succeeds
- [ ] Check bundle sizes in build output

## Deployment Steps

1. **Deploy Firestore rules:**
   ```bash
   npm run deploy:firestore-rules
   ```

2. **Deploy Firestore indexes:**
   ```bash
   npm run deploy:indexes
   ```

3. **Deploy hosting (frontend only):**
   ```bash
   npm run deploy:hosting
   ```

4. **Start the API server:**
   ```bash
   npm start  # NODE_ENV=production tsx server.ts
   ```
   Or use a process manager:
   ```bash
   pm2 start "NODE_ENV=production tsx server.ts" --name nexplay-api
   ```

5. **Run the custom claims migration:**
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json node scripts/migrate-custom-claims.js
   ```

## Post-Deployment Verification

- [ ] User registration works (creates Firestore doc + Firebase Auth user)
- [ ] User login works (JWT issued, role in token)
- [ ] Rate limiting: 5 register attempts / 15 min → 429 response
- [ ] Rate limiting: 10 login attempts / 15 min → 429 response
- [ ] Admin can update user roles (Firestore + custom claims synced)
- [ ] Organizer can upload results only to their own tournaments
- [ ] Organizer can advance rounds only on their own tournaments
- [ ] AI audit endpoints require authentication
- [ ] `tournamentEarnings` collection NOT publicly readable
- [ ] `team_activity` collection requires authentication

## Security Notes

- Firebase API key in `firebase-applet-config.json` is public by design — security comes from Firestore Rules
- JWT_SECRET must be kept secret — never commit to git
- Rate limiter is in-memory (single-instance only) — for multi-instance, use Redis-backed limiter
- Custom claims are cached by Firebase SDK for ~1 hour — role changes may take up to 1 hour to propagate
- The `authenticateToken` middleware has a Firestore fallback for migration — remove it once all users have custom claims
