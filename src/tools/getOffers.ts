/**
 * src/tools/getOffers.ts — handler for the `get_offers` MCP tool
 *
 * Called by McpServer after Zod validation. Args are pre-typed as GetOffersInput.
 *
 * TODO: return structuredContent + content separately for ChatGPT App Store
 *   structuredContent → concise JSON the model reads
 *   content           → human-readable narration
 *   _meta             → rich data for the UI widget only (never reaches the model)
 */

import { fetchOffers } from "../api/synchronyClient.js";
import type { GetOffersInput, Offer } from "../schemas/offerSchema.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Formats a single offer into a concise summary object for ChatGPT.
 * Surfaces the most useful fields — brand, offerType, links, expiry.
 * Omits raw image URLs and internal IDs which add noise without value.
 */
function formatOfferForChatGPT(offer: Offer) {
    return {
        offerId: offer.offerId,
        title: offer.title,
        subtitle: offer.subtitle,
        offerType: offer.offerType?.name,
        brand: {
            name: offer.brand?.name,
            featured: offer.brand?.featured,
            industries: offer.brand?.industry?.map((i) => i.name),
            network: offer.brand?.network?.name,
            regions: offer.brand?.region,
        },
        links: offer.links?.map((l) => ({ label: l.linkLabel, url: l.linkUrl })),
        keywords: offer.keywords,
        expiryMsg: offer.expiryMsg,
        startDate: offer.startDate,
        endDate: offer.endDate,
        disclosure: offer.disclosure,
    };
}

export async function handleGetOffers(args: GetOffersInput): Promise<CallToolResult> {
    console.error(
        `[get_offers] Filters — category: ${args.category ?? "none"}, industry: ${args.industry?.join(",") ?? "none"}, ` +
        `offerType: ${args.offerType?.join(",") ?? "none"}, region: ${args.region ?? "none"}, ` +
        `brand: ${args.brand ?? "none"}, featured: ${args.featured ?? "none"}`
    );

    let offers;
    try {
        offers = await fetchOffers(args);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error fetching offers.";
        console.error("[get_offers] API error:", err);
        return {
            content: [{ type: "text", text: `Failed to fetch offers: ${message}` }],
            isError: true,
        };
    }

    if (offers.length === 0) {
        const filterSummary = [
            args.category && `category "${args.category}"`,
            args.industry && `industry "${args.industry.join(", ")}"`,
            args.offerType && `type "${args.offerType.join(", ")}"`,
            args.region && `region "${args.region}"`,
            args.brand && `brand "${args.brand}"`,
        ].filter(Boolean).join(", ");

        return {
            content: [{
                type: "text",
                text: `No offers found${filterSummary ? ` for ${filterSummary}` : ""}.`,
            }],
        };
    }

    const payload = {
        totalOffers: offers.length,
        appliedFilters: {
            category: args.category,
            industry: args.industry,
            offerType: args.offerType,
            region: args.region,
            network: args.network,
            brand: args.brand,
            featured: args.featured,
        },
        offers: offers.map(formatOfferForChatGPT),
    };

    console.error(`[get_offers] Returning ${offers.length} offer(s).`);

    return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
}
