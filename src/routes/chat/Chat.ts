import express, { Request, Response, NextFunction } from "express";
import {
	getKeyDataById,
	getChatKeyByUserIds,
	initializeChat,
	updateChatSessionStatus,
	getChatDataListByIdTs,
} from "../../data-access/ChatDao";

import { invalidParameter, missingParameter } from "../../utils/ErrorUtils";
import { PrivateChatKey } from "../../types/chat/Chat";

import { GetChatRequest, InitializeChatRequest} from "../../types/chat/Request";
import { GetChatResponse, InitializeChatResponse } from "../../types/chat/Response";

import { ErrorCodes } from "../../constants/error/ErrorCodes";
import PrivateChatRouter from "./PrivateChatRouter"
import AgentChatRouter from "./astrologer-agent/AgentChat"
import getLogger from "../../services/Logger";
import ChatUserRouter from "./ChatUserRouter";
import { publishMessage } from "../../services/Pusher";
import {ChatHelpers } from "../../services/chat/ChatHelpers";

const logger = getLogger();


const router = express.Router({ mergeParams: true });
router.use(express.json());

/**
 * Description Get Chat IDs by user(s)
 * @todo optimize table scan for single user query
 * @date 3/22/2024 - 12:06:31 PM
 *
 * @async
 * @param {GetChatRequest} req
 * @param {GetChatResponse} res
 * @returns {*}
 */
const getChatIdsByUserIdsRouter = async (
	req: GetChatRequest,
	res: GetChatResponse,
	next: NextFunction
) => {
	// #swagger.tags = ['Chat Control']
	// #swagger.summary = 'Get Chat ID(s) by User Id(s)'
	/*#swagger.description = 'Query single userId for list of chats of the user.\n 
	Query multiple userids for chatId of the particular session of users.
	#swagger.parameters['users'] = {
		"required": "true",
		"type": "string", 
		"description": "Require single userid - userid.\n Require user ids seperated by commas\n
		ie - userId1, userId2"
	}
	#swagger.responses[200] = {
		"description" : "List of chat sessions for single user.\nChat session for multiple users",
		schema: [
			{
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
		]
	}
	*/ 
	try {
		const users = req.query.users as string;
		console.log("USERS: ", users)
		let resp: Array<PrivateChatKey> = [];
		if (!users) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("users")};
		}
		if( users.split(",").length == 2 && !users.split(",")[1]) {
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("userId not specified of second user")};
		}


		let isNormalChat = !(users.includes('case_') || users.includes('chatAssistant_'));
		// IF SINGLE USER QUERY 
		if (users.split(",").length == 1 ) {
			resp = await ChatHelpers.getChatKeysByUserIdHandler({ userId: users });
		// IF MULTIPLE USER QUERY
		} else {
			let trimmedUserArray = [];
			for (const user of users.split(',')) {
				trimmedUserArray.push(user.trim());
			}
			trimmedUserArray.sort();
			const chatKeyIndexList = await getChatKeyByUserIds({
				userIdListStr: trimmedUserArray.sort().join("#"),
			});
			for await(const chatKeyIndex of chatKeyIndexList) {
				if (isNormalChat) resp.push(await getKeyDataById(chatKeyIndex))
				else if (chatKeyIndex?.id && chatKeyIndex?.status == "ACTIVE") resp.push(await getKeyDataById(chatKeyIndex));
			}
		}
		res.json(resp);
	} catch (error) {
		logger.error(error);
		next(error)
	}
};

/**
 * Description Initialize a new chat session
 * @date 3/22/2024 - 12:08:06 PM
 *
 * @async
 * @param {InitializeChatRequest} req
 * @param {InitializeChatResponse} res
 * @returns {*}
 */
const initializeChatRouter = async (
	req: InitializeChatRequest,
	res: InitializeChatResponse,
	next: NextFunction
) => {
	/*
	#swagger.tags = ['Chat Control']
	#swagger.summary = 'Initialize a new chat session for users'
	#swagger.parameters['body'] = 
	{
		in: "body",
		"type" : "object",
		description: "Initialize a chat session between one or multiple users\n
		require role for identifying the host of the chat",
		'@schema': {
		 	"properties" : {
				"users" : {
						"type" : "array",
						"description": "list of users",
						"items" : {
							"type" : "object",
							"properties": {
							"id": {
								"type": "string",
								"description": "identifier of the user"
							},
							"role": {
								"type" : "string",
								"description": "role of the user"
							}
						}
						}
				}
				},
		}
	}; 

	#swagger.responses[200] = {
		"description" : "Chat session details",
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
		const data : PrivateChatKey = req.body;

		if (!data.users || data.users.length < 2) {
            const error = ErrorCodes['400']
			throw {statusCode: 400, code: "InvalidParameter", message: invalidParameter("users")};
		}
		for(var i = 0; i < data.users.length; i++) {
			if (!data.users[i].id) {
				throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("id")};
			}
			if (!data.users[i].role) {
				throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("role")};
			}
		}
		const response: PrivateChatKey = await initializeChat(data);

		res.status(201).json(response);
		console.timeEnd();
	} catch (error) {
		logger.error(error);
		next(error)
	}
};

const updateChatStatusRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		console.time();
		const patchReq = req.body;
		const { id } = req.params;

		if (!patchReq.op) {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("op")};
		}

		if (!patchReq.path || patchReq.path.toUpperCase() != "STATUS") {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("path")};
		}

		if (!patchReq.value || patchReq.value == "ACTIVE") {
			throw {statusCode: 400, code: "InvalidParameter", message: missingParameter("value")};
		}

		const updatedChatStatus = await updateChatSessionStatus({id, status: patchReq.value });
		res.status(200).json(updatedChatStatus);
		await publishMessage({
			uri: `session_${id}`,
			action: "SESSION_ENDED",
			message: {id: id},
		});
		console.timeEnd();
	} catch (error: any) {
		logger.error(error);
		next(error);
	}
};

const getLatestAssistantRouter = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const {userId} = req.params;
		const chatDataList = await ChatHelpers.getChatKeysByUserIdHandler({userId: 'chatAssistant_' + userId});
		let unreadAssistantChatKeys: Array<PrivateChatKey> = [] as Array<PrivateChatKey>;
		const promises = chatDataList.map(async (chatData) => {
			const currentUser = chatData.users.find(
				(value) => value.id === userId
			);
	
			if (!currentUser?.id) {
				throw {
					statusCode: 404,
					code: "UserNotFound",
					message: `Could not find user`,
				};
			}
			
			const messagesList = await getChatDataListByIdTs({
				id: chatData.id,
				ts: currentUser.lastReceived,
			});
			if (messagesList) {
				unreadAssistantChatKeys.push(chatData)
			}
		});
		await Promise.all(promises);
		res.status(200).json(unreadAssistantChatKeys);
	} catch(error) {
		console.log("error in getLatestAssistantRouter");
		next(error);
	}
}

router.use("/assistant", AgentChatRouter);
router.use("/user/:userId", ChatUserRouter)
router.get("/", getChatIdsByUserIdsRouter);
router.post("/", initializeChatRouter);
router.get("/:userId/assistant", getLatestAssistantRouter)
router.patch('/:id', updateChatStatusRouter);
router.use("/:id", PrivateChatRouter);
export default router;