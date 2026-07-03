# Project Constitution: Nexplay Org

## Data Schema (Payloads)

### Tournament
```json
{
  "id": "string",
  "title": "string",
  "game": "string",
  "bannerUrl": "string",
  "description": "string",
  "rules": "string",
  "type": "SINGLE_ELIMINATION | ROUND_ROBIN | GROUP_STAGE",
  "entryFee": "number",
  "prizePool": "number",
  "teamSize": "number",
  "maxTeams": "number",
  "regStart": "timestamp",
  "regEnd": "timestamp",
  "status": "DRAFT | PUBLISHED | REG_OPEN | REG_PAUSED | REG_CLOSED | ONGOING | COMPLETED | CANCELLED",
  "pointSystem": {
    "killPoints": "number",
    "placement": {
      "1": "number",
      "2": "number",
      "..." : "number"
    }
  },
  "roadmap": [
    {
      "roundId": "string",
      "name": "string",
      "teamsToQualify": "number",
      "order": "number"
    }
  ]
}
```

### Team
```json
{
  "id": "string",
  "name": "string",
  "logoUrl": "string",
  "captainId": "string",
  "members": ["userId"],
  "stats": {
    "tournamentsPlayed": "number",
    "wins": "number"
  }
}
```

### Group
```json
{
  "id": "string",
  "tournamentId": "string",
  "roundId": "string",
  "name": "string",
  "teams": ["teamId"],
  "status": "PENDING | ACTIVE | COMPLETED"
}
```

### MatchResult
```json
{
  "id": "string",
  "tournamentId": "string",
  "roundId": "string",
  "groupId": "string",
  "results": [
    {
      "teamId": "string",
      "kills": "number",
      "placement": "number",
      "bonus": "number",
      "penalty": "number"
    }
  ],
  "screenshotUrl": "string",
  "verifiedBy": "userId",
  "createdAt": "timestamp"
}
```

## Architectural Invariants
1. **Deterministic Scoring**: All points must be calculated server-side or via verified logic patterns based on the `pointSystem` field in the tournament.
2. **Atomic Progression**: Moving teams to the next round must be an atomic transaction to prevent duplication or "orphaned" writes.
3. **Role-Based Guards**: Every data operation must check roles (`Super Admin`, `Org Owner`, `Moderator`, etc.).
