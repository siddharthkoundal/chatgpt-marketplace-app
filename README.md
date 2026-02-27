# chatgpt-marketplace-app

> A **Model Context Protocol (MCP) server** that allows ChatGPT and AI agents to fetch live product offers from the Synchrony Marketplace API in real-time.

Built at **Synchrony Financial** by the Marketplace AI team.

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
- [Upgrading to the Real API](#upgrading-to-the-real-api)

---

## What is MCP?

**Model Context Protocol (MCP)** is an open standard that lets AI models (like ChatGPT) call external tools and fetch live data — similar to how a browser uses REST APIs, but designed specifically for LLM tool use.

```
ChatGPT ──────── MCP Protocol ────────► MCP Server ────► Your API
         "call get_offers tool"         (this repo)      (Synchrony)
         ◄──────────────────────────────              ◄──────────
              Returns structured JSON
```

When a user asks ChatGPT *"What mattress deals are available under $1000?"*, ChatGPT automatically:
1. Recognizes it needs real data
2. Calls our `get_offers` tool via MCP
3. Receives a structured JSON list of offers
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
              │  fetchOffersFromSynchrony  │  ← src/api/synchronyClient.ts
              │  (mock now → real later)   │
              └─────────────┬──────────────┘
                            │
              ┌─────────────▼──────────────┐
              │    SYNCHRONY MARKETPLACE    │
              │         API (External)      │
              │  (hardcoded mock for now)  │
              └────────────────────────────┘
```

---

## Project Structure

```
chatgpt-app/
│
├── src/
│   ├── index.ts                  # Entry point: stdio transport (local dev & MCP Inspector)
│   ├── server.ts                 # Entry point: HTTP/SSE transport (ngrok & remote clients)
│   │
│   ├── schemas/
│   │   └── offerSchema.ts        # Zod schemas: input args + offer output shape
│   │
│   ├── api/
│   │   └── synchronyClient.ts    # API client (mock data, ready for real API)
│   │
│   └── tools/
│       └── getOffers.ts          # Tool handler: validate → fetch → format → respond
│
├── package.json                  # Dependencies + npm scripts
├── tsconfig.json                 # TypeScript: ES2022, NodeNext, strict mode
├── .gitignore
├── README.md                     # ← You are here
└── TESTING.md                    # Step-by-step testing guide
```

---

## Data Flow

Here is the exact journey of a single tool call from ChatGPT to a response:

```
1. ChatGPT sends:
   { "method": "tools/call", "params": { "name": "get_offers", "arguments": { "industry": ["FURNITURE"], "featured": true } } }

2. src/index.ts (or server.ts) — McpServer receives the tool call
   └── SDK automatically validates args against GetOffersInputZodShape (Zod)
       ├── FAIL → SDK returns a validation error to ChatGPT (no handler called)
       └── PASS → calls the registered handler with typed GetOffersInput args

3. src/tools/getOffers.ts :: handleGetOffers(args: GetOffersInput)
   └── No Zod safeParse here — SDK already guaranteed types are correct
       └── calls fetchOffersFromSynchrony(args)

4. src/api/synchronyClient.ts :: fetchOffersFromSynchrony()
   └── Applies multi-param filters in order:
       industry → category (legacy) → offerType → region → network → brand → featured → pagination
       └── Returns: Offer[]

5. src/tools/getOffers.ts :: formatOfferForChatGPT()
   └── Strips raw image URLs + internal IDs (noise for the model)
       └── Surfaces: brand, offerType, links, keywords, expiryMsg, disclosure
       └── Wraps in envelope: { totalOffers, appliedFilters, offers: [...] }

6. ChatGPT receives the JSON and presents offers to the user.
```

---

## Transport Modes

This server supports two transport modes. Use the right one depending on your context:

| Mode | File | Command | Use When |
|------|------|---------|----------|
| **stdio** | `src/index.ts` | `npm run dev` | Local MCP Inspector, Claude Desktop |
| **HTTP/SSE** | `src/server.ts` | `npm run dev:http` | Remote access via ngrok, ChatGPT Agents SDK |

### How HTTP/SSE Transport Works

```
Client (ChatGPT)                    Our Server (src/server.ts)
      │                                       │
      │── GET /sse ────────────────────────►  │  Opens SSE stream
      │  ◄──── event: endpoint ──────────────│  Server sends: /messages?sessionId=<id>
      │                                       │
      │── POST /messages?sessionId=<id> ────► │  Client sends tool call
      │    body: { method: "tools/call", ... }│
      │                                       │  Server processes request
      │  ◄──── SSE event: response ──────────│  Response arrives via SSE stream
```

---

## OpenAI Integration

> **Source:** [OpenAI Apps SDK — Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server) · [MCP concept overview](https://developers.openai.com/apps-sdk/concepts/mcp-server/)

### How ChatGPT Uses Your MCP Server

When a user types a prompt in ChatGPT, the model:
1. Reads your tool descriptors (name, description, input schema)
2. Decides whether to call a tool based on user intent
3. Sends a `tools/call` request with arguments
4. Receives your JSON response and narrates it to the user

> **Important:** *You define the tools, but ChatGPT's model decides when to call them* — based on the names and descriptions you write. Treat your tool description as part of your UX.

### Recommended Transport: Streamable HTTP

Per official OpenAI docs, **Streamable HTTP is the recommended transport** for production. SSE (HTTP + Server-Sent Events) is supported but considered legacy.

| Transport | Status | Use When |
|-----------|--------|----------|
| `stdio` | ✅ Active | Local MCP Inspector, Claude Desktop |
| `SSE` | ⚠️ Legacy | Remote testing with ngrok (currently used here) |
| `Streamable HTTP` | ✅ Recommended | Production deployments to ChatGPT |

To upgrade to Streamable HTTP, use `StreamableHttpServerTransport` from the SDK:
```typescript
import { StreamableHttpServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

### Tool Annotations (Required by ChatGPT)

Per the OpenAI Apps SDK docs, ChatGPT **requires** tool annotations that describe potential impact. Add these to `registerTool()`:

```typescript
server.registerTool("get_offers", {
  description: "...",
  inputSchema: GetOffersInputZodShape,
  annotations: {
    readOnlyHint: true,      // ✅ we only READ data, never write
    openWorldHint: false,    // ✅ scoped to Synchrony Marketplace only
    destructiveHint: false,  // ✅ no deletes or irreversible actions
  },
}, handler);
```

| Annotation | Our Value | Why |
|-----------|-----------|-----|
| `readOnlyHint` | `true` | `get_offers` only fetches data |
| `openWorldHint` | `false` | Scoped to Synchrony Marketplace, not arbitrary URLs |
| `destructiveHint` | `false` | No writes or deletes |

### What `structuredContent` Is (Future Enhancement)

The OpenAI Apps SDK supports a richer tool response format:

```typescript
return {
  structuredContent: { totalOffers: 3, offers: [...] }, // ← model reads this
  content: [{ type: "text", text: "Found 3 offers." }], // ← narration
  _meta: { rawApiResponse: ... },                        // ← widget only, hidden from model
};
```

- `content` — what we return today (works for any MCP client)
- `structuredContent` — concise JSON the model reasons about (ChatGPT-optimized)
- `_meta` — large/sensitive data sent only to the UI widget, never to the model

### Official References

| Resource | Link |
|----------|------|
| OpenAI Apps SDK: Build MCP server | [developers.openai.com/apps-sdk/build/mcp-server](https://developers.openai.com/apps-sdk/build/mcp-server) |
| MCP concept overview | [developers.openai.com/apps-sdk/concepts/mcp-server](https://developers.openai.com/apps-sdk/concepts/mcp-server/) |
| TypeScript SDK (used in this project) | [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| MCP Specification | [spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io) |
| MCP Inspector (testing tool) | [modelcontextprotocol.io/docs/tools/inspector](https://modelcontextprotocol.io/docs/tools/inspector) |

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm v9+
- [ngrok](https://ngrok.com) (only for remote/HTTP mode)

### Installation

```bash
# Clone the repository
git clone https://github.com/siddharthkoundal/chatgpt-marketplace-app.git
cd chatgpt-marketplace-app

# Install dependencies
npm install
```

### Running Locally (stdio — for MCP Inspector)

```bash
npm run dev
```

### Running for Remote Access (HTTP/SSE — for ChatGPT SDK / ngrok)

```bash
# Terminal 1: Start HTTP server
npm run dev:http
# → 🚀 Server running on port 3000

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

Create a `.env` file in the root (never commit this):

```env
PORT=3000                          # HTTP server port (default: 3000)
SYNCHRONY_API_BASE_URL=https://... # Real Synchrony API base URL (when available)
SYNCHRONY_API_KEY=your-key-here    # API key for authentication
```

> ⚠️ `.env` is listed in `.gitignore`. Never commit API keys.

---

## Upgrading to the Real API

In `src/api/synchronyClient.ts`, replace the mock implementation with:

```typescript
import axios from 'axios';

const res = await axios.get(`${process.env.SYNCHRONY_API_BASE_URL}/getoffers`, {
  headers: {
    'X-SYF-API-KEY': process.env.SYNCHRONY_API_KEY,
    'X-SYF-Channel-Name': process.env.SYNCHRONY_CHANNEL_NAME,
  },
  params: {
    campaignMappingId: process.env.SYNCHRONY_CAMPAIGN_ID,
    industry:          input.industry,
    offerType:         input.offerType,
    region:            input.region,
    network:           input.network,
    brand:             input.brand,
    featured:          input.featured,
    limitOffersCount:  input.limitOffersCount,
    offset:            input.offset,
  },
});

// SynchronyApiResponseSchema validates the full response shape at runtime —
// catches any API contract drift immediately.
const data = SynchronyApiResponseSchema.parse(res.data);
return data.offers;
```

The Zod schema in `src/schemas/offerSchema.ts` will automatically catch any shape mismatches between the real API and what our tool expects — acting as a live contract test.
