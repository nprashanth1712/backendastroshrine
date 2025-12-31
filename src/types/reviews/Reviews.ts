export interface Review {
    hostId: string,
    tsUserId: string,
    userName?: string,
    rating: number,
    comment: string,
    reply: string, 
}

export interface ReviewView {
    hostId: string,
    userId: string,
    ts: number,
    name?: string,
    rating: number,
    comment: string, 
    reply: string,
}
