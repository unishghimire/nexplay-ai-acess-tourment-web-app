# ROUTES SYSTEM MAP: NAVIGATION & ACCESS CONTROLS

This file logs all application routing paths, layout hierarchies, dynamic URL parameters, and security guards within the Nexplay platform.

---

## 🚦 ROUTING PATTERNS

The client leverages **React Router v6** (`react-router-dom`) inside `src/App.tsx` to handle client-side view changes.

*   **Public Routes**: Open to all users (anonymous or logged-in).
*   **Protected User Routes**: Require a valid active Firebase Authentication session. Unauthenticated users are redirected to `/login`.
*   **Role-Restricted Protected Routes**: Require specific claims or roles (e.g., `ADMIN` or `ORGANIZER`) checked via the Auth Context session metadata.

---

## 🗺️ FRONTEND CLIENT ROUTE MAP

| Route Path | View Component | Access Control | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `Home.tsx` | Public | Platform Landing Page, Hot Promotions, Active Tournaments |
| `/login` | `Login.tsx` | Anonymous Only | Secure User Authentication Entrance |
| `/register` | `Register.tsx` | Anonymous Only | Secure New Account Registration |
| `/about` | `About.tsx` | Public | About Nexplay, core mission, and features |
| `/contact` | `Contact.tsx` | Public | Help Desk support forms and links |
| `/privacy` | `Privacy.tsx` | Public | Platform Privacy Policies |
| `/terms` | `Terms.tsx` | Public | Rules of Conduct, anti-cheat, wallet policies |
| `/complete-profile`| `CompleteProfile.tsx`| Authenticated | Required profile completion setup wizard |
| `/dashboard` | `Dashboard.tsx` | Authenticated | Player dashboard (Matches, scrims, user statistics) |
| `/profile` | `Profile.tsx` | Authenticated | Personal user profile management, security settings |
| `/profile/:uid` | `PublicProfile.tsx` | Public | Publicly viewable gamer/organizer resumes |
| `/teams` | `Teams.tsx` | Public | Team Directory (Search, join, or register squads) |
| `/teams/:id` | `TeamDetails.tsx` | Public | Detail profile of a team, roster, and statistics |
| `/tournaments` | `Tournaments.tsx` | Public | Tournament listing grid with advanced filter controls |
| `/tournaments/:id` | `TournamentDetails.tsx`| Public | Single Tourney view, bracket details, and leaderboard |
| `/scrims` | `Scrims.tsx` | Public | Scrim matcher list and public custom challenges lobby |
| `/leaderboard` | `Leaderboard.tsx` | Public | Top gamers, win percentages, and earning boards |
| `/results` | `Results.tsx` | Public | Completed tournament podium details & match logs |
| `/admin` | `AdminPanel.tsx` | Role: `ADMIN` | Administrative suite, Media catalog, and core configuration |
| `/organizer` | `OrganizerPanel.tsx`| Role: `ORGANIZER`| Organizer control console for creating & managing tourneys |
| `/tournament-admin/:id`| `TournamentAdminPanel.tsx`| Authenticated | Specialized bracket controller for individual tournament nodes |
| `/overlay/live/:id`| `OverlayLive.tsx` | Public | Specialized HUD overlay for live-streams, OBS integration |

---

## 🔒 ROUTE GUARDS & WRAPPERS

The following higher-order route protection wrappers are declared in `/src/components/ProtectedRoute.tsx`:

1.  **`ProtectedRoute`**: Verifies that `user` in `AuthContext` is not null. Also supports optional `allowedRoles` arrays (e.g., `['ADMIN']`) to isolate administrator interfaces.
2.  **`ProfileCompletionGuard`**: Injects checking rules to make sure new players have completed their mandatory profiles (`username`, `discordId`) before granting access to critical tournament registration overlays.
