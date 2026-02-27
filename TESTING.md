# Testing Guide

Step-by-step instructions for testing the Synchrony MCP Server at every layer — from a quick type check to a live tool call via ngrok.

---

## Method 1 — MCP Inspector (Recommended for Daily Dev)

**MCP Inspector** is the official visual playground for MCP servers. It lets you list tools, fill in arguments, and see responses — without writing any code.

### Step 1 — Start the Server

Open a terminal in the project root and choose your transport:

**Option A — stdio (simplest, no port needed):**
```bash
npm run dev
```

**Option B — HTTP/SSE (needed for ngrok/remote):**
```bash
npm run dev:http
```

---

### Step 2 — Launch MCP Inspector

Open a **second terminal**:
```bash
npx @modelcontextprotocol/inspector
```

The Inspector UI opens automatically at:
```
http://localhost:5173
```

---

### Step 3 — Connect to the Server

#### If you used `npm run dev` (stdio):
1. Transport dropdown → select **`STDIO`**
2. Command: `tsx`
3. Arguments: `src/index.ts`
4. Click **Connect**

#### If you used `npm run dev:http` (HTTP/SSE):
1. Transport dropdown → select **`SSE`**
2. URL: `http://localhost:3000/sse`
3. Click **Connect**

#### If using ngrok (remote SSE):
1. Transport dropdown → select **`SSE`**
2. URL: `https://<your-ngrok-url>.ngrok-free.app/sse`
3. Click **Connect**

> ✅ You should see: **"Connected"** status in the top bar.

---

### Step 4 — List Available Tools

1. Click the **"Tools"** tab in the left sidebar
2. Click **"List Tools"**
3. You should see `get_offers` appear with its description

Expected response:
```json
{
  "tools": [
    {
      "name": "get_offers",
      "description": "Fetches product offers from the Synchrony Marketplace API. Filter by: industry (FURNITURE, ELECTRONICS & APPLIANCES, HOME IMPROVEMENT, etc.), offerType (DEALS, FINANCING OFFERS, EVERYDAY VALUE), region (MIDWEST, NORTHEAST, SOUTH, SOUTHEAST, WEST), network (SYNCHRONY HOME, SYNCHRONY CAR CARE, ...), brand name, or featured (true/false). Use 'category' for a free-text keyword search.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "category":         { "type": "string" },
          "industry":         { "type": "array", "items": { "type": "string", "enum": ["FURNITURE", "ELECTRONICS & APPLIANCES", "HOME IMPROVEMENT", "..." ] } },
          "offerType":        { "type": "array", "items": { "type": "string", "enum": ["DEALS", "FINANCING OFFERS", "EVERYDAY VALUE"] } },
          "region":           { "type": "string", "enum": ["MIDWEST", "NORTHEAST", "SOUTH", "SOUTHEAST", "WEST"] },
          "network":          { "type": "array", "items": { "type": "string", "enum": ["SYNCHRONY HOME", "SYNCHRONY CAR CARE", "SYNCHRONY FLOORING", "SYNCHRONY POWERSPORTS"] } },
          "brand":            { "type": "string" },
          "featured":         { "type": "boolean" },
          "limitOffersCount": { "type": "integer" },
          "offset":           { "type": "integer" },
          "maxPrice":         { "type": "number" }
        }
      }
    }
  ]
}
```

---

### Step 5 — Run the Tool

2. Fill in the arguments panel:

| Field | Example Value | Notes |
|-------|--------------|-------|
| `industry` | `["FURNITURE"]` | Enum: FURNITURE, ELECTRONICS & APPLIANCES, HOME IMPROVEMENT, etc. |
| `offerType` | `["DEALS"]` | Enum: DEALS, FINANCING OFFERS, EVERYDAY VALUE |
| `region` | `"MIDWEST"` | Enum: MIDWEST, NORTHEAST, SOUTH, SOUTHEAST, WEST |
| `network` | `["SYNCHRONY HOME"]` | Enum: SYNCHRONY HOME, SYNCHRONY CAR CARE, SYNCHRONY FLOORING, SYNCHRONY POWERSPORTS |
| `brand` | `"Ashley"` | Substring match |
| `featured` | `true` | Boolean |
| `category` | `"furniture"` | Legacy free-text search (maps to industry/brand name) |
| `limitOffersCount` | `3` | Optional pagination |

