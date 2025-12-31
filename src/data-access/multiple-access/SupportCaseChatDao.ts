import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { CASES_TABLE, CHAT_TABLE, dynamoClient } from "../../constants/Config";
import { PrivateChat } from "../../types/chat/Chat";

export namespace CaseChatDao {
	export const sendMultipleMessageForAttachments = async ({ chatList }: { chatList: Array<PrivateChat> }) => {
        if (chatList.length == 0) return 0;
		const transactParams: DocumentClient.TransactWriteItemsInput = {
			TransactItems: [],
		};

		let fileKeys = [];
		for (const chatData of chatList) {
			fileKeys.push(chatData.message);
			transactParams.TransactItems.push({
				Put: {
					TableName: CHAT_TABLE,
					Item: chatData,
				},
			});
		}
		transactParams.TransactItems.push({
			Update: {
				TableName: CASES_TABLE,
				Key: {
					id: chatList[0]?.id,
				},
				UpdateExpression: "set attachments = :attachments",
				ExpressionAttributeValues: { ":attachments": fileKeys },
			},
		});
		await dynamoClient.transactWrite(transactParams).promise();
		return;
	};
}
