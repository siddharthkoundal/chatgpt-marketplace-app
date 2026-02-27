/**
 * src/index.ts — stdio transport entry point
 *
 * Runs the MCP server over stdin/stdout for local development and MCP Inspector.
 * For remote/ngrok access, use src/server.ts (HTTP transport) instead.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { handleGetOffers } from "./tools/getOffers.js";
import { GetOffersInputZodShape } from "./schemas/offerSchema.js";

const server = new McpServer({
    name: "syf-marketplace-mcp",
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

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    // Logs go to stderr — MCP protocol messages use stdout.
    console.error("[syf-marketplace-mcp] Starting (stdio)...");
    await server.connect(transport);
    console.error("[syf-marketplace-mcp] Ready.");
}

main().catch((err) => {
    console.error("[syf-marketplace-mcp] FATAL:", err);
    process.exit(1);
});
