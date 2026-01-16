import { Response } from "express";
import { UserSession } from "./session";

export interface GetUserSessionResponse extends Response {
    body?: Array<UserSession>;
}
