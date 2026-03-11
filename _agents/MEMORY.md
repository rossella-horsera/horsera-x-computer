# Horsera — Shared Team Memory

This file is the team's growing knowledge base. It is updated at the end of every session and compressed weekly to stay lean. All agents read this at the start of every session.

**Compression rule:** At the end of each week, condense older entries into a "Prior context" summary. Keep the last 7 days in full detail.

---

## Current State of the Product

**As of:** 2026-03-11

**What exists:**
- Full MVP scaffold pushed to GitHub (horsera-x-claude repo)
- 5 screens built: Home, Journey, Rides, RideDetail, Insights
- Layout components: AppShell, BottomNav, CadenceFAB, CadenceDrawer
- UI components: ProgressRing, MilestoneNode, CadenceInsightCard
- Mock data in src/data/mock.ts (single source of truth)
- Design tokens in src/theme/colors.ts and tailwind.config.js
- Cadence AI is currently keyword-matched mock — real Claude API integration is post-MVP
- Lovable is connected to the repo and reflects current state

**What is not yet built:**
- Empty states (no rides yet, no data yet) — flagged by Quinn as missing
- Error states
- Real authentication
- Real data layer (everything is mock)
- Video upload (placeholder only)
- Trainer feedback flow (placeholder only)
- Cadence real AI integration

**Current focus:**
MVP is scaffolded. Next priority is to review each screen for quality, completeness, and emotional correctness before adding new features.

---

## Key Decisions Made

See DECISIONS.md for full decision log.

---

## What the Team Has Learned

### About the codebase
- Styling uses inline styles throughout — intentional for MVP, follow this pattern
- Google Fonts are injected via AppShell — noted for migration to index.html later
- mock.ts is the single data source — never duplicate data elsewhere
- The repo has both Cowork-built files and some original Lovable/Remix files — treat src/ as the source of truth

### About Rossella's working style
- Rossella is highly visual — always lead with mockups or diagrams before text
- She thinks in product journeys and emotional states, not features
- She is a solo founder, non-technical, in active build mode
- She wants to be closely involved in all product and strategy decisions
- She approves the daily plan before work begins (Option A workflow)
- See FEEDBACK.md for all standing instructions on how to work with her

### About the product
- The three-layer model (Biomechanics → Riding Qualities → Performance Tasks) is the core differentiator — always visible in Journey and Insights
- Cadence is not a chatbot — it's a persistent advisor that knows the rider deeply
- "Ride the Test" / "Judge's Eye" is a planned V2 feature — architecture must support it but don't build it yet
- The development loop (Goals → Learn → Ride → Assess → Adjust → Achieve) is the north star for every product decision

---

## Session Log

### 2026-03-11 — Initial Setup Session
**What happened:**
- Full MVP scaffold built by Cowork and pushed to GitHub
- Claude Code installed and configured on Rossella's Mac
- CLAUDE.md created by /init command
- Agent team defined: Ross (PM), Lauren (Designer), Beau (Developer), Quinn (QA)
- _agents/ folder created with TEAM.md, SKILLS.md
- _product-docs/ folder created with all strategy documents
- Agent memory system designed (this file + FEEDBACK.md + CHANGELOG.md + DECISIONS.md + DAILY.md + WEEKLY.md)

**What was decided:**
- Daily workflow: Option A (Ross proposes plan, Rossella approves before work begins)
- Memory: one shared file, compressed weekly
- Changelog: two levels — CHANGELOG.md (what) + DECISIONS.md (why)
- Visual-first working style established as standing instruction

**What needs to happen next:**
- Update CLAUDE.md to reference all agent files
- First real session: team reviews MVP screens and proposes improvements
- Quinn to do first full QA pass on all 5 screens
- Lauren to assess emotional correctness of each screen
- Ross to propose first weekly plan

---

*Updated by: Setup session*
*Next compression due: 2026-03-18*
