
export type HeaderTraceRequest = {
    channelId?: string,
    channelCreateTs?: number, 
    channelType?: string,

    userId?: string,
    userName?: string, 
    
    requestBody?: any,
    call?: string,
    timestamp?: number,
}
