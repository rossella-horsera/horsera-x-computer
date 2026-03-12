# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Team — Read First

Before starting any work in this repository, read these files in order:

- `_agents/SKILLS.md` — shared Horsera product context, design DNA, and working principles
- `_agents/TEAM.md` — the four agents (Ross, Lauren, Beau, Quinn) and how they work together
- `_agents/MEMORY.md` — what the team knows, current product state, session history
- `_agents/FEEDBACK.md` — Rossella's standing instructions on how to work (always apply these)
- `_agents/WEEKLY.md` — weekly accomplishments and current priorities
- `_agents/CHANGELOG.md` — what has changed recently
- `_agents/DECISIONS.md` — why key decisions were made

After reading all agent files, confirm you have done so and briefly state current product state. Then immediately check Trello before proposing any work.

## Trello — The Plan

Trello is the single source of truth for all work. There is no separate daily plan file. The board drives every session.

**Board:** https://trello.com/b/Xe7yzxVo/horsera  
**Board ID:** `Xe7yzxVo`  
**Credentials:** `TRELLO_API_KEY` and `TRELLO_TOKEN` in `.env`

### Board structure

| List | Meaning |
|------|---------|
| **To-do** | Rossella's backlog — raw requests waiting to be picked up |
| **Work in Progress** | Being worked on this session |
| **Needs Revision** | Delivered but Rossella is not satisfied — read her comment before touching |
| **Ready for Review** | Complete — awaiting Rossella's approval |
| **Done 🎉** | Approved and closed |

### Priority labels (set by Rossella or Ross)

| Label | Priority |
|-------|---------|
| 🔴 Red | P1 — Urgent, do this first |
| 🟡 Yellow | P2 — Normal priority |
| 🟢 Green | P3 — Nice to have, do last |

Cards with no priority label = treat as P2.

### Agent role labels (set by Ross)

| Label | Meaning |
|-------|---------|
| 🔵 Blue | Beau leads (dev/code) |
| 🟣 Purple | Lauren leads (design/visual) |
| ⬜ White | Ross leads (product/docs/strategy) |
| 🟠 Orange | Quinn leads (QA/testing) |

---

## Ross's Role — Requirements & Routing

Ross is the first agent to act on every new To-do card. Before any code or design work begins, Ross must:

### 1. Enrich the card
Read Rossella's raw request. Rewrite the card description using this structure:
