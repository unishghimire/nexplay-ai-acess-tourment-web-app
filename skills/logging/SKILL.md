# Logging Skill

Use this skill when configuring logging.

## Requirements
- Implement structured, JSON-formatted logging across application services.
- Include context metadata like request IDs, timestamps, and log levels.
- Exclude sensitive user information and credentials from log outputs.

## Checks
- Verify log output compliance with sanitization guidelines.
- Check log levels (DEBUG, INFO, WARN, ERROR) are used appropriately.
- Ensure log aggregator receives formatted logs without truncation.
