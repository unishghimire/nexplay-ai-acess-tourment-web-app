# FILE INDEX: REPOSITORY REGISTRY MAP

This registry catalogs every key file inside the Nexplay codebase, summarizing its purpose, primary imports, exports, and subsystem dependencies.

---

## 📂 FRONTEND ENTRY & CONFIGURATION

### `src/main.tsx`
*   **Purpose**: Bootstraps the React application by binding the DOM element (`#root`) to the React 19 root renderer.
*   **Key Imports**: `react`, `react-dom/client`, `App.tsx`, `index.css`
*   **Key Exports**: None (Application root entry point)

### `src/App.tsx`
*   **Purpose**: Primary Routing and Global Provider Shell. Configures React Router routes, route protection, lazy-loaded page chunks, and context initializers.
*   **Key Imports**: `react-router-dom`, `AuthContext`, `SiteSettingsContext`, `NotificationContext`
*   **Key Exports**: `App` component

### `src/firebase.ts`
*   **Purpose**: Initializes and exposes client-side Firebase SDK services.
*   **Key Imports**: `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/analytics`
*   **Key Exports**: `app`, `auth`, `db`, `analytics`

### `src/types.ts`
*   **Purpose**: Centralized TypeScript definition store for the entire project. Maps out interfaces for Users, Tournaments, Teams, Match Scores, and Media Records.
*   **Key Imports**: None
*   **Key Exports**: `User`, `Tournament`, `Team`, `MediaRecord`, `Game`, `Match`

### `src/constants.ts`
*   **Purpose**: Global constants, preset placeholder graphics, and default configurations.
*   **Key Imports**: None
*   **Key Exports**: `DEFAULT_BANNER`, `NEXPLAY_LOGO`, `PRESET_TOURNAMENT_BANNERS`

---

## 📦 COMPONENT REGISTRY (`src/components/`)

### `src/components/ImageUploader.tsx`
*   **Purpose**: Universal Drag-and-Drop Image Uploader. Styled using Tailwind utility classes and animated with Framer Motion. Handles size validations (10MB limit) and file format warnings.
*   **Key Imports**: `lucide-react`, `mediaService.ts`
*   **Key Exports**: `ImageUploader` component
*   **Depends on**: `src/services/mediaService.ts`

### `src/components/ConfirmModal.tsx`
*   **Purpose**: Reusable confirmation popover supporting destructive action styling.
*   **Key Imports**: `lucide-react`, `motion/react`
*   **Key Exports**: `ConfirmModal` component

---

## 📂 VIEW REGISTRY (`src/views/`)

### `src/views/AdminPanel.tsx`
*   **Purpose**: High-fidelity central administrator control deck. Coordinates user roles, matches management, game presets, and the Media Library console.
*   **Key Imports**: `lucide-react`, `mediaService.ts`, `ConfirmModal.tsx`
*   **Key Exports**: `AdminPanel` component (Lazy loaded)
*   **Depends on**: `src/services/mediaService.ts`

### `src/views/TournamentCreateModal.tsx`
*   **Purpose**: Guided multi-step creation overlay for creating tourneys.
*   **Key Imports**: `mediaService.ts`, `ImageUploader.tsx`
*   **Key Exports**: `TournamentCreateModal` component

### `src/views/TournamentDetails.tsx`
*   **Purpose**: Detailed showcase of active/historic tournaments, brackets, and participant profiles.
*   **Key Imports**: `firebase/firestore`, `lucide-react`
*   **Key Exports**: `TournamentDetails` component

---

## ⚙️ CORE SERVICES (`src/services/`)

### `src/services/mediaService.ts`
*   **Purpose**: Client-side media upload proxy. Connects client uploads directly to the Node proxy endpoints, enforces client validation constraints, and persists uploaded media assets into Firestore's standard catalogs.
*   **Key Imports**: `firebase/auth`, `firebase/firestore`
*   **Key Exports**: `MediaCategory` enum, `uploadImage`, `deleteImage`, `replaceImage`, `validateImage`
*   **Depends on**: `/api/upload/image`, `/api/media/delete`

### `src/services/NotificationService.ts`
*   **Purpose**: Dispatches push-like alerts, registration reminders, and results declarations to user feeds.
*   **Key Imports**: `firebase/firestore`
*   **Key Exports**: `sendNotification`, `markNotificationAsRead`

---

## 🧠 CORE CONTEXT PROVIDERS (`src/context/`)

### `src/context/AuthContext.tsx`
*   **Purpose**: Manages global session state and profile roles.
*   **Key Imports**: `firebase/auth`
*   **Key Exports**: `AuthContext`, `AuthProvider`, `useAuth`

### `src/context/NotificationContext.tsx`
*   **Purpose**: Pulls real-time alerts from the database.
*   **Key Imports**: `firebase/firestore`, `AuthContext`
*   **Key Exports**: `NotificationContext`, `NotificationProvider`
