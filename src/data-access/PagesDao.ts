import ULID from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, PAGES_TABLE } from "../constants/Config";
import { Order, PaymentDetails } from "../types/order/Orders";
import { Settings, SettingsChannel } from "../types/pages/Settings";



export const getUserSettingsDataByUserId = async ({id} : {id: string}) => {
    const params = {
        TableName: "Settings",
        Key: {
            userId: id,
        }
    };
    const resp: DynOutWithError<DocumentClient.GetItemOutput> =
        await dynamoClient.get(params).promise();
    return resp.Item;
}



export const initializeSettingsPage = async ({userId, channel, appLanguage}: {userId: string, channel: any, appLanguage: string}) => {
    const params : DocumentClient.PutItemInput = {
        TableName: "Settings",
        Item: {
            userId,
            channel,
            appLanguage
        }
    };
    await dynamoClient.put(params).promise();
    return {userId, channel, appLanguage};
}



export const updateSettingsChannelById = async ({userId, channel} : {userId: string, channel: SettingsChannel}) => {
    const params: DocumentClient.UpdateItemInput = {
        TableName: "Settings",
        Key: {
            userId
        },
        UpdateExpression: "set #channel = :channel, lastUpdated = :newTime",
        ExpressionAttributeValues: {":channel": channel, ":newTime": Date.now()},
        ExpressionAttributeNames: {"#channel" : "channel"},
        ReturnValues: "ALL_NEW", 
    }
    
    const response = await dynamoClient.update(params).promise();
    return response.Attributes;
}

export const updateSettingsLanguageById = async ({userId, language} : {userId: string, language: string}) => {
    const params: DocumentClient.UpdateItemInput = {
        TableName: "Settings",
        Key: {
            userId
        },
        UpdateExpression: "set #appLanguage = :language, lastUpdated = :newTime",
        ExpressionAttributeValues: {":language": language, ":newTime": Date.now()},
        ExpressionAttributeNames: {"#appLanguage" : "language"},
        ReturnValues: "ALL_NEW", 
    }
    
    const response = await dynamoClient.update(params).promise();
    return response.Attributes;
}
