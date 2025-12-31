type OfferEligibility = "one-time" | "reusable" | "time-based";

interface Offer {
    id: string,
    type: string, 
    rate: number,
    eligibility: OfferEligibility,
    couponCode: string,

    cashback?: number,
    cashbackLimit?: number,
    
}
export {
    OfferEligibility,
    Offer,
}