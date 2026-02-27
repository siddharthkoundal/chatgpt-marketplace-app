# syf-marketplace-mcp

> A **Model Context Protocol (MCP) server** that connects ChatGPT and AI agents to the live SYF Marketplace API — returning real product offers in real-time.

---

## Table of Contents

- [What is MCP?](#what-is-mcp)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Data Flow](#data-flow)
- [Transport Modes](#transport-modes)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)

---

## What is MCP?

**Model Context Protocol (MCP)** is an open standard that lets AI models (like ChatGPT) call external tools and fetch live data — designed specifically for LLM tool use.

```
ChatGPT ──────── MCP Protocol ────────► MCP Server ────► SYF Marketplace API
         "call get_offers tool"         (this repo)       (live, 520+ offers)
         ◄──────────────────────────────              ◄──────────
              Returns structured JSON
```

When a user asks ChatGPT *"What home improvement deals are available?"*, ChatGPT automatically:
1. Recognizes it needs real data
2. Calls our `get_offers` tool via MCP
3. Receives a structured JSON list of **live offers**
4. Summarizes and presents them to the user

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│                                                                      │
│   ChatGPT / AI Agent / MCP Inspector                                │
│   (Sends JSON-RPC tool call requests)                               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ MCP Protocol (JSON-RPC 2.0)
                            │
              ┌─────────────▼──────────────┐
              │      TRANSPORT LAYER        │
              │                            │
              │  stdio (local/dev)         │  ← src/index.ts
              │  HTTP + SSE (remote/ngrok) │  ← src/server.ts
              └─────────────┬──────────────┘
                            │
              ┌─────────────▼──────────────────────────┐
              │   McpServer  (SDK v1.x high-level API)  │
              │                                         │
              │  registerTool("get_offers", {            │
              │    inputSchema: GetOffersInputZodShape,  │  ← offerSchema.ts
              │    description: "...",                   │
              │  }, handler)                            │
              │                                         │
              │  • Serves  tools/list  automatically   │
              │  • Validates args via Zod automatically │
              │  • Routes  tools/call  to handler       │
              └─────────────┬───────────────────────────┘
                            │ pre-validated GetOffersInput
              ┌─────────────▼──────────────┐
              │       API CLIENT LAYER      │
              │                            │
              │  fetchOffers()             │  ← src/api/synchronyClient.ts
              │  Live API + mock fallback  │
              └─────────────┬──────────────┘
                            │ axios.get()
              ┌─────────────▼──────────────┐
              │    SYF MARKETPLACE API      │
              │  api.syf.com/v1/marketing  │
              │  /offers?campaignMappingId │
              │  =ALL   (520+ live offers) │
              └────────────────────────────┘
```

---

## Project Structure

```
syf-chatgpt-app/
│
├── src/
│   ├── index.ts                  # Entry point: stdio transport (local dev & MCP Inspector)
│   ├── server.ts                 # Entry point: HTTP/SSE transport (ngrok & remote clients)
│   │
│   ├── schemas/
│   │   └── offerSchema.ts        # Zod schemas: input args + offer output shape
│   │
│   ├── api/
│   │   └── synchronyClient.ts    # Live API client: calls SYF API, falls back to mock
│   │
│   └── tools/
│       └── getOffers.ts          # Tool handler: validate → fetch → filter → format → respond
│
├── package.json                  # Dependencies + npm scripts
├── tsconfig.json                 # TypeScript: ES2022, NodeNext, strict mode
├── .gitignore
├── README.md                     # ← You are here
└── TESTING.md                    # Step-by-step testing guide
```

---

## Data Flow

Exact journey of a single tool call from ChatGPT to a response:

```
1. ChatGPT sends:
   { "method": "tools/call", "params": { "name": "get_offers", "arguments": { "category": "furniture", "featured": true } } }

2. src/index.ts (or server.ts) — McpServer receives the tool call
   └── SDK validates args against GetOffersInputZodShape (Zod)
       ├── FAIL → SDK returns validation error to ChatGPT (handler not called)
       └── PASS → calls the registered handler with typed GetOffersInput args

3. src/tools/getOffers.ts :: handleGetOffers(args: GetOffersInput)
   └── calls fetchOffers(args)

4. src/api/synchronyClient.ts :: fetchOffers()
   ├── axios.get("https://api.syf.com/v1/marketing/offers?campaignMappingId=ALL")
   │   ├── SUCCESS → 520+ real offers returned
   │   └── FAIL    → falls back to MOCK_OFFERS (server stays functional)
   └── Applies in-process filters:
       industry → category (legacy) → offerType → region → network → brand → featured → pagination
       └── Returns: Offer[]

5. src/tools/getOffers.ts :: formatOfferForChatGPT()
   └── Strips raw image URLs + internal IDs
       └── Surfaces: brand, offerType, links, keywords, expiryMsg, disclosure
       └── Wraps in envelope: { totalOffers, appliedFilters, offers: [...] }

6. ChatGPT receives the JSON and presents live offers to the user.
```

---

## Transport Modes

| Mode | File | Command | Use When |
|------|------|---------|----------|
| **stdio** | `src/index.ts` | `npm run dev` | Local MCP Inspector, Claude Desktop |
| **HTTP/SSE** | `src/server.ts` | `npm run dev:http` | Remote access via ngrok, ChatGPT Agents SDK |

### Endpoints (HTTP mode)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /mcp` | Streamable HTTP | OpenAI Responses API (recommended) |
| `GET /mcp` | Streamable HTTP | SSE streaming for long responses |
| `GET /sse` | SSE (legacy) | MCP Inspector |
| `POST /messages` | SSE (legacy) | MCP Inspector message routing |
| `GET /health` | — | Health check |

---

## OpenAI Integration

> **Source:** [OpenAI Apps SDK — Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server) · [MCP concept overview](https://developers.openai.com/apps-sdk/concepts/mcp-server/)

### Recommended Transport: Streamable HTTP

Per official OpenAI docs, **Streamable HTTP is the recommended transport** for production.

| Transport | Status | Use When |
|-----------|--------|----------|
| `stdio` | ✅ Active | Local MCP Inspector, Claude Desktop |
| `SSE` | ⚠️ Legacy | Remote testing with MCP Inspector |
| `Streamable HTTP` | ✅ Recommended | Production (ChatGPT, OpenAI Responses API) |

Both transports are implemented in this project. `POST /mcp` uses Streamable HTTP; `GET /sse` uses legacy SSE.

### Tool Annotations (Required for ChatGPT App Store)

```typescript
server.registerTool("get_offers", {
  description: "...",
  inputSchema: GetOffersInputZodShape,
  annotations: {
    readOnlyHint: true,      // ✅ reads data only, never writes
    openWorldHint: false,    // ✅ scoped to SYF Marketplace only
    destructiveHint: false,  // ✅ no deletes or irreversible actions
  },
}, handler);
```

### Official References

| Resource | Link |
|----------|------|
| OpenAI Apps SDK: Build MCP server | [developers.openai.com/apps-sdk/build/mcp-server](https://developers.openai.com/apps-sdk/build/mcp-server) |
| MCP concept overview | [developers.openai.com/apps-sdk/concepts/mcp-server](https://developers.openai.com/apps-sdk/concepts/mcp-server/) |
| TypeScript SDK | [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| MCP Specification | [spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io) |
| MCP Inspector | [modelcontextprotocol.io/docs/tools/inspector](https://modelcontextprotocol.io/docs/tools/inspector) |

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm v9+
- [ngrok](https://ngrok.com) (only for remote/HTTP mode)

### Installation

```bash
git clone https://github.com/siddharthkoundal/chatgpt-marketplace-app.git
cd syf-chatgpt-app
npm install
```

### Running Locally (stdio — for MCP Inspector)

```bash
npm run dev
```

### Running for Remote Access (HTTP — for ChatGPT / ngrok)

```bash
# Terminal 1: Start HTTP server
npm run dev:http
# → 🚀 syf-marketplace-mcp v1.0.0 running on port 3000
# → [syf-marketplace-mcp] SYF Offers API working! returned 520 offers.

# Terminal 2: Expose via ngrok
ngrok http 3000
# → Forwarding: https://abc123.ngrok-free.app → localhost:3000
```

See [TESTING.md](./TESTING.md) for detailed testing steps.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with **stdio** transport (local MCP Inspector) |
| `npm run dev:http` | Start server with **HTTP/SSE** transport (ngrok / remote) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS from `dist/` |

---

## Environment Variables

Create a `.env` file in the project root (already listed in `.gitignore` — never commit it):

```env
# SYF Marketplace API
SYF_API_URL=https://api.syf.com/v1/marketing/offers
SYF_API_KEY=your-api-key-here

# Server
PORT=3000
```

`tsx` (used by `npm run dev` and `npm run dev:http`) loads `.env` automatically — no extra packages needed.

> If `SYF_API_KEY` is missing or empty, the server falls back to the `MOCK_OFFERS` dataset automatically.
