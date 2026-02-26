/**
 * src/server.ts — HTTP/SSE transport entry point
 *
 * Runs the same MCP tools as src/index.ts but over HTTP using Server-Sent Events,
 * so remote clients (ChatGPT Agents SDK, ngrok) can connect.
 *
 * SSE protocol: two endpoints
 *   GET  /sse              → client opens persistent stream; server replies with sessionId
 *   POST /messages?sessionId=<id> → client sends JSON-RPC; server responds via the SSE stream
 *
 * One McpServer instance per SSE connection (SSEServerTransport is stateful — it owns
 * the response stream for exactly one client). Sessions are stored in `activeSessions`.
 *
 * Transport upgrade path (OpenAI recommendation):
 *   SSEServerTransport      → legacy, works today with MCP Inspector + ngrok
 *   StreamableHttpServerTransport → recommended for production ChatGPT integration
 *   Import from: @modelcontextprotocol/sdk/server/streamableHttp.js
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

import { handleGetOffers } from "./tools/getOffers.js";
import { GetOffersInputZodShape } from "./schemas/offerSchema.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const SERVER_NAME = "synchrony-marketplace-mcp";
const SERVER_VERSION = "1.0.0";

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
                "Fetches live product offers from the Synchrony Marketplace API.",
                "Use this tool when the user asks about available products, deals, or financing options",
                "in a specific category (e.g., 'beds', 'electronics', 'appliances').",
                "Optionally filter results by a maximum price.",
            ].join(" "),
            inputSchema: GetOffersInputZodShape,
        },
        async (args) => handleGetOffers(args)
    );

    return server;
}

const app = express();

app.get("/sse", async (req, res) => {
    console.log(`[${SERVER_NAME}] New SSE connection from ${req.ip}`);
    const transport = new SSEServerTransport("/messages", res);
    const server = createMcpServer();

    await server.connect(transport);

    const sessionId = transport.sessionId;
    activeSessions.set(sessionId, { transport, server });
    console.log(`[${SERVER_NAME}] Session started: ${sessionId}`);

    res.on("close", () => {
        console.log(`[${SERVER_NAME}] Session closed: ${sessionId}`);
        activeSessions.delete(sessionId);
    });
});

// express.json() intentionally NOT used globally — SSEServerTransport.handlePostMessage
// reads the raw request body stream itself. Parsing it first causes "stream is not readable".
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

app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: SERVER_NAME, version: SERVER_VERSION, activeSessions: activeSessions.size });
});

app.listen(PORT, () => {
    console.log(`\n🚀 ${SERVER_NAME} v${SERVER_VERSION} running on port ${PORT}`);
    console.log(`\n   SSE endpoint:    http://localhost:${PORT}/sse`);
    console.log(`   Message endpoint: http://localhost:${PORT}/messages`);
    console.log(`   Health check:     http://localhost:${PORT}/health`);
    console.log(`\n   Run ngrok:  ngrok http ${PORT}`);
    console.log(`   Then use the ngrok URL as your MCP server URL in ChatGPT.\n`);
});
