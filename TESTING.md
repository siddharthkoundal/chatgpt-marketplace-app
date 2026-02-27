# Testing Guide

Step-by-step instructions for testing the SYF Marketplace MCP Server — from a quick health check to a live ChatGPT integration.

> **Live API status:** The server calls `https://api.syf.com/v1/marketing/offers` on every tool invocation and returns **520+ real offers**. Confirm this by looking at the `npm run dev:http` terminal — you'll see `SYF Offers API working! returned 520 offers.` on each call.

---

## Method 1 — MCP Inspector (Recommended for Daily Dev)

**MCP Inspector** is the official visual playground for MCP servers. List tools, fill in arguments, and see live responses.

### Step 1 — Start the Server

```bash
npm run dev:http
```

Expected output:
```
🚀 syf-marketplace-mcp v1.0.0 running on port 3000

   Streamable HTTP: http://localhost:3000/mcp   ← OpenAI Responses API
   SSE (legacy):    http://localhost:3000/sse   ← MCP Inspector
   Health check:    http://localhost:3000/health
```

### Step 2 — Launch MCP Inspector

Open a **second terminal**:
```bash
npx @modelcontextprotocol/inspector
```
Inspector UI opens at `http://localhost:5173`

### Step 3 — Connect to the Server

1. Transport dropdown → select **`SSE`**
2. URL: `http://localhost:3000/sse`
3. Click **Connect**

> ✅ You should see: **"Connected"** status in the top bar.

### Step 4 — List Available Tools

1. Click the **"Tools"** tab → **"List Tools"**
2. You should see `get_offers` appear with its description.

Confirm the network enum values match:
```json
"network": { "enum": ["SYF CAR CARE", "SYF HOME", "SYF FLOORING", "SYF POWERSPORTS"] }
```

### Step 5 — Run the Tool

Fill in the arguments panel and click **"Run Tool"**:

| Field | Example Value | Notes |
|-------|--------------|-------|
| `limitOffersCount` | `5` | Returns first 5 live offers |
| `category` | `"furniture"` | Free-text search against industry + brand + title |
| `industry` | `["FURNITURE"]` | Enum filter |
| `offerType` | `["DEALS"]` | DEALS / FINANCING OFFERS / EVERYDAY VALUE |
| `region` | `"MIDWEST"` | MIDWEST / NORTHEAST / SOUTH / SOUTHEAST / WEST |
| `brand` | `"Lowe's"` | Substring match against brand name |
| `featured` | `true` | Boolean |
| `offset` | `10` | Pagination offset |

**How to tell the response is live data:**
- `offerId` will be a long number like `"1642709078625"` (not `"offer-furniture-001"`)
- Brands you'll see: Pumpkin Pet Insurance, Lowe's, PayPal, Samsung, Amazon, etc.
- Your `npm run dev:http` terminal will print: `SYF Offers API working! returned 520 offers.`

---

## Method 2 — curl (Quick Manual Tests)

With `npm run dev:http` running:

### Health check
```bash
curl http://localhost:3000/health
```
Expected:
```json
{
  "status": "ok",
  "server": "syf-marketplace-mcp",
  "version": "1.0.0",
  "activeSessions": 0
}
```

### Get 3 live offers (no filter)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_offers","arguments":{"limitOffersCount":3}}}'
```

### Filter by category
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_offers","arguments":{"category":"furniture","limitOffersCount":5}}}'
```

### Featured offers only
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_offers","arguments":{"featured":true,"limitOffersCount":5}}}'
```

### Filter by brand
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_offers","arguments":{"brand":"Lowe'\''s"}}}'
```

### List available tools
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

> **Note:** Both `Content-Type: application/json` and `Accept: application/json, text/event-stream` headers are required for the Streamable HTTP `/mcp` endpoint.

---

## Method 3 — TypeScript Compiler Check

Catches type errors before running:

```bash
npx tsc --noEmit
```

✅ Expected: no output, exits with code `0`

---

## Method 4 — Filter Test Cases