3. Click **"Run Tool"**

Expected response:
```json
{
  "content": [{
    "type": "text",
    "text": "{\n  \"totalOffers\": 2,\n  \"appliedFilters\": { \"industry\": [\"FURNITURE\"] },\n  \"offers\": [\n    {\n      \"offerId\": \"offer-furniture-001\",\n      \"title\": \"Get up to a $100 Visa Prepaid Card\",\n      \"offerType\": \"DEALS\",\n      \"brand\": { \"name\": \"Ashley\", \"featured\": true, \"industries\": [\"FURNITURE\", \"HOME IMPROVEMENT\"], \"network\": \"SYNCHRONY HOME\" },\n      \"links\": [{ \"label\": \"Card Details\", \"url\": \"...\" }, { \"label\": \"Apply\", \"url\": \"...\" }],\n      \"expiryMsg\": \"Offer valid through Dec 2024\"\n    },\n    ...\n  ]\n}"
  }]
}
```

---

### Step 6 — Test Edge Cases

Try these to verify filtering and edge case handling:

#### ✅ Industry filter
```json
{ "industry": ["FURNITURE"] }
```
→ Returns Ashley + Rooms To Go offers.

#### ✅ Offer type filter
```json
{ "offerType": ["FINANCING OFFERS"] }
```
→ Returns Rooms To Go and Best Buy financing offers.

#### ✅ Network filter
```json
{ "network": ["SYNCHRONY CAR CARE"] }
```
→ Returns Express Oil Change offer only.

#### ✅ Featured only
```json
{ "featured": true }
```
→ Returns Ashley, Samsung, Best Buy, Lowe's (featured: true).

