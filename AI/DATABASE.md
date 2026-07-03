# Nexplay eSports: Firestore Database Schemas & Relations

This document details the database architecture, schema properties, relational integrity, and index designs of the Nexplay Firestore collections.

---

## 🗄️ FIRESTORE COLLECTION MAP

The platform operates on **16 top-level collections**, coordinating tournaments, match participants, financial ledger balances, security audits, and global platform assets.

```
       [users] (Gamer & Org Profiles)
          │
          ├──────────────┬──────────────┐
          ▼              ▼              ▼
    [tournaments]  [participants]  [transactions]
          │              │              │
          ▼              ▼              ▼
   [notifications]   [follows]   [tournamentEarnings]
```

---

## 📋 DETAILED COLLECTION SCHEMAS

### 1. `users`
Tracks individual gamers, organizers, and administrators.
*   **Path**: `/users/{userId}`
*   **Properties**:
    *   `uid`: `string` (Matches Firebase Auth UID)
    *   `email`: `string`
    *   `username`: `string`
    *   `role`: `'user' | 'organizer' | 'admin'`
    *   `balance`: `number` (Current wallet balance in USD)
    *   `discordId`: `string` (Optional Discord profile)
    *   `createdAt`: `timestamp`
    *   `updatedAt`: `timestamp`

### 2. `tournaments`
Stores the central configuration and lifecycle stages for all competitive gaming brackets.
*   **Path**: `/tournaments/{tournamentId}`
*   **Properties**:
    *   `id`: `string` (Document ID)
    *   `title`: `string`
    *   `gameId`: `string` (Foreign key to `games`)
    *   `gameName`: `string`
    *   `entryFee`: `number`
    *   `prizePool`: `number`
    *   `slots`: `number` (Max participants limit)
    *   `status`: `'upcoming' | 'ongoing' | 'completed' | 'cancelled'`
    *   `hostUid`: `string` (Foreign key to `users` representing the host Organizer)
    *   `hostName`: `string`
    *   `bannerUrl`: `string` (URL to banner asset)
    *   `rules`: `string` (Markdown text instructions)
    *   `createdAt`: `timestamp`

### 3. `participants`
Tracks gamer registrations and roster positions within individual tournaments.
*   **Path**: `/participants/{participantId}`
*   **Properties**:
    *   `id`: `string`
    *   `tournamentId`: `string` (Foreign key to `tournaments`)
    *   `userId`: `string` (Foreign key to `users`)
    *   `username`: `string`
    *   `discordId`: `string`
    *   `joinedAt`: `timestamp`
    *   `status`: `'registered' | 'checked_in' | 'disqualified'`

### 4. `transactions`
Double-entry safe ledger logging deposits, entry fee payments, and prize pool distributions.
*   **Path**: `/transactions/{transactionId}`
*   **Properties**:
    *   `id`: `string`
    *   `userId`: `string` (Foreign key to `users`)
    *   `username`: `string`
    *   `amount`: `number` (Positive for deposit/earnings, negative for withdrawal/fees)
    *   `type`: `'deposit' | 'withdrawal' | 'entry_fee' | 'prize_win'`
    *   `status`: `'pending' | 'completed' | 'failed'`
    *   `method`: `string` (Payment gateway details)
    *   `timestamp`: `timestamp`

### 5. `notifications`
Direct messaging and real-time event reminders pushed to gamer streams.
*   **Path**: `/notifications/{notificationId}`
*   **Properties**:
    *   `id`: `string`
    *   `userId`: `string` (Foreign key to `users`)
    *   `title`: `string`
    *   `message`: `string`
    *   `type`: `'system' | 'tournament' | 'wallet'`
    *   `read`: `boolean`
    *   `createdAt`: `timestamp`

### 6. `media`
Registers physical assets uploaded to Cloudinary or default storage.
*   **Path**: `/media/{mediaId}`
*   **Properties**:
    *   `id`: `string`
    *   `url`: `string` (Cloudinary dynamic transformation URL)
    *   `publicId`: `string` (Cloudinary deletion identifier)
    *   `category`: `'banner' | 'profile' | 'results' | 'general'`
    *   `userId`: `string` (Foreign key to `users`)
    *   `createdAt`: `timestamp`

---

## 🛠️ REQUIRED COMPOUND INDEXES

To support composite filtering without Firestore exceptions, the following compound indexes are defined:

1.  **Collection**: `transactions`
    *   `userId` ASC, `timestamp` DESC
2.  **Collection**: `participants`
    *   `tournamentId` ASC, `joinedAt` DESC
3.  **Collection**: `notifications`
    *   `userId` ASC, `read` ASC, `createdAt` DESC
