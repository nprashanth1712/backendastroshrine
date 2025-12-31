import { Request } from "express"
import { ChannelSubType, ChannelType, TempHost } from "../models/Livestream"
import { EndUser } from "../../user/models/User"
export interface EnableChannel extends Request {
    body: {
        channelId: string
        host: EndUser & {uid: number},
        deviceId: string,
    }
}

export interface UpdateChannelStatusRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
    }
    body: {
        op: string,
        path: string,
        value: boolean,
    }
}
export interface GetUserLiveStreamRequest extends Request {
    params: {
        channelId: string,
    }
}

export interface StopLiveStreamRequest extends Request {
    params: {
        channelId: string,
    }
}

export interface GetTempHostRequest extends Request {
    params: {
        channelId: string,
    }
} 

export interface AddTempHostRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
    }
    body: TempHost & {uid: number},
}

export interface UpdateTempHostRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
        userId: string,
    }
    body: {
        op: string,
        path: string,
        value: string,
    }
}
export interface UpdateHostRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
    }
    body: {
        op: string,
        path: string,
        value: string,
    }
}

export interface GetWaitlistRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
    }
}

export interface UpdateWaitlistRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
    }
    body: {
        id: string, 
        uid: number,
        name: string,
        subType?: ChannelSubType,
    }
}

export interface RemoveFromWaitlistRequest extends Request {
    params: {
        channelId: string,
        channelType: ChannelType
        waitlistId: string,
    }
}