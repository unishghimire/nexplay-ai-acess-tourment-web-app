# STATE & CONTEXT SLICES MAP

This document catalogs the state management layers, React Context providers, and global Zustand stores coordinating session metadata and real-time dashboard configs.

---

## 👥 CLIENT CONTEXT PROVIDERS (`src/context/`)

### `AuthContext`
*   **Purpose**: Main user identity broker. Coordinates Firebase Authentication session listener bindings (`onAuthStateChanged`). Reads role claims from the Firestore `users` database table, managing authorization for protected views.
*   **Key State**:
    *   `user`: Current Firebase user metadata object or null.
    *   `userProfile`: Custom Firestore-aligned gamer/organizer document.
    *   `loading`: Session initialization flags.

### `NotificationContext`
*   **Purpose**: Live alerts subscriber. Sets up dynamic Firestore snapshot subscriptions (`onSnapshot`) listening for custom notifications targeting the active logged-in gamer.
*   **Key State**:
    *   `notifications`: Array of active alert logs.
    *   `unreadCount`: Quick badge count indicator for Navbar alerts.

### `SiteSettingsContext`
*   **Purpose**: Platform-wide feature gates and theme controls. Retrieves active maintenance schedules, tournament freeze boundaries, and administrative toggles.

---

## 📈 GLOBAL ZUSTAND STORES (`src/hooks/`)

### `useOverlayStore`
*   **Purpose**: State manager for OBS Live HUD Overlays (`OverlayLive.tsx`). Controls visual scene triggers, select dynamic matches, and widget overlays visible on live-stream cards.
*   **Key State**:
    *   `activeScene`: `'waiting' | 'standings' | 'match_result' | 'current_match' | 'bracket'`
    *   `selectedGroupId`: Focus identifier for custom bracket lists.
    *   `selectedMatchId`: Focus identifier for dynamic score updates.
    *   `isVisible`: Global scene opacity toggle.
*   **Actions**:
    *   `setScene(scene)`
    *   `setGroup(groupId)`
    *   `setMatch(matchId)`
    *   `toggleVisibility()`
    *   `reset()`
