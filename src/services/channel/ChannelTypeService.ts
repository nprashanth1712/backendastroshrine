import { String } from "aws-sdk/clients/acm";

// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { AstrologerDao } from "../../data-access-supabase/AstrologerDao";
import { invalidParameter } from "../../utils/ErrorUtils";
import {
    Channel,
} from "../../types/livestream/models/Livestream";
import { handleChannelRate } from "../user/UserPricingService";
import { getAstroOrderByIdTs } from "../../data-access/AstrologerOrderDao";
import { AstrologerCurrentChannel } from "../../types/astrologer/Astrologer";

// Adapter functions to match the old DynamoDB interface
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const updateChannelApproxTime = ChannelDao.updateChannelApproxTime.bind(ChannelDao);
const updateChannelOffer = ChannelDao.updateChannelOffer.bind(ChannelDao);
const updateChannelStatus = ChannelDao.updateChannelStatus.bind(ChannelDao);
const getAstrologerById = AstrologerDao.getAstrologerById.bind(AstrologerDao);

export const channelStatusPatchHandler = ({
    op,
    path,
}: {
    op: string;
    path: string;
}) => {
    switch (op.toUpperCase()) {
        case "REPLACE":
            return channelStatusReplaceHandler({ path });
        default:
            throw {
                statusCode: 400,
                code: "INVALID_PARAM",
                message: invalidParameter(op),
            };
    }
};
const channelStatusReplaceHandler = ({ path }: { path: string }) => {
    switch (path.toUpperCase()) {
        case "LIVESTREAM/RATE": {
            return handleChannelRate.bind(null, "livestream");
        }
        case "CHAT/RATE": {
            return handleChannelRate.bind(null, "chat");
        }
        case "CALL/RATE": {
            return handleChannelRate.bind(null, "call");
        }
        case "LIVESTREAM/OFFER": {
            return handleChannelOffer.bind(null, "livestream");
        }
        case "CHAT/OFFER": {
            return handleChannelOffer.bind(null, "chat");
        }
        case "CALL/OFFER": {
            return handleChannelOffer.bind(null, "call");
        }
        case "CALL/APPROXWAITTIME": {
            return handleChannelApproxTime.bind(null, 'call');

        }
        case "CHAT/APPROXWAITTIME": {
            return handleChannelApproxTime.bind(null, 'chat');
        }
        case "LIVESTREAM/APPROXWAITTIME": {
            return handleChannelApproxTime.bind(null, 'livestream');
        }
        default:
            throw {
                statusCode: 400,
                code: "INVALID_PARAM",
                message: invalidParameter(path),
            };
    }
};

// const handleChannelRate = async (
//     channelType: string,
//     channelId: string,
//     value: number
// ) => {
//     let channelIndex: Channel = await getLatestOnlineHostChannel({ channelId });
//     console.log(channelIndex);
//     let updatedCurrentStatus: ChannelStatusType;
//     switch(channelType) {
//         case "livestream": {
//             updatedCurrentStatus = channelIndex.livestream;
//             break;
//         };
//         case "chat": {
//             updatedCurrentStatus = channelIndex.chat;
//             break;
//         };
//         case "call": {
//             updatedCurrentStatus = channelIndex.call;
//             break;
//         };
//         default: {
//             throw {
//                 statusCode: 400,
//                 code: "UnableToParseChannelStatuses",
//                 message: "Unable to parse channel's status",
//             };
//         }
//     }
//     if (updatedCurrentStatus.channelStatus) {
//         throw {
//             statusCode: 423,
//             code: "ServiceCurrentlyLocked",
//             message:
//                 "Channel is currently unavailable please stop it before attempting to update",
//         };
//     }
//     updatedCurrentStatus.rate = value;
//     const response = await updateChannelTypeStatus(
//         { channelId: channelIndex.channelId, createTs: channelIndex.createTs, channelType, channelTypeData: updatedCurrentStatus });
//     return response; 
// }


// TODO handle when the channel is offline
const handleChannelOffer = async (
    channelType: string,
    channelId: string,
    value: number
) => {
    const channelIndex = await getLatestOnlineHostChannel({ channelId });
    const channel = channelIndex.find((ch: any) => ch.channelType?.toLowerCase() == channelType.toLowerCase());
	if (!channel?.channelId) {
		throw {
			statusCode: 404,
			code: "ChannelNotFound",
			message: "The specified channel is not ACTIVE",
		};
	}
       
    const response = await updateChannelOffer(
        { channelId: channel.channelId, createTs: channel.createTs, channelType, value });
    return response;
    
}

