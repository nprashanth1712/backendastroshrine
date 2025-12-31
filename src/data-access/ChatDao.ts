import { ulid } from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";

import { ChatUser, PrivateChat, PrivateChatKey } from "../types/chat/Chat";
import { dynamoClient, CHAT_KEY_TABLE, CHAT_TABLE, CHAT_USER_TABLE } from "../constants/Config";

/**
 * Get a specific private chat by timestamp and user id - used for edit message
 * @date 4/6/2024 - 3:53:32 PM
 *
 * @async
 * @param {{
 * 	id: string,
 * 	userId: string,
 * 	ts: number,
 * }} param0
 * @param {string} param0.id
 * @param {string} param0.userId
 * @param {number} param0.ts
 * @returns {Promise<Array<PrivateChat>>}
 */
const getChatById = async ({ id, userId, ts }: { id: string; userId: string; ts: number }): Promise<Array<PrivateChat>> => {
	const userTs = ts + "#" + userId;
	const params = {
		TableName: CHAT_TABLE,
		KeyConditionExpression: "id = :id AND userTs = :userTs",
		ExpressionAttributeValues: {
			":id": id,
			":userTs": userTs,
		},
	};
	try {
		const result = await dynamoClient.query(params).promise();
		return result.Items as PrivateChat[];
	} catch (error) {
		console.error("Unable to query. Error:", JSON.stringify(error, null, 2));
		throw Error("Unable to query: GetChatById");
	}
};

// get list of PrivateChat(s) by id starting from timestamp = ts

/**
 * Get list of Chats.
 * @date 3/22/2024 - 1:56:06 PM
 *
 * @async
 * @param {{
 * 	id: string;
 * 	ts: number;
 * }} param0
 * @param {string} param0.id
 * @param {number} param0.ts
 * @returns {Promise<Array<PrivateChat>>}
 */
const getChatDataListByIdTs = async ({ id, ts }: { id: string; ts: number }): Promise<Array<PrivateChat>> => {
	const params = {
		TableName: CHAT_TABLE,
		KeyConditionExpression: "id = :id AND userTs > :timestamp",
		ExpressionAttributeValues: {
			":id": id,
			":timestamp": ts.toString(),
		},
	};
	try {
		const result = await dynamoClient.query(params).promise();
		return result.Items as PrivateChat[];
	} catch (error) {
		console.error("Unable to query. Error:", JSON.stringify(error, null, 2));
		throw Error("Unable to query: GetChatListByIdTs");
	}
};

const getChatDataListById = async ({ id, key }: { id: string; key: string }) => {
	const params: DocumentClient.QueryInput = {
		TableName: CHAT_TABLE,
		KeyConditionExpression: "id = :id",
		ExpressionAttributeValues: {
			":id": id,
		},
		ScanIndexForward: false,
		// Limit: 50,
	};
	if (key) {
		console.log(key.replace("-", "#"));
		params.ExclusiveStartKey = { id: id, userTs: key.replace("-", "#") };
	}
	try {
		const result = await dynamoClient.query(params).promise();
		return result.Items as PrivateChat[];
	} catch (error) {
		console.error("Unable to query. Error:", JSON.stringify(error, null, 2));
		throw Error("Unable to query: GetChatListById");
	}
};
/**
 * Get chat information.
 * @date 3/22/2024 - 1:58:41 PM
 *
 * @async
 * @param {{
 * 	id: string;
 * }} param0
 * @param {string} param0.id
 * @returns {Promise<PrivateChatKey>}
 */
