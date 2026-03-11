# Horsera — Decisions Log

A record of significant product, design, and architectural decisions — capturing not just *what* was decided but *why*. This is the institutional memory of Horsera's strategic thinking.

**When to add an entry:** Any decision that, if forgotten, could cause the team to reverse course or re-debate the same ground. Not every small change — only decisions with meaningful rationale.

---

## Product & Strategy Decisions

### 2026-03-11 — AI companion named Cadence, not Genie
**Decision:** The AI advisor is called Cadence.
**Why:** "Genie" felt whimsical and lamp-rubbing — wrong tone for a premium product. Cadence is a dressage term for rhythmic, expressive movement that emerges when horse and rider are truly in harmony. It implies helping riders find their rhythm. Sounds elegant when spoken: "Ask Cadence."
**Described as:** "your intelligent riding advisor"

### 2026-03-11 — Cadence is a floating FAB, not a bottom nav tab
**Decision:** Cadence lives as a persistent floating button, not a 5th tab in the bottom nav.
**Why:** A dedicated tab treats AI as a destination — undermines the "ambient intelligence" principle. Cadence should be reachable from any screen with awareness of current context. This also keeps the nav clean at 4 tabs.

### 2026-03-11 — Learning content embedded in Journey, not a separate tab
**Decision:** Learning content (drills, exercises) lives inside Journey at the milestone level, not as a standalone section.
**Why:** Keeps navigation clean. Reinforces that learning is always in service of a specific developmental goal, not a library to browse. May evolve to a separate tab in V2 if the content library grows significantly.

### 2026-03-11 — "Ride the Test" / "Judge's Eye" is V2, not MVP
**Decision:** The mock test evaluation feature is deferred to V2.
**Why:** Requires movement pattern recognition on top of the V1 biomechanics foundation (video processing, pose detection, metric extraction). Must be built on a stable V1. Architecture must support it from day one — the ride type structure, test-level data model, and readiness signal framework need to accommodate it.

### 2026-03-11 — Inline styles throughout (not Tailwind classes)
**Decision:** MVP uses inline styles for all custom design tokens, not Tailwind utility classes.
**Why:** Tailwind's arbitrary value syntax is available but limited without a compiler. Inline styles give precise control over the design system tokens and are more predictable in the Lovable environment. Migrate to Tailwind or CSS variables post-MVP.

### 2026-03-11 — Single horse profile for MVP
**Decision:** MVP supports one horse per rider.
**Why:** Multi-horse profiles add significant complexity (data model, UI, relationship management). Not needed to validate core value. Full horse persona is V3.

---

## Design Decisions

### 2026-03-11 — Milestone progress ring as Home screen hero
**Decision:** Home screen leads with a large SVG progress ring, not text cards.
**Why:** First version was text-heavy with no dominant visual. Premium references (Oura, Apple Health) lead with a single visual that communicates status before any text is read. The ring creates the "Oura effect" — rider understands where they are before reading a word.

### 2026-03-11 — 4-tab navigation (not 5)
**Decision:** Bottom nav has exactly 4 tabs: Home, Journey, Rides, Insights.
**Why:** 5 tabs (including Cadence) felt cluttered and treated AI as a section to fill. 4 is more elegant and keeps the nav anchored purely to the rider's development journey.

---

## Technical Decisions

### 2026-03-11 — React + TypeScript + Vite (Lovable-compatible stack)
**Decision:** MVP built on React, TypeScript, Vite, Tailwind.
**Why:** Lovable's native stack. Ensures compatibility with the visual preview environment. Standard modern React tooling.

### 2026-03-11 — mock.ts as single data source
**Decision:** All MVP data lives in src/data/mock.ts with co-located TypeScript interfaces.
**Why:** Simplest approach for MVP. Single source of truth prevents data drift across components. Replace with real data layer (Supabase or similar) post-MVP.

---

*When adding a new decision, use this format:*

*### YYYY-MM-DD — Decision title*
*__Decision:__ What was decided*
*__Why:__ The reasoning — as if explaining to someone joining the team 6 months later*
*__Alternatives considered:__ (optional) What else was considered and why it was rejected*