const handleChannelStatus = async (
    channelType: string,
    channelId: string,
    value: string | number
) => {
    const channelIndex = await getLatestOnlineHostChannel({ channelId, channelStatus:"STARTED" });
    const channel = channelIndex.find((ch: any) => ch.channelType?.toLowerCase() == channelType.toLowerCase());
	if (!channel?.channelId) {
		throw {
			statusCode: 404,
			code: "ChannelNotFound",
			message: "The specified channel is not STARTED",
		};
	}
       
    const response = await updateChannelStatus(
        { channelId: channel.channelId, createTs: channel.createTs, channelType, value: value as string });
    return response;
}

const handleChannelApproxTime = async (
    channelType: string,
    channelId: string,
    value: number
) => {
    const channelIndex = await getLatestOnlineHostChannel({channelId});
    const channel = channelIndex.find((ch: any) => ch.channelType?.toLowerCase() == channelType.toLowerCase());
	if (!channel?.channelId) {
		throw {
			statusCode: 404,
			code: "ChannelNotFound",
			message: "The specified channel is not ACTIVE",
		};
	}

    const channelData = await getHostChannel(channel);
    if (!channelData) {
        throw {
            statusCode: 404,
            code: "ChannelDataNotFound",
            message: "The channel data could not be retrieved",
        };
    }
    
    console.log(channelIndex);
    const astrologerData = await getAstrologerById(channelId);
    
    // Ensure currentChannel exists
    if (!astrologerData.currentChannel) {
        astrologerData.currentChannel = {} as AstrologerCurrentChannel;
    }
    
    (astrologerData.currentChannel as any)[channelType.toLowerCase()] = {
        enabled: true,
        approxTime: value, 
    };
    
    const response = await updateChannelApproxTime({
        channelId,
        createTs: channelData.createTs,
        currentChannel: astrologerData.currentChannel as AstrologerCurrentChannel,
        channelType: channelData.channelType,
        value
    });
    return response;
}

// this is not to be used 
// const handleChannelType = async (
//     channelType: string,
//     channelId: string,
//     value: number
// ) => {
//     let channel: Channel = await getLatestOnlineHostChannel({ channelId }) as Channel;
//     const channelIndex = await getHostChannel(channel); 
//     console.log(channelIndex);
//     const livestream = channelIndex.livestream;
//     const chat = channelIndex.chat;
//     const call = channelIndex.call;

//     let validServices: Array<string> = [];
//     if (value) {
//         switch (true) {
//             case !livestream.channelStatus && call.channelStatus && !chat.channelStatus: {
//                 validServices.push("chat");
//                 break;
//             }
//             case !livestream.channelStatus && !call.channelStatus && chat.channelStatus: {
//                 validServices.push("call");
//                 break;
//             }
//             case !livestream.channelStatus && !call.channelStatus && !chat.channelStatus: {
//                 validServices.push("chat", "call", "livestream");
//                 break;
//             }
//             case !livestream.channelStatus && call.channelStatus && chat.channelStatus:
//             case livestream.channelStatus:
//                 break;

//             default: {
//                 throw {
//                     statusCode: 400,
//                     code: "UnableToParseChannelStatuses",
//                     message: "Unable to parse channel's status",
//                 };
//             }
//         }
//         if (!validServices.includes(channelType)) {
//             throw {
//                 statusCode: 423,
//                 code: "ServiceCurrentlyLocked",
//                 message:
//                     "Channel is currently unavailable please close other services",
//             };
//         }
//     }
//     const updatedChannelTypeStatus = {
//         livestream,
//         chat,
//         call,
//     };
//     let updatedCurrentStatus: ChannelStatusType; 
//     let hostNewStatus: string = "ONLINE";

//     const channelStatusKey = channelType.toLowerCase() as keyof typeof updatedChannelTypeStatus;
//     updatedChannelTypeStatus[channelStatusKey].channelStatus = value ? true : false;
//     hostNewStatus = value ? ("ON" + channelType.toUpperCase()) : "ONLINE";
//     updatedCurrentStatus = updatedChannelTypeStatus[channelStatusKey];

//     // handle when the channel status = false, termiate the current temphost 
//     if (!value && channelIndex.tempHost.id) {
//         console.log("IN HERE")
//         await callTerminatedHandler({channelId, status: "TERMINATED_BY_SYSTEM", force: true});
//     } 
//     const response = await updateChannelTypeStatus(
//         { channelId: channelIndex.channelId, createTs: channelIndex.createTs, channelType, channelTypeData: updatedCurrentStatus, hostNewStatus});
//     return { channelId: channelIndex.channelId, createTs: channelIndex.createTs, channelType, channelTypeData: updatedCurrentStatus };
// };
