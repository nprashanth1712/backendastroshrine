import ULID, { ulid } from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, CHAT_KEY_TABLE, CHAT_TABLE, CASES_TABLE, CHAT_USER_TABLE, AGENT_CHAT_TABLE } from "../constants/Config";
import { SupportCase } from "../types/case/Case";
import { PrivateChat, PrivateChatKey } from "../types/chat/Chat";

namespace AgentChatDao {
	export const getAgentUserChatListByUserId = async ({ userId }: { userId: string }) => {
		const params: DocumentClient.GetItemInput = {
			TableName: AGENT_CHAT_TABLE,
			Key: {
				SessionId: userId,
			},
		};

		const response = await dynamoClient.get(params).promise();
		return response['Item'];
	};
}

export {
    AgentChatDao
}
