import ULID from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, CHAT_KEY_TABLE, CHAT_TABLE, CASES_TABLE, ORDER_TABLE, USER_TABLE } from "../constants/Config";
import { Order, PaymentDetails } from "../types/order/Orders";

export const getAllOrders = async () => {
	const params = {
		TableName: ORDER_TABLE,
	};
	const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return resp.Items;
};

export const getOrderByUserIdCreateTs = async ({userId, createTs}: {userId: string, createTs: number}): Promise<Order> => {
	const params = {
		TableName: ORDER_TABLE,
		Key: {
			userId,
			createTs
		}
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> = await dynamoClient.get(params).promise();
	return resp.Item as Order;
};

export const getOrderByRazorPayId = async ({ razorPayOrderId }: { razorPayOrderId: string }) => {
	const params: DocumentClient.QueryInput = {
		TableName: ORDER_TABLE,
		IndexName: "razorPayOrderId-index",
		KeyConditionExpression: "razorPayOrderId = :rpOrderId",
		ExpressionAttributeValues: { ":rpOrderId": razorPayOrderId },
	};
	const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	return resp?.Items ? (resp.Items[0] as Order) : ({} as Order);
};

export const initializePaymentOrder = async ({
	id,
	userId,
	status,
	amount,
	createTs,
	paymentDetails,
	isDummy,
}: {
	id: string;
	userId: string;
	status: string;
	amount: number;
	createTs: number;
	paymentDetails: PaymentDetails;
	isDummy?: boolean
}) => {
	const data: Order = {
		userId,
		createTs,
		razorPayOrderId: id,
		paymentDetails: [paymentDetails],
		status: status.toUpperCase(),
		amount: amount / 100,
	};

	const params = {
		TableName: ORDER_TABLE,
		Item: data,
		ConditionExpression: "attribute_not_exists(id)",
	};

	const transactParams: DocumentClient.TransactWriteItemsInput = {
		TransactItems: [
			{
				Put: params
			},
		]
	}

	if (isDummy) {
		transactParams.TransactItems.push(
			{
				Update: {
					TableName: USER_TABLE,
					Key: {
						id: userId
					},
					UpdateExpression: "set balance = balance + :amountReq",
					ExpressionAttributeValues: {":amountReq": amount}
				}
			}
		)
	}
	await dynamoClient.transactWrite(transactParams).promise();
	return data;
};

export const editUserPaymentDetails = async ({
	userId,
	createTs,
	paymentDetails,
}: {
	userId: string;
	createTs: number;
	paymentDetails: Array<PaymentDetails>;
}) => {
	console.log("updated payment details");
	console.log(paymentDetails);
	const params = {
		TableName: ORDER_TABLE,
		Key: {
			userId,
			createTs,
		},
		UpdateExpression: "set paymentDetails = :paymentDetails",
		ExpressionAttributeValues: { ":paymentDetails": paymentDetails },
		ReturnValues: "ALL_NEW",
	};
	const resp: DynOutWithError<DocumentClient.UpdateItemOutput> = await dynamoClient.update(params).promise();
	return resp.Attributes;
};


export const editOrderStatus = async ({ userId, createTs, status }: { userId: string; createTs: number; status: string }) => {
	const params = {
		TableName: ORDER_TABLE,
		Key: {
			userId,
			createTs,
		},
		UpdateExpression: "set #status = :status",
		ExpressionAttributeNames: { "#status": "status" },
		ExpressionAttributeValues: { ":status": status.toUpperCase() },
		ReturnValues: "ALL_NEW",
	};
	const resp: DynOutWithError<DocumentClient.UpdateItemOutput> = await dynamoClient.update(params).promise();
	return resp.Attributes as Order;
};


export const getInitialOrderList = async ({ userId }: { userId: string }) => {
	const params: DocumentClient.QueryInput = {
		TableName: ORDER_TABLE,
		KeyConditionExpression: ":userId = userId",
		ExpressionAttributeValues: { ":userId": userId },
	};
	const response = await dynamoClient.query(params).promise();
	return response.Items;
};


export const getOrderListByUserId = async ({
	userId,
	startTs,
	endTs,
	exclusiveStartKey,
}: {
	userId: string;
	startTs: number;
	endTs: number;
	exclusiveStartKey: { userId: string; ts: number };
}) => {
	const params: DocumentClient.QueryInput = {
		TableName: ORDER_TABLE,
		KeyConditionExpression: "userId = :userId and createTs between :startTs and :endTs",
		ExpressionAttributeValues: {
			":userId": userId,
			":startTs": startTs,
			":endTs": endTs,
		},
		ScanIndexForward: false,
		Limit: 10,
	};
	if (exclusiveStartKey.userId && exclusiveStartKey.ts.toString().length == 13) {
		params.ExclusiveStartKey = exclusiveStartKey;
	}
	const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient.query(params).promise();
	console.log("last evaluated key : ", JSON.stringify(resp.LastEvaluatedKey));
	return resp.Items;
};

const getRazorpayOrderByUserIdTs = async ({
	userId,
	ts
}: {userId: string, ts: number}) => {

}