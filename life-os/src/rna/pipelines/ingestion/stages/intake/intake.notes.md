# Intake Intro Contract — Markdown (paste back later)

This doc defines the **Intro Intake** step for Life-OS, designed to work with:
- A built-in Intake Agent, **or**
- A user-provided AI via **MCP** (Model Context Protocol), **or**
- A hybrid (user AI produces summaries; Life-OS enforces shape + trust).

It is intentionally **implementation-agnostic**: the AI can change, the contract stays.

---

## Goals

1. Make the intro feel like “meeting a coach/friend” while still producing structured, usable data.
2. Keep the system **fail-closed**: AI suggests; code validates; commit promotes trust.
3. Support **pluggable intelligence**:
   - First-party AI
   - User’s preferred AI (via MCP)
   - Different agents over time (intake, planner, critic, etc.)

---

## Core Principles

### AI proposes, pipeline decides
- Any AI output is treated as **PROVISIONAL**.
- The pipeline enforces:
  - required fields
  - consistency rules
  - eligibility rules
  - trust boundaries (COMMIT stage only)

### Separate “conversation” from “meaning”
- Conversation text is a source.
- The system produces *meaning artifacts* (profile, goals, constraints) from conversation.

### Structured output is mandatory
- Human-friendly chat is welcome, but *machine-usable extraction* must exist.

---

## Where MCP fits

### MCP role
MCP is an integration boundary that allows:
- user-selected AI models/providers
- user-owned tools/services
- different summarizers/extractors

MCP providers may:
- summarize a conversation turn
- extract facts into a structured shape
- suggest missing questions
- propose next prompts

But they do **not**:
- decide “ready to plan”
- commit trust
- bypass validation

---

## Inputs (Intro Intake)

### Minimal required inputs
- `proposalId`
- `conversationId`
- `turnId`
- `userMessage` (string)
- `timestamp`

### Optional context inputs
- `priorIntakeSnapshot` (the current provisional intake dossier)
- `recentTurns` (limited window)
- `userPreferences` (tone, verbosity, coach style)
- `toolingContext` (MCP provider info, model id, etc.)

---

## Outputs (Intro Intake)

The Intro step must always output:

### 1) Assistant-facing message
What the user sees next:
- `assistantMessage: string`

### 2) Provisional extraction artifacts
What the system stores as *candidate meaning*:
- `provisionalArtifacts: Artifact[]`

### 3) Missing info + next questions
So the system can adapt:
- `missingInfo: MissingField[]`
- `suggestedNextQuestions: QuestionSuggestion[]`

### 4) Intake status
- `status: "CONTINUE" | "READY_FOR_PLANNING"`

---

## Artifact Types (Intro)

You can store these as separate artifacts or a single dossier. Prefer separate artifacts early.

### Required artifacts (PROVISIONAL)
- `intake.note.turn`
  - short summary of the user’s latest message
- `intake.profile`
  - lifestyle: work, weekends, hobbies
- `intake.goals`
  - goals + timeframe + motivation
- `intake.constraints`
  - time windows, obligations, energy patterns
- `intake.preferences` (optional early, grows over time)
  - coaching style, cadence, dislikes, boundaries

Each artifact should include:
- `proposalId`
- `conversationId`
- `turnId`
- `source: "USER_TEXT" | "MCP_SUMMARY" | "SYSTEM"`
- `trust: "PROVISIONAL"`

---

## Minimal Checklist (readiness gate)

The pipeline should track a checklist. Example minimal gates:

### Ready-to-plan requires:
- At least **1 goal**
- At least **1 constraint** (time or obligation)
- At least **1 schedule anchor** (e.g., work hours OR sleep window OR “weekdays vs weekends”)

### Optional but recommended before planning:
- Preferred focus domains (health, learning, career, relationships)
- Time horizon (today, week, month)
- Tone preference (direct, friendly, strict)

The AI can suggest readiness, but **code decides**.

---

## Suggested Intro Question Set (coach vibe)

These are seed questions. The agent asks 1–2 at a time.

### Starter
- “Tell me a little about you — what do you do for fun?”
- “What’s a typical weekday like for you?”
- “How do weekends usually look?”

### Goals
- “What are you hoping to improve first — and why now?”
- “If we made progress in 2 weeks, what would be different?”

### Constraints
- “What time do you usually wake up and go to sleep?”
- “Any fixed commitments I should respect (work blocks, commute, classes)?”

### Preferences
- “Do you like gentle nudges or direct accountability?”
- “Do you want a plan that’s tight + scheduled or flexible + checklist-based?”

---

## MCP Output Contract (for user-provided AI)

If an MCP AI is used for summarization/extraction, it must return **structured JSON** with:

- `assistantMessage`
- `extractedFacts` (profile/goals/constraints/preference updates)
- `missingInfo`
- `suggestedNextQuestions`
- `confidence: "LOW" | "MED" | "HIGH"`
- `providerMeta` (model/provider id, optional)

The system should reject or downrank outputs that:
- omit required keys
- include invalid types
- hallucinate user facts without quoting/grounding

---

## Safety + Reliability Rules

### No hallucinated profile facts
If the AI inferred something, it must label it as:
- `inferred: true`
- and ideally include a `quote` or evidence snippet.

### Preserve raw sources
Store raw user messages (or pointers) so later systems can re-derive artifacts.

### Always provisional until COMMIT
Intro outputs are never committed directly. They become candidates for later planning and commit.

---

## Future Extension Hooks

Later you can add:
- multi-agent critique: “does plan violate constraints?”
- memory layering: short-term vs long-term profile
- domain adapters: finance intake, health intake, learning intake
- per-user model selection via MCP

The contract doesn’t change: **AI proposes; pipeline guards; commit finalizes.**

---

## Future Auth and Encryption
Suggested “Life-OS v1” approach (simple + strong)
	1.	Normal login (OAuth or passkey preferred)
	2.	Generate user_handle (UUID) on signup
	3.	Store identity in Auth DB, content in Data DB, mapping in separate table/schema
	4.	Encrypt content with KMS envelope encryption
	5.	Default: no training on user content; add opt-in later with redaction + strict retention
	6.	Make sure pipeline artifacts store only user_handle, never PII

---

## One-line spine

“Intro intake collects human context as provisional meaning, using any AI (via MCP), but only the pipeline decides what’s valid and when we’re ready to plan.”