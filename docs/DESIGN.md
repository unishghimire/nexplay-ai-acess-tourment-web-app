# NexPlay Design System and UX Guide

**Status:** implementation-derived baseline
**Source of truth:** current source in `src/`, especially `src/index.css`, shared components, and feature views
**Purpose:** preserve NexPlay's established visual language and interaction model. This document does not authorize a redesign.

## 1. Design principles

NexPlay presents competitive esports activity as focused, premium, and operationally clear. The existing interface uses a dark game-night foundation, violet accents, prominent data, rounded panels, and dense but readable controls.

All additions must follow these principles:

1. **Competition first:** tournament status, capacity, fee/prize, schedules, results, and operational controls must be easy to scan.
2. **Dark, high-contrast surfaces:** retain the slate/black base with white foreground text and violet primary action accent.
3. **Hierarchy over decoration:** pages use large uppercase titles, descriptive supporting copy, cards, status badges, and structured sections.
4. **Responsive by default:** controls must remain reachable on small phones without horizontal overflow.
5. **Feedback is visible:** loading, confirmation, validation, failure, empty, and destructive states must use the existing patterns.
6. **Reuse before creation:** use shared Navbar, Footer, Modal, toast, image, breadcrumb, button, and card patterns before adding alternatives.

## 2. Brand and visual tokens

### Colour palette

The tokens declared in `src/index.css` are the default palette.

| Token / role | Value / usage |
|---|---|
| Application background | `#0b1120` |
| `dark` | `#0f172a`; page/nav/footer surface |
| `card` | `#1e293b`; main card surface |
| `surface` | `#334155`; elevated/modal/header surface |
| `brand-500` | `#8b5cf6`; primary action, active state, focus ring |
| `brand-600` | `#7c3aed`; primary hover/deeper accent |
| `brand-900` | `#4c1d95`; subtle violet backgrounds |
| Success | existing green variants (`green-500`, green-tinted cards/toasts) |
| Warning | existing yellow variants |
| Error/destructive | existing red variants |
| Metadata/secondary text | `gray-400` to `gray-500` |
| Borders | `gray-800` normally; `gray-700` in modal surfaces |

Use semantic intent rather than inventing a competing palette: violet for primary/selected state, green for success/active positive conditions, yellow for pending/warning, red for destructive/error/live emphasis where existing pages do so.

### Typography

- Base body font: system sans (`system-ui`, `-apple-system`, Segoe UI, Roboto, sans-serif).
- Display headings: white, `font-black`, often uppercase and tight tracking (`tracking-tighter` / `tracking-widest`).
- Section labels and metadata: small uppercase, strong weight, wide tracking, generally gray.
- Body/support text: gray (`text-gray-400` / `text-gray-500`) with `font-bold` or medium weight.
- Numbers, currency, status counts and leaderboard rank receive high visual weight; do not obscure them behind ornamental copy.

Avoid adding a new font family, serif heading treatment, or low-contrast body style without a separately approved design change.

### Shape, elevation, and texture

- Standard content panels use `rounded-2xl` or `rounded-3xl`; primary hero/large panels may use `rounded-[2rem]`.
- Pills use `rounded-full`, particularly navigation, status controls, primary calls-to-action, and compact filters.
- Cards use `border border-gray-800`; prominent cards use a modest `shadow-2xl` or violet-tinted primary-action shadow.
- Glass effects use dark translucent surfaces and `backdrop-blur` (for example navbar and notice bar), not light frosted panels.
- The existing `neon-text` utility is a subtle violet glow; use it sparingly for brand/emphasis, not normal body copy.

## 3. Layout rules

### Application shell

The protected global shell in `App.tsx` has this order:

1. Sticky main navbar.
2. Optional site-wide notice.
3. Breadcrumbs and scroll reset.
4. Main container (`container mx-auto px-4`) with non-home back action.
5. Footer.

Do not duplicate headers, footers, global navigation, or main content containers inside new pages. New routed views should render inside this shell.

### Containers and spacing

- Public pages generally use `max-w-5xl`, `max-w-6xl`, or `max-w-7xl` centered containers.
- Standard page padding begins at `p-4`; wider layouts increase at `md` and `xl`.
- Page headers commonly have `mb-12`, a gray bottom border, and `pb-8`/`pb-10`.
- Cards normally use `gap-4`, `gap-6`, or `gap-8`; avoid arbitrary compact spacing that compromises touch/scanability.
- Use the existing `break-anywhere` class or Tailwind text wrapping for unbounded usernames, team names, URLs, and in-game IDs.