const getKeyDataById = async ({ id }: { id: string }): Promise<PrivateChatKey> => {
	const params: DocumentClient.GetItemInput = {
		TableName: CHAT_KEY_TABLE,
		Key: { id: id },
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	return resp.Item as PrivateChatKey;
};

const updateChatSessionStatus = async ({ id, status }: { id: string; status: string }) => {
	const params: DocumentClient.UpdateItemInput = {
		TableName: CHAT_KEY_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #status = :newStatus",
		ExpressionAttributeValues: { ":newStatus": status },
		ExpressionAttributeNames: { "#status": "status" },
		ReturnValues: "ALL_NEW",
	};

	const response = await dynamoClient.update(params).promise();
	return response.Attributes;
};
/**
 * Get a chat information by list of users.
 * @date 3/22/2024 - 1:59:33 PM
 *
 * @async
 * @param {{
 * 	userIdListStr: string;
 * }} param0
 * @param {string} param0.userIdListStr
 * @returns {Promise<PrivateChatKey>}
 */
const getChatKeyByUserIds = async ({ userIdListStr }: { userIdListStr: string }): Promise<Array<PrivateChatKey>> => {
	console.log(userIdListStr);
	const params: DocumentClient.QueryInput = {
		TableName: CHAT_KEY_TABLE,
		IndexName: "userListGlobalIndex",
		KeyConditionExpression: "userList= :userIdListStr",
		ExpressionAttributeValues: {
			":userIdListStr": userIdListStr,
		},
	};

	const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	console.log(resp.Items);
	return resp.Items as Array<PrivateChatKey> ?? [] as Array<PrivateChatKey>;
};

/**
 * Get list of conversations by user id.
 * @date 3/22/2024 - 2:00:38 PM
 *
 * @async
 * @param {{
 * 	userId: string;
 * }} param0
 * @param {string} param0.userId
 * @returns {Promise<Array<PrivateChatKey>>}
 */
const getChatKeysByUserId = async ({ userId }: { userId: string }): Promise<Array<PrivateChatKey>> => {
	const params: DocumentClient.ScanInput = {
		TableName: CHAT_KEY_TABLE,
		FilterExpression: "contains(userList, :userId) and #status = :curStatus", // assume we only talk about the active session here
		ExpressionAttributeValues: {
			":userId": userId,
			":curStatus": "ACTIVE",
		},
		ExpressionAttributeNames: { "#status": "status" },
	};

	const resp: DynOutWithError<DocumentClient.ScanOutput> = await dynamoClient.scan(params).promise();
	return (resp?.Items || {}) as Array<PrivateChatKey>;
};

/**
 * Create a new conversation by list of users
 * @date 3/22/2024 - 2:01:29 PM
 *
 * @async
 * @param {PrivateChatKey} privateChatKey
 * @returns {Promise<PrivateChatKey>}
 */
const initializeChat = async (privateChatKey: PrivateChatKey): Promise<PrivateChatKey> => {
	const chatId = ulid();
	privateChatKey.users = privateChatKey.users.sort();
	const currentTime = Date.now();

	// ChatUserTable info

	const chatKeyBuffer: PrivateChatKey = {
		users: privateChatKey.users.map((user) => ({
			id: user.id,
			role: user.role,
			lastRead: currentTime,
			lastReceived: currentTime,
		})),
		id: chatId,
		status: "ACTIVE",
		userList: privateChatKey.users
			.map((user) => user.id)
			.sort()
			.join("#"),
	};

	const transactParams: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: {
					TableName: CHAT_KEY_TABLE,
					Item: chatKeyBuffer,
					ConditionExpression: "attribute_not_exists(id)",
				},
			},
		],
	};

	// The ChatUserKey table details
	for (const user of privateChatKey.users) {
		const transactDataOfUser = {
			Put: {
				TableName: CHAT_USER_TABLE,
				Item: {
					userId: user?.id,
					tsChatId: currentTime + "#" + chatId,
				},
			},
		};

		transactParams.TransactItems.push(transactDataOfUser);
	}
	await dynamoClient.transactWrite(transactParams).promise();
	return chatKeyBuffer as PrivateChatKey;
};

/**
 * Update a chat user's information.
 * @date 3/22/2024 - 4:25:32 PM
 *
 * @async
 * @param {{
 * 	id: string;
 *     userId: string,
 *     keyData: PrivateChatKey,
 * 	updatedUser: ChatUser;
 * }} param0
 * @param {string} param0.id
 * @param {string} param0.userId
 * @param {PrivateChatKey} param0.keyData
 * @param {ChatUser} param0.updatedUser
 * @returns {Promise<PrivateChatKey>}
 */
