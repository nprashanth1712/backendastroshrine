import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, GetObjectCommand} from "./AWSS3";


const getPreCheckedUrl = async ({bucketName, key} : {bucketName: string, key: string}) => {
    try {
      
            const bucketParams = {
                Bucket: bucketName,
                Key: key,
            }
            const command = new GetObjectCommand(bucketParams);
            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600});
            return signedUrl;
        }catch(error) {
        throw {
            statusCode: 400, code: "UnableToFetchS3Url", message: error
        }
    }
}

export {
    getPreCheckedUrl
}