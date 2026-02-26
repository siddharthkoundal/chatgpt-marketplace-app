/**
 * src/schemas/offerSchema.ts — Zod schemas and TypeScript types
 *
 * Single source of truth for data shapes. Zod enforces runtime type safety
 * at system boundaries (ChatGPT tool args, Synchrony API responses).
 *
 * Two input exports:
 *   - GetOffersInputZodShape  → raw shape object, passed to McpServer.registerTool()
 *                               (SDK v1.x expects ZodRawShapeCompat, not a ZodObject)
 *   - GetOffersInputSchema    → wrapped ZodObject, used for explicit safeParse() in tests
 */

import { z } from "zod";

export const GetOffersInputZodShape = {
    category: z
        .string()
        .min(1, "Category cannot be an empty string.")
        .describe("The product category to search for (e.g., 'beds', 'electronics')."),

    maxPrice: z
        .number()
        .positive("maxPrice must be a positive number.")
        .optional()
        .describe("Optional maximum price filter in USD. Returns only offers at or below this price."),
};

export const GetOffersInputSchema = z.object(GetOffersInputZodShape);
export type GetOffersInput = z.infer<typeof GetOffersInputSchema>;

export const OfferSchema = z.object({
    title: z.string().describe("The display name of the product offer."),
    price: z.number().nonnegative("Price must be zero or positive.").describe("Price in USD."),
    discount: z.string().optional().describe("Discount description, if applicable."),
    // z.string().url() — note: must chain .url() on .string(), not call z.url() directly (fixed in code review)
    link: z.string().url().describe("Direct URL to the product on Synchrony Marketplace."),
});

export type Offer = z.infer<typeof OfferSchema>;

export const OffersResponseSchema = z.array(OfferSchema);
export type OffersResponse = z.infer<typeof OffersResponseSchema>;
