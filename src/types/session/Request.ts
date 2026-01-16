import { Request } from "express";

export interface getUserSessionRequest extends Request {
    params: {
        id: string;
    };
    body: {
        deviceId: string,
        role: string,
        expiry: string, 
        tokentype: string,
    }
}

export interface deactivateUserSessionRequest extends Request {
    params: {
        id: string;
    },
    body: {
        sessionId: string
    }
}
