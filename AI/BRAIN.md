# NEXPLAY ENTERPRISE REFLECTION BRAIN (BRAIN.md)

This document acts as the high-fidelity reference engine for future AI coding agents, explaining the exact physical and logical routing mappings, file-by-file dependencies, and structural boundaries of the Nexplay eSports platform.

---

## 🗺️ THE ENTERPRISE MODULE SCHEMA

To achieve high scale, clean separation of concerns, and rapid parallel feature development, we propose organizing the repository into a **Feature-First Architecture**:

```
src/
├── features/               # Cohesive domain capability slices
│   ├── auth/              # Identity, Session & Complete Profile
│   ├── admin/             # Operations suite, logs, financial grids
│   ├── dashboard/         # Gamer overview, match analytics
│   ├── home/              # Hero sliders, dynamic game & org browsers
│   ├── leaderboard/       # Earnings and gamer metrics grids
│   ├── notifications/     # Dynamic context brokers & systems logs
│   ├── organizer/         # Tourney hosts control panels
│   ├── overlay/           # Live streaming overlays, OBS controls
│   ├── profile/           # Gamer resumes & settings controllers
│   ├── results/           # Post-tourney boards & OCR result uploads
│   ├── scrims/            # Lobby systems & user matchmaking
│   ├── teams/             # Squad registers & roster boards
│   ├── tournaments/       # Bracket nodes & participant registers
│   └── wallet/            # Deposits, checkout overlays, ledger balance
│
└── shared/                # Core platform reusable assets
    ├── components/        # Atomic elements (BackButtons, Modals)
    ├── hooks/             # Utility React lifecycle hooks
    ├── context/           # Platform settings & core system states
    ├── services/          # Cloudinary media engines & telemetry logs
    ├── types/             # Unified types database
    ├── constants/         # Static visual placeholders & graphic banners
    └── utils/             # Math utilities, cn handlers & string parses
```

---

## 📋 PHYSICAL COMPONENT RELATIONSHIP MAP

| Component Source Path (Original) | Proposed Target Path | Feature Owner | Direct Consumer Dependencies |
| :--- | :--- | :--- | :--- |
| `src/views/AdminPanel.tsx` | `src/features/admin/views/AdminPanel.tsx` | `admin` | `/admin` Route, `/src/App.tsx` |
| `src/components/admin/` | `src/features/admin/components/` | `admin` | `AdminPanel.tsx` |
| `src/views/Auth.tsx` | `src/features/auth/views/Auth.tsx` | `auth` | `/auth` Route, `/src/App.tsx` |
| `src/views/Login.tsx` | `src/features/auth/views/Login.tsx` | `auth` | `/login` Route |
| `src/views/Register.tsx` | `src/features/auth/views/Register.tsx` | `auth` | `/register` Route |
| `src/views/CompleteProfile.tsx` | `src/features/auth/views/CompleteProfile.tsx` | `auth` | `/complete-profile` Route |
| `src/views/Dashboard.tsx` | `src/features/dashboard/views/Dashboard.tsx` | `dashboard` | `/dashboard` Route |
| `src/components/dashboard/` | `src/features/dashboard/components/` | `dashboard` | `Dashboard.tsx` |
| `src/views/Home.tsx` | `src/features/home/views/Home.tsx` | `home` | `/` Root Route |
| `src/components/GameCard.tsx` | `src/features/home/components/GameCard.tsx` | `home` | `Home.tsx` |
| `src/views/Leaderboard.tsx` | `src/features/leaderboard/views/Leaderboard.tsx`| `leaderboard` | `/leaderboard` Route |
| `src/views/OrganizerPanel.tsx` | `src/features/organizer/views/OrganizerPanel.tsx`| `organizer` | `/organizer` Route |
| `src/views/OverlayLive.tsx` | `src/features/overlay/views/OverlayLive.tsx` | `overlay` | `/overlay/live/:id` Route |
| `src/views/Profile.tsx` | `src/features/profile/views/Profile.tsx` | `profile` | `/profile` Route |
| `src/views/PublicProfile.tsx` | `src/features/profile/views/PublicProfile.tsx` | `profile` | `/profile/:uid` Route |
| `src/views/Results.tsx` | `src/features/results/views/Results.tsx` | `results` | `/results` Route |
| `src/views/Scrims.tsx` | `src/features/scrims/views/Scrims.tsx` | `scrims` | `/scrims` Route |
| `src/views/Teams.tsx` | `src/features/teams/views/Teams.tsx` | `teams` | `/teams` Route |
| `src/views/TeamDetails.tsx` | `src/features/teams/views/TeamDetails.tsx` | `teams` | `/teams/:id` Route |
| `src/views/Tournaments.tsx` | `src/features/tournaments/views/Tournaments.tsx`| `tournaments` | `/tournaments` Route |
| `src/views/TournamentDetails.tsx` | `src/features/tournaments/views/TournamentDetails.tsx`| `tournaments` | `/tournaments/:id` Route |
| `src/views/Wallet.tsx` | `src/features/wallet/views/Wallet.tsx` | `wallet` | `/wallet` Route |

---

## 🚦 ALIASES & IMPORT RESOLUTION PATTERNS

To guarantee that moving files does not disrupt resolution engines, the platform leverages `@/` absolute mappings:

```typescript
// Proposed: Resolve shared types from standard shared database
import { User, Tournament } from '@/src/shared/types/types';

// Proposed: Resolve atomic UI components
import { ConfirmModal } from '@/src/shared/components/ConfirmModal';
```
This guarantees absolute resilience against relative path drift when nesting files deeply within the features architecture.
