/**
 * src/schemas/offerSchema.ts — Zod schemas and TypeScript types
 *
 * Single source of truth for data shapes. Zod enforces runtime type safety
 * at system boundaries (ChatGPT tool args, Synchrony API responses).
 *
 * Schema aligned to real Synchrony Marketplace API as of Feb 2026.
 * See Swagger at: [internal Synchrony API docs URL]
 *
 * Two input exports:
 *   - GetOffersInputZodShape  → raw shape, passed to McpServer.registerTool()
 *                               (SDK v1.x expects ZodRawShapeCompat, not a ZodObject)
 *   - GetOffersInputSchema    → wrapped ZodObject, used for safeParse() in tests
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// ENUMS — matched to real API filter values
// ---------------------------------------------------------------------------

export const INDUSTRY_VALUES = [
    "FURNITURE",
    "ELECTRONICS & APPLIANCES",
    "HEALTHCARE & OPTICAL",
    "HEALTH & WELLNESS",
    "HEATING & AIR CONDITIONING",
    "HOME IMPROVEMENT",
    "JEWELRY",
    "LAWN & GARDEN",
    "MUSIC",
] as const;

export const OFFER_TYPE_VALUES = [
    "DEALS",
    "FINANCING OFFERS",
    "EVERYDAY VALUE",
] as const;

export const REGION_VALUES = [
    "MIDWEST",
    "NORTHEAST",
    "SOUTH",
    "SOUTHEAST",
    "WEST",
] as const;

export const NETWORK_VALUES = [
    "SYNCHRONY CAR CARE",
    "SYNCHRONY HOME",
    "SYNCHRONY FLOORING",
    "SYNCHRONY POWERSPORTS",
] as const;

// ---------------------------------------------------------------------------
// INPUT SCHEMA — tool call args from ChatGPT
//
// Existing params (category, maxPrice) kept for backward compat.
//   - `category` maps semantically to `industry` (free-text, case-insensitive)
//   - `maxPrice` has no real API equivalent (financing offers don't have list prices)
//     but is kept so existing tests and clients don't break
//
// New params mirror real API query parameters.
// ---------------------------------------------------------------------------

export const GetOffersInputZodShape = {
    // --- Existing (backward compat) ---
    category: z
        .string()
        .min(1, "Category cannot be empty.")
        .optional()
        .describe("Product category keyword (e.g. 'furniture', 'electronics'). Maps to industry filter."),

    maxPrice: z
        .number()
        .positive()
        .optional()
        .describe("Legacy price filter — not applicable to the real API (financing offers have no list price). Kept for backward compat."),

    // --- New params matching real API ---
    industry: z
        .array(z.enum(INDUSTRY_VALUES))
        .optional()
        .describe(`Filter by industry. Valid values: ${INDUSTRY_VALUES.join(", ")}`),

    offerType: z
        .array(z.enum(OFFER_TYPE_VALUES))
        .optional()
        .describe(`Filter by offer type. Valid values: ${OFFER_TYPE_VALUES.join(", ")}`),

    region: z
        .enum(REGION_VALUES)
        .optional()
        .describe(`Filter by region. Valid values: ${REGION_VALUES.join(", ")}`),

    network: z
        .array(z.enum(NETWORK_VALUES))
        .optional()
        .describe(`Filter by Synchrony network. Valid values: ${NETWORK_VALUES.join(", ")}`),

    brand: z
        .string()
        .optional()
        .describe("Filter by brand/merchant name (e.g. 'Ashley', 'Sam's Club')."),

    featured: z
        .boolean()
        .optional()
        .describe("If true, return only featured brand offers."),

    limitOffersCount: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max number of offers to return (non-personalized only)."),

    offset: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Pagination offset (non-personalized only)."),
};

export const GetOffersInputSchema = z.object(GetOffersInputZodShape);
export type GetOffersInput = z.infer<typeof GetOffersInputSchema>;

// ---------------------------------------------------------------------------
// NESTED SCHEMAS — matching real API response object shapes
// ---------------------------------------------------------------------------

export const IndustrySchema = z.object({
    name: z.string(),
    icon: z.string().url().optional(),
});

export const NetworkSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().url().optional(),
    pageUrl: z.string().url().optional(),
});

export const BrandSchema = z.object({
    name: z.string(),
    featured: z.boolean().optional(),
    logo: z.string().url().optional(),
    image: z.string().url().optional(),
    priority: z.number().optional(),
    productType: z.string().optional(),
    industry: z.array(IndustrySchema).optional(),
    network: NetworkSchema.optional(),
    region: z.array(z.string()).optional(),
});

// Offer images come in multiple named sizes — use catchall to handle e.g. "318x510"
export const OfferImageSchema = z.object({
    default: z.string().url().optional(),
}).catchall(z.string().url());

export const OfferLinkSchema = z.object({
    linkLabel: z.string(),
    linkUrl: z.string().url(),
    linkPlacement: z.number().int(),
});

export const OfferTypeSchema = z.object({
    name: z.string(),
    icon: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// OFFER SCHEMA — single offer from the real API
//
// Legacy fields (price, discount, link) kept as optional for backward compat
// with any existing tests/clients that relied on the old simplified schema.
// New fields match the real API response exactly.
// ---------------------------------------------------------------------------

export const OfferSchema = z.object({
    // Real API fields
    slotId: z.string().optional(),
    groupId: z.string().optional(),
    offerId: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    disclosure: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    offerImage: OfferImageSchema.optional(),
    startDate: z.string().optional(), // "YYYY-MM-DD"
    endDate: z.string().optional(),
    offerType: OfferTypeSchema.optional(),
    brand: BrandSchema.optional(),
    productType: z.string().optional(),
    links: z.array(OfferLinkSchema).optional(),
    expiryMsg: z.string().optional(),

    // Legacy fields — kept for backward compat (not present in real API)
    price: z.number().nonnegative().optional(),
    discount: z.string().optional(),
    link: z.string().url().optional(),
});

export type Offer = z.infer<typeof OfferSchema>;

// ---------------------------------------------------------------------------
// PAGINATION + CAMPAIGN + ANALYTICS — top-level real API response wrappers
// These are exported for use when the real API is wired in (synchronyClient.ts).
// ---------------------------------------------------------------------------

export const PaginationSchema = z.object({
    totalCount: z.number().int(),
    limit: z.number().int(),
    start: z.number().int(),
});

export const CampaignSchema = z.object({
    campaignId: z.string().optional(),
    variationId: z.string().optional(),
    variationType: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    title: z.string().optional(),
    groups: z.array(z.string()).optional(),
    decisionId: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
});

export const AnalyticsMetadataSchema = z.object({
    campaignId: z.number().optional(),
    campaignName: z.string().optional(),
    experienceId: z.number().optional(),
    experienceName: z.string().optional(),
    variationId: z.number().optional(),
    variationName: z.string().optional(),
});

/**
 * Full Synchrony API response shape.
 * Use this to validate real API responses when wiring in the real HTTP call:
 *   const apiData = SynchronyApiResponseSchema.parse(res.data);
 */
export const SynchronyApiResponseSchema = z.object({
    requestId: z.string().optional(),
    campaign: CampaignSchema.optional(),
    offers: z.array(OfferSchema),
    pagination: PaginationSchema.optional(),
    analyticsMetadata: AnalyticsMetadataSchema.optional(),
});

export type SynchronyApiResponse = z.infer<typeof SynchronyApiResponseSchema>;
export type OffersResponse = Offer[];
