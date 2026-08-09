# Tournament Lifecycle Skill

Use this skill when working on tournament state management.

## Requirements
- Manage tournament states: draft, open, in-progress, completed, cancelled.
- Ensure state transitions follow allowed paths and validation rules.
- Trigger lifecycle events like round generation and prize payouts.

## Checks
- Verify state transition guard clauses prevent invalid state jumps.
- Test event listeners responding to state transitions.
- Ensure state changes are broadcast in real-time to active clients.
