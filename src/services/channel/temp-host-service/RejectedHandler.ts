import { ValidStatusTransitions } from "../../../constants/TempHostStatus";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../../data-access-supabase/ChannelDao";
import { Channel, TempHost, UpdateTempHostList } from "../../../types/livestream/models/Livestream";
import { invalidOperation } from "../../../utils/ErrorUtils";
import { logInformation } from "../../logging/CloudWatchService";
import { fetchActiveChannelByIdAndType, validateTransition } from "./CommonImports";

// Adapter functions to match the old DynamoDB interface
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const updateTempHostList = ChannelDao.updateTempHostList.bind(ChannelDao);



export const callRejectedHandler = async ({
    channelId,
    channelType,
    userId,
    status,
}: {
    channelId: string;
    channelType: string;
    userId: string;
    status: string;
}): Promise<TempHost> => {

    const currentTime = Date.now();
    const channel = await fetchActiveChannelByIdAndType({channelId, channelType});


    if (!channel?.channelId) {
        throw {
            statusCode: 404,
            code: "ChannelNotFound",
            message: "The specified channel is not ACTIVE",
        };
    }

    // temp host check
    if (!channel.tempHost.id || channel.tempHost.id != userId) {
        throw {
            statusCode: 403,
            code: "TempHostNotExist",
            message: "The temporary host does not exist",
        };
    }
    validateTransition(channel.tempHost.status, status);


    let channelData: Channel = {...channel};

    const { tempHost } = channelData;
    channelData = {
        ...channelData,
        tempHost: { ...tempHost, status, rejectedTime: currentTime },
    };

    const transactItemsData: UpdateTempHostList = {
        channelId: channelData.channelId,
        createTs: channelData.createTs,
        tempHost: channelData.tempHost,
        rejectedUserSession: {
            channelType: channelData.channelType.toUpperCase(),
            rejectedTime: channelData.tempHost.rejectedTime as number,
            subType: tempHost?.subType || "NA",
            uid: tempHost?.uid,
            userId: tempHost?.id,
        },
        rejectedSessionForUser: {
            subType: channelData.tempHost.subType ?? "NA",
            channelId,
            channelType,
            waitlistJoinTs: channelData.tempHost.waitlistJoinTs,
            rejectedTime: Date.now() 
        }
    };

    try {
        const updatedTempHost: TempHost = await updateTempHostList(transactItemsData);
        callRejectedPostProcess({channelId, tempHost});
        return updatedTempHost;
    } catch(error) {
        console.log("Error in callRejectedHandler");
        throw error;
    }
};


const callRejectedPostProcess = async ({channelId, tempHost}: {channelId: string, tempHost: TempHost}) => {
    logInformation({
        logType: "info",
        title: "User rejected from TempHost",
        information: {
            userId: tempHost?.id,
            channelId: channelId,
            channelType: tempHost?.channelType,
            timestamp: tempHost.rejectedTime,
        },
    });
    return;
}