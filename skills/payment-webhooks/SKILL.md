# Payment Webhooks Skill

Use this skill when handling payment webhooks.

## Requirements
- Process incoming webhook events asynchronously and reliably.
- Validate cryptographic signatures on incoming webhook payloads.
- Handle out-of-order and duplicate webhook events gracefully.

## Checks
- Verify payload validation before executing business logic.
- Check webhook status response time (return 200 OK quickly).
- Ensure idempotency key handling prevents double-processing.
