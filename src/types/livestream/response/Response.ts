import { Response } from "express"
import { Channel, TempHost, Waitlist } from "../models/Livestream"

export interface GetChannelsResponse extends Response {
    body?: Array<Channel>
}

export interface EnableChannelResponse extends Response {
    body?: Channel
}

export interface GetUserLiveStreamResponse extends Response {
    body?: Channel,
}

export interface StopLiveStreamResponse extends Response {
    body?: Channel
}

export interface GetTempHostResponse extends Response {
    body?: TempHost
}

export interface AddTempHostResponse extends Response {
    body?: Channel,
}

export interface UpdateTempHostResponse extends Response {
    body?: Channel,
}

export interface UpdateHostResponse extends Response {
    body?: Channel,
}

export interface GetWaitlistResponse extends Response {
    body?: Array<Waitlist>
}

export interface UpdateWaitlistResponse extends Response {
    body?: Channel
}

export interface RemoveFromWaitlistResponse extends Response {
    body?: Channel
}