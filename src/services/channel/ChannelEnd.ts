import { kStringMaxLength } from "buffer";
import { Channel } from "../../types/livestream/models/Livestream";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { fetchActiveChannelByIdAndType } from "./temp-host-service/CommonImports";
import { UserWaitlist } from "../../types/astrologer/Astrologer";
import { callTerminatedHandler } from "./temp-host-service/TerminatedHandler";
import { callRejectedHandler } from "./temp-host-service/RejectedHandler";
import { TransactWriteItemList } from "aws-sdk/clients/dynamodb";
import { sendMessageToSQS } from "../queue-service/SqsConsumer";
import { UserNotificationNameSpace } from "../../types/async-queue-service/NotificationTypes";
import { publishMessage } from "../Pusher";

// Adapter functions to match the old DynamoDB interface
const disableHostChannel = ChannelDao.disableHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);


type TempHostStatus = "NONE" | "ACCEPTED" | "REQUESTED";

const handleDisableChannel = async ({channelId, channelType}: {channelId: string, channelType: string}) => {
   
    let transactParams = [];

    let currentTempHostStatus: TempHostStatus = "NONE";
    const channel = await fetchActiveChannelByIdAndType({channelId, channelType});

    // host waitlist
    const hostData = await getAstrologerById(channelId);
    const hostUserWaitlist = hostData?.waitlist || {};
    const hostCurrentChannel = hostData?.currentChannel || {};

    // Get waitlist of "this channelType"
    const channelKey = `${channel?.channelType?.toLowerCase() || channelType.toLowerCase()}` as keyof UserWaitlist;
    
    // Safe assignment with null checks
    if (hostUserWaitlist) {
        (hostUserWaitlist as any)[channelKey] = channel?.waitlist || [];
    }
    if (hostCurrentChannel) {
        (hostCurrentChannel as any)[channelKey] = {
            ...(hostCurrentChannel as any)[channelKey],
            approxTime: 0,
            enabled: false
        };
    }

    // if temphost exist 
    if (channel?.tempHost?.id && channel?.tempHost?.startTime) {

        currentTempHostStatus = "ACCEPTED";
        transactParams = (await callTerminatedHandler({
            channelId,
            channelType,
            status: "TERMINATED_BY_SYSTEM",
            force: true,
            returnParams: false,
            userId: channel?.tempHost?.id,
            channelDisable: true,
        })) as TransactWriteItemList;

    } else if (channel?.tempHost?.id) {
        currentTempHostStatus = "REQUESTED";
        console.log("IN HERE ISHAN")
        await callRejectedHandler({
            channelId,
            channelType,
            status: "REJECTED",
            userId: channel?.tempHost?.id,
        });
    }

    // TODO fix this, this needs fixing
    await disableHostChannel({
        ...channel,
        hostCurrentChannel: hostCurrentChannel as any,
        channelStatus: "TERMINATED_BY_ASTROLOGER",
        hostUserWaitlist: hostUserWaitlist as any,
    } as any);
    
    // Safe call to post process with null checks
    if (channel?.channelId && channel?.createTs && channel?.channelType && channel?.channelName) {
        handleDisableChannelPostProcess({
            channelId: channel.channelId,
            createTs: channel.createTs,
            channelType: channel.channelType,
            channelName: channel.channelName
        });
    }
    console.timeEnd();
    console.log("ended lisvesterm");
}

const handleDisableChannelPostProcess = async ({channelId, createTs, channelName, channelType}: {channelId: string, createTs: number, channelType: string, channelName: string}) => {
    
    publishMessage({
        uri: `public_${channelId}`,
        action: channelType.toUpperCase() + "_ENDED",
        message: {channelId, createTs, channelType, channelName},
    });
    
    await sendMessageToSQS({
            messageRequest: {
                requestType: "initializeNotification",
                timeToDelay: 0,
                data: {
                    subType: "initializeChannelStart",
                    channelId,
                    channelCreateTs: createTs,
                    isStarting: false,
                    channelName,
                    channelType
                } as UserNotificationNameSpace.InitializeChannelStart
            }
        })
}
export {
    handleDisableChannel
}