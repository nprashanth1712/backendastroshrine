const AWS = require("aws-sdk");

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
const http = require("http")
const dotenv = require('dotenv')
import { DynOutWithError } from "../types/Common";
import { dynamoClient, PRIVATE_CALL_TABLE, TEMPLATE_TABLE, USER_TABLE } from '../constants/Config';
import { Channel, TempHost } from '../types/livestream/models/Livestream';
import { ContentTemplateInput } from '../types/content/ContentTemplate';
const ULID = require("ulid");
dotenv.config();



const addTemplate = async ({id, name, channelType, s3Url, format} : 
    {id: string, name: string, channelType: string, s3Url: string, format: string}): Promise<ContentTemplateInput> => {
    const item: ContentTemplateInput = {
        id, 
        templateData: {
            name,
            channelType,
            s3Url,
            format,
            createTs: Date.now(),
            samples: 0,
        }
    };
    const params = {
        TableName: TEMPLATE_TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
    };
    const data: DynOutWithError<DocumentClient.PutItemOutput> =
        await dynamoClient.put(params).promise();
    return item;
}

const getTemplateDataById = async({id}: {id: string}) : Promise<ContentTemplateInput> => {
    const params = {
        TableName: TEMPLATE_TABLE,
        Key: {
            id,
        },
    };
    const resp: DynOutWithError<DocumentClient.GetItemOutput> =
        await dynamoClient.get(params).promise();
    return ((await resp.Item) || {}) as ContentTemplateInput;
}


const updateTemplateData = async ({ id, templateData } : { 
    id: string,
    templateData: {name: string, channelType: string, s3Url: string, format: string, createTs: number, samples: number}}): Promise<ContentTemplateInput> => {
        const params = {
            TableName: TEMPLATE_TABLE,
            Key: {
                id,
            },
            UpdateExpression: "set templateData = :templateData",
            ExpressionAttributeValues: { ":templateData": templateData },
            ReturnValues: "ALL_NEW",
        };
        const resp = await dynamoClient.update(params).promise();
        return (await resp.Attributes) as ContentTemplateInput;
}
export { 
    addTemplate, 
    getTemplateDataById,
    updateTemplateData
}