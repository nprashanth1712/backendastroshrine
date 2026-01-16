import { ulid } from "ulid";
import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { DocumentClient, TransactWriteItemsInput } from "aws-sdk/clients/dynamodb";
import { dynamoClient, LIVESTREAM_TABLE, USER_TABLE, USERORDER_TABLE } from "../constants/Config";

import { UserOrder } from "../types/order/UserOrder";
import { TempHost } from "../types/livestream/models/Livestream";

// only used for testing purpose
export const initializeUserOrder = async ({
	userId,
	hostId,
	userName,
	hostName,
	orderType,
	subOrderType,
}: {
	userId: string;
	hostId: string;
	userName: string;
	hostName: string;
	orderType: string;
	subOrderType: string;
	timestamp?: number;
}) => {
	const timestamp = Date.now();
	const item: UserOrder = {
		userId,
		hostId,
		hostIdTs: hostId + "#" + timestamp,
		orderType,
		userName,
		hostName,
		subOrderType,
		ts: timestamp,
		amount: 0,
		status: "Initialized",
		orderTentativeEndTs: Date.now(),
		orderEndTs: Date.now(),
	};
	const params = {
		TableName: USERORDER_TABLE,
		Item: item,
		ConditionExpression: "attribute_not_exists(id)",
	};
	const data: DynOutWithError<DocumentClient.PutItemOutput> = await dynamoClient.put(params).promise();
	return item as UserOrder;
};

export const getUserOrderList = async ({ userId }: { userId: string }) => {
	console.log("LMFAOOO");
	const params: DocumentClient.QueryInput = {
		TableName: USERORDER_TABLE,
		KeyConditionExpression: "userId = :userId",
		Limit: 10,
		ScanIndexForward: false,
		ExpressionAttributeValues: {
			":userId": userId,
		},
	};
	const resp = await dynamoClient.query(params).promise();
	return resp.Items as Array<UserOrder>;
};

export const getUserOrderListByTs = async ({
	userId,
	startTs,
	endTs,
	key,
}: {
	userId: string;
	startTs: string;
	endTs: string;
	key?: string;
}) => {
	if (!startTs || !endTs) {
		return await getUserOrderList({ userId });
	}
	console.log("LMFAOOO");
	const params: DocumentClient.QueryInput = {
		TableName: USERORDER_TABLE,
		KeyConditionExpression: "userId = :userId and ts between :startTs and :endTs",
		Limit: 10,
		ScanIndexForward: true,
		ExpressionAttributeValues: {
			":userId": userId,
			":startTs": parseInt(startTs),
			":endTs": parseInt(endTs),
		},
	};

	if (key && key.toString().length == 13) {
		params.ExclusiveStartKey = { userId: userId, ts: parseInt(key) };
	}
	const resp = await dynamoClient.query(params).promise();
	return resp.Items as Array<UserOrder>;
};

export const getLatestUserOrder = async ({ userId }: { userId: string }) => {
	console.log("getLatestUserOrder");
	const params: DocumentClient.QueryInput = {
		TableName: USERORDER_TABLE,
		KeyConditionExpression: "userId= :userId",
		Limit: 1,
		ExpressionAttributeValues: {
			":userId": userId,
		},
	};
	const resp = await dynamoClient.query(params).promise();
	return resp.Items as Array<UserOrder>;
};

export const getHostOrderList = async ({ hostId }: { hostId: string }) => {
	console.log("LOOOL");
	const params: DocumentClient.QueryInput = {
		TableName: USERORDER_TABLE,
		IndexName: "hostId-ts-index",
		KeyConditionExpression: "hostId = :hostId",
		Limit: 10,
		ExpressionAttributeValues: {
			":hostId": hostId,
		},
	};
	const resp = await dynamoClient.query(params).promise();
	return resp.Items as Array<UserOrder>;
};

export const getHostOrderListByTs = async ({
	hostId,
	startTs,
	endTs,
	key,
}: {
	hostId: string;
	startTs: string;
	endTs: string;
	key?: string;
}) => {
	console.log("LOOOL");

	if (!startTs || !endTs) {
		return await getHostOrderList({ hostId });
	}
	const params: DocumentClient.QueryInput = {
		TableName: USERORDER_TABLE,
		IndexName: "hostId-ts-index",
		KeyConditionExpression: "hostId = :hostId AND #ts BETWEEN :startTs AND :endTs",
		Limit: 10,
		ExpressionAttributeValues: {
			":hostId": hostId,
			":startTs": parseInt(startTs),
			":endTs": parseInt(endTs),
		},
		ExpressionAttributeNames: {
			"#ts": "ts",
		},
	};
	if (key && key.length == 13) {
		params.ExclusiveStartKey = { hostId, ts: parseInt(key) };
		console.log(params.ExclusiveStartKey);
	}
	const resp = await dynamoClient.query(params).promise();
	console.log("ex start key : ", resp.LastEvaluatedKey);
	return resp.Items as Array<UserOrder>;
};

// export const getInitialHostAndUserOrderList = async ({
// 	userId,
// 	hostId,
// }: {userId: string, hostId: string }) => {
// 	const params: DocumentClient.QueryInput = {
// 		TableName: USERORDER_TABLE,
// 		IndexName: "hostIdTs-index",
// 		Limit: 10,
// 		KeyConditionExpression:
// 			"userId = :userId AND hostIdTs between :startId and :endId",
// 		ExpressionAttributeValues: {
// 			":userId": userId,
// 		},
// 	};

