import express, { Response, Request } from "express";
const router = express.Router({ mergeParams: true });
import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { getChatDataListById, getChatDataListByIdTs, sendMessage } from "../../data-access/ChatDao";
import { publishMessage } from "../../services/Pusher";
import { chatMessagePatchHandler, handleChatSendMessage } from "../../services/chat/ChatService";
import { MessageTypes, PrivateChat } from "../../types/chat/Chat";
import {
	GetChatListRequest,
	InitializeMessageRequest,
	InitializeMessageRequestBody,
	PatchChatRequest,
} from "../../types/chat/Request";
import { GetChatListResponse, InitializeMessageResponse, PatchChatResponse } from "../../types/chat/Response";
import { NextFunction } from "express";
router.use(express.json());
import getLogger from "../../services/Logger";
import { ValuesOfCorrectTypeRule } from "graphql";
import { ChatHelpers } from "../../services/chat/ChatHelpers";
const logger = getLogger();
/**
 * Get list of chats starting from timestamp
 * @date 3/23/2024 - 10:20:11 AM
 *
 * @async
 * @param {GetChatListRequest} req
 * @param {GetChatListResponse} res
 * @returns {*}
 */
const getChatDataListByIdRouter = async (req: GetChatListRequest, res: GetChatListResponse, next: NextFunction) => {
	// #swagger.tags = ['Chat Control']
	// #swagger.summary = 'Get list of chats starting by a timestamp or latest 50 chats'
	// #swagger.parameters['id'] = { description: "channelId of livestream", required: true, type: 'string' }
	// #swagger.parameters['timestamp'] = { description: "timestamp for retrieving list of chats.\nneeds to be in epoch miliseconds", required: true, type: 'number' }
	// #swagger.parameters['key'] = { description: "key for the last chat rendered in the 50 chats.\nneeds to be in epoch miliseconds", required: true, type: 'number' }
	/*
	#swagger.responses[200] = {
		"description" : "list of chats and their details",
		schema: [{
			"type": "text",
   			"ts": "1999999999999",
    		"sentBy": "01HPKDB7ENB0FDEGC62DKK00HR",
    		"message": "hello"
		}]
	}
	*/
	try {
		console.time();
		const { id } = req.params;
		const { timestamp, key, tags, type } = req.query;
		let resp: Array<PrivateChat>;
		if (!timestamp) {
			resp = await getChatDataListById({ id, key: key as string });
		} else {
			if (timestamp.length != 13) {
				res.status(400).json({ err: invalidParameter("timestamp") });
				return;
			}
			resp = await getChatDataListByIdTs({
				id: id,
				ts: parseInt(timestamp as string),
			});
		}

		const returnData = ChatHelpers.parseChatListForResponse({
			chats: resp,
			tags: tags as string,
			type: type as string,
		});
		console.log("get chat listreturn ", returnData);
		res.json(returnData);
		console.timeEnd();
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

/**
 * Sends a new message in chat
 * @date 3/23/2024 - 10:20:43 AM
 *
 * @async
 * @param {InitializeMessageRequest} req
 * @param {InitializeMessageResponse} res
 * @returns {*}
 */
const sendMessageRouter = async (req: InitializeMessageRequest, res: InitializeMessageResponse, next: NextFunction) => {
	// #swagger.tags = ['Chat Control']
	// #swagger.summary = 'Send a new message in chat'
	/* 
	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "Send a new message in chat\n - cannot send the message having same timestamp and user\n - retrieves all the messages after the lastReceived",
		'@schema': 
		{
			"required": ["sentBy", "lastReceived", "ts", "message", "type"], 
		 	"properties" : 
			{
				"sentBy" : {
					"type" : "string",
					"description": "identifier of the message sender",
				},
				"lastReceived" : {
					"type": "number",
					"description": "retrieve all the messages after lastReceived"
				},
				"ts" : {
					"type": "number",
					"description": "timestamp of the new message sent",
				},
				"message": {
					"type" : "string",
					"description": "actual message data, cannot be more than 1024 words"
				},
				"type": {
					"type" : "string",
					"description": "the type of the new message\ntext, image or video."
				}
				
			}
		}
	};
	#swagger.responses[201] = {
		"description" : "list of chats and their details",
		schema: [{
			"type": "text",
   			"ts": "1999999999999",
    		"sentBy": "01HPKDB7ENB0FDEGC62DKK00HR",
    		"message": "hello"
		}]
	}
	*/
	try {
		console.time();
		const { id } = req.params;
		console.log("message in id: ", id);
		const data: InitializeMessageRequestBody = req.body;

		data.id = id;

		if (!data.lastReceived) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("lastReceived") };
			return;
		}
		if (!data.sentBy) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("sentBy") };
			return;
		}
		if (!data.sentTs) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("ts") };
			return;
		}

		if (data.sentTs.toString().length != 13 || isNaN(data.sentTs)) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("ts") };
			return;
		}
		if (!data.messageType || !Object.values(MessageTypes).includes(data.messageType as MessageTypes)) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("messageType, must be either text, image, recording or video."),
			};
		}
		// if (data.repliedTo.userId && (!data.repliedTo.message || !data.repliedTo.ts)) {
		// 	res.status(400).json({err: invalidParameter("repliedTo")})
		// 	return;
		// }
		if (data.lastReceived.toString().length != 13 || isNaN(data.lastReceived)) {
			throw { statusCode: 400, code: "InvalidParameter", message: invalidParameter("lastReceived") };
			return;
		}

		if (parseInt(data.lastReceived.toString()) > parseInt(data.sentTs.toString())) {
			throw {
				statusCode: 400,
				code: "InvalidParameter",
				message: invalidParameter("lastReceived could not be greater than currentTs"),
			};
		}
		let messageData;
		if (data.messageType == "text") {
			if (!data.message) {
				throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("message") };
			}
			if (data.message.length > 1024) {
				throw {
					statusCode: 400,
					code: "InvalidParameter",
					message: invalidParameter("message length could not be greater than 1024"),
				};
			}
			messageData = data.message;
		} else if (data.messageType == "image" || data.messageType == "video") {
			if (!req.files || !req.files.message) {
				throw {
					name: "INVALID_PARAM",
					message: `Unable to upload file ${id}.`,
				};
			}
			messageData = req.files.message;
		}

		// Parse
		let chatMessageSendArgument: any = {
			id: data.id,
			sentBy: data.sentBy,
			sentTs: data.sentTs,
			message: messageData,
			type: data.messageType,
			repliedTo: data.repliedTo,
		};
		if (data.messageTags) {
			let tagsDecoded = atob(data.messageTags);
			const tagSortedAndDecoded = tagsDecoded.split("#").sort().join("#");
			chatMessageSendArgument.tags = tagSortedAndDecoded;
		}
		await handleChatSendMessage(chatMessageSendArgument);

		// send pusher message to everyone in the chat
		// since the get call should be called to get all messages
		// we should receive notifications after lastRead right?
		const previousData = await getChatDataListByIdTs({
			id,
			ts: data.lastReceived,
		});
		let returnData = ChatHelpers.parseChatListForResponse({ chats: previousData });

		console.timeEnd();
		res.status(201).json(returnData);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

