# 🌌 Life-OS — The Adaptive Operating System for Humans

> **Architect:** Alex Ortiz
> **Core Concept:** A modular, evolving framework for designing and living an intentional life through systems thinking, gamified progress, and adaptive reflection.

---

## 🧠 Overview

Life-OS is a **three-layer architecture** that mirrors biological intelligence:
| Layer | Description | Repo / Package |
|:--|:--|:--|
| 🧬 **DNA** | The *semantic genome* — AI-readable ontology of your system (concepts, rules, relationships). | [`life-os-dna`](./packages/life-os-dna) |
| 🧫 **RNA** | The *expression logic* — transformation and theme logic that interprets DNA and compiles it into usable artifacts. | [`life-os-rna`](./packages/life-os-rna) |
| 💎 **Expression** | The *phenotype* — generated dashboards, reflections, and notes the human interacts with daily. | [`life-os-expression`](./packages/life-os-expression) |

Each layer is independent but composable — together, they form a living self-adapting system.

---

## 🔧 Repo Structure

```bash
life-os/
├── packages/
│   ├── life-os-dna/          # static ontology (manifest + templates)
│   ├── life-os-rna/          # logic and theme expression layer
│   └── life-os-expression/   # generated artifacts and dashboards
├── apps/
│   ├── mcp-server/           # connects Life-OS logic to Model Context Protocol
│   └── life-os-app/          # UI / widgets (future)
└── README.md
```

---

## 🧩 The Core Flow

```
life-os-dna ──▶ life-os-rna ──▶ life-os-expression
    ↑              ↑                  ↑
   ontology        logic              artifacts
```

- **DNA** defines *meaning*
- **RNA** defines *behavior*
- **Expression** defines *experience*

---

## 🧠 AI Context Integration

The system is designed for **AI agents** (like your MCP server) to reason about:
- Relationships between goals, projects, and tasks
- XP logic and progression phases
- Reflective prompts and adaptive guidance

Each layer exposes structured data for autonomous interpretation, without depending on proprietary APIs.

---

## 🚀 Getting Started

```bash
# Clone & bootstrap all packages
git clone https://github.com/alexortiz201/life-os
cd life-os
pnpm install
pnpm build
```

Then to build your life dashboards:
```bash
pnpm run build:expression
```

---

## 🧭 Philosophical Principle

> “Systemize your becoming.”

Every note, task, and reflection contributes XP toward your ongoing evolution —
Life-OS is the *architectural pattern of becoming yourself.*

---

## 🔮 Future Integrations

- MCP + OpenAI app integration (AI guidance + widgets)
- `life-os-cli` — command-line orchestrator
- `life-os-cloud` — sync state and XP graphs
- GraphQL layer for AI introspection

---

## 🪶 License

MIT © 2025 — Designed and Authored by **Alex Ortiz**
""")

# life-os-dna README.md
dna_readme = dedent("""
# 🧬 Life-OS DNA — Semantic Genome

> **Purpose:** Define the structure, meaning, and progression system for the Life-OS ecosystem.
> **Scope:** Ontology, templates, and metadata only (no logic).

---

## 📘 Overview

`life-os-dna` contains the **foundational definitions** that the rest of Life-OS builds upon.
It describes what “Goals”, “Projects”, “Tasks”, “Phases”, and “XP” *mean* — not how they behave.

This repository acts as the **semantic contract** between human intent and AI reasoning.

---

## 🧩 Contents

```bash
life-os-dna/
├── manifest.jsonc            # Core ontology, XP rules, phases, relationships
├── templates/                # Canonical templates (Goal, Project, Task)
├── concepts/                 # Documentation of systems and meaning models
│   ├── xp-system.md
│   ├── phases.md
│   └── relationships.md
└── ai-notes/                 # Meta files for AI reasoning and system context
```

---

## ⚙️ Role in the System

| Layer | Function | Consumes / Produces |
|:--|:--|:--|
| 🧬 **DNA** | Defines structure & meaning | Output of human design |
| 🧫 **RNA** | Translates meaning into behavior | Consumes DNA |
| 💎 **Expression** | Generates artifacts | Output of RNA |

AI agents or compilers can parse `manifest.jsonc` to understand:
- Hierarchical relationships (`goals → projects → tasks`)
- XP rules and phase multipliers
- Icons, symbols, and conceptual metadata
- Limits, constraints, and ontology boundaries

---

## 🧠 AI Readability

All files are **JSONC** (JSON + comments) and **Markdown**, intentionally human + machine-readable.

AI systems can:
- Parse manifest schema for structure
- Read markdown descriptions as meaning anchors
- Infer relationships for reasoning or task generation

---

## 🔬 Design Philosophy

> “Separate **meaning** (DNA) from **mechanism** (RNA).”

This separation allows Life-OS to evolve —
you can redesign goals, XP systems, or phases without rewriting logic.

---

## 🚀 Future: Schema Evolution

Eventually `life-os-dna` will export a typed schema:

```ts
import type { LifeOSManifest } from "@alexortiz201/life-os-dna"
```

Allowing runtime validation and generative compilation into themes.

---

# Life-OS (Single Project, Modular)

This repo is **one package** with **TypeScript project references** to enforce clean boundaries.
It mirrors a future monorepo split, so each subfolder under `src/` can be moved to its own package later.

## Build
```bash
pnpm i
pnpm build
pnpm demo
```

## Layout
- `src/types` — shared interfaces
- `src/dna` — ontology + templates
- `src/rna` — compilers
- `src/theme-default` — optional theme
- `src/orchestrator` — orchestrator API (exports `buildExpression`)
- `src/cli` — minimal CLI (compiled to `dist/cli`)

### Later extraction
Copy any `src/<module>` into a new repo, keep its `tsconfig.json`, and update imports to the new package name.



## 🪶 License

MIT © 2025 — Designed by **Alex Ortiz**