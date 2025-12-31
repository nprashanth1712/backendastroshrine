
export interface UserOrder {
    userId: string,
    hostId: string,
    hostIdTs: string,
    userName: string;
    hostName: string;
    ts: number,
    orderTentativeEndTs: number,
    orderEndTs: number,
    amount: number,
    orderType: string,
    resourceId?: string,
    recordingAvailable?: boolean,
    recordingId?: string
    subOrderType: string,
    status: 'Initialized' | string, 
};

