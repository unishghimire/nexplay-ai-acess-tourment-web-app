# Discord Webhooks Skill

Use this skill when implementing Discord webhooks.

## Requirements
- Post real-time notifications to Discord channels for system events.
- Format rich embeds for tournament announcements and match results.
- Respect Discord rate limits with exponential backoff handling.

## Checks
- Verify payload structure matches Discord webhook API specs.
- Test rate limit handling during bulk notification sending.
- Confirm sensitive internal URLs or tokens are excluded from embeds.
