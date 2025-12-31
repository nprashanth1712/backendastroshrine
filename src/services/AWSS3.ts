import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";

const s3Config = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: "ap-south-1",
};

const s3Client = new S3Client(s3Config);
export { s3Client, PutObjectCommand, GetObjectCommand };
