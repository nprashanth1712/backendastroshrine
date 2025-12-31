import { Request } from "express"

export interface ReplyReviewMessageData extends Request {
    params: {
        id: string,
        userId: string,
        ts: string,
    },
    body: {
        
        message: string,
    }
}