import { Request } from "express"
import { SupportCase } from "./Case"


export interface InitializeCaseRequest extends Request {
    files?: any,
    body: {
        userId: string,
        caseType: string, 
        details: string,
    }
}

export interface PatchRequestBody<T> {
    op: string, 
    path: string, 
    value: T
}
export interface UpdateCaseRequest<T> extends Request {
    body: Array<PatchRequestBody<T>>
}