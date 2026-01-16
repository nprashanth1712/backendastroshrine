import { ValidStatusTransitions } from "../../../constants/TempHostStatus";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../../data-access-supabase/ChannelDao";
import { Channel } from "../../../types/livestream/models/Livestream";
import { invalidOperation } from "../../../utils/ErrorUtils";

// Adapter functions to match the old DynamoDB interface
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);

const validateTransition = (initialStatus: string | undefined, status: string): void => {
    if (!initialStatus || !ValidStatusTransitions[initialStatus] || !ValidStatusTransitions[initialStatus].includes(status))
        throw {
            statusCode: 400,
            code: "INVALID_OPERATION",
            message: invalidOperation(`Invalid status transition : ${(initialStatus as string, status)}`),
        };
};

const fetchActiveChannelByIdAndType = async ({channelId, channelType}: {channelId: string, channelType: string}): Promise<Channel | null> => {
    const channelIndex = await getLatestOnlineHostChannel({
            channelId,
        });
    const currentChannel = channelIndex.find((value: any) => value.channelType?.toLowerCase() == channelType.toLowerCase());

    if (!currentChannel?.channelId) {
		throw {
			statusCode: 404,
			code: "ChannelNotFound",
			message: "The specified channel is not ACTIVE",
		};
	}
    const channel = await getHostChannel(currentChannel);
    return channel;
}

const getChannelDiscountedPrice = (channel: Channel): number => {
    const currentChannelRate = channel.rate - ((channel.offer / 100) * channel.rate);
    return currentChannelRate;
}

export {
    validateTransition,
    fetchActiveChannelByIdAndType,
    getChannelDiscountedPrice
}