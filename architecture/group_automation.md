# Architectural SOP: Group Automation

## Logic
1. **Fetch Teams**: Get all approved registrations for the tournament.
2. **Shuffle**: Randomized balancing to prevent seeded clusters (unless seeding is requested).
3. **Partition**:
   - `totalTeams / teamsPerGroup` = `numberOfGroups`.
   - Distribute teams into buckets.
4. **Persist**: 
   - Batch write `Group` documents to Firestore. 
   - Path: `tournaments/{tourneyId}/rounds/{roundId}/groups/{groupId}`.
5. **Real-time Trigger**: Update UI via Firestore snapshot.
