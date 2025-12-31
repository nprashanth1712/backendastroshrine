// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { SupportCaseDao } from "../../data-access-supabase/SupportCaseDao";
import { SupportCase } from "../../types/case/Case";
import { PatchRequestBody } from "../../types/case/Request";
import { invalidParameter } from "../../utils/ErrorUtils";

// Adapter functions to match the old DynamoDB interface
const updateCaseHiddenById = SupportCaseDao.updateCaseHiddenById.bind(SupportCaseDao);
const updateCaseStatusById = SupportCaseDao.updateCaseStatusById.bind(SupportCaseDao);


type HandlerFunction = ({
    id,
    value,
}: {
    id: string;
    value: any
}) => Promise<SupportCase>;


// TODO NEEDS UPDATE WITH RECORD<T> VALUES 
export const casePatchArrayHandler = async ({id, patchArray}: {id: string, patchArray: Array<PatchRequestBody<any>>}) => {
	// STATUS
	const statusPatch = patchArray.find(value => value.path.toUpperCase() == "STATUS");


	// STATUS 
	if (statusPatch?.op)
		{
			console.log("EHRE")
			const resolutionPatch = patchArray.find(value => value.path.toUpperCase() == "COMMENT_RESOLUTION");
			if (!resolutionPatch?.op) {
				throw {statusCode: 400, code: "InvalidPathParameter", message: "No resolution comment is specified."}
			}
			return await updateCaseStatusById({id, value: statusPatch.value, resolution: resolutionPatch.value})

	// HIDDEN 
	} else if (patchArray[0].path.toUpperCase() == "HIDDEN")
		{
		if (patchArray[0].path.toUpperCase() == "HIDDEN") {
			if (typeof patchArray[0]?.value != 'boolean') {
				throw {statusCode: 400, code: "InvalidPathParameter", message: "value is not boolean for hidden."}
			}
			return await updateCaseHiddenById({id, value: patchArray[0].value})
		}
	} else 
	{
		throw {statusCode: 400, code: "InvalidPathParameter", message: "Unidentified Path."}
	}
}


export const casePatchHandler = ({ op, path }: { op: string; path: string }): HandlerFunction => {
	switch (op.toUpperCase()) {
		case "REPLACE":
			return caseReplaceHandler({ path });
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};

const caseReplaceHandler = ({ path }: { path: string }): HandlerFunction => {
	switch (path.toUpperCase()) {
		// case "STATUS": {
		// 	return updateCaseStatusById;
		// }
		case "HIDDEN": {
			return updateCaseHiddenById
		}
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};