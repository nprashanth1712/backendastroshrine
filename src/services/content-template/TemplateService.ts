import { ulid } from "ulid";
import { addTemplate, getTemplateDataById, updateTemplateData } from "../../data-access/ContentDao";
import { s3Client, PutObjectCommand, GetObjectCommand } from "../AWSS3";
import getLogger from "../../services/Logger";
import { GetObjectCommandOutput, ListObjectsV2Command, paginateListObjectsV2 } from "@aws-sdk/client-s3";
const logger = getLogger();
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


// const retrieveContentFile = async({id} : {id: string}) => {
//     const template = await getTemplateDataById({id: id});
//     const fileKey = `templates/${template.templateData.channelType}/${template.id}.${template.templateData.format}`
//     const bucketParams = {
//         Bucket: process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE,
//         Key: fileKey,
//     };
//     try {
//         const s3Object  = (await s3Client.send(new GetObjectCommand(bucketParams)));
//         return s3Object;
//     } catch(error: any) {
//         throw {
//             statusCode: 500,
//             code: "FILE_RETRIEVE_FAILED",
//             message:
//                 "Failed to upload template to database " +
//                     fileKey +
//                     ". err: " +
//                     JSON.stringify(error),
//         };
//     }
// }

const uploadContentTemplate = async ({channelType, name, file, format}: {channelType: string, name: string, file: any, format: string} ) => {
    
    const templateId  = ulid()
    const fileKey = `templates/${channelType}/${templateId}.${format}`;
    const bucketParams = {
        Bucket: process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE,
        Key: fileKey,
        Body: file.data
    }
    console.log(templateId);
    try {
        const templateData = await addTemplate({id: templateId, name, channelType, s3Url: `s3://${process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE}/templates/${fileKey}`, format})
        await s3Client.send(new PutObjectCommand(bucketParams));
        return fileKey; 
    } catch(error: any) {
        throw {
            statusCode: 500,
            code: "FILE_UPLOAD_FAILED",
            message:
                "Failed to upload template to database " +
                    templateId +
                    ". err: " +
                    JSON.stringify(error),
        };
    }
}

const uploadTemplateSample  = async({id, file}: {id: string, file: any}) => {
      
    const template = await getTemplateDataById({id: id});
    template.templateData.samples += 1;
    const fileKey = `samples/${template.templateData.channelType}/${template.id}/${template.templateData.samples}.${template.templateData.format}`;
    const bucketParams = {
        Bucket: process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE,
        Key: fileKey,
        Body: file.data
    }
    try {
        await s3Client.send(new PutObjectCommand(bucketParams));
        const templateData =  await updateTemplateData({id, templateData: template.templateData})
        return {"s3Url" : fileKey}; 
    } catch(error: any) {
        throw {
            statusCode: 500,
            code: "FILE_UPLOAD_FAILED",
            message:
                "Failed to upload template to database " +
                    template.id +
                    ". err: " +
                    JSON.stringify(error),
        };
    }
}


const getPresignedUrl = async({id}: {id: string}) => {
    const templateTable = await getTemplateDataById({id})
    const bucketParams = {
        Bucket: process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE,
        Key: `templates/${templateTable.templateData.channelType}/${templateTable.id}.${templateTable.templateData.format}`,
    }
    const command = new GetObjectCommand(bucketParams);
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600});
    return signedUrl;
}
// const retrieveTemplateSamples = async({id}: {id: string}) => {
//     const template = await getTemplateDataById({id: id});
//     const fileKey = `samples/${template.templateData.channelType}/${template.id}`
//     const bucketParams = {
//         Bucket: process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE,
//         Prefix: fileKey
//     };
//     try {
//         const totalFiles = [];
//         for await (const data of paginateListObjectsV2({client: s3Client}, bucketParams)) {
//             totalFiles.push(...(data.Contents ?? []));
//         }
//         console.log(totalFiles);
//         totalFiles.forEach(async (fileData) => {
//             const getParams = {
//                 Bucket: process.env.AWS_S3_BUCKET_CONTENT_TEMPLATE,
//                 key: fileData.Key
//             }
//             const s3Response = await (await s3Client.send(new GetObjectCommand(getParams))).Body?.transformToString();
//         })
//         return "test";
//     } catch(error: any) {
//         throw {
//             statusCode: 500,
//             code: "FILE_RETRIEVE_FAILED",
//             message:
//                 "Failed to upload template to database " +
//                     fileKey +
//                     ". err: " +
//                     JSON.stringify(error),
//         };
//     }
// }

export {
    uploadContentTemplate,
    uploadTemplateSample,
    getPresignedUrl
}