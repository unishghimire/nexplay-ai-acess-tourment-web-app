---
applyTo: "**/*.{ts,tsx}"
---

# Security Rules

Never trust client input for authorization decisions.

Validate all user inputs server-side.

Check for XSS, CSRF, and injection vulnerabilities.

Audit Firestore rules for over-permissive access.

Never expose secrets, tokens, or credentials.

Use parameterized queries.

Sanitize all user-generated content.
