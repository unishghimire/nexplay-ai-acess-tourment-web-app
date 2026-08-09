# Payment Idempotency Skill

Use this skill when implementing payment idempotency.

## Requirements
- Use unique idempotency keys for all payment transactions.
- Store key status and cash execution results to prevent duplicate charges.
- Handle network retry logic cleanly without duplicated side effects.

## Checks
- Verify repeated requests with the same key produce identical responses.
- Test concurrent request races with identical idempotency keys.
- Ensure idempotency records have appropriate expiration times.
