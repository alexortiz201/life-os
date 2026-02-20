# Dockerfile (repo root)
FROM node:22-bookworm-slim

# System deps you already use in CI
RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  jq \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy only dependency manifests first (better caching)
COPY life-os/package.json life-os/package-lock.json ./life-os/

WORKDIR /workspace/life-os
RUN npm ci

# Now copy the rest of the repo
WORKDIR /workspace
COPY . .

# Default to project folder for commands
WORKDIR /workspace/life-os

# Optional: helpful default
CMD ["npm", "test"]
