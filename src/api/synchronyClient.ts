/**
 * src/api/syfClient.ts — Live API client
 *
 * Calls the real SYF Marketplace API. Filters are applied in-process after
 * fetching because the live endpoint only supports `campaignMappingId` server-side.
 *
 * Falls back to MOCK_OFFERS if the network call fails (e.g. no connectivity).
 */

import axios from "axios";
import type { Offer, OffersResponse, GetOffersInput } from "../schemas/offerSchema.js";

// ---------------------------------------------------------------------------
// LIVE API CONFIG — read from env, fallback for local dev without .env
// ---------------------------------------------------------------------------
const SYF_API_URL = process.env.SYF_API_URL ?? "https://api.syf.com/v1/marketing/offers";
const SYF_API_KEY = process.env.SYF_API_KEY ?? "";

// Fallback mock dataset — used when the live API is unreachable.
const MOCK_OFFERS: Offer[] = [
    {
        slotId: "slot-001",
        groupId: "987654321",
        offerId: "offer-furniture-001",
        title: "Get up to a $100 Visa Prepaid Card",
        subtitle: "When you use your Ashley Advantage credit card on qualifying purchases.",
        disclosure: "Offer valid for new Ashley Advantage cardholders only. See store for details.",
        keywords: ["Furniture", "Visa Prepaid"],
        offerImage: {
            default: "https://placeholder.syf.com/img/ashley_318_510.png",
            "318x510": "https://placeholder.syf.com/img/ashley_318_510.png",
            "221x139": "https://placeholder.syf.com/img/ashley_221_139.png",
        },
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        offerType: { name: "DEALS", icon: "https://www.syf.com/img/icon_deals.png" },
        brand: {
            name: "Ashley",
            featured: true,
            logo: "https://www.syf.com/img/single_ashley_logo.jpg",
            image: "https://www.syf.com/img/hero_ashley.jpg",
            priority: 1,
            industry: [
                { name: "FURNITURE", icon: "https://www.syf.com/img/icon_chair.png" },
                { name: "HOME IMPROVEMENT", icon: "https://www.syf.com/img/icon_home-improvement.png" },
            ],
            network: {
                name: "SYF HOME",
                description: "A SYF HOME Partner",
                icon: "https://www.syf.com/img/icon_home_program-dk_teal.png",
                pageUrl: "https://www.syf.com/home/cardholder.html",
            },
            region: ["MIDWEST", "NORTHEAST", "SOUTH", "SOUTHEAST", "WEST"],
        },
        links: [
            { linkLabel: "Card Details", linkUrl: "https://www.ashley.com/creditcard", linkPlacement: 1 },
            { linkLabel: "Pre-qualify", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=ASHLEY&preQual=Y", linkPlacement: 2 },
            { linkLabel: "Apply", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=ASHLEY", linkPlacement: 3 },
        ],
        expiryMsg: "Offer valid through Dec 2024",
    },

    {
        slotId: "slot-002",
        groupId: "987654322",
        offerId: "offer-furniture-002",
        title: "No Interest if Paid in Full within 18 Months",
        subtitle: "On purchases of $999 or more at Rooms To Go with your Rooms To Go credit card.",
        disclosure: "Interest will be charged from purchase date if balance not paid within 18 months.",
        keywords: ["Furniture", "Financing"],
        offerImage: {
            default: "https://placeholder.syf.com/img/roomstogo_318_510.png",
            "318x510": "https://placeholder.syf.com/img/roomstogo_318_510.png",
            "221x139": "https://placeholder.syf.com/img/roomstogo_221_139.png",
        },
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        offerType: { name: "FINANCING OFFERS", icon: "https://www.syf.com/img/icon_financing.png" },
        brand: {
            name: "Rooms To Go",
            featured: false,
            logo: "https://www.syf.com/img/rooms_to_go_logo.jpg",
            priority: 5,
            industry: [
                { name: "FURNITURE", icon: "https://www.syf.com/img/icon_chair.png" },
            ],
            network: {
                name: "SYF HOME",
                description: "A SYF HOME Partner",
                icon: "https://www.syf.com/img/icon_home_program-dk_teal.png",
                pageUrl: "https://www.syf.com/home/cardholder.html",
            },
            region: ["SOUTH", "SOUTHEAST", "MIDWEST"],
        },
        links: [
            { linkLabel: "Card Details", linkUrl: "https://www.roomstogo.com/creditcard", linkPlacement: 1 },
            { linkLabel: "Apply", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=ROOMSTOGO", linkPlacement: 2 },
        ],
        expiryMsg: "Offer expires Dec 31, 2024",
    },

    {
        slotId: "slot-003",
        groupId: "987654323",
        offerId: "offer-electronics-001",
        title: "Save $200 on Select Samsung 4K TVs",
        subtitle: "Purchase any qualifying Samsung TV using your Samsung Financing card.",
        disclosure: "Discount applied at point of sale. Offer valid at participating retailers only.",
        keywords: ["Electronics", "TV", "Samsung"],
        offerImage: {
            default: "https://placeholder.syf.com/img/samsung_318_510.png",
            "318x510": "https://placeholder.syf.com/img/samsung_318_510.png",
            "221x139": "https://placeholder.syf.com/img/samsung_221_139.png",
        },
        startDate: "2024-03-01",
        endDate: "2024-09-30",
        offerType: { name: "DEALS", icon: "https://www.syf.com/img/icon_deals.png" },
        brand: {
            name: "Samsung",
            featured: true,
            logo: "https://www.syf.com/img/samsung_logo.jpg",
            priority: 2,
            industry: [
                { name: "ELECTRONICS & APPLIANCES", icon: "https://www.syf.com/img/icon_electronics.png" },
            ],
            network: {
                name: "SYF HOME",
                description: "A SYF HOME Partner",
                icon: "https://www.syf.com/img/icon_home_program-dk_teal.png",
                pageUrl: "https://www.syf.com/home/cardholder.html",
            },
            region: ["MIDWEST", "NORTHEAST", "SOUTH", "SOUTHEAST", "WEST"],
        },
        links: [
            { linkLabel: "Shop TVs", linkUrl: "https://www.samsung.com/us/televisions-home-theater/", linkPlacement: 1 },
            { linkLabel: "Apply", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=SAMSUNG", linkPlacement: 2 },
        ],
        expiryMsg: "Limited time offer",
    },

    {
        slotId: "slot-004",
        groupId: "987654324",
        offerId: "offer-electronics-002",
        title: "6-Month No Interest Financing on Purchases Over $199",
        subtitle: "Use your Best Buy Credit Card on qualifying electronics purchases.",
        disclosure: "No interest if paid in full within 6 months. Minimum monthly payments required.",
        keywords: ["Electronics", "Appliances", "Financing"],
        offerImage: {
            default: "https://placeholder.syf.com/img/bestbuy_318_510.png",
            "318x510": "https://placeholder.syf.com/img/bestbuy_318_510.png",
            "221x139": "https://placeholder.syf.com/img/bestbuy_221_139.png",
        },
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        offerType: { name: "FINANCING OFFERS", icon: "https://www.syf.com/img/icon_financing.png" },
        brand: {
            name: "Best Buy",
            featured: true,
            logo: "https://www.syf.com/img/bestbuy_logo.jpg",
            priority: 3,
            industry: [
                { name: "ELECTRONICS & APPLIANCES", icon: "https://www.syf.com/img/icon_electronics.png" },
            ],
            network: {
                name: "SYF HOME",
                description: "A SYF HOME Partner",
                icon: "https://www.syf.com/img/icon_home_program-dk_teal.png",
                pageUrl: "https://www.syf.com/home/cardholder.html",
            },
            region: ["MIDWEST", "NORTHEAST", "SOUTH", "SOUTHEAST", "WEST"],
        },
        links: [
            { linkLabel: "Card Details", linkUrl: "https://www.bestbuy.com/credit-cards", linkPlacement: 1 },
            { linkLabel: "Pre-qualify", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=BESTBUY&preQual=Y", linkPlacement: 2 },
            { linkLabel: "Apply", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=BESTBUY", linkPlacement: 3 },
        ],
        expiryMsg: "Ongoing offer",
    },

    {
        slotId: "slot-005",
        groupId: "987654325",
        offerId: "offer-home-001",
        title: "Everyday 5% Off with the Lowe's Advantage Card",
        subtitle: "Save 5% instantly on all eligible purchases at Lowe's every day.",
        disclosure: "5% off discount is not combinable with other Lowe's offers or discounts.",
        keywords: ["Home Improvement", "Everyday Value"],
        offerImage: {
            default: "https://placeholder.syf.com/img/lowes_318_510.png",
            "318x510": "https://placeholder.syf.com/img/lowes_318_510.png",
            "221x139": "https://placeholder.syf.com/img/lowes_221_139.png",
        },
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        offerType: { name: "EVERYDAY VALUE", icon: "https://www.syf.com/img/icon_everyday.png" },
        brand: {
            name: "Lowe's",
            featured: true,
            logo: "https://www.syf.com/img/lowes_logo.jpg",
            priority: 4,
            industry: [
                { name: "HOME IMPROVEMENT", icon: "https://www.syf.com/img/icon_home-improvement.png" },
            ],
            network: {
                name: "SYF HOME",
                description: "A SYF HOME Partner",
                icon: "https://www.syf.com/img/icon_home_program-dk_teal.png",
                pageUrl: "https://www.syf.com/home/cardholder.html",
            },
            region: ["MIDWEST", "NORTHEAST", "SOUTH", "SOUTHEAST", "WEST"],
        },
        links: [
            { linkLabel: "Card Details", linkUrl: "https://www.lowes.com/l/credit/advantage-card-benefits", linkPlacement: 1 },
            { linkLabel: "Apply", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=LOWES", linkPlacement: 2 },
        ],
        expiryMsg: "Everyday offer — no expiry",
    },

    {
        slotId: "slot-006",
        groupId: "987654326",
        offerId: "offer-car-001",
        title: "Get up to a $100 Visa Prepaid Card on Auto Services",
        subtitle: "When you use your Express Oil Change credit card at a participating location.",
        disclosure: "Offer valid 6/12/24 - 7/10/24. One reward per cardholder.",
        keywords: ["Auto", "Car Care"],
        offerImage: {
            default: "https://placeholder.syf.com/img/carcare_318_510.png",
            "318x510": "https://placeholder.syf.com/img/carcare_318_510.png",
            "221x139": "https://placeholder.syf.com/img/carcare_221_139.png",
        },
        startDate: "2024-06-12",
        endDate: "2024-07-10",
        offerType: { name: "DEALS", icon: "https://www.syf.com/img/icon_car_care_program-teal.png" },
        brand: {
            name: "Express Oil Change & Tire Engineers",
            featured: false,
            logo: "https://www.syf.com/img/express_oil_logo.jpg",
            priority: 8,
            industry: [],
            network: {
                name: "SYF CAR CARE",
                description: "A SYF CAR CARE Partner",
                icon: "https://www.syf.com/img/icon_car_care_program-teal.png",
                pageUrl: "https://www.syf.com/carcare/cardholder.html",
            },
            region: ["SOUTH", "SOUTHEAST"],
        },
        links: [
            { linkLabel: "Find Location", linkUrl: "https://www.expressoil.com/locations", linkPlacement: 1 },
            { linkLabel: "Apply", linkUrl: "https://apply.syf.com/eapply/eapply.action?clientCode=EXPRESSOIL", linkPlacement: 2 },
        ],
        expiryMsg: "Expiring in 7 days",
    },
];

/**
 * Fetches all offers from the live SYF Marketplace API, then applies in-process filters.
 * Falls back to MOCK_OFFERS if the API call fails.
 *
 * Filter order (all additive/AND):
 *   1. industry  — substring match against offer.brand.industry[].name
 *   2. category  — free-text; matches industry names, brand name, or offer title
 *   3. offerType — matches offer.offerType.name
 *   4. region    — checks offer.brand.region
 *   5. network   — matches offer.brand.network.name
 *   6. brand     — substring match against offer.brand.name
 *   7. featured  — boolean match on offer.brand.featured
 *   8. pagination via limitOffersCount / offset
 */
export async function fetchOffers(
    input: GetOffersInput
): Promise<OffersResponse> {
    let allOffers: Offer[];

    try {
        console.error("[syf-marketplace-mcp] Calling live SYF API...");
        const res = await axios.get(SYF_API_URL, {
            headers: { "x-syf-api-key": SYF_API_KEY },
            params: { campaignMappingId: "ALL" },
            timeout: 10_000,
        });

        // The real API returns { offers: [...], requestId, campaign, ... }
        const body = res.data as { offers?: unknown[] };
        allOffers = Array.isArray(body.offers) ? (body.offers as Offer[]) : [];
        console.error(`[syf-marketplace-mcp] Syf Offers API working! returned ${allOffers.length} offers.`);
    } catch (err) {
        // Network error or API down — fall back to mock so the tool still works
        console.error("[syf-marketplace-mcp] Syf Offers API call failed, falling back to mock:", err);
        allOffers = [...MOCK_OFFERS];
    }

    let filtered: Offer[] = allOffers;

    // 1. Industry filter
    if (input.industry && input.industry.length > 0) {
        const industries = input.industry.map((i) => i.toUpperCase());
        filtered = filtered.filter((offer) =>
            offer.brand?.industry?.some((ind) =>
                industries.some((f) => ind.name.toUpperCase().includes(f))
            )
        );
    }

    // 2. Category filter (free-text, legacy)
    if (input.category) {
        const cat = input.category.toLowerCase().trim();
        filtered = filtered.filter((offer) =>
            offer.brand?.industry?.some((ind) => ind.name.toLowerCase().includes(cat)) ||
            offer.brand?.name?.toLowerCase().includes(cat) ||
            offer.title.toLowerCase().includes(cat)
        );
    }

    // 3. Offer type filter
    if (input.offerType && input.offerType.length > 0) {
        const types = input.offerType.map((t) => t.toUpperCase());
        filtered = filtered.filter((offer) =>
            offer.offerType ? types.some((t) => offer.offerType!.name.toUpperCase().includes(t)) : false
        );
    }

    // 4. Region filter
    if (input.region) {
        const regionFilter: string = input.region.toUpperCase();
        filtered = filtered.filter((offer) =>
            offer.brand?.region?.some((r) => r.toUpperCase().includes(regionFilter))
        );
    }

    // 5. Network filter
    if (input.network && input.network.length > 0) {
        const networks = input.network.map((n) => n.toUpperCase());
        filtered = filtered.filter((offer) =>
            offer.brand?.network
                ? networks.some((n) => offer.brand!.network!.name.toUpperCase().includes(n))
                : false
        );
    }

    // 6. Brand filter (substring match)
    if (input.brand) {
        const brandFilter = input.brand.toLowerCase();
        filtered = filtered.filter((offer) =>
            offer.brand?.name?.toLowerCase().includes(brandFilter)
        );
    }

    // 7. Featured filter
    if (input.featured !== undefined) {
        const featuredFilter: boolean = input.featured;
        filtered = filtered.filter((offer) => offer.brand?.featured === featuredFilter);
    }

    // 8. Pagination
    const start = input.offset ?? 0;
    const limit = input.limitOffersCount ?? filtered.length;
    filtered = filtered.slice(start, start + limit);

    return filtered;
}
