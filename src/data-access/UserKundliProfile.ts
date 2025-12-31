import ULID from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, KUNDLI_TABLE, PAGES_TABLE } from "../constants/Config";

import {
	KundliProfile,
	PlaceOfBirth,
	UpdateKundliDataPayloadType,
	UpdateKundliDataType,
} from "../types/user/models/KundliProfile";

export const getUserKundliProfileListByUserId = async ({
	userId,
}: {
	userId: string;
}) => {
	console.log(userId)
	const params: DocumentClient.QueryInput = {
		TableName: KUNDLI_TABLE,
		IndexName: 'userId-index',
		KeyConditionExpression: 'userId = :userId',
		ExpressionAttributeValues: {':userId': userId} 
	};
	const resp: DynOutWithError<DocumentClient.QueryOutput> =
		await dynamoClient.query(params).promise();
	return resp.Items;
};

export const getUserKundliProfileByUserIdTs = async ({
	userId,
	createTs
}: {
	userId: string;
	createTs: number,
}) => {
	const params = {
		TableName: KUNDLI_TABLE,
		Key: {
			userId: userId, createTs
		},
	};
	const resp: DynOutWithError<DocumentClient.GetItemOutput> =
		await dynamoClient.get(params).promise();
	return resp.Item;
};


export const addUserKundliProfileById = async ({
	userId,
	dateTimeOfBirth,
	gender,
	placeOfBirth,
}: {
	userId: string;
	dateTimeOfBirth: number;
	gender: string;
	placeOfBirth: PlaceOfBirth;
}) => {
	const currentTime = Date.now();
	const params: DocumentClient.PutItemInput = {
		TableName: KUNDLI_TABLE,
		Item: {
			userId,
			createTs: currentTime,
			dateTimeOfBirth: dateTimeOfBirth,
			geder: gender,
			placeOfBirth: placeOfBirth,
		},
	};

	const respone = await dynamoClient.put(params).promise();
	return params.Item as KundliProfile;
};

export const deleteUserKundliProfileByUserIdTs = async ({
	userId,
	createTs,
}: {
	userId: string;
	createTs: number;
}) => {
	const params: DocumentClient.DeleteItemInput = {
		TableName: KUNDLI_TABLE,
		Key: {
			userId,
			createTs,
		},
		ReturnValues: "ALL_NEW",
	};

	const response = await dynamoClient.delete(params).promise();
	return response.Attributes;
};

export const updateUserKundliProfileDataByUserIdTs = async ({
	userId,
	createTs,
	dataToUpdate,
	dataPayload,
}: {
	userId: string;
	createTs: number;
	dataToUpdate: UpdateKundliDataType;
	dataPayload: UpdateKundliDataPayloadType;
}) => {

    const updateExpression = `set ${dataToUpdate} = :dataPayload`;
	const params: DocumentClient.UpdateItemInput = {
		TableName: KUNDLI_TABLE,
		Key: {
			userId,
			createTs,
		},
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: {':dataPayload': dataPayload},
		ReturnValues: "ALL_NEW",
	};

	const response = await dynamoClient.update(params).promise();
	return response.Attributes;
};
