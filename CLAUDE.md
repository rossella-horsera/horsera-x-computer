# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Team — Read First

Before starting any work in this repository, read these files in order:

1. _agents/SKILLS.md — shared Horsera product context, design DNA, and working principles
2. _agents/TEAM.md — the four agents (Ross, Lauren, Beau, Quinn) and how they work together
3. _agents/MEMORY.md — what the team knows, current product state, session history
4. _agents/FEEDBACK.md — Rossella's standing instructions on how to work (always apply these)
5. _agents/DAILY.md — today's proposed plan (must be approved before work begins)
6. _agents/WEEKLY.md — weekly accomplishments and current priorities
7. _agents/CHANGELOG.md — what has changed recently
8. _agents/DECISIONS.md — why key decisions were made

After reading all agent files, confirm you have done so and briefly state current product state and today's proposed plan. Do not begin any work until Rossella has approved the daily plan.

## Product Documents

_product-docs/ contains source documents that have been distilled into MEMORY.md. Only read specific files in _product-docs/ when you need depth on a particular topic (e.g. biomechanics metrics, progression maps). Do not re-read all docs every session.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:8080)
npm run build     # Type-check (tsc) then build for production
npm run preview   # Preview production build
npm run lint      # ESLint over src/ (ts, tsx)
```

There is no test suite yet.

## Architecture

Horsera is a mobile-first React + TypeScript PWA (max-width 430px) for equestrian riders. It tracks biomechanics milestones toward competition goals.

**Routing** (`src/App.tsx`): React Router v6 with five routes wrapped in `AppShell`.

**AppShell** (`src/components/layout/AppShell.tsx`): Persistent layout with a fixed `BottomNav`, a floating `CadenceFAB`, and a slide-up `CadenceDrawer`. The main content area scrolls with `paddingBottom: 82px` to clear the nav. Google Fonts (Playfair Display, DM Sans, DM Mono) are injected inline here — noted for migration to `index.html` in production.

**Pages**:
- `HomePage` — Dashboard: progress ring for active milestone, today's cue card, Cadence insight, recent ride, weekly frequency bar chart, upcoming competition.
- `JourneyPage` — Milestone roadmap with `MilestoneNode` components in a vertical timeline.
- `RidesPage` — Ride log list.
- `RideDetailPage` — Single ride with biometrics, trainer feedback, and Cadence insight.
- `InsightsPage` — Biometrics trend charts across sessions.

**Cadence AI** (`CadenceDrawer`): Currently a keyword-matched mock (`getCadenceResponse`). Marked for replacement with a real AI layer post-MVP.

**Data** (`src/data/mock.ts`): Single source of truth for all MVP data. All pages import from here. Types are co-located in this file. Replace with a real data layer post-MVP.

## Design System

Colors are defined in two places — `src/theme/colors.ts` (TS constants) and `tailwind.config.js` (Tailwind tokens). Keep them in sync.

The palette uses semantic names:
- **Parchment** `#FAF7F3` — primary background
- **Cognac** `#8C5A3C` — brand primary / CTAs
- **Champagne** `#C9A96E` — in-progress / working state
- **Cadence blue** `#6B7FA3` — AI advisor UI
- **Progress green** `#7D9B76` — mastered / improving
- **Attention** `#C4714A` — needs focus

Milestone states: `untouched` | `working` | `mastered`

Styling uses **inline styles throughout** (not Tailwind classes) — this is intentional for the MVP. Tailwind is configured but used minimally. Follow the existing pattern when adding UI.

Fonts: Playfair Display (serif, headings/greeting), DM Sans (sans, body), DM Mono (mono, metrics/timestamps).
