import ULID, { ulid } from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, CHAT_KEY_TABLE, CHAT_TABLE, CASES_TABLE, CHAT_USER_TABLE } from "../constants/Config";
import { SupportCase } from "../types/case/Case";
import { PrivateChat, PrivateChatKey } from "../types/chat/Chat";

export const getAllActiveCases = async () => {
	const params: DocumentClient.QueryInput = {
		TableName: CASES_TABLE,
		IndexName: "status-index",
		KeyConditionExpression: "#status = :status",
		ExpressionAttributeNames: { "#status": "status" },
		ExpressionAttributeValues: { ":status": "OPEN" },
	};
	const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return resp.Items;
};

export const getAllActiveSupportUserCases = async ({ supportUserId }: { supportUserId: string }) => {
	const params: DocumentClient.QueryInput = {
		TableName: CASES_TABLE,
		IndexName: "supportUserId-status-index",
		KeyConditionExpression: "#status = :status and #supportUserId = :supportUserId",
		ExpressionAttributeNames: { "#status": "status", "#supportUserId": "supportUserId" },
		ExpressionAttributeValues: { ":status": "OPEN", ":supportUserId": supportUserId },
	};
	const response = await dynamoClient.query(params).promise();
	return response.Items as Array<SupportCase>;
};


export const initializeCase = async ({
	userId,
	supportUserId,
	supportUserName,
	caseType,
	details,
	createTs,
}: {
	userId: string;
	supportUserId: string;
	supportUserName: string,
	caseType: string;
	details: string;
	createTs: number;
}): Promise<SupportCase> => {

	const caseId = ulid();
	const currentTime = Date.now();

	const supportCaseData: SupportCase = {
		id: caseId,
		userId,
		caseType,
		createTs,
		supportUserId,

		status: "OPEN",
		hidden: false,
	};

	if (details) {
		supportCaseData.details = details;
	}

	// CASE PARAMETERS
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: {
					TableName: CASES_TABLE,
					Item: supportCaseData,
				},
			},
		],
	};

	// PRIVATE CHAT KEY PARAMETERS
	const privateChatKey: PrivateChatKey = {
		id: caseId,
		status: "ACTIVE",
		userList: ["case_" + userId, "case_" + supportUserId].sort().join("#"),
		users: [
			{
				id: "case_" + userId,
				lastRead: currentTime,
				lastReceived: currentTime,
				role: "USER",
			},
			{
				id: "case_" + supportUserId,
				lastRead: currentTime,
				lastReceived: currentTime,
				role: "USER",
			},
		],
	};
	transactParam.TransactItems.push({
		Put: {
			TableName: CHAT_KEY_TABLE,
			Item: privateChatKey,
		},
	});

	// CHATUSER KEY TABLE
	for (const user of privateChatKey.users) {
		const transactDataOfUser = {
			Put: {
				TableName: CHAT_USER_TABLE,
				Item: {
					userId: user?.id,
					tsChatId: currentTime + "#" + caseId,
				},
			},
		};

		transactParam.TransactItems.push(transactDataOfUser);
	}

	// FIRST 2 CHATS
	const firstChat: PrivateChat = {
		id: caseId,
		message: `Thank you for reaching out!\n${supportUserName} will now assist you with your case.\
				 \nCase: ${caseType}\nDetails: ${details ?? ""}`,
		sentTs: currentTime,
		type: "text",
		userTs: currentTime + "#" + userId,
		hidden: false,
	};

	transactParam.TransactItems.push(
		{
			Put: {
				TableName: CHAT_TABLE,
				Item: firstChat,
			},
		}
	);


	console.log("The case trnsact params are ", JSON.stringify(transactParam, null, 2));
	await dynamoClient.transactWrite(transactParam).promise();
	return supportCaseData;
};

export const getCaseById = async ({ id }: { id: string }) => {
	const params: DocumentClient.GetItemInput = {
		TableName: CASES_TABLE,
		Key: {
			id,
		},
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	return resp.Item as SupportCase;
};



// export const updateCaseVariablesById = async ({id, values}: {id: string, values: Record<string, any>}) => {
	
	
// 	const transactParam: DocumentClient.TransactWriteItemsInput = {
// 		TransactItems: [
// 			{
// 				Update: {
// 					TableName: CASES_TABLE,
// 					Key: {
// 						id,
// 					},
// 					UpdateExpression: "set #status = :status",
// 					ExpressionAttributeNames: { "#status": "status" },
// 					ExpressionAttributeValues: { ":status": value.toUpperCase() },
// 				}
// 			}, 
// 			{
// 				Update: {
// 					TableName: CHAT_KEY_TABLE,
// 					Key: {
// 						id
// 					},
// 					UpdateExpression: "set #status = :status",
// 					ExpressionAttributeNames: { "#status": "status" },
// 					ExpressionAttributeValues: { ":status": value.toUpperCase() == "CLOSED" ? "CLOSED" : "ACTIVE"},
// 				}
// 			}
// 		]
// 	}

// 	for (const key in values) {
// 		if (values.hasOwnProperty(key)) {
// 			const keyValue = values[key];


// 		}
// 	}
// }
export const updateCaseStatusById = async ({ id, value, resolution}: { id: string; value: string, resolution: string,}) => {
	if (!value) {
		throw {
			statusCode: 400,
			code: "InvalidParameter",
			message: "Invalid parameter value",
		};
	}
	const transactParam: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: CASES_TABLE,
					Key: {
						id,
					},
					UpdateExpression: "set #status = :status, commentResolution = :commentResolution",
					ExpressionAttributeNames: { "#status": "status" ,},
					ExpressionAttributeValues: { ":status": value.toUpperCase(), ":commentResolution": resolution},
				}
			}, 
			{
				Update: {
					TableName: CHAT_KEY_TABLE,
					Key: {
						id
					},
					UpdateExpression: "set #status = :status",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: { ":status": value.toUpperCase() == "CLOSED" ? "INACTIVE" : "ACTIVE"},
				}
			}
		]
	}

	await dynamoClient.transactWrite(transactParam).promise();
	const response = await getCaseById({id})
	return response;
};

export const updateCaseHiddenById = async ({ id, value }: { id: string; value: boolean }) => {
	if (typeof value != "boolean") {
		throw {
			statusCode: 400,
			code: "InvalidParameter",
			message: "Invalid parameter value",
		};
	}

	const params: DocumentClient.UpdateItemInput = {
		TableName: CASES_TABLE,
		Key: {
			id,
		},
		UpdateExpression: "set #hidden = :hidden",
		ExpressionAttributeNames: { "#hidden": "hidden" },
		ExpressionAttributeValues: { ":hidden": value },
		ReturnValues: "ALL_NEW",
	};
	const resp: DynOutWithError<DocumentClient.UpdateItemOutput> = await dynamoClient.update(params).promise();
	return resp.Attributes as SupportCase;
};

export const getAllCasesByUserId = async ({ userId, status = "OPEN"}: { userId: string, status : string }) => {
	const params = {
		TableName: CASES_TABLE,
		IndexName: "userId-status-index",
		KeyConditionExpression: "#userId = :userId and #status=:status",
		ExpressionAttributeNames: { "#userId" : "userId", "#status" : "status"},
		ExpressionAttributeValues: { ":userId": userId, ":status" : status.toUpperCase() },
	};
	const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return resp.Items as Array<SupportCase>;
};
