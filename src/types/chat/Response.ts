import { PrivateChat, PrivateChatKey } from "./Chat";
import { Response } from "express";
export interface GetChatResponse extends Response {
    body?: Array<PrivateChatKey>;
}


export interface GetChatListResponse extends Response {
    body?: Array<PrivateChat>
};


export interface InitializeChatResponse extends Response {
    body?: PrivateChatKey
}

export interface InitializeMessageResponse extends Response {
    body?: Array<PrivateChat>
}


export interface PatchChatKeyResponse extends Response {
    body?: PrivateChatKey
}


export interface PatchChatResponse extends Response {
    body?: PrivateChat,
}
