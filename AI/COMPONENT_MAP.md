# UI COMPONENT MAP: WIDGET & PRESENTATION CATALOG

This catalog indexes the reusable, atomic UI components, layout structures, and overlay models implemented across the Nexplay platform.

---

## 🏗️ LAYOUT & WRAPPER COMPONENTS

### `Navbar` & `Footer`
*   **Location**: `src/components/Navbar.tsx`, `src/components/Footer.tsx`
*   **Purpose**: Global header/footer. Controls the main nav layout, user dropdown indicators, role panels routing, real-time alert notifications dropdown, and responsive mobile drawers.

### `ErrorBoundary`
*   **Location**: `src/components/ErrorBoundary.tsx`
*   **Purpose**: Catch-all boundary component. Intercepts layout and component crashes, presents graceful diagnostic outputs, and allows easy user session recovery.

---

## 🖼️ INPUT & MEDIA WIDGETS

### `ImageUploader`
*   **Location**: `src/components/ImageUploader.tsx`
*   **Purpose**: Fully interactive, stylized drag-and-drop file interface. Integrates validation feedback limits (10MB format constraints) and live upload progression graphs, returning verified CDN reference strings to parent wrappers.

---

## 💳 TRANSACTIONAL OVERLAYS (MODALS)

### `WalletModal`
*   **Location**: `src/components/WalletModal.tsx`
*   **Purpose**: Immersive payment gateway mimicking credits checkout. Handles mock deposits, real-time balance queries, voucher codes processing, and instant wallet ledger modifications.

### `TournamentCreateModal`
*   **Location**: `src/components/TournamentCreateModal.tsx`
*   **Purpose**: Standardizer form coordinating tournament templates. Guides hosts in drafting brackets, setting custom entry/prize ratios, and selecting promotional banners.

### `JoinTournamentModal` & `RegistrationModal`
*   **Location**: `src/components/JoinTournamentModal.tsx`, `src/components/RegistrationModal.tsx`
*   **Purpose**: Player sign-up workflows. Evaluates and blocks requests if user balances are insufficient, deducting entry fees and writing registered gamers into matching tournament collections.

---

## 📊 GAME & BRACKET MANAGEMENT

### `ResultUploader` & `ResultUploadModal`
*   **Location**: `src/components/ResultUploader.tsx`, `src/components/ResultUploadModal.tsx`
*   **Purpose**: Submission node for match winners. Accepts game snapshots, automates OCR text extraction where needed, and files verified logs to administrators.

### `PrizeBoard` & `ResultBoard`
*   **Location**: `src/components/PrizeBoard.tsx`, `src/components/ResultBoard.tsx`
*   **Purpose**: Presentational components detailing leaderboard positions, prize pool percentages, and completed match records.