### Responsive breakpoints

| Breakpoint | Existing behavior to preserve |
|---|---|
| Base | Single-column layouts, stacked controls, mobile menu, full-width/bottom-sheet modal behavior |
| `sm` | Wider horizontal controls, two-column grids where suitable, inset modal and increased spacing |
| `md` | Desktop-oriented header rows, admin sidebar available, richer grids |
| `lg` | Desktop navbar links become visible; mobile menu toggle is hidden; larger content grids |
| `xl` | Wider grid/spacing refinements only |

The global document blocks horizontal overflow, supplies notched-device safe-area helpers, and includes a mobile `responsive-table` presentation below 640px. Use that class for data tables that must work on phones.

## 4. Navigation

### Main navbar

- It is sticky, dark/translucent, blurred, and bordered at the bottom.
- Desktop primary links: Home, Games, Organizations.
- Mobile retains those links plus the secondary Explore list: Tournaments, Scrims, Teams, Leaderboard, News.
- Active routes use a violet filled pill on desktop and violet-tinted mobile treatment.
- Logged-in desktop state includes notifications, wallet balance, and profile dropdown; logged-out state offers the violet Login call-to-action.
- Mobile menu opens from an icon button with `aria-label` and `aria-expanded`, and closes on route navigation.

Do not add every route to the desktop primary navbar. The existing hierarchy intentionally keeps the primary desktop navigation concise.

### Footer

The footer is a four-column responsive dark grid with brand description and Compete, Community, and Company link groups, followed by email and WhatsApp contact links. Preserve its navigation structure and legal links.

### Breadcrumbs and back behavior

Non-home routes include existing breadcrumbs and an explicit back action. Route-specific tabs are not a replacement for global route navigation.

## 5. Core components and interaction patterns

### Buttons

| Button role | Existing treatment |
|---|---|
| Primary action | Violet `brand-500`, white bold uppercase/letter-spaced text, rounded-full or rounded 2xl/3xl depending on context, hover to `brand-600`/brand accent shadow |
| Secondary action | Dark/card/surface background, gray border, white text, hover surface change |
| Destructive action | Red text or red-tinted background; confirmation required when action is material |
| Compact tab/filter | Pill button; active uses violet fill, inactive uses gray text and subtle hover |
| Icon action | Lucide icon with accessible label; retain 44px `touch-target` minimum where actionable |

Disable any button while its network mutation is running when duplicate submission could create duplicate records, payments, invites, or results.

### Inputs, selects, and textareas

- Dark/black input surface with gray border and white text.
- Violet border/ring when focus-visible.
- Large fields use rounded 2xl and practical internal padding.
- Search fields put a muted icon at the leading edge.
- Each input needs a visible label or an accurate `aria-label` when the visual context supplies its label.
- Put validation message close to the field and keep user input after validation/network failure.

### Cards, lists, and tables

- Cards use dark/card backgrounds, gray border, rounded corners, and clear internal zones for title, metadata, stats, actions, and status.
- Catalogue cards are placed in responsive grids (`grid-cols-1`, then multi-column at `sm`, `lg`, or `xl`).
- Filter/search areas are generally a separate card/panel above the catalogue.
- Tables that use `responsive-table` hide headers and present each row as a labeled mobile card at 640px and below.
- Long data must wrap rather than expand layout.

### Tabs and sidebars

Tabs are the existing navigation pattern within large detail/management pages:

- Tournament detail: Overview, Description, Players, Roadmap, Match Groups, and conditional Results/Kill Rewards.
- Tournament admin: Overview, Groups & Teams, Match Schedule, Brackets, Settings, Registrations.
- Organizer console: Overview, Tournaments, Scrims Hub, Match Rooms, Teams & Rosters, Wallet & Payouts, Settings & Stream.
- Admin console: responsive sidebar grouped as Main, Financial, Organizations, Management, System.

Use existing active violet treatments, preserve the current tab names/order, and avoid turning a tabbed workflow into a new route hierarchy unless explicitly required.

### Modal

Use `src/shared/components/Modal.tsx` for ordinary dialogs. It provides:

- Focus moved to the first actionable item on open.
- Tab trapping, Escape close, backdrop close, scroll lock, focus restoration, and automatic close on route change.
- `role="dialog"`, `aria-modal`, optional labelled title.
- Full-width, bottom-aligned/sheet-like behavior on small screens; bounded inset panel on larger screens.