Use these in MCP Inspector or curl to exercise all filter paths:

### ✅ Free-text category search
```json
{ "category": "health", "limitOffersCount": 5 }
```
→ Returns health/wellness brands (e.g. Pumpkin Pet Insurance, CareCredit partners).

### ✅ Featured only
```json
{ "featured": true, "limitOffersCount": 5 }
```
→ Returns offers where `brand.featured === true` (e.g. Lowe's, PayPal).

### ✅ Region filter
```json
{ "region": "NORTHEAST", "limitOffersCount": 5 }
```
→ Returns offers available in the Northeast region.

### ✅ Brand substring match
```json
{ "brand": "PayPal" }
```
→ Returns PayPal cashback offer.

### ✅ Pagination
```json
{ "limitOffersCount": 5, "offset": 10 }
```
→ Returns offers 11–15 from the full 520-offer dataset.

### ✅ No results (valid filter, no matching data)
```json
{ "industry": ["JEWELRY"], "limitOffersCount": 5 }
```
→ Returns: `No offers found for industry "JEWELRY".`

### ❌ Invalid enum value (Zod catches before handler)
```json
{ "industry": ["BEDS"] }
```
→ SDK returns Zod validation error: `Invalid enum value for industry`.

### ❌ Wrong type (Zod catches before handler)
```json
{ "featured": "yes" }
```
→ SDK returns Zod validation error: `Expected boolean, received string`.

---

## Method 5 — ngrok End-to-End Test

```bash
# Terminal 1
npm run dev:http

# Terminal 2
ngrok http 3000
# → Forwarding: https://abc123.ngrok-free.app → localhost:3000

# Terminal 3 — verify health over public URL
curl https://abc123.ngrok-free.app/health

# Terminal 3 — test MCP via public URL
curl -s -X POST https://abc123.ngrok-free.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_offers","arguments":{"limitOffersCount":3}}}'
```

Then connect MCP Inspector using the ngrok SSE URL: `https://abc123.ngrok-free.app/sse`

---

## Method 6 — OpenAI Responses API

> Tests your server from the same path ChatGPT uses internally.

```python
import openai

client = openai.OpenAI(api_key="sk-...")

response = client.responses.create(
    model="gpt-4o",
    tools=[
        {
            "type": "mcp",
            "server_label": "syf-marketplace",
            "server_url": "https://<your-ngrok-url>.ngrok-free.app",
            "require_approval": "never",
        }
    ],
    input="What home improvement deals are available?",
)

print(response.output_text)
```

**What happens:**
1. Responses API connects to your ngrok URL, calls `tools/list`, discovers `get_offers`
2. Model decides to call `get_offers` with relevant filters
3. Responses API calls `tools/call`, server hits live SYF API, returns filtered offers
4. Model composes a response from real offer data

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_NGROK_8012 connection refused` | HTTP server not running | Run `npm run dev:http` first |
| `Not Acceptable` on POST /mcp | Missing Accept header | Add `-H "Accept: application/json, text/event-stream"` |
| `POST /sse 404` | Wrong endpoint | `/sse` is GET only; POST goes to `/messages?sessionId=...` |
| `SYF Offers API call failed, falling back to mock` | Network/API error | Check internet connectivity; server auto-falls back to mock |
| `No offers found` | Valid filter, no live data matches | Try broader filters or remove filters entirely |
| Zod validation error | Wrong arg type or invalid enum | `industry` must be array of valid strings; `featured` must boolean |

---

## Confirming Live vs Mock Data

| Signal | Live Data | Mock Fallback |
|--------|-----------|---------------|
| Terminal log | `SYF Offers API working! returned 520 offers.` | `SYF Offers API call failed, falling back to mock:` |
| `offerId` format | Long number: `"1642709078625"` | Readable slug: `"offer-furniture-001"` |
| Brands seen | Pumpkin, PayPal, Lowe's, Sam's Club… | Ashley, Samsung, Best Buy, Rooms To Go |
| Total count | 520 (no filters) | 6 (no filters) |
