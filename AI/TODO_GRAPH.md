# ROADMAP & BACKLOG (TODO GRAPH)

This backlog outlines upcoming milestones, scheduled system upgrades, and planned enhancements for the Nexplay eSports platform.

---

## ✅ COMPLETED: BRACKET & MATCHMAKING UPGRADES

### 1. Real-Time Bracket Synchronization [RESOLVED]
*   **Status**: Already implemented. `tournament.groups` and `bracketMatches` are embedded in the tournament document. `TournamentDetails` subscribes via `onSnapshot(doc(db, 'tournaments', id))` — any group/match update by the organizer propagates to all connected clients instantly. No additional work required.
*   **Resolved in**: Turn 24 audit.

### 2. Live Stream Layout Widgets [COMPLETED — Turn 25]
*   **Status**: Delivered. Full `OverlayLive.tsx` with 4 scene presets (Waiting, Standings, Match, Bracket), Zustand store, real-time Firestore listener, OBS-compatible fullscreen layout, and control panel.

---

## 🎯 NEXT UP

### 1. Automated Discord Webhook Dispatcher [Priority: Medium]
*   **Description**: Connect tournament lifecycle states to dedicated Discord channels. When an organizer launches a bracket, the system instantly publishes custom announcements detailing entry fees, prize pools, and registration links.
*   **Prerequisites**: Express server proxy middleware configured in `server.ts`.

### 2. AI-Powered Tournament Banner Creator [Priority: Low]
*   **Description**: Integrate Gemini APIs to help tournament hosts generate eye-catching graphics dynamically, applying themed overlays directly into the Cloudinary upload pipeline.
*   **Prerequisites**: `mediaService.ts` and Cloudinary proxy.
