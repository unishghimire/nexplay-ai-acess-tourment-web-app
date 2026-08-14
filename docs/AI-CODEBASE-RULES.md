# NexPlay Engineering Rules

1. Preserve existing navigation, visual design, and architecture unless a change is explicitly approved.
2. Reuse feature/domain services before creating a helper, component, route, or schema.
3. Treat Firestore rules and server authorization as the security boundary; client checks are only UX.
4. Keep money, capacity, identity, media ownership, private credentials, and role changes on verified server/transaction paths.
5. Validate every server request, bound external I/O, and never return secret/internal provider errors to clients.
6. Batch Firestore work in chunks of at most 450 writes; make retry behavior explicit for multi-batch operations.
7. Do not add public credential fields to tournament documents. Use `tournaments/{id}/credentials/*`.
8. Before changing a shared component, rule, route, or financial flow, identify the dependent user journeys and test them.
9. Run `pnpm run lint`, `pnpm run type-check`, `pnpm test`, `pnpm run build`, and `pnpm audit --prod --json` before release.
10. Do not push or deploy while a High/Critical audit finding or release checklist item remains unresolved.
