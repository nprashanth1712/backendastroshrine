import { Response } from "express"
import { EndUser } from "./models/User"
export interface GetAllUserResponse extends Response {
    body?: Array<EndUser>
}

export interface AddUserResponse extends Response {
    body?: EndUser,
}

export interface DeleteUserResponse extends Response {
    body?: EndUser,
}

export interface GetUserResponse extends Response {
    body?: EndUser,
}