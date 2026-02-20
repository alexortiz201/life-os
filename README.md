# 🧠 Life-OS

> Life-OS is a learning-first AI system built deliberately, phase by phase, to teach how complex AI systems are designed, validated, and evolved in the real world.

Life-OS is a deterministic ingestion and execution pipeline designed around:

- Strong invariants  
- Typed domain contracts  
- Explicit stage boundaries  
- Deterministic effects  
- Outbox-based side effects  
- CI + AI review gating  
- Devcontainer reproducibility  

This repository represents a production-grade foundation, built intentionally with correctness and clarity as first principles.

---

# 📐 Architecture Overview

Life-OS is structured as a multi-stage ingestion pipeline:

INTAKE → VALIDATION → PLANNING → EXECUTION → REVALIDATION → COMMIT

Each stage:

- Is deterministic  
- Has explicit input/output contracts  
- Uses `fp-ts` `Either` for error boundaries  
- Uses `zod` for runtime schema enforcement  
- Is independently unit-tested  
- Is validated end-to-end via spine tests  

The Commit stage emits an **Outbox**, which cleanly separates:

- State mutation  
- Side effects  
- External integrations  

This allows replay, durability, idempotency, and future scaling.

---

# 🛠 Tech Stack

- **TypeScript (strict mode)**
- **fp-ts** (functional error handling)
- **Zod** (runtime schemas + type inference)
- **Vitest** (unit + integration testing)
- **Biome** (format + lint)
- **Docker** (environment determinism)
- **Devcontainer** (local parity)
- **GitHub Actions CI**
- **AI Code Review (OpenAI Responses API)**

---

# 🚀 Getting Started

## Option A — Recommended: Devcontainer (Deterministic Setup)

This project is configured with a devcontainer for full environment reproducibility.

### Requirements

- Docker Desktop
- VS Code
- Dev Containers extension

### Steps

1. Clone the repository:
`
git clone 
cd
`
2. Open the project in VS Code.
3. Run:
`Reopen in Container`

The container will:

- Build using `.devcontainer/Dockerfile`
- Mount the repository into `/workspace`
- Mount `node_modules` as a Docker volume
- Install dependencies via `postCreateCommand`

You now have a fully deterministic Linux-based development environment.

---

## Option B — Local Development (Without Devcontainer)

If you prefer running locally:

### Requirements

- Node 22+
- npm 11+

Install dependencies:
`
cd life-os
npm ci
`
Run verification:
`npm run verify`

---

# 🧪 Available Scripts

From the `life-os` directory:

- `npm run typecheck` — TypeScript strict validation
- `npm run build` — Compile to `dist/`
- `npm run test` — Run Vitest test suite
- `npm run verify` — Typecheck + build + test
- `npm run lint` — Biome linting
- `npm run format` — Biome formatting

---

# 🐳 Docker & Devcontainer Setup

The project includes:

- `.devcontainer/devcontainer.json`
- `.devcontainer/Dockerfile`
- Docker volume for `node_modules`

### Why this setup?

- Ensures Linux-native dependency builds
- Avoids host permission issues
- Provides parity with CI
- Makes onboarding a single command operation

### Rebuilding the container

If needed:
`Dev Containers: Rebuild Container`

To remove node_modules volume manually:
`docker volume rm life-os-node-modules`

---

# 🤖 CI & AI Review

CI is configured in `.github/workflows/ci.yml`.

## On Pull Requests:

1. Docker image builds (same as devcontainer)
2. `npm run verify` runs inside container
3. Lint runs
4. If successful:
   - AI review is generated
   - PR comment is created or updated

AI review uses:
- OpenAI Responses API
- Custom review rules in `.github/workflows/aidd/rules.md`
- Deterministic gating (only runs if tests pass)

---

# 🔐 Deterministic Guarantees

Life-OS enforces:

- Stage-level idempotency
- Explicit error boundaries
- No hidden side effects
- Outbox emission only after commit approval
- No direct mutation of external systems

Commit ≠ Apply.

---

# 📁 Project Structure
```
life-os/
src/
domain/
platform/
stages/
tests/
vitest.config.ts
tsconfig.json
package.json

.devcontainer/
Dockerfile
devcontainer.json

.github/
workflows/
```

---

# 📌 Roadmap Status

Current Phase:

PHASE_3A.2 — Outbox + Apply boundary

Completed:

- Stage contracts
- Deterministic effects
- Outbox emission
- Vitest migration
- Docker parity CI
- AI review gating

Next:

- SQLite persistence
- XState orchestration layer
- Phase 4 (durability & scaling)

---

# 🧠 Philosophy

This project is intentionally built:

- Slowly
- Explicitly
- Deterministically
- With architectural discipline

The goal is not speed.

The goal is understanding how production AI systems are actually engineered.

---

# 🧾 License

ISC

---

# ✨ Final Notes

If you can:

- Clone
- Reopen in container
- Run `npm run verify`
- Open a PR
- See CI pass
- See AI review comment

Then your system is working exactly as designed.

