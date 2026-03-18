# Life-OS Vision

## Project Goals and Objectives

Life-OS exists to build a system that increases human agency.

The primary goal is to create a **progress engine** that helps a person consistently move toward meaningful goals by identifying and enabling the **smallest actionable next step** at any moment.

This system is not designed as a traditional productivity tool. Instead, it is intended to function as a **personal development infrastructure** that:

- helps users understand their current state
- extracts meaningful structure from unstructured input
- continuously refines goals, constraints, and preferences
- guides action through iterative feedback loops

The system should evolve from a simple intake and planning mechanism into a **capability-building platform**, where users can:

- learn faster
- organize their lives intentionally
- make consistent forward progress
- adapt their behavior based on reflection

---

## Key Constraints and Non-Negotiables

### 1. AI is never trusted by default
All AI output is treated as **provisional**.

- AI can suggest, summarize, and extract
- The pipeline validates and enforces structure
- Only the commit stage can promote trust

### 2. Fail-closed system design
Invalid or incomplete inputs must not silently pass through the system.

- schema validation is mandatory
- errors must surface explicitly
- the system must halt on invariant violations

### 3. Deterministic core
The pipeline must remain fully deterministic.

- same input → same output
- no hidden side effects
- all transformations are explicit and traceable

### 4. Canonical data structures
All inputs (CLI, HTTP, AI, MCP) must be normalized into a **single canonical format** before entering the pipeline.

- prevents combinatorial complexity
- ensures consistent behavior
- simplifies reasoning about system state

### 5. Separation of concerns
The system must strictly separate:

- adapters (input/output handling)
- prompts (AI behavior definitions)
- schemas (validation and contracts)
- pipeline (state transitions and trust boundaries)

### 6. Build small, expand iteratively
The system must evolve through **small working artifacts**, not large speculative systems.

- no premature ecosystem building
- only the next capability layer is implemented
- each layer must be usable before expanding

---

## Architectural Decisions and Rationale

### Pipeline-driven architecture
The system is structured as a **multi-stage pipeline**:
`intake → validation → planning → execution → revalidation → commit`

Each stage:

- enforces invariants
- transforms state explicitly
- records its execution
- can halt the system safely

This enables:

- traceability
- debuggability
- replayability
- controlled trust progression

---

### Envelope-based state management

All data flows through a single structure:
`PipelineEnvelope`

This includes:

- ids
- snapshot (context + permissions)
- stages (execution state)
- errors (accumulated failures)

This ensures:

- full visibility into system state
- consistent data flow
- easy inspection and testing

---

### Adapter pattern for input sources

All external inputs are treated as **adapters**:

- CLI
- HTTP
- MCP (user-provided AI)
- internal AI adapters

Adapters are responsible for:

- receiving input
- transforming it into canonical structures

They do **not**:

- enforce business logic
- make trust decisions

---

### AI as a replaceable component

AI is implemented as an adapter, not as core logic.

- prompts are defined separately from adapters
- adapters handle transport (API calls, retries, etc.)
- schemas validate all AI outputs

This allows:

- swapping providers (OpenAI, Anthropic, local models)
- evolving prompts independently
- maintaining system stability despite AI variability

---

### Canonicalization layer

All inputs are normalized into:
`IntroExtraction → RawProposal → PipelineEnvelope`

This ensures:

- consistent downstream processing
- reduced system complexity
- clear data contracts

---

### Trust boundary via commit stage

The commit stage is the only place where data becomes **trusted**.

Before commit:
`trust = UNTRUSTED / PROVISIONAL`

This creates a clear boundary between:

- suggestion
- validation
- execution
- finalization

---

## User Experience Principles

### 1. Feels like a conversation, operates like a system
The user interacts naturally (chat-like), but the system internally produces structured meaning.

- conversation is input
- structured artifacts are output

---

### 2. Progressive understanding
The system does not require perfect input upfront.

- gathers information incrementally
- tracks missing information
- asks targeted follow-up questions

---

### 3. Minimal cognitive load
The system should reduce decision fatigue by:

- identifying the smallest meaningful next step
- avoiding overwhelming plans
- adapting to constraints and preferences

---

### 4. Adaptive interaction
The system should:

- adjust tone (coach vs direct)
- adjust structure (flexible vs scheduled)
- evolve with user preferences

---

### 5. Visible progress
Users should always feel forward movement through:

- small completed actions
- clear next steps
- reflection loops

---

## Success Criteria

### 1. Functional core loop works
The system can reliably execute:
`input → extraction → validation → proposal → pipeline → output`

---

### 2. Smallest next action is consistently produced
Given a user context, the system can determine:

> the smallest meaningful action the user can take right now

---

### 3. System is resilient to bad input
- invalid inputs are rejected safely
- AI hallucinations do not corrupt state
- errors are observable and traceable

---

### 4. Architecture supports extension
The system can evolve to support:

- multiple input sources
- multiple AI providers
- additional domains (health, learning, finance)
- multi-agent workflows

Without requiring architectural rewrites.

---

### 5. Personal usage is viable
The creator can use Life-OS as:

- a daily tool
- a planning system
- a reflection system

If the system is useful to the creator, it is on the right path.

---

## One-line Vision

Life-OS is a deterministic system that transforms human intent into structured progress, enabling individuals to continuously move toward meaningful goals through small, validated actions.