
export type ChatUser = {
    id: string, 
    role: string,
    lastRead: number,
    lastReceived: number,
    ppUrl?: string,
}

export interface PrivateChatKey {
    id: string
    users: Array<ChatUser>,
    status: string,
    userList: string
}

export interface PrivateChat {
    id: string, 
    userTs: string,
    sentTs: number,
    type: string,
    tags?: string,
    hidden?: boolean,
    message: string,
    repliedTo?: {
        type: string,
        message: string,
        userTs: string,
    }
};

export interface PrivateChatResponse {
    id: string, 
    sentBy: string,
    ts: number,
    sentTs: number,
    type: string,
    tags?: string,
    hidden?: boolean,
    message: string,
    repliedTo?: {
        type: string,
        message: string,
        userTs: string,
    }
}
export enum MessageTypes { 
    text = "text",
    image = "image",
    video = "video",
    recording = "recording"
}



