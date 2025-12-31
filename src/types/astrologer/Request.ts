import { Request } from "express";

namespace AstrologerRequest {

    export interface AstrologerDetails {
        phoneNumber: string;
		expertise?: Array<string>;
		experience?: number;
		aboutMe?: string;
        languages?: Array<string>
    }
	export interface AddAstrologer extends Request {
		body: AstrologerDetails
	}
}
export { AstrologerRequest };
