# NexPlay Repository Map

## Root
- .env.example (Environment variables template)
- .gitignore
- DRAFT_firestore.rules
- findings.md
- firebase-applet-config.json
- firebase-blueprint.json
- firebase.json
- firestore.rules
- fix_profile.cjs / .ts
- gemini.md
- index.html
- metadata.json
- package.json / package-lock.json
- progress.md
- security_spec.md
- server.ts (Backend entry)
- task_plan.md
- tsconfig.json
- vite.config.ts

## /architecture
- group_automation.md
- tournament_logic.md

## /src
- App.tsx (Main component)
- firebase.ts (Firebase config)
- index.css
- main.tsx (DOM entry)
- types.ts (Global types)

### /src/context
- AuthContext.tsx
- NotificationContext.tsx
- SiteSettingsContext.tsx

### /src/hooks
- useClickOutside.ts
- useInView.ts
- useInvisibleImage.ts
- useOverlayStore.ts

### /src/services
- NotificationService.ts

### /src/views
(List includes: About, AdminPanel, Auditor, Auth, ..., Wallet)

## /tools
- Scripts for automation: add_bots, check_48, list_tournaments, test_write, trigger_seed, trigger_seed_bulk
