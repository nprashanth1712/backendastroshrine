// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { ChannelDao } from "../../data-access-supabase/ChannelDao";
import { invalidParameter, invalidOperation } from "../../utils/ErrorUtils";
import { Channel, ChannelType, TempHost } from "../../types/livestream/models/Livestream";
import { Astrologer } from "../../types/astrologer/Astrologer";

// Adapter functions to match the old DynamoDB interface
const getHostChannel = ChannelDao.getHostChannel.bind(ChannelDao);
const getLatestOnlineHostChannel = ChannelDao.getLatestOnlineHostChannel.bind(ChannelDao);
const updateChannelHostInfo = ChannelDao.updateChannelHostInfo.bind(ChannelDao);

type HostHandlerFunction = ({
	channelId,
	uid,
	channelType,
}: {
	channelId: string;
	uid: number;
	channelType: ChannelType;
}) => Promise<TempHost>;

export const hostPatchHandler = ({ op, path }: { op: string; path: string }): HostHandlerFunction => {
	switch (op.toUpperCase()) {
		case "REPLACE":
			return hostReplaceHandler({ path });
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(op),
			};
	}
};

const hostReplaceHandler = ({ path }: { path: string }): HostHandlerFunction => {
	switch (path.toUpperCase()) {
		case "UID":
			return hostUidHandler;
		default:
			throw {
				statusCode: 400,
				code: "INVALID_PARAM",
				message: invalidParameter(path),
			};
	}
};

const hostUidHandler = async ({
	channelId,
	channelType,
	uid,
}: {
	channelId: string;
	channelType: string;
	uid: number;
}): Promise<any> => {
	const channelIndex = await getLatestOnlineHostChannel({
		channelId,
		channelStatus: "ACTIVE",
	});
	const channel = channelIndex.find((value) => value.channelType.toLowerCase() == channelType.toLowerCase());
	console.log("the channel is ", channel);
	if (!channel?.channelId) {
		throw {
			statusCode: 404,
			code: "ChannelNotFound",
			message: "The channel does not exist",
		};
	}
	const channelData = await getHostChannel(channel);
	
	// Null check for channelData
	if (!channelData) {
		throw {
			statusCode: 404,
			code: "ChannelDataNotFound",
			message: "The channel data could not be retrieved",
		};
	}
	
	const host = channelData.host;
	if (!host) {
		throw {
			statusCode: 404,
			code: "HostNotFound",
			message: "The host data does not exist",
		};
	}
	
	let response;
	host.uid = Number(uid);
	response = await updateChannelHostInfo({
		channelId: channelData.channelId,
		createTs: channelData.createTs,
		host,
		hostProfile: (channelData as any).hostProfile || {},
	} as any);
	return response;
};
