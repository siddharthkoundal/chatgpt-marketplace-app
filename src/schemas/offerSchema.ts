/**
 * src/schemas/offerSchema.ts
 *
 * PURPOSE:
 * This file defines all Zod schemas for the MCP server.
 * Zod acts as our single source of truth for data shapes – it validates
 * incoming arguments from ChatGPT AND outgoing offer data from the API.
 *
 * WHY ZOD?
 * Zod gives us runtime type safety. Even though TypeScript catches type errors
 * at compile time, Zod ensures that data crossing system boundaries (e.g., from
 * ChatGPT's tool call arguments or from our internal API) actually matches
 * what we expect at RUNTIME.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// INPUT SCHEMA
// This describes the arguments ChatGPT will send when calling our `get_offers`
// tool. These are validated BEFORE we make any API call.
// ---------------------------------------------------------------------------

export const GetOffersInputSchema = z.object({
    /**
     * The product category to search for.
     * Required – ChatGPT MUST supply this for the tool call to succeed.
     * Example values: "beds", "electronics", "appliances"
     */
    category: z
        .string()
        .min(1, "Category cannot be an empty string.")
        .describe("The product category to search for (e.g., 'beds', 'electronics')."),

    /**
     * An optional maximum price filter (in USD).
     * If omitted, the API client returns all offers regardless of price.
     * Must be a positive number if provided.
     */
    maxPrice: z
        .number()
        .positive("maxPrice must be a positive number.")
        .optional()
        .describe("Optional maximum price filter in USD. Returns only offers at or below this price."),
});

// Infer the TypeScript type from the schema so we don't have to define it twice.
// `GetOffersInput` is used throughout the codebase as the type for tool arguments.
export type GetOffersInput = z.infer<typeof GetOffersInputSchema>;

// ---------------------------------------------------------------------------
// OUTPUT SCHEMA (Single Offer)
// Describes the shape of one product offer returned by the Synchrony API.
// All fields here will eventually be rendered in ChatGPT's response.
// ---------------------------------------------------------------------------

export const OfferSchema = z.object({
    /**
     * The display name of the product offer.
     * Example: "Serta Perfect Sleeper Queen Mattress"
     */
    title: z.string().describe("The display name of the product offer."),

    /**
     * The current listed price of the offer (in USD).
     * Example: 799.99
     */
    price: z
        .number()
        .nonnegative("Price must be zero or positive.")
        .describe("The current price of the offer in USD."),

    /**
     * A human-readable description of the discount, if any.
     * This is optional – not all offers will have a discount.
     * Example: "15% off for Synchrony cardholders"
     */
    discount: z
        .string()
        .optional()
        .describe("A description of the discount available, if applicable."),

    /**
     * A direct URL link to the product offer on the Synchrony Marketplace.
     * Example: "https://marketplace.synchrony.com/offers/12345"
     */
    link: z.string().url().describe("The direct URL to the product offer on the Synchrony Marketplace."),
});

// Infer the TypeScript type for a single offer.
export type Offer = z.infer<typeof OfferSchema>;

// ---------------------------------------------------------------------------
// OUTPUT SCHEMA (Array of Offers)
// The MCP tool returns a LIST of offers matching the search criteria.
// ---------------------------------------------------------------------------

export const OffersResponseSchema = z.array(OfferSchema);

// Infer the TypeScript type for the full offers response.
export type OffersResponse = z.infer<typeof OffersResponseSchema>;
