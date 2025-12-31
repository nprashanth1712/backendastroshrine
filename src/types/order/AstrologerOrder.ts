export interface AstrologerOrder {
    astrologerId: string, 
    orderTs: number, 
    orderType: "LIVESTREAM" | 'CHAT' | "CALL" |  string, 
    timeSpent: number,
    subOrderType: string, 
    amount: number, 
    customerId: string,
}