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
      "description": "Fetches live product offers from the Synchrony Marketplace API...",
      "inputSchema": {
        "type": "object",
        "properties": {
          "category": { "type": "string" },
          "maxPrice": { "type": "number" }
        },
        "required": ["category"]
      }
    }
  ]
}
```

---

### Step 5 — Run the Tool

1. Click on **`get_offers`** in the tools list
2. Fill in the arguments panel on the right:

| Field | Value | Notes |
|-------|-------|-------|
| `category` | `beds` | Try: `electronics`, `appliances` |
| `maxPrice` | `1000` | Optional — leave blank for no price filter |

3. Click **"Run Tool"**

Expected response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"category\": \"beds\",\n  \"maxPrice\": 1000,\n  \"totalOffers\": 2,\n  \"offers\": [\n    {\n      \"title\": \"Serta Perfect Sleeper Queen Mattress\",\n      \"price\": 799.99,\n      \"discount\": \"15% off for Synchrony cardholders\",\n      \"link\": \"https://marketplace.synchrony.com/offers/beds-001\"\n    },\n    ...\n  ]\n}"
    }
  ]
}
```

---

### Step 6 — Test Edge Cases

Try these to verify validation and error handling work properly:

#### ✅ Valid — no price filter
```json
{ "category": "electronics" }
```
→ Returns all electronics offers.

#### ✅ Valid — tight price filter  
```json
{ "category": "electronics", "maxPrice": 300 }
```
→ Returns only the Sony headphones ($279.99).

#### ✅ Valid — no results
```json
{ "category": "furniture" }
```
→ Returns friendly message: `No offers found in the "furniture" category.`

#### ❌ Invalid — missing required field
```json
{ "maxPrice": 500 }
```
→ Returns Zod validation error: `[category]: Required`

#### ❌ Invalid — wrong type
```json
{ "category": "beds", "maxPrice": "cheap" }
```
→ Returns Zod validation error: `[maxPrice]: Expected number, received string`

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
| Tool returns validation error | Wrong arg type | `category` must be a string, `maxPrice` must be a number |
