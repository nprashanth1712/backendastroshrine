import ULID, { ulid } from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { ASTROLOGER_ORDER_TABLE, dynamoClient, GIFTS_TABLE, USERORDER_TABLE } from "../constants/Config";
import { Gift } from "../types/gifts/Gifts";
import { AstrologerOrder } from "../types/order/AstrologerOrder";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { UserOrder } from "../types/order/UserOrder";


export const getAstroOrderListByIdTs = async ({astrologerId, startTs, endTs}: {astrologerId: string, startTs: number, endTs: number}) => {
    console.log("THE ASTROLOGER ID IS ", astrologerId)
    const params: DocumentClient.QueryInput = {
        TableName: ASTROLOGER_ORDER_TABLE,
        KeyConditionExpression: 'astrologerId = :astrologerId AND orderTs BETWEEN :startTs AND :endTs',
        ExpressionAttributeValues: {
            ':startTs': startTs, 
            ':endTs': endTs, 
            ':astrologerId': astrologerId,
        }
    };
    const resp: DynOutWithError<DocumentClient.QueryOutput> =
        await dynamoClient.query(params).promise();
    return resp.Items as Array<AstrologerOrder>;
}


export const initializeAstroOrder = async ({astrologerId, timeSpent, amount, customerId, orderTs, orderType, subOrderType}: AstrologerOrder) => {
    const astrologerOrder: AstrologerOrder = {
        astrologerId,
        orderTs,
        timeSpent,
        orderType, 
        subOrderType, 
        customerId, 
        amount
    }
    
    const params : DocumentClient.PutItemInput = {
        TableName: ASTROLOGER_ORDER_TABLE,
        Item: astrologerOrder
    };
    
    await dynamoClient.put(params).promise();
    return astrologerOrder;
}

export const getAstroOrderByIdTs = async ({astrologerId, orderTs}: {astrologerId: string, orderTs: number}) => {
    const params: DocumentClient.GetItemInput = {
        TableName: ASTROLOGER_ORDER_TABLE,
        Key: {
            astrologerId, orderTs
        }
    }
    const resp = await dynamoClient.get(params).promise();
    return resp.Item as AstrologerOrder;
}

