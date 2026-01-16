import ULID from "ulid";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

import dotenv from "dotenv";
dotenv.config();

import { DynOutWithError } from "../types/Common";
import { ASTROLOGER_TABLE, dynamoClient, FOLLOWERS_TABLE } from "../constants/Config";
import { Followers } from "../types/followers/Followers";
import { DocumentLabel } from "aws-sdk/clients/comprehend";
import { HostProfile } from "../types/astrologer/Astrologer";


const addHostFollower = async ({hostId, userId} : {hostId: string, userId: string}) => {
    
    const data: Followers = {
        hostId,
        userId,
        createTs: Date.now(),
        status: "ACTIVE"
    }
    const params: DocumentClient.PutItemInput = {
        TableName: FOLLOWERS_TABLE,
        Item: data
    }
    const response = await dynamoClient.put(params).promise();
    return data;
}

const removeHostFollower = async ({hostId, userId, hostProfile}: {hostId: string, userId: string, hostProfile: HostProfile}) => {

    const transactParams: DocumentClient.TransactWriteItemsInput = {
     
            TransactItems: [
                {
                    Update: {
                        TableName: ASTROLOGER_TABLE,
                                Key: {
                                    id: hostId,
                                },
                                UpdateExpression: "set hostProfile = :hostProfile",
                                ExpressionAttributeValues: { ":hostProfile": hostProfile },
                    },
                }
            ]
        
    }

    const deleteRequest: DocumentClient.DeleteItemInput = {
        TableName: FOLLOWERS_TABLE,
        Key: {
            hostId, userId
        }
    }
    try {
        await dynamoClient.delete(deleteRequest).promise();

    } catch(error) {
        console.log("f");
    }
    const response = await dynamoClient.transactWrite(transactParams).promise();
    return response;
}



const getHostAndUserFollowData = async ({hostId, userId} : {hostId: string, userId: string}) => {
    const params : DocumentClient.GetItemInput = {
        TableName: FOLLOWERS_TABLE,
        Key: {
            hostId, 
            userId
        }
    };
    const response = await dynamoClient.get(params).promise();
    return response.Item as Followers; 
};

const getHostFollowerList = async ({hostId}: {hostId: string}) => {
    console.log("Hello")
    const params: DocumentClient.QueryInput = {
        TableName: FOLLOWERS_TABLE,
        IndexName: "hostId-status-index",
        KeyConditionExpression: 'hostId = :hostId and #status = :activeStatus',
        ExpressionAttributeNames: {"#status": "status"},
        ExpressionAttributeValues: {":hostId" : hostId, ':activeStatus': "ACTIVE"}
    }
    const response = await dynamoClient.query(params).promise();
    return response.Items as Array<Followers>;
}

const getUserFollowingList = async ({userId} : {userId: string}) => {
    const params: DocumentClient.QueryInput = {
        TableName: FOLLOWERS_TABLE,
        IndexName: "userId-status-index",
        KeyConditionExpression: 'userId = :userId AND #status = :activeStatus',
        ExpressionAttributeNames: {"#status": "status"},
        ExpressionAttributeValues: {":userId" : userId, ':activeStatus' : "ACTIVE"}
    }
    const response = await dynamoClient.query(params).promise();
    return response.Items as Array<Followers>;
}

export {
    addHostFollower, 
    getHostFollowerList, 
    getUserFollowingList,
    removeHostFollower,
    getHostAndUserFollowData
};