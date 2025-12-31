# QUICK NOTES TO COME BACK TO LATER

“Raw structured Markdown (source, not rendered)”
"Markdown code block"

# Building a Multi-Agent Teaching System for Life-OS

This document outlines architectural principles for building a Life-OS system
powered by RAG, AI agents, and teaching-oriented workflows. The primary goal is
to ensure clarity, consistency, and calm execution under pressure as the system
scales.

---

## 1) One Orchestrator, Many Specialists

The system should be centered around a single **Orchestrator** agent.

Responsibilities of the Orchestrator:
- Decide what happens next
- Enforce global constraints (mode, depth limits, timebox, file access)
- Merge specialist outputs into one coherent user-facing response

Rules:
- Specialist agents do NOT speak directly to the user by default
- The user should always experience one stable voice

This prevents the system from sounding like a committee and reduces drift.

---

## 2) Specialists as Contributors, Not Speakers

Each specialist agent must have:
- A narrowly defined role
- A bounded output contract

Specialists should return:
- Intent (what they were trying to do)
- Assumptions or constraints used
- Confidence level
- Suggested next action (non-authoritative)
- Content contribution

Examples:
- A **Historian** summarizes continuity; it does not narrate
- A **Librarian** retrieves and ranks material; it does not explain

Specialists inform the Orchestrator but never override control flow.

---

## 3) Separation of Control Plane and Content Plane

Control flow and content retrieval must be separated.

### Control Plane responsibilities:
- Mode selection (Morning Review, Night Review, Drill)
- Ritual step ordering and pauses
- Domain and subcategory locks
- Depth limits
- User overrides (e.g. “go deeper”, “skip”)
- Tool and file permissions

### Content Plane responsibilities:
- Fundamentals
- Stories
- References
- Examples

Rule:
- Retrieval provides content
- Retrieval does NOT decide what the system does next

Mixing these concerns is the fastest way to introduce behavioral drift.

---

## 4) Explicit Mode and Lock Management

Modes must be treated as runtime locks, not soft prompts.

Each mode activates:
- A specific depth profile
- Pacing expectations
- Permission constraints

Example locks:
- `mode = morning | night | drill`
- `domain = algorithms`
- `subcategory = string manipulation`
- `depth_limit = scan-only`
- `file_access = false`

A lightweight checksum or reset phrase (e.g. “Minimal, correct, first.”)
should immediately re-lock these constraints if execution drifts.

---

## 5) Layered Memory with Deterministic Precedence

Memory should be explicitly layered.

Recommended layers:
1. Policy / Contracts (immutable, versioned)
2. Ritual definitions (morning, night, drill)
3. Domain knowledge (fundamentals, references)
4. Personal memory (stories, preferences)
5. Session state (current step, locks, confirmations)

Rules:
- Specialists may propose memory updates
- Only the Orchestrator commits memory
- Session state always overrides retrieval

This preserves continuity without corruption.

---

## 6) Deterministic Conflict Resolution Between Agents

Agent disagreement must be resolved deterministically.

Precedence order:
1. Mode locks
2. Ritual requirements
3. Explicit user overrides
4. Teacher agent defaults
5. Specialist suggestions

Rules:
- Specialists may flag conflicts
- Specialists do NOT resolve conflicts themselves
- The Orchestrator always decides

This prevents negotiation loops and hesitation.

---

## 7) Early Drift Detection and Evaluation

Evaluation should focus on behavioral correctness, not answer quality.

Examples of drift checks:
- Was minimal-first bias followed?
- Were pause points respected?
- Did “go deeper” deepen the SAME nuance?
- Were time and space complexity verbalized?
- Were stories recalled vs expanded correctly?

These checks make the system feel reliable under pressure.

---

## 8) UI as a Cognitive Tool

The interface should actively reduce cognitive load.

Recommendations:
- Render reviews in Markdown by default
- Clearly display:
  - current mode
  - domain
  - subcategory
  - ritual step
- Provide a visible reset control or phrase

The UI should reinforce system guarantees, not obscure them.

---

## 9) Recommended Starting Agent Set

Start small and expand deliberately.

Initial agents:
1. Teacher – user-facing guidance and rituals
2. Librarian – retrieval and indexing

Next additions:
3. Historian – continuity and long-term memory
4. Evaluator – drift and ritual compliance checks
5. Planner – curriculum and rotation planning

Scaling agents works best when behavior is already stable.