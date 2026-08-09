# Firestore Cost Skill

Use this skill when optimizing Firestore costs.

## Requirements
- Minimize unnecessary document reads, writes, and deletes.
- Implement client-side or server-side caching strategies.
- Structure queries to leverage compound indexes efficiently.

## Checks
- Monitor read/write operations per user action.
- Verify queries utilize `limit()` and field masks where appropriate.
- Check listener unsubscribe cleanups in frontend components.
