import express from "express";

const router = express.Router({ mergeParams: true });
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { getChatDataListByIdTs, getKeyDataById, sendMessage } from "../../data-access/ChatDao";
import { chatKeyPatchHandler, parseUpdatedUser } from "../../services/chat/ChatService";
import { PrivateChatKey } from "../../types/chat/Chat";

import { PatchChatKeyRequest } from "../../types/chat/Request";
import { PatchChatKeyResponse } from "../../types/chat/Response";

import { NextFunction, Request, Response } from "express";
import PrivateChatMessageRouter from "./PrivateChatMessageRouter";
import getLogger from "../../services/Logger"
import { publishMessage } from "../../services/Pusher";
import { userInfo } from "os";
const logger = getLogger();
router.use(express.json());

/**
 * Replace user's last read and received message
 * @date 3/23/2024 - 10:07:33 AM
 *
 * @async
 * @param {PatchChatKeyRequest} req
 * @param {PatchChatKeyResponse} res
 * @returns {*}
 */
const PatchChatKeyRouter = async (
	req: PatchChatKeyRequest,
	res: PatchChatKeyResponse,
	next: NextFunction
): Promise<any> => {
	// #swagger.tags = ['Chat Control']
	// #swagger.summary = 'Modify users lastRead and lastReceived message timestamp for chat'
	// #swagger.parameters['id'] = { description: "identifier of the chat session", required: true, type: 'string' }
	// #swagger.parameters['userId'] = { description: "identifier of the user for modifying lastReceived or lastRead", required: true, type: 'string' }

	/* #swagger.parameters['body'] = 
	{
		in: "body",
		description: "Update waitlist of a livestream using new users information",
		'@schema': 
		{
			"required": ["op", "path", "value"], 
		 	"properties" : 
			{
				"op" : {
					"type" : "string",
					"description": "operation for patch request: {REPLACE}",
				},
				"path" : {
					"type": "string",
					"description": "value to change {READ, RECEIVED} "
				},
				"value" : {
					"type": "number",
					"description": "value to be assigned",
				}
				
			}
		}
	}; 
		#swagger.responses[200] = {
		"description" : "Chat session",
		schema: {
				"userList": "01HPGHBN8NWGG4VFNP3PM4ND6N#01HPKDB7ENB0FDEGC62DKK00HR",
				"users": [
					{
						"lastRead": 1712659817975,
						"lastReceived": 1712659817975,
						"id": "01HPGHBN8NWGG4VFNP3PM4ND6N",
						"role": "ASTROLOGER"
					},
					{
						"lastRead": 1712659817975,
						"lastReceived": 1712659817975,
						"id": "01HPKDB7ENB0FDEGC62DKK00HR",
						"role": "USER"
					}
				],
				"id": "01HV17NSFQH0J2ER62SC6H6F2M"
			}
		}
	*/
	try {
		console.time();
		const patchReq = req.body;
		const { id, userId } = req.params;

		if (!patchReq.op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
			return;
		}

		if (!patchReq.path) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
			return;
		}

		if (!patchReq.value) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("value")};
			return;
		}
		if(patchReq.value.toString().length != 13 || isNaN(parseInt(patchReq.value.toString()))) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("value")};
			return;
		} 
		if (typeof(patchReq.value) != 'number') {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("value is not a number")};
			return;
		}
		const { op, path, value } = patchReq;

		const keyData = await getKeyDataById({ id });

		const updatedUser = parseUpdatedUser({ keyData, path, userId, value });

		const chatsHandler = await chatKeyPatchHandler({ op, path });
		const chats: PrivateChatKey = await chatsHandler({
			id,
			userId,
			keyData,
			updatedUser,
		});
		await publishMessage({
			uri: `session_${keyData.id}`, // change here
			action: "Message" + path[0].toUpperCase() + path.slice(1),
			message: userId,
		});
		
		res.json(chats);
		console.timeEnd();
	} catch (error) {
		logger.error(error);
		next(error)
	}
};


router.patch("/user/:userId", PatchChatKeyRouter);
router.use("/messages/", PrivateChatMessageRouter);
export default router;