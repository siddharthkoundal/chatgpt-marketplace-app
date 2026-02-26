/**
 * src/server.ts
 *
 * PURPOSE:
 * This is the HTTP/SSE entry point for the Synchrony MCP Server.
 * It runs the SAME tools and handlers as src/index.ts (stdio), but exposes
 * them over HTTP using Server-Sent Events (SSE) so that remote clients like
 * the ChatGPT Agents SDK can connect over the internet (via ngrok).
 *
 * HOW THE SSE TRANSPORT WORKS:
 * The MCP SSE protocol uses TWO HTTP endpoints:
 *
 *   GET /sse
 *     ↳ The client (ChatGPT) opens a persistent SSE connection here.
 *       The server sends events (tool responses, etc.) through this stream.
 *       On connect, the server immediately sends an "endpoint" event telling
 *       the client which URL to POST messages to.
 *
 *   POST /messages?sessionId=<id>
 *     ↳ The client sends JSON-RPC requests (tool calls, list tools, etc.)
 *       as HTTP POST bodies. The server processes them and sends responses
 *       back through the open SSE stream.
 *
 * RUNNING THIS SERVER:
 *   npm run dev:http          ← starts on port 3000
 *   ngrok http 3000           ← exposes it publicly
 *
 * ARCHITECTURE NOTE:
 * We keep src/index.ts (stdio) alive for local MCP Inspector testing.
 * This file is ONLY for HTTP/remote access.
 */

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handleGetOffers } from "./tools/getOffers.js";

// ---------------------------------------------------------------------------
// SERVER CONFIGURATION
// ---------------------------------------------------------------------------

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const SERVER_NAME = "synchrony-marketplace-mcp";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// TOOL DEFINITION
// (Same as in index.ts – describes get_offers to any connecting MCP client)
// ---------------------------------------------------------------------------

const GET_OFFERS_TOOL = {
    name: "get_offers",
    description: [
        "Fetches live product offers from the Synchrony Marketplace API.",
        "Use this tool when the user asks about available products, deals, or financing options",
        "in a specific category (e.g., 'beds', 'electronics', 'appliances').",
        "Optionally filter results by a maximum price.",
    ].join(" "),
    inputSchema: {
        type: "object" as const,
        properties: {
            category: {
                type: "string",
                description:
                    "The product category to search for. Examples: 'beds', 'electronics', 'appliances'.",
            },
            maxPrice: {
                type: "number",
                description:
                    "Optional. Maximum price in USD. Only returns offers at or below this price.",
            },
        },
        required: ["category"],
        additionalProperties: false,
    },
};

// ---------------------------------------------------------------------------
// SESSION MANAGEMENT
// Each SSE connection gets its own MCP Server + Transport pair.
// We store them in a Map keyed by sessionId so POST /messages can route
// incoming JSON-RPC calls to the correct open SSE connection.
//
// WHY ONE SERVER PER SESSION?
// The MCP SDK's SSEServerTransport is stateful – it owns the SSE response
// stream for one client. Multiple simultaneous clients (e.g., ChatGPT calling
// it from different sessions) each need their own instance.
// ---------------------------------------------------------------------------

const activeSessions = new Map<
    string,
    { transport: SSEServerTransport; server: Server }
>();

// ---------------------------------------------------------------------------
// FACTORY: createMcpServer
// Creates a fresh MCP Server instance with all tools registered.
// Called once per new SSE connection.
// ---------------------------------------------------------------------------

function createMcpServer(): Server {
    const server = new Server(
        { name: SERVER_NAME, version: SERVER_VERSION },
        { capabilities: { tools: {} } }
    );

    // Register: tools/list — returns the list of available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log(`[${SERVER_NAME}] tools/list called`);
        return { tools: [GET_OFFERS_TOOL] };
    });

    // Register: tools/call — routes to the correct handler by tool name
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name: toolName, arguments: toolArgs } = request.params;
        console.log(`[${SERVER_NAME}] tools/call → "${toolName}"`);

        switch (toolName) {
            case "get_offers":
                return await handleGetOffers(toolArgs);

            default:
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Unknown tool: "${toolName}". Available tools: get_offers.`,
                        },
                    ],
                    isError: true,
                };
        }
    });

    return server;
}

// ---------------------------------------------------------------------------
// EXPRESS APP + ROUTES
// ---------------------------------------------------------------------------

const app = express();

/**
 * GET /sse
 *
 * The client opens this endpoint to establish a persistent SSE connection.
 * We:
 *   1. Create a new MCP Server instance for this session.
 *   2. Create an SSEServerTransport bound to this HTTP response stream.
 *   3. Store the session so POST /messages can find it.
 *   4. Connect the server to the transport (starts the event loop).
 *
 * The SDK automatically sends an "endpoint" event to the client with the
 * POST URL it should use for sending messages: /messages?sessionId=<id>
 */
app.get("/sse", async (req, res) => {
    console.log(`[${SERVER_NAME}] New SSE connection from ${req.ip}`);

    // Create a transport bound to this SSE response stream.
    // The second arg is the POST endpoint path the client should send messages to.
    const transport = new SSEServerTransport("/messages", res);
    const server = createMcpServer();

    // Store this session — the sessionId is stamped onto the transport by the SDK.
    // We access it after connect() so the SDK has had a chance to assign it.
    await server.connect(transport);

    const sessionId = transport.sessionId;
    activeSessions.set(sessionId, { transport, server });
    console.log(`[${SERVER_NAME}] Session started: ${sessionId}`);

    // Clean up when the client disconnects (e.g., ChatGPT closes the tab).
    res.on("close", () => {
        console.log(`[${SERVER_NAME}] Session closed: ${sessionId}`);
        activeSessions.delete(sessionId);
    });
});

/**
 * POST /messages?sessionId=<id>
 *
 * The client sends JSON-RPC messages (tool calls, list tools, etc.) here.
 * We look up the session by sessionId and hand the raw request off to the
 * SSEServerTransport which deserializes it and dispatches to the MCP server.
 */
app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId query parameter." });
        return;
    }

    const session = activeSessions.get(sessionId);

    if (!session) {
        res
            .status(404)
            .json({ error: `Session "${sessionId}" not found or already closed.` });
        return;
    }

    // Hand the raw HTTP request to the transport. The SDK handles parsing,
    // routing, and sending the response back through the SSE stream.
    await session.transport.handlePostMessage(req, res);
});

/**
 * GET /health
 * Simple health check endpoint — useful for monitoring and ngrok verification.
 */
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        server: SERVER_NAME,
        version: SERVER_VERSION,
        activeSessions: activeSessions.size,
    });
});

// ---------------------------------------------------------------------------
// START HTTP SERVER
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`\n🚀 ${SERVER_NAME} v${SERVER_VERSION} running on port ${PORT}`);
    console.log(`\n   SSE endpoint:    http://localhost:${PORT}/sse`);
    console.log(`   Message endpoint: http://localhost:${PORT}/messages`);
    console.log(`   Health check:     http://localhost:${PORT}/health`);
    console.log(`\n   Run ngrok:  ngrok http ${PORT}`);
    console.log(
        `   Then use the ngrok URL as your MCP server URL in ChatGPT.\n`
    );
});
