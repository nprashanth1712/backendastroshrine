import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { DynOutWithError } from "../types/Common";
import { UserSession } from "../types/session/session";
import { nextUID } from "./UserDao";
import { dynamoClient, USER_SESSION_TABLE } from "../constants/Config";
import { RtcRole, RtcTokenBuilder } from "agora-token";

const APP_ID: string | undefined = process.env.AGORA_APP_ID;
const APP_CERTIFICATE: string | undefined = process.env.AGORA_APP_CERT;

export const getSessionByUid = async ({
    uid,
}: {
    uid: number;
}): Promise<UserSession> => {
    try {
        const params: DocumentClient.QueryInput = {
            TableName: USER_SESSION_TABLE,
            IndexName: "uid-index",
            KeyConditionExpression: "#uid = :uid",
            ExpressionAttributeNames: { "#uid": "uid" },
            ExpressionAttributeValues: { ":uid": uid },
            Limit: 1,
        };

        const response: DynOutWithError<DocumentClient.QueryOutput> =
            await dynamoClient.query(params).promise();

        console.log("RESPONSE: ", JSON.stringify(response, null, 2));

        return response.Items?.[0] as UserSession;
    } catch (err) {
        throw err;
    }
};


export const getSessionByUserIdDeviceId = async ({
    userId,
    deviceId
}: {
    userId: string,
    deviceId: string
}): Promise<UserSession> => {
    try {
        const params: DocumentClient.GetItemInput = {
            TableName: USER_SESSION_TABLE,
            Key: {
                userId,
                deviceId
            }
        };

        const response: DynOutWithError<DocumentClient.GetItemOutput> =
            await dynamoClient.get(params).promise();

        console.log("RESPONSE: ", JSON.stringify(response, null, 2));

        return response.Item as UserSession;
    } catch (err) {
        throw err;
    }
};

export const generateRTCToken = async ({
    channelName,
    role,
    uid,
    expiry,
    tokentype,
}: {
    channelName: string;
    role: string | number;
    uid: string | number;
    expiry?: string | number;
    tokentype: string;
}) => {
    if (role === "publisher") {
        role = RtcRole.PUBLISHER;
    } else if (role === "audience") {
        role = RtcRole.SUBSCRIBER;
    } else {
        throw new Error("role is incorrect" + role);
    }

    let expireTime: string | number = expiry as string;
    if (!expireTime || expireTime === "") {
        expireTime = 3600;
    } else {
        expireTime = parseInt(expireTime as string, 10);
    }
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + (expireTime as number);
    let token;

    console.log(
        `APPID: ${APP_ID}, APP_SECRET: ${APP_CERTIFICATE} channelName: ${channelName}, uid: -${uid.toString()}-, role: ${role}`
    );
    if (APP_ID && APP_CERTIFICATE) {
        if (tokentype === "userAccount") {
            token = RtcTokenBuilder.buildTokenWithUserAccount(
                APP_ID,
                APP_CERTIFICATE,
                channelName,
                uid.toString(),
                role,
                privilegeExpireTime,
                privilegeExpireTime
            );
        } else if (tokentype === "uid") {
            token = RtcTokenBuilder.buildTokenWithUid(
                APP_ID,
                APP_CERTIFICATE,
                channelName,
                uid.toString(),
                role,
                privilegeExpireTime,
                privilegeExpireTime
            );
        } else {
            throw new Error("tokentype is incorrect" + tokentype);
        }
    } else {
        throw new Error("APP_ID or APP_CERTIFICATE is not set");
    }

    return { rtcToken: token };
};

export const createUserSession = async ({
    userId,
    deviceId,
    uid
}: {
    userId: string;
    deviceId: string,
    uid: number,
}): Promise<UserSession> => {
   
    const userSessionData: UserSession = {
        userId,
        deviceId,
        uid,
        lastActiveTs: Date.now()
    }
    const params: DocumentClient.PutItemInput = {
        TableName: USER_SESSION_TABLE,
        Item: userSessionData,
    };

    await dynamoClient.put(params).promise();

    return userSessionData;
};



export const createHostRecordingSession = async ({
    channelId,
    deviceId
}: {
    channelId: string;
    deviceId: string,

}): Promise<UserSession> => {

    let data: UserSession = {
        deviceId,
        lastActiveTs: Date.now(),
        userId: "RECORDING_" + channelId,
        uid: Number((await nextUID()).Attributes?.nextUID)
    };

    const params: DocumentClient.PutItemInput = {
        TableName: USER_SESSION_TABLE,
        Item: data,
    };

    await dynamoClient.put(params).promise();

    return data;
};

// export const inactiveAllUserSession = async ({
//     userId,
// }: {
//     userId: string;
// }): Promise<boolean> => {
//     const userSessions = await activeUserSessions({ userId });

//     if (userSessions.length > 0) {
//         while (userSessions.length) {
//             const batch = userSessions.splice(0, 20);

//             const transactParam: DocumentClient.TransactWriteItemsInput = {
//                 TransactItems: batch.map((session) => ({
//                     Update: {
//                         TableName: USER_SESSION_TABLE,
//                         Key: { id: session.id },
//                         UpdateExpression: "set #status = :status",
//                         ExpressionAttributeNames: { "#status": "status" },
//                         ExpressionAttributeValues: {
//                             ":status": SessionStatus.INACTIVE,
//                         },
//                     },
//                 })),
//             };
//             try {
//                 const resp: DynOutWithError<DocumentClient.TransactWriteItemsOutput> =
//                     await dynamoClient.transactWrite(transactParam).promise();
//             } catch (error) {
//                 console.error("Error in batch transaction:", error);
//                 break;
//             }
//         }
//     }

//     return true;
// };

export const getActiveUserSessionList = async ({
    userId,
}: {
    userId: string;
}): Promise<UserSession[]> => {
    const params: DocumentClient.QueryInput = {
        TableName: USER_SESSION_TABLE,
        KeyConditionExpression: "#userId = :userId",
        ExpressionAttributeNames: { "#userId": "userId" },
        ExpressionAttributeValues: { ":userId": userId },
    };

    const response = await dynamoClient.query(params).promise();

    return response.Items as Array<UserSession>;
};

export const getUserSessionByUserIdDeviceId = async({
    userId, deviceId
}: {userId: string, deviceId: string}) => {
    const params: DocumentClient.GetItemInput = {
        TableName: USER_SESSION_TABLE,
        Key: {
            userId, deviceId
        },
    }
    const response = await dynamoClient.get(params).promise();
    return (await response).Item as UserSession;
}