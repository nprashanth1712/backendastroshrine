import ULID from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();
import { Review } from "../types/reviews/Reviews";
import { DynOutWithError } from "../types/Common";
import { dynamoClient, REVIEWS_TABLE} from "../constants/Config";


export const getAllHostReviews = async (
    {
        hostId, startTs, endTs, exclusiveStartKey
    }: {
        hostId: string,
        startTs: string, 
        endTs: string,
        exclusiveStartKey: {hostId: string, tsUserId: string}
    }) => {
    
    const params: DocumentClient.QueryInput = {
        TableName: REVIEWS_TABLE,
        KeyConditionExpression: "#hostId = :hostId and tsUserId between :startTs and :endTs",
        ExpressionAttributeNames: {"#hostId": "hostId"},
        ExpressionAttributeValues: {":hostId": hostId, ":startTs" : startTs, ":endTs": endTs},
        ScanIndexForward: false,
        Limit: 10,
    };
    if (exclusiveStartKey.hostId && exclusiveStartKey.tsUserId) {
        params.ExclusiveStartKey = exclusiveStartKey;
    }
    const resp: DynOutWithError<DocumentClient.QueryOutput> =
        await dynamoClient.query(params).promise();
    console.log("last evaluated key : ", JSON.stringify(resp.LastEvaluatedKey))
    return resp.Items as Array<Review>;
}

export const addNewReview = async (
    {hostId, userId, userName , rating, message} : 
    {userId: string, userName: string, hostId: string, rating: number, message: string}
) => {
    const reviewData: Review = {
        hostId,
        tsUserId: Date.now() + "#" + userId,
        rating,
        comment: message,
        userName,
        reply: "",
    }
    const params: DocumentClient.PutItemInput = {
        TableName: REVIEWS_TABLE,
        Item: reviewData,
    };

    await dynamoClient.put(params).promise();
    return reviewData;
};

export const getReview = async({hostId, tsUserId} : {hostId: string, tsUserId: string}) => {
    const params = {
        TableName: REVIEWS_TABLE,
        Key: {
            hostId,
            tsUserId
        },
    };
    const response = await dynamoClient.get(params).promise();
    return response.Item as Review; 
}
export const replyReview = async({hostId, tsUserId, reply}: {hostId: string, tsUserId: string, reply: string}) => {
    const params = {
        TableName: REVIEWS_TABLE,
        Key: {
            hostId, tsUserId
        },
        UpdateExpression: "set #reply = :reply",
        ExpressionAttributeValues: {":reply": reply},
        ExpressionAttributeNames: {"#reply" : "reply"},
        ReturnValues: "ALL_NEW",
    }
    const resp = await dynamoClient.update(params).promise();
    return resp.Attributes;
}


