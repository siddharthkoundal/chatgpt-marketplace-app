/**
 * src/index.ts — stdio transport entry point
 *
 * Runs the MCP server over stdin/stdout for local development and MCP Inspector.
 * For remote/ngrok access, use src/server.ts (HTTP/SSE transport) instead.
 *
 * SDK: @modelcontextprotocol/sdk v1.x — uses McpServer (high-level API).
 * Transport upgrade path: swap StdioServerTransport for StreamableHttpServerTransport
 * when moving to production (OpenAI recommends Streamable HTTP over SSE).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { handleGetOffers } from "./tools/getOffers.js";
import { GetOffersInputZodShape } from "./schemas/offerSchema.js";

const server = new McpServer({
    name: "synchrony-marketplace-mcp",
    version: "1.0.0",
});

// registerTool() handles tools/list advertisement, Zod input validation,
// and tools/call routing automatically — no manual setRequestHandler needed.
//
// TODO: Add tool annotations before ChatGPT App Store submission:
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

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    // Logs go to stderr — MCP protocol messages use stdout.
    console.error("[synchrony-marketplace-mcp] Starting (stdio)...");
    await server.connect(transport);
    console.error("[synchrony-marketplace-mcp] Ready.");
}

main().catch((err) => {
    console.error("[synchrony-marketplace-mcp] FATAL:", err);
    process.exit(1);
});
