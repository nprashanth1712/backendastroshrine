import { PrivateChatKey } from "./Chat"
import { Request } from "express"
export interface GetChatRequest extends Request {
    query: {
        users: string,
    }
}


export interface GetChatListRequest extends Request {
    params: {
        id: string, 
        timestamp: string,
    }
}

export interface InitializeChatRequest extends Request{
    body: PrivateChatKey
 } 


export interface InitializeMessageRequestBody {
    
        id?: string,
        sentTs: number,
        lastReceived: number,
        sentBy: string,
        messageType: string,
        message: string,
        messageTags?: string,
        repliedTo: {
            userId: string,
            ts: number, 
            message: string,
            type: string,
        }
}
export interface InitializeMessageRequest extends Request {
    params: {
        id: string,
    }
    body: InitializeMessageRequestBody
}

export interface PatchKeyRequest extends Request {
    params: {
        id: string,
        userId: string,
    }
    body: {
        op: string,
        path: string,
        value: number,
    }
}

export interface PatchChatKeyRequest extends Request {
    params: {
        id: string,
        timestamp: string,
        userId: string,
    }
    body: {
        op: string,
        path: string,
        value: string,
    }
}


export interface PatchChatRequest extends Request {
    params: {
        id: string,
        timestamp: string,
        userId: string,
    }
    body: {
        op: string,
        path: string,
        value: string,
    }
}
 