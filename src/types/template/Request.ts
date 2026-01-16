import { Request } from "express"

export interface UploadTemplateRequest extends Request {
    files?: any,
    body : {
        profile : any
        channelType: string,
        name: string,
        format: string,
    }
    
}

export interface UploadSampleRequest extends Request {
    files?: any,
    body : {
        id: string
    }
    
}