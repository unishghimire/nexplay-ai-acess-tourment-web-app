# Payment Verification Skill

Use this skill when implementing payment verification.

## Requirements
- Verify gateway signatures and payment status payload integrity.
- Prevent spoofed or duplicate payment verification requests.
- Reconcile external payment receipts with internal records.

## Checks
- Test signature validation logic with valid and invalid signatures.
- Verify payment state changes only occur upon successful verification.
- Ensure failed verification attempts are logged and flagged.