#### ✅ Region filter
```json
{ "industry": ["FURNITURE"], "region": "NORTHEAST" }
```
→ Returns only Ashley (Rooms To Go doesn't cover NORTHEAST in mock data).

#### ✅ Brand substring match
```json
{ "brand": "best" }
```
→ Returns Best Buy offer.

#### ✅ Legacy category filter (backward compat)
```json
{ "category": "electronics" }
```
→ Returns Samsung + Best Buy (matches "ELECTRONICS & APPLIANCES" industry).

#### ✅ No results
```json
{ "industry": ["JEWELRY"] }
```
→ Returns: `No offers found for industry "JEWELRY"` (no mock data for this industry).

#### ❌ Invalid enum value
```json
{ "industry": ["BEDS"] }
```
→ SDK Zod validation error before handler is called: `Invalid enum value for industry`.

#### ❌ Invalid type
```json
{ "featured": "yes" }
```
→ SDK Zod validation error: `Expected boolean, received string`.

---

## Method 2 — TypeScript Compiler Check

Catches type errors before running anything:

```bash
npx tsc --noEmit
```

✅ Expected: no output, exits with code `0`  
❌ If errors appear: check the file and line number reported

---

## Method 3 — Health Check (HTTP mode only)

With `npm run dev:http` running:

```bash
curl http://localhost:3000/health
```

Expected:
```json
{
  "status": "ok",
  "server": "synchrony-marketplace-mcp",
  "version": "1.0.0",
  "activeSessions": 0
}
```

---

## Method 4 — Raw SSE Handshake Test (HTTP mode only)

Manually verify the SSE connection and session negotiation:

```bash
# Step 1: Open SSE stream (leave this running)
curl -N http://localhost:3000/sse

# Expected output:
# event: endpoint
# data: /messages?sessionId=<some-uuid>
```

Copy the `sessionId` from the output, then in a second terminal:

```bash
# Step 2: Send a tools/list call using the sessionId from above
curl -X POST "http://localhost:3000/messages?sessionId=<paste-sessionId-here>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

The response will arrive in the **first terminal** (the SSE stream), not in this second terminal — that's how SSE works.

---

## Method 5 — ngrok End-to-End Test

Test the full public internet path:

```bash
# Terminal 1
npm run dev:http

# Terminal 2
ngrok http 3000
# Copy the Forwarding URL e.g. https://abc123.ngrok-free.app

# Terminal 3 — verify health over public URL
curl https://abc123.ngrok-free.app/health

# Terminal 3 — verify SSE stream over public URL
curl -N https://abc123.ngrok-free.app/sse
```

Then open MCP Inspector, set transport to SSE, set URL to the ngrok `/sse` URL, and connect.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_NGROK_8012 connection refused` | HTTP server not running | Run `npm run dev:http` first |
| `stream is not readable` (old) | `express.json()` conflict | Already fixed — pull latest code |
| `POST /messages 400 Bad Request` | Missing `?sessionId=` param | Let the Inspector handle this — don't POST manually without the sessionId from the SSE endpoint event |
| `POST /sse 404 Not Found` | Client posted to wrong URL | `/sse` is GET only. POST goes to `/messages` |
| `No offers found` | Category not in mock data | Try: `beds`, `electronics`, `appliances` |
| `Tool returns validation error` | Wrong arg type or invalid enum | `industry` must be an array of valid enum strings; `featured` must be boolean |

---

## Method 6 — OpenAI Responses API (Direct ChatGPT Integration)

> **Source:** [OpenAI Docs — MCP Tool Guide](https://developers.openai.com/cookbook/examples/mcp/mcp_tool_guide/)

This tests your server from the **OpenAI Responses API** side — the same path ChatGPT uses internally when it calls your tool.

### Prerequisites

- Server running via `npm run dev:http` + ngrok exposed
- OpenAI API key with access to `gpt-4o` or `gpt-4.1`

### Test with Python (OpenAI SDK)

```python
import openai

client = openai.OpenAI(api_key="sk-...")

response = client.responses.create(
    model="gpt-4o",
    tools=[
        {
            "type": "mcp",
            "server_label": "synchrony-marketplace",
            "server_url": "https://<your-ngrok-url>.ngrok-free.app",   # your ngrok URL
            "require_approval": "never",                                 # auto-approve tool calls
        }
    ],
    input="What bed offers are available under $1000?",
)

print(response.output_text)
```

**What happens:**
1. Responses API connects to your ngrok URL, calls `tools/list`, discovers `get_offers`
2. Model decides to call `get_offers` with `{"industry": ["FURNITURE"], "featured": true}`
3. Responses API calls `tools/call` on your server, gets back the offer JSON
4. Model composes a response and returns it as `response.output_text`

### Test with the OpenAI Playground

1. Go to [platform.openai.com/playground](https://platform.openai.com/playground)
2. **Tools** → **Add MCP server**
3. Enter your ngrok URL in the server URL field
4. Type: *"Show me electronics deals under $500"*
5. Watch the model call `get_offers` and use the result

---

## OpenAI-Specific Checklist

Before submitting your app to ChatGPT's app directory, verify these items per the [official OpenAI Apps SDK docs](https://developers.openai.com/apps-sdk/build/mcp-server):

### ✅ Tool Annotations (Required)
Per OpenAI docs, all tools must declare annotations. Add these to `registerTool()` in `src/index.ts` and `src/server.ts`:

```typescript
annotations: {
  readOnlyHint: true,      // get_offers reads data only
  openWorldHint: false,    // scoped to Synchrony Marketplace
  destructiveHint: false,  // no deletes or side effects
}
```

| Annotation | Required When | Our Value |
|-----------|--------------|-----------|
| `readOnlyHint: true` | Tool only fetches data | ✅ |
| `openWorldHint: false` | Tool is scoped to one system | ✅ |
| `destructiveHint: false` | Tool has no irreversible effects | ✅ |

### ⚠️ Transport: SSE → Streamable HTTP for Production
The official docs state SSE transport is **legacy**. For production ChatGPT integration:
- Current: `SSEServerTransport` from `server/sse.js` (works for testing)
- Recommended: `StreamableHttpServerTransport` from `server/streamableHttp.js`

### ✅ HTTPS Required
ChatGPT requires an HTTPS endpoint. During dev, ngrok provides this automatically.
For production: deploy to Cloudflare Workers, Fly.io, Vercel, or AWS with TLS.

### ✅ Tool Descriptions = Your UX
From OpenAI docs: *"The model inspects tool descriptors to decide when a tool fits the user's request — treat names, descriptions, and schemas as part of your UX."*

Review `get_offers` description in `src/index.ts` to make it as clear as possible for the model.

### ✅ Make Handlers Idempotent
From OpenAI docs: *"Design handlers to be idempotent — the model may retry calls."*
Our current `get_offers` is already idempotent (read-only, returns same data for same input). ✅