Use a clear title and close control. Destructive modals should state the consequence and use explicit cancel/confirm actions.

### Toasts and alerts

Use the existing toast system for completed action feedback:

- success: green and polite live region;
- error: red and assertive live region;
- info: slate/violet and polite live region.

Toasts auto-close after four seconds and have an accessible close control. Do not report a mutation as successful until the server/Firestore call succeeds.

### Loading, empty, and failure states

- Route and feature loading use violet spinner patterns, often with concise uppercase loading labels.
- Catalogue skeletons use dark card-shaped `animate-pulse` blocks.
- Empty states use a relevant Lucide icon, concise title, explanatory text, and a filter reset/action when appropriate.
- User-facing operation failures use toast/inline feedback, not a console-only error.

## 6. Page-level design contracts

| Area | Visual and behavioral contract |
|---|---|
| Home | High-impact discovery/marketing page with promotional slider, games, live/upcoming event cards and clear pathways into competition. |
| Games / tournaments / scrims | Header plus descriptive copy, compact search/filter panel, responsive catalogue grid, stat/status badges, loading and empty states. |
| Tournament detail | Strong hero/event identity, high-value stats (pool, fee, capacity, mode), tabbed event data, live status/registration action, detail cards, only authorized room credentials. |
| Results / leaderboard | Ranked scans: prominent winner/featured content, high-contrast rank/stat rows/cards, clear sort/filter controls where implemented. |
| Teams / organizations / profiles | Identity-led banner/avatar surfaces, public stats, relationship/action controls, responsive roster/post/history content. |
| Wallet | Balance as primary visual datum; distinct deposit/withdraw/promo actions; transaction history and dispute controls must be operationally clear. |
| Dashboard | Personal event focus: joined/hosted events and result-related actions; account/competition information comes before decorative content. |
| Organizer / admin | Dense operational workspace with mobile collapsible sidebar or compact tab controls; tables/actions remain readable and reach 44px touch target minimum. |

## 7. Motion and media

- Use existing transitions (`transition-all`, 200–300ms control changes) and small hover transforms for interactive cards/actions.
- Existing animations include spinner, shimmer, toast slide-in, modal/mobile slide-up, and slider fade. New animation should explain state change, not delay a user action.
- Use `SmartImage`/existing image upload/media services rather than new unoptimized image paths.
- Images must have meaningful `alt` text unless decorative. Lazy-load non-critical images; logo/critical brand image can remain eager as current navbar does.
- Preserve deterministic/fallback image behavior where existing features use it; do not represent a generated placeholder as user-provided image content.

## 8. Accessibility requirements

1. Preserve the global focus-visible ring on buttons/links and focus treatment on inputs.
2. Use semantic `nav`, `main`, `header`, `footer`, heading order, labelled controls, and real buttons for actions.
3. Every icon-only control needs an `aria-label`; decorative icons should be hidden from assistive technology.
4. Retain modal focus management and test keyboard-only open, close, tab loop, and focus restoration.
5. Convey status by wording/icon as well as color; use adequate contrast against dark surfaces.
6. Maintain the 44px minimum touch target utility for small controls.
7. Ensure tabs, dropdowns, mobile menu state, async validation, toasts, and loading states expose meaningful accessible state.

## 9. Do and do not

### Do

- Use the existing violet/dark palette, rounded card/pill system, and responsive grids.
- Build from the shared modal, notification, navigation, image, and layout primitives.
- Keep operational data, status, and primary actions visually prominent.
- Test mobile, keyboard, long-content, loading, empty, and error states.

### Do not

- Introduce a light theme, a second brand colour system, new global typography, or a separate navigation model.
- Replace nested console/tournament tabs with a brand-new dashboard information architecture.
- Add hover-only actions or icon-only buttons without accessible names.
- Use color alone for event/payment/approval status.
- Allow wide grids, tables, images, or long IDs to create horizontal overflow.

## 10. Implementation references

- Global tokens and responsive helpers: `src/index.css`
- App shell and route layout: `src/App.tsx`
- Navigation/footer: `src/shared/components/Navbar.tsx`, `src/shared/components/navbar/MobileMenu.tsx`, `src/shared/components/Footer.tsx`
- Dialog feedback: `src/shared/components/Modal.tsx`, `src/shared/components/Toast.tsx`, `src/shared/components/ConfirmModal.tsx`
- Page and management patterns: `src/features/**/views`, `src/features/**/components`
