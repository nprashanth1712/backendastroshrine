import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { CHAT_USER_TABLE, dynamoClient } from "../constants/Config";
import { ChatUserImpl } from "../types/chat-user/ChatUser";

namespace ChatUserKey {


	export const initializeChatUserTable = async ({
		userId,
		ts,
		chatId,
	}: {
		userId: string;
		ts: number;
		chatId: string;
	}) => {
		const chatUserData: ChatUserImpl = {
			userId,
			tsChatId: ts + "#" + chatId,
		};
		const params: DocumentClient.PutItemInput = {
			TableName: CHAT_USER_TABLE,
			Item: chatUserData,
		};

		await dynamoClient.put(params).promise();
		return chatUserData as ChatUserImpl;
	};

	export const getChatUserKeyListByUserId = async ({ userId, ts }: { userId: string; ts: number }): Promise<Array<ChatUserImpl>> => {
		
		console.log("the user id is ", userId, ts)
		const params: DocumentClient.QueryInput = {
			TableName: CHAT_USER_TABLE,
			KeyConditionExpression: "userId = :userId", // and tsChatId > :timestampInput",
			ExpressionAttributeValues: { ":userId": userId} //, ":timestampInput": ts},
		};
		const response = await dynamoClient.query(params).promise();
		return response.Items as Array<ChatUserImpl> ?? [] as Array<ChatUserImpl>;
	};
}
export { ChatUserKey };