// 	const response = await dynamoClient.query(params).promise();
// 	return response.Items as Array<UserOrder>;
// }
export const getHostAndUserOrderListByTs = async ({
	userId,
	hostId,
	startTs,
	endTs,
	key,
}: {
	userId: string;
	hostId: string;
	startTs: number;
	endTs: number;
	key: string;
}) => {
	let startId = hostId + "#" + startTs;
	let endId = hostId + "#" + endTs;
	const params: DocumentClient.QueryInput = {
		TableName: USERORDER_TABLE,
		IndexName: "hostIdTs-index",
		Limit: 10,
		KeyConditionExpression: "userId = :userId AND hostIdTs between :startId and :endId",
		ExpressionAttributeValues: {
			":userId": userId,
			":startId": startId,
			":endId": endId,
		},
	};
	if (key && key.split(" ")[1].length == 13) {
		params.ExclusiveStartKey = {
			userId,
			hostIdTs: key.replace(" ", "#"),
		};
	}
	const response = await dynamoClient.query(params).promise();
	return response.Items as Array<UserOrder>;
};

export const getUserOrderByUserIdTs = async ({ userId, ts }: { userId: string; ts: number }) => {
	const params: DocumentClient.GetItemInput = {
		TableName: USERORDER_TABLE,
		Key: {
			userId,
			ts: ts as number,
		},
	};
	const response = await dynamoClient.get(params).promise();
	return response.Item as UserOrder;
};

export const getSpecificUserOrderByUserIdTs = async ({ userId, ts }: { userId: string; ts: number }) => {
	const params: DocumentClient.GetItemInput = {
		TableName: USERORDER_TABLE,
		Key: {
			userId,
			ts,
		},
	};
	const resp = await dynamoClient.get(params).promise();
	return resp.Item as UserOrder;
};

export const updateUserOrderStatus = async ({
	userId,
	ts,
	status,
	amount,
}: {
	userId: string;
	ts: number;
	status: string;
	amount: number;
}) => {
	const params = {
		TableName: USERORDER_TABLE,
		Key: {
			userId,
			ts,
		},
		UpdateExpression: "set #status = :status, #amount = :amountUsed",
		ExpressionAttributeNames: {
			"#status": "status",
			"#amount": "amount",
		},
		ExpressionAttributeValues: {
			":status": status,
			":amountUsed": amount,
		},
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as UserOrder;
};

export const updateUserOrderTentativeTs = async ({
	userId,
	channel: { channelId, createTs, tempHost },
	ts,
}: {
	userId: string;
	channel: { channelId: string; createTs: number; tempHost: TempHost };
	ts: number;
}) => {
	const params: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Update: {
					TableName: USERORDER_TABLE,
					Key: {
						userId,
						ts,
					},
					UpdateExpression: "set orderTentativeEndTs = :newTs",
					ExpressionAttributeValues: {
						":newTs": tempHost.orderTentativeEndTs,
					},
				},
			},
			{
				Update: {
					TableName: LIVESTREAM_TABLE,
					Key: {
						channelId,
						createTs,
					},
					UpdateExpression: "set tempHost = :tempHost",
					ExpressionAttributeValues: { ":tempHost": tempHost },
				},
			},
		],
	};
	const resp = await dynamoClient.transactWrite(params).promise();
	return { userId: userId, ts: ts, orderTentativeEndTs: tempHost.orderTentativeEndTs } as UserOrder;
};

export const updateUserOrderEndTs = async ({ userId, ts, value }: { userId: string; ts: number; value: number }) => {
	const params = {
		TableName: USERORDER_TABLE,
		Key: {
			userId,
			ts,
		},
		UpdateExpression: "set :orderEndTs = :newTs, #status = :status",
		ExpressionAttributeNames: { "#status": "status" },
		ExpressionAttributeValues: { ":newTs": value, ":status": "SUCCESS" },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as UserOrder;
};

export const updateUserOrderRecordingAvailable = async ({
	userId,
	ts,
	recordingAvailable,
}: {
	userId: string;
	ts: number;
	recordingAvailable: boolean;
}) => {
	const params = {
		TableName: USERORDER_TABLE,
		Key: {
			userId,
			ts,
		},
		UpdateExpression: "set recordingAvailable = :recordingAvailable",
		ExpressionAttributeValues: { ":recordingAvailable": recordingAvailable },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as UserOrder;
};

export const updateUserOrderRecordingResource = async ({
	userId,
	currentTime,
	resourceId,
	recordingId,
}: {
	userId: string;
	currentTime: number;
	resourceId: string;
	recordingId: string;
}) => {
	const params = {
		TableName: USERORDER_TABLE,
		Key: {
			userId,
			ts: currentTime,
		},
		UpdateExpression: "set resourceId = :resourceId, recordingId = :recordingId",
		ExpressionAttributeValues: { ":resourceId": resourceId, ":recordingId": recordingId },
		ReturnValues: "ALL_NEW",
	};
	const resp = await dynamoClient.update(params).promise();
	return resp.Attributes as UserOrder;
};
