/**
 * src/tools/getOffers.ts — handler for the `get_offers` MCP tool
 *
 * Called by McpServer after it has validated args against GetOffersInputZodShape.
 * Args are pre-typed as GetOffersInput — no manual Zod safeParse needed here.
 *
 * Responsibilities:
 *   - Call the API client (currently mock, swap for real in synchronyClient.ts)
 *   - Handle "no results" gracefully (not an error, a valid state)
 *   - Wrap offers in a metadata envelope for ChatGPT to summarize
 */

import { fetchOffersFromSynchrony } from "../api/synchronyClient.js";
import type { GetOffersInput } from "../schemas/offerSchema.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export async function handleGetOffers(args: GetOffersInput): Promise<CallToolResult> {
    const { category, maxPrice } = args;

    console.error(`[get_offers] category="${category}", maxPrice=${maxPrice ?? "none"}`);

    let offers;
    try {
        offers = await fetchOffersFromSynchrony(category, maxPrice);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error fetching offers.";
        console.error("[get_offers] API error:", err);
        return {
            content: [{ type: "text", text: `Failed to fetch offers: ${message}` }],
            isError: true,
        };
    }

    if (offers.length === 0) {
        const msg = maxPrice
            ? `No offers found in "${category}" under $${maxPrice.toFixed(2)}.`
            : `No offers found in "${category}".`;
        return { content: [{ type: "text", text: msg }] };
    }

    // Envelope gives ChatGPT context (count, filters applied) alongside the offers.
    // TODO (future): return structuredContent + content separately for ChatGPT App Store
    //   structuredContent → concise JSON the model reads
    //   content           → human-readable narration
    //   _meta             → rich data for the UI widget only (never reaches the model)
    const payload = { category, maxPrice: maxPrice ?? null, totalOffers: offers.length, offers };
    console.error(`[get_offers] Returning ${offers.length} offer(s).`);

    return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
}
