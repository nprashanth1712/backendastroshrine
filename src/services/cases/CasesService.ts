import { s3Client, PutObjectCommand } from "../AWSS3";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { SupportCaseDao } from "../../data-access-supabase/SupportCaseDao";
import { SupportCase } from "../../types/case/Case";
import { SupportUserHelper } from "../support/SupportUserHelpers";
import { EndUser } from "../../types/user/models/User";
import { PrivateChat } from "../../types/chat/Chat";
import { CaseChatDao } from "../../data-access/multiple-access/SupportCaseChatDao";

// Adapter functions to match the old DynamoDB interface
const initializeCase = SupportCaseDao.initializeCase.bind(SupportCaseDao);

// should not be called externally 
const uploadCase = async ({id, userId, createTs, file} : 
    {id: string, userId: string, createTs: number, file: {name: string, data: any}}) => {
    const fileKey = `${userId}/${createTs}/${id}/${file.name}`;
    const bucketParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC, // todo
        Key: fileKey,
        Body: file.data,
    };
    try {
        const s3Response = await s3Client.send(
            new PutObjectCommand(bucketParams)
        );
        return process.env.AWS_S3_URL?.replace(
            "{{}}",
            process.env.AWS_S3_BUCKET_NAME_USER_PUBLIC!
        ) +
        "/" +
        fileKey;
    } catch (err) {
        console.log("Error uploading upload case file.", err);
        throw {
            statusCode: 500,
            code: "FILE_UPLOAD_FAILED",
            message:
                "Error to upload attachment for user :" +
                id +
                ". err: " +
                JSON.stringify(err),
        };
    }
};
const handleInitializeCase = async ({userId, caseType , details}: 
    { userId: string, caseType: string, details: string}) => {

    let currentTime = Date.now();


    const supportUser: EndUser = await SupportUserHelper.getLeastBusySupportUser();
    
    let response: SupportCase = {} as SupportCase;

    try {
        response = await initializeCase({userId, supportUserId: supportUser.id, supportUserName: supportUser.name, createTs: currentTime, caseType, details});
    } catch(error) {
        console.log(error)

        throw {
            statusCode: 401, code: "UnableToInitializeCase", message: "Could not create case"
        }
    }

    // console.log("HEERERERE")
    // let attachmentChatList : Array<PrivateChat> = [];
    // for (const file of attachments)  {
    //     let key = await uploadCase({id: response.id, userId, createTs: currentTime, file});
    //     const chatData: PrivateChat = {
    //         id: response?.id,
    //         message: key,
    //         sentTs: Date.now(),
    //         type: "image",
    //         userTs: Date.now() + '#' + userId
    //     }
    //     attachmentChatList.push(chatData);
    // }
    // await CaseChatDao.sendMultipleMessageForAttachments({chatList: attachmentChatList})

    return response;
};



export { handleInitializeCase };
