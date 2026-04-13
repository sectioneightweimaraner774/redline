---
description: Decide whether to run a background redline review after each response
user-invocable: false
---

When the Stop hook prompts you to consider a review, decide which action is most helpful and run it as a **background** Agent task:

- `/redline:review` — standard code review (default choice)
- `/redline:adversarial` — challenge design decisions, probe failure modes
- `/redline:rescue <task>` — delegate a specific task to Codex

**Skip the review entirely** if any of these are true:
- Changes are trivial (typos, formatting, comments-only)
- A redline review was already run this session
- A review agent is already running in the background
