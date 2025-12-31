// import { DocumentClient } from "aws-sdk/clients/dynamodb";
// import { ASTROLOGER_TABLE, dynamoClient, USER_TABLE } from "../constants/Config";

// const updateAstrologerNotification = async ({id, notifications}: {id: string, notifications: UserNotification}) => {
//     const updateParams: DocumentClient.UpdateItemInput = {
//         Key: {
//             id
//         },
//         TableName: ASTROLOGER_TABLE,
//         UpdateExpression: "set notifications = :notifications",
//         ExpressionAttributeValues: {":notifications": notifications},
//         ReturnValues: "ALL_NEW"
//     };

//     const response = await dynamoClient.update(updateParams).promise();
//     return response.Attributes as UserNotification;
// }


// export {
//     updateAstrologerNotification
// }