/**
 * Edit a message in chat by timestamp
 * @date 3/23/2024 - 10:20:57 AM
 * @todo edit return type during response
 * @async
 * @param {PatchChatRequest} req
 * @param {PatchChatResponse} res
 * @returns {*}
 */
const patchChatRouter = async (req: PatchChatRequest, res: PatchChatResponse, next: NextFunction) => {
	// #swagger.tags = ['Chat Control']
	// #swagger.summary = 'Edit a message in chat by its timestamp'
	// #swagger.parameters['id'] = { description: "identifier of the chat session", required: true, type: 'string' }
	// #swagger.parameters['timestamp'] = { description: "timestamp of the particular message to be edited", required: true, type: "number" }
	// #swagger.parameters['userId'] = { description: " - identifier of the user for modifying lastReceived or lastRead", required: true, type: 'string' }
	/*
	#swagger.parameters['body'] = 
	{
		in: "body",
		description: "patch request operation values.",
		'@schema': 
		{
			"required": ["op", "path", "value"], 
		 	"properties" : 
			{
				"op" : {
					"type" : "string",
					"description": "operation for patch request: {REPLACE, ADD}",
				},
				"path" : {
					"type": "string",
					"description": "value to change {LATEST} "
				},
				"value" : {
					"type": "string",
					"description": "new message\ncannot be more than 1024 bytes/words",
				}
				
			}
		}
	};  
	#swagger.responses[200] = {
		"description" : "list of chats and their details",
		schema: [{
			"type": "text",
   			"ts": "1999999999999",
    		"sentBy": "01HPKDB7ENB0FDEGC62DKK00HR",
    		"message": "hello"
		}]
	}
	*/
	try {
		console.time();
		const patchReq = req.body;
		const { id } = req.params;

		if (!patchReq.op) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("op") };
			return;
		}

		if (!patchReq.path) {
			throw { statusCode: 400, code: "InvalidParameter", message: missingParameter("path") };
			return;
		}

		// if (!patchReq.value) {
		// 	res.status(400).json({ err: missingParameter("value") });
		// 	return;
		// }

		// if (patchReq.value.length > 1024) {
		// 	res.status(400).json({ err: invalidParameter("value") });
		// 	return;
		// }

		const { op, path, value } = patchReq;

		const chatsHandler = chatMessagePatchHandler({ op, path });
		const chats: PrivateChat = await chatsHandler({
			id,
			value,
		});
		await publishMessage({
			uri: `session_${id}`,
			action: "EditMessage",
			message: {
				id: id,
				message: value,
			},
		});
		const response = {
			...chats,
			ts: parseInt(chats.userTs.split("#")[0]),
			userId: chats.userTs.split("#")[1],
		};
		// if (response.userTs) delete response.userTs;
		console.timeEnd();
		res.json(response);
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

router.get("/", getChatDataListByIdRouter);
router.post("/", sendMessageRouter);
router.patch("/", patchChatRouter);
export default router;
