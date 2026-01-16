import { ListDirectoryBucketsCommand, ListObjectsCommand, DeleteObjectCommand} from "@aws-sdk/client-s3";
import { PutObjectCommand, s3Client } from "../AWSS3";

export type S3BucketKey = string;

export const uploadHostmedia = async ({hostId, file, name}: {hostId: string, file: any, name: string} ): Promise<S3BucketKey> => {
    
    const fileKey = `${hostId}/media/${name}`;
    const bucketParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC,
        Key: fileKey,
        Body: file.data
    }
    try {
        await s3Client.send(new PutObjectCommand(bucketParams));
        return fileKey as S3BucketKey; 
    } catch(error: any) {
        throw {
            statusCode: 500,
            code: "FILE_UPLOAD_FAILED",
            message:
                "Failed to upload media " +
                    hostId +
                    ". err: " +
                    JSON.stringify(error),
        };
    }
}

export const deleteHostMedia = async ({bucketName, fileKey}: {bucketName: string, fileKey: string}) => {
    const params = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey
    });
    try {
        await s3Client.send(params);
        return fileKey; 
    } catch(error: any) {
        throw {
            statusCode: 500,
            code: "FileDeleteFailed",
            message:
                "Failed to upload media " +
                    fileKey +
                    ". err: " +
                    JSON.stringify(error),
        };
    }
}

export const getFilesList = async ({bucketName, key}: {bucketName: string, key: string}) => {
    const command = new ListObjectsCommand({
        Bucket: "astroshrine-user-profile",
        Delimiter: '/',
        Prefix: key,
      });
    const test = await s3Client.send(command)
    return test; 
}