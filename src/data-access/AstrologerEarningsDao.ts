import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, EARNINGS_TABLE, GIFTS_TABLE } from "../constants/Config";
import { AstrologerOrder } from "../types/order/AstrologerOrder";
import { AstrologerEarningListData, AstrologerEarnings, IntervalType } from "../types/astrologer/earnings/Earnings";


export const getAstrologerEarningsById = async ({astrologerId}: {astrologerId: string}): Promise<AstrologerEarnings> => {
    const params: DocumentClient.GetItemInput = {
        TableName: EARNINGS_TABLE,
        Key: {
            astrologerId
        }
    }
    const resp: DynOutWithError<DocumentClient.GetItemOutput> =
        await dynamoClient.get(params).promise();
    return resp.Item as AstrologerEarnings
}


export const initializeAstrologerEarningsData = async ({astrologerId}: {astrologerId: string}): Promise<AstrologerEarnings>=> {
    const astrologerEarnings: AstrologerEarnings = {
        astrologerId,
        daily: [], 
        weekly: [],
        monthly: [],
        lastUpdated: Date.now()
    }
    
    const params : DocumentClient.PutItemInput = {
        TableName: EARNINGS_TABLE,
        Item: astrologerEarnings
    };
    
    await dynamoClient.put(params).promise();
    return astrologerEarnings;
}

export const updateAstrologerEarningsData = async ({astrologerId, intervalType, intervalData}: {astrologerId: string, intervalType: IntervalType, intervalData: Array<AstrologerEarningListData>}) => {
    
    const updateExpression = `set ${intervalType.toLowerCase()} = :intervalData`;
    const expressionAttributeValues = {':intervalData': intervalData}
    const params: DocumentClient.UpdateItemInput = {
        TableName: EARNINGS_TABLE,
        Key: {
            astrologerId
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW"
    }
    const resp = await dynamoClient.update(params).promise();
    return resp.Attributes;
}
