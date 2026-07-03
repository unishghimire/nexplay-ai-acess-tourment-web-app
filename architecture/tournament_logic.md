# Architectural SOP: Tournament Logic & Progression

## Goal
To automate the lifecycle of an esports tournament from registration to completion without manual intervention for state transitions and teammate movement.

## States
- `DRAFT`: Local editing, not visible to public.
- `PUBLISHED`: Visible but registration not yet open.
- `REG_OPEN`: Teams can register.
- `REG_CLOSED`: Registration period over or max teams reached.
- `ONGOING`: Matches are being played.
- `COMPLETED`: Final round finished, winners declared.

## Progression Protocol
1. **Closing Registration**:
   - Triggered manually or by timer.
   - Transitions state to `REG_CLOSED`.
   - Checks if `maxTeams` reached.

2. **Generating Groups (Level 1)**:
   - Input: List of registered teams.
   - Configuration: `teamsPerGroup` (e.g., 4).
   - Action: Shuffle teams, split into chunks of `teamsPerGroup`, create `Group` documents in Firestore.

3. **Round Advancement**:
   - Triggered when all groups in current round are marked `COMPLETED`.
   - Action: 
     - Collect qualified teams from each group based on `teamsToQualify` rule.
     - Create new groups for the next round.
     - Carry over stats if necessary.

4. **Point Calculation**:
   - Formula: `Total = (Kills * kPoints) + PlacementPoints + Bonuses - Penalties`.
   - This must be done every time a result is uploaded.
