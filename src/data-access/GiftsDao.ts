import ULID, { ulid } from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, GIFTS_TABLE, METADATA_TABLE } from "../constants/Config";
import { Gift } from "../types/gifts/Gifts";
import { MetaData } from "../types/metadata/Metadata";

export const getAllActiveGifts = async () => {
    const params: DocumentClient.QueryInput = {
        TableName: GIFTS_TABLE,
        IndexName: "giftStatus-index",
        KeyConditionExpression: "giftStatus = :status",
        ExpressionAttributeValues: { ":status": "ACTIVE" },
    };
    const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient
        .query(params)
        .promise();
    return resp.Items as Array<Gift>;
};

export const initializeGift = async ({
    id,
    name,
    amount,
    imageUrl,
}: {
    id: string;
    name: string;
    amount: number;
    imageUrl: string;
}) => {
    const data: Gift = {
        giftId: id,
        createTs: Date.now(),
        name,
        amount,
        imageUrl,
        giftStatus: "ACTIVE",
    };

    const params: DocumentClient.PutItemInput = {
        TableName: GIFTS_TABLE,
        Item: data,
    };

    await dynamoClient.put(params).promise();
    return data;
};

export const getGiftById = async ({ giftId }: { giftId: string }) => {
    const params: DocumentClient.GetItemInput = {
        TableName: METADATA_TABLE,
        Key: {
            id: giftId,
            metadataType: "gift",
        },
    };
    const resp = await dynamoClient.get(params).promise();
    return resp.Item as MetaData;
};

export const updateGiftStatusById = async ({
    giftId,
    status,
}: {
    giftId: string;
    status: string;
}) => {
    const currentTs = Date.now();
    const params: DocumentClient.UpdateItemInput = {
        TableName: GIFTS_TABLE,
        Key: {
            giftId,
        },
        UpdateExpression: "set :giftStatus = :status",
        ExpressionAttributeValues: { ":status": status },
        ReturnValues: "ALL_NEW",
    };

    const response = await dynamoClient.update(params).promise();
    return response.Attributes;
};
