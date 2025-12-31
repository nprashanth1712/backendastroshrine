import ULID from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { dynamoClient, NOTIFICATONS_TABLE, PAGES_TABLE } from "../constants/Config";
import { NotificationTable, NotificationTableArrayType } from "../types/notifications/NotificationTable";



export const getUserNotificationsByUserId = async ({id} : {id: string}) => {
    const params = {
        TableName: NOTIFICATONS_TABLE,
        Key: {
            id,
        }
    };
    const resp: DynOutWithError<DocumentClient.GetItemOutput> =
        await dynamoClient.get(params).promise();
    return resp.Item as NotificationTable;
}



export const initializeUserNotifications = async ({userId}: {userId: string}) => {
    const params : DocumentClient.PutItemInput = {
        TableName: NOTIFICATONS_TABLE,
        Item: {
            id: userId,
            inAppNotifications: [],
            pushNotifications: [],
        }
    };
    
    await dynamoClient.put(params).promise();
    return {userId, initializeUserNotifications: [], pushNotifications: []};
}



export const updateUserNotificationsById = async ({id, inAppNotifications, pushNotifications} : NotificationTable) => {
    const currentTime = Date.now();
    const params: DocumentClient.UpdateItemInput = {
        TableName: NOTIFICATONS_TABLE,
        Key: {
            id
        },
        UpdateExpression: "set inAppNotifications = :inAppNotifications, pushNotifications = :pushNotifications, lastUpdated = :lastUpdated",
        ExpressionAttributeValues: {":inAppNotifications": inAppNotifications, ":pushNotifications": pushNotifications, ":lastUpdated": currentTime},
        ReturnValues: "ALL_NEW", 
    }
    
    const response = await dynamoClient.update(params).promise();
    return response.Attributes;
}
