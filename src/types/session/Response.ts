import { Response } from "express";
import { UserSession } from "./Session";

export interface GetUserSessionResponse extends Response {
    body?: Array<UserSession>;
}
