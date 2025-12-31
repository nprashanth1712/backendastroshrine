export enum IntervalType {
    DAILY = "daily", 
    WEEKLY = "weekly", 
    MONTHLY = "monthly"
};

export interface ChannelData {
    livestream: number, 
    call: number,
    chat: number,
}
export interface AstrologerEarningListData {
    createTs: number,
    channelTimeSpent: ChannelData
    numberOfOrders: ChannelData,
    earnings: ChannelData,
}

export interface AstrologerEarnings {
    astrologerId: string,
    lastUpdated: number,
    daily: Array<AstrologerEarningListData>,
    weekly: Array<AstrologerEarningListData>,
    monthly: Array<AstrologerEarningListData>,
}