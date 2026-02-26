/**
 * src/api/synchronyClient.ts
 *
 * PURPOSE:
 * This module acts as the API client layer between our MCP server and the
 * internal Synchrony Marketplace API.
 *
 * CURRENT STATE:
 * The `fetchOffersFromSynchrony` function is a MOCK – it returns hardcoded
 * dummy data that matches our Zod `OffersResponse` schema. This lets the rest
 * of the server be built and tested end-to-end without needing real API access.
 *
 * UPGRADING TO THE REAL API:
 * When the Synchrony Marketplace API endpoint is available:
 *   1. Import `axios` (already in dependencies) and replace the hardcoded
 *      `MOCK_OFFERS` return with a real `axios.get(...)` call.
 *   2. Parse the API response through `OffersResponseSchema.parse(...)` to
 *      ensure the real data still matches our expected shape.
 *   3. Set the base URL and auth headers via environment variables
 *      (e.g., process.env.SYNCHRONY_API_BASE_URL, process.env.SYNCHRONY_API_KEY).
 *
 * Example of real implementation (commented out for reference):
 * ---------------------------------------------------------------
 * import axios from 'axios';
 * const BASE_URL = process.env.SYNCHRONY_API_BASE_URL ?? '';
 * const API_KEY  = process.env.SYNCHRONY_API_KEY ?? '';
 *
 * const response = await axios.get(`${BASE_URL}/offers`, {
 *   headers: { 'Authorization': `Bearer ${API_KEY}` },
 *   params: { category, maxPrice },
 * });
 * return OffersResponseSchema.parse(response.data);
 * ---------------------------------------------------------------
 */

import type { Offer, OffersResponse } from "../schemas/offerSchema.js";

// ---------------------------------------------------------------------------
// MOCK DATA
// A static list of fake product offers covering multiple categories.
// Each entry strictly follows the `Offer` type derived from our Zod schema.
// ---------------------------------------------------------------------------

const MOCK_OFFERS: Offer[] = [
    // --- Beds / Mattresses ---
    {
        title: "Serta Perfect Sleeper Queen Mattress",
        price: 799.99,
        discount: "15% off for Synchrony cardholders",
        link: "https://marketplace.synchrony.com/offers/beds-001",
    },
    {
        title: "Sealy Posturepedic King Mattress",
        price: 1199.99,
        discount: "12-month no interest financing",
        link: "https://marketplace.synchrony.com/offers/beds-002",
    },
    {
        title: "Nectar Memory Foam Twin Mattress",
        price: 399.0,
        // No discount on this one – demonstrates the optional `discount` field
        link: "https://marketplace.synchrony.com/offers/beds-003",
    },

    // --- Electronics ---
    {
        title: 'Samsung 65" 4K QLED Smart TV',
        price: 1299.99,
        discount: "Save $200 – Limited time offer",
        link: "https://marketplace.synchrony.com/offers/electronics-001",
    },
    {
        title: "Apple MacBook Air M2 (15-inch)",
        price: 1099.0,
        discount: "6-month no interest financing",
        link: "https://marketplace.synchrony.com/offers/electronics-002",
    },
    {
        title: "Sony WH-1000XM5 Noise Cancelling Headphones",
        price: 279.99,
        link: "https://marketplace.synchrony.com/offers/electronics-003",
    },

    // --- Appliances ---
    {
        title: "LG French Door Refrigerator 27 cu. ft.",
        price: 1749.99,
        discount: "18-month no interest financing available",
        link: "https://marketplace.synchrony.com/offers/appliances-001",
    },
    {
        title: "Whirlpool Top Load Washer & Dryer Bundle",
        price: 899.0,
        discount: "10% off bundle deal",
        link: "https://marketplace.synchrony.com/offers/appliances-002",
    },
];

// ---------------------------------------------------------------------------
// MOCK API CLIENT FUNCTION
// ---------------------------------------------------------------------------

/**
 * fetchOffersFromSynchrony
 *
 * Simulates fetching product offers from the Synchrony Marketplace API.
 *
 * @param category  - The product category to filter by (case-insensitive substring match).
 * @param maxPrice  - Optional maximum price. Only offers <= maxPrice are returned.
 * @returns         - A Promise that resolves to an array of matching `Offer` objects.
 *
 * DATA FLOW:
 *  ChatGPT Tool Call → MCP Server (index.ts)
 *    → Zod Validation (offerSchema.ts)
 *      → getOffers.ts (tool handler)
 *        → fetchOffersFromSynchrony (this function)  ← YOU ARE HERE
 *          → [In production: hits Synchrony REST API]
 *          → Returns filtered Offer[]
 */
export async function fetchOffersFromSynchrony(
    category: string,
    maxPrice?: number
): Promise<OffersResponse> {
    // Simulate a small network delay (50–150ms) to mimic a real API call.
    // Remove this in production.
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    // Step 1: Filter offers by category (case-insensitive substring match).
    // e.g., if category = "bed", it will match "Serta Perfect Sleeper Queen Mattress"
    // because the MOCK_OFFERS entry is categorized under "beds-001".
    // NOTE: In production, the real API handles filtering server-side.
    const normalizedCategory = category.toLowerCase().trim();

    // Explicitly type `filtered` as Offer[] so TypeScript can track the shape
    // through both filter passes below.
    let filtered: Offer[] = MOCK_OFFERS.filter((offer: Offer) => {
        // Check if the offer title contains the category keyword (mock approach)
        // OR if the offer link contains the category keyword (reliable for mock data)
        return (
            offer.title.toLowerCase().includes(normalizedCategory) ||
            offer.link.toLowerCase().includes(normalizedCategory)
        );
    });

    // Step 2: If a maxPrice filter is provided, remove offers that exceed it.
    // Capture `maxPrice` in a const so TypeScript can narrow it inside the
    // arrow function (it won't narrow a function parameter inside a closure).
    if (maxPrice !== undefined) {
        const priceLimit: number = maxPrice;
        filtered = filtered.filter((offer: Offer) => offer.price <= priceLimit);
    }

    // Step 3: Return the filtered list.
    // In the real implementation, you'd validate the API response here with:
    //   return OffersResponseSchema.parse(apiResponse.data);
    return filtered;
}
