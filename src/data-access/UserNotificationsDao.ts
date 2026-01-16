// import { DocumentClient } from "aws-sdk/clients/dynamodb";
// import { UserNotification } from "../types/user/models/User";
// import { dynamoClient, USER_TABLE } from "../constants/Config";

// const updateUserNotification = async ({id, notifications}: {id: string, notifications: UserNotification}) => {
//     const updateParams: DocumentClient.UpdateItemInput = {
//         Key: {
//             id
//         },
//         TableName: USER_TABLE,
//         UpdateExpression: "set notifications = :notifications",
//         ExpressionAttributeValues: {":notifications": notifications},
//         ReturnValues: "ALL_NEW"
//     };

//     const response = await dynamoClient.update(updateParams).promise();
//     return response.Attributes as UserNotification;
// }


// export {
//     updateUserNotification
// }