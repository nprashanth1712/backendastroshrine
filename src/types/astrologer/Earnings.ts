
export type BarData = {
    chat: number,
    livestream: number, 
    call: number;
};
export interface Earnings {
    astrologerId: string,
    timePeriodTs: string, 
    channelTimeSpent: BarData,
    numberOfOrders: BarData,
    earnings: BarData
};
