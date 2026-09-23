# Raymond

A modular, provider-independent personal AI control plane.

## Architecture

- **Core** (`src/worker/core/`) — stable, rarely changes
- **Capabilities** (`src/worker/capabilities/`) — pluggable modules
- **Adapters** (`src/worker/adapters/`) — provider-specific implementations
- **UI** (`src/ui/`) — thin client, no business logic

Modules communicate through an **Event Bus** — no direct dependencies.

## Stack

- Cloudflare Workers (runtime)
- Hono (HTTP framework)
- Cloudflare D1 (database)
- Workers AI (free AI models)
- React + Vite (UI)

## Local Development

    npm install
    npm run dev

## Deploy

    npm run deploy

## Status

- v0.1 — Base chat + AI routing
- Future: Telegram, X, Email, VPN module, Data platform, Local AI
