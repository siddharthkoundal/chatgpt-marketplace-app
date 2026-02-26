/**
 * src/tools/getOffers.ts
 *
 * PURPOSE:
 * This file contains the HANDLER LOGIC for the `get_offers` MCP tool.
 * It is the "middle layer" between the MCP server (index.ts) and the
 * Synchrony API client (synchronyClient.ts).
 *
 * RESPONSIBILITIES:
 *   1. Validate the raw arguments from ChatGPT using our Zod schema.
 *   2. Call the Synchrony API client with the validated, typed arguments.
 *   3. Format the results into MCP's expected response format (an array of
 *      `TextContent` objects containing a JSON string).
 *   4. Handle errors gracefully and return MCP-compliant error responses.
 *
 * DATA FLOW:
 *  index.ts (receives tool call from ChatGPT)
 *    → handleGetOffers (this function)  ← YOU ARE HERE
 *      → Zod validation of raw args
 *        → fetchOffersFromSynchrony (synchronyClient.ts)
 *          → Returns Offer[]
 *            → Formats and returns MCP TextContent response
 */

import { fetchOffersFromSynchrony } from "../api/synchronyClient.js";
import { GetOffersInputSchema } from "../schemas/offerSchema.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// NOTE ON TYPES
// We use the SDK's official `CallToolResult` type as the return type for this
// handler. This guarantees our response shape satisfies what the MCP server's
// `setRequestHandler` expects, avoiding mismatches between our custom types
// and the SDK's internal type definitions.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TOOL HANDLER
// ---------------------------------------------------------------------------

/**
 * handleGetOffers
 *
 * The main handler for the `get_offers` MCP tool.
 * Called by the MCP server (index.ts) whenever ChatGPT invokes the tool.
 *
 * @param rawArgs - The raw, unvalidated arguments object from ChatGPT's tool call.
 *                  We treat this as `unknown` by default and validate with Zod.
 * @returns       - An MCP-compliant tool result object with JSON-stringified offers.
 *
 * ERROR HANDLING STRATEGY:
 *  - Zod validation errors → Return a user-friendly error message so ChatGPT
 *    can tell the end user what went wrong with their query.
 *  - API/network errors    → Return a generic error message (log details server-side).
 *  - No results found      → Return a friendly "no offers" message rather than an error.
 */
export async function handleGetOffers(rawArgs: unknown): Promise<CallToolResult> {
    // ------------------------------------------------------------------
    // STEP 1: Validate the incoming arguments with Zod.
    // `safeParse` returns { success: true, data } or { success: false, error }.
    // We use `safeParse` (instead of `parse`) so we can handle errors gracefully
    // without throwing uncaught exceptions.
    // ------------------------------------------------------------------
    const parseResult = GetOffersInputSchema.safeParse(rawArgs);

    if (!parseResult.success) {
        // Zod gives us detailed, human-readable error messages.
        // Format them and return as an MCP error content block.
        const zodErrors = parseResult.error.errors
            .map((e) => `  • [${e.path.join(".")}]: ${e.message}`)
            .join("\n");

        const errorMessage = `Invalid tool arguments:\n${zodErrors}`;

        console.error("[get_offers] Validation failed:", errorMessage);

        return {
            content: [{ type: "text", text: errorMessage }],
            isError: true,
        };
    }

    // At this point, `parseResult.data` is fully typed as `GetOffersInput`.
    const { category, maxPrice } = parseResult.data;

    console.error(
        `[get_offers] Fetching offers for category="${category}", maxPrice=${maxPrice ?? "none"}`
    );

    // ------------------------------------------------------------------
    // STEP 2: Call the Synchrony API client.
    // This is wrapped in a try/catch to handle network errors or unexpected
    // failures from the API client gracefully.
    // ------------------------------------------------------------------
    let offers;
    try {
        offers = await fetchOffersFromSynchrony(category, maxPrice);
    } catch (err) {
        const errorMessage =
            err instanceof Error ? err.message : "An unexpected error occurred while fetching offers.";

        console.error("[get_offers] API client error:", err);

        return {
            content: [
                {
                    type: "text",
                    text: `Failed to fetch offers from Synchrony Marketplace: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }

    // ------------------------------------------------------------------
    // STEP 3: Handle the "no results" case.
    // It's not an error – it's a valid state. Return a friendly message.
    // ------------------------------------------------------------------
    if (offers.length === 0) {
        const noResultsText = maxPrice
            ? `No offers found in the "${category}" category under $${maxPrice.toFixed(2)}.`
            : `No offers found in the "${category}" category.`;

        console.error(`[get_offers] ${noResultsText}`);

        return {
            content: [{ type: "text", text: noResultsText }],
        };
    }

    // ------------------------------------------------------------------
    // STEP 4: Format the successful response.
    // We serialize the array of Offer objects to a pretty-printed JSON string.
    // ChatGPT will receive this string and can present it to the user in a
    // readable format (e.g., a bullet list or table).
    //
    // The response wraps the offers in a structured envelope with metadata
    // (category, count) so ChatGPT has context when summarizing results.
    // ------------------------------------------------------------------
    const responsePayload = {
        category,
        maxPrice: maxPrice ?? null,
        totalOffers: offers.length,
        offers,
    };

    const responseText = JSON.stringify(responsePayload, null, 2);

    console.error(`[get_offers] Returning ${offers.length} offer(s).`);

    return {
        content: [{ type: "text", text: responseText }],
    };
}
