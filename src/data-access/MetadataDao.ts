import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { dynamoClient, METADATA_TABLE } from "../constants/Config";
import { DynOutWithError } from "../types/Common";
import {
    AdvertisementMetaDataContent,
    AvatarMetaDataContent,
    GiftMetaDataContent,
    MetaData,
    MetaDataType,
} from "../types/metadata/Metadata";
import { ulid } from "ulid";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../services/AWSS3";

export type S3BucketKey = string;

export const uploadMetaDataMedia = async ({
    id,
    file,
    name,
}: {
    id: string;
    file: any;
    name: string;
}): Promise<S3BucketKey> => {
    const fileKey = `${id}/media/${name}`;
    const bucketParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME_METADATA_PUBLIC,
        Key: fileKey,
        Body: file.data,
    };
    try {
        await s3Client.send(new PutObjectCommand(bucketParams));
        return fileKey as S3BucketKey;
    } catch (error: any) {
        throw {
            statusCode: 500,
            code: "FILE_UPLOAD_FAILED",
            message:
                "Failed to upload media " +
                id +
                ". err: " +
                JSON.stringify(error),
        };
    }
};

export const getMetadataListByStatus = async ({status}: {status: "ACTIVE" | "INACTIVE"}) => {
    const params: DocumentClient.QueryInput = {
        TableName: METADATA_TABLE, 
        IndexName: "status-index",
        KeyConditionExpression: "#status = :metadataStatus",
        ExpressionAttributeValues: {
            ":metadataStatus": status,
        },
        ExpressionAttributeNames: {"#status": "status"}
    }

    const response = await dynamoClient.query(params).promise();
    return response.Items as Array<MetaData>;
}
export const getMetadataListByTypeStatus = async ({metadataType, status}: {metadataType: string, status: "ACTIVE" | "INACTIVE"}) => {
    const params: DocumentClient.QueryInput = {
        TableName: METADATA_TABLE, 
        IndexName: "metadataType-status-index",
        KeyConditionExpression: "metadataType = :metadataType and #status = :metadataStatus",
        ExpressionAttributeValues: {
            ":metadataType": metadataType, 
            ":metadataStatus": status,
        },
        ExpressionAttributeNames: {"#status": "status"}
    }

    const response = await dynamoClient.query(params).promise();
    return response.Items as Array<MetaData>;
}


// export const getAllActiveMetadata = async (
    
// ) => {
//     const params = {
//         TableName : METADATA_TABLE,
        
//         FilterExpression : '#metadata_status = :status',
//         ExpressionAttributeValues : {':status' : "ACTIVE"},
//         ExpressionAttributeNames: {
//             "#metadata_status": "status"
//         }
//       };

//     const resp: DynOutWithError<DocumentClient.QueryOutput> = await dynamoClient
//         .scan(params)
//         .promise();

//     if (resp.Items && resp.Items.length > 0)
//       for (const content of resp.Items!) {
//         if(content?.content?.imageUrl)
//             content.content.imageUrl =
//             process.env.AWS_S3_URL?.replace(
//                 "{{}}",
//                 process.env.AWS_S3_BUCKET_NAME_METADATA_PUBLIC!
//             ) +
//             "/" +
//             content.content.imageUrl;
//     }
//     return resp.Items as Array<MetaData>;
// };

export const addMetaData = async ({
    id,
    name,
    content,
    metadataType,
}: {
    id: string;
    name: string;
    content: GiftMetaDataContent | AdvertisementMetaDataContent | AvatarMetaDataContent;
    metadataType: MetaDataType;
}) => {
    const currentTime = Date.now();
    const metaData: MetaData = {
        id,
        name,
        metadataType,
        content,
        status: "ACTIVE",
        createTs: currentTime,
    };
    const params = {
        TableName: METADATA_TABLE,
        Item: metaData,
        ConditionExpression: "attribute_not_exists(id)",
    };
    const data: DynOutWithError<DocumentClient.PutItemOutput> =
        await dynamoClient.put(params).promise();
    return metaData as MetaData;
};
