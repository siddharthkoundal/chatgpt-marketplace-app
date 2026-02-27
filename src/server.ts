/**
 * src/server.ts — HTTP transport entry point
 *
 * TWO transports on port 3000:
 *
 *   Streamable HTTP  →  POST /mcp  (recommended, used by OpenAI Responses API)
 *     Stateless per request. Each request creates a fresh McpServer.
 *
 *   SSE (legacy)     →  GET /sse + POST /messages  (used by MCP Inspector)
 *     Stateful. One McpServer per connection; sessions stored in activeSessions.
 *
 * Note: express.json() is NOT applied globally — SSEServerTransport.handlePostMessage
 * reads the raw body itself. Applying json() globally causes "stream is not readable".
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { handleGetOffers } from "./tools/getOffers.js";
import { GetOffersInputZodShape } from "./schemas/offerSchema.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const SERVER_NAME = "syf-marketplace-mcp";
const SERVER_VERSION = "1.0.0";

// SSE session registry — Streamable HTTP is stateless and doesn't need this.
const activeSessions = new Map<
    string,
    { transport: SSEServerTransport; server: McpServer }
>();

function createMcpServer(): McpServer {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

    // TODO: Add annotations before ChatGPT App Store submission:
    //   annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    server.registerTool(
        "get_offers",
        {
            description: [
                "Fetches product offers from the SYF Marketplace API (prototype).",
                "Filter by: industry (FURNITURE, ELECTRONICS & APPLIANCES, HOME IMPROVEMENT, etc.),",
                "offerType (DEALS, FINANCING OFFERS, EVERYDAY VALUE),",
                "region (MIDWEST, NORTHEAST, SOUTH, SOUTHEAST, WEST),",
                "network (SYF HOME, SYF CAR CARE, SYF FLOORING, SYF POWERSPORTS),",
                "brand name (e.g. 'Ashley', 'Best Buy'), or featured (true/false).",
                "Use 'category' for a free-text keyword search across industry and brand names.",
            ].join(" "),
            inputSchema: GetOffersInputZodShape,
        },
        async (args) => handleGetOffers(args)
    );

    return server;
}

const app = express();

// ---------------------------------------------------------------------------
// STREAMABLE HTTP — POST /mcp
// Used by: OpenAI Responses API, modern MCP clients
// Stateless: each request spins up a fresh McpServer + transport pair.
// ---------------------------------------------------------------------------
app.post("/mcp", express.json(), async (req, res) => {
    console.log(`[${SERVER_NAME}] Streamable HTTP request from ${req.ip}`);
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

// Streamable HTTP requires GET /mcp for SSE streaming of long responses.
app.get("/mcp", async (req, res) => {
    console.log(`[${SERVER_NAME}] Streamable HTTP GET /mcp from ${req.ip}`);
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
});

// ---------------------------------------------------------------------------
// SSE (LEGACY) — GET /sse + POST /messages
// Used by: MCP Inspector, older clients
// ---------------------------------------------------------------------------
app.get("/sse", async (req, res) => {
    console.log(`[${SERVER_NAME}] New SSE connection from ${req.ip}`);
    const transport = new SSEServerTransport("/messages", res);
    const server = createMcpServer();

    await server.connect(transport);

    const sessionId = transport.sessionId;
    activeSessions.set(sessionId, { transport, server });
    console.log(`[${SERVER_NAME}] SSE session started: ${sessionId}`);

    res.on("close", () => {
        console.log(`[${SERVER_NAME}] SSE session closed: ${sessionId}`);
        activeSessions.delete(sessionId);
    });
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId query parameter." });
        return;
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
        res.status(404).json({ error: `Session "${sessionId}" not found or already closed.` });
        return;
    }

    await session.transport.handlePostMessage(req, res);
});

// ---------------------------------------------------------------------------
// HEALTH CHECK
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        server: SERVER_NAME,
        version: SERVER_VERSION,
        activeSessions: activeSessions.size,
        endpoints: {
            streamableHttp: "POST /mcp  ← OpenAI Responses API",
            sse: "GET  /sse  ← MCP Inspector (legacy)",
        },
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 ${SERVER_NAME} v${SERVER_VERSION} running on port ${PORT}`);
    console.log(`\n   Streamable HTTP: http://localhost:${PORT}/mcp   ← OpenAI Responses API`);
    console.log(`   SSE (legacy):    http://localhost:${PORT}/sse   ← MCP Inspector`);
    console.log(`   Health check:    http://localhost:${PORT}/health`);
    console.log(`\n   Run ngrok:  ngrok http ${PORT}`);
    console.log(`   OpenAI script URL: https://<ngrok-url>/mcp\n`);
});
