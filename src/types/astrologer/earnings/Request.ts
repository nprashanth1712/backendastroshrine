import { Request } from "express"
import { AstrologerEarningListData, IntervalType } from "./Earnings"

export interface EarningPatchRequest extends Request {
    params: {
        id: string,
    }
    body: {
        op: string,
        path: IntervalType,
        value: Array<AstrologerEarningListData>,
    }
}