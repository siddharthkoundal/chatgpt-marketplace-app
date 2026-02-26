/**
 * src/api/synchronyClient.ts — API client layer
 *
 * Currently a mock. When the real Synchrony Marketplace API is available:
 *   1. Replace the MOCK_OFFERS return with axios.get() to the real endpoint.
 *   2. Validate the API response with OffersResponseSchema.parse(res.data)
 *      so any schema drift is caught immediately at runtime.
 *   3. Pull config from env vars (SYNCHRONY_API_BASE_URL, SYNCHRONY_API_KEY).
 *
 * Real implementation pattern:
 *   import axios from 'axios';
 *   const res = await axios.get(`${process.env.SYNCHRONY_API_BASE_URL}/offers`, {
 *     headers: { Authorization: `Bearer ${process.env.SYNCHRONY_API_KEY}` },
 *     params: { category, maxPrice },
 *   });
 *   return OffersResponseSchema.parse(res.data);
 */

import type { Offer, OffersResponse } from "../schemas/offerSchema.js";

const MOCK_OFFERS: Offer[] = [
    // Beds
    { title: "Serta Perfect Sleeper Queen Mattress", price: 799.99, discount: "15% off for Synchrony cardholders", link: "https://marketplace.synchrony.com/offers/beds-001" },
    { title: "Sealy Posturepedic King Mattress", price: 1199.99, discount: "12-month no interest financing", link: "https://marketplace.synchrony.com/offers/beds-002" },
    { title: "Nectar Memory Foam Twin Mattress", price: 399.00, link: "https://marketplace.synchrony.com/offers/beds-003" },
    // Electronics
    { title: 'Samsung 65" 4K QLED Smart TV', price: 1299.99, discount: "Save $200 – Limited time offer", link: "https://marketplace.synchrony.com/offers/electronics-001" },
    { title: "Apple MacBook Air M2 (15-inch)", price: 1099.00, discount: "6-month no interest financing", link: "https://marketplace.synchrony.com/offers/electronics-002" },
    { title: "Sony WH-1000XM5 Headphones", price: 279.99, link: "https://marketplace.synchrony.com/offers/electronics-003" },
    // Appliances
    { title: "LG French Door Refrigerator 27 cu. ft.", price: 1749.99, discount: "18-month no interest financing available", link: "https://marketplace.synchrony.com/offers/appliances-001" },
    { title: "Whirlpool Top Load Washer & Dryer Bundle", price: 899.00, discount: "10% off bundle deal", link: "https://marketplace.synchrony.com/offers/appliances-002" },
];

/**
 * Filters mock offers by category (case-insensitive, matches title or URL slug)
 * and optional maxPrice. In production the API handles filtering server-side.
 *
 * The `priceLimit` const inside the if-block is required for TypeScript to narrow
 * the type of `maxPrice` inside the arrow function closure (parameters aren't narrowed).
 */
export async function fetchOffersFromSynchrony(
    category: string,
    maxPrice?: number
): Promise<OffersResponse> {
    // Simulated latency — remove in production.
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const normalizedCategory = category.toLowerCase().trim();

    let filtered: Offer[] = MOCK_OFFERS.filter((offer) =>
        offer.title.toLowerCase().includes(normalizedCategory) ||
        offer.link.toLowerCase().includes(normalizedCategory)
    );

    if (maxPrice !== undefined) {
        const priceLimit: number = maxPrice;
        filtered = filtered.filter((offer) => offer.price <= priceLimit);
    }

    return filtered;
}
