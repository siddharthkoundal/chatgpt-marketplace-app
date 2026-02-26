/**
 * src/index.ts
 *
 * PURPOSE:
 * This is the MAIN ENTRY POINT of the Synchrony MCP Server.
 * It is responsible for:
 *   1. Creating and configuring the MCP `Server` instance.
 *   2. Registering the `get_offers` tool with its JSON Schema (converted from Zod).
 *   3. Routing incoming tool call requests to the correct handler function.
 *   4. Connecting the server to the stdio transport (stdin/stdout) so it can
 *      communicate with ChatGPT during local development and testing.
 *
 * HOW MCP WORKS (HIGH LEVEL):
 *  ┌─────────────┐      JSON-RPC over stdio      ┌──────────────────────┐
 *  │  ChatGPT /  │  ──────────────────────────►  │  This MCP Server     │
 *  │  MCP Client │  ◄──────────────────────────  │  (synchrony-offers)  │
 *  └─────────────┘                               └──────────────────────┘
 *
 *  ChatGPT sends a "tools/call" request with tool name + arguments.
 *  Our server validates the args, fetches data, and returns a response.
 *  ChatGPT then uses that data to compose its reply to the end user.
 *
 * RUNNING THIS SERVER:
 *  During development:  npm run dev
 *  Production (after build): npm start
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import the tool handler (the function that does the actual work for get_offers)
import { handleGetOffers } from "./tools/getOffers.js";

// ---------------------------------------------------------------------------
// SERVER METADATA
// This information is sent to the MCP client (ChatGPT) during the handshake.
// The client uses it to identify the server and its capabilities.
// ---------------------------------------------------------------------------

const SERVER_NAME = "synchrony-marketplace-mcp";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// TOOL DEFINITION
// We manually define the JSON Schema for our `get_offers` tool.
//
// WHY JSON SCHEMA AND NOT ZOD DIRECTLY?
// The MCP protocol requires tool input schemas to be in standard JSON Schema
// format (not Zod). We keep Zod for runtime validation inside the handler.
// If you want to auto-generate JSON Schema from Zod, use the `zod-to-json-schema`
// package (already in dependencies):
//   import { zodToJsonSchema } from "zod-to-json-schema";
//   import { GetOffersInputSchema } from "./schemas/offerSchema.js";
//   const inputSchema = zodToJsonSchema(GetOffersInputSchema);
//
// For clarity and explicit documentation, we define it manually below.
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
        // `category` is required; `maxPrice` is optional (not listed in required array)
        required: ["category"],
        additionalProperties: false,
    },
};

// ---------------------------------------------------------------------------
// INITIALIZE MCP SERVER
// ---------------------------------------------------------------------------

const server = new Server(
    {
        name: SERVER_NAME,
        version: SERVER_VERSION,
    },
    {
        // Declare which MCP capabilities this server supports.
        // We support "tools" – meaning clients can call named functions.
        capabilities: {
            tools: {},
        },
    }
);

// ---------------------------------------------------------------------------
// REGISTER HANDLER: ListTools
//
// ChatGPT (or any MCP client) calls "tools/list" first to discover what tools
// are available. We respond with our registered tool definitions.
//
// If you add more tools in the future, add them to the `tools` array here.
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error(`[${SERVER_NAME}] tools/list called – returning registered tools.`);

    return {
        tools: [GET_OFFERS_TOOL],
    };
});

// ---------------------------------------------------------------------------
// REGISTER HANDLER: CallTool
//
// ChatGPT calls "tools/call" with a tool name and arguments when it wants to
// execute a tool. We route the call to the appropriate handler function.
//
// ROUTING PATTERN:
// As you add more tools, add a new `case` for each tool name.
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: toolArgs } = request.params;

    console.error(`[${SERVER_NAME}] tools/call received for tool: "${toolName}"`);

    switch (toolName) {
        case "get_offers": {
            // Delegate to the dedicated handler in src/tools/getOffers.ts
            // The handler validates, fetches, and formats the response.
            return await handleGetOffers(toolArgs);
        }

        default: {
            // If an unknown tool name is called, return an MCP error response.
            // This should not happen if the client uses the tool list correctly,
            // but it's good defensive programming.
            console.error(`[${SERVER_NAME}] Unknown tool called: "${toolName}"`);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Unknown tool: "${toolName}". This server only supports: get_offers.`,
                    },
                ],
                isError: true,
            };
        }
    }
});

// ---------------------------------------------------------------------------
// CONNECT TRANSPORT AND START SERVER
//
// `StdioServerTransport` pipes the MCP JSON-RPC protocol over standard
// input/output streams. This is the simplest transport for local development
// and testing – it requires no network configuration.
//
// To switch to HTTP/SSE transport in production, replace StdioServerTransport
// with the appropriate transport class from the MCP SDK.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    const transport = new StdioServerTransport();

    console.error(`[${SERVER_NAME}] Starting server v${SERVER_VERSION}...`);
    console.error(
        `[${SERVER_NAME}] Transport: stdio (standard input/output)`
    );
    console.error(
        `[${SERVER_NAME}] NOTE: All server logs go to stderr. MCP protocol messages use stdout.`
    );

    // Connect the server to the transport. This starts the event loop and
    // the server begins listening for MCP protocol messages from the client.
    await server.connect(transport);

    console.error(`[${SERVER_NAME}] Server is running and ready to accept connections.`);
}

// Invoke the main function and handle any top-level startup errors.
main().catch((err) => {
    console.error(`[${SERVER_NAME}] FATAL: Server failed to start:`, err);
    process.exit(1);
});