const updateChatKeyUsersList = async ({
	id,
	userId,
	keyData,
	updatedUser,
}: {
	id: string;
	userId: string;
	keyData: PrivateChatKey;
	updatedUser: ChatUser;
}): Promise<PrivateChatKey> => {
	const updatedUsers = [...keyData.users.filter((user) => user.id != userId), updatedUser];
	try {
		const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
			TableName: CHAT_KEY_TABLE,
			Key: { id },
			UpdateExpression: "set #users = :updatedUsers",
			ExpressionAttributeValues: {
				":updatedUsers": updatedUsers,
			},
			ExpressionAttributeNames: {
				"#users": "users",
			},
			ReturnValues: "ALL_NEW",
		};
		const response = await dynamoClient.update(params).promise();
		return (response.Attributes || {}) as PrivateChatKey;
	} catch (error) {
		console.error("Error updating item:", error);
		throw Error("Unable to update: updateUser");
	}
};

const updateUserChatSession = async ({ id, status }: { id: string; status: string }): Promise<PrivateChatKey> => {
	try {
		const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
			TableName: CHAT_KEY_TABLE,
			Key: { id },
			UpdateExpression: "set #status = :chatStatus",
			ExpressionAttributeValues: {
				":chatStatus": status,
			},
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ReturnValues: "ALL_NEW",
		};
		const response = await dynamoClient.update(params).promise();
		return (response.Attributes || {}) as PrivateChatKey;
	} catch (error) {
		console.error("Error updating item:", error);
		throw Error("Unable to update: updateUser");
	}
};

/**
 * Send a new message in conversation
 * @date 3/22/2024 - 2:02:59 PM
 *
 * @async
 * @param {{
 * 	id: string;
 * 	sentBy: string;
 * 	type: string;
 * 	message: string;
 * 	ts: number;
 * }} data
 * @returns {Promise<PrivateChat>}
 */
const sendMessage = async (data: {
	id: string;
	userTs: string;
	sentTs: number;
	tags?: string;
	type: string;
	message: string;
}): Promise<PrivateChat> => {
	console.log("data:   " + JSON.stringify(data));
	{
		const item: PrivateChat = data;
		const params = {
			TableName: CHAT_TABLE,
			Item: item,
			ReturnValues: "ALL_OLD",
			ConditionExpression: "attribute_not_exists(userTs)",
		};

		const keyData: DynOutWithError<DocumentClient.PutItemOutput> = await dynamoClient.put(params).promise();
		return item as PrivateChat;
	}
};


const editMessage = async ({ id, userId, oldTs, value }: { id: string; userId: string; oldTs: number; value: string }) => {
	const userTs = oldTs.toString() + "#" + userId;

	const params: DocumentClient.UpdateItemInput = {
		TableName: CHAT_TABLE,
		// FilterExpression: "createTs > :createTs",
		Key: {
			id: id,
			userTs: userTs,
		},
		UpdateExpression: "set message = :message",
		ExpressionAttributeValues: {
			":message": value,
		},
		ReturnValues: "ALL_NEW",
	};
	const chat: DynOutWithError<DocumentClient.UpdateItemOutput> = await dynamoClient.update(params).promise();
	console.log(chat);
	return chat.Attributes as PrivateChat;
};

const hideMessage = async ({ id, userId, oldTs, value }: { id: string; userId: string; oldTs: number; value: boolean }) => {
	const userTs = oldTs.toString() + "#" + userId;

	const params: DocumentClient.UpdateItemInput = {
		TableName: CHAT_TABLE,
		// FilterExpression: "createTs > :createTs",
		Key: {
			id: id,
			userTs: userTs,
		},
		UpdateExpression: "set #hidden = :hiddenValue",
		ExpressionAttributeNames: { "#hidden": "hidden" },
		ExpressionAttributeValues: {
			":hiddenValue": value,
		},
		ReturnValues: "ALL_NEW",
	};
	const chat: DynOutWithError<DocumentClient.UpdateItemOutput> = await dynamoClient.update(params).promise();
	console.log(chat);
	return chat.Attributes as PrivateChat;
};

export {
	initializeChat,
	sendMessage,
	getKeyDataById,
	getChatKeyByUserIds,
	getChatById,
	updateChatSessionStatus,
	getChatDataListByIdTs,
	getChatDataListById,
	updateChatKeyUsersList,
	editMessage,
	hideMessage,
};
