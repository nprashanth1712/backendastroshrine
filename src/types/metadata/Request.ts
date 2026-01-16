import { Request } from "express";
import { MetaData } from "./Metadata";

export interface AddMetaDataRequest extends Request {
    files? : any,
    body : {metaData : MetaData}
}