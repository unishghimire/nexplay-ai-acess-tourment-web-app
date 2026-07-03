---
name: read-instructions-first
description: "Use when you need the agent to read all workspace markdown instruction files before any other task. This skill requires scanning AGENTS.md, copilot-instructions.md, *.instructions.md, *.prompt.md, *.agent.md, and existing SKILL.md files before taking action."
---

# Read Instructions First

## Goal

Force a task to begin with repository instruction discovery instead of immediate implementation.

## Required Startup Sequence

1. Find all markdown instruction files in the workspace.
2. Read every relevant instruction file before any other file inspection, search, edit, or command that depends on repository context.
3. Treat the instruction files as the first source of truth for the task.
4. Summarize the applicable constraints before proceeding.
5. If no instruction files are found, state that explicitly and continue only after that check is complete.

## Instruction File Scope

Prioritize these patterns:

- AGENTS.md
- copilot-instructions.md
- *.instructions.md
- *.prompt.md
- *.agent.md
- SKILL.md

If multiple instruction files exist, read them all before acting on the task.

## Completion Check

Before any substantive work, confirm:

- instruction files were located or not located
- the relevant constraints were read
- unresolved gaps were identified

Only after that may the agent continue with the requested task.
